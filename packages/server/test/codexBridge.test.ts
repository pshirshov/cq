/**
 * codexBridge.test.ts — codex-5 unit tests.
 *
 * Uses a hand-written `DummyCodex` implementing the @openai/codex-sdk
 * Codex/Thread interface (per the dual-tests skill — manual dummy
 * preferred over auto-generated mocks). Verifies:
 *
 *  - Auth refusal when no `~/.codex/auth.json` and no OPENAI_API_KEY.
 *  - Session row persisted with platform='codex' and effort=<chosen>.
 *  - chat.started emitted with the assigned sessionId.
 *  - chat.input runs a turn; agent_message → chat.event(assistant);
 *    turn.completed → chat.done(completed); usage accumulators land.
 *  - Reasoning-effort tier forwarded to ThreadOptions (via the dummy's
 *    captured options).
 *  - Permission-mode (codex-prefixed) forwarded to ThreadOptions.sandboxMode.
 *  - Thread id captured into session.sdkSessionId after thread.started.
 *  - chat.interrupt aborts the turn; chat.done(interrupted) emitted.
 */

import { describe, it, expect } from "bun:test";
import { CodexBridge } from "../src/agent/codexBridge";
import type { CodexFactory } from "../src/agent/codexBridge";
import type {
  Codex,
  Thread,
  ThreadEvent,
  ThreadOptions,
  Input,
  TurnOptions,
  RunStreamedResult,
  RunResult,
} from "@openai/codex-sdk";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import { InMemoryPersistence } from "../src/persist/InMemoryPersistence";
import {
  noopLogger,
  MockWsSocket,
} from "./helpers/mockBridge";

// ---------------------------------------------------------------------------
// DummyCodex — hand-written dummy implementing the Codex/Thread interface
// ---------------------------------------------------------------------------

interface DummyThreadCallLog {
  input: Input;
  turnOpts: TurnOptions | undefined;
}

class DummyThread implements Pick<Thread, "id" | "runStreamed" | "run"> {
  readonly callLog: DummyThreadCallLog[] = [];
  /** Events to emit from the next runStreamed call. */
  scriptedEvents: ThreadEvent[];
  readonly threadOptions: ThreadOptions;
  private _id: string | null;
  /** When set, runStreamed waits on this promise before iterating. */
  hangUntil: Promise<void> | null = null;
  /** Number of resume calls; tracked for resumeThread assertions. */
  isResumed: boolean;

  constructor(opts: ThreadOptions, isResumed = false, presetThreadId: string | null = null) {
    this.threadOptions = opts;
    this.isResumed = isResumed;
    this._id = presetThreadId;
    this.scriptedEvents = [];
  }

  get id(): string | null { return this._id; }

  async runStreamed(input: Input, turnOpts?: TurnOptions): Promise<RunStreamedResult> {
    this.callLog.push({ input, turnOpts });
    const events = this.scriptedEvents;
    const hang = this.hangUntil;
    const setId = (id: string): void => {
      this._id = id;
    };
    async function* gen(): AsyncGenerator<ThreadEvent> {
      for (const e of events) {
        if (hang !== null) await hang;
        if (e.type === "thread.started") setId(e.thread_id);
        yield e;
      }
    }
    return { events: gen() };
  }

  async run(_input: Input, _turnOpts?: TurnOptions): Promise<RunResult> {
    throw new Error("DummyThread.run is not exercised in these tests");
  }
}

class DummyCodex implements Pick<Codex, "startThread" | "resumeThread"> {
  startCalls = 0;
  resumeCalls: Array<{ id: string; opts: ThreadOptions | undefined }> = [];
  /** The most recently created thread; tests inspect/script it. */
  lastThread: DummyThread | null = null;

  startThread(opts?: ThreadOptions): Thread {
    this.startCalls++;
    const thread = new DummyThread(opts ?? {});
    this.lastThread = thread;
    return thread as unknown as Thread;
  }

  resumeThread(id: string, opts?: ThreadOptions): Thread {
    this.resumeCalls.push({ id, opts });
    const thread = new DummyThread(opts ?? {}, true, id);
    this.lastThread = thread;
    return thread as unknown as Thread;
  }
}

function makeBridge(opts: { authed?: boolean; codex?: DummyCodex } = {}): {
  bridge: CodexBridge;
  persistence: InMemoryPersistence;
  codex: DummyCodex;
} {
  const persistence = new InMemoryPersistence();
  const registry = new SessionRegistry();
  const codex = opts.codex ?? new DummyCodex();
  const codexFactory: CodexFactory = async (): Promise<Codex> => codex as unknown as Codex;
  const bridge = new CodexBridge({
    logger: noopLogger,
    registry,
    cwd: "/tmp/codex-test",
    persistence,
    codexFactory,
    detectAuth: () => opts.authed !== false,
  });
  return { bridge, persistence, codex };
}

function makeStart(overrides: Partial<{
  effort: "none" | "low" | "medium" | "high" | "max";
  model: string;
  permissionMode: string;
  resumeFromInvocationId: string;
  approvalPolicy: "never" | "on-request" | "on-failure" | "untrusted";
}> = {}): import("@cq/shared").ChatStart {
  return {
    type: "chat.start",
    seq: 0,
    ts: Date.now(),
    platform: "codex",
    model: overrides.model ?? "gpt-5.1",
    ...(overrides.effort !== undefined ? { effort: overrides.effort } : {}),
    ...(overrides.permissionMode !== undefined
      ? { permissionMode: overrides.permissionMode as never }
      : {}),
    ...(overrides.resumeFromInvocationId !== undefined
      ? { resumeFromInvocationId: overrides.resumeFromInvocationId as never }
      : {}),
    ...(overrides.approvalPolicy !== undefined
      ? { approvalPolicy: overrides.approvalPolicy }
      : {}),
  } as import("@cq/shared").ChatStart;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CodexBridge", () => {
  it("refuses chat.start when no auth is detected", async () => {
    const { bridge } = makeBridge({ authed: false });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart());
    const errors = ws.framesOfType("chat.error");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("codex-not-authenticated");
    expect(bridge.isBusy()).toBe(false);
  });

  it("emits chat.started and persists session row with platform='codex' and effort", async () => {
    const { bridge, persistence } = makeBridge({ authed: true });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({ effort: "high" }));
    const started = ws.framesOfType("chat.started");
    expect(started).toHaveLength(1);
    const sessionId = started[0]!.sessionId as string;
    const row = persistence.sessions.get(sessionId);
    expect(row).toBeDefined();
    expect(row!.platform).toBe("codex");
    expect(row!.effort).toBe("high");
    expect(row!.model).toBe("gpt-5.1");
    expect(bridge.isBusy()).toBe(true);
    await bridge.shutdown();
  });

  it("forwards modelReasoningEffort and sandboxMode to startThread", async () => {
    const { bridge, codex } = makeBridge({ authed: true });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({
      effort: "max",
      permissionMode: "codex-workspace-write",
    }));
    expect(codex.startCalls).toBe(1);
    const thread = codex.lastThread!;
    expect(thread.threadOptions.modelReasoningEffort).toBe("xhigh");
    expect(thread.threadOptions.sandboxMode).toBe("workspace-write");
    expect(thread.threadOptions.workingDirectory).toBe("/tmp/codex-test");
    expect(thread.threadOptions.model).toBe("gpt-5.1");
    await bridge.shutdown();
  });

  // gcn1-2: ChatStart.approvalPolicy → ThreadOptions.approvalPolicy + persisted on session row.
  it("forwards approvalPolicy to ThreadOptions and persists it on the session row", async () => {
    const { bridge, codex, persistence } = makeBridge({ authed: true });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({
      effort: "medium",
      approvalPolicy: "untrusted",
    }));
    const thread = codex.lastThread!;
    expect(thread.threadOptions.approvalPolicy).toBe("untrusted");
    const sessionId = ws.framesOfType("chat.started")[0]!.sessionId as string;
    expect(persistence.sessions.get(sessionId)!.approvalPolicy).toBe("untrusted");
    await bridge.shutdown();
  });

  it("omits approvalPolicy from ThreadOptions when not on the frame; persists null", async () => {
    const { bridge, codex, persistence } = makeBridge({ authed: true });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({ effort: "low" }));
    const thread = codex.lastThread!;
    expect(thread.threadOptions.approvalPolicy).toBeUndefined();
    const sessionId = ws.framesOfType("chat.started")[0]!.sessionId as string;
    expect(persistence.sessions.get(sessionId)!.approvalPolicy).toBeNull();
    await bridge.shutdown();
  });

  it("runs a turn: agent_message → chat.event(assistant), turn.completed → chat.done(completed)", async () => {
    const { bridge, codex, persistence } = makeBridge({ authed: true });
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({ effort: "medium" }));
    const sessionId = (ws.framesOfType("chat.started")[0]!.sessionId as string);

    // Script the dummy thread to emit a thread.started, an agent_message, then turn.completed.
    codex.lastThread!.scriptedEvents = [
      { type: "thread.started", thread_id: "thr-xyz" },
      { type: "turn.started" },
      {
        type: "item.completed",
        item: {
          id: "msg-1",
          type: "agent_message",
          text: "Hello from Codex!",
        },
      },
      {
        type: "turn.completed",
        usage: {
          input_tokens: 12,
          cached_input_tokens: 0,
          output_tokens: 7,
          reasoning_output_tokens: 3,
        },
      },
    ];

    await bridge.handleChatInput(ws, {
      type: "chat.input",
      seq: 1,
      ts: Date.now(),
      sessionId,
      text: "Hi",
    });

    // Expect a user-echo chat.event + an assistant chat.event + chat.done.
    const events = ws.framesOfType("chat.event");
    const assistantEvents = events.filter(
      (e) => (e.sdkEvent as { type?: string }).type === "assistant",
    );
    expect(assistantEvents.length).toBe(1);
    const sdkEvent = assistantEvents[0]!.sdkEvent as {
      message?: { content?: Array<{ text?: string }> };
    };
    expect(sdkEvent.message?.content?.[0]?.text).toBe("Hello from Codex!");

    const dones = ws.framesOfType("chat.done");
    expect(dones).toHaveLength(1);
    expect(dones[0]!.reason).toBe("completed");

    // Persisted session should have thread id and token counters.
    const row = persistence.sessions.get(sessionId)!;
    expect(row.sdkSessionId).toBe("thr-xyz");
    const invList = persistence.invocations.listForSession(sessionId);
    expect(invList[0]!.inputTokens).toBe(12);
    expect(invList[0]!.outputTokens).toBe(7);

    await bridge.shutdown();
  });

  it("resumeThread is called when resuming a prior Codex session", async () => {
    const { bridge, codex, persistence } = makeBridge({ authed: true });

    // Seed a completed Codex session with a known thread id.
    const sessionId = "00000000-0000-4000-e000-000000000001";
    const invId = "00000000-0000-4000-e000-000000000002";
    persistence.sessions.insert({
      id: sessionId,
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 30_000,
      cwd: "/tmp/codex-test",
      model: "gpt-5.1",
      permissionMode: "",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheRead: 0,
      totalCacheCreate: 0,
      totalCostUsd: 0,
      endedReason: "completed",
      title: "",
      lastServerSeq: 0,
      sdkSessionId: "thr-prior",
      platform: "codex",
      effort: "low",
    });
    persistence.invocations.insert({
      id: invId,
      sessionId,
      parentInvocationId: null,
      resumedFromInvocationId: null,
      agentName: "main",
      agentId: null,
      taskId: null,
      toolUseId: null,
      model: "gpt-5.1",
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 30_000,
      durationMs: 30_000,
      status: "completed",
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      promptExcerpt: "",
      eventLogPath: `${sessionId}/${invId}.jsonl`,
      ownerPid: null,
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({
      effort: "low",
      resumeFromInvocationId: invId,
    }));
    expect(codex.resumeCalls).toHaveLength(1);
    expect(codex.resumeCalls[0]!.id).toBe("thr-prior");
    expect(codex.lastThread!.isResumed).toBe(true);
    await bridge.shutdown();
  });

  it("refuses to resume a non-Codex session with platform-mismatch", async () => {
    const { bridge, persistence } = makeBridge({ authed: true });
    const sessionId = "00000000-0000-4000-f000-000000000001";
    const invId = "00000000-0000-4000-f000-000000000002";
    persistence.sessions.insert({
      id: sessionId,
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 30_000,
      cwd: "/tmp",
      model: "claude-opus-4-7",
      permissionMode: "default",
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheRead: 0,
      totalCacheCreate: 0,
      totalCostUsd: 0,
      endedReason: "completed",
      title: "",
      lastServerSeq: 0,
      sdkSessionId: null,
      platform: "claude",
      effort: "none",
    });
    persistence.invocations.insert({
      id: invId,
      sessionId,
      parentInvocationId: null,
      resumedFromInvocationId: null,
      agentName: "main",
      agentId: null,
      taskId: null,
      toolUseId: null,
      model: "claude-opus-4-7",
      startedAt: Date.now() - 60_000,
      endedAt: Date.now() - 30_000,
      durationMs: 30_000,
      status: "completed",
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      promptExcerpt: "",
      eventLogPath: `${sessionId}/${invId}.jsonl`,
      ownerPid: null,
    });

    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart({ resumeFromInvocationId: invId }));
    const errors = ws.framesOfType("chat.error");
    expect(errors).toHaveLength(1);
    expect(errors[0]!.code).toBe("platform-mismatch");
    expect(bridge.isBusy()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ask_user_question WS-back-proxy (askproxy / outer-14)
// ---------------------------------------------------------------------------

import type { InternalWsMessage } from "@cq/shared";

function makeProxyBridge(): {
  bridge: CodexBridge;
  askReplies: InternalWsMessage[];
} {
  const persistence = new InMemoryPersistence();
  const registry = new SessionRegistry();
  const codex = new DummyCodex();
  const codexFactory: CodexFactory = async (): Promise<Codex> => codex as unknown as Codex;
  const askReplies: InternalWsMessage[] = [];
  const bridge = new CodexBridge({
    logger: noopLogger,
    registry,
    cwd: "/tmp/codex-test",
    persistence,
    codexFactory,
    detectAuth: () => true,
    sendAskReply: (msg) => askReplies.push(msg),
    selfPid: 7777,
  });
  return { bridge, askReplies };
}

describe("CodexBridge — ask_user_question proxy", () => {
  it("emits a synthetic AskUserQuestion chat.event to the active session's socket", async () => {
    const { bridge } = makeProxyBridge();
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart());
    const sessionId = ws.framesOfType("chat.started")[0]!.sessionId as string;

    bridge.handleAskRequest({
      askId: "ask-1",
      toolUseId: "tu-1",
      sessionId,
      questions: [{ question: "Pick", options: ["a", "b"] }],
    });

    const events = ws.framesOfType("chat.event");
    expect(events).toHaveLength(1);
    const sdkEvent = events[0]!.sdkEvent as {
      type: string;
      message: { content: Array<{ type: string; name?: string; id?: string; input?: unknown }> };
    };
    expect(sdkEvent.type).toBe("assistant");
    const block = sdkEvent.message.content[0]!;
    expect(block.type).toBe("tool_use");
    expect(block.name).toBe("AskUserQuestion");
    expect(block.id).toBe("tu-1");
    expect(block.input).toEqual({ questions: [{ question: "Pick", options: ["a", "b"] }] });
    await bridge.shutdown();
  });

  it("proxies chat.question_reply back as an ask.reply with the matching askId", async () => {
    const { bridge, askReplies } = makeProxyBridge();
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart());
    const sessionId = ws.framesOfType("chat.started")[0]!.sessionId as string;

    bridge.handleAskRequest({
      askId: "ask-9",
      toolUseId: "tu-9",
      sessionId,
      questions: [{ question: "Q" }],
    });
    bridge.handleChatQuestionReply(ws, {
      type: "chat.question_reply",
      seq: 0,
      ts: Date.now(),
      sessionId,
      invocationId: ws.framesOfType("chat.started")[0]!.invocationId as string,
      toolUseId: "tu-9",
      answers: { Q: ["x", "y"] },
    });

    expect(askReplies).toHaveLength(1);
    const reply = askReplies[0]!;
    expect(reply.type).toBe("ask.reply");
    if (reply.type === "ask.reply") {
      expect(reply.askId).toBe("ask-9");
      expect(reply.answers).toEqual({ Q: ["x", "y"] });
      expect(reply.sourcePid).toBe(7777);
    }
    await bridge.shutdown();
  });

  it("replies empty (no hang) when ask.request targets a non-active session", async () => {
    const { bridge, askReplies } = makeProxyBridge();
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart());

    bridge.handleAskRequest({
      askId: "ask-x",
      toolUseId: "tu-x",
      sessionId: "00000000-0000-0000-0000-000000000000",
      questions: [{ question: "Q" }],
    });
    expect(askReplies).toHaveLength(1);
    const reply = askReplies[0]!;
    if (reply.type === "ask.reply") {
      expect(reply.askId).toBe("ask-x");
      expect(reply.answers).toEqual({});
    }
    // No synthetic event was emitted to the (wrong) session's socket.
    expect(ws.framesOfType("chat.event")).toHaveLength(0);
    await bridge.shutdown();
  });

  it("drops a chat.question_reply that arrives after shutdown (stale)", async () => {
    const { bridge, askReplies } = makeProxyBridge();
    const ws = new MockWsSocket();
    await bridge.handleChatStart(ws, makeStart());
    const sessionId = ws.framesOfType("chat.started")[0]!.sessionId as string;
    const invocationId = ws.framesOfType("chat.started")[0]!.invocationId as string;
    bridge.handleAskRequest({
      askId: "ask-1",
      toolUseId: "tu-1",
      sessionId,
      questions: [{ question: "Q" }],
    });
    await bridge.shutdown();
    bridge.handleChatQuestionReply(ws, {
      type: "chat.question_reply",
      seq: 0,
      ts: Date.now(),
      sessionId,
      invocationId,
      toolUseId: "tu-1",
      answers: { Q: "x" },
    });
    // shutdown cleared the correlation → no ask.reply sent.
    expect(askReplies).toHaveLength(0);
  });
});
