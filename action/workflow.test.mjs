import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const activeWorkflowPath = fileURLToPath(new URL("../.github/workflows/versionless.yml", import.meta.url));
const starterWorkflowPath = fileURLToPath(new URL("../examples/github-action/versionless.yml", import.meta.url));

describe("starter GitHub workflow", () => {
  it("stays identical to the workflow Versionless runs itself", async () => {
    const [activeWorkflow, starterWorkflow] = await Promise.all([
      readFile(activeWorkflowPath, "utf8"),
      readFile(starterWorkflowPath, "utf8"),
    ]);

    expect(starterWorkflow).toBe(activeWorkflow);
    expect(starterWorkflow).toContain("id: versionless");
  });
});
