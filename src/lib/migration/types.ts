export type Impact = {
  file: string;
  line: number;
  column: number;
  kind: "removed-field" | "unvalidated-input";
  symbol: string;
  evidence: string;
  guidance: string;
};

export type IntegrityState = "unchanged" | "changed";

export type VerificationResult = {
  verified: boolean;
  integrity: IntegrityState;
  expectedHash: string;
  actualHash: string;
  exitCode: number | null;
  testSummary: string;
  durationMs: number;
};

export type MigrationEvent =
  | { type: "run.started"; runId: string; at: string }
  | {
      type: "contract.loaded";
      from: string;
      to: string;
      targetName?: string;
      repositoryLabel?: string;
      task?: string;
      allowedFiles?: string[];
      proofClaims?: string[];
      at: string;
    }
  | { type: "impact.found"; impact: Impact; at: string }
  | { type: "integrity.locked"; hash: string; at: string }
  | { type: "baseline.failed"; summary: string; at: string }
  | { type: "agent.started"; agent: "OpenAI Codex" | "Verified replay"; at: string }
  | { type: "agent.message"; message: string; at: string }
  | { type: "patch.ready"; diff: string; filesChanged: number; at: string }
  | { type: "verification.started"; at: string }
  | { type: "verification.completed"; result: VerificationResult; at: string }
  | { type: "evidence.ready"; artifactCount: number; at: string }
  | { type: "run.completed"; runId: string; outcome: "verified" | "rejected"; at: string }
  | { type: "run.failed"; runId: string; error: string; at: string };
