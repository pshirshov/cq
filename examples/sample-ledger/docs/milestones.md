---
ledger: milestones
counters:
  milestone: 0
  item: 5
archives: []
---

# milestones

## active

### M-AMBIENT — open

- createdAt: 2026-06-01T12:16:25.446Z
- updatedAt: 2026-06-01T12:16:25.446Z
- title: ambient

### M1 — open

- createdAt: 2026-06-01T12:16:25.488Z
- updatedAt: 2026-06-01T12:16:25.488Z
- title: Project Foundations

### M2 — open

- createdAt: 2026-06-01T12:16:25.497Z
- updatedAt: 2026-06-01T12:16:25.497Z
- title: Core Ledger Engine
- dependsOn: ["M1"]

### M3 — open

- createdAt: 2026-06-01T12:16:25.505Z
- updatedAt: 2026-06-01T12:16:25.505Z
- title: Web Console
- dependsOn: ["M2"]

### M4 — blocked

- createdAt: 2026-06-01T12:16:25.515Z
- updatedAt: 2026-06-01T12:16:25.522Z
- title: Public Launch
- blockedBy: ["M3"]
- dependsOn: ["M2"]
