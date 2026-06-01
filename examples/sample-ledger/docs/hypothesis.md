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

- createdAt: 2026-06-01T12:16:25.682Z
- updatedAt: 2026-06-01T12:16:25.682Z
- author: "opus-4.8[1m]"
- session: seed-20260601
- headline: Lock contention degrades parallel writes
- description: Throughput drops sharply when several agents write the same ledger at once.
- rationale: two writers on the same ledger serialize on the lockfile

### H2 — uncertain

- createdAt: 2026-06-01T12:16:25.693Z
- updatedAt: 2026-06-01T12:16:25.693Z
- author: "opus-4.8[1m]"
- session: seed-20260601
- headline: minisearch splits ids on punctuation
- description: Ids containing punctuation may be tokenised into pieces, hurting recall.
- evidence: ["search for D12 returns nothing"]
