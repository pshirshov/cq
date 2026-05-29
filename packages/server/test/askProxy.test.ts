/**
 * Unit tests for the server-side AskProxy (askproxy / outer-14).
 *
 * AskProxy correlates askId ↔ toolUseId ↔ session across the inbound
 * ask.request (cq-mcp → server) and the browser chat.question_reply
 * (browser → server), and sends ask.reply back upstream. These tests
 * exercise the proxy in isolation with a captured sendReply + a scripted
 * resolveTarget — no Codex SDK, no real WS.
 */

import { describe, it, expect } from "bun:test";
import {
  AskProxy,
  buildAskUserQuestionEvent,
  type AskTarget,
} from "../src/agent/askProxy";
import { noopLogger } from "./helpers/mockBridge";

type Reply = { askId: string; answers: Record<string, unknown> };

function makeProxy(): { proxy: AskProxy; replies: Reply[] } {
  const replies: Reply[] = [];
  const proxy = new AskProxy({
    logger: noopLogger,
    sendReply: (askId, answers) => replies.push({ askId, answers }),
  });
  return { proxy, replies };
}

describe("buildAskUserQuestionEvent", () => {
  it("produces the assistant tool_use shape the browser renders", () => {
    const ev = buildAskUserQuestionEvent("tu-1", [{ question: "Q" }], "gpt-x");
    expect(ev.type).toBe("assistant");
    expect(ev.message.role).toBe("assistant");
    expect(ev.message.model).toBe("gpt-x");
    expect(ev.message.content).toHaveLength(1);
    const block = ev.message.content[0]!;
    expect(block.type).toBe("tool_use");
    expect(block.name).toBe("AskUserQuestion");
    expect(block.id).toBe("tu-1");
    expect(block.input).toEqual({ questions: [{ question: "Q" }] });
    expect(ev.parent_tool_use_id).toBeNull();
  });
});

describe("AskProxy — happy path correlation", () => {
  it("emits the synthetic event then proxies the reply back by askId", () => {
    const { proxy, replies } = makeProxy();
    const emitted: unknown[] = [];
    const target: AskTarget = { emit: (m) => emitted.push(m), model: "m1" };

    proxy.onAskRequest(
      { askId: "ask-1", toolUseId: "tu-1", sessionId: "S1", questions: [{ q: 1 }] },
      () => target,
    );
    expect(emitted).toHaveLength(1);
    expect(proxy.hasCorrelation("tu-1")).toBe(true);
    expect(replies).toHaveLength(0); // no reply yet

    const ok = proxy.onQuestionReply({
      sessionId: "S1",
      toolUseId: "tu-1",
      answers: { q: "answer" },
    });
    expect(ok).toBe(true);
    expect(replies).toEqual([{ askId: "ask-1", answers: { q: "answer" } }]);
    expect(proxy.hasCorrelation("tu-1")).toBe(false);
  });
});

describe("AskProxy — no active session", () => {
  it("replies immediately with empty answers so cq-mcp does not hang", () => {
    const { proxy, replies } = makeProxy();
    proxy.onAskRequest(
      { askId: "ask-x", toolUseId: "tu-x", sessionId: "GONE", questions: [{ q: 1 }] },
      () => null,
    );
    expect(replies).toEqual([{ askId: "ask-x", answers: {} }]);
    expect(proxy.hasCorrelation("tu-x")).toBe(false);
  });
});

describe("AskProxy — stale + mismatched replies", () => {
  it("drops a reply for an unknown toolUseId", () => {
    const { proxy, replies } = makeProxy();
    const ok = proxy.onQuestionReply({
      sessionId: "S1",
      toolUseId: "never-asked",
      answers: { q: "x" },
    });
    expect(ok).toBe(false);
    expect(replies).toHaveLength(0);
  });

  it("drops a reply whose sessionId does not match the ask", () => {
    const { proxy, replies } = makeProxy();
    const target: AskTarget = { emit: () => {}, model: "m" };
    proxy.onAskRequest(
      { askId: "ask-1", toolUseId: "tu-1", sessionId: "S1", questions: [{ q: 1 }] },
      () => target,
    );
    const ok = proxy.onQuestionReply({
      sessionId: "OTHER",
      toolUseId: "tu-1",
      answers: { q: "x" },
    });
    expect(ok).toBe(false);
    expect(replies).toHaveLength(0);
    // The correlation is retained (a correct-session reply could still come).
    expect(proxy.hasCorrelation("tu-1")).toBe(true);
  });
});

describe("AskProxy — clear on shutdown", () => {
  it("treats a post-clear reply as stale", () => {
    const { proxy, replies } = makeProxy();
    const target: AskTarget = { emit: () => {}, model: "m" };
    proxy.onAskRequest(
      { askId: "ask-1", toolUseId: "tu-1", sessionId: "S1", questions: [{ q: 1 }] },
      () => target,
    );
    proxy.clear();
    expect(proxy.hasCorrelation("tu-1")).toBe(false);
    const ok = proxy.onQuestionReply({
      sessionId: "S1",
      toolUseId: "tu-1",
      answers: { q: "x" },
    });
    expect(ok).toBe(false);
    expect(replies).toHaveLength(0);
  });
});

describe("AskProxy — multiple concurrent asks", () => {
  it("routes each reply to its own askId", () => {
    const { proxy, replies } = makeProxy();
    const target: AskTarget = { emit: () => {}, model: "m" };
    proxy.onAskRequest(
      { askId: "ask-A", toolUseId: "tu-A", sessionId: "S1", questions: [{ q: 1 }] },
      () => target,
    );
    proxy.onAskRequest(
      { askId: "ask-B", toolUseId: "tu-B", sessionId: "S1", questions: [{ q: 2 }] },
      () => target,
    );
    proxy.onQuestionReply({ sessionId: "S1", toolUseId: "tu-B", answers: { q: "b" } });
    proxy.onQuestionReply({ sessionId: "S1", toolUseId: "tu-A", answers: { q: "a" } });
    expect(replies).toEqual([
      { askId: "ask-B", answers: { q: "b" } },
      { askId: "ask-A", answers: { q: "a" } },
    ]);
  });
});
