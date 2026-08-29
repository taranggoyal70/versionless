import { loadPolicyFromText } from "./config.mjs";
import { hashLockedPaths, listChangedPaths, readCurrentHead, readFileAtCommit } from "./git.mjs";
import { isPathWithin, normalizeRepositoryPath } from "./paths.mjs";
import { evaluatePathPolicy } from "./policy.mjs";
import { runVerification } from "./verify.mjs";

export async function runPullRequestCheck({ repository, baseSha, headSha, configPath = ".versionless.json" }) {
  const normalizedConfigPath = normalizeRepositoryPath(configPath);
  const policyText = await readFileAtCommit(repository, baseSha, normalizedConfigPath);
  const configuredPolicy = loadPolicyFromText(policyText);
  const policy = {
    ...configuredPolicy,
    lockedPaths: [...new Set([normalizedConfigPath, ...configuredPolicy.lockedPaths])].sort(),
  };

  const changedPaths = await listChangedPaths(repository, baseSha, headSha);
  const [baseProof, headProof, checkoutSha] = await Promise.all([
    hashLockedPaths(repository, baseSha, policy.lockedPaths),
    hashLockedPaths(repository, headSha, policy.lockedPaths),
    readCurrentHead(repository),
  ]);
  const pathPolicy = evaluatePathPolicy(changedPaths, policy);
  const missingPaths = policy.lockedPaths.filter(
    (lockedPath) => !baseProof.files.some((file) => isPathWithin(file, lockedPath)),
  );
  const integrity = {
    algorithm: baseProof.algorithm,
    baseHash: baseProof.hash,
    headHash: headProof.hash,
    unchanged: baseProof.hash === headProof.hash,
    files: baseProof.files,
    missingPaths,
  };
  const reasons = rejectionReasons(pathPolicy, integrity);
  if (checkoutSha !== headSha) reasons.unshift("CHECKOUT_MISMATCH");
  const verification = reasons.length === 0
    ? await runVerification(repository, policy.workingDirectory, policy.verification)
    : skippedVerification();
  if (!verification.passed && !verification.skipped) reasons.push("VERIFICATION_FAILED");

  return {
    schema: "versionless.pr_check.v1",
    createdAt: new Date().toISOString(),
    status: reasons.length === 0 ? "verified" : "rejected",
    baseSha,
    headSha,
    checkoutSha,
    configPath: normalizedConfigPath,
    changedPaths,
    policy,
    pathPolicy,
    integrity,
    verification,
    reasons,
  };
}

function rejectionReasons(pathPolicy, integrity) {
  const reasons = [];
  if (integrity.missingPaths.length > 0) reasons.push("LOCKED_PATH_MISSING");
  if (pathPolicy.lockedChanges.length > 0) reasons.push("LOCKED_PATH_CHANGED");
  if (pathPolicy.outOfScopeChanges.length > 0) reasons.push("OUT_OF_SCOPE_CHANGE");
  if (!integrity.unchanged) reasons.push("LOCKED_HASH_CHANGED");
  return reasons;
}

function skippedVerification() {
  return {
    passed: false,
    skipped: true,
    exitCode: null,
    signal: null,
    timedOut: false,
    stdout: "",
    stderr: "",
    durationMs: 0,
  };
}
