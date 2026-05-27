# outer-6 — `@cq/ledger` defect-fix cycle (D-LED-01..D-LED-07)

**Date:** 2026-05-28.
**Branch:** `worktree-agent-a9aea624edcc7b1ba`.
**Source brief:** parent message ("Defects to fix" section), full text reproduced
in the user's invocation.

The brief is already a milestone-and-acceptance-criteria-grade plan. This doc
records the dispatch sequence and any per-defect notes that arise during
execution. Plan is single-milestone — all 7 defects flow into one vsm-loop
inner-cycle batch with commit-per-defect discipline.

## Sequence (priority order — blocking before polish)

1. **D-LED-01** (CRITICAL) — Path-traversal hardening (core.ts id regex +
   FsLedgerStore defense-in-depth + Zod regex + new
   `path-traversal.test.ts`).
2. **D-LED-02** (MEDIUM) — Schema validation (terminal subset, em-dash,
   reserved field names, field name regex) at three layers (Zod /
   `parseSchema` / shared `validateSchema` helper).
3. **D-LED-03** (MEDIUM) — Audit `createAskUserQuestionMcpServer` callers;
   `ask-question.test.ts:144` is a live caller, so DELETE the import + `void`
   from `bridge.ts` and keep the function exported.
4. **D-LED-04** (LOW) — `.gitignore` `docs/ledgers.yaml`; `git rm` the file.
5. **D-LED-05** (LOW) — `cloneFields` return type correction.
6. **D-LED-06** (LOW) — `dispose()` drains mutexes + new test.
7. **D-LED-07** (LOW) — Strengthen concurrency test (monotonic `updatedAt`,
   final-state assertion).

## Cross-cutting decisions

- **Shared validator location.** Add `validateSchema()` to
  `packages/ledger/src/store/core.ts` (already houses validation helpers).
  Exported from `src/index.ts`. Called by both `FsLedgerStore.createLedger`
  and `InMemoryLedgerStore.createLedger` *before* the schema is stored.
- **Defense-in-depth path check.** Single helper
  `assertWithinDocsRoot(absPath)` in `FsLedgerStore` (private). Called from
  both `archiveMilestone` and `fetchArchive`.
- **ID regex.** `/^[A-Za-z0-9_-]+$/` (matches the existing ledger-name
  regex in `createLedger`). Applied at three layers as specified in the
  brief.
- **Reserved field names.** `createdAt`, `updatedAt`. Field-name regex
  `^[A-Za-z_][A-Za-z0-9_]*$` precludes `:`/spaces/em-dash automatically.
- **Status-value regex.** `/^[A-Za-z0-9 _-]+$/` (the brief's explicit
  recommendation — disallows the em-dash that would corrupt heading
  parsing).
- **Discharge.** `bun run check` exits 0 + `bun run e2e` 16/16 baseline +
  commit-per-defect on `worktree-agent-a9aea624edcc7b1ba`.

## Audit hooks (S3\*)

After each commit:
- Read the diff (`git show --stat HEAD`) — confirm scope.
- `bun test packages/ledger` after D-LED-01, D-LED-02, D-LED-05, D-LED-06,
  D-LED-07 (the ledger-scoped defects).
- `bun run check` after D-LED-03 (touches server package).
- `bun run check` once more after D-LED-07.
- `bun run e2e` once at end of the cycle (single pass — e2e is slow and the
  changes don't touch the e2e-visible surface).
