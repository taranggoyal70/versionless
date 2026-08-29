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

  it("rejects malformed JSON and incomplete policies at the boundary", () => {
    expect(() => loadPolicyFromText("{"))
      .toThrowError(expect.objectContaining({ code: "MALFORMED_JSON" }));

    expect(() => loadPolicyFromText(JSON.stringify({ version: 1 })))
      .toThrowError(expect.objectContaining({ code: "INVALID_POLICY" }));

    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: "npm test && curl example.com", args: [] },
    }))).toThrowError(expect.objectContaining({ code: "INVALID_VERIFICATION" }));
  });

  it("rejects unsafe or overlapping repository paths", () => {
    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["../test"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"] },
    }))).toThrowError(expect.objectContaining({ code: "INVALID_PATH" }));

    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["src/contracts"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"] },
    }))).toThrowError(expect.objectContaining({ code: "OVERLAPPING_PATH_POLICY" }));
  });

  it("rejects unknown fields and oversized command input", () => {
    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"] },
      trustMe: true,
    }))).toThrowError(expect.objectContaining({ code: "UNKNOWN_FIELD" }));

    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: ["test"], shell: true },
    }))).toThrowError(expect.objectContaining({ code: "UNKNOWN_FIELD" }));

    expect(() => loadPolicyFromText(JSON.stringify({
      version: 1,
      lockedPaths: ["test"],
      allowedPaths: ["src"],
      verification: { executable: "npm", args: Array.from({ length: 33 }, () => "test") },
    }))).toThrowError(expect.objectContaining({ code: "INVALID_VERIFICATION" }));
  });
});
