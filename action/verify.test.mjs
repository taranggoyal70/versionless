import { mkdtemp, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runVerification } from "./lib/verify.mjs";

const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("runVerification", () => {
  it("captures a successful command without invoking a shell", async () => {
    const result = await runVerification(process.cwd(), ".", {
      executable: process.execPath,
      args: ["-e", "process.stdout.write('proof passed')"],
    });

    expect(result).toMatchObject({
      passed: true,
      exitCode: 0,
      stdout: "proof passed",
      stderr: "",
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("fails closed when verification exits unsuccessfully", async () => {
    const result = await runVerification(process.cwd(), ".", {
      executable: process.execPath,
      args: ["-e", "process.stderr.write('proof failed'); process.exit(3)"],
    });

    expect(result).toMatchObject({
      passed: false,
      exitCode: 3,
      timedOut: false,
      stderr: "proof failed",
    });
  });

  it("marks captured output when only the tail fits in evidence", async () => {
    const result = await runVerification(process.cwd(), ".", {
      executable: process.execPath,
      args: ["-e", "process.stdout.write('o'.repeat(70000));process.stderr.write('e'.repeat(70000))"],
    });

    expect(result).toMatchObject({
      passed: true,
      stdoutTruncated: true,
      stderrTruncated: true,
    });
    expect(result.stdout).toHaveLength(64 * 1024);
    expect(result.stderr).toHaveLength(64 * 1024);
  });

  it("fails closed when verification exceeds its time limit", async () => {
    const result = await runVerification(
      process.cwd(),
      ".",
      { executable: process.execPath, args: ["-e", "setTimeout(() => {}, 10_000)"] },
      { timeoutMs: 20 },
    );

    expect(result).toMatchObject({
      passed: false,
      exitCode: null,
      signal: "SIGTERM",
      timedOut: true,
    });
  });

  it("force-kills a verification process that ignores graceful termination", async () => {
    const result = await runVerification(
      process.cwd(),
      ".",
      {
        executable: process.execPath,
        args: ["-e", "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],
      },
      { timeoutMs: 100, killGraceMs: 20 },
    );

    expect(result).toMatchObject({
      passed: false,
      exitCode: null,
      signal: "SIGKILL",
      timedOut: true,
    });
  });

  it("refuses a working directory symlink outside the repository", async () => {
    const repository = await mkdtemp(join(tmpdir(), "versionless-verify-"));
    const outside = await mkdtemp(join(tmpdir(), "versionless-outside-"));
    directories.push(repository, outside);
    await symlink(outside, join(repository, "workspace"));

    await expect(runVerification(repository, "workspace", {
      executable: process.execPath,
      args: ["-e", "process.exit(0)"],
    })).rejects.toThrowError("Verification working directory must stay inside the repository.");
  });

  it("kills descendants spawned by a timed-out verification wrapper", async () => {
    const wrapper = [
      "const {spawn}=require('node:child_process');",
      "const child=spawn(process.execPath,['-e',\"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)\"],{stdio:['ignore','inherit','inherit']});",
      "process.stdout.write(`descendant:${child.pid}\\n`);",
      "process.on('SIGTERM',()=>{});",
      "setInterval(()=>{},1000);",
    ].join("");

    const result = await runVerification(
      process.cwd(),
      ".",
      { executable: process.execPath, args: ["-e", wrapper] },
      { timeoutMs: 150, killGraceMs: 50 },
    );
    const descendantPid = Number(result.stdout.match(/descendant:(\d+)/)?.[1]);

    expect(descendantPid).toBeGreaterThan(0);
    try {
      expect(processExists(descendantPid)).toBe(false);
    } finally {
      if (processExists(descendantPid)) process.kill(descendantPid, "SIGKILL");
    }
  });
});

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}
