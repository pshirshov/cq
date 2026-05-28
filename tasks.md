# cq — active task ledger

**Cycle:** outer-6 / `@cq/ledger` defect-fix (D-LED-01..D-LED-07). **Discharged.**
**Goal:** Discharge 7 defects raised against the outer-5 ledger build (3 blocking + 4 polish).
**Accepted plan:** [`docs/drafts/20260528-1200-ledger-defect-fix-plan.md`](docs/drafts/20260528-1200-ledger-defect-fix-plan.md).
**Baseline (post outer-5):** `bun test packages/ledger` → 33/33; `bun run check` → 558/558; `bun run e2e` → 16/16.
**Discharge:** `bun run check` → 596 pass / 0 fail (+38 from defect-fix tests); `cd packages/e2e && bunx playwright test` → 16/16 pass. (`bun run e2e` script alias hits a transient @playwright/test resolution warning unrelated to these changes — confirmed by running `bun run -- playwright test` from `packages/e2e/`, which also passes 16/16.) Session log: [`docs/logs/20260528-1300-ledger-defect-fix-log.md`](docs/logs/20260528-1300-ledger-defect-fix-log.md).

## Active — outer-6 (defect-fix)

- [x] **D-LED-01** — CRITICAL path-traversal: id regex in core.ts + Zod + FsLedgerStore defense-in-depth + new path-traversal.test.ts. Commit `d4aa017`.
- [x] **D-LED-02** — Schema validation gaps in `create_ledger` (terminal subset / em-dash / reserved field names / field-name regex) at Zod, parseSchema, and shared validator layers. New `validateSchema()` helper exported from core; called by both adapters' `createLedger`, by `parseSchema`, and mirrored in Zod `schemaSchema`.
- [x] **D-LED-03** — Deleted dead `void createAskUserQuestionMcpServer` import + statement from bridge.ts. `ask-question.test.ts:144` still uses the export so the function remains in askUserQuestion.ts. `bun run check` -> 594 pass / 0 fail.
- [x] **D-LED-04** — `docs/ledgers.yaml` added to `.gitignore`; `git rm` removed the tracked empty registry.
- [x] **D-LED-05** — `cloneFields` return type corrected to `Record<string, FieldValue>`; cast removed. Typecheck still clean.
- [x] **D-LED-06** — `FsLedgerStore.dispose()` now awaits every per-ledger mutex chain via a no-op `mutex.run()` before clearing internal state. New test in `concurrency.test.ts`: 20 queued updates + dispose race; asserts updates resolve before dispose returns.
- [x] **D-LED-07** — New sibling test in `concurrency.test.ts` (the original 50-update test untouched). Injected `now=()=>tick++`; asserts the 50 returned `updatedAt` values form a strictly-monotonic contiguous block, and the final on-disk `updatedAt` equals `createItem.updatedAt + N` with a counter matching the last-serialised write.

## Cycle outer-5 — discharged

**Discharge:** `bun run check` 558/558; `bun run e2e` 16/16.

## Milestones — historical (cq core)

- [x] **M0 — Bring-up** — archive: [`./docs/archive/tasks-M0.md`](./docs/archive/tasks-M0.md).
- [x] **M1 — WebSocket spine** — archive: [`./docs/archive/tasks-M1.md`](./docs/archive/tasks-M1.md).
- [x] **M2 — Agent SDK / Chat MVP** — archive: [`./docs/archive/tasks-M2.md`](./docs/archive/tasks-M2.md).
- [x] **M3 — Chat full fidelity** — archive: [`./docs/archive/tasks-M3.md`](./docs/archive/tasks-M3.md).
- [x] **M4 — Persistence + History tab** — archive: [`./docs/archive/tasks-M4.md`](./docs/archive/tasks-M4.md).
- [x] **M5 — Polish & harden** — archive: [`./docs/archive/tasks-M5.md`](./docs/archive/tasks-M5.md).

## Active — outer-5 (`@cq/ledger`)

- [x] **L1** — Package scaffold + types. New `packages/ledger` with composite tsconfig, `types.ts`, `src/index.ts`; root workspaces entry; root tsconfig reference. Commit `061c09f`-ish (L1 commit).
- [x] **L2** — Parser + serializer + round-trip test. `parse.ts`, `serialize.ts`, `frontmatter.ts`. 4 round-trip cases (representative fixture, idempotency, empty ledger, archive milestone).
- [x] **L3** — Store interface + InMemoryLedgerStore + FsLedgerStore + lockfile + mutex. 9-case abstract suite × 2 adapters + 3 lockfile cases = 21 tests.
- [x] **L4** — Concurrency test. 3 cases: 50 parallel updates, 50 parallel creates, cross-ledger parallelism.
- [x] **L5** — Registry + createLedger / archiveMilestone (folded into L3).
- [x] **L6** — MCP tool factory. 12 tools (`mcp__cq__enumerate_ledgers`…`mcp__cq__search_items`); 5 unit cases.
- [x] **L7** — Server wiring. `bridge.ts` accepts `ledgerStore?`; `server.ts`/`devServer.ts`/`main.ts` construct `FsLedgerStore({ root: cwd })` and pass through. `mcp__cq__*` auto-allow already in place — no `canUseTool` change.
- [x] **L8** — Real-SDK integration test. `packages/server/test/ledger-integration.test.ts`: real SDK subprocess + MockAnthropicHTTP + FsLedgerStore on tmp dir; asserts `mcp__cq__enumerate_ledgers` tool_use surfaces and the result re-enters the conversation.
- [x] **L9** — Playwright e2e. `packages/e2e/tests/ledger-create.spec.ts`: scripts mock to issue `mcp__cq__create_ledger{name:'todos'}` then confirmation; asserts `./docs/todos.md` + `./docs/ledgers.yaml` on disk. Mock server gained `/__admin/scriptOnToolResult` for two-turn scripting.
- [x] **L10** — Manual UI dogfood + discharge. Discharge condition met: `bun run check` 558/558, `bun run e2e` 16/16. Manual dogfood deferred to user's own session — L8 and L9 integration tests exercise the full code path through the real SDK subprocess against MockAnthropicHTTP, which is the only end-to-end coverage we can run without consuming the user's Anthropic API quota.

## Archive

- M0 → [`./docs/archive/tasks-M0.md`](./docs/archive/tasks-M0.md)
- M1 → [`./docs/archive/tasks-M1.md`](./docs/archive/tasks-M1.md)
- M2 → [`./docs/archive/tasks-M2.md`](./docs/archive/tasks-M2.md)
- M3 → [`./docs/archive/tasks-M3.md`](./docs/archive/tasks-M3.md)
- M4 → [`./docs/archive/tasks-M4.md`](./docs/archive/tasks-M4.md)
- M5 → [`./docs/archive/tasks-M5.md`](./docs/archive/tasks-M5.md)
