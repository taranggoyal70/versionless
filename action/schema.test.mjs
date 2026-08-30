import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { EXECUTABLE_PATTERN, POLICY_LIMITS } from "./lib/config.mjs";

const schemaPath = fileURLToPath(new URL("../docs/versionless.schema.json", import.meta.url));

describe("published policy schema", () => {
  it("stays aligned with runtime policy limits", async () => {
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));

    expect(schema.properties.lockedPaths.maxItems).toBe(POLICY_LIMITS.pathCount);
    expect(schema.properties.allowedPaths.maxItems).toBe(POLICY_LIMITS.pathCount);
    expect(schema.$defs.repositoryPath.maxLength).toBe(POLICY_LIMITS.pathLength);
    expect(schema.properties.verification.properties.executable.maxLength)
      .toBe(POLICY_LIMITS.executableLength);
    expect(schema.properties.verification.properties.executable.pattern).toBe(EXECUTABLE_PATTERN);
    expect(schema.properties.verification.properties.args.maxItems).toBe(POLICY_LIMITS.argumentCount);
    expect(schema.properties.verification.properties.args.items.maxLength).toBe(POLICY_LIMITS.argumentLength);
  });

  it("rejects unknown policy and verification fields in editor tooling", async () => {
    const schema = JSON.parse(await readFile(schemaPath, "utf8"));

    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.verification.additionalProperties).toBe(false);
  });
});
