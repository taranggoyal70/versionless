export function loadPolicyFromText(text) {
  const policy = JSON.parse(text);
  return {
    version: policy.version,
    lockedPaths: policy.lockedPaths,
    allowedPaths: policy.allowedPaths,
    workingDirectory: policy.workingDirectory ?? ".",
    verification: policy.verification,
  };
}
