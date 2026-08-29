import { describe, expect, it } from "vitest";

import { isPathWithin, normalizeRepositoryPath } from "./lib/paths.mjs";

describe("repository path policy", () => {
  it("normalizes safe repository-relative paths", () => {
    expect(normalizeRepositoryPath("./src/auth/")).toBe("src/auth");
    expect(isPathWithin("src/auth/session.ts", "src/auth")).toBe(true);
    expect(isPathWithin("src/authorize.ts", "src/auth")).toBe(false);
  });

  it.each(["/etc/passwd", "../src", "src/../../test", ".git/config", "src\\gate.ts", ""])(
    "rejects unsafe path %j",
    (path) => {
      expect(() => normalizeRepositoryPath(path)).toThrowError(TypeError);
    },
  );
});
