# Versionless

**Let coding agents change your code. Make them prove they did not change the rules.**

Versionless runs OpenAI Codex inside an isolated copy of a real repository. Before Codex starts, Versionless hashes the tests, generated contracts, lockfile, and build configuration. Codex gets one task and a small list of files it may change. The result is accepted only when the original proof is byte-identical and passes again in a fresh clone.

## The demo

The live target is [Warrant](https://github.com/taranggoyal70/warrant), a real security product that binds an agent approval to the exact bytes of an action. Its audit records currently accept an unvalidated `approvedAt` value. Versionless adds a locked acceptance test that requires canonical UTC timestamps, then asks Codex to harden the gate.

Click **Repair with Codex** and Versionless will:

1. clone Warrant without touching the original checkout;
2. hash all tests, generated Codex protocol types, lockfiles, and TypeScript contracts;
3. reproduce four failing timestamp attack cases;
4. ask Codex to change only `src/gate.ts`;
5. reject any out-of-scope edit;
6. apply the patch to a second clean clone;
7. run 51 real Warrant tests across six files;
8. show the complete diff and matching SHA-256 fingerprints.

The **Replay verified run** button is an honest stage fallback. It replays the last Codex-authored patch with a short presentation delay.

## Why passing tests are not enough

If the same agent can edit the code and its tests, green checks are only a claim. Versionless separates the worker from the proof. The worker can change the allowed implementation. The verifier owns the locked contract and runs it again from clean state.

## Run locally

Requirements: Node.js 20.9+, an authenticated `codex` CLI on `PATH`, and a local Warrant checkout with dependencies installed. Set `VERSIONLESS_TARGET_REPO` if Warrant is not at `/Users/tarang/warrant`.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. The migration endpoint accepts same-origin localhost requests by default. For non-local hosts or direct API clients, set `VERSIONLESS_DEMO_TOKEN` and send the same value in the `x-versionless-demo-token` header.

## Verify the repository

```bash
npm run check
```

This runs strict TypeScript validation, behavioral and adversarial tests, and a production Next.js build.

## Trust boundary

- Codex runs in a workspace-write sandbox with a minimal environment.
- Only `src/gate.ts` may change in the Warrant run.
- Tests, generated protocol types, lockfiles, and TypeScript configuration are hashed together.
- Dependencies are physically copied into temporary workspaces. No symlink points back to the source repository.
- The final patch is applied to a second clean clone before verification.
- The service is single-flight, supports cancellation, and deletes each temporary workspace.

## Sponsor roles

- **OpenAI Codex** is both the primary builder and the live code-change runtime.
- **Greptile** is the independent review target after the repository is pushed and enabled. The current UI does not claim a live Greptile review.

Claude-Mem and Modal are not presented as active integrations because their local runtimes were unavailable during this build.

## Product direction

Warrant is the first real target, not a hard-coded boundary. A repository adapter defines a source path, verification command, locked paths, allowed paths, task, and acceptance contract. The same engine can run on another repository without changing the isolation or proof pipeline.
