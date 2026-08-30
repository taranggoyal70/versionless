# Versionless

**Let coding agents change your code. Make them prove they did not change the rules.**

Versionless is a proof layer for code written by humans or coding agents. Its installable GitHub Action locks the original tests and contracts, limits which implementation paths may change, and rejects a pull request unless the unchanged proof passes against the exact proposed commit.

The included Codex migration runtime applies the same model locally: before Codex starts, Versionless hashes the tests, generated contracts, lockfile, and build configuration. Codex gets one task and a small list of files it may change. The result is accepted only when the original proof is byte-identical and passes again in a fresh clone.

## Add Versionless to a repository

Copy the [starter policy](examples/github-action/.versionless.json) to `.versionless.json`, then set the locked contract, allowed implementation paths, and behavioral command for your repository.

Copy the [starter workflow](examples/github-action/versionless.yml) to `.github/workflows/versionless.yml`. It runs on every pull request with read-only permissions:

```yaml
- name: Check out the exact pull request head
  uses: actions/checkout@v4
  with:
    ref: ${{ github.event.pull_request.head.sha }}
    fetch-depth: 0

- name: Verify implementation against locked contract
  uses: taranggoyal70/versionless@main
  with:
    base-sha: ${{ github.event.pull_request.base.sha }}
    head-sha: ${{ github.event.pull_request.head.sha }}
```

The check posts a GitHub summary, fails closed on any broken boundary, and uploads a machine-readable evidence artifact even when rejected. See the [installation and security guide](docs/github-action.md) for the complete policy contract.

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

If the same agent can edit the code and its tests, green checks are only a claim. Versionless separates the worker from the proof. The worker can change the allowed implementation. Versionless loads policy from the trusted base commit, proves the locked Git objects did not change, and runs the original contract against the exact pull request head.

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

- GitHub policy is read from the pull request base commit, never from the proposed head.
- The PR check requires an exact head checkout, read-only permissions, and the `pull_request` event.
- Verification commands execute directly without a shell.
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

Warrant is the first real migration target, not a hard-coded boundary. The GitHub PR check is repository-independent today: each repository defines its verification command, locked paths, allowed paths, and optional monorepo working directory in `.versionless.json`.
