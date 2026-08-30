import { runPullRequestCheck } from "./check.mjs";
import { writeEvidence } from "./evidence.mjs";
import { writeActionOutputs, writeStepSummary } from "./github.mjs";
import { formatJobSummary } from "./report.mjs";
import { RejectionReason } from "./reasons.mjs";

export class ActionInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ActionInputError";
    this.code = "MISSING_INPUT";
  }
}

export async function runAction({ repository, environment = process.env }) {
  const baseSha = environment.INPUT_BASE_SHA || "";
  const headSha = environment.INPUT_HEAD_SHA || "";
  const configPath = environment.INPUT_CONFIG_PATH || ".versionless.json";
  const requestedEvidencePath = environment.INPUT_EVIDENCE_PATH || ".versionless/evidence.json";

  let evidence;
  try {
    required(baseSha, "base-sha");
    required(headSha, "head-sha");
    evidence = await runPullRequestCheck({ repository, baseSha, headSha, configPath });
  } catch (error) {
    evidence = failedCheckEvidence({ baseSha, headSha, configPath }, error);
  }
  const evidencePath = await writeEvidence(repository, requestedEvidencePath, evidence);
  const summary = formatJobSummary(evidence);

  if (environment.GITHUB_STEP_SUMMARY) {
    await writeStepSummary(environment.GITHUB_STEP_SUMMARY, summary);
  }
  if (environment.GITHUB_OUTPUT) {
    await writeActionOutputs(environment.GITHUB_OUTPUT, {
      status: evidence.status,
      "evidence-path": evidencePath,
      "locked-hash": evidence.integrity.headHash ?? "",
      "reason-codes": evidence.reasons.join(","),
    });
  }

  return { evidence, evidencePath, summary };
}

function failedCheckEvidence({ baseSha, headSha, configPath }, error) {
  const code = typeof error?.code === "string" ? error.code : "CHECK_ERROR";
  const message = error instanceof Error ? error.message : "Versionless could not establish proof.";
  return {
    schema: "versionless.pr_check.v1",
    createdAt: new Date().toISOString(),
    status: "rejected",
    baseSha,
    headSha,
    checkoutSha: null,
    workspace: { clean: null, changes: [] },
    configPath,
    changedPaths: [],
    policy: null,
    pathPolicy: {
      accepted: false,
      allowedChanges: [],
      lockedChanges: [],
      outOfScopeChanges: [],
    },
    integrity: {
      algorithm: "sha256",
      baseHash: null,
      headHash: null,
      unchanged: null,
      files: [],
      missingPaths: [],
    },
    verification: {
      passed: false,
      skipped: true,
      exitCode: null,
      signal: null,
      timedOut: false,
      stdout: "",
      stderr: "",
      durationMs: 0,
    },
    reasons: [RejectionReason.CHECK_FAILED],
    error: { code, message },
  };
}

function required(value, inputName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ActionInputError(`Versionless requires the ${inputName} input.`);
  }
  return value;
}
