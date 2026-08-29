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

  it("rejects unsupported policy versions with a stable error code", () => {
    expect(() => loadPolicyFromText(JSON.stringify({
      version: 2,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"] },
    }))).toThrowError(expect.objectContaining({
      name: "PolicyError",
      code: "UNSUPPORTED_VERSION",
    }));
  });
});
