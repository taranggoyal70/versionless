import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

import type { VerificationResult } from "./types";
import type { VerificationCommand } from "./target";

const execFileAsync = promisify(execFile);

export type VerificationOptions = {
  lockedPaths: string[];
  command: VerificationCommand;
};

const DEFAULT_VERIFICATION: VerificationOptions = {
  lockedPaths: ["locked"],
  command: { executable: process.execPath, args: ["locked/receipt-flow.test.mjs"] },
};

async function lockedFiles(root: string, lockedPaths: string[]): Promise<string[]> {
  const groups = await Promise.all(
    lockedPaths.map(async (relative) => {
      const absolute = path.join(root, relative);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error(`Locked path cannot be a symbolic link: ${relative}`);
      if (stat.isDirectory()) return filesInDirectory(absolute);
      if (stat.isFile()) return [absolute];
      return [];
    }),
  );
  return groups.flat().sort();
}

async function filesInDirectory(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      if (entry.isFile()) return [absolute];
      if (entry.isDirectory()) return filesInDirectory(absolute);
      return [];
    }),
  );
  return files.flat();
}

export async function hashLockedContract(root: string, lockedPaths = DEFAULT_VERIFICATION.lockedPaths): Promise<string> {
  const hash = createHash("sha256");
  for (const absolute of await lockedFiles(root, lockedPaths)) {
    hash.update(path.relative(root, absolute));
    hash.update("\0");
    hash.update(await readFile(absolute));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

export async function verifyLockedContract(
  root: string,
  expectedHash: string,
  options: VerificationOptions = DEFAULT_VERIFICATION,
): Promise<VerificationResult> {
  const startedAt = performance.now();
  const actualHash = await hashLockedContract(root, options.lockedPaths);
  if (actualHash !== expectedHash) {
    return {
      verified: false,
      integrity: "changed",
      expectedHash,
      actualHash,
      exitCode: null,
      testSummary: "Verification refused: the locked behavioral contract changed.",
      durationMs: Math.round(performance.now() - startedAt),
    };
  }

  const executionRoot = await realpath(root);
  const guardPath = path.join(executionRoot, ".versionless-verifier-guard.mjs");
  try {
    await writeFile(guardPath, networkGuardSource());
    const isDefaultNodeRunner = options.command.executable === process.execPath;
    const args = isDefaultNodeRunner
      ? [...nodePermissionArgs(executionRoot), "--import", guardPath, ...options.command.args]
      : options.command.args;
    const { stdout, stderr } = await execFileAsync(options.command.executable, args, {
      cwd: executionRoot,
      env: verificationEnvironment(),
      timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    return {
      verified: true,
      integrity: "unchanged",
      expectedHash,
      actualHash,
      exitCode: 0,
      testSummary: `${stdout}\n${stderr}`.trim(),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string; code?: number | string };
    return {
      verified: false,
      integrity: "unchanged",
      expectedHash,
      actualHash,
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      testSummary: `${failure.stdout ?? ""}\n${failure.stderr ?? failure.message}`.trim(),
      durationMs: Math.round(performance.now() - startedAt),
    };
  } finally {
    await rm(guardPath, { force: true });
  }
}

function verificationEnvironment(): NodeJS.ProcessEnv {
  const allowed = ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL"];
  return {
    ...Object.fromEntries(allowed.flatMap((key) => (process.env[key] ? [[key, process.env[key]]] : []))),
    CI: "1",
    NO_COLOR: "1",
    NODE_ENV: "test",
  };
}

function nodePermissionArgs(root: string) {
  if (process.allowedNodeEnvironmentFlags.has("--permission")) {
    return ["--permission", `--allow-fs-read=${root}`];
  }
  if (process.allowedNodeEnvironmentFlags.has("--experimental-permission")) {
    return ["--experimental-permission", `--allow-fs-read=${root}`];
  }
  return [];
}

function networkGuardSource() {
  return `
import { syncBuiltinESMExports } from "node:module";
import dgram from "node:dgram";
import dns from "node:dns";
import http from "node:http";
import http2 from "node:http2";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";

const denied = () => {
  throw new Error("Verification blocked network access.");
};

for (const key of ["fetch", "WebSocket", "EventSource"]) {
  Object.defineProperty(globalThis, key, { value: denied, configurable: true, writable: true });
}

for (const [module, names] of [
  [dgram, ["createSocket"]],
  [dns, ["lookup", "lookupService", "resolve", "resolve4", "resolve6", "resolveAny", "resolveCaa", "resolveCname", "resolveMx", "resolveNaptr", "resolveNs", "resolvePtr", "resolveSoa", "resolveSrv", "resolveTxt", "reverse"]],
  [http, ["get", "request"]],
  [http2, ["connect"]],
  [https, ["get", "request"]],
  [net, ["connect", "createConnection", "createServer"]],
  [tls, ["connect", "createServer"]],
]) {
  for (const name of names) {
    if (name in module) module[name] = denied;
  }
}

syncBuiltinESMExports();
`;
}
