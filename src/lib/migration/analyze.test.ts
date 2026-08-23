import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { analyzeRepository } from "./analyze";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("analyzeRepository", () => {
  it("locates customer code that depends on the removed PaymentIntent.charges field", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "versionless-analysis-"));
    roots.push(root);
    await mkdir(path.join(root, "src"));
    await writeFile(
      path.join(root, "src", "receipt.ts"),
      [
        "export function receiptUrl(paymentIntent: PaymentIntent) {",
        "  return paymentIntent.charges.data[0]?.receipt_url ?? null;",
        "}",
      ].join("\n"),
    );

    await writeFile(path.join(root, "src", "unrelated.ts"), "export const status = 'ready';\n");

    const impacts = await analyzeRepository(root);

    expect(impacts).toEqual([
      expect.objectContaining({
        file: "src/receipt.ts",
        line: 2,
        kind: "removed-field",
        symbol: "PaymentIntent.charges",
      }),
    ]);
  });
});
