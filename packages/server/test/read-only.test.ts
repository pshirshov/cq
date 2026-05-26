/**
 * read-only.test.ts — PR-29: read-only mode overlay via canUseTool (F-03).
 *
 * Test cases:
 *  1. Edit in read-only → returns {behavior:'deny', message:'Tool denied: read-only mode'};
 *     broker request() NOT called (no chat.permission_request WS frame emitted).
 *  2. Read in read-only → falls through to broker (broker receives the request).
 *  3. Edit in standard mode → overlay no-op; broker receives the request.
 */

import { describe, it, expect } from "bun:test";
import { applyReadOnlyOverlay } from "../src/agent/readOnlyOverlay";
import { Bridge } from "../src/agent/bridge";
import { PermissionBroker } from "../src/agent/permission";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import type { QueryFactory, WsSocket } from "../src/agent/bridge";
import type { Query, SDKMessage, CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "../src/log/logger";

// ---------------------------------------------------------------------------
// Noop logger
// ---------------------------------------------------------------------------

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// MockWsSocket
// ---------------------------------------------------------------------------

interface ParsedFrame {
  type: string;
  [key: string]: unknown;
}

class MockWsSocket implements WsSocket {
  readonly sent: ParsedFrame[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ParsedFrame);
  }

  close(): void {}

  framesOfType(type: string): ParsedFrame[] {
    return this.sent.filter((f) => f.type === type);
  }

  async waitForFrames(type: string, count = 1, timeoutMs = 3000): Promise<ParsedFrame[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frames = this.framesOfType(type);
      if (frames.length >= count) return frames;
      await Bun.sleep(10);
    }
    throw new Error(
      `Timed out waiting for ${count} frame(s) of type '${type}'; got ${this.framesOfType(type).length}`,
    );
  }
}

// ---------------------------------------------------------------------------
// MockQuery helpers (copied from permission.test.ts)
// ---------------------------------------------------------------------------

function makeInitMessage(): SDKMessage {
  return {
    type: "system",
    subtype: "init",
    agents: [],
    apiKeySource: "user",
    betas: [],
    claude_code_version: "0.0.0-test",
    cwd: "/tmp",
    tools: [],
    mcp_servers: [],
    model: "claude-test",
    permissionMode: "default",
    slash_commands: [],
    output_style: "text",
    skills: [],
    plugins: [],
    uuid: "00000000-0000-4000-a000-000000000001",
    session_id: "00000000-0000-4000-a000-000000000002",
  } as SDKMessage;
}

function makeHangingQueryFactory(
  canUseToolCapture: { fn: CanUseTool | null },
): QueryFactory {
  return ({ options }) => {
    if (options?.canUseTool !== undefined) {
      canUseToolCapture.fn = options.canUseTool;
    }

    let resolveHang!: () => void;
    const hangPromise = new Promise<void>((r) => { resolveHang = r; });

    const gen = (async function* (): AsyncGenerator<SDKMessage, void> {
      yield makeInitMessage();
      await hangPromise;
    })();

    const obj: Query = Object.assign(gen as unknown as Query, {
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
    });
    return obj;
  };
}

function makeChatStart(
  permissionMode?: import("@cq/shared").ChatStart["permissionMode"],
): import("@cq/shared").ChatStart {
  return { type: "chat.start", seq: 0, ts: Date.now(), permissionMode };
}

// ---------------------------------------------------------------------------
// Unit tests: applyReadOnlyOverlay in isolation
// ---------------------------------------------------------------------------

describe("applyReadOnlyOverlay (unit)", () => {
  it("Edit in read-only mode → deny without calling broker", async () => {
    let brokerCalled = false;
    const fakeBroker: CanUseTool = async () => {
      brokerCalled = true;
      return { behavior: "allow" };
    };

    const overlay = applyReadOnlyOverlay(fakeBroker, () => "read-only");

    const result = await overlay(
      "Edit",
      { file_path: "/foo.ts", old_string: "x", new_string: "y" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_01",
      } as Parameters<CanUseTool>[2],
    );

    expect(result.behavior).toBe("deny");
    expect((result as { message?: string }).message).toBe("Tool denied: read-only mode");
    expect(brokerCalled).toBe(false);
  });

  it("Read in read-only mode → falls through to broker", async () => {
    let brokerCalled = false;
    const fakeBroker: CanUseTool = async () => {
      brokerCalled = true;
      return { behavior: "allow" };
    };

    const overlay = applyReadOnlyOverlay(fakeBroker, () => "read-only");

    const result = await overlay(
      "Read",
      { file_path: "/foo.ts" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_02",
      } as Parameters<CanUseTool>[2],
    );

    expect(result.behavior).toBe("allow");
    expect(brokerCalled).toBe(true);
  });

  it("Edit in standard mode → overlay no-op; broker receives request", async () => {
    let brokerCalled = false;
    const fakeBroker: CanUseTool = async () => {
      brokerCalled = true;
      return { behavior: "allow" };
    };

    const overlay = applyReadOnlyOverlay(fakeBroker, () => "default");

    const result = await overlay(
      "Edit",
      { file_path: "/foo.ts", old_string: "x", new_string: "y" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_03",
      } as Parameters<CanUseTool>[2],
    );

    expect(result.behavior).toBe("allow");
    expect(brokerCalled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests: Bridge wires read-only overlay → PermissionBroker
// ---------------------------------------------------------------------------

describe("Bridge read-only overlay (integration)", () => {
  it("Edit in read-only session → deny; no chat.permission_request emitted", async () => {
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
    await bridge.handleChatStart(ws, makeChatStart("read-only"));
    await ws.waitForFrames("chat.started");

    const canUseTool = canUseToolCapture.fn!;
    expect(canUseTool).not.toBeNull();

    const result = await canUseTool(
      "Edit",
      { file_path: "/foo.ts", old_string: "a", new_string: "b" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_ro_01",
      } as Parameters<CanUseTool>[2],
    );

    expect(result.behavior).toBe("deny");
    expect((result as { message?: string }).message).toBe("Tool denied: read-only mode");
    // No chat.permission_request frame must have been sent.
    expect(ws.framesOfType("chat.permission_request")).toHaveLength(0);
    expect(broker.pendingCount()).toBe(0);

    await bridge.shutdown();
  });

  it("Read in read-only session → falls through to broker (chat.permission_request emitted)", async () => {
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
    await bridge.handleChatStart(ws, makeChatStart("read-only"));
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    const canUseTool = canUseToolCapture.fn!;

    const permissionPromise = canUseTool(
      "Read",
      { file_path: "/foo.ts" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_ro_02",
      } as Parameters<CanUseTool>[2],
    );

    // Broker should have emitted a chat.permission_request.
    const [permFrame] = await ws.waitForFrames("chat.permission_request");
    expect(permFrame!.toolName).toBe("Read");

    // Resolve it.
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

  it("Edit in standard (default) session → broker receives request", async () => {
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
    await bridge.handleChatStart(ws, makeChatStart("default"));
    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;

    const canUseTool = canUseToolCapture.fn!;

    const permissionPromise = canUseTool(
      "Edit",
      { file_path: "/foo.ts", old_string: "a", new_string: "b" },
      {
        signal: new AbortController().signal,
        toolUseID: "toolu_std_01",
      } as Parameters<CanUseTool>[2],
    );

    // Overlay must not intercept; broker emits the frame.
    const [permFrame] = await ws.waitForFrames("chat.permission_request");
    expect(permFrame!.toolName).toBe("Edit");

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
