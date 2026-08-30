# GitHub PR check

Versionless is an installable GitHub check for pull requests made by humans or coding agents. It answers a narrower question than a code review tool:

> Did this pull request change only allowed implementation, preserve the locked contract, and pass that contract against the exact proposed commit?

## Install

1. Copy [`examples/github-action/.versionless.json`](../examples/github-action/.versionless.json) to the root of the repository as `.versionless.json`.
2. Set `lockedPaths` to tests, fixtures, generated contracts, and lockfiles the pull request must preserve.
3. Set `allowedPaths` to implementation paths the pull request may change.
4. Set `verification` to the executable and arguments that prove the behavior.
5. Copy [`examples/github-action/versionless.yml`](../examples/github-action/versionless.yml) to `.github/workflows/versionless.yml`.

The starter workflow checks out the exact pull request head with full Git history. Both details are required. For a production repository, pin Versionless to a release tag or commit instead of a mutable branch after releases are available.

## Policy

```json
{
  "$schema": "https://raw.githubusercontent.com/taranggoyal70/versionless/main/docs/versionless.schema.json",
  "version": 1,
  "lockedPaths": ["test", "package-lock.json"],
  "allowedPaths": ["src"],
  "verification": {
    "executable": "npm",
    "args": ["test"]
  }
}
```

For a monorepo, add a repository-relative `workingDirectory`. The executable runs directly without a shell, so shell operators such as `&&`, pipes, redirects, and command substitution are not interpreted.

## Decision

A result is `verified` only when all of these are true:

- the checked-out commit exactly matches `head-sha`;
- the Git workspace has no staged, unstaged, or untracked files outside that commit;
- policy is loaded from the trusted base commit;
- every changed file is covered by `allowedPaths`;
- no locked path or locked Git object changed; and
- the verification process exits successfully.

Every other result is `rejected`. Stable reason codes identify the failed boundary:

| Code | Meaning |
| --- | --- |
| `CHECK_FAILED` | Inputs, configuration, or Git state prevented proof from being established. |
| `CHECKOUT_MISMATCH` | The runner is not testing the requested pull request head. |
| `WORKTREE_DIRTY` | The workspace contains files that differ from the requested head. |
| `LOCKED_PATH_MISSING` | A configured proof path does not exist in the base commit. |
| `LOCKED_PATH_CHANGED` | The pull request directly changed a locked path. |
| `OUT_OF_SCOPE_CHANGE` | The pull request changed a path outside the allowed scope. |
| `LOCKED_HASH_CHANGED` | The locked Git-object fingerprint differs between base and head. |
| `VERIFICATION_FAILED` | The original behavioral command did not pass. |

## Evidence and outputs

The action writes a readable GitHub job summary and uploads `versionless-evidence` as a JSON artifact, including when setup or verification is rejected. The JSON records commit SHAs, changed paths, policy, proof hashes, command output tail, truncation flags, duration, reason codes, and any stable setup error code. Standard output and error are each limited to their final 64 KiB.

Consumers can validate the artifact against the published [`versionless.pr_check.v1` JSON Schema](evidence.schema.json).

Rerunning the action safely replaces its prior untracked evidence file. A tracked file at the same path is never ignored by workspace-integrity checks.

Action outputs are:

- `status`: `verified` or `rejected`;
- `evidence-path`: path to the generated JSON file;
- `locked-hash`: SHA-256 fingerprint of the locked contract at the pull request head; and
- `reason-codes`: comma-separated rejection reasons, empty for a verified pull request.

Give the action step an `id` to use these outputs in later steps. Because rejection fails the action, downstream reporting should use `if: always()`:

```yaml
- name: Verify implementation against locked contract
  id: versionless
  uses: taranggoyal70/versionless@main
  with:
    base-sha: ${{ github.event.pull_request.base.sha }}
    head-sha: ${{ github.event.pull_request.head.sha }}

- name: Report Versionless decision
  if: always() && steps.versionless.outputs.status == 'rejected'
  env:
    VERSIONLESS_REASONS: ${{ steps.versionless.outputs.reason-codes }}
  run: echo "Versionless rejected the pull request:$VERSIONLESS_REASONS"
```

## Troubleshooting

- `CHECKOUT_MISMATCH`: check out `github.event.pull_request.head.sha` and keep `fetch-depth: 0`.
- `WORKTREE_DIRTY`: run generators before committing, or ignore generated dependency and build directories. A tracked mutation is always reported.
- `CHECK_FAILED`: confirm `.versionless.json` exists in the base commit, then read the job summary and evidence error code.
- `VERIFICATION_FAILED`: run the configured executable and argument list locally from `workingDirectory`.
- Non-JavaScript repository: replace the Node.js setup and `npm ci` starter steps with the repository's normal dependency installation. The Versionless action itself needs no package installation.

## Security boundary

Use this action only on `pull_request`. Do not move it to `pull_request_target`, and do not give the job secrets or write permissions. Pull request code and its verification command are untrusted. The starter workflow grants only `contents: read`.
