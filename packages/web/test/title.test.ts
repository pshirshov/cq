/**
 * title.test.ts — Unit tests for attachTitleMirror (PR-16 / resilient-ws-ui V7).
 *
 * Uses the opts.doc test seam instead of happy-dom (no DOM requirement).
 */

import { describe, test, expect } from "bun:test";
import { attachTitleMirror } from "../src/ws/titleMirror";
import type { ManagerStats } from "../src/ws/Manager";

// ---------------------------------------------------------------------------
// Fake manager helpers
// ---------------------------------------------------------------------------

type UpdateCb = (stats: ManagerStats) => void;

function makeFakeManager(): {
  onUpdate(cb: UpdateCb): () => void;
  _emit(stats: ManagerStats): void;
} {
  const subs: UpdateCb[] = [];
  return {
    onUpdate(cb: UpdateCb): () => void {
      subs.push(cb);
      return () => {
        const idx = subs.indexOf(cb);
        if (idx !== -1) subs.splice(idx, 1);
      };
    },
    _emit(stats: ManagerStats): void {
      for (const cb of subs) cb(stats);
    },
  };
}

function makeStats(overrides: Partial<ManagerStats> = {}): ManagerStats {
  return {
    connections: [],
    activeConnectionId: null,
    attempt: 0,
    maxAttempts: 15,
    isTerminal: false,
    lastCloseCode: null,
    lastCloseReason: "",
    nextRetryAt: null,
    retryScheduledAt: null,
    pendingReconnectOnVisible: false,
    rttWindows: { "30s": null, "1m": null, "5m": null },
    lossPct: 0,
    events: [],
    ...overrides,
  };
}

type ConnState = ManagerStats["connections"][number]["state"];

function makeConn(id: string, state: ConnState): ManagerStats["connections"][number] {
  return {
    id,
    state,
    rtt: null,
    uptimeMs: 0,
    oldestPendingPingSentAt: null,
    enteredStaleAt: null,
    connectedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("attachTitleMirror", () => {
  test("empty manager (0 connections, not terminal, not deferred) → '(0/0) cq'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats());
    expect(doc.title).toBe("(0/0) cq");
  });

  test("1 ALIVE connection → '(1/1) cq'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats({
      connections: [makeConn("aaaa-0001", "ALIVE")],
      activeConnectionId: "aaaa-0001",
    }));
    expect(doc.title).toBe("(1/1) cq");
  });

  test("1 STALE connection → title contains '[STALE]'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats({
      connections: [makeConn("aaaa-0002", "STALE")],
    }));
    expect(doc.title).toContain("[STALE]");
  });

  test("isTerminal: true → '(0/0) cq [STOPPED]'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats({ isTerminal: true }));
    expect(doc.title).toBe("(0/0) cq [STOPPED]");
  });

  test("pendingReconnectOnVisible: true, no ALIVE → title contains '[DEFERRED]'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats({
      pendingReconnectOnVisible: true,
      connections: [makeConn("aaaa-0003", "NEW")],
    }));
    expect(doc.title).toContain("[DEFERRED]");
  });

  test("detach() stops further title updates", () => {
    const doc = { title: "initial" };
    const manager = makeFakeManager();
    const mirror = attachTitleMirror(manager, { doc });

    // First emit sets the title.
    manager._emit(makeStats());
    const titleAfterFirstEmit = doc.title;

    // Detach.
    mirror.detach();

    // Second emit should NOT change the title.
    manager._emit(makeStats({
      connections: [makeConn("aaaa-0004", "ALIVE")],
      activeConnectionId: "aaaa-0004",
    }));
    expect(doc.title).toBe(titleAfterFirstEmit);
  });

  test("NEW-only connection (no ALIVE yet) → title contains '[CONNECTING]'", () => {
    const doc = { title: "" };
    const manager = makeFakeManager();
    attachTitleMirror(manager, { doc });
    manager._emit(makeStats({
      connections: [makeConn("aaaa-0005", "NEW")],
    }));
    expect(doc.title).toContain("[CONNECTING]");
  });
});
