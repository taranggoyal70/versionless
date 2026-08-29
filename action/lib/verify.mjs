import { spawn } from "node:child_process";
import { resolve, sep } from "node:path";

import { normalizeRepositoryPath } from "./paths.mjs";

const MAX_CAPTURE_BYTES = 64 * 1024;

export function runVerification(repository, workingDirectory, command, { timeoutMs = 10 * 60 * 1000 } = {}) {
  const repositoryRoot = resolve(repository);
  const normalizedWorkingDirectory = normalizeRepositoryPath(workingDirectory);
  const cwd = normalizedWorkingDirectory === "." ? repositoryRoot : resolve(repositoryRoot, normalizedWorkingDirectory);
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
    const finish = (result) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
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
