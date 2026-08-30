import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { runAction } from "./lib/main.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

afterEach(cleanupRepositories);

describe("runAction", () => {
  it("runs the complete GitHub check and publishes its artifacts", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
    await writeRepositoryFile(repository, ".versionless.json", JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: process.execPath, args: ["-e", "process.exit(0)"] },
    }));
    const baseSha = commitAll(repository, "base");
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const headSha = commitAll(repository, "head");
    const summaryPath = join(repository, "summary.md");
    const githubOutputPath = join(repository, "github-output.txt");

    const result = await runAction({
      repository,
      environment: {
        INPUT_BASE_SHA: baseSha,
        INPUT_HEAD_SHA: headSha,
        INPUT_CONFIG_PATH: ".versionless.json",
        INPUT_EVIDENCE_PATH: ".versionless/evidence.json",
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: githubOutputPath,
      },
    });

    expect(result.evidence.status).toBe("verified");
    await expect(readFile(join(repository, ".versionless/evidence.json"), "utf8"))
      .resolves.toContain('"status": "verified"');
    await expect(readFile(summaryPath, "utf8")).resolves.toContain("✅ Verified");
    await expect(readFile(githubOutputPath, "utf8")).resolves.toContain("status=verified");
  });

  it("publishes rejected evidence when policy setup fails", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, ".versionless.json", "{not-json\n");
    const headSha = commitAll(repository, "invalid policy");
    const summaryPath = join(repository, "summary.md");
    const githubOutputPath = join(repository, "github-output.txt");

    const result = await runAction({
      repository,
      environment: {
        INPUT_BASE_SHA: headSha,
        INPUT_HEAD_SHA: headSha,
        GITHUB_STEP_SUMMARY: summaryPath,
        GITHUB_OUTPUT: githubOutputPath,
      },
    });

    expect(result.evidence).toMatchObject({
      status: "rejected",
      reasons: ["CHECK_FAILED"],
      error: { code: "MALFORMED_JSON" },
    });
    await expect(readFile(join(repository, ".versionless/evidence.json"), "utf8"))
      .resolves.toContain('"code": "MALFORMED_JSON"');
    await expect(readFile(summaryPath, "utf8")).resolves.toContain("Check could not establish proof");
    await expect(readFile(githubOutputPath, "utf8")).resolves.toContain("status=rejected");
  });
});
