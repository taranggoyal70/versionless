import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";

import { normalizeRepositoryPath } from "./paths.mjs";

const MAX_CAPTURE_BYTES = 64 * 1024;

export async function runVerification(
  repository,
  workingDirectory,
  command,
  { timeoutMs = 10 * 60 * 1000, killGraceMs = 5_000 } = {},
) {
  const repositoryRoot = await realpath(repository);
  const normalizedWorkingDirectory = normalizeRepositoryPath(workingDirectory);
  const requestedWorkingDirectory = normalizedWorkingDirectory === "."
    ? repositoryRoot
    : resolve(repositoryRoot, normalizedWorkingDirectory);
  const cwd = await realpath(requestedWorkingDirectory);
  if (cwd !== repositoryRoot && !cwd.startsWith(`${repositoryRoot}${sep}`)) {
    throw new TypeError("Verification working directory must stay inside the repository.");
  }

  const startedAt = Date.now();
  return new Promise((resolveResult) => {
    const isolatedProcessGroup = process.platform !== "win32";
    const child = spawn(command.executable, command.args, {
      cwd,
      detached: isolatedProcessGroup,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let stdoutTruncated = false;
    let stderrTruncated = false;
    let timedOut = false;
    let settled = false;
    let timeout;
    let killTimeout;
    let settlementTimeout;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      if (killTimeout) clearTimeout(killTimeout);
      if (settlementTimeout) clearTimeout(settlementTimeout);
      resolveResult({
        ...result,
        timedOut,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
        stdoutTruncated,
        stderrTruncated,
        durationMs: Date.now() - startedAt,
      });
    };
    child.stdout.on("data", (chunk) => {
      const capture = appendTail(stdout, chunk);
      stdout = capture.tail;
      stdoutTruncated ||= capture.truncated;
    });
    child.stderr.on("data", (chunk) => {
      const capture = appendTail(stderr, chunk);
      stderr = capture.tail;
      stderrTruncated ||= capture.truncated;
    });
    timeout = setTimeout(() => {
      timedOut = true;
      terminateProcessTree(child, "SIGTERM", isolatedProcessGroup);
      killTimeout = setTimeout(() => {
        if (settled) return;
        terminateProcessTree(child, "SIGKILL", isolatedProcessGroup);
        settlementTimeout = setTimeout(() => {
          finish({ passed: false, exitCode: null, signal: "SIGKILL" });
        }, killGraceMs);
      }, killGraceMs);
    }, timeoutMs);
    child.on("error", (error) => {
      const capture = appendTail(stderr, Buffer.from(error.message));
      stderr = capture.tail;
      stderrTruncated ||= capture.truncated;
      finish({ passed: false, exitCode: null, signal: null });
    });
    child.on("close", (exitCode, signal) => {
      finish({
        passed: exitCode === 0,
        exitCode,
        signal,
      });
    });
  });
}

function terminateProcessTree(child, signal, isolatedProcessGroup) {
  if (isolatedProcessGroup && child.pid) {
    try {
      process.kill(-child.pid, signal);
      return;
    } catch (error) {
      if (error?.code === "ESRCH") return;
    }
  }
  child.kill(signal);
}

function appendTail(current, next) {
  const combined = Buffer.concat([current, next]);
  return {
    tail: combined.length > MAX_CAPTURE_BYTES ? combined.subarray(-MAX_CAPTURE_BYTES) : combined,
    truncated: combined.length > MAX_CAPTURE_BYTES,
  };
}
