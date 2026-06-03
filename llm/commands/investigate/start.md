---
description: Start an investigate-flow run — defect intake + bootstrap, then run the /investigate:advance pass inline.
argument-hint: <defect description | defectId>
allowed-tools: mcp__ledger__*, Agent, Write, Bash, Read, Grep, Glob
---

You are **bootstrapping an investigate-flow run**. The argument is:

> $ARGUMENTS

This command does the one-time **intake and bootstrap** only, then hands off to the
`/investigate:advance` pass inline. It owns NO research or loop logic of its own — the
entire pass (hypothesis formation, explorer dispatch, citation validation, adjudication,
handoff) lives in `/investigate:advance`, so that logic exists in exactly ONE place.

## No confirmation checkpoints — just run (hard rule)
This flow is **fully autonomous by default**. Do NOT pause to ask the user to confirm
scope or "should I proceed?". A confirmation checkpoint is wasted latency and is
forbidden. The ONLY legitimate way to surface a blocker is a `questions` ledger item —
never an inline "do you want me to…?" prompt.

## Provenance (every ledger write)
On any `create_item` / `update_item`, pass `author` = your OWN model class
(derived from runtime identity, never hardcoded — Claude Opus 4.8 (1M) →
`"opus-4.8[1m]"`; Codex GPT-5.x → e.g. `"gpt-5.5"`) and `session` =
`$CLAUDE_CODE_SESSION_ID` (or the Codex equivalent; omit if unavailable).

## Steps

### 1. Determine the input form

Inspect `$ARGUMENTS`:

- **Bare defect id** (matches `^D\d+$` or an existing `defects` ledger item) → go to
  **Resume path** (step 2b).
- **Anything else** (a description of a defect, a symptom, an error message) → go to
  **Intake path** (step 2a).

### 2a. Intake path — create a new defect

#### 2a-1. Duplicate check
`fts_search` the `defects` ledger with the key terms from `$ARGUMENTS`. If a
non-terminal defect already exists that matches the description, tell the user its id
and run **Resume path** (step 2b) against that id instead of creating a duplicate.

#### 2a-2. Infer severity
Derive a `severity` from the description:

| Signals in the description | Default severity |
|---|---|
| crash, data loss, security, blocking all users | `critical` |
| feature broken for most users, no workaround | `high` |
| degraded but workaround exists | `medium` |
| cosmetic, edge-case, minor | `low` |

If the description is genuinely ambiguous between two adjacent tiers, ask ONE
clarifying question (inline, one line) and wait for the answer before proceeding. Do
not ask if a reasonable default is clear from context — just apply it and note the
choice.

#### 2a-3. Derive a slug
From the description, form a short slug (≤ 5 words, kebab-case, no articles/stop-words).
Example: "nil pointer on empty fetch" → `nil-pointer-empty-fetch`.

#### 2a-4. Create the coordination milestone
```
create_milestone(title: "Investigate: <slug>")
```
Save the returned id as **M**.

#### 2a-5. Create the defect item
```
create_item("defects", M,
  status: "open",
  fields: {
    headline: "<concise restatement of the defect>",
    description: "$ARGUMENTS (verbatim, plus any clarification captured in 2a-2)",
    severity: "<derived or user-confirmed severity>",
  },
  author: <your model class>,
  session: <session id>,
)
```
Save the returned id as **D**.

Note the chosen severity and why (one line) in the report.

### 2b. Resume path — validate an existing defect

`fetch_item("defects", D)` where D is the id from `$ARGUMENTS`.

- If the item does not exist → abort with a clear error: "No defect `<D>` found in the
  ledger. Check the id and retry, or provide a defect description to start a new
  investigation."
- If the item's status is terminal (`resolved` / `wontfix` / `duplicate`) → abort:
  "Defect `<D>` is already terminal (status: `<status>`). Nothing to investigate. If
  you believe this was closed in error, reopen it first via the TUI/web."
- Otherwise (status `open` / `wip`) → save its milestone as **M** and proceed.

### 3. Hand off to the advance pass

Now execute the `/investigate:advance` pass for defect **D** — follow the full loop spec
in `llm/commands/investigate/advance.md` (READ state → FORM hypotheses → DISPATCH
explorers → VALIDATE citations → adjudicate → CONFIRMED handoff or NEEDS-USER-INPUT
park, plus its session-log writing and provenance rules). Do NOT restate or duplicate
that logic here; run it. Then produce `/investigate:advance`'s end-of-round report.

This command is the outermost wrapper for this invocation (the user ran
`/investigate:start`), so the inline `/investigate:advance` pass **SUPPRESSES
its own handoff write** (per investigate/advance.md's CHAINED section —
`/<flow>:start` is listed as a suppress-context), and **this command** writes
the ONE `handoffs` record at the stop. Use the field schema from
investigate/advance.md's §Handoff record, STANDALONE branch (do not restate the
mapping here).

The run is resumable: after the user answers any registered questions, they re-run
**`/investigate:advance D`** (no need to re-run `/investigate:start`).

---

## Report
After the advance pass completes, prepend a brief intake summary:
- **Defect:** `<D>` — `<headline>` (severity: `<severity>`, milestone: `<M>`)
- **Action:** created new defect (intake path) **or** resumed existing defect (resume path)
- Then the full `/investigate:advance` round report.
