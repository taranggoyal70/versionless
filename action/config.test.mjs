import { describe, expect, it } from "vitest";

import { loadPolicyFromText } from "./lib/config.mjs";

describe("loadPolicyFromText", () => {
  it("loads a version 1 policy and supplies the repository root", () => {
    const policy = loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["test", "package-lock.json"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"] },
    }));

    expect(policy).toEqual({
      version: 1,
      lockedPaths: ["test", "package-lock.json"],
      allowedPaths: ["src"],
      workingDirectory: ".",
      verification: { executable: "npm", args: ["test"] },
    });
  });
});
