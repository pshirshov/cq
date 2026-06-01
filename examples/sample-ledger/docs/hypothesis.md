---
ledger: hypothesis
counters:
  milestone: 0
  item: 2
archives: []
---

# hypothesis

## M2

### H1 — open

- createdAt: 2026-06-01T00:08:33.797Z
- updatedAt: 2026-06-01T00:08:33.797Z
- headline: Lock contention degrades parallel writes
- description: Throughput drops sharply when several agents write the same ledger at once.
- rationale: two writers on the same ledger serialize on the lockfile

### H2 — uncertain

- createdAt: 2026-06-01T00:08:33.808Z
- updatedAt: 2026-06-01T00:08:33.808Z
- headline: minisearch splits ids on punctuation
- description: Ids containing punctuation may be tokenised into pieces, hurting recall.
- evidence: ["search for D12 returns nothing"]
