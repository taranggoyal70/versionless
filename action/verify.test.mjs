import { describe, expect, it } from "vitest";

import { runVerification } from "./lib/verify.mjs";

describe("runVerification", () => {
  it("captures a successful command without invoking a shell", async () => {
    const result = await runVerification(process.cwd(), ".", {
      executable: process.execPath,
      args: ["-e", "process.stdout.write('proof passed')"],
    });

    expect(result).toMatchObject({
      passed: true,
      exitCode: 0,
      stdout: "proof passed",
      stderr: "",
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});
