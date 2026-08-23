// @ts-nocheck - This fixture is compiled only after Versionless copies it into Warrant's test directory.
import { describe, expect, it } from "vitest";

import { freezeExec } from "../src/artifact.js";
import { issueWarrant } from "../src/gate.js";

const artifact = freezeExec({ command: ["pnpm", "test"], cwd: "/repo" });

describe("Warrant audit timestamps", () => {
  it.each([
    "not-a-date",
    "2026-08-23T17:00:00-07:00",
    "2026-08-24T00:00:00Z",
    "2026-08-24 00:00:00.000Z",
  ])("refuses non-canonical approvedAt value %s", (approvedAt) => {
    expect(() => issueWarrant({ artifact, approver: "tarang@example.com", policy: "shell:any", approvedAt }))
      .toThrow(/canonical UTC ISO-8601/);
  });

  it("preserves canonical UTC millisecond timestamps", () => {
    const approvedAt = "2026-08-24T00:00:00.000Z";
    const warrant = issueWarrant({ artifact, approver: "tarang@example.com", policy: "shell:any", approvedAt });

    expect(warrant.approvedAt).toBe(approvedAt);
  });
});
