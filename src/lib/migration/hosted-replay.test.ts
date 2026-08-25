import { describe, expect, it } from "vitest";

import { runHostedWarrantReplay } from "./hosted-replay";
import type { MigrationEvent } from "./types";

describe("runHostedWarrantReplay", () => {
  it("emits a complete verified replay event sequence", async () => {
    const events: MigrationEvent[] = [];
    const emit = (event: MigrationEvent) => events.push(event);

    await runHostedWarrantReplay(emit, undefined, 0);

    expect(events).toHaveLength(13);
    expect(events.map((e) => e.type)).toEqual([
      "run.started",
      "contract.loaded",
      "impact.found",
      "integrity.locked",
      "baseline.failed",
      "sponsor.evidence",
      "agent.started",
      "agent.message",
      "patch.ready",
      "verification.started",
      "verification.completed",
      "evidence.ready",
      "run.completed",
    ]);
    expect(events.at(-1)).toMatchObject({ type: "run.completed", outcome: "verified" });
    expect(events.find((e) => e.type === "verification.completed")).toMatchObject({
      result: { verified: true, integrity: "unchanged", exitCode: 0 },
    });
    expect(events.find((e) => e.type === "patch.ready")).toMatchObject({
      diff: expect.stringContaining("canonical UTC ISO-8601 instant"),
      filesChanged: 1,
    });
  });

  it("respects abort signal and stops emitting", async () => {
    const events: MigrationEvent[] = [];
    const emit = (event: MigrationEvent) => events.push(event);
    const controller = new AbortController();

    const promise = runHostedWarrantReplay(emit, controller.signal, 50);
    await new Promise((resolve) => setTimeout(resolve, 100));
    controller.abort();

    await expect(promise).rejects.toThrow("Hosted replay canceled by the client.");
    expect(events.length).toBeLessThan(14);
  });

  it("uses provided delay between events", async () => {
    const events: MigrationEvent[] = [];
    const emit = (event: MigrationEvent) => events.push(event);
    const delayMs = 10;

    const startedAt = performance.now();
    await runHostedWarrantReplay(emit, undefined, delayMs);
    const elapsed = performance.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(delayMs * 13);
    expect(elapsed).toBeLessThan(delayMs * 13 + 500);
  });

  it("emits correct contract and proof metadata", async () => {
    const events: MigrationEvent[] = [];
    const emit = (event: MigrationEvent) => events.push(event);

    await runHostedWarrantReplay(emit, undefined, 0);

    const contractLoaded = events.find((e) => e.type === "contract.loaded");
    expect(contractLoaded).toMatchObject({
      targetName: "Warrant timestamp hardening",
      repositoryLabel: "taranggoyal70 / warrant",
      allowedFiles: ["src/gate.ts"],
      lockedPaths: expect.arrayContaining(["test", "src/protocol", "package.json"]),
    });

    const integrityLocked = events.find((e) => e.type === "integrity.locked");
    expect(integrityLocked?.hash).toBe("sha256:a2c372886d501b33b609d92ab543f5b261fd36110136415ace324e4648aa202e");
  });

  it("includes sponsor evidence for Claude-Mem replay", async () => {
    const events: MigrationEvent[] = [];
    const emit = (event: MigrationEvent) => events.push(event);

    await runHostedWarrantReplay(emit, undefined, 0);

    const sponsorEvidence = events.find((e) => e.type === "sponsor.evidence");
    expect(sponsorEvidence).toMatchObject({
      evidence: {
        provider: "Claude-Mem",
        stage: "recall",
        status: "replayed",
        itemCount: 3,
      },
    });
  });
});