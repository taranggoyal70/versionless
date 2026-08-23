# Versionless MVP

Status: complete

## Problem

API providers publish one migration guide, then every customer repeats the same risky code change. Developers discover semantic breakage late and cannot easily prove that an AI-generated patch preserved the user flow.

## Product promise

Connect a Stripe integration, choose a target API release, and receive a customer-specific patch with behavioral proof. The demo migration replaces the removed `PaymentIntent.charges` expansion with a direct charge lookup while preserving receipt delivery.

## Primary user

A developer responsible for keeping a production Stripe integration current.

## Demo flow

1. The control room shows a repository on Stripe API `2022-08-01` and a target release `2022-11-15`.
2. A preflight finds the `PaymentIntent.charges` impact and demonstrates that the target response breaks receipt lookup.
3. The user starts a migration run.
4. Codex receives a constrained task against an isolated copy of the customer repository.
5. The service hashes the locked contract before Codex starts and verifies that hash in a clean proof workspace.
6. The migrated implementation passes the exact locked receipt-flow test.
7. The UI reveals the patch, verification evidence, and Greptile review handoff.

## Behavioral seams

- `analyzeRepository(root)` returns typed impacts without changing the repository.
- `verifyLockedContract(root, expectedHash)` fails if the locked test changed or its behavior fails.
- The migration event stream is an ordered public contract consumed by the UI.
- Runtime generation is behind a `MigrationAgent` interface, with Codex as the production implementation and a deterministic replay implementation for tests and stage demos.

## Acceptance criteria

- The old customer implementation fails against the target provider contract.
- A migration run cannot pass by editing the locked contract.
- A valid implementation patch reaches `verified` and exposes the integrity proof.
- The UI stays useful at mobile and desktop widths, is keyboard operable, and respects reduced motion.
- `npm run check` passes from a clean checkout.

## Deliberate non-goals

- Connecting to a real customer's private repository.
- Moving real money or requiring a Stripe secret key.
- Pretending a simulated sponsor response is a live external review.
- Generalizing to every API provider before the Stripe wedge works.
