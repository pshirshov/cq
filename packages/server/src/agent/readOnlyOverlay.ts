/**
 * readOnlyOverlay.ts — wraps a CanUseTool implementation with a read-only deny layer.
 *
 * When the current UI mode is "read-only", any tool in the deny-set is immediately
 * rejected with {behavior:'deny', message:'Tool denied: read-only mode'} WITHOUT
 * calling the underlying canUseTool (so no chat.permission_request WS frame is emitted).
 * All other tools fall through to the wrapped implementation unchanged.
 *
 * Deny-set (explicit names):
 *   Edit, Write, NotebookEdit, MultiEdit, Bash, TodoWrite
 * Plus any tool whose description matches /write|modify|create|delete/i (catch-all
 * for built-in tools whose names aren't in the explicit list).
 */

import type { CanUseTool, PermissionResult } from "@anthropic-ai/claude-agent-sdk";

// ---------------------------------------------------------------------------
// Deny-set
// ---------------------------------------------------------------------------

const DENY_NAMES = new Set([
  "Edit",
  "Write",
  "NotebookEdit",
  "MultiEdit",
  "Bash",
  "TodoWrite",
]);

const DENY_DESCRIPTION_RE = /write|modify|create|delete/i;

function isDenied(toolName: string, description: string | undefined): boolean {
  if (DENY_NAMES.has(toolName)) return true;
  if (description !== undefined && DENY_DESCRIPTION_RE.test(description)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

const READ_ONLY_DENY: PermissionResult = {
  behavior: "deny",
  message: "Tool denied: read-only mode",
};

/**
 * Wraps `original` so that when `getMode()` returns `"read-only"`, any tool
 * in the deny-set is rejected immediately without forwarding to `original`.
 *
 * The getter is called on every invocation, allowing the mode to change
 * mid-session without requiring a bridge restart.
 */
export function applyReadOnlyOverlay(
  original: CanUseTool,
  getMode: () => string,
): CanUseTool {
  return async (toolName, input, ctx) => {
    if (getMode() === "read-only" && isDenied(toolName, ctx.description)) {
      return READ_ONLY_DENY;
    }
    return original(toolName, input, ctx);
  };
}
