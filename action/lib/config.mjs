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
  if (policy.version !== 1) {
    throw new PolicyError("UNSUPPORTED_VERSION", "Versionless policy version must be 1.");
  }
  if (!isNonEmptyStringArray(policy.lockedPaths) || !isNonEmptyStringArray(policy.allowedPaths)) {
    throw new PolicyError("INVALID_POLICY", "lockedPaths and allowedPaths must be non-empty string arrays.");
  }
  if (policy.workingDirectory !== undefined && typeof policy.workingDirectory !== "string") {
    throw new PolicyError("INVALID_POLICY", "workingDirectory must be a repository-relative string.");
  }
  if (!isObject(policy.verification)
    || typeof policy.verification.executable !== "string"
    || !/^[A-Za-z0-9_./+-]+$/.test(policy.verification.executable)
    || !Array.isArray(policy.verification.args)
    || !policy.verification.args.every((argument) => typeof argument === "string")) {
    throw new PolicyError("INVALID_VERIFICATION", "verification must contain a safe executable and string argument array.");
  }
  return {
    version: policy.version,
    lockedPaths: policy.lockedPaths,
    allowedPaths: policy.allowedPaths,
    workingDirectory: policy.workingDirectory ?? ".",
    verification: policy.verification,
  };
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value) {
  return Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0);
}
