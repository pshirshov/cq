/**
 * connection.test.ts — Unit tests for the client Connection state machine (PR-08).
 *
 * Uses jest.useFakeTimers() from bun:test (Bun 1.3.13) to advance time
 * without real delays. Each test resets fake timers via afterEach.
 *
 * 8 named test cases:
 *  1. NEW → ALIVE on open + first pong
 *  2. NEW → DEAD on connect timeout
 *  3. ALIVE → STALE → ALIVE on late pong (recovery)
 *  4. ALIVE → STALE → DEAD on grace expiry
 *  5. server hb.sping triggers hb.spong reply (R11 client side)
 *  6. unrelated pong (unknown nonce) does not promote STALE → ALIVE
 *  7. onUpdate fires on each transition + RTT update; unsubscribe stops it
 *  8. close() during STALE moves to DEAD and clears all timers
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { Connection, CLOSE_CONNECT_TIMEOUT } from "../src/ws/Connection";
import type { ConnectionStats } from "../src/ws/Connection";
import { MockWebSocket } from "./helpers/MockWebSocket";
import type { ServerHbPong, ServerHbPing } from "@cq/shared";

// ---------------------------------------------------------------------------
// Defaults for all tests (compressed so fake-timer advances are small)
// ---------------------------------------------------------------------------
const PING_MS = 500;
const PONG_MS = 200;
const STALE_MS = 150;
const CONNECT_MS = 300;

function makeOpts(mock: MockWebSocket) {
  return {
    url: "ws://test",
    pingIntervalMs: PING_MS,
    pongTimeoutMs: PONG_MS,
    staleGraceMs: STALE_MS,
    connectTimeoutMs: CONNECT_MS,
    socketFactory: () => mock,
  };
}

// ---------------------------------------------------------------------------
// Frame builders
// ---------------------------------------------------------------------------

function pongFrame(echoNonce: string): ServerHbPong {
  return {
    type: "hb.pong",
    seq: 0,
    ts: Date.now(),
    echoNonce,
    clientTs: Date.now() - 10,
    serverTs: Date.now() - 5,
  };
}

function spingFrame(nonce: string): ServerHbPing {
  return {
    type: "hb.sping",
    seq: 0,
    ts: Date.now(),
    nonce,
  };
}

// ---------------------------------------------------------------------------
// Helper: extract the nonce from the last hb.ping frame sent by the Connection
// ---------------------------------------------------------------------------

function lastPingNonce(mock: MockWebSocket): string {
  const pingFrames = mock.sent
    .map((s) => JSON.parse(s) as Record<string, unknown>)
    .filter((f) => f["type"] === "hb.ping");
  const last = pingFrames[pingFrames.length - 1];
  if (!last) throw new Error("No hb.ping frames recorded");
  return last["nonce"] as string;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Connection state machine", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 1: NEW → ALIVE on open + first pong
  // -------------------------------------------------------------------------
  it("NEW → ALIVE on open + first pong: state, rtt, inFlight", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    // Initial state must be NEW
    expect(conn.state).toBe("NEW");
    expect(conn.stats.inFlight).toBe(0);

    // Simulate socket opening
    mock.simulateOpen();
    expect(conn.state).toBe("ALIVE");

    // Advance past one ping interval
    jest.advanceTimersByTime(PING_MS + 1);

    // The connection should have sent an hb.ping
    const pingFrames = mock.sent.filter(
      (s) => (JSON.parse(s) as { type: string }).type === "hb.ping",
    );
    expect(pingFrames.length).toBeGreaterThanOrEqual(1);
    expect(conn.stats.inFlight).toBe(1);

    // Extract nonce from the ping
    const nonce = lastPingNonce(mock);
    expect(nonce).toHaveLength(16);

    // Simulate a matching pong
    mock.simulateMessage(JSON.stringify(pongFrame(nonce)));

    // State remains ALIVE, RTT is positive, inFlight returns to 0
    expect(conn.state).toBe("ALIVE");
    expect(conn.stats.rtt).not.toBeNull();
    expect(conn.stats.rtt!).toBeGreaterThanOrEqual(0);
    expect(conn.stats.inFlight).toBe(0);

    conn.close();
  });

  // -------------------------------------------------------------------------
  // Test 2: NEW → DEAD on connect timeout
  // -------------------------------------------------------------------------
  it("NEW → DEAD on connect timeout (readyState stays CONNECTING)", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    // Do NOT call simulateOpen; readyState stays CONNECTING (0)
    expect(conn.state).toBe("NEW");
    expect(mock.readyState).toBe(MockWebSocket.CONNECTING);

    // Advance past connectTimeoutMs
    jest.advanceTimersByTime(CONNECT_MS + 1);

    expect(conn.state).toBe("DEAD");
    expect(conn.stats.lastCloseCode).toBe(CLOSE_CONNECT_TIMEOUT);
    expect(conn.stats.lastCloseReason).toMatch(/connect timeout/i);
  });

  // -------------------------------------------------------------------------
  // Test 3: ALIVE → STALE → ALIVE on late pong (recovery)
  // -------------------------------------------------------------------------
  it("ALIVE → STALE → ALIVE: late pong recovers; staleGraceTimer is cleared", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    mock.simulateOpen();
    expect(conn.state).toBe("ALIVE");

    // Advance past one ping interval to trigger the first ping
    jest.advanceTimersByTime(PING_MS + 1);
    const nonce = lastPingNonce(mock);
    expect(conn.stats.inFlight).toBe(1);

    // Advance past pong timeout without responding → STALE
    jest.advanceTimersByTime(PONG_MS + 1);
    expect(conn.state).toBe("STALE");

    // Now simulate the matching pong arriving (late) → recover to ALIVE
    mock.simulateMessage(JSON.stringify(pongFrame(nonce)));
    expect(conn.state).toBe("ALIVE");
    expect(conn.stats.rtt).not.toBeNull();

    // Verify stale grace did NOT fire — advance past it, still ALIVE
    jest.advanceTimersByTime(STALE_MS + 1);
    expect(conn.state).toBe("ALIVE");

    conn.close();
  });

  // -------------------------------------------------------------------------
  // Test 4: ALIVE → STALE → DEAD on grace expiry
  // -------------------------------------------------------------------------
  it("ALIVE → STALE → DEAD: stale grace fires; socket is closed", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    mock.simulateOpen();

    // Advance past ping interval → first ping fires
    jest.advanceTimersByTime(PING_MS + 1);
    expect(conn.stats.inFlight).toBe(1);

    // Advance past pong timeout → STALE
    jest.advanceTimersByTime(PONG_MS + 1);
    expect(conn.state).toBe("STALE");

    // Do NOT send any pong; advance past stale grace → DEAD
    jest.advanceTimersByTime(STALE_MS + 1);
    expect(conn.state).toBe("DEAD");

    // The mock socket should have had close() called
    expect(mock.closed.length).toBeGreaterThanOrEqual(1);
  });

  // -------------------------------------------------------------------------
  // Test 5: server hb.sping triggers hb.spong reply (R11 client side)
  // -------------------------------------------------------------------------
  it("server hb.sping triggers hb.spong reply echoing the nonce", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));
    mock.simulateOpen();

    const testNonce = "abcdef1234567890"; // 16 hex chars
    mock.simulateMessage(JSON.stringify(spingFrame(testNonce)));

    // Find the outbound hb.spong
    const spongFrames = mock.sent
      .map((s) => JSON.parse(s) as Record<string, unknown>)
      .filter((f) => f["type"] === "hb.spong");

    expect(spongFrames.length).toBe(1);
    expect(spongFrames[0]!["echoNonce"]).toBe(testNonce);

    conn.close();
  });

  // -------------------------------------------------------------------------
  // Test 6: unknown pong nonce does not promote STALE → ALIVE
  // -------------------------------------------------------------------------
  it("unknown pong nonce does not promote STALE → ALIVE; RTT unchanged", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    mock.simulateOpen();

    // Advance to trigger first ping
    jest.advanceTimersByTime(PING_MS + 1);
    expect(conn.stats.inFlight).toBe(1);

    // Advance past pong timeout → STALE
    jest.advanceTimersByTime(PONG_MS + 1);
    expect(conn.state).toBe("STALE");

    const rttBefore = conn.stats.rtt;

    // Send a pong with an unrelated nonce
    mock.simulateMessage(JSON.stringify(pongFrame("0000000000000000")));

    // Must remain STALE; RTT must not have changed
    expect(conn.state).toBe("STALE");
    expect(conn.stats.rtt).toBe(rttBefore);

    // Clean up
    conn.close();
  });

  // -------------------------------------------------------------------------
  // Test 7: onUpdate fires on each transition + RTT update; unsubscribe works
  // -------------------------------------------------------------------------
  it("onUpdate fires on state changes + RTT; unsubscribe stops callbacks", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    const snapshots: ConnectionStats[] = [];
    const unsub = conn.onUpdate((stats) => {
      snapshots.push(stats);
    });

    // open → ALIVE (1 call)
    mock.simulateOpen();
    expect(snapshots.length).toBe(1);
    expect(snapshots[snapshots.length - 1]!.state).toBe("ALIVE");

    // ping tick → inFlight=1 (1 call)
    jest.advanceTimersByTime(PING_MS + 1);
    const postPingLen = snapshots.length;
    expect(postPingLen).toBeGreaterThanOrEqual(2);

    const nonce = lastPingNonce(mock);

    // pong → RTT set, inFlight=0 (1 call for RTT + inFlight update)
    mock.simulateMessage(JSON.stringify(pongFrame(nonce)));
    const postPongLen = snapshots.length;
    expect(postPongLen).toBeGreaterThan(postPingLen);
    expect(snapshots[snapshots.length - 1]!.rtt).not.toBeNull();

    // Unsubscribe
    unsub();

    // Trigger another transition — close → DEAD
    conn.close();

    // snapshots must not have grown after unsub
    expect(snapshots.length).toBe(postPongLen);
  });

  // -------------------------------------------------------------------------
  // Test 8: close() during STALE → DEAD; no further timer-driven transitions
  // -------------------------------------------------------------------------
  it("close() during STALE moves to DEAD and clears all timers", () => {
    const mock = new MockWebSocket();
    const conn = new Connection(makeOpts(mock));

    mock.simulateOpen();

    // Trigger STALE
    jest.advanceTimersByTime(PING_MS + 1);
    jest.advanceTimersByTime(PONG_MS + 1);
    expect(conn.state).toBe("STALE");

    // Explicitly close
    conn.close();
    expect(conn.state).toBe("DEAD");

    // Advance past stale grace — state should not change (timers cleared)
    jest.advanceTimersByTime(STALE_MS + 100);
    expect(conn.state).toBe("DEAD");

    // And no surprise changes after that
    jest.advanceTimersByTime(PING_MS * 3);
    expect(conn.state).toBe("DEAD");
  });
});
