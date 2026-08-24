import type { MigrationEvent } from "./types";

const PROOF_HASH = "sha256:a2c372886d501b33b609d92ab543f5b261fd36110136415ace324e4648aa202e";
const PATCH = `diff --git a/src/gate.ts b/src/gate.ts
--- a/src/gate.ts
+++ b/src/gate.ts
@@ -96,6 +96,10 @@ export function issueWarrant(input: {
   const { artifact, approver, policy, approvedAt } = input;
   if (!approver.trim()) throw new Error("A warrant requires a verified approver identity");
   if (!policy.trim()) throw new Error("A warrant must record which policy required a human");
+  const parsedApprovedAt = new Date(approvedAt);
+  if (Number.isNaN(parsedApprovedAt.getTime()) || parsedApprovedAt.toISOString() !== approvedAt) {
+    throw new Error("A warrant requires approvedAt to be a canonical UTC ISO-8601 instant");
+  }
+
   return {`;

function at() {
  return new Date().toISOString();
}

function wait(milliseconds: number, signal?: AbortSignal) {
  if (milliseconds === 0) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(resolve, milliseconds);
    signal?.addEventListener("abort", () => {
      clearTimeout(timeout);
      reject(new DOMException("Hosted replay canceled by the client.", "AbortError"));
    }, { once: true });
  });
}

export async function runHostedWarrantReplay(
  emit: (event: MigrationEvent) => void,
  signal?: AbortSignal,
  delayMs = 140,
) {
  const runId = `vr_replay_${crypto.randomUUID().slice(0, 6)}`;
  const events: MigrationEvent[] = [
    { type: "run.started", runId, at: at() },
    {
      type: "contract.loaded",
      from: "Warrant 0.0.1",
      to: "Strict audit timestamps",
      targetName: "Warrant timestamp hardening",
      repositoryLabel: "taranggoyal70 / warrant",
      task: "Require approvedAt to be a canonical UTC ISO-8601 instant.",
      allowedFiles: ["src/gate.ts"],
      lockedPaths: ["test", "src/protocol", "package.json", "pnpm-lock.yaml", "tsconfig.json", "tsconfig.build.json"],
      proofClaims: ["All original Warrant tests still pass", "Invalid audit timestamps are refused", "Only src/gate.ts changed"],
      at: at(),
    },
    {
      type: "impact.found",
      impact: {
        file: "src/gate.ts",
        line: 96,
        column: 3,
        kind: "unvalidated-input",
        symbol: "issueWarrant.approvedAt",
        evidence: "approvedAt entered the signed audit record without canonical timestamp validation.",
        guidance: "Fail closed unless approvedAt is a canonical UTC ISO-8601 instant.",
      },
      at: at(),
    },
    { type: "integrity.locked", hash: PROOF_HASH, at: at() },
    { type: "baseline.failed", summary: "4 timestamp attack cases failed before the patch.", at: at() },
    {
      type: "sponsor.evidence",
      evidence: {
        provider: "Claude-Mem",
        stage: "recall",
        status: "replayed",
        summary: "Replaying memory captured during the verified local Codex run.",
        itemCount: 3,
      },
      at: at(),
    },
    { type: "agent.started", agent: "Verified replay", at: at() },
    { type: "agent.message", message: "Replayed the Codex-authored Warrant timestamp hardening patch.", at: at() },
    { type: "patch.ready", diff: PATCH, filesChanged: 1, at: at() },
    { type: "verification.started", at: at() },
    {
      type: "verification.completed",
      result: {
        verified: true,
        integrity: "unchanged",
        expectedHash: PROOF_HASH,
        actualHash: PROOF_HASH,
        exitCode: 0,
        testSummary: "Test Files 6 passed (6)\nTests 51 passed (51)",
        durationMs: 1780,
      },
      at: at(),
    },
    { type: "evidence.ready", artifactCount: 5, at: at() },
    { type: "run.completed", runId, outcome: "verified", at: at() },
  ];

  for (const event of events) {
    if (signal?.aborted) throw new DOMException("Hosted replay canceled by the client.", "AbortError");
    emit({ ...event, at: at() });
    await wait(delayMs, signal);
  }
}
