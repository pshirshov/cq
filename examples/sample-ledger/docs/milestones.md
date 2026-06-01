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

- createdAt: 2026-06-01T00:08:33.498Z
- updatedAt: 2026-06-01T00:08:33.498Z
- title: ambient

### M1 — open

- createdAt: 2026-06-01T00:08:33.583Z
- updatedAt: 2026-06-01T00:08:33.583Z
- title: Project Foundations

### M2 — open

- createdAt: 2026-06-01T00:08:33.594Z
- updatedAt: 2026-06-01T00:08:33.594Z
- title: Core Ledger Engine
- dependsOn: ["M1"]

### M3 — open

- createdAt: 2026-06-01T00:08:33.600Z
- updatedAt: 2026-06-01T00:08:33.600Z
- title: Web Console
- dependsOn: ["M2"]

### M4 — blocked

- createdAt: 2026-06-01T00:08:33.609Z
- updatedAt: 2026-06-01T00:08:33.628Z
- title: Public Launch
- blockedBy: ["M3"]
- dependsOn: ["M2"]
