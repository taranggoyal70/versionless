import { afterEach, describe, expect, it } from "vitest";

import { hashLockedPaths, listChangedPaths, readFileAtCommit } from "./lib/git.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

afterEach(async () => {
  await cleanupRepositories();
});

describe("listChangedPaths", () => {
  it("returns sorted repository paths changed between two commits", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
    const baseSha = commitAll(repository, "base");

    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    await writeRepositoryFile(repository, "docs/readme.md", "new docs\n");
    const headSha = commitAll(repository, "head");

    await expect(listChangedPaths(repository, baseSha, headSha)).resolves.toEqual([
      "docs/readme.md",
      "src/gate.ts",
    ]);
  });
});

describe("hashLockedPaths", () => {
  it("fingerprints the locked Git objects at each commit", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
    const baseSha = commitAll(repository, "base");

    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const implementationSha = commitAll(repository, "implementation only");
    await writeRepositoryFile(repository, "test/gate.test.ts", "weakened proof\n");
    const proofSha = commitAll(repository, "proof changed");

    const baseline = await hashLockedPaths(repository, baseSha, ["test"]);
    const implementationOnly = await hashLockedPaths(repository, implementationSha, ["test"]);
    const changedProof = await hashLockedPaths(repository, proofSha, ["test"]);

    expect(baseline).toMatchObject({ files: ["test/gate.test.ts"] });
    expect(implementationOnly.hash).toBe(baseline.hash);
    expect(changedProof.hash).not.toBe(baseline.hash);
  });
});

describe("readFileAtCommit", () => {
  it("loads trusted configuration from the base commit", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, ".versionless.json", "base policy\n");
    const baseSha = commitAll(repository, "base");
    await writeRepositoryFile(repository, ".versionless.json", "untrusted head policy\n");
    commitAll(repository, "head");

    await expect(readFileAtCommit(repository, baseSha, ".versionless.json")).resolves.toBe("base policy\n");
  });
});
