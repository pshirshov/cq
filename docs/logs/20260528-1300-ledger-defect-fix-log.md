# Session log — outer-6 — `@cq/ledger` defect-fix

**Date:** 2026-05-28.
**Branch:** `worktree-agent-a9aea624edcc7b1ba`.
**Worktree:** `/home/pavel/work/safe/cqe/cq1/.claude/worktrees/agent-a9aea624edcc7b1ba`.

## Goal

Discharge 7 defects (D-LED-01..D-LED-07) raised against the outer-5
`@cq/ledger` build, with commit-per-defect discipline. 3 blocking
(D-LED-01..D-LED-03), 4 polish (D-LED-04..D-LED-07).

## Cycles

Single milestone (the brief was already milestone-grade) executed as 7
commit-per-defect inner cycles. No homeostat firings (the brief
faithfully modelled the code; no plan-vs-reality drift surfaced). No
algedonic escalations.

## Commits added this cycle

```
d4aa017 fix(D-LED-01): reject path-traversal in milestone/item ids
3a42d6c fix(D-LED-02): close schema validation gaps in create_ledger
dc69745 fix(D-LED-03): drop dead back-compat shim from bridge.ts
24a2a19 fix(D-LED-04): untrack docs/ledgers.yaml + gitignore
c2ab82e fix(D-LED-05): correct cloneFields return type
4bbb290 fix(D-LED-06): dispose() drains in-flight mutations
cc18307 fix(D-LED-07): strengthen 50-parallel-update concurrency assertion
```

## Resolved this session

- D-LED-01 → commit `d4aa017` — three-layer path-traversal defence
  (Zod regex `/^[A-Za-z0-9_-]+$/` on caller-supplied ids in
  `create_milestone` / `create_item` / `update_milestone` /
  `archive_milestone`; `assertSafeId` + new `InvalidIdError` in
  `core.ts`; `assertWithinDocsRoot` in `FsLedgerStore`). New
  `packages/ledger/test/path-traversal.test.ts` covers id-regex
  rejection (8 bad ids × 2 helpers), write-side defence (forged
  milestone), read-side defence (forged archive pointer).
- D-LED-02 → commit `3a42d6c` — new shared `validateSchema()` helper
  in `core.ts` exported from `@cq/ledger`; called by both adapters'
  `createLedger`, by `registry.parseSchema`, and mirrored in Zod
  `schemaSchema`. Invariants: non-empty `statusValues`, em-dash-free
  status values, `terminalStatuses ⊆ statusValues`, identifier-style
  field names, no `createdAt`/`updatedAt` reserved-name collisions.
  New abstract-suite cases (run × 2 adapters) + Zod-layer cases.
- D-LED-03 → commit `dc69745` — `bridge.ts` no longer carries the
  `void createAskUserQuestionMcpServer` shim. `ask-question.test.ts`
  has a live caller so the export stays in `askUserQuestion.ts` —
  audited via grep.
- D-LED-04 → commit `24a2a19` — `docs/ledgers.yaml` added to
  `.gitignore` under the "@cq/ledger per-cwd registry" comment and
  `git rm` removed the tracked empty file. New commit (no history
  rewrite).
- D-LED-05 → commit `c2ab82e` — `FsLedgerStore.cloneFields` parameter
  and return type both changed to `Record<string, FieldValue>`; cast
  to `Record<string, never>` removed.
- D-LED-06 → commit `4bbb290` — `FsLedgerStore.dispose()` enqueues a
  no-op `mutex.run()` on every per-ledger mutex and `await
  Promise.all(...)` before clearing internal state. New test case
  ("dispose() drains in-flight mutations") queues 20 updates and
  races dispose, asserting the updates resolve first.
- D-LED-07 → commit `cc18307` — new sibling test (original case
  untouched per brief). Injected `now=() => tick++`; asserts the 50
  returned `updatedAt` values form a strictly-monotonic contiguous
  block AND the final on-disk `updatedAt` equals `item.updatedAt +
  N`, with the on-disk `counter` matching the last-serialised write.

## Discharge evidence

- `bun run check` → 596 pass / 0 fail (was 558 baseline; +38 ledger
  defect-fix tests).
- `cd packages/e2e && bunx playwright test` → 16 passed (26.1s).
- `bun run -- playwright test` from `packages/e2e/` → 16 passed
  (26.1s).

### Note on the `bun run e2e` script alias

`bun run e2e` (which invokes `cd packages/e2e && playwright test`)
fails with "Playwright Test did not expect test() to be called here"
on this machine. This is an environment-level resolution quirk — there
is only ONE `@playwright/test@1.49.1` install in the workspace (under
`node_modules/.bun/`); no real duplicate exists. The same test set
runs cleanly via two equivalent invocations
(`cd packages/e2e && bunx playwright test` and
`cd packages/e2e && bun run -- playwright test`), both 16/16. Not
caused by this cycle's changes — none of D-LED-01..D-LED-07 touch the
e2e harness or the playwright binary path. Flagged here so the next
session can investigate whether the script needs to be re-written as
`bunx playwright test` or remain a documented gotcha.

### Path-traversal probe (discharge condition)

`create_milestone(id: "../../etc/x")` now rejects at three layers:
1. The Zod tool input schema (caller sees a clean MCP validation error).
2. `applyCreateMilestone` throws `InvalidIdError` (if the input
   bypassed Zod somehow, e.g. a future internal caller).
3. `FsLedgerStore.archiveMilestone`/`fetchArchive` resolve the path
   and refuse anything outside `docsDir` (catches the case where a
   forged in-memory milestone smuggles a bad id past the previous
   two layers).

All three layers are covered by tests in `path-traversal.test.ts`.

## Metrics

- WIP max 1 (serial commit-per-defect).
- Review rounds: 0 (no adversarial review subagent; orchestrator
  audited each commit's diff and ran ledger tests as S3\*).
- S3-S4 firings: research 0, replan 0.
- Material scope delta: none (the brief enumerated exact files and
  line-level changes; every commit traced to a single defect).
- Verification: complete on every entry.
- Audit discrepancies: 0.
- Algedonic: ordinary 0, bypass 0, depth-limit 0.

## Final ledger state

All 7 defects `[x]`. Active ledger is `./tasks.md` with the outer-6
section marked discharged. No follow-ups opened.
