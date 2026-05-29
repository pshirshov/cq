/**
 * askProxy.ts — cq-server side of the Codex `ask_user_question`
 * WS-back-proxy (askproxy / outer-14).
 *
 * The Claude path renders the ask UI from the SDK's NATIVE assistant
 * stream: the Claude SDK emits an assistant message whose content carries
 * a `tool_use` block named `AskUserQuestion`, and the browser renders the
 * ask card from `toolUse.id` + `toolUse.input` (`Stream.tsx`). Codex emits
 * no such event, so for Codex sessions the server must SYNTHESIZE the same
 * assistant tool_use shape. `buildAskUserQuestionEvent` is that single
 * implementation; the proxy emits it through the bridge's existing
 * `chat.event` sender so the browser renders proxied questions identically
 * to in-process ones.
 *
 * Correlation. Per ask the proxy tracks `toolUseId → {askId, sessionId}`.
 * Flow:
 *   1. cq-mcp sends `ask.request{askId,toolUseId,sessionId,questions}`.
 *      `onAskRequest` records the correlation and emits the synthetic
 *      assistant tool_use `chat.event` to the session's browser socket.
 *   2. The browser answers → `chat.question_reply{sessionId,toolUseId,
 *      answers}` → the Bridge facade routes it to the active Codex backend
 *      → `onQuestionReply` looks up `toolUseId`, resolves the correlation
 *      to `askId`, and sends `ask.reply{askId,answers}` back over the
 *      internal WS. The matching cq-mcp broker resolves its parked tool
 *      handler; any other connected cq-mcp ignores the unknown askId.
 *
 * Server-side there is NO reply-before-ask race: the browser cannot reply
 * for a `toolUseId` it has not yet seen rendered, and it only sees the id
 * after step 1 emits the synthetic event. A `chat.question_reply` whose
 * `toolUseId` is unknown (e.g. after session teardown) is logged + dropped,
 * mirroring the Claude broker's stale-reply guard.
 */

import type { Logger } from "../log/logger";

/**
 * How the proxy emits the synthetic AskUserQuestion event to the browser.
 * The caller (CodexBridge) supplies an `emit` that wraps the SDK-shaped
 * message in a proper `chat.event` envelope (assigning seq + appending to
 * the session replay buffer via the bridge's `sendEvent`), plus the
 * `model` string for the synthetic assistant message. Returning null means
 * the session is not active (stale / wrong session).
 */
export interface AskTarget {
  emit: (sdkMessage: unknown) => void;
  model: string;
}

/**
 * Build the synthetic assistant `chat.event` payload (the SDK-shaped
 * message object, NOT the chat.event envelope — the bridge's `sendEvent`
 * wraps it) carrying an `AskUserQuestion` tool_use block. Shape matches
 * exactly what the browser's `Stream.tsx` ask renderer keys on:
 * `message.content[].type === "tool_use"`, `.name === "AskUserQuestion"`,
 * `.id === toolUseId`, `.input === { questions }`.
 */
export function buildAskUserQuestionEvent(
  toolUseId: string,
  questions: unknown[],
  model: string,
): {
  type: "assistant";
  message: {
    id: string;
    role: "assistant";
    content: Array<{ type: "tool_use"; id: string; name: string; input: { questions: unknown[] } }>;
    model: string;
  };
  parent_tool_use_id: null;
} {
  return {
    type: "assistant",
    message: {
      id: `ask-${toolUseId}`,
      role: "assistant",
      content: [
        {
          type: "tool_use",
          id: toolUseId,
          name: "AskUserQuestion",
          input: { questions },
        },
      ],
      model,
    },
    parent_tool_use_id: null,
  };
}

type Correlation = {
  askId: string;
  sessionId: string;
};

export interface AskProxyOpts {
  logger: Logger;
  /**
   * Send an `ask.reply` envelope upstream to cq-mcp. Production wires this
   * to `InternalWsService.broadcast`; the askId discriminates across
   * multiple connected cq-mcp children.
   */
  sendReply: (askId: string, answers: Record<string, unknown>) => void;
}

/**
 * Server-side proxy state machine. Owned by `CodexBridge`, which supplies
 * the live browser socket + model for the active session and routes
 * `chat.question_reply` frames in via `onQuestionReply`.
 */
export class AskProxy {
  private readonly logger: Logger;
  private readonly sendReply: (askId: string, answers: Record<string, unknown>) => void;
  /** toolUseId → correlation. The browser echoes toolUseId in its reply. */
  private readonly byToolUseId = new Map<string, Correlation>();

  constructor(opts: AskProxyOpts) {
    this.logger = opts.logger;
    this.sendReply = opts.sendReply;
  }

  /**
   * Handle an inbound `ask.request`. `resolveSocket` returns the live
   * browser socket + model for `sessionId`, or null if that session is not
   * the active one (stale / wrong session). On a null resolution the proxy
   * immediately replies with empty answers so the cq-mcp tool handler does
   * not hang — the model sees an empty answer rather than a deadlock.
   */
  onAskRequest(
    req: { askId: string; toolUseId: string; sessionId: string; questions: unknown[] },
    resolveTarget: (sessionId: string) => AskTarget | null,
  ): void {
    const target = resolveTarget(req.sessionId);
    if (target === null) {
      this.logger.warn("askProxy.no_active_session", {
        askId: req.askId,
        sessionId: req.sessionId,
      });
      // Reply immediately so the cq-mcp tool does not hang.
      this.sendReply(req.askId, {});
      return;
    }
    this.byToolUseId.set(req.toolUseId, {
      askId: req.askId,
      sessionId: req.sessionId,
    });
    const event = buildAskUserQuestionEvent(req.toolUseId, req.questions, target.model);
    // `emit` (supplied by CodexBridge) wraps this SDK-shaped message in a
    // chat.event envelope (seq + replay-buffer append) and sends it.
    target.emit(event);
    this.logger.info("askProxy.ask_emitted", {
      askId: req.askId,
      toolUseId: req.toolUseId,
      sessionId: req.sessionId,
    });
  }

  /**
   * Handle a browser `chat.question_reply` routed in by CodexBridge. Looks
   * up the correlation by `toolUseId` and sends `ask.reply` upstream.
   * Returns true if a correlation was found + replied, false if the reply
   * was stale (unknown toolUseId — session torn down) and dropped.
   */
  onQuestionReply(frame: {
    sessionId: string;
    toolUseId: string;
    answers: Record<string, unknown>;
  }): boolean {
    const corr = this.byToolUseId.get(frame.toolUseId);
    if (corr === undefined) {
      this.logger.info("askProxy.stale_reply", {
        toolUseId: frame.toolUseId,
        sessionId: frame.sessionId,
      });
      return false;
    }
    if (corr.sessionId !== frame.sessionId) {
      // The reply's sessionId must match the ask's. A mismatch means a
      // crossed wire; drop it rather than reply to the wrong ask.
      this.logger.warn("askProxy.session_mismatch", {
        toolUseId: frame.toolUseId,
        askSession: corr.sessionId,
        replySession: frame.sessionId,
      });
      return false;
    }
    this.byToolUseId.delete(frame.toolUseId);
    this.sendReply(corr.askId, frame.answers);
    return true;
  }

  /**
   * Clear all outstanding correlations (session shutdown / preempt). Any
   * subsequently-arriving `chat.question_reply` is then treated as stale.
   * cq-mcp's own broker rejects its pending asks when its channel drops, so
   * the model is not left hanging on the cq-mcp side either.
   */
  clear(): void {
    this.byToolUseId.clear();
  }

  /** Exposed for tests. */
  hasCorrelation(toolUseId: string): boolean {
    return this.byToolUseId.has(toolUseId);
  }
}
