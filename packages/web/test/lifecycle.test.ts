/**
 * lifecycle.test.ts — Tests for attachPageLifecycle + Manager PR-10 hooks.
 *
 * DOM environment choice: Bun's test runner does not expose `document` or
 * `window` globals. We use the MockDoc / MockWindow / MockNav helpers
 * (test/helpers/MockDocument.ts) and inject them via the `targets` option
 * of attachPageLifecycle(). This keeps tests hermetic and fast.
 *
 * Manager is constructed with isVisible: () => testVisible (a mutable flag)
 * to control the tab-visibility perception, plus the standard fake-socket
 * injection from PR-09 tests.
 *
 * 9 test cases covering all required scenarios.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from "bun:test";
import { Manager } from "../src/ws/Manager";
import type { ManagerOpts } from "../src/ws/Manager";
import { attachPageLifecycle } from "../src/lib/pageLifecycle";
import type { PageLifecycleTargets } from "../src/lib/pageLifecycle";
import { MockWebSocket } from "./helpers/MockWebSocket";
import {
  MockDoc,
  MockWindow,
  MockNav,
  MockConnection,
  makePageTransitionEvent,
} from "./helpers/MockDocument";

// ---------------------------------------------------------------------------
// Timing constants (compressed)
// ---------------------------------------------------------------------------
const PING_MS = 500;
const PONG_MS = 200;
const STALE_MS = 150;
const CONNECT_MS = 300;
const BASE_BACKOFF_MS = 100;
const MAX_BACKOFF_MS = 800;

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
// Shared test harness state
// ---------------------------------------------------------------------------

let testVisible = true;
let doc: MockDoc;
let win: MockWindow;
let nav: MockNav;
let targets: PageLifecycleTargets;

function makeOpts(extra: Partial<ManagerOpts> = {}): ManagerOpts {
  return {
    url: "ws://test",
    pingIntervalMs: PING_MS,
    pongTimeoutMs: PONG_MS,
    staleGraceMs: STALE_MS,
    connectTimeoutMs: CONNECT_MS,
    baseBackoffMs: BASE_BACKOFF_MS,
    maxBackoffMs: MAX_BACKOFF_MS,
    maxAttempts: 15,
    socketFactory: makeFactory(),
    random: () => 1.0,
    isVisible: () => testVisible,
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe("Page Lifecycle (PR-10)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    testVisible = true;
    doc = new MockDoc();
    win = new MockWindow();
    nav = new MockNav();
    targets = { doc, win, nav };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // Test 1: visibilitychange → hidden does nothing immediate
  // -------------------------------------------------------------------------
  it("visibilitychange → hidden does nothing immediate", () => {
    const m = new Manager(makeOpts());
    const { detach } = attachPageLifecycle(m, { targets });

    // Set hidden; fire visibilitychange
    testVisible = false;
    doc.visibilityState = "hidden";
    doc.dispatchEvent("visibilitychange", new Event("visibilitychange"));

    // The initial connection was spawned by Manager constructor.
    // Visibility change to hidden should NOT spawn another connection,
    // close existing ones, or alter connection count.
    expect(m.stats.connections.length).toBe(1);
    // pendingReconnectOnVisible should still be false (no backoff was deferred yet)
    expect(m.stats.pendingReconnectOnVisible).toBe(false);

    m.destroy();
    detach();
  });

  // -------------------------------------------------------------------------
  // Test 2: reconnect scheduled while hidden sets pendingReconnectOnVisible
  // -------------------------------------------------------------------------
  it("reconnect scheduled while hidden defers via pendingReconnectOnVisible", () => {
    testVisible = false; // Start with tab hidden
    doc.visibilityState = "hidden";

    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    // Let connection reach ALIVE first (so it enters the retriable close path)
    sock0.simulateOpen();
    expect(m.stats.connections[0]!.state).toBe("ALIVE");

    // Server closes with retriable code → _scheduleBackoff() fires
    // Tab is hidden → should defer instead of scheduling the timer
    sock0.simulateClose(1011, "internal error");

    // nextRetryAt should be null (deferred, not scheduled)
    expect(m.stats.nextRetryAt).toBeNull();
    // pendingReconnectOnVisible should be true
    expect(m.stats.pendingReconnectOnVisible).toBe(true);
    // Pool should be empty (the connection died)
    expect(m.stats.connections.length).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Test 3: visibilitychange → visible runs pending reconnect immediately
  // -------------------------------------------------------------------------
  it("visibilitychange → visible clears pendingReconnectOnVisible and spawns connection", () => {
    testVisible = false;
    doc.visibilityState = "hidden";

    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    sock0.simulateOpen();
    sock0.simulateClose(1011, "internal error");

    // Verify deferred state
    expect(m.stats.pendingReconnectOnVisible).toBe(true);
    expect(m.stats.connections.length).toBe(0);

    // Tab becomes visible
    testVisible = true;
    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange", new Event("visibilitychange"));

    // Pending reconnect should have fired immediately
    expect(m.stats.pendingReconnectOnVisible).toBe(false);
    // A new connection should have been spawned
    expect(m.stats.connections.length).toBe(1);
    expect(sockets.length).toBe(2);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 4: online → checkConnections() called
  // -------------------------------------------------------------------------
  it("online event triggers checkConnections — spawns connection when pool empty and retrying", () => {
    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    // Connection dies → backoff scheduled
    sock0.simulateClose(1011, "internal error");
    expect(m.stats.nextRetryAt).not.toBeNull();

    // Fire online event — checkConnections should cancel backoff and spawn immediately
    nav.dispatchEvent("online", new Event("online"));

    // Pool should now have a new connection (spawned immediately)
    expect(m.stats.connections.length).toBe(1);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 5: pagehide(persisted:true) → closeForBFCache: sockets closed
  // -------------------------------------------------------------------------
  it("pagehide(persisted:true) closes all sockets for BFCache", () => {
    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    sock0.simulateOpen();
    expect(m.stats.connections.length).toBe(1);

    // Dispatch pagehide with persisted:true
    win.dispatchEvent("pagehide", makePageTransitionEvent("pagehide", true));

    // All connections should be closed
    expect(m.stats.connections.length).toBe(0);
    expect(m.stats.activeConnectionId).toBeNull();
    // The underlying socket should have been closed
    expect(sock0.closed.length).toBeGreaterThanOrEqual(1);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 6: pageshow(persisted:true) → reopenFromBFCache spawns new connection
  // -------------------------------------------------------------------------
  it("pageshow(persisted:true) after pagehide reopens connection from BFCache", () => {
    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    sock0.simulateOpen();
    expect(m.stats.connections.length).toBe(1);

    // BFCache suspend: pagehide
    win.dispatchEvent("pagehide", makePageTransitionEvent("pagehide", true));
    expect(m.stats.connections.length).toBe(0);

    // BFCache restore: pageshow
    win.dispatchEvent("pageshow", makePageTransitionEvent("pageshow", true));

    // A fresh connection should have been spawned
    expect(m.stats.connections.length).toBe(1);
    expect(sockets.length).toBe(2); // original + new

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 7: resume → handleResume(elapsed) called; spawns replacement
  // -------------------------------------------------------------------------
  it("resume event triggers handleResume and spawns replacement when connection exists", () => {
    const m = new Manager(makeOpts());
    attachPageLifecycle(m, { targets, resumeElapsedMs: PONG_MS * 3 });

    const sock0 = sockets[0]!;
    sock0.simulateOpen();
    expect(m.stats.connections.length).toBe(1);

    // Dispatch resume with resumeElapsedMs > pongTimeoutMs → proactive replacement
    win.dispatchEvent("resume", new Event("resume"));

    // Pool should now have 2 connections (original + replacement)
    expect(m.stats.connections.length).toBe(2);
    expect(sockets.length).toBe(2);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 8: Network Information API change → checkConnections
  // -------------------------------------------------------------------------
  it("Network Information API change event triggers checkConnections", () => {
    const m = new Manager(makeOpts());
    const netConn = new MockConnection();
    nav.connection = netConn;

    attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    sock0.simulateClose(1011, "internal error");
    // Backoff is scheduled; cancel and spawn via checkConnections
    expect(m.stats.connections.length).toBe(0);

    netConn.dispatchEvent("change", new Event("change"));

    // checkConnections should have spawned a new connection
    expect(m.stats.connections.length).toBe(1);

    m.destroy();
  });

  // -------------------------------------------------------------------------
  // Test 9: detach() removes all listeners — no hooks fire after detach
  // -------------------------------------------------------------------------
  it("detach() removes all listeners; subsequent events fire no Manager hooks", () => {
    testVisible = false;
    doc.visibilityState = "hidden";

    const m = new Manager(makeOpts());
    const { detach } = attachPageLifecycle(m, { targets });

    const sock0 = sockets[0]!;
    sock0.simulateOpen();
    sock0.simulateClose(1011, "internal error");

    // Verify deferred state is active
    expect(m.stats.pendingReconnectOnVisible).toBe(true);

    // Detach all listeners
    detach();

    // Now fire visibilitychange → visible; runPendingReconnect should NOT fire
    testVisible = true;
    doc.visibilityState = "visible";
    doc.dispatchEvent("visibilitychange", new Event("visibilitychange"));

    // pendingReconnectOnVisible should still be true (handler was detached)
    expect(m.stats.pendingReconnectOnVisible).toBe(true);
    // No new connection should have been spawned
    expect(m.stats.connections.length).toBe(0);

    // Fire online — should not trigger checkConnections
    const countBefore = sockets.length;
    nav.dispatchEvent("online", new Event("online"));
    expect(sockets.length).toBe(countBefore);

    m.destroy();
  });
});
