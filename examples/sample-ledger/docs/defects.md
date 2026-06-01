---
ledger: defects
counters:
  milestone: 0
  item: 3
archives: []
---

# defects

## M2

### D1 — open

- createdAt: 2026-06-01T00:08:33.762Z
- updatedAt: 2026-06-01T00:08:33.762Z
- headline: Parser drops a trailing newline on serialize
- description: Round-tripping a ledger removes the final newline, producing a noisy `git diff`. The fix belongs in **serializeLedger** — emit exactly one trailing `\n`.
- severity: minor

### D3 — resolved

- createdAt: 2026-06-01T00:08:33.785Z
- updatedAt: 2026-06-01T00:08:33.785Z
- headline: FTS ignores hyphenated ids
- description: Searching for an id like D-12 returned no results.
- severity: minor
- fix: tokenizer keeps id-shaped tokens whole

## M3

### D2 — wip

- createdAt: 2026-06-01T00:08:33.774Z
- updatedAt: 2026-06-01T00:08:33.774Z
- headline: Status filter resets on page reload
- description: The selected status filter is not persisted, so a reload shows all items again.
- severity: major
- rootCause: filter state not persisted to the URL
