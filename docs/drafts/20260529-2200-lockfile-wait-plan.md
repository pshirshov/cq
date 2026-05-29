# LOCK-D01 — lockfile waits for a live holder instead of failing fast

Date: 2026-05-29. Worktree: `.claude/worktrees/lockfile-wait`, branch `lockfile-wait`, base `187c027`.

## Problem (verified hypothesis, WFL-D02)

`packages/ledger/src/store/lockfile.ts` `acquire()` on `EEXIST` with a LIVE holder
PID throws `LedgerBusyError` immediately. Two legitimate concurrent ledger writers
exist on one cwd: the cq-server in-process `FsLedgerStore` (Claude path + `/plan`
WorkflowRuntime) and the long-lived `cq-mcp` child (Codex sessions). When one holds
the lock and the other writes, the second fails instead of briefly waiting for the
short write-through critical section. WFL-D02 observed this as
`workflow.errored ("Ledger goals is locked by pid N on vm")`.

## Fix

Change `acquire()` so on `EEXIST` with a LIVE holder it POLLS for the lock to free,
up to a bounded timeout, before throwing:

- Dead holder (PID not alive): reclaim as today — unlink + retry once.
- Live holder: re-attempt acquire on a short interval (default 25 ms) until either
  (a) it acquires, or (b) `acquireTimeoutMs` (default 5000 ms) elapses → throw
  `LedgerBusyError`.
- Inject poll interval + timeout + a clock/sleep so tests are deterministic and do
  not sleep in real time.

### Mechanics

Add to `LockfileOpts`:
- `acquireTimeoutMs?: number` (default 5000)
- `pollIntervalMs?: number` (default 25)
- `sleep?: (ms: number) => Promise<void>` (default real `setTimeout`-based sleep)

`now()` (already injectable) is the timeout clock; `sleep()` advances between polls.
For deterministic tests, inject a fake clock where `now()` is driven by a counter and
`sleep(ms)` advances that counter and yields a microtask (no real timer), or use tiny
real intervals where a real release race must be exercised.

### acquire() loop (replaces the EEXIST branch)

```
let result = await tryOnce();        // O_CREAT|O_EXCL primitive — unchanged
if (result === "acquired") return release;
const deadline = this.now() + this.acquireTimeoutMs;
while (true) {
  const holder = await this.readHolder(lockPath, ledgerId);
  if (!this.isPidAlive(holder.pid)) {
    // Dead (or vanished, pid -1) → reclaim + retry once.
    await fs.unlink(lockPath).catch(() => undefined);
    result = await tryOnce();
    if (result === "acquired") return release;
    // Lost the reclaim race to another waiter — fall through to wait again.
  }
  // Live holder (or reclaim lost): have we exhausted the budget?
  if (this.now() >= deadline) {
    throw new LedgerBusyError(ledgerId, holder);
  }
  await this.sleep(this.pollIntervalMs);
  result = await tryOnce();
  if (result === "acquired") return release;
  // else loop: re-read holder, re-check liveness + deadline.
}
```

Invariants:
- O_CREAT|O_EXCL stays the atomic acquire primitive (no TOCTOU on acquire).
- Dead-PID reclaim preserved. A holder that dies mid-wait → next `readHolder` reports
  dead → reclaim path handles it (no double-unlink: `unlink().catch(()=>undefined)`
  tolerates a concurrent reclaimer; the subsequent `tryOnce` is the real arbiter).
- Holder releases between EEXIST and readHolder → `readHolder` ENOENT → synthesized
  pid -1 (dead) → reclaim path → `tryOnce` acquires. Sound.
- Two waiters reclaim the same dead lock → only one `tryOnce` wins (O_EXCL); the loser
  re-reads, sees the winner as live (or itself loops), waits, retries. No two-acquirer.
- Timeout bounded → a genuinely stuck live holder still throws `LedgerBusyError`.
- All `Promise<T>`; no sync/async union; every wait is `await this.sleep(...)`.

## Tests (`packages/ledger/test/lockfile.test.ts` + `concurrency.test.ts`)

New in `lockfile.test.ts`:
1. **live-releases-within-window → ACQUIRES**: pre-write a live-holder lockfile;
   inject a `sleep` that, on first call, deletes the lockfile (simulating release),
   then `acquire` succeeds with no error. Fake clock, tiny interval.
2. **live-stuck → timeout throws LedgerBusyError**: live holder never released; fake
   clock where `sleep` advances `now` past `acquireTimeoutMs`; assert `LedgerBusyError`
   thrown after the budget, and that it polled (sleep called) ≥1×, i.e. did NOT fail
   fast. Deterministic, no real sleep.
3. **dead holder → reclaimed** (existing test stays green; assert no regression).
4. **holder dies WHILE waiting → reclaim + acquire**: start with `isPidAlive` true,
   then flip to false after the first poll (via a mutable closure), holder lockfile
   stays on disk; waiter's next readHolder sees dead → reclaims → acquires.
5. Existing **"refuses when lockfile is held by a live PID"** test currently asserts
   immediate throw. UPDATE it to the new semantics: inject `acquireTimeoutMs` tiny +
   a fake clock so it still throws `LedgerBusyError` (now after the bounded wait, not
   instantly), and note in a comment why the assertion changed (wait-then-timeout).

New in `concurrency.test.ts` (THE regression proof):
6. **two FsLedgerStore instances on the SAME tmp cwd**: build two `FsLedgerStore`
   (storeA, storeB) on one tmp `root` (simulating cq-server + cq-mcp). Both `init()`.
   Create a shared milestone via storeA; create one item per store; then fire
   concurrent `updateItem`/`createItem` from BOTH stores to the same ledger. Assert:
   both complete with NO `LedgerBusyError`; the final on-disk file parses cleanly via
   `parseLedger`; no lost write (every store's writes are reflected — at minimum item
   count and counter monotonicity hold). Uses REAL pids (both stores share
   `process.pid`, both alive) so the file lock + waiting is genuinely exercised
   cross-instance. Real (small) poll interval is acceptable here since the critical
   section is real and short; keep `acquireTimeoutMs` at default so it never flakes.

   NOTE on same-pid: both stores run in this test process, so `isPidAlive(self)` is
   true for both — the dead-reclaim path is NOT taken; the WAIT path is. That is
   exactly the production scenario (two live writers). The in-process AsyncMutex is
   per-store (separate instances), so it does NOT serialize across stores — only the
   file lock does. This is the load-bearing assertion.

## Discharge

- `bun run check` exits 0, run TWICE (determinism). Baseline 907/0; expect +new tests.
- `bun run e2e` retains 23/23 (run once).
- `nix build .#default` exits 0.
- `defects.md`: `LOCK-D01` row — root cause, wait-with-timeout fix, cross-instance
  regression test; reference WFL-D02 + D-LED.
- Session log notes the WFL-D02 ordering workaround is now belt-and-suspenders (kept).

## Constraints

- Ledger-library change + tests only. Do NOT touch WorkflowRuntime/bridges/e2e specs.
- Do NOT remove dead-PID stale reclaim. Do NOT make the timeout unbounded.
- No sync/async unions. Match existing style.
