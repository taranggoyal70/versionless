import { describe, expect, it } from "vitest";

import { formatJobSummary } from "./lib/report.mjs";

describe("formatJobSummary", () => {
  it("turns evidence into a readable rejected PR summary", () => {
    const summary = formatJobSummary({
      status: "rejected",
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      changedPaths: ["src/gate.ts", "test/gate.test.ts"],
      reasons: ["LOCKED_PATH_CHANGED"],
      integrity: { unchanged: false, baseHash: "c".repeat(64), headHash: "d".repeat(64) },
      pathPolicy: { approvedChanges: ["src/gate.ts"], lockedChanges: ["test/gate.test.ts"], outOfScopeChanges: [] },
      verification: { passed: false, skipped: true, durationMs: 0 },
    });

    expect(summary).toContain("# Versionless PR check");
    expect(summary).toContain("Rejected");
    expect(summary).toContain("Locked proof changed");
    expect(summary).toContain("`test/gate.test.ts`");
    expect(summary).toContain("Verification skipped");
  });
});
