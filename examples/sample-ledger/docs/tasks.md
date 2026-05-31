---
ledger: tasks
counters:
  milestone: 0
  item: 9
archives: []
---

# tasks

## M1

### T1 — done

- createdAt: 2026-05-31T23:10:46.043Z
- updatedAt: 2026-05-31T23:10:46.043Z
- headline: Bootstrap the repository
- acceptance: bun install + bun test green

### T2 — done

- createdAt: 2026-05-31T23:10:46.055Z
- updatedAt: 2026-05-31T23:10:46.055Z
- headline: Define the ledger data model

### T3 — wip

- createdAt: 2026-05-31T23:10:46.066Z
- updatedAt: 2026-05-31T23:10:46.066Z
- headline: Wire up CI
- tags: ["infra"]

## M2

### T4 — wip

- createdAt: 2026-05-31T23:10:46.077Z
- updatedAt: 2026-05-31T23:10:46.077Z
- headline: Implement the markdown parser
- description: frontmatter + grouped items round-trip

### T5 — planned

- createdAt: 2026-05-31T23:10:46.091Z
- updatedAt: 2026-05-31T23:10:46.091Z
- headline: Add the file-store mutex + lockfile

### T6 — planned

- createdAt: 2026-05-31T23:10:46.104Z
- updatedAt: 2026-05-31T23:10:46.104Z
- headline: Build the full-text search index
- dependsOn: ["T4"]

## M3

### T7 — planned

- createdAt: 2026-05-31T23:10:46.116Z
- updatedAt: 2026-05-31T23:10:46.116Z
- headline: Item table + detail panel

### T8 — blocked

- createdAt: 2026-05-31T23:10:46.127Z
- updatedAt: 2026-05-31T23:10:46.127Z
- headline: Milestone DAG layout
- blockedBy: ["T7"]

## M4

### T9 — planned

- createdAt: 2026-05-31T23:10:46.140Z
- updatedAt: 2026-05-31T23:10:46.140Z
- headline: Marketing landing page
