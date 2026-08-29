import { execFileSync, spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

const actionEntry = fileURLToPath(new URL("./index.mjs", import.meta.url));

afterEach(cleanupRepositories);

describe("Versionless action entrypoint", () => {
  it("returns success only for a verified pull request", async () => {
    const repository = await configuredRepository();
    const baseSha = git(repository, ["rev-parse", "HEAD"]);
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    const headSha = commitAll(repository, "head");

    const result = spawnSync(process.execPath, [actionEntry], {
      cwd: repository,
      encoding: "utf8",
      env: actionEnvironment(baseSha, headSha),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Versionless verified this pull request");
    await expect(readFile(`${repository}/.versionless/evidence.json`, "utf8")).resolves.toContain('"status": "verified"');
  });
});

async function configuredRepository() {
  const repository = await createRepository();
  await writeRepositoryFile(repository, "src/gate.ts", "export const gate = false;\n");
  await writeRepositoryFile(repository, "test/gate.test.ts", "locked proof\n");
  await writeRepositoryFile(repository, ".versionless.json", JSON.stringify({
    version: 1,
    lockedPaths: ["test"],
    allowedPaths: ["src"],
    verification: { executable: process.execPath, args: ["-e", "process.exit(0)"] },
  }));
  commitAll(repository, "base");
  return repository;
}

function actionEnvironment(baseSha, headSha) {
  return {
    ...process.env,
    INPUT_BASE_SHA: baseSha.trim(),
    INPUT_HEAD_SHA: headSha.trim(),
    INPUT_CONFIG_PATH: ".versionless.json",
    INPUT_EVIDENCE_PATH: ".versionless/evidence.json",
  };
}

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" }).trim();
}
