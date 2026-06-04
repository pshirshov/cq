/**
 * Lockfile tests:
 *   - Orphaned lockfile (PID flagged as dead) is reclaimed on acquire.
 *   - Live holder that releases within the window → the waiter acquires.
 *   - Live holder that never releases → LedgerBusyError after a bounded wait.
 *   - Holder that dies WHILE the waiter is waiting → reclaim + acquire.
 *   - Acquire/release round-trip is symmetric.
 *
 * Waiting is exercised deterministically: an injected `sleep` advances a fake
 * `now()` clock (a counter), so the bounded timeout is reached without any
 * real-time delay and tests cannot flake under load.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, access, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Lockfile, LedgerBusyError } from "../src/index.js";

const dirs: string[] = [];

async function tmpLocksDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-lock-"));
  dirs.push(dir);
  const locks = path.join(dir, ".locks");
  await mkdir(locks, { recursive: true });
  return locks;
}

/**
 * Fake clock whose `now()` is a millisecond counter. `sleep(ms)` advances the
 * counter (driving the acquire deadline) and yields a microtask so awaiting
 * filesystem work can interleave. Returns the bound `now`/`sleep` plus the
 * number of sleeps performed (proves the waiter polled rather than failing
 * fast).
 */
function fakeClock(): {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  sleeps: () => number;
} {
  let t = 0;
  let sleeps = 0;
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps += 1;
      t += ms;
      await Promise.resolve();
    },
    sleeps: () => sleeps,
  };
}

afterAll(async () => {
  for (const d of dirs) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe("Lockfile", () => {
  it("acquire / release round-trip leaves no file behind", async () => {
    const locks = await tmpLocksDir();
    const lock = new Lockfile({ isPidAlive: () => false, selfPid: 4242 });
    const release = await lock.acquire(locks, "demo");
    await release();
    await expect(access(path.join(locks, "demo.lock"))).rejects.toThrow();
  });

  it("reclaims an orphaned lockfile written by a dead PID", async () => {
    const locks = await tmpLocksDir();
    // Pre-write a lockfile with a dead PID.
    await writeFile(
      path.join(locks, "demo.lock"),
      JSON.stringify({ pid: 999999, hostname: "dead.example", startedAt: 0 }),
      "utf8",
    );
    const lock = new Lockfile({
      isPidAlive: (pid: number) => pid !== 999999, // 999999 is dead; everyone else alive
      selfPid: 1234,
    });
    const release = await lock.acquire(locks, "demo");
    await release();
  });

  // LOCK-D01: prior semantics threw IMMEDIATELY on a live holder. The new
  // contract is wait-with-bounded-timeout: a live holder that never releases
  // still throws LedgerBusyError, but only AFTER the bounded wait — and the
  // waiter must have polled (not failed fast).
  it("throws LedgerBusyError after a bounded wait when a live holder never releases", async () => {
    const locks = await tmpLocksDir();
    await writeFile(
      path.join(locks, "demo.lock"),
      JSON.stringify({ pid: 555, hostname: "live.example", startedAt: 0 }),
      "utf8",
    );
    const clock = fakeClock();
    const lock = new Lockfile({
      isPidAlive: (pid: number) => pid === 555, // 555 stays alive forever
      selfPid: 1234,
      acquireTimeoutMs: 200,
      pollIntervalMs: 25,
      now: clock.now,
      sleep: clock.sleep,
    });
    let caught: unknown = null;
    try {
      await lock.acquire(locks, "demo");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LedgerBusyError);
    expect(String(caught)).toContain("pid 555");
    // It must have WAITED (polled), not failed fast. With a 200 ms budget and
    // a 25 ms interval the fake clock advances in 25 ms steps; at least one
    // sleep must have occurred before the deadline was hit.
    expect(clock.sleeps()).toBeGreaterThanOrEqual(1);
  });

  it("acquires when a live holder releases within the wait window", async () => {
    const locks = await tmpLocksDir();
    const lockPath = path.join(locks, "demo.lock");
    await writeFile(
      lockPath,
      JSON.stringify({ pid: 555, hostname: "live.example", startedAt: 0 }),
      "utf8",
    );
    let released = false;
    const clock = fakeClock();
    const lock = new Lockfile({
      isPidAlive: (pid: number) => pid === 555,
      selfPid: 1234,
      acquireTimeoutMs: 1000,
      pollIntervalMs: 25,
      now: clock.now,
      // On the first poll, simulate the live holder releasing the lock by
      // removing its lockfile; the next tryOnce must then acquire.
      sleep: async (ms: number) => {
        if (!released) {
          released = true;
          await unlink(lockPath).catch(() => undefined);
        }
        await clock.sleep(ms);
      },
    });
    const release = await lock.acquire(locks, "demo");
    // Acquired with no error; the lockfile now belongs to us (pid 1234).
    await release();
    await expect(access(lockPath)).rejects.toThrow();
  });

  it("reclaims and acquires when the holder dies WHILE the waiter is waiting", async () => {
    const locks = await tmpLocksDir();
    await writeFile(
      path.join(locks, "demo.lock"),
      JSON.stringify({ pid: 777, hostname: "live.example", startedAt: 0 }),
      "utf8",
    );
    // Holder 777 is alive on the first liveness probe, then dies. The waiter's
    // next readHolder+liveness probe must report it dead → reclaim + acquire.
    let probes = 0;
    const clock = fakeClock();
    const lock = new Lockfile({
      isPidAlive: (pid: number) => {
        if (pid !== 777) return true;
        probes += 1;
        return probes <= 1; // alive on first probe, dead thereafter
      },
      selfPid: 1234,
      acquireTimeoutMs: 1000,
      pollIntervalMs: 25,
      now: clock.now,
      sleep: clock.sleep,
    });
    const release = await lock.acquire(locks, "demo");
    await release();
    // Reclaimed without error and within the budget.
    expect(probes).toBeGreaterThanOrEqual(2);
  });
});
