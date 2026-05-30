/**
 * headlessQuery.ts — shared plumbing for the HEADLESS workflow lane.
 *
 * Both the phase-1 producer and the cycle-3 phase subagents dispatch a Claude
 * `query()` that NEVER goes through the interactive `Bridge` facade: own query,
 * no `SessionRegistry` session, no `chat.*` frames. The pool=1 interactive
 * invariant is therefore held by construction. This module factors the two
 * pieces both paths need: the one-shot streaming-input queue and the Bun native
 * binary-path workaround.
 */

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { createRequire } from "node:module";

/**
 * Read-only exploration tools every HEADLESS phase subagent is allowed to call
 * so it can GROUND its output in the repository (codebase + on-disk `docs/*.md`
 * ledgers) instead of reasoning blind from the prompt alone (PLAN-D01).
 *
 * These are READ-ONLY SDK built-ins: they cannot mutate the working tree or the
 * ledgers. The harness-owns-writes guarantee is preserved by construction — the
 * subagent is given NO write tool (`Edit`/`Write`/`NotebookEdit`), NO exec tool
 * (`Bash` is a write/exec vector and is denied), and NO ledger-mutation MCP
 * tool; its only output channel remains the phase's `submit_*` tool.
 */
export const PHASE_READONLY_TOOLS: readonly string[] = ["Read", "Grep", "Glob"];

/** SDK `canUseTool` callback signature (narrowed to what the headless lane uses). */
export type CanUseTool = (
  toolName: string,
) => Promise<
  | { behavior: "allow"; updatedInput: Record<string, never> }
  | { behavior: "deny"; message: string }
>;

/**
 * Build the `canUseTool` gate shared by every Claude headless phase subagent
 * (producer + clarify-reviewer + planner + plan-reviewer + continuation).
 *
 * ALLOW: the phase's fully-qualified submit tool (`fqSubmitToolName`, e.g.
 * `mcp__wf__submit_plan`) PLUS the read-only exploration built-ins in
 * `PHASE_READONLY_TOOLS`. DENY everything else — including every write/exec tool
 * (`Edit`, `Write`, `NotebookEdit`, `Bash`) and any unknown tool — so the
 * subagent can READ the project to ground its work but can NEVER write (the
 * harness owns all ledger writes).
 */
export function makePhaseCanUseTool(fqSubmitToolName: string): CanUseTool {
  const readOnly = new Set(PHASE_READONLY_TOOLS);
  return async (toolName: string) => {
    if (toolName === fqSubmitToolName || readOnly.has(toolName)) {
      return { behavior: "allow" as const, updatedInput: {} };
    }
    return {
      behavior: "deny" as const,
      message: `denied: subagent may only read (${PHASE_READONLY_TOOLS.join("/")}) or call ${fqSubmitToolName}`,
    };
  };
}

/**
 * A one-shot streaming-input queue: yields a single prompt, then blocks until
 * `end()` is called. The SDK requires an `AsyncIterable<SDKUserMessage>`.
 */
export class SingleMessageQueue
  implements AsyncIterator<SDKUserMessage>, AsyncIterable<SDKUserMessage>
{
  private emitted = false;
  private done = false;
  private waiter: ((r: IteratorResult<SDKUserMessage>) => void) | null = null;
  private readonly text: string;

  constructor(text: string) {
    this.text = text;
  }

  end(): void {
    if (this.done) return;
    this.done = true;
    if (this.waiter !== null) {
      const resolve = this.waiter;
      this.waiter = null;
      resolve({ value: undefined as unknown as SDKUserMessage, done: true });
    }
  }

  next(): Promise<IteratorResult<SDKUserMessage>> {
    if (!this.emitted) {
      this.emitted = true;
      const msg: SDKUserMessage = {
        type: "user",
        message: { role: "user", content: this.text } as SDKUserMessage["message"],
        parent_tool_use_id: null,
      };
      return Promise.resolve({ value: msg, done: false });
    }
    if (this.done) {
      return Promise.resolve({ value: undefined as unknown as SDKUserMessage, done: true });
    }
    return new Promise((resolve) => {
      this.waiter = resolve;
    });
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return this;
  }
}

/**
 * Resolve the native Claude Code CLI binary path under Bun (mirror of
 * ClaudeBridge.resolveNativeBinaryPath). Returns undefined under Node so the
 * SDK does its own lookup. Under Bun, child_process.spawn of the native CLI
 * binary can intermittently ENOENT even when the file exists; passing the
 * explicit path bypasses the flaky spawn lookup.
 */
export function resolveNativeBinaryPath(): string | undefined {
  if (typeof (process.versions as Record<string, unknown>)["bun"] === "undefined") {
    return undefined;
  }
  try {
    const req = createRequire(import.meta.url);
    const platform = process.platform;
    const arch = process.arch;
    const pkgCandidates = [
      `@anthropic-ai/claude-agent-sdk-${platform}-${arch}/claude`,
      `@anthropic-ai/claude-agent-sdk-${platform}-${arch}-musl/claude`,
    ];
    for (const pkg of pkgCandidates) {
      try {
        const resolved = req.resolve(pkg);
        if (resolved) return resolved;
      } catch {
        // Not found — try next candidate.
      }
    }
  } catch {
    // Fallback: let the SDK do its own lookup.
  }
  return undefined;
}
