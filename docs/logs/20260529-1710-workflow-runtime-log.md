# Session log — WorkflowRuntime `/plan` phase 1 (workflow-runtime cycle)

Date: 2026-05-29. Branch `workflow-runtime` (worktree off main `97e0ed5`).
Authoritative design: `docs/drafts/20260529-1710-questions-plan-workflow.md`.
Discipline: `/vsm-loop` (plan → adversarial review → execute → review), run inline.

## Scope delivered (phase 1 only)

`/plan <text>` → (1) new Goal in `goals` (status=clarifying, refined description);
(2) mandatory spec milestone "produce an actionable specification" linked from the
goal (Q11); (3) first clarifying-question batch in `questions` grouped under that
milestone; (4) lifecycle notifications to the main chat session (Q7). NOT built:
clarify/plan/review loops, planner, `/plan G<id>` continuation work (parse+route
only → continuation-not-implemented error), Goals-tab UI beyond a minimal banner.

## Architecture

- **CommandRegistry** (`packages/server/src/workflow/commandRegistry.ts`): pure,
  total `parsePlanCommand(text, goalRef?)` → `plan_new | plan_continue | malformed`.
- **Protocol** (`packages/shared/src/protocol.ts`): `workflow.start` (client→server,
  replaces chat.input for `/plan` lines) + `workflow.event` (server→client lifecycle:
  started/producing/questions_ready/errored). Added to ClientFrame/ServerFrame unions.
- **WorkflowRuntime** (`workflow/workflowRuntime.ts`): the HARNESS. Single in-memory
  active slot (Q D busy-reject). Dispatches a producer, then writes ledgers itself
  (controls IDs, seeds the spec milestone, groups questions, links goal). Emits
  lifecycle frames via an injected sink (the WsSession's per-connection emitter).
- **Producer** (`workflow/producer.ts` + `claudeProducer.ts` + `codexProducer.ts`):
  the headless subagent. `ClaudeProducer` runs its OWN `query()` (injectable
  QueryFactory) with a single harness-owned `submit_plan` in-process MCP tool whose
  handler validates `{goal,questions}` against `ProducerOutputSchema` and resolves the
  run; `canUseTool` denies everything except `submit_plan`. NO ledger MCP tools — the
  producer cannot write ledgers. `CodexProducer` rejects with an actionable error
  (WF-D01).
- **Wiring**: `server.ts` constructs the runtime (store + per-platform producer
  selector) and passes it to `WsSession`; `WsSession.handleWorkflowStart` routes
  `workflow.start` to it and streams lifecycle frames on the issuing connection.
  Client (`ChatTab.handleSubmit`) routes a leading `/plan` to `workflow.start`
  (BEFORE the activeSessionId guard — planning is session-independent) and renders
  `WorkflowBanner` minimally.

## Dispatch-lane design (stays clear of pool=1)

The producer NEVER goes through the `Bridge` facade: it constructs its own SDK query,
never registers a `SessionRegistry` session, never sets `Bridge.active`, never emits
`chat.*` frames. The pool=1 interactive-chat invariant therefore holds by
construction. Proven by `workflow-pool1-regression.test.ts`: an interactive chat
session starts + completes a turn while a workflow is parked mid-produce, and remains
usable after a workflow FAILS; `bridge.isBusy()` is false throughout the workflow.

## HARNESS-owns-writes + spec-milestone invariant

`writeArtifacts` order: spec milestone → goal (clarifying, under spec) → questions
(under spec) → link goal.milestones=[specId]. A producer FAILURE never reaches
`writeArtifacts`, so the ledgers stay untouched (verified). The spec milestone is
always seeded by the runtime; the producer has no say.

## Backends (Q8)

- Claude: shipped + proven end-to-end (`workflow-integration.test.ts`, REAL SDK vs
  MockAnthropicHTTP: model calls `submit_plan` → handler validates → harness writes
  ledgers → questions_ready).
- Codex: DEFERRED (WF-D01). The Codex SDK exposes only `Thread.runStreamed` with no
  forced-tool/structured-output equivalent to Claude's `submit_plan` MCP tool; the
  Codex CLI's only MCP surface is the standalone cq-mcp binary (the forbidden
  ledger-write path). Dispatch path wired + selectable; `CodexProducer.produce`
  rejects with an actionable message rather than faking output, per the brief.

## Tests added (27)

- `workflow-command.test.ts` (13): registry parse + protocol Zod round-trip.
- `workflow-runtime.test.ts` (5): phase-1 happy path (linkage/IDs + lifecycle order),
  busy reject, producer-failure-leaves-no-ledger-state, continuation-not-implemented.
- `workflow-producer.test.ts` (3): ClaudeProducer failure modes (no-submit, abort,
  timeout) via injected QueryFactory.
- `workflow-ws.test.ts` (4): WsSession `/plan` routing (lifecycle order, malformed,
  continuation, no-runtime).
- `workflow-pool1-regression.test.ts` (2): pool=1 invariant under concurrent
  workflow + after workflow failure.
- `workflow-integration.test.ts` (1): REAL SDK end-to-end via MockAnthropicHTTP.
- `packages/e2e/tests/plan-workflow.spec.ts` (1): Playwright — type `/plan`, await
  questions_ready banner, assert docs/goals.md (clarifying goal), docs/milestones.md
  (spec milestone), docs/questions.md (≥1 question).

## Findings / deviations

- **Bun native-binary spawn workaround**: the producer's own `query()` needed the
  same `pathToClaudeCodeExecutable` workaround ClaudeBridge uses
  (`resolveNativeBinaryPath`); without it the producer subprocess intermittently
  hung under Bun (→ timeout). Added.
- **e2e subprocess-init contention**: the plan-workflow spec spawns a second SDK
  subprocess (the producer) alongside the page's auto-start interactive chat.
  Mitigated by waiting for the interactive session to reach idle before `/plan` and
  a generous banner timeout. The residual flakiness is the same subprocess-init
  timing class the suite already documents ("serialise tests to avoid mock state
  races") and that stop.spec/codex specs exhibit independently.
- **Workflow abort on teardown**: added `WorkflowRuntime.abortActive()`, wired into
  the `/__e2e/interrupt` hook and graceful shutdown, so an in-flight producer
  subprocess cannot leak into the next test/run.
- **Milestones-ledger shape**: milestones are ITEMS in the single `active` group
  (title in `fields.title`), not groups with `.title` — adjusted test lookups.

## Defects

- WF-D01 (blocked/deferred, major): Codex producer — exact SDK gap + follow-up.
- WF-D02 (resolved/documented, minor): no durable mid-flight resume (cycle-3); an
  orphaned `clarifying` goal on hard-kill mid-phase-1 is the documented accepted state.
