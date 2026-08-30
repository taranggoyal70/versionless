# Versionless GitHub PR Check

Status: active

## Problem

Coding agents can open pull requests quickly, but a green CI job does not prove that the agent left the definition of success unchanged. Teams need a check that fails closed when an agent edits the locked contract, changes files outside its allowed scope, or produces code that fails the original verification command.

## Product promise

Add one configuration file and one GitHub Actions workflow. Every pull request receives a Versionless check with a machine-readable evidence bundle. A pull request is reported as verified only when:

1. the configured locked paths have the same Git object hash at the base and head commits;
2. every changed path is inside the configured allowed or locked policy, and no locked path changed; and
3. the configured verification command exits successfully against the head commit.

## Public interface

Repositories commit `.versionless.json` with:

- `version`: configuration contract version, initially `1`;
- `lockedPaths`: tests, fixtures, lockfiles, or generated contracts the agent must not change;
- `allowedPaths`: implementation paths the agent may change;
- `verification`: an executable plus an argument array, invoked without a shell; and
- optional `workingDirectory`: a repository-relative directory for monorepos.

The composite Action requires the pull request base and head commit SHAs. It emits:

- `status`: `verified` or `rejected`;
- `evidence-path`: repository-relative path to the JSON evidence bundle; and
- `locked-hash`: the SHA-256 integrity fingerprint of the locked contract.

## Trust boundary

- The Action resolves policy from the base commit, not from the pull request head.
- Configuration paths must be repository-relative and cannot contain traversal segments.
- Verification executes without a shell.
- The Action never requires repository secrets and must be used with `pull_request`, never `pull_request_target`.
- A failed, missing, or ambiguous proof produces `rejected`, never `verified`.

## Acceptance criteria

- A valid implementation-only pull request with passing verification is `verified`.
- Editing any locked path is `rejected` before verification runs.
- Editing a path outside `allowedPaths` is `rejected`.
- A failing verification command is `rejected`.
- Evidence includes both commit SHAs, changed paths, locked hashes, command outcome, duration, and rejection reasons.
- The Action writes a readable GitHub job summary and uploads the evidence JSON even when rejected.
- The checker has integration tests against temporary real Git repositories.
- `npm run check` passes from a clean checkout.

## Deliberate non-goals

- Automatically editing or merging a pull request.
- Running with `pull_request_target` or privileged secrets.
- Claiming that a recorded replay is a new verification.
- Supporting multiple configuration versions before version `1` has users.
