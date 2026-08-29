#!/usr/bin/env node

import { runAction } from "./lib/main.mjs";

try {
  const result = await runAction({
    repository: process.env.GITHUB_WORKSPACE || process.cwd(),
    environment: process.env,
  });
  if (result.evidence.status === "verified") {
    console.log("::notice title=Versionless::Versionless verified this pull request against unchanged proof.");
  } else {
    console.error(`::error title=Versionless rejected this pull request::${escapeWorkflowCommand(result.evidence.reasons.join(", "))}`);
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Versionless failed before producing evidence.";
  console.error(`::error title=Versionless check failed::${escapeWorkflowCommand(message)}`);
  process.exitCode = 1;
}

function escapeWorkflowCommand(value) {
  return String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}
