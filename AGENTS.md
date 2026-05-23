# AG AliasRouter Documentation Hub (Master)

This is the master documentation file for contributors and operators.

## Document Index

- [FEATURE_DOC.md](FEATURE_DOC.md) — Feature inventory, implementation intent, and business justification.
- [UI_GUIDELINES.md](UI_GUIDELINES.md) — Feature-to-UI mapping and component-level guidance.
- [PROJECT_STRUCTURE.md](PROJECT_STRUCTURE.md) — Source layout, ownership boundaries, and architecture rules.
- [TIMELINE.md](TIMELINE.md) — Repository change timeline from git history with release notes.
- [PENDING_TASKS.md](PENDING_TASKS.md) — Work queue template and workflow states.

## How to Use This Set

- Start with `FEATURE_DOC.md` to understand *what exists and why*.
- Use `UI_GUIDELINES.md` before changing admin pages or shared UI components.
- Use `PROJECT_STRUCTURE.md` before adding services/routes/files.
- Use `TIMELINE.md` to correlate shipped behavior with commits.
- Use `PENDING_TASKS.md` to track future work in a consistent format.

## Scope and Grounding

These docs are based on current repository code under:
- `src/app/*` (Next.js routes/pages)
- `src/features/ui-pages.tsx` (admin UI screens)
- `src/components/*` (shared UI shell/primitives)
- `src/server/*` (routing, health, config, logs, runtime jobs)
- `tests/*` (unit + e2e coverage)
- git history on `main`

If implementation diverges from docs, update this documentation set in the same PR that changes behavior.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:
- ALWAYS read graphify-out/GRAPH_REPORT.md before reading any source files, running grep/glob searches, or answering codebase questions. The graph is your primary map of the codebase.
- IF graphify-out/wiki/index.md EXISTS, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
