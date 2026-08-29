import { posix } from "node:path";

export function normalizeRepositoryPath(input) {
  if (typeof input !== "string") throw new TypeError("Repository path must be a string.");
  const trimmed = input.trim();
  if (!trimmed || trimmed.includes("\\") || trimmed.includes("\0") || posix.isAbsolute(trimmed)) {
    throw new TypeError("Repository path must be a safe relative POSIX path.");
  }

  const normalized = posix.normalize(trimmed).replace(/^\.\//, "").replace(/\/$/, "");
  const segments = normalized.split("/");
  if (!normalized || normalized === ".." || normalized.startsWith("../") || segments.includes(".git")) {
    throw new TypeError("Repository path must stay inside the repository and outside .git.");
  }
  return normalized;
}

export function isPathWithin(filePath, rootPath) {
  const file = normalizeRepositoryPath(filePath);
  const root = normalizeRepositoryPath(rootPath);
  return root === "." || file === root || file.startsWith(`${root}/`);
}
