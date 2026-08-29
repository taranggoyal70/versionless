import { describe, expect, it } from "vitest";

import { evaluatePathPolicy } from "./lib/policy.mjs";

describe("evaluatePathPolicy", () => {
  it("separates approved, locked, and out-of-scope changes", () => {
    const result = evaluatePathPolicy(
      ["src/gate.ts", "test/gate.test.ts", "docs/notes.md"],
      { allowedPaths: ["src"], lockedPaths: ["test"] },
    );

    expect(result).toEqual({
      accepted: false,
      approvedChanges: ["src/gate.ts"],
      lockedChanges: ["test/gate.test.ts"],
      outOfScopeChanges: ["docs/notes.md"],
    });
  });
});
