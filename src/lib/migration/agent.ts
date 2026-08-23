import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Impact } from "./types";

export type AgentResult = {
  messages: string[];
};

export type AgentProgress = (message: string) => void;

export interface MigrationAgent {
  readonly name: "OpenAI Codex" | "Verified replay";
  migrate(root: string, impacts: Impact[], onProgress: AgentProgress, signal?: AbortSignal): Promise<AgentResult>;
}

function migrationPrompt(impacts: Impact[]) {
  return `You are repairing a Stripe API migration in a small customer repository.

The target API no longer includes PaymentIntent.charges, even when requested through expand. The Stripe client exposes charges.list({ payment_intent, limit }). Preserve the customer-visible behavior: after a successful payment, receiptForPayment must return the first charge's receipt_url.

Impacted callsites:
${impacts.map((impact) => `- ${impact.file}:${impact.line} - ${impact.evidence}`).join("\n")}

Rules:
1. Modify only src/receipt.mjs. Every other changed path will reject the migration.
2. Never modify package.json, anything under locked/, or the provider simulator. The verifier command and locked hash live outside your control.
3. Keep the patch as small as possible.
4. Run npm test and stop only when it passes.
5. Do not commit changes.

Perform the migration now.`;
}

function agentMessage(line: string): string | null {
  try {
    const event = JSON.parse(line) as {
      type?: string;
      item?: { type?: string; text?: string; command?: string };
    };
    if (event.type !== "item.completed" || !event.item) return null;
    if (event.item.type === "agent_message" && event.item.text) return event.item.text;
    if (event.item.type === "command_execution" && event.item.command) {
      return `Ran ${event.item.command.replace(/\s+/g, " ").slice(0, 120)}`;
    }
  } catch {
    return null;
  }
  return null;
}

export class CodexMigrationAgent implements MigrationAgent {
  readonly name = "OpenAI Codex" as const;

  async migrate(root: string, impacts: Impact[], onProgress: AgentProgress, signal?: AbortSignal): Promise<AgentResult> {
    const prompt = migrationPrompt(impacts);
    const messages: string[] = [];
    onProgress("Codex received the contract change and affected callsite.");

    await new Promise<void>((resolve, reject) => {
      const envKeys = ["PATH", "HOME", "CODEX_HOME", "TMPDIR", "LANG", "LC_ALL", "OPENAI_API_KEY", "OPENAI_BASE_URL"];
      const env = Object.fromEntries(
        envKeys.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : [])),
      ) as NodeJS.ProcessEnv;
      env.NO_COLOR = "1";
      const child = spawn(
        "codex",
        ["exec", "--json", "--sandbox", "workspace-write", "--skip-git-repo-check", "-C", root, prompt],
        { cwd: root, env, stdio: ["ignore", "pipe", "pipe"], detached: process.platform !== "win32" },
      );
      let settled = false;
      let stdoutBuffer = "";
      let stderr = "";

      const terminate = () => {
        if (child.pid && process.platform !== "win32") {
          try {
            process.kill(-child.pid, "SIGTERM");
            return;
          } catch {
            // Fall through to terminating the direct child.
          }
        }
        child.kill("SIGTERM");
      };
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal?.removeEventListener("abort", onAbort);
        if (error) reject(error);
        else resolve();
      };
      const onAbort = () => {
        terminate();
        finish(new DOMException("Migration canceled by the client.", "AbortError"));
      };
      const timeout = setTimeout(() => {
        terminate();
        finish(new Error("Codex exceeded the 120 second migration limit."));
      }, 120_000);
      signal?.addEventListener("abort", onAbort, { once: true });
      if (signal?.aborted) onAbort();

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          const message = agentMessage(line);
          if (message) {
            messages.push(message);
            onProgress(message);
          }
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });
      child.on("error", (error) => {
        finish(error);
      });
      child.on("close", (code) => {
        if (code === 0) finish();
        else finish(new Error(stderr.trim() || `Codex exited with status ${code ?? "unknown"}.`));
      });
    });

    return { messages };
  }
}

export class ReplayMigrationAgent implements MigrationAgent {
  readonly name = "Verified replay" as const;

  async migrate(root: string, _impacts: Impact[], onProgress: AgentProgress, signal?: AbortSignal): Promise<AgentResult> {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, 1_100);
      signal?.addEventListener("abort", () => {
        clearTimeout(timeout);
        reject(new DOMException("Migration canceled by the client.", "AbortError"));
      }, { once: true });
    });
    const receiptPath = path.join(root, "src", "receipt.mjs");
    const source = await readFile(receiptPath, "utf8");
    const migrated = `export async function receiptForPayment(stripe, paymentIntentId) {
  const charges = await stripe.charges.list({
    payment_intent: paymentIntentId,
    limit: 1,
  });

  return charges.data[0]?.receipt_url ?? null;
}
`;
    if (!source.includes("paymentIntent.charges")) {
      throw new Error("Replay refused: the expected outdated Stripe callsite was not present.");
    }
    await writeFile(receiptPath, migrated);
    const message = "Replayed the last Codex-authored migration for a deterministic stage demo.";
    onProgress(message);
    return { messages: [message] };
  }
}
