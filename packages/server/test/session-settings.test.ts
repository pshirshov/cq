/**
 * session-settings.test.ts — D41: WS handler tests for settings.get / settings.set.
 *
 * Tests:
 *  1. settings.get → settings.get_result with current (default) values.
 *  2. settings.set{model:"X"} then settings.get → result has model="X".
 *  3. settings.get with persistence === null → no frame sent (no-op).
 */

import { describe, test, expect } from "bun:test";
import { WsSession, type WsSessionData } from "../src/ws/session.js";
import { InMemoryPersistence } from "../src/persist/InMemoryPersistence.js";
import { noopLogger } from "./helpers/mockBridge.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedFrame {
  type: string;
  seq: number;
  ts: number;
  [key: string]: unknown;
}

interface MockSocket {
  sent: ParsedFrame[];
  send(data: string): void;
  close(code?: number, reason?: string): void;
  data: WsSessionData;
}

function makeMockSocket(session: WsSession): MockSocket {
  const sock: MockSocket = {
    sent: [],
    send(data: string) {
      sock.sent.push(JSON.parse(data) as ParsedFrame);
    },
    close() {},
    data: { sessionId: session.sessionId, session },
  };
  return sock;
}

function sendRaw(
  wsSession: WsSession,
  socket: MockSocket,
  frame: Record<string, unknown>,
): void {
  wsSession.message(
    socket as Parameters<typeof wsSession.message>[0],
    JSON.stringify(frame),
  );
}

function framesOfType(socket: MockSocket, type: string): ParsedFrame[] {
  return socket.sent.filter((f) => f.type === type);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("D41: settings WS handler", () => {
  test("settings.get returns settings.get_result with defaults", () => {
    const persistence = new InMemoryPersistence();
    const wsSession = new WsSession("ws-1", noopLogger, undefined, null, persistence);
    const socket = makeMockSocket(wsSession);

    sendRaw(wsSession, socket, { type: "settings.get", seq: 1, ts: Date.now() });

    const results = framesOfType(socket, "settings.get_result");
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r["requestSeq"]).toBe(1);
    expect(r["model"]).toBeNull();
    expect(r["permissionMode"]).toBeNull();
    expect(r["hideSdkEvents"]).toBe(false);

    persistence.close();
  });

  test("settings.set then settings.get returns updated model", () => {
    const persistence = new InMemoryPersistence();
    const wsSession = new WsSession("ws-1", noopLogger, undefined, null, persistence);
    const socket = makeMockSocket(wsSession);

    sendRaw(wsSession, socket, {
      type: "settings.set",
      seq: 1,
      ts: Date.now(),
      model: "claude-opus-4-7",
    });

    sendRaw(wsSession, socket, { type: "settings.get", seq: 2, ts: Date.now() });

    const results = framesOfType(socket, "settings.get_result");
    expect(results).toHaveLength(1);
    const r = results[0]!;
    expect(r["requestSeq"]).toBe(2);
    expect(r["model"]).toBe("claude-opus-4-7");
    expect(r["permissionMode"]).toBeNull();
    expect(r["hideSdkEvents"]).toBe(false);

    persistence.close();
  });

  test("settings.get with no persistence wired sends no frame", () => {
    // persistence = null simulates a test/dev mode where history is not wired
    const wsSession = new WsSession("ws-1", noopLogger, undefined, null, null);
    const socket = makeMockSocket(wsSession);

    sendRaw(wsSession, socket, { type: "settings.get", seq: 1, ts: Date.now() });

    expect(framesOfType(socket, "settings.get_result")).toHaveLength(0);
  });
});
