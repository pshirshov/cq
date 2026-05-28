/**
 * Ledger integration test (REAL SDK against MockAnthropicHTTP).
 *
 * Verifies the full L7 wiring: a Bridge constructed with a real
 * FsLedgerStore exposes the `mcp__cq__enumerate_ledgers` tool to the
 * subprocess, the mocked Anthropic API can invoke it, the in-process MCP
 * handler executes against the store, and the tool_result flows back into
 * the conversation.
 *
 * This is the Q12 "full integration" smoke: tools are reachable end-to-end
 * via the real SDK subprocess. It does not exercise every tool — the unit
 * tests in packages/ledger/test/mcp-tools.test.ts cover wire shape, and
 * the dual-tests suite covers semantics.
 */

import { describe, it, expect } from "bun:test";
import * as fsNode from "node:fs/promises";
import * as osNode from "node:os";
import * as pathNode from "node:path";

import { Bridge, type WsSocket } from "../src/agent/bridge";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import { FsLedgerStore, serializeRegistry } from "@cq/ledger";
import { noopLogger, type ParsedFrame } from "./helpers/mockBridge";
import { startMockAnthropic, type SSEEvent } from "./helpers/MockAnthropicHTTP";

const ENUMERATE_TOOL_USE_ID = "toolu_ledger_enum_001";

function sseFromEvents(events: SSEEvent[]): Response {
  const body = events
    .map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`)
    .join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

// SSE that triggers the model to call mcp__cq__enumerate_ledgers.
const ENUMERATE_LEDGERS_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: "msg_ledger_1",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-stub",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 0 },
      },
    },
  },
  {
    event: "content_block_start",
    data: {
      type: "content_block_start",
      index: 0,
      content_block: {
        type: "tool_use",
        id: ENUMERATE_TOOL_USE_ID,
        name: "mcp__cq__enumerate_ledgers",
        input: {},
      },
    },
  },
  {
    event: "content_block_delta",
    data: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "input_json_delta", partial_json: "{}" },
    },
  },
  { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
  {
    event: "message_delta",
    data: {
      type: "message_delta",
      delta: { stop_reason: "tool_use", stop_sequence: null },
      usage: { output_tokens: 8 },
    },
  },
  { event: "message_stop", data: { type: "message_stop" } },
];

// SSE confirming the ledger list was received — includes "ALPHA-LEDGER"
// substring so the test can assert the tool result re-entered the prompt.
const CONFIRM_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: {
        id: "msg_ledger_2",
        type: "message",
        role: "assistant",
        content: [],
        model: "claude-3-5-sonnet-stub",
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 20, output_tokens: 0 },
      },
    },
  },
  {
    event: "content_block_start",
    data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
  },
  {
    event: "content_block_delta",
    data: {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "Ledgers seen: ALPHA-LEDGER" },
    },
  },
  { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
  {
    event: "message_delta",
    data: {
      type: "message_delta",
      delta: { stop_reason: "end_turn", stop_sequence: null },
      usage: { output_tokens: 4 },
    },
  },
  { event: "message_stop", data: { type: "message_stop" } },
];

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
        `all seen: ${[...new Set(this.sent.map((f) => f.type))].join(", ")}`,
    );
  }
}

describe("ledger MCP — REAL SDK subprocess via MockAnthropicHTTP", () => {
  it(
    "model can call mcp__cq__enumerate_ledgers and the tool result returns into the conversation",
    async () => {
      // Set up a tmp HOME so the SDK doesn't read the developer's real ~/.claude.
      const tmpHome = await fsNode.mkdtemp(pathNode.join(osNode.tmpdir(), "cq-ledger-int-"));
      await fsNode.mkdir(pathNode.join(tmpHome, ".claude"), { recursive: true });

      // Set up a tmp cwd with a pre-populated ledgers.yaml containing ALPHA-LEDGER.
      const tmpCwd = await fsNode.mkdtemp(pathNode.join(osNode.tmpdir(), "cq-ledger-cwd-"));
      await fsNode.mkdir(pathNode.join(tmpCwd, "docs"), { recursive: true });
      await fsNode.writeFile(
        pathNode.join(tmpCwd, "docs", "ledgers.yaml"),
        serializeRegistry({
          version: 1,
          ledgers: [
            {
              name: "ALPHA-LEDGER",
              schema: {
                statusValues: ["open", "done"],
                terminalStatuses: ["done"],
                fields: {},
              },
            },
          ],
        }),
        "utf8",
      );
      const ledgerStore = new FsLedgerStore({ root: tmpCwd });
      await ledgerStore.init();

      let enumerateSent = false;
      const simpleSseBody = sseFromEvents([
        {
          event: "message_start",
          data: {
            type: "message_start",
            message: {
              id: "msg_simple",
              type: "message",
              role: "assistant",
              content: [],
              model: "claude-test",
              stop_reason: null,
              stop_sequence: null,
              usage: { input_tokens: 5, output_tokens: 0 },
            },
          },
        },
        {
          event: "content_block_start",
          data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        },
        {
          event: "content_block_delta",
          data: {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: "ok" },
          },
        },
        { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
        {
          event: "message_delta",
          data: {
            type: "message_delta",
            delta: { stop_reason: "end_turn", stop_sequence: null },
            usage: { output_tokens: 1 },
          },
        },
        { event: "message_stop", data: { type: "message_stop" } },
      ]);

      const mock = await startMockAnthropic({
        scriptedResponder: async (body: string) => {
          const hasToolResult = body.includes("tool_result");
          if (hasToolResult) return CONFIRM_SSE_EVENTS;
          if (!enumerateSent && body.length >= 5000) {
            enumerateSent = true;
            return ENUMERATE_LEDGERS_SSE_EVENTS;
          }
          return simpleSseBody.clone();
        },
      });

      process.env["ANTHROPIC_BASE_URL"] = mock.url;
      process.env["ANTHROPIC_API_KEY"] = "sk-test-fake";
      process.env["HOME"] = tmpHome;

      const registry = new SessionRegistry();
      const bridge = new Bridge({
        logger: noopLogger,
        registry,
        cwd: tmpCwd,
        home: tmpHome,
        ledgerStore,
      });

      const ws = new RealSdkMockWsSocket();
      try {
        await bridge.handleChatStart(ws, { type: "chat.start", seq: 0, ts: Date.now() });
        const sessionId = bridge.activeSessionId()!;
        await bridge.handleChatInput(ws, {
          type: "chat.input",
          seq: 1,
          ts: Date.now(),
          sessionId,
          text: "list the ledgers please",
        });

        await ws.waitForFrames("chat.started", 1, 25000);

        // Wait for the confirmation text "ALPHA-LEDGER" to appear in an
        // assistant chat.event — that proves the tool_result re-entered the
        // conversation and the model produced a follow-up text reply.
        const deadline = Date.now() + 30000;
        let saw = false;
        while (Date.now() < deadline) {
          const events = ws.framesOfType("chat.event");
          for (const evt of events) {
            const sdkEvt = evt.sdkEvent as Record<string, unknown>;
            if (sdkEvt.type === "assistant") {
              const msg = sdkEvt.message as { content?: Array<{ type: string; text?: string }> };
              const text = (msg.content ?? []).find((c) => c.type === "text");
              if (text?.text?.includes("ALPHA-LEDGER")) {
                saw = true;
                break;
              }
            }
          }
          if (saw) break;
          await Bun.sleep(50);
        }
        expect(saw).toBe(true);
        // Also confirm a tool_use for our enumerate name landed on the wire.
        const events = ws.framesOfType("chat.event");
        const sawToolUse = events.some((evt) => {
          const sdkEvt = evt.sdkEvent as Record<string, unknown>;
          if (sdkEvt.type !== "assistant") return false;
          const msg = sdkEvt.message as { content?: Array<{ type: string; name?: string }> };
          return (msg.content ?? []).some(
            (c) => c.type === "tool_use" && c.name === "mcp__cq__enumerate_ledgers",
          );
        });
        expect(sawToolUse).toBe(true);
      } finally {
        await bridge.shutdown();
        await mock.stop();
        await ledgerStore.dispose();
        await fsNode.rm(tmpHome, { recursive: true, force: true }).catch(() => undefined);
        await fsNode.rm(tmpCwd, { recursive: true, force: true }).catch(() => undefined);
      }
    },
    60_000,
  );
});
