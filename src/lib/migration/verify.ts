import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { VerificationResult } from "./types";

const execFileAsync = promisify(execFile);

async function lockedFiles(root: string): Promise<string[]> {
  const lockedRoot = path.join(root, "locked");
  return (await filesInDirectory(lockedRoot)).sort();
}

async function filesInDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isFile()) return [absolute];
      if (entry.isDirectory()) return filesInDirectory(absolute);
      return [];
    }),
  );
  return files.flat();
}

export async function hashLockedContract(root: string): Promise<string> {
  const hash = createHash("sha256");
  for (const absolute of await lockedFiles(root)) {
    hash.update(path.relative(root, absolute));
    hash.update("\0");
    hash.update(await readFile(absolute));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function verifyLockedContract(root: string, expectedHash: string): Promise<VerificationResult> {
  const startedAt = performance.now();
  const actualHash = await hashLockedContract(root);
  if (actualHash !== expectedHash) {
    return {
      verified: false,
      integrity: "changed",
      expectedHash,
      actualHash,
      exitCode: null,
      testSummary: "Verification refused: the locked behavioral contract changed.",
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  try {
    const executionRoot = await realpath(root);
    const { stdout, stderr } = await execFileAsync(process.execPath, [
      ...nodePermissionArgs(executionRoot),
      "locked/receipt-flow.test.mjs",
    ], {
      cwd: executionRoot,
      env: { CI: "1", NO_COLOR: "1", NODE_ENV: "test" },
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      verified: true,
      integrity: "unchanged",
      expectedHash,
      actualHash,
      exitCode: 0,
      testSummary: `${stdout}\n${stderr}`.trim(),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    return {
      verified: false,
      integrity: "unchanged",
      expectedHash,
      actualHash,
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      testSummary: `${failure.stdout ?? ""}\n${failure.stderr ?? failure.message}`.trim(),
      durationMs: Math.round(performance.now() - startedAt),
    };
  }
}

function nodePermissionArgs(root: string) {
  if (process.allowedNodeEnvironmentFlags.has("--permission")) {
    return ["--permission", `--allow-fs-read=${root}`];
  }
  if (process.allowedNodeEnvironmentFlags.has("--experimental-permission")) {
    return ["--experimental-permission", `--allow-fs-read=${root}`];
  }
  return [];
}
