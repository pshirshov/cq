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

- createdAt: 2026-06-01T12:16:25.645Z
- updatedAt: 2026-06-01T12:16:25.645Z
- author: "opus-4.8[1m]"
- session: seed-20260601
- headline: Parser drops a trailing newline on serialize
- description: Round-tripping a ledger removes the final newline, producing a noisy `git diff`. The fix belongs in **serializeLedger** — emit exactly one trailing `\n`.
- severity: minor

### D3 — resolved

- createdAt: 2026-06-01T12:16:25.668Z
- updatedAt: 2026-06-01T12:16:25.668Z
- author: "opus-4.8[1m]"
- session: seed-20260601
- headline: FTS ignores hyphenated ids
- description: Searching for an id like D-12 returned no results.
- severity: minor
- fix: tokenizer keeps id-shaped tokens whole

## M3

### D2 — wip

- createdAt: 2026-06-01T12:16:25.657Z
- updatedAt: 2026-06-01T12:16:25.657Z
- author: "opus-4.8[1m]"
- session: seed-20260601
- headline: Status filter resets on page reload
- description: The selected status filter is not persisted, so a reload shows all items again.
- severity: major
- rootCause: filter state not persisted to the URL
