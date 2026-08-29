import { runPullRequestCheck } from "./check.mjs";
import { writeEvidence } from "./evidence.mjs";
import { writeActionOutputs, writeStepSummary } from "./github.mjs";
import { formatJobSummary } from "./report.mjs";

export class ActionInputError extends Error {
  constructor(message) {
    super(message);
    this.name = "ActionInputError";
    this.code = "MISSING_INPUT";
  }
}

export async function runAction({ repository, environment = process.env }) {
  const baseSha = required(environment.INPUT_BASE_SHA, "base-sha");
  const headSha = required(environment.INPUT_HEAD_SHA, "head-sha");
  const configPath = environment.INPUT_CONFIG_PATH || ".versionless.json";
  const requestedEvidencePath = environment.INPUT_EVIDENCE_PATH || ".versionless/evidence.json";

  const evidence = await runPullRequestCheck({ repository, baseSha, headSha, configPath });
  const evidencePath = await writeEvidence(repository, requestedEvidencePath, evidence);
  const summary = formatJobSummary(evidence);

  if (environment.GITHUB_STEP_SUMMARY) {
    await writeStepSummary(environment.GITHUB_STEP_SUMMARY, summary);
  }
  if (environment.GITHUB_OUTPUT) {
    await writeActionOutputs(environment.GITHUB_OUTPUT, {
      status: evidence.status,
      "evidence-path": evidencePath,
      "locked-hash": evidence.integrity.headHash,
    });
  }

  return { evidence, evidencePath, summary };
}

function required(value, inputName) {
  if (typeof value !== "string" || value.length === 0) {
    throw new ActionInputError(`Versionless requires the ${inputName} input.`);
  }
  return value;
}
