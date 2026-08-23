import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ReplayMigrationAgent, type MigrationAgent } from "./agent";
import { runMigration } from "./run";
import type { MigrationEvent } from "./types";

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
});
