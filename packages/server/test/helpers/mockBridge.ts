/**
 * mockBridge.ts — Shared test helpers for Bridge integration tests.
 *
 * Extracted from the 10+ test files that each had their own copy of
 * MockWsSocket, makeMockQuery, patchStubs, noopLogger, and SDK message
 * factories (QR-P7).
 */

import type { WsSocket } from "../../src/agent/bridge";
import type { Query, SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { Logger } from "../../src/log/logger";

// ---------------------------------------------------------------------------
// Noop logger
// ---------------------------------------------------------------------------

export const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// ParsedFrame — the shape of a decoded WS frame
// ---------------------------------------------------------------------------

export interface ParsedFrame {
  type: string;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// MockWsSocket
// ---------------------------------------------------------------------------

export class MockWsSocket implements WsSocket {
  readonly sent: ParsedFrame[] = [];
  readonly closed: Array<{ code?: number; reason?: string }> = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ParsedFrame);
  }

  close(code?: number, reason?: string): void {
    this.closed.push({
      ...(code !== undefined ? { code } : {}),
      ...(reason !== undefined ? { reason } : {}),
    });
  }

  framesOfType(type: string): ParsedFrame[] {
    return this.sent.filter((f) => f.type === type);
  }

  /** Wait until at least `count` frames of `type` have been received. */
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

  /** Snapshot the count of chat.event frames received so far. */
  eventCount(): number {
    return this.framesOfType("chat.event").length;
  }
}

// ---------------------------------------------------------------------------
// MockQuery
// ---------------------------------------------------------------------------

export type MockQuery = Query & { interruptCalled: boolean };

/**
 * Construct a MockQuery from a canned script of SDKMessages.
 * The query drains the script in order, then signals done.
 * Exposes `interruptCalled` to let tests assert interrupt was called.
 */
export function makeMockQuery(script: SDKMessage[]): MockQuery {
  let interruptCalled = false;
  let scriptIndex = 0;
  let done = false;

  const obj = {
    [Symbol.asyncIterator]() {
      return this;
    },
    next(): Promise<IteratorResult<SDKMessage, void>> {
      if (done) return Promise.resolve({ value: undefined, done: true as const });
      if (scriptIndex < script.length) {
        const msg = script[scriptIndex++]!;
        return Promise.resolve({ value: msg, done: false as const });
      }
      done = true;
      return Promise.resolve({ value: undefined, done: true as const });
    },
    return(): Promise<IteratorResult<SDKMessage, void>> {
      done = true;
      return Promise.resolve({ value: undefined, done: true as const });
    },
    throw(err?: unknown): Promise<IteratorResult<SDKMessage, void>> {
      done = true;
      return Promise.reject(err);
    },
    async interrupt(): Promise<void> {
      interruptCalled = true;
      obj.interruptCalled = true;
      done = true;
    },
    async setPermissionMode() {},
    async setModel() {},
    async setMaxThinkingTokens() {},
    async applyFlagSettings() {},
    async initializationResult() { throw new Error("not implemented in mock"); },
    async supportedCommands() { return []; },
    async supportedModels() { return []; },
    async supportedAgents() { return []; },
    async mcpServerStatus() { return []; },
    async getContextUsage() { throw new Error("not implemented in mock"); },
    async readFile() { return null; },
    async reloadPlugins() { throw new Error("not implemented in mock"); },
    async accountInfo() { throw new Error("not implemented in mock"); },
    async rewindFiles() { throw new Error("not implemented in mock"); },
    async seedReadState() {},
    async reconnectMcpServer() {},
    async toggleMcpServer() {},
    async setMcpServers() { throw new Error("not implemented in mock"); },
    async streamInput() {},
    async stopTask() {},
    async backgroundTasks() { return false; },
    close() { done = true; },
    interruptCalled,
  };

  return obj as unknown as MockQuery;
}

/**
 * Patch an arbitrary async-generator object with all Query stub methods.
 * Used when a test builds its own generator and needs the full Query interface.
 */
export function patchStubs(mockQuery: object): void {
  const stubs: Record<string, unknown> = {
    mcpServerStatus: async () => [],
    supportedCommands: async () => [],
    supportedModels: async () => [],
    supportedAgents: async () => [],
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
  };
  for (const [k, v] of Object.entries(stubs)) {
    (mockQuery as Record<string, unknown>)[k] = v;
  }
}

// ---------------------------------------------------------------------------
// SDK message factories
// ---------------------------------------------------------------------------

export function makeInitMessage(overrides: Record<string, unknown> = {}): SDKMessage {
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
    ...overrides,
  } as SDKMessage;
}

export function makeAssistantMessage(textOrIndex: string | number): SDKMessage {
  const text = typeof textOrIndex === "number" ? `message ${textOrIndex}` : textOrIndex;
  const idx = typeof textOrIndex === "number" ? textOrIndex : 0;
  return {
    type: "assistant",
    message: {
      id: `msg_test_${idx}`,
      type: "message",
      role: "assistant",
      content: [{ type: "text", text }],
      model: "claude-test",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: {
        input_tokens: 1,
        output_tokens: 1,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
      },
    },
    parent_tool_use_id: null,
    uuid: `00000000-0000-4000-a000-00000000000${idx}`,
    session_id: "00000000-0000-4000-a000-000000000002",
  } as unknown as SDKMessage;
}

/**
 * An end-of-turn `result` SDK message carrying cost + token usage, the shape the
 * SDK emits once per turn (mirrors the fields ClaudeBridge accumulates).
 */
export function makeResultMessage(
  opts: { costUsd?: number; inputTokens?: number; outputTokens?: number } = {},
): SDKMessage {
  return {
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 10,
    duration_api_ms: 8,
    num_turns: 1,
    result: "done",
    session_id: "00000000-0000-4000-a000-000000000002",
    total_cost_usd: opts.costUsd ?? 0,
    usage: {
      input_tokens: opts.inputTokens ?? 0,
      output_tokens: opts.outputTokens ?? 0,
    },
    uuid: "00000000-0000-4000-a000-0000000000ff",
  } as unknown as SDKMessage;
}

// ---------------------------------------------------------------------------
// Frame factories (ChatStart / ChatInput / ChatInterrupt)
// ---------------------------------------------------------------------------

export function makeChatStart(): import("@cq/shared").ChatStart {
  return { type: "chat.start", seq: 0, ts: Date.now() };
}

export function makeChatInput(sessionId: string, text: string): import("@cq/shared").ChatInput {
  return { type: "chat.input", seq: 1, ts: Date.now(), sessionId, text };
}

export function makeChatInterrupt(sessionId: string): import("@cq/shared").ChatInterrupt {
  return { type: "chat.interrupt", seq: 2, ts: Date.now(), sessionId };
}
