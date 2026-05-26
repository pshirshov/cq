/**
 * exportFormats.ts — Pure export rendering functions for history invocations (PR-46).
 *
 * toMarkdown: walks ChatEvent[], renders assistant text blocks and tool-use/result
 *   pairs into a structured Markdown string with session/invocation metadata header.
 * toJson: serialises events + header into a JSON string with top-level {header, events}.
 */

import type { ChatEvent, HistoryRowFull } from "@cq/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeaderInfo {
  invocationId: string;
  sessionId: string;
  agentName: string;
  model: string;
  startedAt: number | null;
  endedAt: number | null;
  durationMs: number | null;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  cwd: string;
}

export function headerFromRow(row: HistoryRowFull): HeaderInfo {
  return {
    invocationId: row.invocationId,
    sessionId: row.sessionId,
    agentName: row.agentName,
    model: row.model,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    durationMs: row.durationMs,
    totalInputTokens: row.totalInputTokens,
    totalOutputTokens: row.totalOutputTokens,
    totalCostUsd: row.totalCostUsd,
    cwd: row.cwd,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtTs(ts: number | null): string {
  if (ts === null) return "—";
  return new Date(ts).toISOString();
}

function fmtDurationMs(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${m}m ${s}s`;
}

function extractTextBlocks(content: unknown): string {
  if (!Array.isArray(content)) return "";
  let out = "";
  for (const block of content) {
    if (
      block !== null &&
      typeof block === "object" &&
      (block as Record<string, unknown>)["type"] === "text" &&
      typeof (block as Record<string, unknown>)["text"] === "string"
    ) {
      out += (block as Record<string, unknown>)["text"] as string;
    }
  }
  return out;
}

function extractToolUseBlocks(
  content: unknown,
): Array<{ id: string; name: string; input: unknown }> {
  if (!Array.isArray(content)) return [];
  const out: Array<{ id: string; name: string; input: unknown }> = [];
  for (const block of content) {
    if (
      block !== null &&
      typeof block === "object" &&
      (block as Record<string, unknown>)["type"] === "tool_use" &&
      typeof (block as Record<string, unknown>)["id"] === "string" &&
      typeof (block as Record<string, unknown>)["name"] === "string"
    ) {
      const b = block as Record<string, unknown>;
      out.push({
        id: b["id"] as string,
        name: b["name"] as string,
        input: b["input"],
      });
    }
  }
  return out;
}

function extractToolResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) => {
        if (
          c !== null &&
          typeof c === "object" &&
          typeof (c as Record<string, unknown>)["text"] === "string"
        ) {
          return (c as Record<string, unknown>)["text"] as string;
        }
        return JSON.stringify(c);
      })
      .join("\n");
  }
  return JSON.stringify(content);
}

// ---------------------------------------------------------------------------
// toMarkdown
// ---------------------------------------------------------------------------

/**
 * Renders a transcript (ChatEvent[]) plus header metadata into a single
 * Markdown string.
 *
 * Structure:
 *   # <agentName> — Invocation Transcript
 *   (metadata table)
 *
 *   ## Assistant
 *   <text>
 *
 *   ### Tool: <name>
 *   **Input**
 *   ```json
 *   <input>
 *   ```
 *   **Output**
 *   ```
 *   <output>
 *   ```
 */
export function toMarkdown(events: ChatEvent[], header: HeaderInfo): string {
  const lines: string[] = [];

  // --- Document header ---
  lines.push(`# ${header.agentName} — Invocation Transcript`);
  lines.push("");
  lines.push(`| Field | Value |`);
  lines.push(`|-------|-------|`);
  lines.push(`| Invocation | \`${header.invocationId}\` |`);
  lines.push(`| Session | \`${header.sessionId}\` |`);
  lines.push(`| Model | ${header.model} |`);
  lines.push(`| Started | ${fmtTs(header.startedAt)} |`);
  lines.push(`| Ended | ${fmtTs(header.endedAt)} |`);
  lines.push(`| Duration | ${fmtDurationMs(header.durationMs)} |`);
  lines.push(
    `| Tokens | ${header.totalInputTokens} in / ${header.totalOutputTokens} out |`,
  );
  lines.push(`| Cost | $${header.totalCostUsd.toFixed(4)} |`);
  lines.push(`| Cwd | \`${header.cwd}\` |`);
  lines.push("");

  // Build a tool_result lookup: tool_use_id → result content string
  // We need a two-pass approach: collect tool_results first, then render.
  const toolResults = new Map<string, string>();

  for (const event of events) {
    const sdkEvent = event.sdkEvent;
    // tool_result arrives in a user-type message
    if (sdkEvent["type"] === "user") {
      const message = sdkEvent["message"] as Record<string, unknown> | undefined;
      const content = Array.isArray(message?.["content"]) ? message!["content"] : [];
      for (const block of content) {
        if (
          block !== null &&
          typeof block === "object" &&
          (block as Record<string, unknown>)["type"] === "tool_result" &&
          typeof (block as Record<string, unknown>)["tool_use_id"] === "string"
        ) {
          const b = block as Record<string, unknown>;
          toolResults.set(
            b["tool_use_id"] as string,
            extractToolResultContent(b["content"]),
          );
        }
      }
    }
  }

  // Render events in order
  for (const event of events) {
    const sdkEvent = event.sdkEvent;

    if (sdkEvent["type"] === "assistant") {
      const message = sdkEvent["message"] as Record<string, unknown> | undefined;
      if (!message) continue;
      const content = message["content"];

      // Text blocks
      const text = extractTextBlocks(content);
      if (text.trim().length > 0) {
        lines.push("## Assistant");
        lines.push("");
        lines.push(text);
        lines.push("");
      }

      // Tool-use blocks in this assistant message
      const toolUses = extractToolUseBlocks(content);
      for (const tu of toolUses) {
        lines.push(`### Tool: ${tu.name}`);
        lines.push("");
        lines.push("**Input**");
        lines.push("");
        lines.push("```json");
        lines.push(JSON.stringify(tu.input, null, 2));
        lines.push("```");
        lines.push("");

        const result = toolResults.get(tu.id);
        if (result !== undefined) {
          lines.push("**Output**");
          lines.push("");
          lines.push("```");
          lines.push(result);
          lines.push("```");
          lines.push("");
        }
      }
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// toJson
// ---------------------------------------------------------------------------

/**
 * Serialises transcript events and header into a JSON string:
 * { header: HeaderInfo, events: ChatEvent[] }
 */
export function toJson(events: ChatEvent[], header: HeaderInfo): string {
  return JSON.stringify({ header, events }, null, 2);
}
