import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const repositories = [];

export async function createRepository() {
  const repository = await mkdtemp(join(tmpdir(), "versionless-action-"));
  repositories.push(repository);
  git(repository, ["init", "--quiet"]);
  git(repository, ["config", "user.email", "versionless@example.com"]);
  git(repository, ["config", "user.name", "Versionless Test"]);
  return repository;
}

export async function writeRepositoryFile(repository, path, contents) {
  const destination = join(repository, path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

export function commitAll(repository, message) {
  git(repository, ["add", "."]);
  git(repository, ["commit", "--quiet", "-m", message]);
  return git(repository, ["rev-parse", "HEAD"]).trim();
}

export async function cleanupRepositories() {
  await Promise.all(repositories.splice(0).map((repository) => rm(repository, { recursive: true, force: true })));
}

function git(repository, args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8" });
}
