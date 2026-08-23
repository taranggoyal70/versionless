import { execFile } from "node:child_process";
import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import { analyzeRepository } from "./analyze";
import type { MigrationAgent } from "./agent";
import type { MigrationEvent } from "./types";
import { hashLockedContract, verifyLockedContract } from "./verify";

const execFileAsync = promisify(execFile);

export type MigrationRunOptions = {
  agent: MigrationAgent;
  onEvent: (event: MigrationEvent) => void;
  signal?: AbortSignal;
};

const ALLOWED_IMPLEMENTATION_FILES = new Set(["src/receipt.mjs"]);

function timestamp() {
  return new Date().toISOString();
}

async function createWorkspace(runId: string) {
  const base = path.join(process.cwd(), "demo-workspaces");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, `${runId}-`));
  await cp(path.join(process.cwd(), "demo", "customer-repo"), root, { recursive: true });
  await execFileAsync("git", ["init", "-q"], { cwd: root });
  await execFileAsync("git", ["add", "."], { cwd: root });
  await execFileAsync(
    "git",
    ["-c", "user.name=Versionless", "-c", "user.email=demo@versionless.local", "commit", "-qm", "baseline"],
    { cwd: root },
  );
  return root;
}

async function patchEvidence(root: string) {
  const { stdout: status } = await execFileAsync(
    "git",
    ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--ignored=matching"],
    { cwd: root },
  );
  const changedFiles = changedPathsFromStatus(status);
  const outOfScope = changedFiles.filter((file) => !ALLOWED_IMPLEMENTATION_FILES.has(file));
  if (outOfScope.length > 0) {
    throw new Error(`Migration rejected: Codex changed protected path ${outOfScope.join(", ")}.`);
  }
  const implementationFiles = changedFiles.filter((file) => ALLOWED_IMPLEMENTATION_FILES.has(file));
  const { stdout: diff } = await execFileAsync(
    "git",
    ["diff", "--no-ext-diff", "--unified=3", "HEAD", "--", ...implementationFiles],
    { cwd: root },
  );
  const filesChanged = implementationFiles.length;
  if (!diff.trim() || filesChanged === 0) throw new Error("The migration agent produced no implementation patch.");
  return { diff: diff.trim(), filesChanged };
}

function changedPathsFromStatus(status: string) {
  const changed = new Set<string>();
  const records = status.split("\0").filter(Boolean);
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const code = record.slice(0, 2);
    const file = record.slice(3);
    if (file) changed.add(file);
    if (code.includes("R") || code.includes("C")) {
      const original = records[index + 1];
      if (original) changed.add(original);
      index += 1;
    }
  }
  return [...changed].sort();
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Migration canceled by the client.", "AbortError");
}

export async function runMigration({ agent, onEvent, signal }: MigrationRunOptions) {
  const runId = `vr_${crypto.randomUUID().slice(0, 8)}`;
  let root: string | null = null;
  onEvent({ type: "run.started", runId, at: timestamp() });

  try {
    throwIfAborted(signal);
    root = await createWorkspace(runId);
    onEvent({ type: "contract.loaded", from: "2022-08-01", to: "2022-11-15", at: timestamp() });

    const impacts = await analyzeRepository(root);
    if (impacts.length === 0) throw new Error("No Stripe contract impacts were detected.");
    impacts.forEach((impact) => onEvent({ type: "impact.found", impact, at: timestamp() }));

    const lockedHash = await hashLockedContract(root);
    onEvent({ type: "integrity.locked", hash: lockedHash, at: timestamp() });
    const baseline = await verifyLockedContract(root, lockedHash);
    if (baseline.verified) throw new Error("The baseline unexpectedly passed; there is no migration to prove.");
    if (!baseline.testSummary.includes("Target Stripe contract forbids retrieving embedded charges")) {
      throw new Error("Baseline rejected: it did not reproduce the expected Stripe contract break.");
    }
    onEvent({ type: "baseline.failed", summary: baseline.testSummary, at: timestamp() });

    throwIfAborted(signal);
    onEvent({ type: "agent.started", agent: agent.name, at: timestamp() });
    await agent.migrate(
      root,
      impacts,
      (message) => onEvent({ type: "agent.message", message, at: timestamp() }),
      signal,
    );

    throwIfAborted(signal);
    const patch = await patchEvidence(root);
    onEvent({ type: "patch.ready", ...patch, at: timestamp() });
    onEvent({ type: "verification.started", at: timestamp() });
    const verification = await verifyLockedContract(root, lockedHash);
    onEvent({ type: "verification.completed", result: verification, at: timestamp() });
    onEvent({ type: "evidence.ready", artifactCount: 4, at: timestamp() });

    const outcome = verification.verified ? "verified" : "rejected";
    onEvent({ type: "run.completed", runId, outcome, at: timestamp() });
    return { runId, outcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown migration failure";
    onEvent({ type: "run.failed", runId, error: message, at: timestamp() });
    throw error;
  } finally {
    if (root) await rm(root, { recursive: true, force: true });
  }
}
