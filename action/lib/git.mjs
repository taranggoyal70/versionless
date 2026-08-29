import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { normalizeRepositoryPath } from "./paths.mjs";

const execFileAsync = promisify(execFile);

export async function listChangedPaths(repository, baseSha, headSha) {
  assertObjectId(baseSha);
  assertObjectId(headSha);
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "core.quotepath=false", "diff", "--name-only", "-z", baseSha, headSha, "--"],
    { cwd: repository, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  return [...new Set(stdout.split("\0").filter(Boolean).map(normalizeRepositoryPath))].sort();
}

function assertObjectId(value) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value)) {
    throw new TypeError("Git commit identifiers must be full hexadecimal object IDs.");
  }
}
