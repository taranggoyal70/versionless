import { describe, expect, it } from "vitest";

import { formatJobSummary } from "./lib/report.mjs";

describe("formatJobSummary", () => {
  it("turns evidence into a readable rejected PR summary", () => {
    const summary = formatJobSummary({
      status: "rejected",
      baseSha: "a".repeat(40),
      headSha: "b".repeat(40),
      checkoutSha: "e".repeat(40),
      workspace: { clean: false, changes: ["test/gate.test.ts"] },
      changedPaths: ["src/gate.ts", "test/gate.test.ts"],
      reasons: ["CHECKOUT_MISMATCH", "WORKTREE_DIRTY", "LOCKED_PATH_CHANGED"],
      integrity: { unchanged: false, baseHash: "c".repeat(64), headHash: "d".repeat(64) },
      pathPolicy: { allowedChanges: ["src/gate.ts"], lockedChanges: ["test/gate.test.ts"], outOfScopeChanges: [] },
      verification: { passed: false, skipped: true, durationMs: 0 },
    });

    expect(summary).toContain("# Versionless PR check");
    expect(summary).toContain("Rejected");
    expect(summary).toContain("Locked contract changed");
    expect(summary).toContain("Checked-out commit does not match the requested head");
    expect(summary).toContain("Workspace contains changes outside the requested head");
    expect(summary).toContain("1 uncommitted change(s)");
    expect(summary).toContain("`eeeeeeeeeeee`");
    expect(summary).toContain("`test/gate.test.ts`");
    expect(summary).toContain("Verification skipped");
  });
});
