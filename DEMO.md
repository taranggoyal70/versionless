# Three-minute demo

## 0:00-0:25 - The problem

“Stripe writes one migration guide. Then thousands of developers repeat the same risky change. Versionless replaces the guide with a patch that proves itself.”

Show the old and target contract cards.

## 0:25-1:40 - The migration

Click **Repair with Codex**.

“Versionless found the exact broken callsite and locked the customer’s receipt flow before Codex started. Codex can change one implementation file. It cannot change the provider, the tests, or the test command.”

Let the flight recorder move. If the live run is slow or the room network is unstable, use **Replay verified run** and say it is the recorded fallback.

## 1:40-2:30 - The proof

Pause on the diff and green result.

“We do not trust the patch because AI says it is done. The same locked behavior now passes for two payments, including the empty-charge case. These two hashes match, so Codex did not rewrite the proof.”

## 2:30-3:00 - The product

“We started with Stripe because payment breakage is concrete. But every API provider has this problem. One release should create one job for the provider, not the same job for every customer.”

Close with: **“Stop shipping migration guides. Start shipping working customers.”**

## Q&A anchors

- **Why not Dependabot?** It updates versions. Versionless migrates business logic and proves user behavior.
- **How is the AI constrained?** One allowed file, minimal environment, sandboxed process, locked provider and tests, direct external verifier.
- **Who pays?** The API provider, because faster upgrades reduce support load and move customers off old contracts.
- **Where is Codex?** It built the product and performs the live customer-specific migration.
