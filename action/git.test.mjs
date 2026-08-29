import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

import { hashLockedPaths, listChangedPaths, readFileAtCommit } from "./lib/git.mjs";

const repositories = [];

afterEach(async () => {
  await Promise.all(repositories.splice(0).map((repository) => rm(repository, { recursive: true, force: true })));
});

describe("listChangedPaths", () => {
  it("returns sorted repository paths changed between two commits", async () => {
    const repository = await createRepository();
    await write(repository, "src/gate.ts", "export const gate = false;\n");
    await write(repository, "test/gate.test.ts", "locked proof\n");
    const baseSha = commit(repository, "base");

    await write(repository, "src/gate.ts", "export const gate = true;\n");
    await write(repository, "docs/readme.md", "new docs\n");
    const headSha = commit(repository, "head");

    await expect(listChangedPaths(repository, baseSha, headSha)).resolves.toEqual([
      "docs/readme.md",
      "src/gate.ts",
    ]);
  });
});

describe("hashLockedPaths", () => {
  it("fingerprints the locked Git objects at each commit", async () => {
    const repository = await createRepository();
    await write(repository, "src/gate.ts", "export const gate = false;\n");
    await write(repository, "test/gate.test.ts", "locked proof\n");
    const baseSha = commit(repository, "base");

    await write(repository, "src/gate.ts", "export const gate = true;\n");
    const implementationSha = commit(repository, "implementation only");
    await write(repository, "test/gate.test.ts", "weakened proof\n");
    const proofSha = commit(repository, "proof changed");

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
    await write(repository, ".versionless.json", "base policy\n");
    const baseSha = commit(repository, "base");
    await write(repository, ".versionless.json", "untrusted head policy\n");
    commit(repository, "head");

    await expect(readFileAtCommit(repository, baseSha, ".versionless.json")).resolves.toBe("base policy\n");
  });
});

async function createRepository() {
  const repository = await mkdtemp(join(tmpdir(), "versionless-action-"));
  repositories.push(repository);
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.email", "versionless@example.com"]);
  git(repository, ["config", "user.name", "Versionless Test"]);
  return repository;
}

async function write(repository, path, contents) {
  const destination = join(repository, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

function commit(repository, message) {
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", message]);
  return git(repository, ["rev-parse", "HEAD"]).trim();
}

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" });
}
