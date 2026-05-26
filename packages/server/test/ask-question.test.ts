/**
 * ask-question.test.ts — PR-31: AskUserQuestion answer injection.
 *
 * Test cases:
 *  1. injectAnswer pushes a synthetic SDKUserMessage tool_result onto the queue.
 *  2. handleChatQuestionReply with a MockQuery-backed Bridge injects the SDKUserMessage
 *     onto the queue (verified via the queue's outbound side).
 *
 * CONSTRAINT (PR-31-D01): These tests use MockQuery; the real bundled CLI binary
 * is unavailable in this environment. Real-SDK verification is deferred to PR-51.
 * Fallback if Candidate A is disconfirmed: Options.disallowedTools:['AskUserQuestion'].
 */

import { describe, it, expect } from "bun:test";
import { injectAnswer } from "../src/agent/askUserQuestion";
import { Bridge } from "../src/agent/bridge";
import type { QueryFactory, WsSocket } from "../src/agent/bridge";
import type { Query, SDKMessage, SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { SessionRegistry } from "../src/seq/sessionRegistry";
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
// Minimal PushableQueue for unit testing injectAnswer
// ---------------------------------------------------------------------------

interface Pushable<T> {
  push(item: T): void;
}

class CapturingQueue<T> implements Pushable<T> {
  readonly items: T[] = [];
  push(item: T): void {
    this.items.push(item);
  }
}

// ---------------------------------------------------------------------------
// MockQuery factory (hangs until resolveHang called; yields init message first)
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

type HangingQueryResult = {
  queryFactory: QueryFactory;
  capturedMessages: SDKUserMessage[];
  resolveHang: () => void;
};

function makeHangingQueryFactory(): HangingQueryResult {
  const capturedMessages: SDKUserMessage[] = [];
  let resolveHang!: () => void;

  const queryFactory: QueryFactory = ({ prompt }) => {
    const hangPromise = new Promise<void>((r) => {
      resolveHang = r;
    });

    // Consume the prompt AsyncIterable and capture all pushed messages.
    void (async () => {
      for await (const msg of prompt) {
        capturedMessages.push(msg);
      }
    })();

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

  return { queryFactory, capturedMessages, resolveHang: () => resolveHang?.() };
}

function makeChatStart(): import("@cq/shared").ChatStart {
  return { type: "chat.start", seq: 0, ts: Date.now() };
}

// ---------------------------------------------------------------------------
// Unit test: injectAnswer pushes synthetic SDKUserMessage
// ---------------------------------------------------------------------------

describe("injectAnswer (unit)", () => {
  it("pushes a tool_result SDKUserMessage onto the queue", () => {
    const queue = new CapturingQueue<SDKUserMessage>();
    const toolUseId = "tu-000-test";
    const answers = { "0": ["Option B"] };

    injectAnswer(queue, toolUseId, answers);

    expect(queue.items).toHaveLength(1);
    const msg = queue.items[0]!;
    expect(msg.type).toBe("user");
    expect(msg.parent_tool_use_id).toBeNull();

    const msgRecord = msg.message as unknown as Record<string, unknown>;
    const content = msgRecord["content"];
    expect(Array.isArray(content)).toBe(true);
    const block = (content as unknown[])[0] as Record<string, unknown>;
    expect(block["type"]).toBe("tool_result");
    expect(block["tool_use_id"]).toBe(toolUseId);

    // Content should be a JSON string containing the answers.
    const parsed = JSON.parse(block["content"] as string) as Record<string, unknown>;
    expect(parsed["answers"]).toEqual(answers);
  });

  it("encodes multi-select answers correctly", () => {
    const queue = new CapturingQueue<SDKUserMessage>();
    const toolUseId = "tu-001-multi";
    const answers = { "0": ["Feature A", "Feature C"] };

    injectAnswer(queue, toolUseId, answers);

    const block = ((queue.items[0]!.message as unknown as Record<string, unknown>)["content"] as unknown[])[0] as Record<string, unknown>;
    const parsed = JSON.parse(block["content"] as string) as Record<string, unknown>;
    expect((parsed["answers"] as Record<string, unknown>)["0"]).toEqual(["Feature A", "Feature C"]);
  });
});

// ---------------------------------------------------------------------------
// Integration test: Bridge.handleChatQuestionReply injects SDKUserMessage
// ---------------------------------------------------------------------------

describe("Bridge.handleChatQuestionReply (integration)", () => {
  it("injects SDKUserMessage tool_result onto the queue when session is active", async () => {
    const { queryFactory, capturedMessages } = makeHangingQueryFactory();

    const registry = new SessionRegistry();
    const bridge = new Bridge({
      logger: noopLogger,
      registry,
      queryFactory,
      cwd: "/tmp/test",
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeChatStart());

    const [startedFrame] = await ws.waitForFrames("chat.started");
    const sessionId = startedFrame!.sessionId as string;
    const invocationId = startedFrame!.invocationId as string;

    const toolUseId = "tu-ask-001";
    const answers = { "0": ["Choice B"] };

    bridge.handleChatQuestionReply(ws, {
      type: "chat.question_reply",
      seq: 1,
      ts: Date.now(),
      sessionId,
      invocationId,
      toolUseId,
      answers,
    });

    // Allow the async consumer coroutine to process the pushed message.
    await Bun.sleep(20);

    const injected = capturedMessages.find((m) => {
      const content = (m.message as unknown as Record<string, unknown>)["content"] as unknown[];
      return Array.isArray(content) && content.length > 0 &&
        (content[0] as Record<string, unknown>)["type"] === "tool_result" &&
        (content[0] as Record<string, unknown>)["tool_use_id"] === toolUseId;
    });

    expect(injected).toBeDefined();
    const block = ((injected!.message as unknown as Record<string, unknown>)["content"] as unknown[])[0] as Record<string, unknown>;
    const parsed = JSON.parse(block["content"] as string) as Record<string, unknown>;
    expect((parsed["answers"] as Record<string, unknown>)["0"]).toEqual(["Choice B"]);

    await bridge.shutdown();
  });

  it("stale reply (wrong sessionId) is silently ignored", async () => {
    const { queryFactory, capturedMessages } = makeHangingQueryFactory();

    const registry = new SessionRegistry();
    const bridge = new Bridge({
      logger: noopLogger,
      registry,
      queryFactory,
      cwd: "/tmp/test",
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeChatStart());
    await ws.waitForFrames("chat.started");

    bridge.handleChatQuestionReply(ws, {
      type: "chat.question_reply",
      seq: 1,
      ts: Date.now(),
      sessionId: "00000000-0000-0000-0000-deadbeef0000",
      invocationId: "00000000-0000-0000-0000-deadbeef0001",
      toolUseId: "tu-stale",
      answers: { "0": ["X"] },
    });

    await Bun.sleep(20);
    // No tool_result messages should have been captured (only the normal chat.start user msg may not appear either).
    const toolResultMsgs = capturedMessages.filter((m) => {
      const content = (m.message as unknown as Record<string, unknown>)["content"] as unknown[];
      return Array.isArray(content) && content.length > 0 &&
        (content[0] as Record<string, unknown>)["type"] === "tool_result";
    });
    expect(toolResultMsgs).toHaveLength(0);

    await bridge.shutdown();
  });
});
