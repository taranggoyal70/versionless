import type { Impact, MigrationEvent, VerificationResult } from "./types";

export type MigrationPhase =
  | "idle"
  | "analyzing"
  | "broken"
  | "migrating"
  | "verifying"
  | "verified"
  | "rejected"
  | "failed";

export type MigrationState = {
  phase: MigrationPhase;
  runId: string | null;
  fromVersion: string;
  toVersion: string;
  targetName: string;
  repositoryLabel: string;
  task: string;
  allowedFiles: string[];
  proofClaims: string[];
  impacts: Impact[];
  lockedHash: string | null;
  baselineBroken: boolean;
  agentName: string | null;
  agentMessages: string[];
  diff: string | null;
  filesChanged: number;
  verification: VerificationResult | null;
  artifactCount: number;
  error: string | null;
  events: MigrationEvent[];
};

export const initialMigrationState: MigrationState = {
  phase: "idle",
  runId: null,
  fromVersion: "Warrant 0.0.1",
  toVersion: "Strict audit timestamps",
  targetName: "Warrant timestamp hardening",
  repositoryLabel: "taranggoyal70 / warrant",
  task: "Validate every approval timestamp before it becomes part of an audit record.",
  allowedFiles: ["src/gate.ts"],
  proofClaims: [
    "All original Warrant tests still pass",
    "Invalid audit timestamps are refused",
    "Only src/gate.ts changed",
  ],
  impacts: [],
  lockedHash: null,
  baselineBroken: false,
  agentName: null,
  agentMessages: [],
  diff: null,
  filesChanged: 0,
  verification: null,
  artifactCount: 0,
  error: null,
  events: [],
};

export function reduceMigrationEvent(state: MigrationState, event: MigrationEvent): MigrationState {
  const next = { ...state, events: [...state.events, event] };
  switch (event.type) {
    case "run.started":
      return { ...initialMigrationState, phase: "analyzing", runId: event.runId, events: [event] };
    case "contract.loaded":
      return {
        ...next,
        fromVersion: event.from,
        toVersion: event.to,
        targetName: event.targetName ?? state.targetName,
        repositoryLabel: event.repositoryLabel ?? state.repositoryLabel,
        task: event.task ?? state.task,
        allowedFiles: event.allowedFiles ?? state.allowedFiles,
        proofClaims: event.proofClaims ?? state.proofClaims,
      };
    case "impact.found":
      return { ...next, impacts: [...state.impacts, event.impact] };
    case "integrity.locked":
      return { ...next, lockedHash: event.hash };
    case "baseline.failed":
      return { ...next, phase: "broken", baselineBroken: true };
    case "agent.started":
      return { ...next, phase: "migrating", agentName: event.agent };
    case "agent.message":
      return { ...next, agentMessages: [...state.agentMessages, event.message] };
    case "patch.ready":
      return { ...next, diff: event.diff, filesChanged: event.filesChanged };
    case "verification.started":
      return { ...next, phase: "verifying" };
    case "verification.completed":
      return { ...next, verification: event.result };
    case "evidence.ready":
      return { ...next, artifactCount: event.artifactCount };
    case "run.completed":
      return { ...next, phase: event.outcome };
    case "run.failed":
      return { ...next, phase: "failed", error: event.error };
  }
}
