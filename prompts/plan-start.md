---
description: Start a plan-flow goal — create the goal, file the first clarifying questions, and hand off to /plan:advance.
argument-hint: <goal description>
allowed-tools: mcp__ledger__create_milestone, mcp__ledger__create_item, mcp__ledger__update_item, mcp__ledger__fetch_ledger, mcp__ledger__fetch_item, mcp__ledger__fts_search, mcp__ledger__enumerate_ledgers, mcp__ledger__list_milestone_items, Read, Grep, Glob, WebSearch
---

You are starting a **plan-flow goal**. The user's goal is:

> $ARGUMENTS

This command runs in the main session. It does the one-time setup: it creates the
goal, files the FIRST batch of clarifying questions, and then stops. The
iterative work happens later under `/plan:advance <G>`.

## Provenance (every ledger write)
On every `create_item` / `update_item` / `create_milestone`, pass:
- `author` = your OWN model class, derived from your runtime identity — never a
  hardcoded literal. An Opus 4.8 (1M) run passes `"opus-4.8[1m]"`; a Codex
  GPT-5.x run passes its own class (e.g. `"gpt-5.5"`). Use the class of the
  model that is actually executing this command.
- `session` = the value of the `$CLAUDE_CODE_SESSION_ID` environment variable
  (Claude), or the Codex session-id equivalent. If unavailable, omit it.

## Before you start
Search the ledger so you don't duplicate an existing goal:
`fts_search` with `ledger: "goals"` over the goal's key terms. If a live goal
already covers this, report its id and stop instead of creating a new one.

## Steps

1. **Create the milestone.** `create_milestone(title: "Plan: <short goal>")` —
   keep the title to a short slug of the goal. Capture the returned id as **M**.
   This is the **coordination milestone M** — it groups the goal, its
   questions, its reviews, and the final approval decision. (The plan's WORK
   tasks live under separate work milestones that `/plan:advance` creates during
   the `planning` phase and records on the goal's `fields.milestones` — not
   under M.)

2. **Create the goal.** `create_item(ledger_id: "goals", milestone_id: M,
   status: "clarifying", fields: { title: "<short goal>", description: "<the
   full goal text, verbatim or lightly cleaned>" })`. Capture the returned id as
   **G**. (The `goals` schema requires both `title` and `description`.)

3. **File the FIRST batch of clarifying questions.** Think hard about what must
   be known before anyone can write a *fine-grained, testable* plan: scope
   boundaries, target package(s), acceptance criteria, constraints, unknowns the
   repo can't answer for itself. You MAY ground these by reading the repo
   (Read/Grep/Glob) and the web (WebSearch) read-only — but ask only what
   *genuinely blocks planning*. Do not ask what you can determine yourself.

   For each question, `create_item(ledger_id: "questions", milestone_id: M,
   status: "open", fields: { question: "<the question>", context: "<why it
   blocks planning / what you already know>", suggestions: ["<option a>",
   "<option b>"], recommendation: "<your default if the user doesn't care>",
   ledgerRefs: ["goals:<G>"] })`.
   - `question` is required. `context`, `suggestions` (string[]),
     `recommendation` are optional but strongly preferred — they let the user
     answer fast.
   - `ledgerRefs: ["goals:<G>"]` is the cross-ledger link binding the question
     to its goal. Substitute the real goal id for `<G>` (e.g. `["goals:G1"]`).
   - The server forbids the goal LEAVING `clarifying` while any linked question
     is still `open`, so these gate the next phase by construction.

4. **Report.** Tell the user:
   - the goal id **G** and milestone **M**;
   - the **N** questions you filed (list them briefly);
   - that they should answer the questions in the TUI or web client (set each to
     `answered` with a non-empty `answer`), then run **`/plan:advance G`** to
     continue.

Do not transition the goal yourself and do not emit any plan here — `/plan:advance`
owns every state transition after this point.
