# Issue tracker: Local Markdown

Issues and specs for this repository live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append under a `## Comments` heading

## Skill operations

- Publish a spec or issue by creating the corresponding markdown file under `.scratch/<feature-slug>/`.
- Fetch a ticket by reading the referenced path directly.
- For wayfinding, use `.scratch/<effort>/map.md` and numbered children in `.scratch/<effort>/issues/`.
