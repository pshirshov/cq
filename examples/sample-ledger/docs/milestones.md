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

- createdAt: 2026-05-31T23:10:45.948Z
- updatedAt: 2026-05-31T23:10:45.948Z
- title: ambient

### M1 — open

- createdAt: 2026-05-31T23:10:45.993Z
- updatedAt: 2026-05-31T23:10:45.993Z
- title: Project Foundations

### M2 — open

- createdAt: 2026-05-31T23:10:46.003Z
- updatedAt: 2026-05-31T23:10:46.003Z
- title: Core Ledger Engine
- dependsOn: ["M1"]

### M3 — open

- createdAt: 2026-05-31T23:10:46.011Z
- updatedAt: 2026-05-31T23:10:46.011Z
- title: Web Console
- dependsOn: ["M2"]

### M4 — blocked

- createdAt: 2026-05-31T23:10:46.019Z
- updatedAt: 2026-05-31T23:10:46.029Z
- title: Public Launch
- blockedBy: ["M3"]
- dependsOn: ["M2"]
