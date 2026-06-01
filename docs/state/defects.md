# ledger plan-flow — Defect Ledger

Adversarial-review findings for the plan-flow implementation. Append-only;
flip status, never delete. Grouped by PR.

Status: `[ ] open` · `[~] under fix` · `[x] resolved`

---

## PR-01

### [PR-01-D01] Pre-existing on-disk ledgers fail to boot with BootstrapViolationError after canonical schemas gain `transitions`
**Status:** [x] resolved
**Severity:** major
**Location:** packages/ledger/src/store/FsLedgerStore.ts:279 (`schemasEqual`), :957-977 (`transitionsEqual`); vs on-disk docs/ledgers.yaml (no `transitions:` blocks)
**Description:** Any `FsLedgerStore` whose `ledgers.yaml` was written before this change has `schema.transitions === undefined` for canonical ledgers. On init, `transitionsEqual(undefined, {...})` → false → `schemasEqual` false → `BootstrapViolationError`. Reproduced against a copy of the repo's live `docs/`: "existing milestones ledger has a different schema than its canonical bootstrap schema". No FS test caught it (all use fresh tmp dirs). The repo's own `.mcp.json`-wired ledger is exactly such a store.
**Root cause:** Canonical schemas changed in code (transitions added) while the on-disk bootstrap is stale; the divergence guard is strict and exact.
**Fix:** Added `scripts/regen-bootstrap.ts` (+ `regen-bootstrap` npm script) that rebuilds `docs/ledgers.yaml` from `CANONICAL_LEDGERS` via the store's own `serializeRegistry` (byte-compatible, idempotent); regenerated the file so all 7 canonical schemas carry their `transitions` maps. No compat/auto-migrate code added; divergence guard kept strict (correct). Regression test in `canonical-ledgers.test.ts` boots an `FsLedgerStore` against the regenerated registry and asserts success. NOTE: `docs/ledgers.yaml` is gitignored (local dogfood state); the durable artifact is the committed regen script, which PR-03 reuses for the `reviews` ledger. Verified: store inits against `docs/` with no `BootstrapViolationError`.

### [PR-01-D02] `validateSchema` accepts outgoing transitions declared on a terminal status
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/src/store/core.ts:155-172
**Description:** Validation checks only that transition keys/values are members of `statusValues`; a user-declared map may give a terminal status outgoing edges (e.g. `resolved: ["open"]`) and pass. Canonical maps all use `[]` for terminals, so no live impact — a soundness gap the brief explicitly asked about.
**Fix:** `validateSchema` (core.ts) now throws `SchemaValidationError` when a transition key is in `terminalStatuses` with a non-empty target array. Test added in `transitions.test.ts` (terminal-with-outgoing rejected; terminal with `[]` accepted).
**Status note:** [x] resolved.

### [PR-01-D03] Milestone holds cannot move directly between `postponed` and `blocked`
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/src/constants.ts (`MILESTONES_SCHEMA.transitions`)
**Description:** `postponed → blocked` and `blocked → postponed` are rejected (both route through `open`). A real reduction of the milestone state graph; no test/data exercises it. Reviewer asked to confirm intent.
**Fix:** Added direct edges to `MILESTONES_SCHEMA.transitions` in constants.ts (`postponed → [open, done, blocked]`, `blocked → [open, done, postponed]`); regenerated bootstrap reflects them.

### [PR-01-D04] Misleading comment in `parseTransitions` claims membership is not re-checked
**Status:** [x] resolved
**Severity:** nit
**Location:** packages/ledger/src/registry.ts:127-128
**Description:** Comment says membership against `statusValues` is "NOT re-checked here (the guard tolerates unknown entries)". False — `parseSchema` calls `validateSchema` immediately after, which throws on unknown from/to statuses. Behavior is correct and strict; only the comment misleads.
**Fix:** Reworded the `parseTransitions` comment (registry.ts) to state shape is enforced here and status-membership is enforced by the subsequent `validateSchema` call in `parseSchema`.

### [PR-01-D05] No test directly pins the canonical transition maps (esp. milestones)
**Status:** [x] resolved
**Severity:** nit
**Location:** packages/ledger/test/transitions.test.ts
**Description:** Runtime guard tests only exercise `goals`; D02 tests use synthetic schemas. No assertion pins the D03 `postponed↔blocked` edges or the other canonical maps. They're validated indirectly (every map passes `validateSchema` at bootstrap), but a regression silently dropping an edge would go uncaught.
**Fix:** Added a `canonical schema transition maps — pinned edges` block in `transitions.test.ts` with exact-edge assertions across all 7 canonical maps (milestones `postponed↔blocked` + `done:[]`; goals `clarifying→planning` present, `→planned` absent; questions `open→{answered,withdrawn}`; one edge each for defects/tasks/hypothesis/decisions).

---

## PR-05 (M2 prompts)

All seven findings fixed as described in each "Suggested fix" below; a round-2
re-review confirmed D01 fully resolved and found no major. D07 (multi-milestone
discovery) was fixed in a follow-up: M holds goal/questions/reviews/decision; the
plan's work milestones are recorded in `goal.fields.milestones` and discovery
iterates them. Final `bun run check`: 369 pass / 0 fail, tsc + eslint clean.

### [PR-05-D01] Malformed link-discovery query: `fts_search(query:"goals:G")` matches zero items
**Status:** [x] resolved
**Severity:** major
**Location:** prompts/plan-advance-agent.md (state-read steps 2-3, rules 2/4), prompts/plan-reviewer.md (steps 2-4)
**Description:** `query.ts` parses `goals:G` as a QUALIFIER (`key="goals"`, value="G"), not free text; `matchItemQualifier` looks up a nonexistent `item.fields["goals"]` and returns false for every item. So the planner/reviewer find no linked questions/reviews/tasks → core state discovery silently fails (planner could try to leave `clarifying` with open questions; reviewer reviews an empty plan).
**Suggested fix:** Use `list_milestone_items(M)` + client-side filter on `fields.ledgerRefs.includes("goals:<G>")` (matches the server's own `itemsLinkingGoal`), or the quoted nested-colon qualifier `ledgerRefs:"goals:<G>"`. Replace every `query:"goals:G"` occurrence.

### [PR-05-D02] Code samples use literal `["goals:G"]` instead of a substitution placeholder
**Status:** [x] resolved
**Severity:** minor
**Location:** prompts/plan-start.md step 3 example; plan-advance-agent.md rules 2a/4/5
**Description:** The store matches `ledgerRefs` by exact string membership (`"goals:"+goalId`). A model copying the literal `"goals:G"` instead of the real id (`goals:G1`) breaks F2 + discovery. Prose says "use the literal id" but samples show bare `G`.
**Suggested fix:** Use `["goals:<G>"]` (angle-bracket placeholder) in all samples; never bare `["goals:G"]`.

### [PR-05-D03] Host-specific codegraph tool prefix hardcoded in subagent `tools:`
**Status:** [x] resolved
**Severity:** minor
**Location:** prompts/plan-advance-agent.md, prompts/plan-reviewer.md frontmatter `tools:`
**Description:** `mcp__plugin_claude-code-home-manager_codegraph__*` is host-specific; on another host/Codex the prefix differs/absent. Degrades gracefully (unknown tool simply not granted; Read/Grep/Glob remain) but is a portability smell in files meant to be portable.
**Suggested fix:** Drop codegraph entries from `tools:`; keep the in-body prose note that codegraph may be used when available, else Read/Grep/Glob.

### [PR-05-D04] `.claude/` gitignored — no committed commands/subagents and no regen mechanism
**Status:** [x] resolved
**Severity:** minor
**Location:** repo layout; `.gitignore` (`.claude/`)
**Description:** The `.claude/*` symlinks wiring `/plan:*` + subagents are not committed; a fresh clone has `prompts/` + `.codex/prompts/` but no working Claude commands until symlinks are recreated by hand. No regen script/doc.
**Suggested fix:** Add a `scripts/link-prompts.ts` (+ `link-prompts` npm script) that idempotently recreates the `.claude/commands/plan/*` and `.claude/agents/*` symlinks into `prompts/`; document the layout in a README. Keep NO root `AGENTS.md` (would shadow CLAUDE.md via Codex `project_doc_fallback_filenames`) — record that decision.

### [PR-05-D05] "have not yet acted on it" clause is not state-derivable (misleading)
**Status:** [x] resolved
**Severity:** nit
**Location:** prompts/plan-advance-agent.md rule 3
**Description:** Implies a memory the stateless subagent lacks. The loop invariant (a fresh review follows every `review-requested`) already prevents double-consuming a verdict, so the clause is redundant/confusing.
**Suggested fix:** Drop the clause; rely on the loop invariant.

### [PR-05-D06] "latest review" ordering left implicit
**Status:** [x] resolved
**Severity:** nit
**Location:** prompts/plan-advance-agent.md step 3, prompts/plan-reviewer.md step 4
**Description:** "Most recently created reviews item" doesn't name the ordering key; the brain could pick a stale review if it doesn't sort.
**Suggested fix:** State "latest = highest `R<n>` id (equivalently max `createdAt`)".

### [PR-05-D07] Plan-task discovery misses tasks under the plan's work milestones (single-group `list_milestone_items`)
**Status:** [x] resolved
**Severity:** minor (but bites the intended multi-milestone case)
**Location:** prompts/plan-advance-agent.md rule 2b (plan emission) + revise step; prompts/plan-reviewer.md (plan discovery)
**Description:** `list_milestone_items(M)` enumerates only the single planning milestone M (where goal/questions/reviews/decision live). The user's spec has the flow create work **milestones + tasks** (plural milestones). If the planner places the work breakdown under additional milestones, those tasks are invisible to both the reviewer's discovery and the planner's revise round — the reviewer would assess an incomplete plan. The server's `itemsLinkingGoal` scans all milestones, but no MCP tool replicates that; discovery must instead follow the goal's own milestone registry.
**Suggested fix:** Establish the model explicitly: M = the planning/coordination milestone (goal, questions, reviews, approval decision). The plan's WORK milestones are created during `planning`, their ids recorded in `goal.fields.milestones` (via `update_item`). Plan-task discovery (reviewer + revise step) iterates `goal.fields.milestones` and calls `list_milestone_items` for EACH, collecting tasks across them. Keeps the goal↔plan linkage explicit and discovery complete for multi-milestone plans.

---

## PR-03

### [PR-03-D01] `reviews`/`R` excluded from the global prefix-uniqueness / cross-ledger id-collision test
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/test/canonical-ledgers.test.ts:194-209
**Description:** The "global id uniqueness" test iterates `CASES`, which omits `reviews` (its verdicts are terminal-at-creation, so the create→update→archive CASES shape doesn't fit). So `R` is never exercised in the cross-ledger uniqueness check every other item-bearing canonical ledger gets — a real gap, since prefix uniqueness underpins the soft `ledger:id` ref scheme.
**Fix:** The "global id uniqueness" test now mints a `reviews` item (`status:"go-ahead"`), asserts its id is distinct, and expects `["D","G","H","K","Q","R","T"]` as the sorted prefix set.

### [PR-03-D02] Pinned-edges transition block covers 7 of 8 canonical schemas (no `REVIEWS_SCHEMA`)
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/test/transitions.test.ts:236-272
**Description:** The per-ledger pinned-edge block has no `REVIEWS_SCHEMA` case. Reviews' shape is validated indirectly at bootstrap (D02 rule), but the block that exists to pin per-ledger edges under-covers the new ledger.
**Fix:** Added a `reviews` case to the pinned-edges block asserting both `go-ahead` and `revise` map to `[]`; imported `REVIEWS_SCHEMA`.

### [PR-03-D03] Stale "all seven canonical ledgers" comment in store-abstract.ts
**Status:** [x] resolved
**Severity:** nit
**Location:** packages/ledger/test/store-abstract.ts:80
**Description:** Assertion derives from `CANONICAL_LEDGERS` (auto-covers reviews, passes); only the adjacent comment is stale (now 8).
**Fix:** Comment reworded to "All canonical ledgers …" (dropped the hardcoded count).

### [PR-03-D04] Repo prose / review-loop ledger says "7 canonical ledgers" (now 8)
**Status:** [x] resolved (orchestrator-owned docs updated; dogfood docs left)
**Severity:** nit
**Location:** docs/state/tasks.md (locked note), docs/tasks.md (dogfood state)
**Description:** Non-asserting doc strings now understate the count. `docs/tasks.md` is generated dogfood state (left as-is); the review-loop locked note in `docs/state/tasks.md` is orchestrator-owned and updated.
**Fix:** Updated the `docs/state/tasks.md` locked note to reflect that `transitions` now covers all 8 canonical ledgers (reviews added in PR-03). Dogfood `docs/tasks.md` left untouched (surgical).

---

## PR-02

### [PR-02-D01] "No client can bypass" goal preconditions are per-process, not global (cross-process staleness window)
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/src/store/FsLedgerStore.ts:451-469 (precondition closure) ↔ invalidate/reloadLedgerFromDisk
**Description:** The precondition reads the in-memory questions/decisions ledgers under the goals lock only. Across processes (D-COHERENCE eventual consistency), there is no happens-before edge between a peer answering a question / locking a decision and this process evaluating the goal precondition; the check can run against a stale view until the inbound `ledger.changed` invalidation applies. Exact within one process, best-effort across processes — inherent to the existing model, surfaced by F2.
**Fix:** Added a doc comment on `StatusChangePrecondition` / `assertGoalPhasePreconditions` (core.ts) stating the check is exact within one process and best-effort across processes under the eventual-consistency model. No locking change.

### [PR-02-D02] Precondition tests under-cover the rules the implementation relies on
**Status:** [x] resolved
**Severity:** minor
**Location:** packages/ledger/test/goal-preconditions.test.ts
**Description:** 8 cases assert the right error type and seed via the store API (good), but miss: (i) illegal-transition-takes-precedence — `clarifying→planned` (schema-illegal) with an open linked question must throw `InvalidTransitionError`, not `GoalPreconditionError`, and not crash; (ii) a `locked` decision linking a DIFFERENT goal must NOT satisfy rule (b); (iii) a `withdrawn` question must not block leaving clarifying; (iv) mixed open+answered linked questions still block. (i) and (ii) are the high-value gaps — the implementation's correctness leans on exactly those invariants and they're unexercised.
**Fix:** Added dual-store cases to `goal-preconditions.test.ts` (now 24 tests): (i) illegal `clarifying→planned` with an open question rejects with `InvalidTransitionError` (not `GoalPreconditionError`), goal stays clarifying; (ii) a `locked` decision linking a different goal does NOT satisfy rule (b); (iii) a withdrawn question doesn't block leaving clarifying; (iv) mixed open+answered still blocks.

### [PR-02-D03] Precondition hook types from/to as bare `string`
**Status:** [x] resolved (accepted)
**Severity:** nit
**Location:** packages/ledger/src/store/core.ts (`StatusChangePrecondition`, `assertGoalPhasePreconditions`)
**Description:** Statuses flow as raw `string`; a typo'd status constant would make a rule silently a no-op rather than failing typecheck. Consistent with the codebase-wide `string` status convention, so not a regression.
**Fix:** Accepted as-is — matches the surrounding convention; the new D02(ii) test guards against the rule silently no-op'ing.

---

## M4 (UI quick-transition buttons)

Adversarial review: no major, no minor findings. Four nits, all accepted (no fix):

### [M4-N01] Redundant `as Record<string, FieldValue>` cast on `row.item.fields`
**Status:** [x] resolved (accepted)
**Severity:** nit
**Location:** packages/ledger-web/src/App.tsx:1239
**Description:** `Item.fields` is already `Record<string, FieldValue>`, so the cast is unnecessary. Harmless; typechecks clean.
**Fix:** Accepted as-is (not worth a fix cycle / code edit bypassing the loop). Drop opportunistically if the file is touched later.

### [M4-N02] `author="user"` provenance on quick-transition update
**Status:** [x] resolved (accepted)
**Severity:** nit
**Location:** packages/ledger-web/src/App.tsx:36,281
**Description:** Pre-existing UI convention (the editor's save path already stamps `author="user"`); a human UI action is correctly attributed to "user". Not introduced by M4.
**Fix:** No change — correct and consistent with the existing convention.

### [M4-N03] TUI shows quick picker for milestones; web suppresses it
**Status:** [x] resolved (accepted)
**Severity:** nit
**Location:** packages/ledger-tui/src/app.tsx vs packages/ledger-web/src/App.tsx
**Description:** Web hides quick buttons for the milestones ledger; TUI shows the guard-constrained picker but dispatches correctly via `updateMilestone` (not `updateItem`). Both correct; cosmetic asymmetry.
**Fix:** No change. Parity is a possible future polish, not a defect.

### [M4-N04] UI tests don't exercise the store's F1 guard rejection
**Status:** [x] resolved (accepted)
**Severity:** nit
**Location:** packages/ledger-{tui,web}/test/fakeClient.ts
**Description:** Fake clients accept any status, so the suites verify the UI offers only legal targets but not that the store rejects an illegal one. Guard enforcement is `@cq/ledger`'s responsibility (covered by transitions.test.ts); UI correctness is asserted at render level.
**Fix:** No change — correct separation of concerns.

### [PR-01-D06] `scripts/` excluded from lint
**Status:** [x] resolved (accepted; see Fix)
**Severity:** nit
**Location:** package.json (`"lint": "eslint packages"`)
**Description:** New `scripts/regen-bootstrap.ts` lives outside `packages/`, so `bun run lint` never checks it. Low impact (trivial script, exercised indirectly by the boot test). Note: root `check` runs `eslint .` which DOES cover `scripts/`; only the standalone `lint` script narrows to `packages`.
**Fix:** Accepted as-is — `eslint .` in the `check` gate already covers `scripts/`, so the script is linted by the authoritative gate; no change needed. Recorded for awareness.
