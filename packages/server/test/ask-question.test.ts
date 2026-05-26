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

// ---------------------------------------------------------------------------
// Candidate-A spike — real SDK subprocess (PR-31-D01 resolution)
//
// This test drives the REAL SDK subprocess (no MockQuery / queryFactory) against
// MockAnthropicHTTP. The mock is scripted to:
//   1. First /v1/messages (small preflight call on startup): return simple text.
//   2. Second /v1/messages (main user prompt, body > 5 kB): return an assistant
//      message containing an AskUserQuestion tool_use.
//   3. Third+ /v1/messages (after tool_result injection): return a confirmation
//      assistant message whose text includes "Option B".
//
// The test then:
//   a. Waits for the bridge to surface the AskUserQuestion tool_use in a chat.event.
//   b. Calls bridge.handleChatQuestionReply() to inject the answer.
//   c. Asserts a subsequent chat.event carries an assistant message with "Option B".
//   d. Verifies chat.done reason=completed.
//
// If the real subprocess rejects the synthetic tool_result (Candidate-A fails),
// the third API call will be missing and the test will time out. In that case,
// fall back to Options.disallowedTools:['AskUserQuestion'] (Candidate-B).
// ---------------------------------------------------------------------------

import * as fsNode from "node:fs/promises";
import * as osNode from "node:os";
import * as pathNode from "node:path";
import {
  startMockAnthropic,
  ASK_USER_QUESTION_SSE_EVENTS,
  ASK_USER_QUESTION_CONFIRM_SSE_EVENTS,
  ASK_USER_QUESTION_TOOL_USE_ID,
} from "./helpers/MockAnthropicHTTP";

class RealSdkMockWsSocket implements WsSocket {
  readonly sent: ParsedFrame[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ParsedFrame);
  }

  close(): void {}

  framesOfType(type: string): ParsedFrame[] {
    return this.sent.filter((f) => f.type === type);
  }

  async waitForFrames(type: string, count = 1, timeoutMs = 25000): Promise<ParsedFrame[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frames = this.framesOfType(type);
      if (frames.length >= count) return frames;
      await Bun.sleep(50);
    }
    throw new Error(
      `Timed out waiting for ${count} frame(s) of type '${type}'; got ${this.framesOfType(type).length}; ` +
      `all seen: ${[...new Set(this.sent.map(f => f.type))].join(", ")}`,
    );
  }
}

describe("Candidate-A spike — AskUserQuestion via REAL SDK subprocess (PR-31-D01)", () => {
  it(
    "real subprocess: AskUserQuestion tool_use → injectAnswer → confirmation assistant message",
    async () => {
      const tmpHome = await fsNode.mkdtemp(pathNode.join(osNode.tmpdir(), "cq-ask-real-"));
      await fsNode.mkdir(pathNode.join(tmpHome, ".claude"), { recursive: true });

      let mock: import("./helpers/MockAnthropicHTTP").MockAnthropicHTTP | null = null;

      try {
        // Scripted multi-round responder:
        //  - Preflight requests (small body, < 5 kB): simple text response.
        //  - Main prompt request (body >= 5 kB, no tool_result): AskUserQuestion.
        //  - After tool_result injection: confirmation with "Option B".
        let askSent = false;
        const simpleSseBody = (() => {
          const simpleEvents = [
            {
              event: "message_start",
              data: { type: "message_start", message: { id: "msg_simple", type: "message", role: "assistant", content: [], model: "claude-test", stop_reason: null, stop_sequence: null, usage: { input_tokens: 5, output_tokens: 0 } } },
            },
            { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
            { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } } },
            { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
            { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } } },
            { event: "message_stop", data: { type: "message_stop" } },
          ] as import("./helpers/MockAnthropicHTTP").SSEEvent[];
          return simpleEvents
            .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
            .join("");
        })();

        mock = await startMockAnthropic({
          scriptedResponder: async (body: string) => {
            const hasToolResult = body.includes("tool_result");
            if (hasToolResult) {
              // Third+ call: tool_result was injected — return confirmation.
              return ASK_USER_QUESTION_CONFIRM_SSE_EVENTS;
            }
            if (!askSent && body.length >= 5000) {
              // Main prompt request: return AskUserQuestion tool_use.
              askSent = true;
              return ASK_USER_QUESTION_SSE_EVENTS;
            }
            // Preflight / small requests: return simple text.
            return new Response(simpleSseBody, {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            });
          },
        });

        process.env["ANTHROPIC_BASE_URL"] = mock.url;
        process.env["ANTHROPIC_API_KEY"] = "sk-test-fake";
        process.env["HOME"] = tmpHome;

        // Bridge with NO queryFactory — real SDK subprocess.
        const registry = new SessionRegistry();
        const bridge = new Bridge({
          logger: noopLogger,
          registry,
          cwd: tmpHome,
          home: tmpHome,
        });

        const ws = new RealSdkMockWsSocket();
        await bridge.handleChatStart(ws, { type: "chat.start", seq: 0, ts: Date.now() });

        // With the real SDK, chat.started only arrives after the subprocess
        // processes the first user message. Send chat.input immediately using
        // bridge.activeSessionId() which is set synchronously by handleChatStart.
        const sessionId = bridge.activeSessionId()!;

        // Send the user prompt that will trigger AskUserQuestion.
        await bridge.handleChatInput(ws, {
          type: "chat.input",
          seq: 1,
          ts: Date.now(),
          sessionId,
          text: "ask me something",
        });

        // Wait for chat.started (subprocess startup + first API round-trip).
        const [startedFrame] = await ws.waitForFrames("chat.started", 1, 25000);
        expect(startedFrame!.type).toBe("chat.started");
        const invocationId = startedFrame!.invocationId as string;

        // Wait for the AskUserQuestion tool_use to surface as a chat.event.
        // The SDK emits the assistant message containing the tool_use.
        let toolUseId: string | null = null;
        const deadline = Date.now() + 25000;
        while (Date.now() < deadline) {
          const events = ws.framesOfType("chat.event");
          for (const evt of events) {
            const sdkEvt = evt.sdkEvent as Record<string, unknown>;
            if (sdkEvt.type === "assistant") {
              const msg = sdkEvt.message as { content?: Array<{ type: string; name?: string; id?: string }> };
              const toolUse = (msg.content ?? []).find(
                (c) => c.type === "tool_use" && c.name === "AskUserQuestion",
              );
              if (toolUse) {
                toolUseId = toolUse.id ?? ASK_USER_QUESTION_TOOL_USE_ID;
                break;
              }
            }
          }
          if (toolUseId !== null) break;
          await Bun.sleep(50);
        }

        expect(toolUseId).not.toBeNull();
        expect(typeof toolUseId).toBe("string");

        // Inject the answer via the bridge.
        bridge.handleChatQuestionReply(ws, {
          type: "chat.question_reply",
          seq: 2,
          ts: Date.now(),
          sessionId,
          invocationId,
          toolUseId: toolUseId!,
          answers: { "0": ["Option B"] },
        });

        // Wait for a subsequent chat.event with an assistant message containing "Option B".
        const confirmDeadline = Date.now() + 25000;
        let confirmed = false;
        while (Date.now() < confirmDeadline) {
          const events = ws.framesOfType("chat.event");
          for (const evt of events) {
            const sdkEvt = evt.sdkEvent as Record<string, unknown>;
            if (sdkEvt.type === "assistant") {
              const msg = sdkEvt.message as { content?: Array<{ type: string; text?: string }> };
              const textBlock = (msg.content ?? []).find((c) => c.type === "text");
              if (textBlock?.text?.includes("Option B")) {
                confirmed = true;
                break;
              }
            }
          }
          if (confirmed) break;
          await Bun.sleep(50);
        }

        expect(confirmed).toBe(true);

        // The mock received at least 2 requests:
        //  1. Main prompt → AskUserQuestion
        //  2. After tool_result injection → confirmation
        expect(mock.requestCount()).toBeGreaterThanOrEqual(2);

        // Shut down the bridge to close the query and emit chat.done.
        await bridge.shutdown();

        const [doneFrame] = await ws.waitForFrames("chat.done", 1, 5000);
        expect(doneFrame!.reason).toBe("completed");
      } finally {
        await mock?.stop();
        await fsNode.rm(tmpHome, { recursive: true, force: true });
      }
    },
    35000, // generous timeout: subprocess + multi-round interaction
  );
});
