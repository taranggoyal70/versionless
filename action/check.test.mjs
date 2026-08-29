import { afterEach, describe, expect, it } from "vitest";

import { runPullRequestCheck } from "./lib/check.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

afterEach(cleanupRepositories);

describe("runPullRequestCheck", () => {
  it("verifies an allowed implementation change against unchanged proof", async () => {
    const repository = await createRepository();
    const baseSha = await seedRepository(repository);

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

  it("rejects a pull request that changes the locked proof", async () => {
    const repository = await createRepository();
    const baseSha = await seedRepository(repository);
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "weakened proof\n");
    const headSha = commitAll(repository, "head");

    const evidence = await runPullRequestCheck({ repository, baseSha, headSha });

    expect(evidence).toMatchObject({
      status: "rejected",
      reasons: ["LOCKED_PATH_CHANGED", "LOCKED_HASH_CHANGED"],
      pathPolicy: { lockedChanges: ["test/gate.test.ts"] },
      integrity: { unchanged: false },
      verification: { passed: false, skipped: true },
    });
  });

  it("rejects configuration tampering and changes outside agent scope", async () => {
    const repository = await createRepository();
    const baseSha = await seedRepository(repository);
    await writeRepositoryFile(repository, ".versionless.json", "{}\n");
    await writeRepositoryFile(repository, "docs/notes.md", "unexpected file\n");
    const headSha = commitAll(repository, "head");

    const evidence = await runPullRequestCheck({ repository, baseSha, headSha });

    expect(evidence).toMatchObject({
      status: "rejected",
      reasons: ["LOCKED_PATH_CHANGED", "OUT_OF_SCOPE_CHANGE", "LOCKED_HASH_CHANGED"],
      pathPolicy: {
        lockedChanges: [".versionless.json"],
        outOfScopeChanges: ["docs/notes.md"],
      },
      verification: { skipped: true },
    });
  });

  it("rejects an allowed patch when the locked verification fails", async () => {
    const repository = await createRepository();
    const baseSha = await seedRepository(repository, "process.stderr.write('acceptance failed');process.exit(9)");
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const headSha = commitAll(repository, "head");

    const evidence = await runPullRequestCheck({ repository, baseSha, headSha });

    expect(evidence).toMatchObject({
      status: "rejected",
      reasons: ["VERIFICATION_FAILED"],
      pathPolicy: { accepted: true },
      integrity: { unchanged: true },
      verification: { passed: false, exitCode: 9, stderr: "acceptance failed" },
    });
  });
});

async function seedRepository(
  repository,
  verificationScript = "const fs=require('fs');process.exit(fs.readFileSync('src/gate.ts','utf8').includes('true')?0:1)",
) {
  await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
  await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
  await writeRepositoryFile(repository, ".versionless.json", JSON.stringify({
    version: 1,
    lockedPaths: ["test"],
    allowedPaths: ["src"],
    verification: {
      executable: process.execPath,
      args: ["-e", verificationScript],
    },
  }));
  return commitAll(repository, "base");
}
