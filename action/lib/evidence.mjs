import { constants } from "node:fs";
import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

import { normalizeRepositoryPath } from "./paths.mjs";

export async function writeEvidence(repository, outputPath, evidence) {
  const relativePath = normalizeRepositoryPath(outputPath);
  const repositoryRoot = await realpath(repository);
  const destination = resolve(repositoryRoot, relativePath);
  await mkdir(dirname(destination), { recursive: true });
  const parent = await realpath(dirname(destination));
  if (parent !== repositoryRoot && !parent.startsWith(`${repositoryRoot}${sep}`)) {
    throw new TypeError("Evidence path must stay inside the repository.");
  }
  const handle = await open(
    destination,
    constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.chmod(0o600);
    await handle.writeFile(`${JSON.stringify(evidence, null, 2)}\n`, "utf8");
  } finally {
    await handle.close();
  }
  return relativePath;
}
