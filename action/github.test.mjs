import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { writeActionOutputs, writeStepSummary } from "./lib/github.mjs";

const directories = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("GitHub Actions files", () => {
  it("appends the job summary and stable action outputs", async () => {
    const directory = await mkdtemp(join(tmpdir(), "versionless-github-"));
    directories.push(directory);
    const summaryPath = join(directory, "summary.md");
    const outputPath = join(directory, "outputs.txt");

    await writeStepSummary(summaryPath, "# Versionless\n");
    await writeActionOutputs(outputPath, {
      status: "verified",
      "evidence-path": ".versionless/evidence.json",
      "locked-hash": "abc123",
    });

    await expect(readFile(summaryPath, "utf8")).resolves.toBe("# Versionless\n");
    await expect(readFile(outputPath, "utf8")).resolves.toBe(
      "status=verified\nevidence-path=.versionless/evidence.json\nlocked-hash=abc123\n",
    );
  });
});
