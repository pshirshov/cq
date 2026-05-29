/**
 * ClaudeProducer failure-mode tests (PR-wf-2).
 *
 * The SUCCESS path (model calls submit_plan → handler resolves) requires the
 * real SDK subprocess to route the tool_use to the in-process handler; it is
 * covered by workflow-integration.test.ts against MockAnthropicHTTP. Here we
 * cover the failure modes that DON'T need the tool handler:
 *  - the query stream ends without a submit → reject
 *  - an abort signal → reject
 *  - a timeout → reject
 * all via the injected QueryFactory (no real subprocess).
 */

import { describe, it, expect } from "bun:test";
import { ClaudeProducer } from "../src/workflow/claudeProducer";
import { noopLogger, makeMockQuery, makeInitMessage, makeAssistantMessage } from "./helpers/mockBridge";

describe("ClaudeProducer failure modes", () => {
  it("rejects when the producer stream ends without calling submit_plan", async () => {
    const producer = new ClaudeProducer({
      logger: noopLogger,
      cwd: "/tmp",
      queryFactory: () => makeMockQuery([makeInitMessage(), makeAssistantMessage("I'm thinking…")]),
    });
    await expect(producer.produce({ text: "build X" })).rejects.toThrow(/without calling submit_plan/);
  });

  it("rejects when the abort signal fires", async () => {
    // A query that never ends, so only the abort can resolve the outcome.
    const neverEnding = makeMockQuery([]);
    // Replace next() with a forever-pending promise so the drain loop blocks.
    (neverEnding as unknown as { next: () => Promise<never> }).next = () => new Promise<never>(() => {});
    const ctrl = new AbortController();
    const producer = new ClaudeProducer({
      logger: noopLogger,
      cwd: "/tmp",
      queryFactory: () => neverEnding,
    });
    const p = producer.produce({ text: "build X", signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toThrow(/aborted/);
  });

  it("rejects on timeout when the producer never submits", async () => {
    const neverEnding = makeMockQuery([]);
    (neverEnding as unknown as { next: () => Promise<never> }).next = () => new Promise<never>(() => {});
    const producer = new ClaudeProducer({
      logger: noopLogger,
      cwd: "/tmp",
      queryFactory: () => neverEnding,
      timeoutMs: 50,
    });
    await expect(producer.produce({ text: "build X" })).rejects.toThrow(/timed out/);
  });
});
