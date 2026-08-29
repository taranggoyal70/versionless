import { afterEach, describe, expect, it } from "vitest";

import { runPullRequestCheck } from "./lib/check.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

afterEach(cleanupRepositories);

describe("runPullRequestCheck", () => {
  it("verifies an allowed implementation change against unchanged proof", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
    await writeRepositoryFile(repository, ".versionless.json", JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: {
        executable: process.execPath,
        args: ["-e", "const fs=require('fs');process.exit(fs.readFileSync('src/gate.ts','utf8').includes('true')?0:1)"],
      },
    }));
    const baseSha = commitAll(repository, "base");

    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const headSha = commitAll(repository, "head");

    const evidence = await runPullRequestCheck({
      repository,
      baseSha,
      headSha,
      configPath: ".versionless.json",
    });

    expect(evidence).toMatchObject({
      schema: "versionless.pr_check.v1",
      status: "verified",
      baseSha,
      headSha,
      changedPaths: ["src/gate.ts"],
      pathPolicy: {
        accepted: true,
        approvedChanges: ["src/gate.ts"],
        lockedChanges: [],
        outOfScopeChanges: [],
      },
      integrity: { unchanged: true },
      verification: { passed: true, exitCode: 0 },
      reasons: [],
    });
    expect(evidence.integrity.baseHash).toBe(evidence.integrity.headHash);
  });
});
