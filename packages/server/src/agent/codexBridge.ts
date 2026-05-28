/**
 * codexBridge.ts — Codex-platform backend implementing BackendBridge.
 *
 * Drives `@openai/codex-sdk` on behalf of the cq facade. Lifecycle
 * roughly mirrors ClaudeBridge but adapted to codex-sdk's per-turn
 * `Thread.runStreamed` shape instead of Claude's single long-lived
 * iterator:
 *
 *   chat.start  → Codex.startThread() or resumeThread(prior.sdkSessionId);
 *                 emit chat.started immediately so the client can begin
 *                 sending input.
 *   chat.input  → thread.runStreamed(text); iterate ThreadEvents,
 *                 translate to cq's SDKMessageEnvelope shape, emit as
 *                 chat.event. End of turn → chat.done.
 *   chat.interrupt → AbortSignal abort.
 *   shutdown    → drop the thread reference (codex-sdk has no
 *                 explicit close); pending turn's AbortSignal aborts.
 *
 * Auth detection (per brief Q7):
 *   - `~/.codex/auth.json` present (codex login state)  OR
 *   - `OPENAI_API_KEY` env var set
 *   Otherwise emit chat.error{code:'codex-not-authenticated'} and refuse.
 *
 * Ledger MCP + AskUserQuestion in-process MCP wiring is NOT available
 * in Codex sessions in v1 (see defects.md D-GC-1 and D-OUTER7-02).
 *
 * Concrete API gap in `@openai/codex-sdk@0.134.0`:
 *
 *   ThreadOptions (dist/index.d.ts line 239) accepts only:
 *     { model, sandboxMode, workingDirectory, skipGitRepoCheck,
 *       modelReasoningEffort, networkAccessEnabled, webSearchMode,
 *       webSearchEnabled, approvalPolicy, additionalDirectories }
 *
 *   CodexOptions (dist/index.d.ts line 216) accepts only:
 *     { codexPathOverride, baseUrl, apiKey, config: CodexConfigObject, env }
 *
 *   Neither type carries an `mcpServers` field, an in-process
 *   `createSdkMcpServer`-equivalent, an MCP transport, nor any callback
 *   hook through which cq could surface the in-process LedgerStore.
 *
 * The only path the SDK exposes is `CodexOptions.config`, which is
 * flattened into `--config key=value` overrides for the Codex CLI. To
 * reach the LedgerStore through that path would require:
 *   (a) shipping an external `cq-mcp` stdio binary that wraps the same
 *       `createLedgerMcpTools` + `@modelcontextprotocol/sdk` stdio
 *       transport already imported transitively via Claude SDK, then
 *   (b) writing `config.mcp_servers.cq = { command, args }` so the
 *       Codex CLI spawns it per session.
 *
 * That binary is a substantial follow-up feature, not a defect fix, and
 * is deferred. Codex sessions in v1 get the CLI's built-in tool surface
 * (file ops, bash, web search) only. Q13 (codex tool parity) is closed
 * as deferred-with-citation in defects.md.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { Codex, Thread, ThreadEvent, ThreadOptions } from "@openai/codex-sdk";
import type { Logger } from "../log/logger";
import type { SessionRegistry } from "../seq/sessionRegistry";
import type { Persistence } from "../persist/Persistence.js";
import type { BackendBridge, WsSocket } from "./backendBridge";
import type {
  ChatStart,
  ChatRejoin,
  ChatInput,
  ChatInterrupt,
  ChatPermissionReply,
  ChatElicitationReply,
  ChatQuestionReply,
  ChatReadFileRequest,
  ChatEvent,
  ChatStarted,
  ChatDone,
  ChatError,
  HistoryUpdate,
  Effort,
  SessionRow,
  InvocationRow,
} from "@cq/shared";
import { effortToCodexEffort } from "@cq/shared";

/**
 * Factory the bridge calls to obtain a `Codex` instance. Default
 * implementation imports the real SDK; tests inject a hand-written
 * dummy implementing the same interface (per the dual-tests skill).
 */
export type CodexFactory = () => Codex;

export interface CodexBridgeOpts {
  logger: Logger;
  registry: SessionRegistry;
  /** Working directory passed to Codex.startThread as workingDirectory. */
  cwd: string;
  /** Persistence adapter shared with the facade. */
  persistence: Persistence;
  /**
   * Override the Codex SDK constructor for tests. Defaults to
   * `() => new Codex()`, which the SDK initialises from process env.
   */
  codexFactory?: CodexFactory;
  /**
   * Override the auth-detection function for tests. Defaults to
   * `defaultDetectCodexAuth` (checks ~/.codex/auth.json + OPENAI_API_KEY).
   */
  detectAuth?: () => boolean;
}

/** Tracks one Codex session's runtime state. */
type ActiveCodexSession = {
  readonly chatSessionId: string;
  invocationId: string;
  ws: WsSocket;
  readonly thread: Thread;
  /** AbortController for the current turn; null between turns. */
  abortController: AbortController | null;
  /** Set by chat.interrupt; suppresses event emissions for the current turn. */
  aborting: boolean;
  readonly startedAt: number;
  readonly model: string;
  readonly effort: Effort;
  /** Codex thread id (assigned after the first turn). */
  threadId: string | null;
  /** First user-message text captured for the title generator (deferred per D-GC-1). */
  firstUserText: string;
  /** Accumulators for the live history.update push. */
  toolCallCount: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

/**
 * Default auth detection. Returns true when either the codex login
 * state file exists OR the OPENAI_API_KEY env var is non-empty.
 */
export function defaultDetectCodexAuth(home?: string): boolean {
  if (process.env["OPENAI_API_KEY"] !== undefined && process.env["OPENAI_API_KEY"] !== "") {
    return true;
  }
  const homeDir = home ?? process.env["HOME"] ?? os.homedir();
  if (!homeDir) return false;
  const authPath = path.join(homeDir, ".codex", "auth.json");
  try {
    return fs.statSync(authPath).isFile();
  } catch {
    return false;
  }
}

export class CodexBridge implements BackendBridge {
  private readonly logger: Logger;
  private readonly registry: SessionRegistry;
  private readonly cwd: string;
  private readonly persistence: Persistence;
  private readonly codexFactory: CodexFactory;
  private readonly detectAuth: () => boolean;
  private codex: Codex | null = null;
  private active: ActiveCodexSession | null = null;

  constructor(opts: CodexBridgeOpts) {
    this.logger = opts.logger;
    this.registry = opts.registry;
    this.cwd = path.resolve(opts.cwd);
    this.persistence = opts.persistence;
    this.codexFactory = opts.codexFactory ?? ((): Codex => {
      // Lazy require to avoid loading the SDK at import time in code paths
      // (e.g. tests) that never construct a CodexBridge.
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
      const { Codex } = require("@openai/codex-sdk") as { Codex: new () => Codex };
      return new Codex();
    });
    this.detectAuth = opts.detectAuth ?? ((): boolean => defaultDetectCodexAuth());
  }

  isBusy(): boolean {
    return this.active !== null;
  }

  activeSessionId(): string | null {
    return this.active?.chatSessionId ?? null;
  }

  async handleChatStart(ws: WsSocket, frame: ChatStart): Promise<void> {
    // Refuse if not authenticated. The facade has already verified that
    // `frame.platform === 'codex'` before routing here, so any refusal
    // must be auth-related.
    if (!this.detectAuth()) {
      this.sendError(
        ws,
        null,
        "codex-not-authenticated",
        "Run `codex login` or set OPENAI_API_KEY before starting a Codex session.",
      );
      return;
    }

    // Same-backend preempt.
    if (this.active !== null) {
      this.logger.info("codex.chat_start_preempt", {
        prior: this.active.chatSessionId,
      });
      this.interruptActive();
      await this.shutdown();
    }

    // Determine chatSessionId + resume vs fresh.
    let chatSessionId: string;
    let isResumption = false;
    let resumedFromInvocationId: string | null = null;
    let priorThreadId: string | null = null;
    if (frame.resumeFromInvocationId !== undefined) {
      const priorInv = this.persistence.invocations.get(frame.resumeFromInvocationId);
      const priorSession = priorInv !== undefined
        ? this.persistence.sessions.get(priorInv.sessionId)
        : undefined;
      if (priorSession !== undefined && priorInv !== undefined) {
        if (priorSession.platform !== "codex") {
          // Defence in depth — facade should have caught this.
          this.sendError(
            ws,
            priorSession.id,
            "platform-mismatch",
            "Prior session is not a Codex session.",
          );
          return;
        }
        chatSessionId = priorSession.id;
        isResumption = true;
        resumedFromInvocationId = frame.resumeFromInvocationId;
        priorThreadId = priorSession.sdkSessionId;
        this.registry.register(chatSessionId);
      } else {
        this.logger.warn("codex.resume_unknown_invocation", { invocationId: frame.resumeFromInvocationId });
        chatSessionId = this.registry.create().sessionId;
      }
    } else {
      chatSessionId = this.registry.create().sessionId;
    }

    // Lazy-construct Codex.
    if (this.codex === null) {
      this.codex = this.codexFactory();
    }

    const model = frame.model ?? "";
    const effort: Effort = frame.effort ?? "none";
    const threadOptions: ThreadOptions = {
      workingDirectory: this.cwd,
      modelReasoningEffort: effortToCodexEffort(effort),
      skipGitRepoCheck: true,
    };
    if (model.length > 0) threadOptions.model = model;
    // Map cq's permissionMode to Codex sandboxMode where applicable.
    // codex-prefixed values are forwarded directly; cq-internal Claude
    // values are not meaningful for Codex (we leave the SDK default).
    const sandboxMap: Record<string, ThreadOptions["sandboxMode"]> = {
      "codex-read-only": "read-only",
      "codex-workspace-write": "workspace-write",
      "codex-danger-full-access": "danger-full-access",
    };
    const requestedSandbox = frame.permissionMode !== undefined
      ? sandboxMap[frame.permissionMode]
      : undefined;
    if (requestedSandbox !== undefined) {
      threadOptions.sandboxMode = requestedSandbox;
    }

    const thread = priorThreadId !== null && isResumption
      ? this.codex.resumeThread(priorThreadId, threadOptions)
      : this.codex.startThread(threadOptions);

    const invocationId = crypto.randomUUID();
    const startedAt = Date.now();
    const invocationEventLogPath = `${chatSessionId}/${invocationId}.jsonl`;
    const invocationRow: InvocationRow = {
      id: invocationId,
      sessionId: chatSessionId,
      parentInvocationId: null,
      resumedFromInvocationId,
      agentName: "main",
      agentId: null,
      taskId: null,
      toolUseId: null,
      model,
      startedAt,
      endedAt: null,
      durationMs: null,
      status: "running",
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
      promptExcerpt: "",
      eventLogPath: invocationEventLogPath,
      ownerPid: process.pid,
    };
    this.persistence.withTx(() => {
      if (isResumption) {
        this.persistence.sessions.update(chatSessionId, {
          endedAt: null,
          endedReason: null,
        });
      } else {
        const sessionRow: SessionRow = {
          id: chatSessionId,
          startedAt,
          endedAt: null,
          cwd: this.cwd,
          model,
          permissionMode: frame.permissionMode ?? "",
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheRead: 0,
          totalCacheCreate: 0,
          totalCostUsd: 0,
          endedReason: null,
          title: "",
          lastServerSeq: 0,
          sdkSessionId: priorThreadId,
          platform: "codex",
          effort,
        };
        this.persistence.sessions.insert(sessionRow);
      }
      this.persistence.invocations.insert(invocationRow);
    });

    const session: ActiveCodexSession = {
      chatSessionId,
      invocationId,
      ws,
      thread,
      abortController: null,
      aborting: false,
      startedAt,
      model,
      effort,
      threadId: priorThreadId,
      firstUserText: "",
      toolCallCount: 0,
      inputTokens: 0,
      outputTokens: 0,
      costUsd: 0,
    };
    this.active = session;

    this.logger.info("codex.chat_start", { chatSessionId, invocationId });

    // Emit chat.started immediately so the UI sees the session id.
    this.sendStartedEarly(ws, session);
  }

  async handleChatRejoin(ws: WsSocket, _frame: ChatRejoin): Promise<void> {
    // codex-6 will implement rejoin properly via persisted event replay.
    // For codex-5 (skeleton), refuse with a clear error.
    this.sendError(
      ws,
      null,
      "REJOIN_NOT_SUPPORTED",
      "Codex session rejoin is not supported in this build; start a new session.",
    );
  }

  async handleChatInput(ws: WsSocket, frame: ChatInput): Promise<void> {
    // codex-5 ships a skeleton that accepts input + drives a single turn,
    // emitting agent_message text as chat.event and a final chat.done.
    // codex-6 will flesh out full ThreadEvent translation.
    const session = this.active;
    if (session === null || session.chatSessionId !== frame.sessionId) {
      this.sendError(ws, frame.sessionId, "NO_ACTIVE_SESSION", "No active Codex session for this id");
      return;
    }
    session.ws = ws;
    if (session.firstUserText === "") session.firstUserText = frame.text;

    // Echo the user input as a chat.event so the bubble renders (mirrors
    // ClaudeBridge.handleChatInput's D24 echo).
    const echoEvent = {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: [{ type: "text" as const, text: frame.text }],
        id: `user-${session.chatSessionId}-${Date.now()}`,
      },
      parent_tool_use_id: null,
    };
    this.persistence.events.append(session.invocationId, echoEvent as never);
    this.sendEvent(ws, session, echoEvent);

    // Run one turn. Abort-aware via AbortController.
    const abort = new AbortController();
    session.abortController = abort;
    let turnDone: ChatDone["reason"] = "completed";
    try {
      const streamed = await session.thread.runStreamed(frame.text, { signal: abort.signal });
      for await (const event of streamed.events) {
        if (session.aborting) break;
        this.handleThreadEvent(ws, session, event);
        if (event.type === "thread.started") {
          // First turn — capture thread id.
          session.threadId = event.thread_id;
          this.persistence.sessions.update(session.chatSessionId, {
            sdkSessionId: event.thread_id,
          });
        }
        if (event.type === "turn.failed") {
          turnDone = "errored";
        }
      }
    } catch (err: unknown) {
      if (session.aborting) {
        turnDone = "interrupted";
      } else {
        turnDone = "errored";
        const msg = err instanceof Error ? err.message : String(err);
        this.sendError(ws, session.chatSessionId, "CODEX_ERROR", msg);
      }
    } finally {
      session.abortController = null;
    }
    this.sendDone(ws, session, turnDone);
    if (turnDone === "errored") {
      // Failure ends the session — mirror ClaudeBridge's behaviour.
      await this.shutdown();
    }
  }

  async handleChatInterrupt(_ws: WsSocket, frame: ChatInterrupt): Promise<void> {
    const session = this.active;
    if (session === null || session.chatSessionId !== frame.sessionId) return;
    session.aborting = true;
    session.abortController?.abort();
  }

  handleChatPermissionReply(_ws: WsSocket, _frame: ChatPermissionReply): void {
    // Codex CLI handles its own permission UX; the cq permission prompt
    // is Claude-only. Silently ignore.
  }

  handleChatElicitationReply(_ws: WsSocket, _frame: ChatElicitationReply): void {
    // Same as above — Codex sessions do not surface elicitation requests.
  }

  handleChatQuestionReply(_ws: WsSocket, _frame: ChatQuestionReply): void {
    // AskUserQuestion is Claude-MCP-only; see D-GC-1.
  }

  async handleChatReadFileRequest(ws: WsSocket, frame: ChatReadFileRequest): Promise<void> {
    // codex-sdk does not expose a generic read-file API; serve an error result.
    const result = {
      type: "chat.read_file_result" as const,
      seq: 0,
      ts: Date.now(),
      requestId: frame.requestId,
      content: "",
      startLine: 0,
      error: "read-file is not implemented for Codex sessions",
    };
    ws.send(JSON.stringify(result));
  }

  interruptActive(): void {
    const session = this.active;
    if (session === null) return;
    this.logger.info("codex.interrupt_active", { chatSessionId: session.chatSessionId });
    session.aborting = true;
    session.abortController?.abort();
  }

  async shutdown(): Promise<void> {
    if (this.active === null) return;
    const session = this.active;
    this.logger.info("codex.shutdown", { chatSessionId: session.chatSessionId });
    session.aborting = true;
    session.abortController?.abort();
    // Finalise persistence rows.
    const endedAt = Date.now();
    const durationMs = endedAt - session.startedAt;
    const invStatus: InvocationRow["status"] = session.aborting ? "stopped" : "completed";
    this.persistence.events.close(session.invocationId);
    this.persistence.invocations.update(session.invocationId, {
      endedAt,
      durationMs,
      status: invStatus,
    });
    this.persistence.sessions.update(session.chatSessionId, {
      endedAt,
      endedReason: session.aborting ? "interrupted" : "completed",
    });
    this.active = null;
  }

  // ---------------------------------------------------------------------------
  // Event translation
  // ---------------------------------------------------------------------------

  /**
   * Translate one ThreadEvent into a chat.event frame (or skip if the event
   * carries no UI-relevant payload). Codex-5 ships the minimum mapping
   * sufficient for the e2e roundtrip spec; codex-6 will extend it.
   */
  private handleThreadEvent(
    ws: WsSocket,
    session: ActiveCodexSession,
    event: ThreadEvent,
  ): void {
    // Persist every event under the invocation log so resume can replay.
    this.persistence.events.append(session.invocationId, event as never);

    switch (event.type) {
      case "thread.started":
        // Captured by the caller for thread id persistence; no chat.event.
        return;
      case "turn.started":
        return;
      case "item.completed": {
        const item = event.item;
        if (item.type === "agent_message") {
          // Translate to an "assistant" SDK-shape event so Stream.tsx
          // renders it as an assistant bubble.
          const assistant = {
            type: "assistant" as const,
            message: {
              id: item.id,
              role: "assistant" as const,
              content: [{ type: "text" as const, text: item.text }],
              model: session.model,
            },
            parent_tool_use_id: null,
          };
          this.sendEvent(ws, session, assistant);
        }
        // Other item types (command_execution, file_change, mcp_tool_call,
        // web_search, todo_list) are persisted but not yet UI-translated
        // in codex-5; codex-6 extends this.
        return;
      }
      case "item.started":
      case "item.updated":
        return; // streamed UI updates deferred to codex-6
      case "turn.completed": {
        const usage = event.usage;
        session.inputTokens += usage.input_tokens;
        session.outputTokens += usage.output_tokens;
        this.persistence.invocations.update(session.invocationId, {
          inputTokens: session.inputTokens,
          outputTokens: session.outputTokens,
        });
        this.sendHistoryUpdate(ws, session.invocationId, {
          inputTokens: session.inputTokens,
          outputTokens: session.outputTokens,
        });
        // Push usage frame so the top-bar counter updates.
        const usageState = this.registry.get(session.chatSessionId);
        const usageSeq = usageState !== undefined ? usageState.buffer.serverSeq + 1 : 0;
        ws.send(JSON.stringify({
          type: "chat.usage",
          seq: usageSeq,
          ts: Date.now(),
          sessionId: session.chatSessionId,
          inputTokens: session.inputTokens,
          outputTokens: session.outputTokens,
          costUsd: session.costUsd,
        }));
        return;
      }
      case "turn.failed": {
        this.sendError(ws, session.chatSessionId, "turn_failed", event.error.message);
        return;
      }
      case "error": {
        this.sendError(ws, session.chatSessionId, "codex_error", event.message);
        return;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Frame senders (shape-compatible with ClaudeBridge for the protocol layer)
  // ---------------------------------------------------------------------------

  private sendStartedEarly(ws: WsSocket, session: ActiveCodexSession): void {
    const sessionState = this.registry.get(session.chatSessionId);
    const seq = sessionState !== undefined ? sessionState.buffer.serverSeq + 1 : 0;
    const frame: ChatStarted = {
      type: "chat.started",
      seq,
      ts: Date.now(),
      sessionId: session.chatSessionId,
      invocationId: session.invocationId,
      initInfo: { cwd: this.cwd, model: session.model },
    };
    ws.send(JSON.stringify(frame));
  }

  private sendEvent(ws: WsSocket, session: ActiveCodexSession, msg: unknown): void {
    const sessionState = this.registry.get(session.chatSessionId);
    const partial = {
      type: "chat.event" as const,
      seq: 0,
      ts: Date.now(),
      sessionId: session.chatSessionId,
      invocationId: session.invocationId,
      parentInvocationId: null,
      sdkEvent: msg as Record<string, unknown> & { type: string },
    };
    let seq = 0;
    if (sessionState !== undefined) {
      const result = sessionState.buffer.append(partial as ChatEvent);
      seq = result.seq;
    }
    const frame: ChatEvent = { ...partial, seq };
    ws.send(JSON.stringify(frame));
  }

  private sendDone(ws: WsSocket, session: ActiveCodexSession, reason: ChatDone["reason"]): void {
    const frame: ChatDone = {
      type: "chat.done",
      seq: 0,
      ts: Date.now(),
      sessionId: session.chatSessionId,
      reason,
    };
    ws.send(JSON.stringify(frame));
  }

  private sendError(ws: WsSocket, sessionId: string | null, code: string, message: string): void {
    const frame: ChatError = {
      type: "chat.error",
      seq: 0,
      ts: Date.now(),
      ...(sessionId !== null ? { sessionId } : {}),
      code,
      message,
    };
    ws.send(JSON.stringify(frame));
    this.logger.warn("codex.chat_error", { sessionId, code, message });
  }

  private sendHistoryUpdate(ws: WsSocket, invocationId: string, patch: Record<string, unknown>): void {
    const frame: HistoryUpdate = {
      type: "history.update",
      seq: 0,
      ts: Date.now(),
      invocationId,
      patch,
    };
    ws.send(JSON.stringify(frame));
  }
}
