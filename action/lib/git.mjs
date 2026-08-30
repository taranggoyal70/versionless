import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
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

export async function hashLockedPaths(repository, commitSha, lockedPaths) {
  assertObjectId(commitSha);
  const paths = [...new Set(lockedPaths.map(normalizeRepositoryPath))].sort();
  const { stdout } = await execFileAsync(
    "git",
    ["-c", "core.quotepath=false", "ls-tree", "-r", "-z", "--full-tree", commitSha, "--", ...paths],
    { cwd: repository, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  );
  const files = stdout
    .split("\0")
    .filter(Boolean)
    .map((entry) => entry.slice(entry.indexOf("\t") + 1))
    .map(normalizeRepositoryPath)
    .sort();
  return {
    algorithm: "sha256",
    hash: createHash("sha256").update(stdout).digest("hex"),
    files,
  };
}

export async function readFileAtCommit(repository, commitSha, filePath) {
  assertObjectId(commitSha);
  const path = normalizeRepositoryPath(filePath);
  const { stdout } = await execFileAsync(
    "git",
    ["show", `${commitSha}:${path}`],
    { cwd: repository, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  return stdout;
}

export async function readCurrentHead(repository) {
  const { stdout } = await execFileAsync(
    "git",
    ["rev-parse", "HEAD"],
    { cwd: repository, encoding: "utf8", maxBuffer: 1024 },
  );
  const headSha = stdout.trim();
  assertObjectId(headSha);
  return headSha;
}

export async function listWorkspaceChanges(repository, { ignoredUntrackedPaths = [] } = {}) {
  const commands = [
    ["diff", "--name-only", "-z", "HEAD", "--"],
    ["diff", "--cached", "--name-only", "-z", "HEAD", "--"],
    ["ls-files", "--others", "--exclude-standard", "-z", "--"],
  ];
  const results = await Promise.all(commands.map((args) => execFileAsync(
    "git",
    ["-c", "core.quotepath=false", ...args],
    { cwd: repository, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
  )));
  const ignored = new Set(ignoredUntrackedPaths.map(normalizeRepositoryPath));
  const trackedChanges = results.slice(0, 2).flatMap(({ stdout }) => parsePaths(stdout));
  const untrackedChanges = parsePaths(results[2].stdout).filter((path) => !ignored.has(path));
  return [...new Set([...trackedChanges, ...untrackedChanges])].sort();
}

function parsePaths(output) {
  return output.split("\0").filter(Boolean).map(normalizeRepositoryPath);
}

function assertObjectId(value) {
  if (typeof value !== "string" || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value)) {
    throw new TypeError("Git commit identifiers must be full hexadecimal object IDs.");
  }
}
