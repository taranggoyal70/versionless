import { describe, expect, it } from "vitest";

import { initialMigrationState, reduceMigrationEvent } from "./state";
import type { MigrationEvent } from "./types";

const at = "2026-08-23T13:00:00.000Z";

describe("reduceMigrationEvent", () => {
  it("builds a verified public view from the ordered migration stream", () => {
    const events: MigrationEvent[] = [
      { type: "run.started", runId: "vr_demo", at },
      { type: "contract.loaded", from: "2022-08-01", to: "2022-11-15", at },
      {
        type: "impact.found",
        impact: {
          file: "src/receipt.mjs",
          line: 6,
          column: 10,
          kind: "removed-field",
          symbol: "PaymentIntent.charges",
          evidence: "return paymentIntent.charges.data[0]?.receipt_url;",
          guidance: "List charges directly.",
        },
        at,
      },
      { type: "integrity.locked", hash: "sha256:before", at },
      { type: "baseline.failed", summary: "Cannot read charges", at },
      { type: "agent.started", agent: "OpenAI Codex", at },
      { type: "agent.message", message: "Updated the charge lookup.", at },
      { type: "patch.ready", diff: "+ stripe.charges.list", filesChanged: 1, at },
      { type: "verification.started", at },
      {
        type: "verification.completed",
        result: {
          verified: true,
          integrity: "unchanged",
          expectedHash: "sha256:before",
          actualHash: "sha256:before",
          exitCode: 0,
          testSummary: "pass 1",
          durationMs: 84,
        },
        at,
      },
      { type: "evidence.ready", artifactCount: 4, at },
      { type: "run.completed", runId: "vr_demo", outcome: "verified", at },
    ];

    const state = events.reduce(reduceMigrationEvent, initialMigrationState);

    expect(state).toMatchObject({
      phase: "verified",
      runId: "vr_demo",
      baselineBroken: true,
      diff: "+ stripe.charges.list",
      artifactCount: 4,
      verification: { verified: true, integrity: "unchanged" },
    });
    expect(state.impacts).toHaveLength(1);
    expect(state.agentMessages).toEqual(["Updated the charge lookup."]);
  });
});
