# cq — active task ledger

**Cycle:** outer-5 / `@cq/ledger` build.
**Goal:** Ship `packages/ledger` (markdown-backed ledger library) + in-process MCP tool surface registered on the existing `cq` server, end-to-end agent-callable per Q12 acceptance.
**Accepted plan:** [`docs/drafts/20260527-2330-ledger-plan.md`](docs/drafts/20260527-2330-ledger-plan.md).
**Defects:** [`./defects.md`](./defects.md).

## Milestones — historical (cq core)

- [x] **M0 — Bring-up** — archive: [`./docs/archive/tasks-M0.md`](./docs/archive/tasks-M0.md).
- [x] **M1 — WebSocket spine** — archive: [`./docs/archive/tasks-M1.md`](./docs/archive/tasks-M1.md).
- [x] **M2 — Agent SDK / Chat MVP** — archive: [`./docs/archive/tasks-M2.md`](./docs/archive/tasks-M2.md).
- [x] **M3 — Chat full fidelity** — archive: [`./docs/archive/tasks-M3.md`](./docs/archive/tasks-M3.md).
- [x] **M4 — Persistence + History tab** — archive: [`./docs/archive/tasks-M4.md`](./docs/archive/tasks-M4.md).
- [x] **M5 — Polish & harden** — archive: [`./docs/archive/tasks-M5.md`](./docs/archive/tasks-M5.md).

## Active — outer-5 (`@cq/ledger`)

- [ ] **L1** — Package scaffold + types. New `packages/ledger` with composite tsconfig, `types.ts`, empty `src/index.ts`; root workspaces entry; root tsconfig reference. Acceptance: `bun run check` exits 0; new package compiles to `dist/`.
- [ ] **L2** — Parser + serializer + round-trip test. `parse.ts`, `serialize.ts`, `frontmatter.ts`. Acceptance: `parser-roundtrip.test.ts` passes with ≥1 fixture covering all field types + archive pointers.
- [ ] **L3** — Store interface + InMemoryLedgerStore + FsLedgerStore + lockfile + mutex. Acceptance: dual-tests suite green against both adapters; lockfile reclaim test green.
- [ ] **L4** — Concurrency test. Acceptance: 50 parallel updates leave a parseable file with all writes present and counters monotonic.
- [ ] **L5** — Registry + createLedger / archiveMilestone. Acceptance: `ledgers.yaml` read/write, archive moves milestone to `./docs/archive/<ledger>/<id>.md` and refuses non-terminal items.
- [ ] **L6** — MCP tool factory. Acceptance: each tool returns a `CallToolResult` whose `content[0].text` parses to the expected JSON shape.
- [ ] **L7** — Server wiring. `main.ts`/`devServer.ts`/`server.ts` construct `FsLedgerStore`; `bridge.ts` merges ledger tools into the `cq` MCP server. Acceptance: all 524 existing tests still pass; `mcp__cq__*` auto-allow rule covers new names.
- [ ] **L8** — Real-SDK integration test. Acceptance: bridge + `MockAnthropicHTTP` round-trip an `enumerate_ledgers` tool call.
- [ ] **L9** — Playwright e2e spec for `create_ledger`. Acceptance: `bun run e2e` green including the new spec.
- [ ] **L10** — Manual UI dogfood + discharge. Acceptance: `bun run check` 0, `bun run e2e` 0, manual prompt creates a real `./docs/<name>.md` on disk; all L-entries `[x]`.

## Archive

- M0 → [`./docs/archive/tasks-M0.md`](./docs/archive/tasks-M0.md)
- M1 → [`./docs/archive/tasks-M1.md`](./docs/archive/tasks-M1.md)
- M2 → [`./docs/archive/tasks-M2.md`](./docs/archive/tasks-M2.md)
- M3 → [`./docs/archive/tasks-M3.md`](./docs/archive/tasks-M3.md)
- M4 → [`./docs/archive/tasks-M4.md`](./docs/archive/tasks-M4.md)
- M5 → [`./docs/archive/tasks-M5.md`](./docs/archive/tasks-M5.md)
