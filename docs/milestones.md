---
ledger: milestones
counters:
  milestone: 0
  item: 5
archives:
  - id: M5
    path: ./archive/milestones/M5.md
    summary: "Dogfood complete: T24 driven to done through the real implement-flow loop (manual worktree (K4 Codex path) -> implement-worker created+committed the marker -> bun run check green in worktree (379 pass) -> implement-reviewer approved 0/0 -> ff merge-back into throwaway dogfood/base). Throwaway branches deleted; nothing landed on main. Two setup findings recorded as defects under goals:G1."
---

# milestones

## active

### M-AMBIENT — open

- createdAt: 2026-06-01T19:15:33.341Z
- updatedAt: 2026-06-01T19:15:33.341Z
- title: ambient

### M1 — open

- createdAt: 2026-06-01T19:24:22.101Z
- updatedAt: 2026-06-01T19:24:22.101Z
- title: "Plan: /implement:* command family"
- description: "Coordination milestone for the goal of building the /implement:* command family (start/advance) that executes the planned roadmap: DAG-ordered task pickup, per-task worktree + implementor subagent, reviewer subagent gate, autonomous criticism loop, and user-answered questions. Groups the goal, its clarifying questions, reviews, and final approval decision. Work tasks live under separate work milestones recorded on the goal's fields.milestones."

### M2 — open

- createdAt: 2026-06-01T19:32:10.732Z
- updatedAt: 2026-06-01T19:32:10.732Z
- title: TUI + web UI improvements
- description: "Frontend UX improvements to ledger-tui and ledger-web. Item 1: the ledgers list shows the per-ledger item count, right-aligned."

### M3 — open

- createdAt: 2026-06-01T19:52:45.676Z
- updatedAt: 2026-06-01T19:52:45.676Z
- title: "Build /implement:* command family"
- description: "Work milestone for goal G1: build the /implement:start + /implement:advance orchestration that executes a plan-flow roadmap (DAG-ordered task pickup, per-task worktree + implementor subagent, adversarial reviewer gate, autonomous criticism loop with ill-loop detection, question registration/resume, rebase-before-merge merge-back with auto conflict resolution). Cross-tool: Claude + Codex. Mirrors the plan-flow asset layout (llm/commands, llm/agents, link-prompts.ts, .codex/prompts)."

### M4 — open

- createdAt: 2026-06-01T20:03:03.096Z
- updatedAt: 2026-06-01T20:03:13.116Z
- title: Plan-flow maintenance and improvements
- description: "Maintenance and feature work on the existing /plan:* command family (distinct from the /implement:* build under M3): fix subagent MCP tool access so the planner/reviewer can reach the ledger regardless of server name; make /plan:advance operate over all unlocked goals when called without arguments. The cross-flow subagent session-log convention is tracked under M3 (T15) since it is needed by the implement build, but applies to these plan agents too."
