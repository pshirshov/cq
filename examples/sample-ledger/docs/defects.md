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

- createdAt: 2026-05-31T23:10:46.151Z
- updatedAt: 2026-05-31T23:10:46.151Z
- headline: Parser drops a trailing newline on serialize
- severity: minor

### D3 — resolved

- createdAt: 2026-05-31T23:10:46.175Z
- updatedAt: 2026-05-31T23:10:46.175Z
- headline: FTS ignores hyphenated ids
- severity: minor
- fix: tokenizer keeps id-shaped tokens whole

## M3

### D2 — wip

- createdAt: 2026-05-31T23:10:46.162Z
- updatedAt: 2026-05-31T23:10:46.162Z
- headline: Status filter resets on page reload
- severity: major
- rootCause: filter state not persisted to the URL
