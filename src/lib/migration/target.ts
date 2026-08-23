import path from "node:path";

import type { Impact, MigrationTargetRequest } from "./types";

export type VerificationCommand = {
  executable: string;
  args: string[];
};

export type MigrationTarget = {
  id: string;
  name: string;
  repositoryLabel: string;
  sourceRoot: string;
  fromVersion: string;
  toVersion: string;
  task: string;
  agentContext?: string;
  allowedFiles: string[];
  lockedPaths: string[];
  verificationCommand: VerificationCommand;
  fixture?: { source: string; destination: string };
  supportPaths: string[];
  impacts: Impact[];
  proofClaims: string[];
};

export function warrantTarget(): MigrationTarget {
  const sourceRoot = path.resolve(
    /* turbopackIgnore: true */ process.env.VERSIONLESS_TARGET_REPO ?? "/Users/tarang/warrant",
  );
  return {
    id: "warrant",
    name: "Warrant timestamp hardening",
    repositoryLabel: "taranggoyal70 / warrant",
    sourceRoot,
    fromVersion: "Warrant 0.0.1",
    toVersion: "Strict audit timestamps",
    task: [
      "Harden issueWarrant so approvedAt only accepts a canonical UTC ISO-8601 instant.",
      "Reject invalid dates, offsets, and non-canonical timestamps while preserving every existing valid call.",
    ].join(" "),
    allowedFiles: ["src/gate.ts"],
    lockedPaths: [
      "test",
      "src/protocol",
      "package.json",
      "pnpm-lock.yaml",
      "tsconfig.json",
      "tsconfig.build.json",
    ],
    verificationCommand: { executable: "./node_modules/.bin/vitest", args: ["run"] },
    fixture: {
      source: path.join(process.cwd(), "demo", "warrant-contract", "approved-at.test.ts"),
      destination: "test/versionless-approved-at.test.ts",
    },
    supportPaths: ["src/protocol"],
    impacts: [
      {
        file: "src/gate.ts",
        line: 96,
        column: 3,
        kind: "unvalidated-input",
        symbol: "issueWarrant.approvedAt",
        evidence: "approvedAt is stored in the audit record without validating its canonical timestamp format.",
        guidance: "Fail closed unless approvedAt is a canonical UTC ISO-8601 instant.",
      },
    ],
    proofClaims: [
      "All original Warrant tests still pass",
      "Invalid audit timestamps are refused",
      "Only src/gate.ts changed",
    ],
  };
}

export function localTarget(request: Extract<MigrationTargetRequest, { type: "local" }>): MigrationTarget {
  const sourceRoot = path.resolve(/* turbopackIgnore: true */ request.repositoryPath);
  const repositoryLabel = path.basename(sourceRoot);
  return {
    id: `local:${repositoryLabel}`,
    name: `Requested change in ${repositoryLabel}`,
    repositoryLabel,
    sourceRoot,
    fromVersion: "Current failing contract",
    toVersion: "Requested behavior",
    task: request.task,
    allowedFiles: request.allowedFiles,
    lockedPaths: request.lockedPaths,
    verificationCommand: request.verificationCommand,
    supportPaths: [],
    impacts: request.allowedFiles.map((file) => ({
      file,
      line: 1,
      column: 1,
      kind: "requested-change",
      symbol: file,
      evidence: "User selected this file as the implementation boundary.",
      guidance: request.task,
    })),
    proofClaims: [
      "The selected verification command passes",
      "Every locked path remains byte-identical",
      `Only ${request.allowedFiles.join(", ")} changed`,
    ],
  };
}
