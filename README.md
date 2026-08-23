# Versionless

**Upgrade Stripe without reading a migration guide.**

Versionless finds where a provider release breaks a customer repository, gives OpenAI Codex one constrained repair, and replays the customer’s original behavior against the patch. A migration is only called verified when the locked contract is byte-identical and passes.

## The demo

The included Northstar Checkout fixture relies on `PaymentIntent.charges` from Stripe API `2022-08-01`. Stripe removed that field in `2022-11-15`, so the receipt flow fails under the target contract.

Click **Repair with Codex** and Versionless will:

1. locate the affected callsite;
2. hash the locked receipt flow and provider simulator;
3. reproduce the target-contract failure;
4. ask Codex to change only `src/receipt.mjs`;
5. reject any out-of-scope edit;
6. replay two receipt paths and assert the exact Stripe call arguments;
7. show the diff, test output, and matching integrity hashes.

The **Replay verified run** button is an honest stage fallback. It replays the last Codex-authored patch with a short presentation delay.

## Why this is not Dependabot

Dependabot changes a dependency version. Versionless changes customer business logic and proves that the same user behavior still works.

## Run locally

Requirements: Node.js 20.9+ and an authenticated `codex` CLI on `PATH`.

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
- Only `src/receipt.mjs` may change.
- The provider simulator and behavior tests live under `locked/` and are hashed together.
- The verifier invokes Node’s test runner directly, so repository scripts cannot replace the proof.
- The service is single-flight, supports cancellation, and deletes each temporary workspace.

## Sponsor roles

- **OpenAI Codex** is both the primary builder and the live migration runtime.
- **Stripe** supplies the real semantic API change used by the demo.
- **Greptile** is the independent review target after the repository is pushed and enabled. The current UI does not claim a live Greptile review.

Claude-Mem and Modal are not presented as active integrations because their local runtimes were unavailable during this build.

## Product direction

Stripe is the wedge, not the boundary. An API provider already knows what changed. Versionless turns one provider release into a different, behaviorally verified patch for every customer repository.
