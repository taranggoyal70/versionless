import { isPathWithin, normalizeRepositoryPath } from "./paths.mjs";

export const EXECUTABLE_PATTERN = "^[A-Za-z0-9_./+-]+$";
export const POLICY_LIMITS = Object.freeze({
  pathCount: 64,
  pathLength: 300,
  executableLength: 240,
  argumentCount: 32,
  argumentLength: 500,
});

const POLICY_FIELDS = new Set(["$schema", "version", "lockedPaths", "allowedPaths", "workingDirectory", "verification"]);
const VERIFICATION_FIELDS = new Set(["executable", "args"]);
const executablePattern = new RegExp(EXECUTABLE_PATTERN);

export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

export function loadPolicyFromText(text) {
  let policy;
  try {
    policy = JSON.parse(text);
  } catch {
    throw new PolicyError("MALFORMED_JSON", "Versionless policy must be valid JSON.");
  }
  if (!isObject(policy) || policy.version === undefined) {
    throw new PolicyError("INVALID_POLICY", "Versionless policy is missing required fields.");
  }
  assertKnownFields(policy, POLICY_FIELDS, "policy");
  if (policy.version !== 1) {
    throw new PolicyError("UNSUPPORTED_VERSION", "Versionless policy version must be 1.");
  }
  if (!isNonEmptyStringArray(policy.lockedPaths) || !isNonEmptyStringArray(policy.allowedPaths)) {
    throw new PolicyError("INVALID_POLICY", "lockedPaths and allowedPaths must be non-empty string arrays.");
  }
  if (policy.workingDirectory !== undefined
    && (typeof policy.workingDirectory !== "string" || policy.workingDirectory.length > POLICY_LIMITS.pathLength)) {
    throw new PolicyError("INVALID_POLICY", "workingDirectory must be a repository-relative string.");
  }
  if (isObject(policy.verification)) {
    assertKnownFields(policy.verification, VERIFICATION_FIELDS, "verification");
  }
  if (!isObject(policy.verification)
    || typeof policy.verification.executable !== "string"
    || policy.verification.executable.length === 0
    || policy.verification.executable.length > POLICY_LIMITS.executableLength
    || !executablePattern.test(policy.verification.executable)
    || !Array.isArray(policy.verification.args)
    || policy.verification.args.length > POLICY_LIMITS.argumentCount
    || !policy.verification.args.every(
      (argument) => typeof argument === "string" && argument.length <= POLICY_LIMITS.argumentLength,
    )) {
    throw new PolicyError("INVALID_VERIFICATION", "verification must contain a safe executable and string argument array.");
  }
  const lockedPaths = normalizePolicyPaths(policy.lockedPaths);
  const allowedPaths = normalizePolicyPaths(policy.allowedPaths);
  let workingDirectory;
  try {
    workingDirectory = normalizeRepositoryPath(policy.workingDirectory ?? ".");
  } catch {
    throw new PolicyError("INVALID_PATH", "Versionless policy paths must stay inside the repository.");
  }
  if (lockedPaths.some((locked) => allowedPaths.some((allowed) => isPathWithin(allowed, locked)))) {
    throw new PolicyError("OVERLAPPING_PATH_POLICY", "An allowed path cannot be nested inside the locked contract.");
  }
  return {
    version: policy.version,
    lockedPaths,
    allowedPaths,
    workingDirectory,
    verification: policy.verification,
  };
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value)
    && value.length > 0
    && value.length <= POLICY_LIMITS.pathCount
    && value.every(
      (item) => typeof item === "string" && item.length > 0 && item.length <= POLICY_LIMITS.pathLength,
    );
}

function assertKnownFields(value, allowedFields, location) {
  const unknownField = Object.keys(value).find((field) => !allowedFields.has(field));
  if (unknownField !== undefined) {
    throw new PolicyError("UNKNOWN_FIELD", `Unknown ${location} field: ${unknownField}.`);
  }
}

function normalizePolicyPaths(paths) {
  try {
    const normalized = paths.map(normalizeRepositoryPath);
    if (new Set(normalized).size !== normalized.length) {
      throw new TypeError("Duplicate repository path.");
    }
    return normalized;
  } catch {
    throw new PolicyError("INVALID_PATH", "Versionless policy paths must stay inside the repository and be unique.");
  }
}
