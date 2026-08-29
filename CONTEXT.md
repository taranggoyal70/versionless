# Versionless Domain Context

## Purpose

Versionless proves that a code change preserves the rules it was asked to satisfy. The first installable product is a GitHub pull request check for human and agent-authored code. The Codex migration runtime demonstrates the same proof model against Warrant.

## Glossary

- **Base commit**: the trusted pull request commit that owns policy and locked proof.
- **Head commit**: the exact proposed commit that Versionless verifies.
- **Allowed path**: an implementation path the pull request may change.
- **Locked contract**: tests, fixtures, generated contracts, or lockfiles the author must not change.
- **Integrity proof**: the hash comparison proving the locked contract did not change.
- **Evidence bundle**: the commits, changed paths, policy decision, verification result, and integrity proof produced by a check.
- **Verified**: the only successful terminal state. It requires an unchanged locked contract and a passing behavioral test.

## Invariants

1. A pull request may edit approved implementation paths but never the locked contract.
2. A compilation success is not a behavioral verification.
3. Policy comes from the base commit and verification runs against the exact head commit.
4. Sponsor integrations must strengthen generation, isolation, review, memory, or proof.
