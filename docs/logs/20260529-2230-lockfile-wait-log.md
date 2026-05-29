# Session log — lockfile-wait (LOCK-D01)

Date: 2026-05-29. Worktree: `.claude/worktrees/lockfile-wait`, branch `lockfile-wait`, base `187c027`.

## Original request

Focused correctness fix on the `@cq/ledger` advisory lockfile under `/review-loop`
discipline. `Lockfile.acquire()` failed fast (threw `LedgerBusyError`) on an `EEXIST`
with a LIVE holder PID. cq now has two legitimate concurrent ledger writers on one cwd
— the cq server's in-process `FsLedgerStore` and the long-lived `cq-mcp` child's store
— so the second writer's operation FAILED instead of briefly waiting for the short
write-through critical section (the production root cause behind WFL-D02 defect 1).
Fix: wait-with-bounded-timeout on a live holder; preserve dead-PID stale reclaim; keep
the timeout bounded; injectable interval/timeout/clock for deterministic tests; add a
two-`FsLedgerStore` concurrent-write regression. Discharge: `bun run check` x2, `bun run
e2e` 23/23, `nix build .#default`; `LOCK-D01` defect row; session log.

## Runtime note

The review-loop skill assumes a subagent-dispatch tool for plan/execute/review phases.
That tool is NOT available in this runtime. Per the skill's serialise-when-isolation-
unavailable guidance, the phases were run sequentially in-session by the orchestrator,
with explicit reproduction discipline standing in for the adversarial-reviewer subagent
(repro on old code, load-bearing-ness checks, multi-run flakiness checks).

## Work performed (one PR, one milestone M-LOCK)

- **Plan** → `docs/drafts/20260529-2200-lockfile-wait-plan.md`.
- **Execute** → `packages/ledger/src/store/lockfile.ts` (`acquire` wait loop +
  `readHolder` → `HolderProbe`), tests in `lockfile.test.ts` + `concurrency.test.ts`.

## Review rounds / findings

Round 1 (self-review + empirical repro):
- **LOCK-D01 (major)** — fail-fast on a live holder. Reproduced on old code (stashed
  the fix; the cross-instance "different ledgers" test threw `LedgerBusyError: Ledger
  __milestones__ is locked by pid N on vm` — the WFL-D02 symptom). Fixed by the wait
  loop. Re-green after restore.
- **readHolder mid-write fragility (folded into LOCK-D01)** — discovered when the
  full ledger suite flaked (`pid 0 on unknown`) while the isolated run passed. Root
  cause: an EMPTY lockfile body (holder observed after `open(O_EXCL)` but before its
  `writeFile`) made `JSON.parse` throw → catch-all hard `LedgerBusyError`. Reproduced
  deterministically with a pre-written empty lockfile. Fixed by classifying empty/
  unparseable bodies as `transient` (poll again, NO reclaim — reclaiming a mid-write
  lock risks two acquirers). Full ledger suite then 163/0 stable across 3 runs.

No open defects remain.

## Adversarial concerns addressed

1. Holder-releases-mid-wait: `O_CREAT|O_EXCL` is the sole acquire arbiter; concurrent
   reclaimers cannot both win; a live mid-write holder is never reclaimed (transient
   path). No double-unlink (unlink tolerates a racing reclaimer), no two-acquirer.
2. Two `FsLedgerStore` on one cwd both complete a concurrent write with no lost data —
   proven by the regression test; the no-lost-write guarantee requires the D-COHERENCE
   relay (disabling it drops 30→15), which the test wires as production does.
3. A genuinely stuck live holder still times out loudly (bounded `acquireTimeoutMs`;
   the live-never-releases and empty-stuck cases both throw `LedgerBusyError`).
4. Determinism: lockfile tests use an injected fake clock + sleep (no real-time sleeps);
   the two concurrency tests use a 5 ms real interval against a real short critical
   section with the default 5 s timeout so they cannot flake.

## Discharge outputs

- `bun run check` (pass 1): exit 0, 911 pass / 0 fail.
- `bun run check` (pass 2): exit 0, 911 pass / 0 fail (deterministic). Baseline 907;
  +4 net new tests. ESLint: 23 pre-existing warnings (baseline-confirmed), 0 errors.
- `bun run e2e`: exit 0, 23 passed. Codex cq-server↔cq-mcp specs pass — the workflow no
  longer ERRORS on a live `cq-mcp` holder.
- `nix build .#default`: exit 0 (built locally after the remote builder was unreachable).

## Caveat / deferred

The WFL-D02 e2e Playwright project-ordering workaround (`prelude`/`main` split) is
RETAINED. With the lock now waiting, it is no longer load-bearing for the lock race, but
it still addresses the WFL-D02 defect-(2) CPU-starvation half. Not removed this cycle
(out of scope; ledger-library-only).

## Final ledger state

- `tasks.md`: M-LOCK / lock-01 `[x]` done, rich Completed entry, K-LOCK-1..5.
- `defects.md`: `LOCK-D01` `[x]` resolved.

Metrics: WIP max 1; review rounds {lock-01: 1}; verification complete; audit
discrepancies 0; algedonic escalations 0.
