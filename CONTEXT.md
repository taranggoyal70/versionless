# Versionless Domain Context

## Purpose

Versionless upgrades a customer's API integration and proves that the customer-visible behavior still works. The first provider is Stripe because payment integrations make breakage concrete and costly.

## Glossary

- **Provider release**: a new API contract published by an API company.
- **Customer repository**: the application code that consumes the provider API.
- **Impact**: a callsite whose behavior is incompatible with the provider release.
- **Migration run**: one attempt to detect impacts, generate a patch, and verify the customer repository.
- **Locked contract**: a behavioral test and fixture captured before migration. The migration agent must not change it.
- **Integrity proof**: the hash comparison proving the locked contract did not change.
- **Evidence bundle**: the impacts, agent activity, diff, verification result, and integrity proof produced by a migration run.
- **Verified**: the only successful terminal state. It requires an unchanged locked contract and a passing behavioral test.

## Invariants

1. Codex may edit the customer implementation but never the locked contract.
2. A compilation success is not a behavioral verification.
3. Every displayed result must come from a typed migration event.
4. Sponsor integrations must strengthen generation, isolation, review, memory, or proof.
