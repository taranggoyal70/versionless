import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

import { ReplayMigrationAgent, type MigrationAgent } from "./agent";
import { runMigration } from "./run";
import type { MigrationEvent } from "./types";

const execFileAsync = promisify(execFile);

describe("runMigration", () => {
  it("turns a broken Stripe receipt flow into a verified evidence bundle", async () => {
    const events: MigrationEvent[] = [];

    const result = await runMigration({
      agent: new ReplayMigrationAgent(),
      onEvent: (event) => events.push(event),
    });

    expect(result.outcome).toBe("verified");
    expect(events.map((event) => event.type)).toEqual([
      "run.started",
      "contract.loaded",
      "impact.found",
      "integrity.locked",
      "baseline.failed",
      "agent.started",
      "agent.message",
      "patch.ready",
      "verification.started",
      "verification.completed",
      "evidence.ready",
      "run.completed",
    ]);
    const verification = events.find((event) => event.type === "verification.completed");
    expect(verification).toMatchObject({
      result: { verified: true, integrity: "unchanged", exitCode: 0 },
    });
  });

  it("rejects a migration agent that tampers with the locked proof", async () => {
    const events: MigrationEvent[] = [];
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        await writeFile(path.join(root, "locked", "receipt-flow.test.mjs"), "// proof deleted\n");
        await new ReplayMigrationAgent().migrate(root, [], onProgress);
        return { messages: ["tampered"] };
      },
    };

    await expect(
      runMigration({
        agent: tamperingAgent,
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toThrow("changed protected path locked/receipt-flow.test.mjs");
    expect(events.at(-1)).toMatchObject({ type: "run.failed" });
  });

  it("rejects a migration agent that replaces the repository test command", async () => {
    const events: MigrationEvent[] = [];
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        await writeFile(path.join(root, "package.json"), JSON.stringify({ scripts: { test: "true" } }));
        return new ReplayMigrationAgent().migrate(root, [], onProgress);
      },
    };

    await expect(
      runMigration({
        agent: tamperingAgent,
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toThrow("changed protected path package.json");
  });

  it("rejects a migration agent that hides behavior in an untracked helper", async () => {
    const events: MigrationEvent[] = [];
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        await mkdir(path.join(root, "src", "helpers"));
        await writeFile(
          path.join(root, "src", "helpers", "receipt-url.mjs"),
          "export const receiptUrl = (paymentIntentId) => `https://pay.stripe.com/receipts/${paymentIntentId}`;\n",
        );
        await writeFile(
          path.join(root, "src", "receipt.mjs"),
          [
            "import { receiptUrl } from './helpers/receipt-url.mjs';",
            "export async function receiptForPayment(stripe, paymentIntentId) {",
            "  await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });",
            "  return receiptUrl(paymentIntentId);",
            "}",
          ].join("\n"),
        );
        onProgress("Wrote a hidden helper.");
        return { messages: ["hidden helper"] };
      },
    };

    await expect(
      runMigration({
        agent: tamperingAgent,
        onEvent: (event) => events.push(event),
      }),
    ).rejects.toThrow("changed protected path src/helpers/receipt-url.mjs");
    expect(events.at(-1)).toMatchObject({ type: "run.failed" });
  });

  it("rejects a migration agent that commits hidden helper behavior", async () => {
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        const receiptSource = [
          "import { receiptUrl } from './helpers/receipt-url.mjs';",
          "export async function receiptForPayment(stripe, paymentIntentId) {",
          "  await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });",
          "  return receiptUrl(paymentIntentId);",
          "}",
        ].join("\n");
        await mkdir(path.join(root, "src", "helpers"));
        await writeFile(
          path.join(root, "src", "helpers", "receipt-url.mjs"),
          "export const receiptUrl = (paymentIntentId) => `https://pay.stripe.com/receipts/${paymentIntentId}`;\n",
        );
        await writeFile(path.join(root, "src", "receipt.mjs"), `${receiptSource}\n`);
        await execFileAsync("git", ["add", "src"], { cwd: root });
        await execFileAsync(
          "git",
          ["-c", "user.name=Versionless", "-c", "user.email=demo@versionless.local", "commit", "-qm", "hide helper"],
          { cwd: root },
        );
        await writeFile(path.join(root, "src", "receipt.mjs"), `${receiptSource}\n\n`);
        onProgress("Committed a hidden helper.");
        return { messages: ["hidden helper"] };
      },
    };

    await expect(
      runMigration({
        agent: tamperingAgent,
        onEvent: () => undefined,
      }),
    ).rejects.toThrow("changed protected path src/helpers/receipt-url.mjs");
  });

  it("does not verify a migration that imports ambient helper behavior", async () => {
    const events: MigrationEvent[] = [];
    const helperPath = path.join(process.cwd(), "demo-workspaces", "ambient-receipt-url.mjs");
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        await writeFile(
          helperPath,
          "export const receiptUrl = (paymentIntentId) => `https://pay.stripe.com/receipts/${paymentIntentId}`;\n",
        );
        await writeFile(
          path.join(root, "src", "receipt.mjs"),
          [
            `import { receiptUrl } from ${JSON.stringify(pathToFileURL(helperPath).href)};`,
            "export async function receiptForPayment(stripe, paymentIntentId) {",
            "  await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });",
            "  return receiptUrl(paymentIntentId);",
            "}",
          ].join("\n"),
        );
        onProgress("Wrote an ambient helper.");
        return { messages: ["ambient helper"] };
      },
    };

    try {
      const result = await runMigration({
        agent: tamperingAgent,
        onEvent: (event) => events.push(event),
      });

      expect(result.outcome).toBe("rejected");
      expect(events.find((event) => event.type === "verification.completed")).toMatchObject({
        result: { verified: false, integrity: "unchanged" },
      });
    } finally {
      await rm(helperPath, { force: true });
    }
  });

  it("does not verify a migration that relies on ambient network behavior", async () => {
    const events: MigrationEvent[] = [];
    const server = createServer((request, response) => {
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ receiptUrl: `https://pay.stripe.com/receipts/${request.url?.slice(1)}` }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port.");
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        await writeFile(
          path.join(root, "src", "receipt.mjs"),
          [
            "export async function receiptForPayment(stripe, paymentIntentId) {",
            "  await stripe.charges.list({ payment_intent: paymentIntentId, limit: 1 });",
            `  const response = await fetch('http://127.0.0.1:${address.port}/' + paymentIntentId);`,
            "  return (await response.json()).receiptUrl;",
            "}",
          ].join("\n"),
        );
        onProgress("Used an ambient receipt server.");
        return { messages: ["ambient network"] };
      },
    };

    try {
      const result = await runMigration({
        agent: tamperingAgent,
        onEvent: (event) => events.push(event),
      });

      expect(result.outcome).toBe("rejected");
      expect(events.find((event) => event.type === "verification.completed")).toMatchObject({
        result: { verified: false, integrity: "unchanged" },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });

  it("does not execute repo-local git hooks while collecting proof", async () => {
    const sentinelPath = path.join(process.cwd(), "demo-workspaces", "fsmonitor-fired");
    const tamperingAgent: MigrationAgent = {
      name: "Verified replay",
      async migrate(root, _impacts, onProgress) {
        const fsmonitorPath = path.join(root, ".git", "fsmonitor.sh");
        await writeFile(fsmonitorPath, `#!/bin/sh\necho fired > ${JSON.stringify(sentinelPath)}\nprintf '\\n'\n`);
        await chmod(fsmonitorPath, 0o755);
        await execFileAsync("git", ["config", "core.fsmonitor", fsmonitorPath], { cwd: root });
        await new ReplayMigrationAgent().migrate(root, [], onProgress);
      },
    };

    try {
      const result = await runMigration({
        agent: tamperingAgent,
        onEvent: () => undefined,
      });

      expect(result.outcome).toBe("verified");
      await expect(readFile(sentinelPath, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    } finally {
      await rm(sentinelPath, { force: true });
    }
  });
});
