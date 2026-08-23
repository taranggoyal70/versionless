import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { MigrationTarget } from "./target";
import type { SponsorEvidence, VerificationResult } from "./types";

const execFileAsync = promisify(execFile);
const CLAUDE_MEM_TIMEOUT_MS = 5_000;
const GREPTILE_TIMEOUT_MS = 240_000;

type SponsorContext = {
  evidence: SponsorEvidence;
  context?: string;
};

function claudeMemBaseUrl() {
  const configuredPort = Number(process.env.CLAUDE_MEM_WORKER_PORT);
  const uid = typeof process.getuid === "function" ? process.getuid() : 0;
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 37_700 + (uid % 100);
  return `http://127.0.0.1:${port}`;
}

async function readJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text.slice(0, 500) };
  }
}

function memoryText(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const content = "content" in payload ? payload.content : undefined;
  if (!Array.isArray(content)) return JSON.stringify(payload);
  return content
    .filter((item): item is { type: string; text: string } => Boolean(item && typeof item === "object" && "text" in item && typeof item.text === "string"))
    .map((item) => item.text)
    .join("\n");
}

export async function recallClaudeMemory(target: MigrationTarget): Promise<SponsorContext> {
  try {
    const health = await fetch(`${claudeMemBaseUrl()}/api/health`, {
      signal: AbortSignal.timeout(CLAUDE_MEM_TIMEOUT_MS),
    });
    if (!health.ok) throw new Error(`worker health returned ${health.status}`);

    const query = new URLSearchParams({
      query: `${target.repositoryLabel} ${target.task}`,
      type: "observations",
      format: "index",
      limit: "5",
    });
    const response = await fetch(`${claudeMemBaseUrl()}/api/search?${query}`, {
      signal: AbortSignal.timeout(CLAUDE_MEM_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`memory search returned ${response.status}`);
    const text = memoryText(await readJson(response));
    const itemCount = Number(text.match(/Found\s+(\d+)\s+result/i)?.[1] ?? 0);
    return {
      evidence: {
        provider: "Claude-Mem",
        stage: "recall",
        status: "connected",
        summary: itemCount > 0 ? `Recalled ${itemCount} prior observations before Codex started.` : "Memory searched successfully. No matching history yet.",
        itemCount,
      },
      context: itemCount > 0 ? text.slice(0, 1_500) : undefined,
    };
  } catch (error) {
    return {
      evidence: {
        provider: "Claude-Mem",
        stage: "recall",
        status: "unavailable",
        summary: error instanceof Error ? `Memory worker unavailable: ${error.message}` : "Memory worker unavailable.",
      },
    };
  }
}

function findGreptileItems(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") return [];
  for (const key of ["findings", "issues", "comments", "results"]) {
    const value = key in payload ? payload[key as keyof typeof payload] : undefined;
    if (Array.isArray(value)) return value;
  }
  return [];
}

function greptileEvidence(stdout: string): SponsorContext | null {
  try {
    const payload = JSON.parse(stdout) as unknown;
    const findings = findGreptileItems(payload);
    return {
      evidence: {
        provider: "Greptile",
        stage: "review",
        status: "connected",
        summary: findings.length > 0
          ? `Greptile independently reviewed the proof branch and returned ${findings.length} finding${findings.length === 1 ? "" : "s"}.`
          : "Greptile independently reviewed the proof branch and found no blocking issues.",
        itemCount: findings.length,
      },
      context: stdout.slice(0, 2_000),
    };
  } catch {
    return null;
  }
}

export async function reviewWithGreptile(
  root: string,
  target: MigrationTarget,
  runId: string,
): Promise<SponsorContext> {
  const apiKey = process.env.GREPTILE_API_KEY;
  if (!apiKey) {
    return {
      evidence: {
        provider: "Greptile",
        stage: "review",
        status: "missing-key",
        summary: "Set GREPTILE_API_KEY to run the real repository risk review.",
      },
    };
  }
  try {
    const { stdout: sourceRemote } = await execFileAsync("git", ["remote", "get-url", "origin"], {
      cwd: target.sourceRoot,
      timeout: 5_000,
    });
    const remoteUrl = sourceRemote.trim();
    if (!/^(?:https:\/\/|git@)(?:github\.com|gitlab\.com)[/:]/i.test(remoteUrl)) {
      throw new Error("the selected repository needs a GitHub or GitLab origin remote");
    }
    await execFileAsync("git", ["remote", "set-url", "origin", remoteUrl], { cwd: root, timeout: 5_000 });
    await execFileAsync("git", ["checkout", "-qb", `versionless-proof-${runId}`], { cwd: root, timeout: 5_000 });
    await execFileAsync("git", ["add", "--", ...target.allowedFiles], { cwd: root, timeout: 5_000 });
    await execFileAsync(
      "git",
      [
        "-c", "core.hooksPath=/dev/null",
        "-c", "user.name=Versionless",
        "-c", "user.email=proof@versionless.local",
        "commit", "-qm", `Versionless verified patch ${runId}`,
      ],
      { cwd: root, timeout: 10_000 },
    );
    const { stdout } = await execFileAsync("greptile", ["review", "--json"], {
      cwd: root,
      env: { ...process.env, GREPTILE_API_KEY: apiKey, NO_COLOR: "1" },
      timeout: GREPTILE_TIMEOUT_MS,
      maxBuffer: 5 * 1024 * 1024,
    });
    return greptileEvidence(stdout) ?? {
      evidence: {
        provider: "Greptile",
        stage: "review",
        status: "connected",
        summary: "Greptile independently reviewed the proof branch.",
      },
      context: stdout.slice(0, 2_000),
    };
  } catch (error) {
    const commandError = error as Error & { stdout?: string; stderr?: string };
    const parsed = commandError.stdout ? greptileEvidence(commandError.stdout) : null;
    if (parsed) return parsed;
    return {
      evidence: {
        provider: "Greptile",
        stage: "review",
        status: "unavailable",
        summary: `Greptile CLI review failed: ${(commandError.stderr || commandError.message || "unknown error").trim().slice(0, 240)}`,
      },
    };
  }
}

export async function recordClaudeMemory(
  runId: string,
  target: MigrationTarget,
  verification: VerificationResult,
): Promise<SponsorEvidence> {
  try {
    const response = await fetch(`${claudeMemBaseUrl()}/api/sessions/observations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentSessionId: `versionless-${runId}`,
        tool_name: "VersionlessVerification",
        tool_input: {
          repository: target.repositoryLabel,
          task: target.task,
          allowedFiles: target.allowedFiles,
        },
        tool_response: {
          outcome: verification.verified ? "verified" : "rejected",
          testSummary: verification.testSummary,
          integrity: verification.integrity,
          expectedHash: verification.expectedHash,
          actualHash: verification.actualHash,
        },
        cwd: target.sourceRoot,
      }),
      signal: AbortSignal.timeout(CLAUDE_MEM_TIMEOUT_MS),
    });
    const payload = await readJson(response) as { status?: string; reason?: string };
    if (!response.ok) throw new Error(`observation returned ${response.status}`);
    return {
      provider: "Claude-Mem",
      stage: "record",
      status: payload.status === "queued" ? "connected" : "unavailable",
      summary: payload.status === "queued" ? "Verification outcome queued as persistent agent memory." : `Memory record ${payload.status ?? "failed"}: ${payload.reason ?? "unknown reason"}`,
      itemCount: payload.status === "queued" ? 1 : 0,
    };
  } catch (error) {
    return {
      provider: "Claude-Mem",
      stage: "record",
      status: "unavailable",
      summary: error instanceof Error ? `Could not record memory: ${error.message}` : "Could not record memory.",
    };
  }
}

export function sponsorPromptContext(contexts: SponsorContext[]) {
  const useful = contexts.flatMap((entry) => entry.context ? [`${entry.evidence.provider}:\n${entry.context}`] : []);
  return useful.length > 0 ? useful.join("\n\n") : null;
}
