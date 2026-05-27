/**
 * permission.ts — PermissionBroker: bridges SDK canUseTool callbacks to WS roundtrips.
 *
 * Flow:
 *  1. Bridge calls `broker.request(...)` from the SDK `canUseTool` callback.
 *  2. Broker generates a UUID, emits `chat.permission_request` over WS, parks a Promise.
 *  3. When the client replies with `chat.permission_reply`, the session routes it to
 *     `broker.reply(permissionRequestId, decision)`.
 *  4. Broker resolves the parked Promise with a PermissionResult compatible value.
 */

import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { ChatPermissionRequest } from "@cq/shared";
import type { Logger } from "../log/logger.js";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Subset of CanUseTool's options argument that we forward to the client. */
export interface PermissionRequestInput {
  sessionId: string;
  invocationId: string;
  toolName: string;
  toolUseId: string;
  input: Record<string, unknown>;
  title?: string;
  displayName?: string;
  description?: string;
  suggestions?: unknown[];
}

export type PermissionDecision = "allow" | "deny" | "allow_once";

/** Callback type: sends a raw JSON frame over the active WS connection. */
export type SendFrame = (frame: ChatPermissionRequest) => void;

// ---------------------------------------------------------------------------
// PermissionBroker
// ---------------------------------------------------------------------------

/**
 * Holds in-flight permission requests keyed by `permissionRequestId`.
 * One broker instance is created per Bridge and reused across sessions.
 */
export class PermissionBroker {
  private readonly pending = new Map<string, (result: PermissionResult) => void>();
  private sendFrame: SendFrame | null = null;
  private logger: Logger | null = null;

  /** Attach a structured logger. Optional; defaults to no logging. */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /**
   * Attach the WS send callback for the current active session.
   * Called by Bridge when a new session starts.
   */
  setSendFrame(fn: SendFrame): void {
    this.sendFrame = fn;
  }

  /**
   * Detach the send callback (e.g. when a session ends).
   * Pending requests are left in the map; they will either be replied to
   * (if the client reconnects and retries) or abandoned.
   */
  clearSendFrame(): void {
    this.sendFrame = null;
  }

  /**
   * Called from the SDK `canUseTool` callback.
   * Emits `chat.permission_request` and returns a Promise that resolves
   * when the client sends `chat.permission_reply`.
   */
  request(req: PermissionRequestInput): Promise<PermissionResult> {
    const permissionRequestId = crypto.randomUUID();

    const frame: ChatPermissionRequest = {
      type: "chat.permission_request",
      seq: 0, // seq is injected by the bridge's sendFrame helper
      ts: Date.now(),
      sessionId: req.sessionId,
      invocationId: req.invocationId,
      permissionRequestId,
      toolName: req.toolName,
      toolUseId: req.toolUseId,
      input: req.input,
      ...(req.title !== undefined ? { title: req.title } : {}),
      ...(req.displayName !== undefined ? { displayName: req.displayName } : {}),
      ...(req.description !== undefined ? { description: req.description } : {}),
      ...(req.suggestions !== undefined ? { suggestions: req.suggestions } : {}),
    };

    const promise = new Promise<PermissionResult>((resolve) => {
      this.pending.set(permissionRequestId, resolve);
    });

    // Best-effort: if the WS is not connected the frame is dropped.
    // Log a warning so operators know a request is parked without a live transport.
    // The pending entry remains resolvable: when the client reconnects and calls
    // setSendFrame(), the bridge re-sends any deferred permission prompts.
    if (this.sendFrame !== null) {
      this.sendFrame(frame);
    } else {
      this.logger?.warn("permission.sendFrame_null_request_parked", {
        toolName: req.toolName,
        invocationId: req.invocationId,
        permissionRequestId,
      });
    }

    return promise;
  }

  /**
   * Called when `chat.permission_reply` arrives from the client.
   * Resolves the parked Promise with the appropriate PermissionResult.
   */
  reply(permissionRequestId: string, decision: PermissionDecision): void {
    const resolve = this.pending.get(permissionRequestId);
    if (resolve === undefined) return; // stale or duplicate reply — ignore

    this.pending.delete(permissionRequestId);

    let result: PermissionResult;
    if (decision === "deny") {
      result = { behavior: "deny", message: "User denied the request" };
    } else {
      // "allow" and "allow_once" both resolve as allow; the distinction is
      // policy-level (allow_once means don't persist the permission update).
      result = { behavior: "allow" };
    }

    resolve(result);
  }

  /** Reject all pending requests (e.g. on session end or bridge shutdown). */
  rejectAll(): void {
    for (const resolve of this.pending.values()) {
      const result: PermissionResult = { behavior: "deny", message: "Session ended" };
      resolve(result);
    }
    this.pending.clear();
  }

  /** Number of pending (unresolved) requests — exposed for tests. */
  pendingCount(): number {
    return this.pending.size;
  }
}
