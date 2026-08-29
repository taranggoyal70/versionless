import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { normalizeRepositoryPath } from "./paths.mjs";

export async function writeEvidence(repository, outputPath, evidence) {
  const relativePath = normalizeRepositoryPath(outputPath);
  const destination = join(repository, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  return relativePath;
}
