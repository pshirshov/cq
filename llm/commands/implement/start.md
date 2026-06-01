---
description: Start an implement-flow run — resolve the target milestones (default: all open ones), validate their task DAG, then hand off to the /implement:advance loop.
argument-hint: [milestoneId ...]   # optional; omit to target every open milestone
allowed-tools: mcp__ledger__*, Agent, Write, Bash, Read, Grep, Glob
---

You are **bootstrapping an implement-flow run**. The user's target milestones
are:

> $ARGUMENTS

This command does the one-time **scope resolution** only, then hands off to the
`/implement:advance` loop. It owns NO execution logic of its own — the entire
pass (DAG-ready pickup, worktree dispatch, review, criticism loop, question
registration, merge-back) lives in `/implement:advance`, so that logic exists in
exactly ONE place (exactly as `/plan:start` does the goal bootstrap and hands the
round to `plan-advance`).

## Provenance (every ledger write)
On any `create_item` / `update_item`, pass `author` = your OWN model class
(derived from runtime identity, never hardcoded — Claude Opus 4.8 (1M) →
`"opus-4.8[1m]"`; Codex GPT-5.x → e.g. `"gpt-5.5"`) and `session` =
`$CLAUDE_CODE_SESSION_ID` (or the Codex equivalent; omit if unavailable).

## Steps

1. **Resolve the target milestone set.**
   - If `$ARGUMENTS` lists milestone ids → those are the targets. `fetch_milestone`
     each to VALIDATE it exists and is non-archived, non-terminal; abort with a
     clear message on any unknown/archived id.
   - If `$ARGUMENTS` is empty → target **ALL** open milestones: every
     non-archived, non-terminal milestone in the `milestones` ledger that has at
     least one non-terminal linked `tasks` item (`list_milestone_items` to check).
     Skip milestones whose tasks are all terminal (nothing to do).

2. **Resolve and sanity-check the task DAG.** For each target, collect its
   `tasks` and their `dependsOn` edges (and the milestones' own
   `dependsOn`/`blockedBy`). Confirm there is at least one task that is ready to
   start (no unsatisfied `dependsOn`, not `blocked`, no `open` question). If a
   target has tasks but NONE are ready (e.g. all are blocked on open questions),
   report that — the run can still proceed for the other targets.

3. **Report the resolved scope.** State the target milestone ids, the count of
   tasks per target, and the initial ready-set (the tasks the first pass will
   pick up). No scope marker item is created — the ledger task states ARE the
   durable scope; `/implement:advance` re-derives everything from them.

4. **Hand off to the advance loop.** Now execute the `/implement:advance` pass
   over the resolved target set — follow the full loop spec in
   `llm/commands/implement/advance.md` (READY-SET → dispatch workers → review →
   criticism loop → questions → success gate → merge-back, plus its session-log
   writing and provenance rules). Do NOT restate or duplicate that logic here;
   run it. Then produce `/implement:advance`'s end-of-pass report.

The run is resumable: after the user answers any registered questions, they
re-run **`/implement:advance`** (no need to re-run `/implement:start`).
