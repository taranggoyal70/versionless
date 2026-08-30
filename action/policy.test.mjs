import { describe, expect, it } from "vitest";

import { evaluatePathPolicy } from "./lib/policy.mjs";

describe("evaluatePathPolicy", () => {
  it("separates allowed, locked, and out-of-scope changes", () => {
    const result = evaluatePathPolicy(
      ["src/gate.ts", "test/gate.test.ts", "docs/notes.md"],
      { allowedPaths: ["src"], lockedPaths: ["test"] },
    );

    expect(result).toEqual({
      accepted: false,
      allowedChanges: ["src/gate.ts"],
      lockedChanges: ["test/gate.test.ts"],
      outOfScopeChanges: ["docs/notes.md"],
    });
  });

  it("gives a nested locked path precedence over an allowed directory", () => {
    const result = evaluatePathPolicy(
      ["src/gate.ts", "src/gate.test.ts"],
      { allowedPaths: ["src"], lockedPaths: ["src/gate.test.ts"] },
    );

    expect(result).toMatchObject({
      accepted: false,
      allowedChanges: ["src/gate.ts"],
      lockedChanges: ["src/gate.test.ts"],
    });
  });
});
