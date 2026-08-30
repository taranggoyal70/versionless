import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { runPullRequestCheck } from "./lib/check.mjs";
import { RejectionReason } from "./lib/reasons.mjs";
import { cleanupRepositories, commitAll, createRepository, writeRepositoryFile } from "./test/repository.mjs";

const schemaPath = fileURLToPath(new URL("../docs/evidence.schema.json", import.meta.url));

afterEach(cleanupRepositories);

describe("published evidence schema", () => {
  it("covers every stable rejection reason and generated evidence field", async () => {
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));
    const repository = await createRepository();
    await writeRepositoryFile(repository, "src/gate.ts", "export const gate = true;\n");
    await writeRepositoryFile(repository, "test/gate.test.ts", "locked contract\n");
    await writeRepositoryFile(repository, ".versionless.json", JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: process.execPath, args: ["-e", "process.exit(0)"] },
    }));
    const headSha = commitAll(repository, "head");

    const evidence = await runPullRequestCheck({ repository, baseSha: headSha, headSha });

    expect(schema.properties.schema.const).toBe(evidence.schema);
    expect([...schema.properties.reasons.items.enum].sort())
      .toEqual(Object.values(RejectionReason).sort());
    expect(missingRequiredFields(schema, evidence)).toEqual([]);
    expect(missingRequiredFields(schema.$defs.workspace, evidence.workspace)).toEqual([]);
    expect(missingRequiredFields(schema.$defs.policy, evidence.policy)).toEqual([]);
    expect(missingRequiredFields(schema.$defs.pathPolicy, evidence.pathPolicy)).toEqual([]);
    expect(missingRequiredFields(schema.$defs.integrity, evidence.integrity)).toEqual([]);
    expect(missingRequiredFields(schema.$defs.verification, evidence.verification)).toEqual([]);
  });
});

function missingRequiredFields(schema, value) {
  return schema.required.filter((field) => !Object.hasOwn(value, field));
}
