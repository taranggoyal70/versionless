import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const metadataPath = fileURLToPath(new URL("../action.yml", import.meta.url));

describe("GitHub Action metadata", () => {
  it("exposes the stable PR-check inputs and outputs", async () => {
    const metadata = await readFile(metadataPath, "utf8");

    expect(metadata).toContain("using: composite");
    expect(metadata).toContain("base-sha:");
    expect(metadata).toContain("head-sha:");
    expect(metadata).toContain("status:");
    expect(metadata).toContain("evidence-path:");
    expect(metadata).toContain("locked-hash:");
    expect(metadata).toContain("reason-codes:");
  });

  it("always uploads the machine-readable evidence bundle", async () => {
    const metadata = await readFile(metadataPath, "utf8");

    expect(metadata).toContain("actions/upload-artifact@v4");
    expect(metadata).toContain("if: always()");
    expect(metadata).toContain("versionless-evidence");
  });
});
