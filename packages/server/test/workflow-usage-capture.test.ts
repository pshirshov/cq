/**
 * wfhist-2: phase-subagent usage capture from the SDK `result` message.
 *
 * `extractUsageFromResult` is the pure extractor the Claude headless lanes
 * (claudeProducer / claudePhaseSubagent) call inside their drain loop to fire
 * `onUsage` with the model + cost + token counts. These tests pin its contract;
 * the end-to-end drain wiring (model actually submits, then a `result` fires
 * `onUsage`) is exercised by the real-SDK integration suite
 * (workflow-integration.test.ts against MockAnthropicHTTP).
 */

import { describe, test, it, expect } from "bun:test";
import * as fsNode from "node:fs/promises";
import * as osNode from "node:os";
import * as pathNode from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { extractUsageFromResult } from "../src/workflow/headlessQuery";
import { ClaudeProducer } from "../src/workflow/claudeProducer";
import type { PhaseUsage } from "../src/workflow/producer";
import { makeResultMessage, makeAssistantMessage, makeInitMessage, noopLogger } from "./helpers/mockBridge";
import { startMockAnthropic, type SSEEvent } from "./helpers/MockAnthropicHTTP";

describe("wfhist-2: extractUsageFromResult", () => {
  test("returns usage for a result message, using the fallback model", () => {
    const msg = makeResultMessage({ costUsd: 0.42, inputTokens: 1200, outputTokens: 340 });
    const usage = extractUsageFromResult(msg, "claude-sonnet-test");
    expect(usage).toEqual({
      model: "claude-sonnet-test",
      costUsd: 0.42,
      inputTokens: 1200,
      outputTokens: 340,
    });
  });

  test("prefers the model from result.modelUsage when present", () => {
    const msg = {
      ...(makeResultMessage({ costUsd: 1, inputTokens: 2, outputTokens: 3 }) as object),
      modelUsage: { "claude-opus-actual": { input_tokens: 2 } },
    } as unknown as SDKMessage;
    const usage = extractUsageFromResult(msg, "fallback-model");
    expect(usage?.model).toBe("claude-opus-actual");
  });

  test("returns undefined for non-result messages", () => {
    expect(extractUsageFromResult(makeInitMessage(), "m")).toBeUndefined();
    expect(extractUsageFromResult(makeAssistantMessage("hi"), "m")).toBeUndefined();
  });

  test("defaults missing cost/token fields to 0", () => {
    const bare = { type: "result", subtype: "success" } as unknown as SDKMessage;
    expect(extractUsageFromResult(bare, "m")).toEqual({
      model: "m",
      costUsd: 0,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────── //
// Drain wiring: a REAL SDK subprocess that submits then ends-of-turn fires
// `onUsage`. Proves the dispatch keeps draining past submit to observe `result`.
// ─────────────────────────────────────────────────────────────────────────── //

const SUBMIT_TOOL_USE_ID = "toolu_usage_001";
const SUBMIT_INPUT = {
  goal: { title: "Usage probe", description: "A probe goal for usage capture." },
  questions: [{ question: "Which platform?", recommendation: "web" }],
};

const SUBMIT_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: {
      type: "message_start",
      message: { id: "msg_u_1", type: "message", role: "assistant", content: [], model: "claude-test", stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 0 } },
    },
  },
  { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: SUBMIT_TOOL_USE_ID, name: "mcp__wf__submit_plan", input: {} } } },
  { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "input_json_delta", partial_json: JSON.stringify(SUBMIT_INPUT) } } },
  { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
  { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "tool_use", stop_sequence: null }, usage: { output_tokens: 8 } } },
  { event: "message_stop", data: { type: "message_stop" } },
];

const DONE_SSE_EVENTS: SSEEvent[] = [
  {
    event: "message_start",
    data: { type: "message_start", message: { id: "msg_u_2", type: "message", role: "assistant", content: [], model: "claude-test", stop_reason: null, stop_sequence: null, usage: { input_tokens: 20, output_tokens: 0 } } },
  },
  { event: "content_block_start", data: { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } } },
  { event: "content_block_delta", data: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "submitted" } } },
  { event: "content_block_stop", data: { type: "content_block_stop", index: 0 } },
  { event: "message_delta", data: { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 2 } } },
  { event: "message_stop", data: { type: "message_stop" } },
];

describe("wfhist-2: onUsage fires from a REAL SDK result message", () => {
  it(
    "producer.produce captures usage after the model submits + the turn completes",
    async () => {
      const tmpHome = await fsNode.mkdtemp(pathNode.join(osNode.tmpdir(), "cq-usage-home-"));
      await fsNode.mkdir(pathNode.join(tmpHome, ".claude"), { recursive: true });
      const tmpCwd = await fsNode.mkdtemp(pathNode.join(osNode.tmpdir(), "cq-usage-cwd-"));

      let submitSent = false;
      const mock = await startMockAnthropic({
        scriptedResponder: async (body: string) => {
          if (body.includes("tool_result")) return DONE_SSE_EVENTS;
          if (!submitSent && body.length >= 5000) {
            submitSent = true;
            return SUBMIT_SSE_EVENTS;
          }
          return DONE_SSE_EVENTS;
        },
      });

      process.env["ANTHROPIC_BASE_URL"] = mock.url;
      process.env["ANTHROPIC_API_KEY"] = "sk-test-fake";
      process.env["HOME"] = tmpHome;

      const producer = new ClaudeProducer({ logger: noopLogger, cwd: tmpCwd, timeoutMs: 40_000 });
      const usages: PhaseUsage[] = [];
      try {
        const out = await producer.produce({
          text: "build a usage probe app",
          model: "claude-probe-model",
          onUsage: (u) => usages.push(u),
        });
        expect(out.goal.title).toBe("Usage probe");
        // The dispatch resolves at submit-time; the result message fires onUsage
        // shortly after. Give the background drain a moment to observe it.
        const deadline = Date.now() + 5_000;
        while (usages.length === 0 && Date.now() < deadline) {
          await new Promise((r) => setTimeout(r, 20));
        }
        expect(usages.length).toBe(1);
        // Model falls back to the request model (the result message carries no
        // top-level model field in this mock).
        expect(usages[0]!.model).toBe("claude-probe-model");
        // Token/cost fields are present (exact values are SDK-computed against
        // the mock; assert the shape + non-negativity rather than magic numbers).
        expect(usages[0]!.inputTokens).toBeGreaterThanOrEqual(0);
        expect(usages[0]!.outputTokens).toBeGreaterThanOrEqual(0);
        expect(usages[0]!.costUsd).toBeGreaterThanOrEqual(0);
      } finally {
        await mock.stop();
        await fsNode.rm(tmpHome, { recursive: true, force: true }).catch(() => undefined);
        await fsNode.rm(tmpCwd, { recursive: true, force: true }).catch(() => undefined);
      }
    },
    60_000,
  );
});
