/**
 * interrupt.test.ts — Bridge interrupt path tests for PR-24.
 *
 * Tests:
 *  1. Interrupt mid-stream: yields 10 partial messages; interrupt fires at #3;
 *     chat.done reason=interrupted arrives within 500ms; no chat.event frames
 *     arrive after the interrupt is sent.
 *  2. Interrupt before any events: interrupt called immediately after chat.started;
 *     chat.done reason=interrupted; no chat.event frames at all.
 */

import { describe, it, expect } from "bun:test";
import { Bridge } from "../src/agent/bridge";
import type { QueryFactory } from "../src/agent/bridge";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import {
  noopLogger,
  MockWsSocket,
  patchStubs,
  makeInitMessage,
  makeAssistantMessage,
  makeChatStart,
  makeChatInterrupt,
  type MockQuery,
} from "./helpers/mockBridge";

// ---------------------------------------------------------------------------
// Local bridge factory
// ---------------------------------------------------------------------------

function makeBridge(queryFactory: QueryFactory): { bridge: Bridge; ws: MockWsSocket } {
  const registry = new SessionRegistry();
  const bridge = new Bridge({
    logger: noopLogger,
    registry,
    queryFactory,
    cwd: "/tmp/test",
  });
  return { bridge, ws: new MockWsSocket() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bridge interrupt path", () => {
  // --------------------------------------------------------------------------
  // Test 1: interrupt mid-stream at message #3 → no later events, done=interrupted
  // --------------------------------------------------------------------------
  it("interrupt at message #3 stops further events and emits chat.done reason=interrupted", async () => {
    const TOTAL = 10;
    const INTERRUPT_AT = 3; // fire interrupt after this many assistant events received

    // The generator yields init, then 10 assistant messages with a 30ms delay between each.
    // The test fires an interrupt after message #INTERRUPT_AT arrives.
    let resolveInterrupt!: () => void;
    const interruptGate = new Promise<void>((r) => { resolveInterrupt = r; });

    let interruptCalled = false;

    const asyncGen = (async function* (): AsyncGenerator<SDKMessage, void> {
      yield makeInitMessage();
      for (let i = 1; i <= TOTAL; i++) {
        await Bun.sleep(30);
        yield makeAssistantMessage(i);
      }
    })();

    const mockQuery = asyncGen as unknown as MockQuery;
    patchStubs(mockQuery);
    mockQuery.interruptCalled = false;
    mockQuery.interrupt = async () => {
      interruptCalled = true;
      mockQuery.interruptCalled = true;
      // Signal that interrupt was received, but the generator will drain naturally.
      resolveInterrupt();
    };
    mockQuery.close = () => {};

    const queryFactory: QueryFactory = () => mockQuery as unknown as Query;
    const { bridge, ws } = makeBridge(queryFactory);

    await bridge.handleChatStart(ws, makeChatStart());

    // Wait for chat.started to know the sessionId.
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    // Wait until INTERRUPT_AT events have arrived, then interrupt.
    await ws.waitForFrames("chat.event", INTERRUPT_AT, 5000);
    const eventCountAtInterrupt = ws.eventCount();

    await bridge.handleChatInterrupt(ws, makeChatInterrupt(sessionId));
    await interruptGate;

    // Wait for chat.done within 500ms.
    const dones = await ws.waitForFrames("chat.done", 1, 500);
    expect(dones[0]!.reason).toBe("interrupted");

    // Confirm interrupt() was called.
    expect(interruptCalled).toBe(true);

    // No chat.event frames should have arrived after the interrupt was processed.
    // (We allow up to eventCountAtInterrupt + 1 because one frame may have been
    // in-flight when the flag was set, but no further ones should arrive.)
    const finalEventCount = ws.eventCount();
    expect(finalEventCount).toBeLessThanOrEqual(eventCountAtInterrupt + 1);
    expect(finalEventCount).toBeLessThan(TOTAL);
  });

  // --------------------------------------------------------------------------
  // Test 2: interrupt immediately after chat.started → no events, done=interrupted
  // --------------------------------------------------------------------------
  it("interrupt before any events emits chat.done reason=interrupted with zero chat.event frames", async () => {
    // Generator yields init, then hangs until interrupt() is called, then ends.
    let resolveHang!: () => void;
    const hangPromise = new Promise<void>((r) => { resolveHang = r; });

    const asyncGen = (async function* (): AsyncGenerator<SDKMessage, void> {
      yield makeInitMessage();
      await hangPromise;
      // After interrupt, yield one message — should be discarded by aborting flag.
      yield makeAssistantMessage(1);
    })();

    const mockQuery = asyncGen as unknown as MockQuery;
    patchStubs(mockQuery);
    mockQuery.interruptCalled = false;
    mockQuery.interrupt = async () => {
      mockQuery.interruptCalled = true;
      resolveHang();
    };
    mockQuery.close = () => { resolveHang(); };

    const queryFactory: QueryFactory = () => mockQuery as unknown as Query;
    const { bridge, ws } = makeBridge(queryFactory);

    await bridge.handleChatStart(ws, makeChatStart());

    // Wait for chat.started.
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    // No events should have arrived yet.
    expect(ws.eventCount()).toBe(0);

    // Send interrupt immediately.
    const t0 = Date.now();
    await bridge.handleChatInterrupt(ws, makeChatInterrupt(sessionId));

    // chat.done should arrive within 500ms.
    const dones = await ws.waitForFrames("chat.done", 1, 500);
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(500);
    expect(dones[0]!.reason).toBe("interrupted");

    // Zero chat.event frames ever sent (the one yielded after resolveHang is
    // discarded because session.aborting is true).
    expect(ws.eventCount()).toBe(0);
  });
});
