# Canonical ledger schemas — defects · tasks · hypothesis · questions

Design doc. Proposes four schemas + a common-field convention so the
@cq/ledger system can host the durable state of `review-loop`,
`research-loop`, `vsm-loop`, and `question-batch`.

Status legends in this doc are the new ledger statuses, **not** the
status-checkbox legends the old hand-written `tasks.md` / `defects.md`
use. The translation is in §6.

---

## 1. Common conventions

These cross-cutting fields appear on multiple ledgers. Defined here
once; per-ledger sections only flag whether they are required/optional.

### 1a. Source references — `sourceRefs: string[]`

Free-form list of `path[:line-range[,line-range,…]]` strings. Examples:

```yaml
sourceRefs:
  - packages/server/src/agent/bridge.ts:340-360
  - packages/web/src/chat/Header.tsx:45-55,80-95
  - packages/ledger/src/store/core.ts:188
```

No parsing or enforcement by the library. Convention only.

### 1b. Cross-ledger references — `ledgerRefs: id[]`, `blockedBy: id[]`, `dependsOn: id[]`

Three id[] fields with distinct semantics:

- **`blockedBy`** — strict precedence. The item cannot progress while a
  referenced item is non-terminal.
- **`dependsOn`** — soft dependency. The item references work that
  precedes it but does not strictly block it.
- **`ledgerRefs`** — catch-all "related to" link with no semantics.

**Cross-ledger format:** plain `<id>` for same-ledger refs, prefixed
`<ledger>:<id>` for cross-ledger. The library does **not** enforce
existence on these arbitrary id[] fields (same rule as the milestones
ledger's `blocked` / `depends` fields). Consumer-side semantics.

Examples:
```yaml
blockedBy: ["D7", "tasks:T12"]
dependsOn: ["milestones:M3"]
ledgerRefs: ["hypothesis:H4", "questions:Q2"]
```

### 1c. Tags — `tags: string[]`

Tag-style boolean-ish field. Conventional values (consumers may extend):

- `human-required` — needs explicit human action / approval; can't be
  closed by a subagent alone.
- `open-ended` — exploration-shaped work whose acceptance criterion
  cannot be a tight test/lint pass.
- `clarification-required` — blocked on a clarification (typically pair
  with a `questions:Q*` ref in `blockedBy`).

Single field for all three keeps the schema small (no `bool` field type
to add); extensible without further schema changes.

### 1d. Suggested model — `suggestedModel: string`

Picks the tier appropriate for the item. Allowed values:

- `brain` — Opus-class. Hard reasoning, deep refactors, novel design.
- `hands` — Sonnet-class. Implementation, mechanical refactors, tests.
- `ganglia` — Haiku-class. Bulk file edits, format conversions, lookups.

Free-form `string`; consumers map to concrete model ids from
`packages/shared/src/models.ts`. Optional — when absent the dispatcher
picks a default.

### 1e. Severity — `severity: string`

Allowed values: `major | minor | nit`. Soft constraint (string).

---

## 2. `defects` ledger

Source: review-loop's `./defects.md` ("structured entries, not
checklist lines"; severity `major|minor|nit`; durable audit trail).

```ts
{
  statusValues:    ["open", "wip", "blocked", "resolved", "abandoned"],
  terminalStatuses:["resolved", "abandoned"],
  fields: {
    headline:       { type: "string",  required: true  },  // the problem in one line
    description:    { type: "string",  required: false },  // observable symptom, repro
    rootCause:      { type: "string",  required: false },  // non-obvious cause
    suggestedFix:   { type: "string",  required: false },  // recommended approach
    fix:            { type: "string",  required: false },  // what was done (file:line)
    severity:       { type: "string",  required: true  },  // major | minor | nit (1e)
    sourceRefs:     { type: "string[]",required: false },  // 1a
    blockedBy:      { type: "id[]",    required: false },  // 1b
    dependsOn:      { type: "id[]",    required: false },  // 1b
    ledgerRefs:     { type: "id[]",    required: false },  // 1b
    tags:           { type: "string[]",required: false },  // 1c
    suggestedModel: { type: "string",  required: false },  // 1d
  }
}
```

**Item id prefix:** `D` (auto: D1, D2, …).
**Grouping:** items live under a `## M<n>` group resolved against the
milestones ledger. A defect found in PR-3 of milestone M3 ⇒ `D<n>` under
`## M3`. The PR-NN-DMM naming from review-loop becomes `M<n>` + `D<n>`.

---

## 3. `tasks` ledger

Source: review-loop's `./tasks.md` (status `[ ] planned · [~] in
progress · [x] done · [!] blocked`; one PR per task; rich Completed
entries; cross-cutting decisions).

```ts
{
  statusValues:    ["planned", "wip", "done", "blocked", "abandoned"],
  terminalStatuses:["done", "abandoned"],
  fields: {
    headline:       { type: "string",  required: true  },  // one-line scope
    description:    { type: "string",  required: false },  // detailed scope
    acceptance:     { type: "string",  required: false },  // verifiable success criterion
    planDoc:        { type: "string",  required: false },  // pointer to docs/drafts/...
    resultCommit:   { type: "string",  required: false },  // SHA when done
    completion:     { type: "string",  required: false },  // rich completed-entry body
    severity:       { type: "string",  required: false },  // major | minor | nit (1e); optional on tasks
    sourceRefs:     { type: "string[]",required: false },
    blockedBy:      { type: "id[]",    required: false },
    dependsOn:      { type: "id[]",    required: false },
    ledgerRefs:     { type: "id[]",    required: false },
    tags:           { type: "string[]",required: false },
    suggestedModel: { type: "string",  required: false },
  }
}
```

**Item id prefix:** `T` (T1, T2, …).
**Grouping:** items live under `## M<n>` per milestones ledger.

**Open design point — "Cross-cutting architectural notes (locked)".**
Review-loop's tasks.md has a top-level section for locked decisions that
span PRs. Two ways to host them:
- (A) Embed in tasks ledger via a synthetic milestone group `## M-ARCH`
  with status `done` after the decision is locked.
- (B) **(recommended)** New `decisions` ledger; see §7. Cleaner
  separation; queryable.

---

## 4. `hypothesis` ledger

Source: research-loop's `./docs/research/research-<name>.md`. Hypothesis
tree (`H1`, `H1.1`, `H1.1.2`), states `confirmed | uncertain | wrong`,
evidence states `correct | incorrect | unverified`, depth-first
traversal.

```ts
{
  statusValues:    ["open", "uncertain", "confirmed", "wrong"],
  terminalStatuses:["confirmed", "wrong"],
  fields: {
    headline:         { type: "string",  required: true  },  // stated as a claim
    description:      { type: "string",  required: false },  // prose: what would have to be true
    rationale:        { type: "string",  required: false },  // adjudication ("rests on E1.✓, E3.✓")
    parentHypothesis: { type: "id",      required: false },  // for the tree (see Open design below)
    evidence:         { type: "string[]",required: false },  // structured strings (see §4a)
    sourceRefs:       { type: "string[]",required: false },
    blockedBy:        { type: "id[]",    required: false },  // other hypotheses
    dependsOn:        { type: "id[]",    required: false },
    ledgerRefs:       { type: "id[]",    required: false },
    tags:             { type: "string[]",required: false },
    suggestedModel:   { type: "string",  required: false },
  }
}
```

**Item id prefix:** `H` (H1, H2, H3, … flat).

### 4a. Evidence — embedded vs separate ledger

**Embedded** (recommended for v1): each evidence string follows a
convention:

```
E1 [correct]   Sender.cs:341-370 "while (!token.IsCancellationRequested)…" — loop exits without deleting
E2 [incorrect] Sender.cs:30      claimed "sleep(5000)" — actual line is `private bool StartEventsSenderCondition() {…}`
E3 [unverified] EventsQueueRepo.cs:58 "Peek query has no WHERE filter" — pending validation round 2
```

The library doesn't parse the prefix; readers (research-loop subagents)
do. Trade-off: not individually queryable; survives via prose.

**Separate `evidence` ledger** (future option): 5th canonical ledger
with per-evidence items (`E1`, `E2`, …) referenced from hypothesis via
`ledgerRefs`. Stronger queryability, schema growth.

**Recommendation:** start embedded; promote to separate ledger if
research-loop subagents start needing to bulk-update evidence verdicts.

### 4b. Hypothesis tree — flat ids + parent pointers

Use flat `H<n>` ids; reconstruct the tree from `parentHypothesis`.
Don't allow dotted ids like `H1.1` (clashes with the `SAFE_ID_RE`
defense added in D-LED-01, and forces parser changes). Readers can
render `H1.2.1` for display purposes; the storage is flat.

---

## 5. `questions` ledger

Source: `question-batch` skill (Q1, Q2, …; `Answer:` line; suggestions
with `(recommended)`; `~~Q3~~ withdrawn` convention).

```ts
{
  statusValues:    ["open", "answered", "withdrawn"],
  terminalStatuses:["answered", "withdrawn"],
  fields: {
    question:       { type: "string",  required: true  },  // the question text
    context:        { type: "string",  required: false },  // why we're asking
    suggestions:    { type: "string[]",required: false },  // option labels; "(recommended)" inline
    recommendation: { type: "string",  required: false },  // recommended option, if any
    answer:         { type: "string",  required: false },  // filled when status=answered
    sourceRefs:     { type: "string[]",required: false },
    blockedBy:      { type: "id[]",    required: false },
    dependsOn:      { type: "id[]",    required: false },
    ledgerRefs:     { type: "id[]",    required: false },  // items this question blocks
    tags:           { type: "string[]",required: false },
    suggestedModel: { type: "string",  required: false },  // for the answerer, not the asker
  }
}
```

**Item id prefix:** `Q` (Q1, Q2, …).
**Grouping:** questions usually belong to a planning milestone — file
under that `## M<n>`. Questions raised outside any milestone go under
`## M-AMBIENT` (§7 Q-CANL-6).

---

## 5b. `decisions` ledger (new — per Q-CANL-1)

Locked architectural decisions that span PRs. Source: the "Cross-cutting
architectural notes (locked)" section of review-loop's tasks.md.

```ts
{
  statusValues:    ["proposed", "locked", "superseded"],
  terminalStatuses:["locked", "superseded"],
  fields: {
    headline:       { type: "string",  required: true  },  // the decision, stated
    rationale:      { type: "string",  required: false },  // why
    alternatives:   { type: "string",  required: false },  // what else was considered + why rejected
    supersedes:     { type: "id[]",    required: false },  // prior decisions overridden
    landsIn:        { type: "id[]",    required: false },  // tasks where this is enforced
    sourceRefs:     { type: "string[]",required: false },
    blockedBy:      { type: "id[]",    required: false },
    dependsOn:      { type: "id[]",    required: false },
    ledgerRefs:     { type: "id[]",    required: false },
    tags:           { type: "string[]",required: false },
    suggestedModel: { type: "string",  required: false },
  }
}
```

**Item id prefix:** `K` (for "kontract" — `K1`, `K2`, …; avoids the
already-taken `D` for defects).
**Grouping:** under the milestone where the decision was made.
**Lifecycle:** `proposed` (drafted), `locked` (decided, immutable in
spirit; updates only via `supersedes`), `superseded` (overridden by a
later decision named in another item's `supersedes` field).

---

## 6. Status translation (old → new)

| review-loop checkbox | new status |
|---|---|
| `[ ] planned`         | `planned`   (tasks) / `open` (defects) |
| `[~] in progress`     | `wip`                                  |
| `[x] done` / resolved | `done`      (tasks) / `resolved` (defects) |
| `[!] blocked`         | `blocked`                              |
| `[x] resolved (deferred …)` | `abandoned` with `flags: [open-ended]` and `description: <deferral rationale>` |

| research-loop state | new status |
|---|---|
| `confirmed` | `confirmed` |
| `uncertain` | `uncertain` |
| `wrong`     | `wrong`     |
| (initial)   | `open`      |

| question-batch | new status |
|---|---|
| (initial)             | `open`     |
| filled `Answer:` line | `answered` |
| `~~Q3~~ withdrawn`    | `withdrawn`|

---

## 7. Resolved design points

### Q-CANL-1: Add a `decisions` ledger?
For review-loop's "Cross-cutting architectural notes (locked)" section.
Recommended yes — fields `{ decision: string-required, rationale: string-optional, supersedes: id[]-optional, landsIn: id[]-optional (tasks refs) }`. Statuses `proposed | locked | superseded`. Item id prefix `K` (for "kontract") or `DEC`.

Answer: yes

### Q-CANL-2: `bool` field type vs `flags: string[]` for human-required / open-ended / clarification-required?
Recommended `flags: string[]` (no schema-type change, extensible).
Alternative: add `bool` field type to @cq/ledger (small change to types.ts + parser + serializer).

Answer: call it "tags" I think

### Q-CANL-3: Rename milestones-ledger `blocked` / `depends` to `blockedBy` / `dependsOn` for consistency with the four canonical ledgers?
Tiny breaking change. Affects msunify cycle's `MILESTONES_SCHEMA` + 1 test fixture. Recommended yes.

Answer: yes

### Q-CANL-4: Cross-ledger id format — `<ledger>:<id>` prefix or bare?
Recommended `<ledger>:<id>` for cross-ledger; bare for same-ledger. The library doesn't enforce; convention only. Alternative: never use prefixes and require consumers to check every ledger when resolving.

Answer: yes, that's fine

### Q-CANL-5: Evidence — embedded strings (v1) or separate `evidence` ledger?
Recommended embedded for v1, promote later if needed.

Answer: embedded

### Q-CANL-6: Synthetic `## M-AMBIENT` group for items without a milestone (questions raised outside any milestone; defects found before milestone planning), or require every item to belong to a real milestone?
Recommended synthetic group (bootstrap-style — created on first need; cannot be archived). Without it, the agent has to create a placeholder milestone before filing any item.

Answer: why not

### Q-CANL-7: Severity on tasks?
Defects definitely need `severity`. Tasks could too (`major` = milestone-critical, `nit` = nice-to-have). Recommended optional on tasks.

Answer: yes, why not major|minor|nit

### Q-CANL-8: Stable per-ledger ID prefix override?
Today the ledger's first character determines the item-id prefix (`defects` → `D`, `tasks` → `T`). For ledgers whose first char is taken (e.g. a future `documentation` ledger collides with `defects` for `D`), an explicit `idPrefix` schema field would disambiguate. Recommended yes — add an optional `idPrefix: string` to `LedgerSchema`, defaulting to the first uppercase letter of the ledger name.

Answer: yes, add prefix. Also, important: item IDs must be unique across ledgers! That should be enforced by the library

---

## 8. Bootstrap & migration

Same approach as the msunify cycle:

- All five new ledgers are **bootstrapped** alongside the existing
  `milestones` ledger — hardcoded constants in
  `packages/ledger/src/constants.ts`:
  ```ts
  export const MILESTONES_LEDGER = "milestones" as const;  // pre-existing
  export const DEFECTS_LEDGER    = "defects"    as const;  // new
  export const TASKS_LEDGER      = "tasks"      as const;  // new
  export const HYPOTHESIS_LEDGER = "hypothesis" as const;  // new
  export const QUESTIONS_LEDGER  = "questions"  as const;  // new
  export const DECISIONS_LEDGER  = "decisions"  as const;  // new (Q-CANL-1)
  ```
  Each gets a paired `<LEDGER>_SCHEMA` constant carrying its canonical
  `LedgerSchema` (statusValues, terminalStatuses, fields, idPrefix).
- On `init()`, the library provisions every bootstrapped ledger from its
  canonical schema if `docs/<ledger>.md` is missing; refuses to start if
  any has been mutated to a divergent schema on disk (same guard as
  msunify). The provisioning is idempotent — repeated `init()` is a no-op
  once files exist.
- **No data migration from hand-written `tasks.md` / `defects.md`** —
  those are outside the @cq/ledger system; they coexist with the
  managed ledgers, which live at `docs/<ledger>.md`.

### 8a. Per-ledger `idPrefix` + global item-id uniqueness (Q-CANL-8)

- `LedgerSchema` gains an optional `idPrefix: string`. When absent it
  defaults to the first uppercase letter of the ledger name (`defects`
  → `D`, `tasks` → `T`, …). Canonical prefixes:
  - `milestones` → `M`
  - `defects`    → `D`
  - `tasks`      → `T`
  - `hypothesis` → `H`
  - `questions`  → `Q`
  - `decisions`  → `K`
- **Item IDs are globally unique across all ledgers** — the library
  enforces this via prefix uniqueness:
  - `create_ledger(name, schema)` refuses if `schema.idPrefix` collides
    with any existing ledger's prefix; surfaced as
    `DuplicatePrefixError`.
  - Caller-supplied item IDs must begin with the ledger's `idPrefix`
    followed by digits (`^${idPrefix}\d+$`); the library refuses
    cross-prefix supply (e.g. you cannot `create_item('tasks', …, id:
    'D5')`).
  - Auto-allocated IDs already follow this rule (the existing counter
    code prepends the prefix).
- The milestones ledger's bootstrap is updated to declare `idPrefix:
  "M"` explicitly, even though the default would already give `M`.

### 8b. Synthetic `M-AMBIENT` bootstrap milestone (Q-CANL-6)

The library bootstraps an item with id `M-AMBIENT` into the milestones
ledger on `init()` if missing, with `title: "ambient"` and `status:
open`. Other ledgers may reference it as `## M-AMBIENT` for items not
tied to any planned milestone. `archive_milestone("M-AMBIENT")` is
refused. `update_milestone("M-AMBIENT", {status: anything-terminal})`
is refused.

The id `M-AMBIENT` is the one exception to the `^M\d+$` rule for
auto-allocated milestone ids; it must be allowed in caller-supplied
form on milestones-ledger create.

### 8c. Rename milestones-ledger fields (Q-CANL-3)

The msunify cycle's `MILESTONES_SCHEMA` currently declares `blocked` and
`depends`. Rename to `blockedBy` and `dependsOn` for consistency with
all canonical ledgers. Update fixtures + tests in the same cycle.

### 8d. Milestones-ledger group format

The msunify cycle bootstrapped a synthetic `## M0 — active` group as
the depth-2 container holding every milestone item. `M0` is not a
milestone — it's purely a structural placeholder, invisible to the tool
surface (no `enumerate_*` ever returns it). The ID-shaped name is
misleading and the source of repeated "what is M0?" questions.

Drop the ID-shaped label. Rename to `## active`:

```markdown
# milestones

## active

### M-AMBIENT — open
- title: ambient
- …

### M11 — done
- title: …
- …
```

Parser/serializer change: in the milestones ledger ONLY, the depth-2
header is the literal string `active` (no em-dash, no id form).
Validation rules:

- Exactly one depth-2 group is allowed and its header text must be
  `active` after trim; reject otherwise.
- In every other ledger, depth-2 group headers continue to parse as
  `## <milestone-id>` (id alone, no em-dash, must resolve in the
  milestones ledger).

This is a small, contained special case scoped to the
`MILESTONES_LEDGER`. It removes the M0/M-AMBIENT visual collision and
matches what a reader expects to see when opening `docs/milestones.md`.

The hand-written repo-root `tasks.md` / `defects.md` are NOT migrated
in this work — they keep their current review-loop format. The new
ledgers ARE the canonical persistence the four skills will move to in
a follow-up cycle (skill rewrites).

---

## 9. End-to-end example — review-loop session

Sketch of what's on disk after one outer-loop turn:

```
docs/
├── milestones.md          # ## active group — currently holds M5 "outer-13: gear popup v2"
├── tasks.md               # T19 (wip) "Move SettingsPopup persistence to URL"
├── defects.md             # D8 (open, major) "Popup loses focus on Esc when nested"
├── hypothesis.md          # — (none — pure build cycle, no investigation)
├── questions.md           # Q4 (open) "Should localStorage migrate on first load?"
└── archive/
    ├── milestones/M2.md   # M2 archived earlier
    ├── tasks/M2.md        # T entries under M2
    └── defects/M2.md      # D entries under M2
```

`T19.blockedBy = ["Q4"]`; flipping Q4 to `answered` unblocks the task.
`D8.dependsOn = ["T19"]`; resolving D8 may require T19 first.
`fetch_milestone(M5)` returns the milestone metadata plus reference
counts `{ tasks: 1, defects: 1, questions: 1 }`.

---

## 10. Cycle scope

Once §7 is answered:

- One `/vsm-loop` cycle adds the five bootstrapped ledgers (Q-CANL-1
  resolved yes), the `idPrefix` schema field with global uniqueness
  enforcement (8a), the `M-AMBIENT` bootstrap milestone (8b), and the
  milestones-ledger field rename (8c).
- New MCP tools: probably none — `create_item` / `update_item` /
  `fetch_*` already cover everything. The canonical ledgers are pure
  schema additions plus the cross-cutting library guarantees.
- Follow-up cycles (not this one) port the four skills' instructions to
  use the ledgers via MCP tools rather than direct file writes.

---

## 11. Example ledgers (full files)

Realistic samples illustrating the on-disk format after a hypothetical
`outer-13` cycle has produced a typical mix of items. Frontmatter
counters, archive pointers, ISO timestamps, and ID prefixing all match
what the library would emit.

### 11a. `docs/milestones.md`

```markdown
---
ledger: milestones
counters:
  milestone: 0
  item: 13
archives:
  - id: M2
    path: ./archive/milestones/M2.md
    summary: M2 — chat MVP. Shipped PR-09..PR-15; 8 items, all done.
---

# milestones

## active

### M-AMBIENT — open

- createdAt: 2026-05-01T00:00:00.000Z
- updatedAt: 2026-05-01T00:00:00.000Z
- title: ambient
- description: |
  Reserved bootstrap milestone for items not tied to any planned
  milestone. Cannot be archived or moved to terminal status.

### M11 — done

- createdAt: 2026-05-26T10:14:00.000Z
- updatedAt: 2026-05-27T18:02:00.000Z
- title: Resume-from-history rework
- description: |
  Haiku-generated session titles, History-tab resume column, drop the
  ResumePicker dialog, suppress zero token/cost cells for subagents.

### M12 — done

- createdAt: 2026-05-27T20:00:00.000Z
- updatedAt: 2026-05-28T08:30:00.000Z
- title: Codex SDK + gear popup
- description: |
  Second backend, BackendBridge facade, model dropdown as platform
  router, gear icon for settings, reasoning effort.
- dependsOn: ["M11"]

### M13 — open

- createdAt: 2026-05-28T19:30:00.000Z
- updatedAt: 2026-05-28T21:00:00.000Z
- title: Canonical ledger schemas
- description: |
  Add defects/tasks/hypothesis/questions/decisions ledgers, idPrefix
  uniqueness, M-AMBIENT bootstrap, milestones field rename.
- blockedBy: ["Q5"]
- dependsOn: ["M12"]
```

### 11b. `docs/defects.md`

```markdown
---
ledger: defects
counters:
  milestone: 0
  item: 9
archives:
  - id: M2
    path: ./archive/defects/M2.md
    summary: M2 defects (6 resolved). Archived alongside milestones#M2.
---

# defects

## M11

### D7 — resolved

- createdAt: 2026-05-26T17:42:00.000Z
- updatedAt: 2026-05-27T09:15:00.000Z
- headline: Resume button visible on currently-active session row
- severity: minor
- sourceRefs: ["packages/web/src/history/List.tsx:108-126"]
- description: |
  The Resume column rendered the button on every finished main row,
  including the row whose session is the one currently loaded in the
  Chat tab — clicking it short-circuited and re-emitted chat.start.
- rootCause: Visibility predicate missed an `=== activeSessionId` check.
- fix: |
  Added `row.id !== activeSessionId` to the predicate at List.tsx:118.
  Test packages/web/test/history-list.test.ts covers the case.
- ledgerRefs: ["tasks:T19"]
- suggestedModel: hands

## M12

### D8 — open

- createdAt: 2026-05-28T11:08:00.000Z
- updatedAt: 2026-05-28T15:42:00.000Z
- headline: Popup loses focus on Esc when a nested select is open
- severity: minor
- sourceRefs:
  - packages/web/src/chat/SettingsPopup.tsx:54-89
  - packages/web/src/chat/SettingsPopup.module.css:1-22
- description: |
  Pressing Esc while a select dropdown inside the popup is expanded
  closes both the dropdown AND the popup, instead of just the dropdown.
- suggestedFix: |
  Stop Esc propagation when the focused element is a child select with
  an open menu; only close the popup when Esc fires on the popup root.
- blockedBy: ["Q4"]
- ledgerRefs: ["hypothesis:H3"]
- tags: ["clarification-required"]
- suggestedModel: hands

### D9 — wip

- createdAt: 2026-05-28T13:20:00.000Z
- updatedAt: 2026-05-28T19:05:00.000Z
- headline: Codex session crashes when ~/.codex/auth.json is symlinked
- severity: major
- sourceRefs:
  - packages/server/src/agent/codexBridge.ts:260-272
  - packages/e2e/globalSetup.ts:42-78
- description: |
  defaultDetectCodexAuth uses fs.statSync().isFile() which follows
  symlinks but rejects them when the target is missing — observed when
  CODEX_HOME points at a stale link.
- rootCause: statSync follows but doesn't probe target reachability.
- suggestedFix: |
  Use fs.statSync(authPath, {throwIfNoEntry: false})?.isFile() and add
  lstatSync fallback when the symlink is broken; surface a clearer
  error.
- dependsOn: ["T18"]
- suggestedModel: brain

## M-AMBIENT

### D10 — open

- createdAt: 2026-05-28T16:00:00.000Z
- updatedAt: 2026-05-28T16:00:00.000Z
- headline: Header gear icon has no aria-label
- severity: nit
- sourceRefs: ["packages/web/src/chat/Header.tsx:124"]
- description: |
  Screen-reader announces "button" with no name. Discovered during a
  routine a11y sweep; not tied to a planned milestone.
- suggestedFix: Add aria-label="Settings".
- tags: ["open-ended"]
- suggestedModel: ganglia
```

### 11c. `docs/tasks.md`

```markdown
---
ledger: tasks
counters:
  milestone: 0
  item: 21
archives:
  - id: M11
    path: ./archive/tasks/M11.md
    summary: M11 — resume rework. 5 PRs done.
---

# tasks

## M12

### T18 — done

- createdAt: 2026-05-27T20:14:00.000Z
- updatedAt: 2026-05-28T09:32:00.000Z
- headline: Wire @openai/codex-sdk into CodexBridge
- description: |
  Build CodexBridge mirroring ClaudeBridge's session lifecycle, with
  ThreadOptions + per-session config.mcp_servers.cq override.
- acceptance: |
  - codexBridge.test.ts asserts the spawn options shape.
  - codex-roundtrip.spec.ts passes against real codex auth.
  - bun run check exits 0.
- planDoc: docs/drafts/20260527-2330-codex-plan.md
- resultCommit: 8328355
- completion: |
  Shipped 2026-05-28. Real codex CLI spawns; auth detected via
  ~/.codex/auth.json; effort + approvalPolicy threaded end-to-end.
  ESM-only codex-sdk required switching from require() to dynamic
  import() (latent regression unmasked, fixed in same commit).
- severity: major
- sourceRefs: ["packages/server/src/agent/codexBridge.ts:1-626"]
- suggestedModel: brain

### T19 — wip

- createdAt: 2026-05-28T11:00:00.000Z
- updatedAt: 2026-05-28T19:48:00.000Z
- headline: Move SettingsPopup persistence to URL hash
- description: |
  Currently localStorage; URL hash would survive incognito tabs and
  let users share a pre-configured chat link.
- acceptance: |
  - On gear-popup change, history.replaceState updates #s=<encoded>.
  - On load, hash parses back to the same settings (round-trip test).
  - localStorage stays as a fallback when hash is absent.
- blockedBy: ["Q4"]
- planDoc: docs/drafts/20260528-2129-settings-url-plan.md
- severity: minor
- sourceRefs: ["packages/web/src/chat/SettingsPopup.tsx:1-220"]
- tags: ["clarification-required"]
- suggestedModel: hands

## M13

### T20 — planned

- createdAt: 2026-05-28T20:15:00.000Z
- updatedAt: 2026-05-28T20:15:00.000Z
- headline: Add idPrefix + global item-id uniqueness to @cq/ledger
- description: |
  Optional `idPrefix` in LedgerSchema; default = first uppercase letter
  of the ledger name. create_ledger refuses prefix collisions.
  Caller-supplied item ids must match `^${idPrefix}\d+$`.
- acceptance: |
  - New unit tests for prefix collision, supplied-id prefix mismatch,
    and the M-AMBIENT exception.
  - bun run check exits 0; e2e 20/0/0 unchanged.
- planDoc: docs/drafts/20260528-2129-canonical-ledger-schemas.md
- dependsOn: ["T21"]
- severity: major
- suggestedModel: brain

### T21 — planned

- createdAt: 2026-05-28T20:16:00.000Z
- updatedAt: 2026-05-28T20:16:00.000Z
- headline: Rename milestones-ledger blocked/depends → blockedBy/dependsOn
- description: |
  Update MILESTONES_SCHEMA, fixtures, and parser test.
- acceptance: bun run check exits 0.
- severity: nit
- suggestedModel: ganglia
```

### 11d. `docs/hypothesis.md`

```markdown
---
ledger: hypothesis
counters:
  milestone: 0
  item: 5
archives: []
---

# hypothesis

## M12

### H3 — uncertain

- createdAt: 2026-05-28T14:01:00.000Z
- updatedAt: 2026-05-28T19:20:00.000Z
- headline: Codex SDK blocks in-process MCP injection by API design, not version
- description: |
  Investigating whether the ThreadOptions / CodexOptions surface in
  @openai/codex-sdk@0.134.0 deliberately omits an in-process MCP hook
  (architectural) vs. just-not-shipped-yet (version-bound).
- rationale: |
  Rests on E1.correct (type definitions enumerate every option, no
  mcpServers field) + E3.correct (codex CLI source uses config-file
  discovery exclusively). E2 refuted: a beta alpha-2 build does NOT
  add the field.
- evidence:
  - "E1 [correct]   node_modules/@openai/codex-sdk/dist/index.d.ts:239 — `ThreadOptions = { model, sandboxMode, workingDirectory, skipGitRepoCheck, modelReasoningEffort, networkAccessEnabled, webSearchMode, webSearchEnabled, approvalPolicy, additionalDirectories }` — no mcpServers, no callback."
  - "E2 [incorrect] subagent claimed `0.135.0-alpha.2` adds mcpServers; checked dist/index.d.ts at that tag, still absent. Citation refuted round 2."
  - "E3 [correct]   github.com/openai/codex/blob/main/codex-rs/src/mcp.rs (commit 9a4f7c) — MCP servers discovered exclusively from ~/.codex/config.toml. No SDK-side injection path."
  - "E4 [unverified] subagent claims a comment in PR #1245 suggests intentional design. Citation pending round 3."
- sourceRefs:
  - node_modules/@openai/codex-sdk/dist/index.d.ts:216-260
  - packages/server/src/agent/codexBridge.ts:1-180
- dependsOn: ["H1"]
- tags: ["open-ended"]
- suggestedModel: brain
```

### 11e. `docs/questions.md`

```markdown
---
ledger: questions
counters:
  milestone: 0
  item: 5
archives: []
---

# questions

## M11

### Q3 — answered

- createdAt: 2026-05-26T20:14:00.000Z
- updatedAt: 2026-05-27T08:02:00.000Z
- question: When should the Haiku-generated session title fire?
- context: |
  Options: (a) after the first user message lands, (b) after the first
  `result{subtype:success}` of the turn, (c) on demand when the History
  tab is opened.
- suggestions:
  - "After first user message — title appears within seconds; fall back to first ~60 chars of prompt until it lands. (recommended.)"
  - "After first `result` — slightly better context but History shows '(no title)' longer."
  - "On demand when History tab opens — lazy; first-open latency hurts."
- recommendation: After first user message, with prompt-excerpt fallback.
- answer: After first `result{subtype:success}`. Better context outweighs the brief '(no title)' window; user confirmed in chat 2026-05-27.
- ledgerRefs: ["tasks:T14"]

## M12

### Q4 — open

- createdAt: 2026-05-28T11:10:00.000Z
- updatedAt: 2026-05-28T11:10:00.000Z
- question: Should SettingsPopup state migrate from localStorage when the user first loads a URL hash?
- context: |
  Today the popup reads from localStorage. If we add URL-hash
  persistence (T19), a user with both has a precedence puzzle.
- suggestions:
  - "URL hash wins; localStorage updated to match silently. (recommended — single canonical source.)"
  - "localStorage wins; URL hash ignored on conflict."
  - "Last-write-wins; track a timestamp in both."
- recommendation: URL hash wins; localStorage mirrored from hash on load.
- sourceRefs: ["packages/web/src/chat/SettingsPopup.tsx:140-170"]
- ledgerRefs: ["tasks:T19", "defects:D8"]
- tags: ["clarification-required"]

## M13

### Q5 — open

- createdAt: 2026-05-28T19:35:00.000Z
- updatedAt: 2026-05-28T19:35:00.000Z
- question: Add a `decisions` ledger for review-loop's locked architectural notes?
- context: |
  Review-loop currently parks these as checkbox lines in tasks.md.
  Promoting to its own ledger gives queryable lifecycle (proposed →
  locked → superseded) at the cost of one more bootstrapped ledger.
- suggestions:
  - "Yes — separate `decisions` ledger, idPrefix K. (recommended.)"
  - "No — embed in tasks ledger under synthetic ## M-ARCH group."
- recommendation: Separate `decisions` ledger.
- ledgerRefs: ["tasks:T20"]
```

### 11f. `docs/decisions.md`

```markdown
---
ledger: decisions
counters:
  milestone: 0
  item: 4
archives: []
---

# decisions

## M12

### K3 — locked

- createdAt: 2026-05-28T07:55:00.000Z
- updatedAt: 2026-05-28T08:12:00.000Z
- headline: CodexFactory returns Promise<Codex>, never a sync/async union
- rationale: |
  Per the user's outer-11 feedback: sync/async unions on
  lazily-initialised values force callers into instanceof Promise
  narrowing. Storing a settled Promise<T> resolves instantly for
  every subsequent await; no behavioural divergence.
- alternatives: |
  Union type `Codex | Promise<Codex>` rejected — would force every
  consumer to either await unconditionally (in which case the union
  type buys nothing) or branch on instanceof (junior-level).
- landsIn: ["T18"]
- sourceRefs: ["packages/server/src/agent/codexBridge.ts:94"]
- suggestedModel: brain

## M13

### K4 — locked

- createdAt: 2026-05-28T20:30:00.000Z
- updatedAt: 2026-05-28T20:30:00.000Z
- headline: Item IDs globally unique across all ledgers
- rationale: |
  Per Q-CANL-8: prefix uniqueness gives ID uniqueness for free since
  ids are `<prefix>\d+`. Enforce on create_ledger (refuse prefix
  collision) and on caller-supplied item ids (refuse cross-prefix).
- alternatives: |
  Per-ledger ID space rejected — cross-ledger refs (`ledgerRefs`,
  `blockedBy`) become unparseable without redundant ledger qualifiers
  on every reference.
- landsIn: ["T20"]
- supersedes: []
- ledgerRefs: ["hypothesis:H3"]
- suggestedModel: brain
```

---

