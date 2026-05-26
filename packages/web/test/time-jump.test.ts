/**
 * time-jump.test.ts — Tests for the PR-11 time-jump detector (R8).
 *
 * Test seam design
 * ----------------
 * The detector uses two injectable primitives from ManagerOpts:
 *   - setInterval / clearInterval  — for the 1 s tick
 *   - clock                        — for measuring elapsed time
 *
 * To manufacture a time jump in isolation we need the tick to fire at a
 * chosen moment while `clock()` returns a value far ahead of `_lastTickAt`.
 * If we relied on jest.useFakeTimers() alone, advancing timers would also
 * advance Date.now() in lockstep, so elapsed would always equal the nominal
 * tick period (1 s) — no jump detected.
 *
 * Instead we inject a FakeClock (mutable counter) and a FakeInterval
 * (captures the callback for manual invocation).  This decouples the two
 * signals:
 *   1. Advance fakeClock to any value  (simulates wall-clock time passing)
 *   2. Call tick()                     (fires the interval callback)
 *
 * Assertion strategy: `_timeJumpStats` telemetry counters on the Manager
 * instance (`{ short: number; long: number }`) are incremented in each
 * detector branch.  Tests assert on those counters, avoiding the need to
 * spy on `checkConnections` / `handleResume` directly.
 *
 * 4 required test cases:
 *   1. Short gap (elapsed > tick+threshold, < pongTimeout) → checkConnections
 *   2. Long gap  (elapsed ≥ pongTimeout)                   → handleResume
 *   3. Normal cadence (no gap)                             → neither branch
 *   4. destroy() clears the interval — tick stops firing
 */

import { describe, it, expect } from "bun:test";
import { Manager, TIME_JUMP_TICK_MS } from "../src/ws/Manager";
import type { ManagerOpts } from "../src/ws/Manager";
import { MockWebSocket } from "./helpers/MockWebSocket";

// ---------------------------------------------------------------------------
// Timing constants (compressed)
// ---------------------------------------------------------------------------
const PING_MS = 500;
const PONG_MS = 5_000;  // intentionally large so "short gap" window is visible
const STALE_MS = 150;
const CONNECT_MS = 300;

// ---------------------------------------------------------------------------
// Fake clock
// ---------------------------------------------------------------------------

/** Mutable counter used as the injected `clock` function. */
class FakeClock {
  private _now: number;

  constructor(start: number = 1_000) {
    this._now = start;
  }

  /** Advance the clock by `ms` milliseconds. */
  advance(ms: number): void {
    this._now += ms;
  }

  /** Set the clock to an absolute value. */
  set(value: number): void {
    this._now = value;
  }

  /** Returns the current fake time. */
  fn(): number {
    return this._now;
  }
}

// ---------------------------------------------------------------------------
// Fake interval scheduler
// ---------------------------------------------------------------------------

/**
 * FakeInterval captures the callback registered by startTimeJumpDetector().
 * Tests call tick() to fire it manually, decoupled from the clock.
 */
class FakeInterval {
  private _cb: (() => void) | null = null;
  private _cleared: boolean = false;
  private _id: number = 1; // opaque id returned to clearInterval

  readonly setInterval = (fn: () => void, _ms: number): unknown => {  // eslint-disable-line @typescript-eslint/no-unused-vars
    this._cb = fn;
    this._cleared = false;
    return this._id;
  };

  readonly clearInterval = (id: unknown): void => {
    if (id === this._id) {
      this._cleared = true;
      this._cb = null;
    }
  };

  /** Fire the captured interval callback once, if still active. */
  tick(): void {
    if (this._cleared || this._cb === null) return;
    this._cb();
  }

  /** True after clearInterval has been called with the correct id. */
  get cleared(): boolean {
    return this._cleared;
  }
}

// ---------------------------------------------------------------------------
// Socket factory helpers
// ---------------------------------------------------------------------------

let sockets: MockWebSocket[] = [];

function makeFactory(): (url: string) => MockWebSocket {
  sockets = [];
  return (_url: string): MockWebSocket => {  // eslint-disable-line @typescript-eslint/no-unused-vars
    const s = new MockWebSocket();
    sockets.push(s);
    return s;
  };
}

// ---------------------------------------------------------------------------
// Opts builder
// ---------------------------------------------------------------------------

function makeOpts(
  clock: FakeClock,
  fakeInterval: FakeInterval,
  extra: Partial<ManagerOpts> = {},
): ManagerOpts {
  return {
    url: "ws://test",
    pingIntervalMs: PING_MS,
    pongTimeoutMs: PONG_MS,
    staleGraceMs: STALE_MS,
    connectTimeoutMs: CONNECT_MS,
    maxAttempts: 15,
    socketFactory: makeFactory(),
    random: () => 1.0,
    // Use global setTimeout for backoff (not exercised in these tests)
    clock: () => clock.fn(),
    setInterval: fakeInterval.setInterval,
    clearInterval: fakeInterval.clearInterval,
    // Disable backoff timer interference — use fake timer via injection
    setTimer: (fn: () => void, ms: number) => { void fn; void ms; return 0; }, // swallow; not tested here
    clearTimer: (id: unknown) => { void id; },              // no-op
    isVisible: () => true,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Time-jump detector (PR-11 / R8)", () => {

  // -------------------------------------------------------------------------
  // Test 1: Short gap → checkConnections branch
  //
  // Setup:
  //   clock starts at t=1000.
  //   Manager starts; _lastTickAt = 1000.
  //   Advance clock to t=4500 (elapsed = 3500ms).
  //   3500 > TIME_JUMP_TICK_MS(1000) + TIME_JUMP_THRESHOLD_MS(2000) = 3000 ✓
  //   3500 < pongTimeoutMs(5000)   → short gap branch.
  // -------------------------------------------------------------------------
  it("short gap (elapsed > tick+threshold, < pongTimeout) → checkConnections branch", () => {
    const clock = new FakeClock(1_000);
    const fakeInterval = new FakeInterval();
    const m = new Manager(makeOpts(clock, fakeInterval));

    // _lastTickAt is set to clock() at startTimeJumpDetector() time = 1000.
    // Advance clock to 4500 → elapsed on next tick = 3500ms.
    clock.set(4_500);
    fakeInterval.tick();

    // Short-gap branch increments _timeJumpStats.short; long branch not taken.
    expect(m._timeJumpStats.short).toBe(1);
    expect(m._timeJumpStats.long).toBe(0);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 2: Long gap → handleResume branch
  //
  // Setup:
  //   clock starts at t=1000.
  //   Manager starts; _lastTickAt = 1000.
  //   Advance clock to t=30000 (elapsed = 29000ms).
  //   29000 > 3000 ✓
  //   29000 ≥ pongTimeoutMs(5000) → long gap branch.
  //   handleResume(29000) should spawn a proactive replacement connection.
  // -------------------------------------------------------------------------
  it("long gap (elapsed ≥ pongTimeout) → handleResume branch + proactive spawn", () => {
    const clock = new FakeClock(1_000);
    const fakeInterval = new FakeInterval();
    const m = new Manager(makeOpts(clock, fakeInterval));

    const sock0 = sockets[0]!;
    sock0.simulateOpen(); // bring connection to ALIVE
    expect(m.stats.connections.length).toBe(1);

    // Large clock jump: 29 s elapsed.
    clock.set(30_000);
    fakeInterval.tick();

    // Long-gap branch taken.
    expect(m._timeJumpStats.long).toBe(1);
    expect(m._timeJumpStats.short).toBe(0);

    // handleResume(29000) should have called _spawn() → 2 connections in pool.
    expect(m.stats.connections.length).toBe(2);
    expect(sockets.length).toBe(2);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 3: Normal tick cadence → neither branch
  //
  // Setup:
  //   clock advances 1000ms between each tick (the nominal period).
  //   elapsed = 1000 ≤ TIME_JUMP_TICK_MS + TIME_JUMP_THRESHOLD_MS = 3000.
  //   Neither branch is taken.
  // -------------------------------------------------------------------------
  it("normal tick cadence (no gap) → neither checkConnections nor handleResume", () => {
    const clock = new FakeClock(1_000);
    const fakeInterval = new FakeInterval();
    const m = new Manager(makeOpts(clock, fakeInterval));

    // Fire 5 ticks with exactly TIME_JUMP_TICK_MS elapsed each time.
    for (let i = 0; i < 5; i++) {
      clock.advance(TIME_JUMP_TICK_MS); // elapsed = 1000ms exactly
      fakeInterval.tick();
    }

    expect(m._timeJumpStats.short).toBe(0);
    expect(m._timeJumpStats.long).toBe(0);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 4: destroy() clears the interval — tick stops firing
  // -------------------------------------------------------------------------
  it("destroy() clears the tick interval; subsequent ticks are no-ops", () => {
    const clock = new FakeClock(1_000);
    const fakeInterval = new FakeInterval();
    const m = new Manager(makeOpts(clock, fakeInterval));

    // Confirm interval is armed: one tick with a jump should be detected.
    clock.set(5_000); // elapsed = 4000ms → short gap (4000 > 3000, < 5000 pong)
    fakeInterval.tick();
    expect(m._timeJumpStats.short).toBe(1);

    // Destroy clears the interval.
    m.destroy();
    expect(fakeInterval.cleared).toBe(true);

    // Reset counters manually to confirm no further ticks fire.
    // (After destroy, the callback is nulled out in FakeInterval.clearInterval.)
    clock.advance(10_000);
    fakeInterval.tick(); // this is a no-op: FakeInterval._cb is null

    // Counts unchanged after destroy.
    expect(m._timeJumpStats.short).toBe(1);
    expect(m._timeJumpStats.long).toBe(0);
  });
});
