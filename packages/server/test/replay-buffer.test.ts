/**
 * replay-buffer.test.ts — Unit + integration tests for PR-09a.
 *
 * Required cases (≥ 8):
 *  1.  append() assigns monotonic seq starting at 1.
 *  2.  getSince(null) returns all buffered entries.
 *  3.  getSince(2) returns entries 3, 4, 5.
 *  4.  getSince(5) on a buffer with serverSeq=5 returns [].
 *  5.  getSince(0) when buffer evicted its first entry returns "GAP_EXCEEDS".
 *  6.  eviction by maxBytes keeps byte tally ≤ maxBytes.
 *  7.  SessionRegistry.create() yields unique UUIDs.
 *  8.  (integration) WsSession.message(session.request_state) with registered
 *      session replays missing entries then sends session.state.
 *  9.  (integration) Same but gap exceeds buffer → session.state{gapDetected:true}.
 *  10. (integration) session.request_state from a WS with chatSessionId === null
 *      → session.state{gapDetected:false, sessionId:null, serverSeq:0}.
 */

import { describe, it, expect } from "bun:test";
import { createReplayBuffer } from "../src/seq/replayBuffer";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import type { SessionState as RegistrySessionState } from "../src/seq/sessionRegistry";
import { WsSession, type WsSessionData } from "../src/ws/session";
import type { Logger } from "../src/log/logger";
import type { ChatEvent } from "@cq/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ChatEvent frame for test use. */
function makeChatEvent(overrides: Partial<ChatEvent> = {}): ChatEvent {
  return {
    type: "chat.event",
    seq: 0,
    ts: Date.now(),
    sessionId: "00000000-0000-4000-a000-000000000001",
    invocationId: "00000000-0000-4000-a000-000000000002",
    parentInvocationId: null,
    sdkEvent: { type: "text" },
    ...overrides,
  };
}

/** Minimal logger stub satisfying the Logger interface. */
const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

/** Minimal WS socket stub compatible with WsSession's structural WsSocket type. */
type SentRecord = string;
type ClosedRecord = { code: number | undefined; reason: string | undefined };

interface MockSocket {
  sent: SentRecord[];
  closedWith: ClosedRecord[];
  send(data: string): void;
  close(code?: number, reason?: string): void;
  data: WsSessionData;
}

function makeMockSocket(session: WsSession): MockSocket {
  const sock: MockSocket = {
    sent: [],
    closedWith: [],
    send(data: string) {
      sock.sent.push(data);
    },
    close(code?: number, reason?: string) {
      sock.closedWith.push({ code: code, reason: reason });
    },
    data: {
      sessionId: session.sessionId,
      session,
    },
  };
  return sock;
}

/** Drive WsSession.message() with a raw JSON frame. */
function sendRaw(
  wsSession: WsSession,
  socket: MockSocket,
  frame: Record<string, unknown>,
): void {
  // MockSocket is structurally compatible with WsSocket in session.ts
  wsSession.message(socket as Parameters<typeof wsSession.message>[0], JSON.stringify(frame));
}

// ---------------------------------------------------------------------------
// Suite 1: ReplayBuffer
// ---------------------------------------------------------------------------

describe("ReplayBuffer", () => {
  // Test 1
  it("append() assigns monotonic seq starting at 1", () => {
    const buf = createReplayBuffer();
    const r1 = buf.append(makeChatEvent());
    const r2 = buf.append(makeChatEvent());
    const r3 = buf.append(makeChatEvent());

    expect(r1.seq).toBe(1);
    expect(r2.seq).toBe(2);
    expect(r3.seq).toBe(3);
    expect(buf.serverSeq).toBe(3);
    expect(buf.size).toBe(3);
  });

  // Test 2
  it("getSince(null) returns all buffered entries", () => {
    const buf = createReplayBuffer();
    for (let i = 0; i < 5; i++) buf.append(makeChatEvent());

    const result = buf.getSince(null);
    expect(Array.isArray(result)).toBe(true);
    expect((result as readonly unknown[]).length).toBe(5);
  });

  // Test 3
  it("getSince(2) returns entries 3, 4, 5", () => {
    const buf = createReplayBuffer();
    for (let i = 0; i < 5; i++) buf.append(makeChatEvent());

    const result = buf.getSince(2);
    expect(Array.isArray(result)).toBe(true);
    const entries = result as ReadonlyArray<{ seq: number }>;
    expect(entries.length).toBe(3);
    expect(entries[0]!.seq).toBe(3);
    expect(entries[1]!.seq).toBe(4);
    expect(entries[2]!.seq).toBe(5);
  });

  // Test 4
  it("getSince(5) on a buffer with serverSeq=5 returns []", () => {
    const buf = createReplayBuffer();
    for (let i = 0; i < 5; i++) buf.append(makeChatEvent());

    const result = buf.getSince(5);
    expect(Array.isArray(result)).toBe(true);
    expect((result as readonly unknown[]).length).toBe(0);
  });

  // Test 5
  it("getSince(0) when buffer evicted its first entry returns GAP_EXCEEDS", () => {
    // maxEntries=3; append 5; seqs 1+2 are evicted, earliest in buffer is seq 3
    const buf = createReplayBuffer({ maxEntries: 3 });
    for (let i = 0; i < 5; i++) buf.append(makeChatEvent());

    expect(buf.size).toBe(3);
    const result = buf.getSince(0);
    expect(result).toBe("GAP_EXCEEDS");
  });

  // Test 6
  it("eviction by maxBytes keeps byte tally ≤ maxBytes", () => {
    // Each makeChatEvent frame serializes to > 100 bytes; set maxBytes=1000.
    const buf = createReplayBuffer({ maxBytes: 1000 });

    for (let i = 0; i < 15; i++) {
      buf.append(makeChatEvent());
    }

    expect(buf.bytes).toBeLessThanOrEqual(1000);
    expect(buf.size).toBeGreaterThan(0); // some entries remain
  });

  it("serverSeq is 0 when no frames have been appended", () => {
    const buf = createReplayBuffer();
    expect(buf.serverSeq).toBe(0);
  });

  it("getSince(null) on empty buffer returns []", () => {
    const buf = createReplayBuffer();
    const result = buf.getSince(null);
    expect(Array.isArray(result)).toBe(true);
    expect((result as readonly unknown[]).length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: SessionRegistry
// ---------------------------------------------------------------------------

describe("SessionRegistry", () => {
  // Test 7
  it("create() yields a unique UUID sessionId per call", () => {
    const registry = new SessionRegistry();
    const ids = new Set<string>();
    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    for (let i = 0; i < 10; i++) {
      const { sessionId } = registry.create();
      expect(uuidPattern.test(sessionId)).toBe(true);
      expect(ids.has(sessionId)).toBe(false);
      ids.add(sessionId);
    }
    expect(registry.size).toBe(10);
  });

  it("get() returns the session state created earlier", () => {
    const registry = new SessionRegistry();
    const { sessionId, state } = registry.create();
    const found = registry.get(sessionId);
    expect(found).toBe(state);
  });

  it("delete() removes the session", () => {
    const registry = new SessionRegistry();
    const { sessionId } = registry.create();
    expect(registry.size).toBe(1);
    registry.delete(sessionId);
    expect(registry.size).toBe(0);
    expect(registry.get(sessionId)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite 3: WsSession integration — session.request_state handling
// ---------------------------------------------------------------------------

/**
 * A registry subclass that injects a custom session state for one sessionId,
 * delegating all other lookups to the parent registry.
 */
class PatchedRegistry extends SessionRegistry {
  private readonly patchedId: string;
  private readonly patchedState: RegistrySessionState;

  constructor(id: string, state: RegistrySessionState) {
    super();
    this.patchedId = id;
    this.patchedState = state;
  }

  override get(sessionId: string): RegistrySessionState | undefined {
    if (sessionId === this.patchedId) return this.patchedState;
    return super.get(sessionId);
  }
}

describe("WsSession session.request_state handling", () => {
  // Test 8: happy replay path — client missed entries 3, 4, 5
  it("(integration) replays missing entries then sends session.state{gapDetected:false}", () => {
    const registry = new SessionRegistry();
    const { sessionId: chatSessionId, state } = registry.create();

    // Append 5 frames. Per the bridge invariant (PR-19), the bridge sets
    // frame.seq = assignedSeq before calling append so that replayed frames
    // carry the correct seq. Simulate that: append a placeholder, get the
    // assigned seq, then append the real frame with that seq pre-set.
    // Since the buffer assigns seqs 1..5 in order, we can compute them
    // directly as i+1.
    for (let i = 0; i < 5; i++) {
      // Compute the seq that append() will assign (nextSeq starts at 1).
      const expectedSeq = i + 1;
      state.buffer.append(makeChatEvent({ seq: expectedSeq }));
    }

    const wsSession = new WsSession("ws-conn-id-1", noopLogger, registry);
    wsSession.chatSessionId = chatSessionId;

    const socket = makeMockSocket(wsSession);

    // Client claims to have seen up to seq 2; server should replay seqs 3, 4, 5
    sendRaw(wsSession, socket, {
      type: "session.request_state",
      seq: 1,
      ts: Date.now(),
      lastSeenServerSeq: 2,
    });

    const parsed = socket.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
    const chatEvents = parsed.filter((f) => f["type"] === "chat.event");
    const stateFrames = parsed.filter((f) => f["type"] === "session.state");

    // Expect 3 replayed chat.event frames (seqs 3, 4, 5)
    expect(chatEvents.length).toBe(3);
    expect(stateFrames.length).toBe(1);

    // The replayed frames carry the original seq values from the buffer
    const replaySeqs = chatEvents.map((f) => f["seq"]);
    expect(replaySeqs).toEqual([3, 4, 5]);

    const stateFrame = stateFrames[0]!;
    expect(stateFrame["gapDetected"]).toBe(false);
    expect(stateFrame["sessionId"]).toBe(chatSessionId);
    expect(stateFrame["serverSeq"]).toBe(5);
  });

  // Test 9: gap exceeds buffer
  it("(integration) gap exceeds buffer → session.state{gapDetected:true}, no replay", () => {
    // Build a small buffer (maxEntries:2) and append 5 frames → only seqs 4+5 remain.
    const smallBuf = createReplayBuffer({ maxEntries: 2 });
    for (let i = 0; i < 5; i++) smallBuf.append(makeChatEvent());

    expect(smallBuf.size).toBe(2);
    expect(smallBuf.serverSeq).toBe(5);

    const fakeSessionId = "11111111-1111-4111-a111-111111111111";
    const fakeState: RegistrySessionState = {
      sessionId: fakeSessionId,
      buffer: smallBuf,
    };

    const patchedRegistry = new PatchedRegistry(fakeSessionId, fakeState);
    const wsSession = new WsSession("ws-conn-id-2", noopLogger, patchedRegistry);
    wsSession.chatSessionId = fakeSessionId;

    const socket = makeMockSocket(wsSession);
    // Client claims lastSeenServerSeq=0; earliest in buffer is seq 4 → GAP_EXCEEDS
    sendRaw(wsSession, socket, {
      type: "session.request_state",
      seq: 1,
      ts: Date.now(),
      lastSeenServerSeq: 0,
    });

    const parsed = socket.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
    const chatEvents = parsed.filter((f) => f["type"] === "chat.event");
    const stateFrames = parsed.filter((f) => f["type"] === "session.state");

    expect(chatEvents.length).toBe(0);
    expect(stateFrames.length).toBe(1);
    expect(stateFrames[0]!["gapDetected"]).toBe(true);
    expect(stateFrames[0]!["sessionId"]).toBe(fakeSessionId);
    expect(stateFrames[0]!["serverSeq"]).toBe(5);
  });

  // Test 10: null chatSessionId
  it("(integration) chatSessionId=null → session.state{gapDetected:false, sessionId:null, serverSeq:0}", () => {
    const registry = new SessionRegistry();
    const wsSession = new WsSession("ws-conn-id-3", noopLogger, registry);
    // chatSessionId stays null (default)

    const socket = makeMockSocket(wsSession);
    sendRaw(wsSession, socket, {
      type: "session.request_state",
      seq: 1,
      ts: Date.now(),
      lastSeenServerSeq: null,
    });

    const parsed = socket.sent.map((s) => JSON.parse(s) as Record<string, unknown>);
    const stateFrames = parsed.filter((f) => f["type"] === "session.state");
    const chatEvents = parsed.filter((f) => f["type"] === "chat.event");

    expect(chatEvents.length).toBe(0);
    expect(stateFrames.length).toBe(1);
    expect(stateFrames[0]!["gapDetected"]).toBe(false);
    expect(stateFrames[0]!["sessionId"]).toBeNull();
    expect(stateFrames[0]!["serverSeq"]).toBe(0);
  });
});
