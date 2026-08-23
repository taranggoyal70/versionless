import { execFile } from "node:child_process";
import { access, cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { analyzeRepository } from "./analyze";
import type { MigrationAgent } from "./agent";
import type { MigrationTarget } from "./target";
import type { MigrationEvent } from "./types";
import { recallClaudeMemory, recordClaudeMemory, reviewWithGreptile, sponsorPromptContext } from "./sponsors";
import { hashLockedContract, verifyLockedContract, type VerificationOptions } from "./verify";

const execFileAsync = promisify(execFile);

export type MigrationRunOptions = {
  agent: MigrationAgent;
  onEvent: (event: MigrationEvent) => void;
  signal?: AbortSignal;
  target?: MigrationTarget;
};

const ALLOWED_IMPLEMENTATION_FILES = new Set(["src/receipt.mjs"]);
const PROOF_GIT_ARGS = [
  "-c",
  "core.fsmonitor=false",
  "-c",
  "core.untrackedCache=false",
  "-c",
  "core.hooksPath=/dev/null",
];

function timestamp() {
  return new Date().toISOString();
}

async function createWorkspace(runId: string, target?: MigrationTarget) {
  const base = target
    ? path.join(tmpdir(), "versionless-target-workspaces")
    : path.join(process.cwd(), "demo-workspaces");
  await mkdir(base, { recursive: true });
  const root = await mkdtemp(path.join(base, `${runId}-`));
  if (target) {
    await execFileAsync("git", ["clone", "--local", "--no-hardlinks", "-q", target.sourceRoot, root]);
    const baselineAdditions: string[] = [];
    if (target.fixture) {
      const fixtureDestination = path.join(root, target.fixture.destination);
      await mkdir(path.dirname(fixtureDestination), { recursive: true });
      await cp(target.fixture.source, fixtureDestination);
      baselineAdditions.push(target.fixture.destination);
    }
    for (const supportPath of target.supportPaths) {
      await cp(path.join(target.sourceRoot, supportPath), path.join(root, supportPath), {
        recursive: true,
        verbatimSymlinks: true,
      });
      baselineAdditions.push(supportPath);
    }
    const sourceModules = path.join(target.sourceRoot, "node_modules");
    if (await pathExists(sourceModules)) {
      await cp(sourceModules, path.join(root, "node_modules"), {
        recursive: true,
        verbatimSymlinks: true,
      });
    }
    if (baselineAdditions.length > 0) {
      await execFileAsync("git", ["add", "-f", ...baselineAdditions], { cwd: root });
      await execFileAsync(
        "git",
        ["-c", "user.name=Versionless", "-c", "user.email=demo@versionless.local", "commit", "-qm", "baseline"],
        { cwd: root },
      );
    }
  } else {
    await cp(path.join(process.cwd(), "demo", "customer-repo"), root, { recursive: true });
    await execFileAsync("git", ["init", "-q"], { cwd: root });
    await execFileAsync("git", ["add", "."], { cwd: root });
    await execFileAsync(
      "git",
      ["-c", "user.name=Versionless", "-c", "user.email=demo@versionless.local", "commit", "-qm", "baseline"],
      { cwd: root },
    );
  }
  const { stdout: baselineCommit } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: root });
  return { root, baselineCommit: baselineCommit.trim() };
}

async function pathExists(absolute: string) {
  try {
    await access(absolute);
    return true;
  } catch {
    return false;
  }
}

async function patchEvidence(root: string, baselineCommit: string, allowedFiles = ALLOWED_IMPLEMENTATION_FILES) {
  const { stdout: baselineChanges } = await proofGit(root, ["diff", "--name-only", "-z", baselineCommit, "--"]);
  const { stdout: status } = await proofGit(root, [
    "status",
    "--porcelain=v1",
    "-z",
    "--untracked-files=all",
    "--ignored=matching",
  ]);
  const changedFiles = [...new Set([...pathsFromNullList(baselineChanges), ...changedPathsFromStatus(status)])]
    .filter((file) => file.replace(/\/$/, "") !== "node_modules")
    .sort();
  const outOfScope = changedFiles.filter((file) => !allowedFiles.has(file));
  if (outOfScope.length > 0) {
    throw new Error(`Migration rejected: Codex changed protected path ${outOfScope.join(", ")}.`);
  }
  const { stdout: stagedChanges } = await proofGit(root, ["diff", "--cached", "--name-only", "-z", "--"]);
  const stagedFiles = pathsFromNullList(stagedChanges);
  if (stagedFiles.length > 0) {
    throw new Error(`Migration rejected: Codex staged migration changes ${stagedFiles.join(", ")}.`);
  }
  const { stdout: currentHead } = await proofGit(root, ["rev-parse", "HEAD"]);
  if (currentHead.trim() !== baselineCommit) {
    throw new Error("Migration rejected: Codex changed repository history.");
  }
  const implementationFiles = changedFiles.filter((file) => allowedFiles.has(file));
  const { stdout: diff } = await proofGit(root, [
    "diff",
    "--no-ext-diff",
    "--unified=3",
    baselineCommit,
    "--",
    ...implementationFiles,
  ]);
  const filesChanged = implementationFiles.length;
  if (!diff.trim() || filesChanged === 0) throw new Error("The migration agent produced no implementation patch.");
  return { diff: diff.trim(), filesChanged };
}

function proofGit(root: string, args: string[]) {
  return execFileAsync("git", [...PROOF_GIT_ARGS, ...args], {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_OPTIONAL_LOCKS: "0" },
  });
}

async function createVerificationWorkspace(runId: string, diff: string, target?: MigrationTarget) {
  const workspace = await createWorkspace(`${runId}-proof`, target);
  const patchPath = path.join(workspace.root, "migration.patch");
  try {
    await writeFile(patchPath, `${diff}\n`);
    await proofGit(workspace.root, ["apply", "--whitespace=nowarn", patchPath]);
  } finally {
    await rm(patchPath, { force: true });
  }
  return workspace.root;
}

function pathsFromNullList(paths: string) {
  return paths.split("\0").filter(Boolean);
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

export async function runMigration({ agent, onEvent, signal, target }: MigrationRunOptions) {
  const runId = `vr_${crypto.randomUUID().slice(0, 8)}`;
  let root: string | null = null;
  let verificationRoot: string | null = null;
  onEvent({ type: "run.started", runId, at: timestamp() });

  try {
    throwIfAborted(signal);
    const workspace = await createWorkspace(runId, target);
    root = workspace.root;
    onEvent({
      type: "contract.loaded",
      from: target?.fromVersion ?? "2022-08-01",
      to: target?.toVersion ?? "2022-11-15",
      targetName: target?.name,
      repositoryLabel: target?.repositoryLabel,
      task: target?.task,
      allowedFiles: target?.allowedFiles,
      lockedPaths: target?.lockedPaths,
      proofClaims: target?.proofClaims,
      at: timestamp(),
    });

    const impacts = target?.impacts ?? await analyzeRepository(root);
    if (impacts.length === 0) throw new Error("No contract impacts were detected.");
    impacts.forEach((impact) => onEvent({ type: "impact.found", impact, at: timestamp() }));

    let agentTarget = target;
    let connectedSponsorEvidence = 0;
    if (target) {
      const sponsorContexts = [await recallClaudeMemory(target)];
      for (const sponsorContext of sponsorContexts) {
        if (sponsorContext.evidence.status === "connected") connectedSponsorEvidence += 1;
        onEvent({ type: "sponsor.evidence", evidence: sponsorContext.evidence, at: timestamp() });
      }
      const agentContext = sponsorPromptContext(sponsorContexts);
      if (agentContext) agentTarget = { ...target, agentContext };
    }

    const verificationOptions: VerificationOptions | undefined = target
      ? { lockedPaths: target.lockedPaths, command: target.verificationCommand }
      : undefined;
    const lockedHash = await hashLockedContract(root, verificationOptions?.lockedPaths);
    onEvent({ type: "integrity.locked", hash: lockedHash, at: timestamp() });
    const baseline = await verifyLockedContract(root, lockedHash, verificationOptions);
    if (baseline.verified) throw new Error("The baseline unexpectedly passed; there is no migration to prove.");
    if (!target && !baseline.testSummary.includes("Target Stripe contract forbids retrieving embedded charges")) {
      throw new Error("Baseline rejected: it did not reproduce the expected contract break.");
    }
    onEvent({ type: "baseline.failed", summary: baseline.testSummary, at: timestamp() });

    throwIfAborted(signal);
    onEvent({ type: "agent.started", agent: agent.name, at: timestamp() });
    await agent.migrate(
      root,
      impacts,
      (message) => onEvent({ type: "agent.message", message, at: timestamp() }),
      signal,
      agentTarget,
    );

    throwIfAborted(signal);
    const allowedFiles = target ? new Set(target.allowedFiles) : ALLOWED_IMPLEMENTATION_FILES;
    const patch = await patchEvidence(root, workspace.baselineCommit, allowedFiles);
    verificationRoot = await createVerificationWorkspace(runId, patch.diff, target);
    onEvent({ type: "patch.ready", ...patch, at: timestamp() });
    onEvent({ type: "verification.started", at: timestamp() });
    const verification = await verifyLockedContract(verificationRoot, lockedHash, verificationOptions);
    onEvent({ type: "verification.completed", result: verification, at: timestamp() });
    if (target) {
      const greptileEvidence = await reviewWithGreptile(verificationRoot, target, runId);
      if (greptileEvidence.evidence.status === "connected") connectedSponsorEvidence += 1;
      onEvent({ type: "sponsor.evidence", evidence: greptileEvidence.evidence, at: timestamp() });
      const memoryEvidence = await recordClaudeMemory(runId, target, verification);
      if (memoryEvidence.status === "connected") connectedSponsorEvidence += 1;
      onEvent({ type: "sponsor.evidence", evidence: memoryEvidence, at: timestamp() });
    }
    onEvent({ type: "evidence.ready", artifactCount: 4 + connectedSponsorEvidence, at: timestamp() });

    const outcome = verification.verified ? "verified" : "rejected";
    onEvent({ type: "run.completed", runId, outcome, at: timestamp() });
    return { runId, outcome };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown migration failure";
    onEvent({ type: "run.failed", runId, error: message, at: timestamp() });
    throw error;
  } finally {
    if (verificationRoot) await rm(verificationRoot, { recursive: true, force: true });
    if (root) await rm(root, { recursive: true, force: true });
  }
}
