const reasonLabels = {
  CHECKOUT_MISMATCH: "Checked-out commit does not match the requested head",
  WORKTREE_DIRTY: "Workspace contains changes outside the requested head",
  LOCKED_PATH_MISSING: "Configured locked proof is missing",
  LOCKED_PATH_CHANGED: "Locked proof changed",
  OUT_OF_SCOPE_CHANGE: "A file changed outside the approved scope",
  LOCKED_HASH_CHANGED: "Locked proof fingerprint changed",
  VERIFICATION_FAILED: "Behavioral verification failed",
};

export function formatJobSummary(evidence) {
  const decision = evidence.status === "verified" ? "Verified" : "Rejected";
  const icon = evidence.status === "verified" ? "✅" : "❌";
  const verification = evidence.verification.skipped
    ? "Verification skipped because the integrity boundary failed."
    : evidence.verification.passed
      ? `Verification passed in ${evidence.verification.durationMs}ms.`
      : `Verification failed in ${evidence.verification.durationMs}ms.`;

  return [
    "# Versionless PR check",
    "",
    `## ${icon} ${decision}`,
    "",
    `| Evidence | Value |`,
    `| --- | --- |`,
    `| Base commit | \`${short(evidence.baseSha)}\` |`,
    `| Head commit | \`${short(evidence.headSha)}\` |`,
    `| Checked-out commit | \`${short(evidence.checkoutSha)}\` |`,
    `| Workspace | ${evidence.workspace.clean ? "Clean" : `${evidence.workspace.changes.length} uncommitted change(s)`} |`,
    `| Locked proof | ${evidence.integrity.unchanged ? "Unchanged" : "Changed"} |`,
    `| Verification | ${verification} |`,
    "",
    "### Decision reasons",
    ...bullets(evidence.reasons.map((reason) => reasonLabels[reason] ?? reason), "No rejection reasons."),
    "",
    "### Approved changes",
    ...pathBullets(evidence.pathPolicy.approvedChanges),
    "",
    "### Locked changes",
    ...pathBullets(evidence.pathPolicy.lockedChanges),
    "",
    "### Out-of-scope changes",
    ...pathBullets(evidence.pathPolicy.outOfScopeChanges),
    "",
    `<sub>Locked SHA-256: \`${short(evidence.integrity.headHash, 16)}\`</sub>`,
    "",
  ].join("\n");
}

function pathBullets(paths) {
  return bullets(paths.map((path) => `\`${safeInline(path)}\``), "None.");
}

function bullets(items, emptyLabel) {
  if (items.length === 0) return [`- ${emptyLabel}`];
  return items.slice(0, 50).map((item) => `- ${item}`);
}

function safeInline(value) {
  return String(value).replace(/[\r\n`]/g, "'");
}

function short(value, length = 12) {
  return safeInline(value).slice(0, length);
}
