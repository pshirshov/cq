/**
 * permission.test.ts — PR-28: PermissionBroker + bridge canUseTool roundtrip.
 *
 * Test cases:
 *  1. allow: broker.request emits chat.permission_request; broker.reply('allow')
 *     resolves with PermissionResult{behavior:'allow'}.
 *  2. deny: broker.reply('deny') resolves with PermissionResult{behavior:'deny'}.
 *  3. allow_once: broker.reply('allow_once') resolves with PermissionResult{behavior:'allow'}.
 *  4. stale reply (unknown permissionRequestId) is silently ignored.
 *  5. rejectAll resolves all pending requests with deny and clears the map.
 *  6. Bridge canUseTool callback → chat.permission_request frame arrives on WS,
 *     then chat.permission_reply → broker resolves allow.
 *  7. Bridge canUseTool callback → chat.permission_reply with deny → PermissionResult deny.
 */

import { describe, it, expect } from "bun:test";
import { PermissionBroker } from "../src/agent/permission";
import { Bridge } from "../src/agent/bridge";
import type { QueryFactory } from "../src/agent/bridge";
import type { Query, SDKMessage, CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import type { ChatPermissionRequest } from "@cq/shared";
import {
  noopLogger,
  MockWsSocket,
  makeInitMessage,
  makeChatStart,
} from "./helpers/mockBridge";

// ---------------------------------------------------------------------------
// MockQuery — blocks on a hang promise until explicitly resolved.
// Exposes a `triggerCanUseTool` hook for tests.
// ---------------------------------------------------------------------------


/** Create a hanging async generator that captures the canUseTool callback for later use. */
function makeHangingQueryFactory(
  canUseToolCapture: { fn: CanUseTool | null },
): QueryFactory {
  return ({ options }) => {
    // Capture the canUseTool callback so the test can invoke it directly.
    if (options?.canUseTool !== undefined) {
      canUseToolCapture.fn = options.canUseTool;
    }

    let resolveHang!: () => void;
    const hangPromise = new Promise<void>((r) => {
      resolveHang = r;
    });

    const gen = (async function* (): AsyncGenerator<SDKMessage, void> {
      yield makeInitMessage();
      await hangPromise;
    })();

    const obj: Query & { _resolveHang: () => void } = Object.assign(gen as unknown as Query, {
      interrupt: async () => { resolveHang(); },
      close: () => { resolveHang(); },
      setPermissionMode: async () => {},
      setModel: async () => {},
      setMaxThinkingTokens: async () => {},
      applyFlagSettings: async () => {},
      streamInput: async () => {},
      stopTask: async () => {},
      backgroundTasks: async () => false,
      reconnectMcpServer: async () => {},
      toggleMcpServer: async () => {},
      seedReadState: async () => {},
      readFile: async () => null,
      getContextUsage: async () => { throw new Error("not implemented"); },
      initializationResult: async () => { throw new Error("not implemented"); },
      reloadPlugins: async () => { throw new Error("not implemented"); },
      accountInfo: async () => { throw new Error("not implemented"); },
      rewindFiles: async () => { throw new Error("not implemented"); },
      setMcpServers: async () => { throw new Error("not implemented"); },
      supportedCommands: async () => [],
      supportedModels: async () => [],
      supportedAgents: async () => [],
      mcpServerStatus: async () => [],
      _resolveHang: resolveHang,
    });
    return obj;
  };
}

// ---------------------------------------------------------------------------
// Unit tests for PermissionBroker in isolation
// ---------------------------------------------------------------------------

describe("PermissionBroker (unit)", () => {
  it("request emits chat.permission_request and resolves on allow reply", async () => {
    const broker = new PermissionBroker();
    const emitted: ChatPermissionRequest[] = [];
    broker.setSendFrame((f) => { emitted.push(f); });

    const resultPromise = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Bash",
      toolUseId: "toolu_01",
      input: { command: "ls" },
    });

    // Frame should have been emitted synchronously.
    expect(emitted).toHaveLength(1);
    const frame = emitted[0]!;
    expect(frame.type).toBe("chat.permission_request");
    expect(frame.toolName).toBe("Bash");
    expect(typeof frame.permissionRequestId).toBe("string");
    expect(broker.pendingCount()).toBe(1);

    // Reply with allow.
    broker.reply(frame.permissionRequestId, "allow");

    const result = await resultPromise;
    expect(result.behavior).toBe("allow");
    expect(broker.pendingCount()).toBe(0);
  });

  it("reply with 'deny' resolves with PermissionResult{behavior:'deny'}", async () => {
    const broker = new PermissionBroker();
    broker.setSendFrame(() => {});

    const resultPromise = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Write",
      toolUseId: "toolu_02",
      input: { file_path: "/etc/passwd", content: "" },
    });

    const broker2 = broker; // same broker
    // Extract the permissionRequestId from the pending map via pendingCount trick:
    // We can't directly access the map but we can call reply with a captured id.
    // Re-instrument: use a capture.
    const broker3 = new PermissionBroker();
    let capturedId = "";
    broker3.setSendFrame((f) => { capturedId = f.permissionRequestId; });
    const rp2 = broker3.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Write",
      toolUseId: "toolu_02",
      input: { file_path: "/etc/passwd" },
    });
    broker3.reply(capturedId, "deny");
    const result2 = await rp2;
    expect(result2.behavior).toBe("deny");
    // Suppress unused warning for resultPromise/broker2.
    void resultPromise;
    void broker2;
  });

  it("reply with 'allow_once' resolves with PermissionResult{behavior:'allow'}", async () => {
    const broker = new PermissionBroker();
    let capturedId = "";
    broker.setSendFrame((f) => { capturedId = f.permissionRequestId; });

    const resultPromise = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Read",
      toolUseId: "toolu_03",
      input: { file_path: "/etc/hosts" },
    });

    broker.reply(capturedId, "allow_once");
    const result = await resultPromise;
    expect(result.behavior).toBe("allow");
  });

  it("stale reply (unknown permissionRequestId) is silently ignored", () => {
    const broker = new PermissionBroker();
    broker.setSendFrame(() => {});
    // Should not throw.
    expect(() => broker.reply("00000000-0000-0000-0000-deadbeef0000", "allow")).not.toThrow();
  });

  it("rejectAll resolves pending requests with deny and clears the map", async () => {
    const broker = new PermissionBroker();
    broker.setSendFrame(() => {});

    const p1 = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Bash", toolUseId: "toolu_04", input: {},
    });
    const p2 = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Write", toolUseId: "toolu_05", input: {},
    });

    expect(broker.pendingCount()).toBe(2);
    broker.rejectAll();
    expect(broker.pendingCount()).toBe(0);

    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1.behavior).toBe("deny");
    expect(r2.behavior).toBe("deny");
  });

  it("QR-P5: request with null sendFrame emits a warn log instead of silently parking", async () => {
    const broker = new PermissionBroker();
    // Intentionally do NOT call setSendFrame — sendFrame stays null.

    const warnCalls: Array<[string, Record<string, unknown>]> = [];
    broker.setLogger({
      debug: () => {},
      info: () => {},
      warn: (event: string, ctx: Record<string, unknown>) => { warnCalls.push([event, ctx]); },
      error: () => {},
    });

    const resultPromise = broker.request({
      sessionId: "00000000-0000-0000-0000-000000000001",
      invocationId: "00000000-0000-0000-0000-000000000002",
      toolName: "Bash",
      toolUseId: "toolu_warn_01",
      input: { command: "ls" },
    });

    // The warn must have fired synchronously during request().
    expect(warnCalls).toHaveLength(1);
    expect(warnCalls[0]![0]).toBe("permission.sendFrame_null_request_parked");
    expect(warnCalls[0]![1].toolName).toBe("Bash");
    expect(warnCalls[0]![1].invocationId).toBe("00000000-0000-0000-0000-000000000002");

    // The pending entry still exists; resolve it so the test does not leak.
    broker.rejectAll();
    await resultPromise;
  });
});

// ---------------------------------------------------------------------------
// Integration tests: Bridge wires canUseTool → PermissionBroker
// ---------------------------------------------------------------------------

describe("Bridge + PermissionBroker (integration)", () => {
  it("canUseTool callback → chat.permission_request on WS → reply allow → PermissionResult allow", async () => {
    const canUseToolCapture: { fn: CanUseTool | null } = { fn: null };
    const queryFactory = makeHangingQueryFactory(canUseToolCapture);

    const registry = new SessionRegistry();
    const broker = new PermissionBroker();
    const bridge = new Bridge({
      logger: noopLogger,
      registry,
      queryFactory,
      cwd: "/tmp/test",
      permissionBroker: broker,
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeChatStart());

    // Wait for chat.started so the session is active.
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    // Simulate the SDK calling canUseTool.
    expect(canUseToolCapture.fn).not.toBeNull();
    const canUseTool = canUseToolCapture.fn!;

    const permissionPromise = canUseTool(
      "Bash",
      { command: "rm -rf /" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_integration_01",
        title: "Claude wants to run Bash",
        displayName: "Run command",
        description: "Claude will execute: rm -rf /",
      } as Parameters<CanUseTool>[2],
    );

    // Wait for chat.permission_request frame.
    const [permFrame] = await ws.waitForFrames("chat.permission_request");
    expect(permFrame!.type).toBe("chat.permission_request");
    expect(permFrame!.toolName).toBe("Bash");
    expect(permFrame!.sessionId).toBe(sessionId);
    expect(typeof permFrame!.permissionRequestId).toBe("string");

    // Simulate the client sending chat.permission_reply.
    bridge.handleChatPermissionReply(ws, {
      type: "chat.permission_reply",
      seq: 1,
      ts: Date.now(),
      sessionId,
      permissionRequestId: permFrame!.permissionRequestId as string,
      decision: "allow",
    });

    const result = await permissionPromise;
    expect(result.behavior).toBe("allow");

    await bridge.shutdown();
  });

  it("canUseTool callback → reply deny → PermissionResult deny", async () => {
    const canUseToolCapture: { fn: CanUseTool | null } = { fn: null };
    const queryFactory = makeHangingQueryFactory(canUseToolCapture);

    const registry = new SessionRegistry();
    const broker = new PermissionBroker();
    const bridge = new Bridge({
      logger: noopLogger,
      registry,
      queryFactory,
      cwd: "/tmp/test",
      permissionBroker: broker,
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeChatStart());
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    const canUseTool = canUseToolCapture.fn!;

    const permissionPromise = canUseTool(
      "Write",
      { file_path: "/etc/passwd", content: "hacked" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_integration_02",
      } as Parameters<CanUseTool>[2],
    );

    const [permFrame] = await ws.waitForFrames("chat.permission_request");
    expect(permFrame!.toolName).toBe("Write");

    bridge.handleChatPermissionReply(ws, {
      type: "chat.permission_reply",
      seq: 1,
      ts: Date.now(),
      sessionId,
      permissionRequestId: permFrame!.permissionRequestId as string,
      decision: "deny",
    });

    const result = await permissionPromise;
    expect(result.behavior).toBe("deny");

    await bridge.shutdown();
  });
});
