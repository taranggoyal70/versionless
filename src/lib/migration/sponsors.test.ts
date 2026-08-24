import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it } from "vitest";

import { reviewWithGreptile } from "./sponsors";
import type { MigrationTarget } from "./target";

const execFileAsync = promisify(execFile);
const originalApiKey = process.env.GREPTILE_API_KEY;
const originalPath = process.env.PATH;
const originalTimeout = process.env.GREPTILE_REVIEW_TIMEOUT_MS;

afterEach(() => {
  if (originalApiKey === undefined) delete process.env.GREPTILE_API_KEY;
  else process.env.GREPTILE_API_KEY = originalApiKey;
  process.env.PATH = originalPath;
  if (originalTimeout === undefined) delete process.env.GREPTILE_REVIEW_TIMEOUT_MS;
  else process.env.GREPTILE_REVIEW_TIMEOUT_MS = originalTimeout;
});

describe("reviewWithGreptile", () => {
  it("returns unavailable quickly when the Greptile CLI exceeds the review deadline", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "versionless-greptile-timeout-"));
    const source = path.join(root, "source");
    const proof = path.join(root, "proof");
    const bin = path.join(root, "bin");
    try {
      await mkdir(path.join(source, "src"), { recursive: true });
      await writeFile(path.join(source, "src/gate.ts"), "export const safe = false;\n");
      await execFileAsync("git", ["init", "-q"], { cwd: source });
      await execFileAsync("git", ["add", "."], { cwd: source });
      await execFileAsync("git", ["-c", "user.name=Test", "-c", "user.email=test@example.com", "commit", "-qm", "baseline"], { cwd: source });
      await execFileAsync("git", ["remote", "add", "origin", "https://github.com/example/repository.git"], { cwd: source });
      await execFileAsync("git", ["clone", "-q", source, proof]);
      await writeFile(path.join(proof, "src/gate.ts"), "export const safe = true;\n");

      await mkdir(bin);
      const greptile = path.join(bin, "greptile");
      await writeFile(greptile, "#!/bin/sh\nsleep 2\n");
      await chmod(greptile, 0o755);
      process.env.GREPTILE_API_KEY = "test-key";
      process.env.GREPTILE_REVIEW_TIMEOUT_MS = "25";
      process.env.PATH = `${bin}:${originalPath ?? ""}`;

      const target: MigrationTarget = {
        id: "test",
        name: "test",
        repositoryLabel: "example/repository",
        sourceRoot: source,
        fromVersion: "before",
        toVersion: "after",
        task: "Repair the security boundary.",
        allowedFiles: ["src/gate.ts"],
        lockedPaths: [],
        verificationCommand: { executable: "node", args: [] },
        supportPaths: [],
        impacts: [],
        proofClaims: [],
      };

      const startedAt = performance.now();
      const result = await reviewWithGreptile(proof, target, "timeout-test");
      expect(performance.now() - startedAt).toBeLessThan(1_000);
      expect(result.evidence).toMatchObject({ provider: "Greptile", status: "unavailable" });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
