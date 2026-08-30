import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import {
  hashLockedPaths,
  listChangedPaths,
  listWorkspaceChanges,
  readCurrentHead,
  readFileAtCommit,
} from "./lib/git.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

afterEach(async () => {
  await cleanupRepositories();
});

describe("listChangedPaths", () => {
  it("returns sorted repository paths changed between two commits", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked contract\n");
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
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked contract\n");
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

describe("readCurrentHead", () => {
  it("returns the exact commit checked out for verification", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const headSha = commitAll(repository, "head");

    await expect(readCurrentHead(repository)).resolves.toBe(headSha);
  });
});

describe("listWorkspaceChanges", () => {
  it("finds staged, unstaged, and untracked files outside the committed head", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/staged.ts", "base\n");
    await writeRepositoryFile(repository, "src/unstaged.ts", "base\n");
    commitAll(repository, "head");
    await writeRepositoryFile(repository, "src/staged.ts", "staged\n");
    git(repository, ["add", "src/staged.ts"]);
    await writeRepositoryFile(repository, "src/unstaged.ts", "unstaged\n");
    await writeRepositoryFile(repository, "src/untracked.ts", "untracked\n");

    await expect(listWorkspaceChanges(repository)).resolves.toEqual([
      "src/staged.ts",
      "src/unstaged.ts",
      "src/untracked.ts",
    ]);
  });

  it("ignores generated untracked evidence but never hides a tracked mutation", async () => {
    const repository = await createRepository();
    await writeRepositoryFile(repository, ".versionless/tracked.json", "committed\n");
    commitAll(repository, "head");
    await writeRepositoryFile(repository, ".versionless/tracked.json", "changed\n");
    await writeRepositoryFile(repository, ".versionless/generated.json", "generated\n");

    await expect(listWorkspaceChanges(repository, {
      ignoredUntrackedPaths: [
        ".versionless/tracked.json",
        ".versionless/generated.json",
      ],
    })).resolves.toEqual([".versionless/tracked.json"]);
  });
});

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository });
}
