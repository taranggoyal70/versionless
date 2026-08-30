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
    const child = spawn(command.executable, command.args, {
      cwd,
      env: process.env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
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
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    };
    child.stdout.on("data", (chunk) => {
      stdout = appendTail(stdout, chunk.toString());
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendTail(stderr, chunk.toString());
    });
    timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimeout = setTimeout(() => {
        if (settled) return;
        child.kill("SIGKILL");
        settlementTimeout = setTimeout(() => {
          finish({ passed: false, exitCode: null, signal: "SIGKILL" });
        }, killGraceMs);
      }, killGraceMs);
    }, timeoutMs);
    child.on("error", (error) => {
      stderr = appendTail(stderr, error.message);
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

function appendTail(current, next) {
  const combined = `${current}${next}`;
  return combined.length > MAX_CAPTURE_BYTES ? combined.slice(-MAX_CAPTURE_BYTES) : combined;
}
