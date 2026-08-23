# Versionless Agent Guide

Before changing product behavior, read `CONTEXT.md` and the relevant spec in `.scratch/`.

Project-specific agent configuration lives in:

- `docs/agents/issue-tracker.md`
- `docs/agents/domain.md`
- `docs/agents/triage-labels.md`

## Commands

- `npm run typecheck` - validate TypeScript
- `npm test` - run behavior tests
- `npm run build` - create the production build
- `npm run check` - run all three gates

## Non-negotiable product rule

Never report a migration as verified unless the locked behavioral contract is unchanged and passes against the migrated repository.
