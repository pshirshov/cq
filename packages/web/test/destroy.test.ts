/**
 * destroy.test.ts — Tests for PR-12: Destroyed-flag guard (R12) + terminal-state truth (R13).
 *
 * All tests use FakeClock + FakeInterval (from time-jump.test.ts pattern) for the
 * time-jump detector seam, and jest.useFakeTimers() for Manager's backoff timers and
 * Connection's internal timers (connect timeout, ping, pong).
 *
 * R12 scenario: destroy() sets _destroyed = true FIRST. When conn.close() is called
 * synchronously inside destroy(), the Connection transitions to DEAD which fires
 * _handleConnUpdate() — but that handler gates on _destroyed and returns immediately,
 * so _scheduleBackoff() is never reached. No reconnect timer is armed during destroy.
 *
 * R13 scenario: stats.isTerminal must be true whenever _destroyed, OR max attempts
 * exhausted, OR last close was non-retriable. isTerminal is now derived as
 * _destroyed || _isTerminal in _deriveStats(), so it reflects the destroyed state
 * truthfully even though destroy() never sets _isTerminal.
 *
 * 6 test cases:
 *   1. destroy() while RETRYING_BACKOFF clears the timer and no new spawn occurs.
 *   2. destroy() during a synchronous close cascade: _backoffTimerId is null on return.
 *   3. destroy() clears the time-jump detector tick; subsequent ticks are no-ops.
 *   4. Max attempts exhausted → isTerminal: true; send() returns false.
 *   5. Non-retriable close → isTerminal immediately; isTerminal sticks across destroy.
 *   6. onUpdate registered after destroy never fires.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { Manager } from "../src/ws/Manager";
import type { ManagerOpts } from "../src/ws/Manager";
import { MockWebSocket } from "./helpers/MockWebSocket";

// ---------------------------------------------------------------------------
// Timing constants (compressed)
// ---------------------------------------------------------------------------
const PING_MS   = 500;
const PONG_MS   = 200;
const STALE_MS  = 150;
const CONNECT_MS = 300;
const BASE_BACKOFF_MS = 100;
const MAX_BACKOFF_MS  = 800;

// ---------------------------------------------------------------------------
// FakeClock — decouples wall-clock from timer-firing (needed for detector tests)
// ---------------------------------------------------------------------------

class FakeClock {
  private _now: number;
  constructor(start = 1_000) { this._now = start; }
  advance(ms: number): void  { this._now += ms; }
  set(value: number): void   { this._now = value; }
  fn(): number               { return this._now; }
}

// ---------------------------------------------------------------------------
// FakeInterval — captures the interval callback for manual invocation
// ---------------------------------------------------------------------------

class FakeInterval {
  private _cb: (() => void) | null = null;
  private _cleared = false;
  private _id = 42;

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
    if (!this._cleared && this._cb !== null) this._cb();
  }

  get cleared(): boolean { return this._cleared; }
}

// ---------------------------------------------------------------------------
// Socket registry
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
// Opts builder — default uses jest fake timers for backoff + Connection timers
// ---------------------------------------------------------------------------

function makeOpts(
  extra: Partial<ManagerOpts> = {},
  clock?: FakeClock,
  fakeInterval?: FakeInterval,
): ManagerOpts {
  return {
    url: "ws://test",
    pingIntervalMs:   PING_MS,
    pongTimeoutMs:    PONG_MS,
    staleGraceMs:     STALE_MS,
    connectTimeoutMs: CONNECT_MS,
    baseBackoffMs:    BASE_BACKOFF_MS,
    maxBackoffMs:     MAX_BACKOFF_MS,
    maxAttempts:      15,
    socketFactory:    makeFactory(),
    random:           () => 1.0,
    isVisible:        () => true,
    ...(clock !== undefined ? { clock: () => clock.fn() } : {}),
    ...(fakeInterval !== undefined
      ? {
          setInterval:  fakeInterval.setInterval,
          clearInterval: fakeInterval.clearInterval,
          enableTimeJumpDetector: true,
        }
      : { enableTimeJumpDetector: false }),
    ...extra,
  };
}

/** Advance jest fake timers. */
function tick(ms: number): void {
  jest.advanceTimersByTime(ms);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Destroyed-flag guard (R12) + terminal-state truth (R13)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 1: destroy() while RETRYING_BACKOFF clears the timer
  // -------------------------------------------------------------------------
  it("destroy() while RETRYING_BACKOFF clears the timer; no new spawn after destroy", () => {
    const m = new Manager(makeOpts());
    const sock0 = sockets[0]!;

    // Drive the manager into backoff: open then retriably close.
    sock0.simulateOpen();
    sock0.simulateClose(1011, "retriable error");

    // Backoff should be scheduled.
    expect(m.stats.nextRetryAt).not.toBeNull();
    const socketCountBefore = sockets.length;

    // Destroy while the backoff timer is armed.
    m.destroy();

    // stats.isTerminal reflects destroyed (R13).
    expect(m.stats.isTerminal).toBe(true);

    // Advance past the backoff window — no new connection should be spawned.
    tick(MAX_BACKOFF_MS + 50);
    expect(sockets.length).toBe(socketCountBefore);
  });

  // -------------------------------------------------------------------------
  // Test 2: destroy() during synchronous close cascade does not arm a reconnect
  //
  // This is the canonical R12 race: destroy() calls conn.close() → Connection
  // transitions to DEAD → _handleConnUpdate(DEAD) is invoked synchronously.
  // Without the guard, _handleConnUpdate would call _scheduleBackoff().
  // With the guard (_destroyed = true set FIRST), _handleConnUpdate returns
  // immediately, so _backoffTimerId stays null after destroy() returns.
  // -------------------------------------------------------------------------
  it("destroy() during synchronous close cascade does not arm a reconnect timer", () => {
    const m = new Manager(makeOpts());
    const sock0 = sockets[0]!;

    // Connection is ALIVE — makes the DEAD path in _handleConnUpdate active.
    sock0.simulateOpen();
    expect(m.stats.connections[0]!.state).toBe("ALIVE");

    // Call destroy(). Internally: _destroyed=true, then conn.close() fires,
    // connection → DEAD, _handleConnUpdate() gates on _destroyed → returns.
    m.destroy();

    // _backoffTimerId must be null: no reconnect was scheduled during close.
    // We verify by asserting no new socket was created even after advancing time.
    const socketCountAfter = sockets.length;
    tick(MAX_BACKOFF_MS + 50);
    expect(sockets.length).toBe(socketCountAfter);

    // Pool must be cleared.
    expect(m.stats.connections.length).toBe(0);
    expect(m.stats.activeConnectionId).toBeNull();

    // isTerminal = true (R13: derived from _destroyed).
    expect(m.stats.isTerminal).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Test 3: destroy() clears the time-jump detector tick
  //
  // Uses FakeClock + FakeInterval to fire the detector tick manually.
  // After destroy(), FakeInterval.cleared is true and further ticks are no-ops:
  // no checkConnections / handleResume branch is taken.
  // -------------------------------------------------------------------------
  it("destroy() clears the time-jump detector tick; subsequent ticks are no-ops", () => {
    const clock = new FakeClock(1_000);
    const fakeInterval = new FakeInterval();
    const m = new Manager(makeOpts({}, clock, fakeInterval));

    // Confirm the detector is running: produce a short-gap tick.
    clock.set(5_000); // elapsed = 4 000 ms > (1000 + 2000 = 3000), < pongTimeout (200)
    // pongTimeout = PONG_MS = 200 — elapsed (4000) > pongTimeout → long branch.
    // But that's fine: either branch confirms the detector was running.
    fakeInterval.tick();
    const longBefore = m._timeJumpStats.long;
    const shortBefore = m._timeJumpStats.short;
    // At least one branch fired.
    expect(longBefore + shortBefore).toBeGreaterThanOrEqual(1);

    // Destroy clears the interval.
    m.destroy();
    expect(fakeInterval.cleared).toBe(true);

    // Further ticks are no-ops because FakeInterval._cb is null.
    clock.advance(10_000);
    fakeInterval.tick();

    // Telemetry counters unchanged.
    expect(m._timeJumpStats.long).toBe(longBefore);
    expect(m._timeJumpStats.short).toBe(shortBefore);
  });

  // -------------------------------------------------------------------------
  // Test 4: Max attempts exhausted → isTerminal: true; send() returns false
  // -------------------------------------------------------------------------
  it("max attempts exhausted → isTerminal: true; send() returns false", () => {
    // Use maxAttempts: 3 so the loop is short.
    const m = new Manager(makeOpts({ maxAttempts: 3 }));

    // Close each connection retriably until attempts are exhausted.
    // First connection spawned at construct; each backoff fires the next.
    for (let i = 0; i < 4; i++) {
      const sock = sockets[sockets.length - 1]!;
      sock.simulateClose(1011, "retriable");
      tick(MAX_BACKOFF_MS + 10); // fire the backoff
    }

    // isTerminal must now be true (max attempts exhausted via _isTerminal flag).
    expect(m.stats.isTerminal).toBe(true);
    expect(m.stats.nextRetryAt).toBeNull();

    // send() must return false when terminal.
    const sent = m.send({ type: "hb.ping", seq: 0, ts: 0, nonce: "0123456789abcdef", ackSeq: null });
    expect(sent).toBe(false);

    // No further spawn after calling destroy.
    m.destroy();
    const countAfter = sockets.length;
    tick(MAX_BACKOFF_MS * 10);
    expect(sockets.length).toBe(countAfter);
  });

  // -------------------------------------------------------------------------
  // Test 5: Non-retriable close → isTerminal immediately; sticks across destroy
  // -------------------------------------------------------------------------
  it("non-retriable close (1008) → isTerminal: true immediately; sticks after destroy()", () => {
    const m = new Manager(makeOpts());
    const sock0 = sockets[0]!;

    // 1008 = policy violation (non-retriable).
    sock0.simulateClose(1008, "policy violation");

    // isTerminal must be true immediately.
    expect(m.stats.isTerminal).toBe(true);
    expect(m.stats.connections.length).toBe(0);
    expect(m.stats.nextRetryAt).toBeNull();

    // Call destroy; isTerminal must remain true (R13).
    m.destroy();
    expect(m.stats.isTerminal).toBe(true);

    // No new sockets at any point.
    tick(MAX_BACKOFF_MS * 10);
    expect(sockets.length).toBe(1); // only the original
  });

  // -------------------------------------------------------------------------
  // Test 6: onUpdate registered after destroy never fires
  // -------------------------------------------------------------------------
  it("onUpdate registered after destroy never fires", () => {
    const m = new Manager(makeOpts());
    m.destroy();

    let callCount = 0;
    m.onUpdate(() => { callCount++; });

    // Any internal state change attempt (destroy again, checkConnections, etc.)
    // must not fire the callback since the manager is inert.
    m.destroy(); // idempotent
    m.checkConnections();
    m.handleResume(99_999);
    tick(MAX_BACKOFF_MS * 5);

    expect(callCount).toBe(0);
  });
});
