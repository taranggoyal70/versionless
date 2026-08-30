import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { writeEvidence } from "./lib/evidence.mjs";

const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("writeEvidence", () => {
  it("writes machine-readable evidence inside the repository", async () => {
    const repository = await mkdtemp(join(tmpdir(), "versionless-evidence-"));
    directories.push(repository);
    const evidence = { schema: "versionless.pr_check.v1", status: "verified" };

    const relativePath = await writeEvidence(repository, ".versionless/evidence.json", evidence);

    expect(relativePath).toBe(".versionless/evidence.json");
    await expect(readFile(join(repository, relativePath), "utf8")).resolves.toBe(`${JSON.stringify(evidence, null, 2)}\n`);
  });

  it("refuses to write evidence outside the repository", async () => {
    const repository = await mkdtemp(join(tmpdir(), "versionless-evidence-"));
    directories.push(repository);
    await expect(writeEvidence(repository, "../evidence.json", {})).rejects.toThrowError(TypeError);
  });

  it("refuses to follow an output directory symlink outside the repository", async () => {
    const repository = await mkdtemp(join(tmpdir(), "versionless-evidence-"));
    const outside = await mkdtemp(join(tmpdir(), "versionless-outside-"));
    directories.push(repository, outside);
    await symlink(outside, join(repository, ".versionless"));

    await expect(writeEvidence(repository, ".versionless/evidence.json", {}))
      .rejects.toThrowError("Evidence path must stay inside the repository.");
  });
});
