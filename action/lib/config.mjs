export class PolicyError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PolicyError";
    this.code = code;
  }
}

export function loadPolicyFromText(text) {
  const policy = JSON.parse(text);
  if (policy.version !== 1) {
    throw new PolicyError("UNSUPPORTED_VERSION", "Versionless policy version must be 1.");
  }
  return {
    version: policy.version,
    lockedPaths: policy.lockedPaths,
    allowedPaths: policy.allowedPaths,
    workingDirectory: policy.workingDirectory ?? ".",
    verification: policy.verification,
  };
}
