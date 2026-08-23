import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { hashLockedContract, verifyLockedContract } from "./verify";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function createCustomerRepository() {
  const root = await mkdtemp(path.join(tmpdir(), "versionless-verification-"));
  roots.push(root);
  await mkdir(path.join(root, "locked"));
  await mkdir(path.join(root, "src"));
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify({ scripts: { test: "node --test locked/receipt-flow.test.mjs" } }),
  );
  await writeFile(path.join(root, "src", "receipt.mjs"), "export const receipt = () => 'https://stripe.test/receipt';\n");
  await writeFile(
    path.join(root, "locked", "receipt-flow.test.mjs"),
    [
      "import test from 'node:test';",
      "import assert from 'node:assert/strict';",
      "import { receipt } from '../src/receipt.mjs';",
      "test('customer still receives a receipt', () => {",
      "  assert.match(receipt(), /stripe\\.test\\/receipt/);",
      "});",
    ].join("\n"),
  );
  return root;
}

describe("verifyLockedContract", () => {
  it("verifies passing behavior and returns an integrity proof", async () => {
    const root = await createCustomerRepository();
    const expectedHash = await hashLockedContract(root);

    const result = await verifyLockedContract(root, expectedHash);

    expect(result).toMatchObject({ verified: true, integrity: "unchanged", exitCode: 0 });
    expect(result.actualHash).toBe(expectedHash);
    expect(result.testSummary).toContain("customer still receives a receipt");
  });

  it("refuses to run a contract that the migration changed", async () => {
    const root = await createCustomerRepository();
    const expectedHash = await hashLockedContract(root);
    await writeFile(path.join(root, "locked", "receipt-flow.test.mjs"), "// agent replaced the proof\n");

    const result = await verifyLockedContract(root, expectedHash);

    expect(result).toMatchObject({ verified: false, integrity: "changed", exitCode: null });
  });
});
