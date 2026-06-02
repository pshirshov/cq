---
description: Add new scope to an EXISTING plan-flow goal — append the follow-up request, re-open the goal, and hand to the planner for a fresh clarifying round.
argument-hint: <goalId> <follow-up request>
allowed-tools: mcp__ledger__*, Agent, Write, Bash
---

You are adding a **follow-up** to an existing plan-flow goal. The first
whitespace-delimited token of the arguments is the goal id; the REST is the
follow-up request (free text):

> $ARGUMENTS

Use this when a goal's plan is already done (`planned`) — or its build is under
way (`building`) — and the user wants to add MORE scope to the SAME goal. Like
`/plan:start`, this command does the one-time **bootstrap** only — record the
request and re-open the goal — then hands off to the `plan-advance` planner for a
fresh clarifying round (clarify-first). It owns NO question or plan logic itself.

> **Follow-up scope vs a defect.** Use this for MORE greenfield scope on an
> existing goal. If the follow-up is really a **DEFECT report** — an existing
> fault to fix, not new capability — intake it on the `defects` ledger via
> **`/investigate:start <defect description>`** instead of folding it into this
> goal. Investigation confirms the root cause and seeds a *defect-seeded*
> plan-flow goal (linked `defects:<D>`) that `/plan:advance` turns into reviewed
> FIX TASKS — tasks remain the only executable unit; the defect stays a problem
> record. If the request plainly describes a fault to repair, point the user at
> `/investigate:start` rather than re-opening this goal.

## Provenance (every ledger write)
On every `update_item`, pass `author` = your OWN model class (derived from
runtime identity, never hardcoded — Claude Opus 4.8 (1M) → `"opus-4.8[1m]"`;
Codex GPT-5.x → e.g. `"gpt-5.5"`) and `session` = `$CLAUDE_CODE_SESSION_ID` (or
the Codex equivalent; omit if unavailable).

## Steps

1. **Parse + validate.** Split off the goal id **G** (first token); the
   remainder is the follow-up **request**. If the request is empty, stop and ask
   the user what to add. `fetch_item("goals", G)` — if G does not exist, report
   and stop.

2. **Phase gate.** Read `G`'s status (phase):
   - **`done` / `abandoned`** (terminal): a finished goal canNOT be re-opened —
     the goals state machine keeps terminal statuses outgoing-edge-free by
     design. STOP and tell the user to start a fresh goal for the new scope with
     `/plan:start` (it can reference G in its description). Do not mutate G.
   - **`clarifying`**: already taking input — skip the re-open in step 4, just
     append (step 3) and hand off (step 5).
   - **`planning` / `planned` / `building`**: proceed.

3. **Record the request on the goal.** Append it to the goal's `description`,
   preserving the existing text and history — add a section like:
   `\n\n## Follow-up (<short date or ordinal>)\n<the request verbatim>`.
   `update_item("goals", G, fields: { description: "<existing + appended>" })`.
   (Keep prior follow-up sections; never overwrite the original goal text.)

4. **Re-open the goal to `clarifying`** (clarify-first). Apply the FIRST matching
   path — the goals guard allows each hop:
   - `planned`  → `update_item("goals", G, status: "planning")`, then
     `update_item("goals", G, status: "clarifying")`.
   - `building` → `update_item("goals", G, status: "planning")`, then
     `update_item("goals", G, status: "clarifying")`.
   - `planning` → `update_item("goals", G, status: "clarifying")`.
   - `clarifying` → already there; do nothing here.
   (Re-open edges `planned→planning` and `building→planning` exist specifically
   for this command; `planning→clarifying` is the standard loop-back.)

5. **Hand off to the planner.** Spawn the `plan-advance` subagent — `Agent` tool,
   `subagent_type: "plan-advance"`, passing the goal id **G** in the prompt. With
   G now in `clarifying` and the new scope folded into its description, the
   planner files the next batch of clarifying questions (scoped to the follow-up)
   and returns `awaiting-answers`. Drive it exactly once here — there is nothing
   to review yet.

6. **Write the session log.** The `plan-advance` subagent ends its reply with a
   `### Session summary` section. Persist it: take `<agent-id>` from the `Agent`
   tool result, stamp `<timestamp>` via `Bash` (`date -u +%Y%m%d-%H%M%S`),
   `mkdir -p docs/logs`, and `Write` `docs/logs/<timestamp>-<agent-id>.md` with a
   short header (goal id, role: planner, returned status token) followed by the
   verbatim summary block.

7. **Report.** Tell the user: the goal id **G** and its new phase (`clarifying`);
   the questions the planner filed; and that they should answer them in the
   TUI/web, then run **`/plan:advance G`** to plan the added scope.

Do not file questions, emit a plan, or lock decisions yourself — the
`plan-advance` planner and `/plan:advance` own everything after the re-open.
