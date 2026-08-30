import { describe, expect, it } from "vitest";

import { runVerification } from "./lib/verify.mjs";

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
});
