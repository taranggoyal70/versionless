import { isPathWithin, normalizeRepositoryPath } from "./paths.mjs";

export function evaluatePathPolicy(changedPaths, policy) {
  const allowedChanges = [];
  const lockedChanges = [];
  const outOfScopeChanges = [];

  for (const path of [...new Set(changedPaths.map(normalizeRepositoryPath))].sort()) {
    if (policy.lockedPaths.some((locked) => isPathWithin(path, locked))) {
      lockedChanges.push(path);
    } else if (policy.allowedPaths.some((allowed) => isPathWithin(path, allowed))) {
      allowedChanges.push(path);
    } else {
      outOfScopeChanges.push(path);
    }
  }

  return {
    accepted: lockedChanges.length === 0 && outOfScopeChanges.length === 0,
    allowedChanges,
    lockedChanges,
    outOfScopeChanges,
  };
}
