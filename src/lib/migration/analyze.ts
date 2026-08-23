import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import type { Impact } from "./types";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".ts", ".tsx"]);
const IGNORED_DIRECTORIES = new Set([".git", ".next", "node_modules", "locked"]);
const REMOVED_CHARGES_FIELD = /(?:paymentIntent|payment_intent|intent)\.charges\b/;

async function sourceFiles(root: string, directory = root): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return IGNORED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(root, absolute);
      }
      return SOURCE_EXTENSIONS.has(path.extname(entry.name)) ? [absolute] : [];
    }),
  );
  return nested.flat();
}

export async function analyzeRepository(root: string): Promise<Impact[]> {
  const files = await sourceFiles(root);
  const impacts = await Promise.all(
    files.map(async (absolute) => {
      const content = await readFile(absolute, "utf8");
      return content.split("\n").flatMap((line, index) => {
        const match = line.match(REMOVED_CHARGES_FIELD);
        if (!match || match.index === undefined) return [];
        return [
          {
            file: path.relative(root, absolute),
            line: index + 1,
            column: match.index + 1,
            kind: "removed-field" as const,
            symbol: "PaymentIntent.charges" as const,
            evidence: line.trim(),
            guidance: "List charges by payment_intent and read receipt_url from the resulting Charge.",
          },
        ];
      });
    }),
  );
  return impacts.flat().sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
}
