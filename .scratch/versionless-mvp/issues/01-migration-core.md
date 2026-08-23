# Build migration integrity core

Status: complete

Implement repository impact analysis, locked-contract hashing, behavioral verification, migration events, and a constrained migration-agent interface. Prove the invariants with behavior tests before adding the route.

## Comments

Implemented with passing behavior and adversarial tests. The locked provider and user flow are hashed together, the verifier command lives outside the writable repository, and out-of-scope edits are rejected.
