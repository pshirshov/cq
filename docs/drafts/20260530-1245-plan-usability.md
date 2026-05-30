# Cycle: plan-usability — four /plan dogfood usability defects (PLAN-D01..D04)

Worktree: `.claude/worktrees/plan-usability`, branch `plan-usability` off main `274ec43`.
Baseline (verified 274ec43): `bun run check` 1012 pass / 0 fail; `bun run e2e` 25/25.

## Defects

### PLAN-D01 (MAJOR) — phase subagents are blind to the project
Root cause: in `claudeProducer.ts` (~L146) and `claudePhaseSubagent.ts` (~L103),
`canUseTool` DENIES every tool except the phase's `submit_*` tool. This conflates
"must not WRITE ledgers" (correct — harness owns writes) with "must not READ" —
so the subagent reasons blind and asks questions whose answers are in the repo.

Fix:
- `canUseTool`: ALLOW read-only `Read`/`Grep`/`Glob` IN ADDITION to the
  `submit_*` tool. DENY all writes/exec: `Edit`, `Write`, `NotebookEdit`,
  `Bash`, and any unknown tool. cwd is the project, so Read/Grep/Glob reach
  both the codebase AND on-disk ledgers (`docs/*.md`). Harness-owns-writes
  preserved (no write tool, no ledger-mutation MCP tool; only output channel
  is `submit_*`).
- Both Claude paths share one allow-list. Factor the predicate so the producer
  and the generic phase subagent use the same read-only-plus-submit gate.
- Update EVERY phase prompt builder (`buildProducerPrompt` in `producer.ts`;
  `buildClarifyReviewPrompt`, `buildPlannerPrompt`, `buildPlanReviewPrompt`,
  `buildContinuationPrompt`, `buildContinuationPlannerPrompt` in `phases.ts`)
  to PREPEND an explore-first instruction: explore the repo (CLAUDE.md,
  README.md, packages/, docs/ ledgers) to ground the work; do NOT ask
  clarifying questions whose answers are discoverable; ask only genuine
  product/scope decisions the user must make. Keep the rest intact.
- Codex variant (`codexHeadless.ts`): file-read access is governed by the
  codex SANDBOX (danger-full-access), NOT `canUseTool`. So the Codex fix is the
  same explore-first PROMPT addition (already delivered via the shared
  prompt-builders) — do NOT change `sandboxMode`. Note in log.

Tests: unit-test the shared `canUseTool` predicate — allows Read/Grep/Glob +
the fq submit tool, denies Edit/Write/Bash/NotebookEdit and unknown. Assert
each prompt builder includes the explore-first marker. Existing producer
"harness owns writes" tests stay green.

### PLAN-D02 (MAJOR) — Goals page not scrollable
`Goals.module.css` `.wrapper` (NB: brief said `.root`; actual class is
`.wrapper`) has `height:100%; overflow:auto`. Ancestor in `App.tsx` is
`flex:1; overflow:hidden; display:flex; flex-direction:column`. The wrapper is
a flex item; `height:100%` against a flex-column parent of bounded height plus
the default `min-height:auto` lets the item grow past the parent, so
`overflow:auto` never engages. Fix: give `.wrapper` `flex:1; min-height:0`
(and keep `overflow:auto`), matching the bounded-flex-child scroll pattern used
by ChatTab's stream. Verify the height chain produces `scrollHeight >
clientHeight` with many questions, not just that the CSS property is present.

Tests: e2e that seeds enough questions and asserts the scroll container's
`scrollHeight > clientHeight` AND that it is actually scrollable (set
scrollTop, assert it stuck). Robustness over a pure CSS-string assertion.

### PLAN-D03 (MINOR) — Goals page theming + text size
`Goals.module.css` hardcodes light-theme hexes (`#7c3aed`, `#4c1d95`,
`#5b21b6`, `#ffffff`, `#faf5ff`, `#f5f3ff`, `#1c1b1f`, …). The app defines
theme CSS variables in `global.css` `:root` (`--bg`, `--surface`, `--border`,
`--text-primary`, `--text-secondary`, `--accent`, `--hover`, `--input-bg`,
`--status-error`). FINDING: there is NO dark-theme selector anywhere in the web
package (no `prefers-color-scheme`, no `data-theme`). The brief's "study how
the app themes dark" premise is partly inaccurate — only a light `:root`
palette exists. Actionable, factual fix: re-author Goals.module.css to consume
the existing `--*` variables (so it is theme-ready and consistent), with
sensible literal fallbacks. Bump question/option text to the readable size used
elsewhere (Chat/AskCard ~0.95rem). Keep layout. Visual dark-theme correctness
is NOT verifiable (no dark theme exists) — note in log; do NOT invent a dark
selector.

Tests: assert Goals.module.css no longer hardcodes the light-theme hexes for
theme-sensitive SURFACES (uses `var(--…)`); render test that the goals tab
mounts.

### PLAN-D04 (MINOR) — `/plan` line not visible in chat history
`ChatTab.handleSubmit` detects `/plan`, sends `workflow.start`, and returns
early — never echoing the typed line. The server's `workflow.start` handler
emits only `workflow.event` lifecycle frames, never a `chat.event`, so the
client must inject the bubble itself. Fix: before `manager.send(frame)`, push a
synthetic `chat.event` into `chatEvents` carrying the typed line as an SDK user
message (`{type:"user", message:{content:[{type:"text", text}]}}`) so the
existing user-bubble renderer in `Stream.tsx` shows it; optionally follow with a
short system/acknowledgement line. Still emit `workflow.start`. Reuse the
existing user-bubble path — no new component.

Tests: web test — typing `/plan x` renders the user's line in the chat stream
AND still emits `workflow.start`.

## Discharge
- `bun run check` exit 0, run TWICE (baseline 1012/0).
- `bun run e2e` green ≥1× (no regress to WFL-D02 / LOCK-D01 / Codex relay /
  continuation / FTS).
- `nix build .#default` exit 0.
- Manual scenario in session log.
- defects.md rows PLAN-D01..D04 resolved with citations.

## Commit-per-defect
`fix(PLAN-D0N): …`. Today 2026-05-30.
