import { rejectionReasonLabels } from "./reasons.mjs";

export function formatJobSummary(evidence) {
  const decision = evidence.status === "verified" ? "Verified" : "Rejected";
  const icon = evidence.status === "verified" ? "✅" : "❌";
  let verification;
  if (evidence.error) {
    verification = "Verification did not run because the check could not establish proof.";
  } else if (evidence.verification.skipped) {
    verification = "Verification skipped because the integrity boundary failed.";
  } else if (evidence.verification.passed) {
    verification = `Verification passed in ${evidence.verification.durationMs}ms.`;
  } else {
    verification = `Verification failed in ${evidence.verification.durationMs}ms.`;
  }
  const lockedProof = evidence.integrity.unchanged === null
    ? "Unavailable"
    : evidence.integrity.unchanged ? "Unchanged" : "Changed";
  const workspace = evidence.workspace.clean === null
    ? "Unavailable"
    : evidence.workspace.clean ? "Clean" : `${evidence.workspace.changes.length} uncommitted change(s)`;

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
    `| Workspace | ${workspace} |`,
    `| Locked contract | ${lockedProof} |`,
    `| Verification | ${verification} |`,
    "",
    "### Decision reasons",
    ...bullets(evidence.reasons.map((reason) => rejectionReasonLabels[reason] ?? reason), "No rejection reasons."),
    "",
    "### Allowed changes",
    ...pathBullets(evidence.pathPolicy.allowedChanges),
    "",
    "### Locked changes",
    ...pathBullets(evidence.pathPolicy.lockedChanges),
    "",
    "### Out-of-scope changes",
    ...pathBullets(evidence.pathPolicy.outOfScopeChanges),
    "",
    evidence.integrity.headHash
      ? `<sub>Locked SHA-256: \`${short(evidence.integrity.headHash, 16)}\`</sub>`
      : `<sub>Error: ${safeInline(evidence.error?.code ?? "CHECK_ERROR")}</sub>`,
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
  if (typeof value !== "string" || value.length === 0) return "unavailable";
  return safeInline(value).slice(0, length);
}
