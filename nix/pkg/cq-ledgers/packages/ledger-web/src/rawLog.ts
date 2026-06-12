/**
 * rawLog — JSONL transcript parser + pretty-printing conversation model
 * for the web log viewer (T412).
 *
 * Browser-safe: this module imports NO `node:` builtins. It takes a raw
 * `.jsonl` string (as returned by `client.readLog().content`) plus the
 * `truncated` flag, and produces a structured, ordered conversation model the
 * UI renders. On-disk form stays strict JSONL; pretty-printing (JSON args /
 * results, role labels, collapsible tool calls) is modelled HERE.
 *
 * The Claude Code transcript is a sequence of JSON objects, one per line, each
 * with a `type` (`user` | `assistant` | `attachment` | `system` | …) and,
 * for conversational events, a `message` carrying `role` and `content`.
 * `content` is either a plain string or an array of content blocks:
 *   - `{ type: "text", text }`
 *   - `{ type: "tool_use", id, name, input }`
 *   - `{ type: "tool_result", tool_use_id, content }` (content: string | block[])
 *
 * Unparseable lines never throw: they surface as a `raw`-marker turn so the
 * viewer can show them verbatim. A `truncated` read surfaces a notice in the
 * model.
 */

/** Byte cap the read_log MCP tool enforces; surfaced verbatim in the notice. */
const TRUNCATION_CAP = "4 MiB";

/** Kind discriminator for a rendered conversation turn. */
export type TurnKind = "assistant" | "user" | "tool_use" | "tool_result" | "raw";

/** Common fields on every turn. */
interface TurnBase {
  kind: TurnKind;
  /** 0-based index of the source JSONL line this turn derives from. */
  lineIndex: number;
}

/** A text turn spoken by the assistant. */
export interface AssistantTurn extends TurnBase {
  kind: "assistant";
  /** Concatenated text blocks (already plain text, ready to render). */
  text: string;
}

/** A text turn from the user (plain prompt or text blocks). */
export interface UserTurn extends TurnBase {
  kind: "user";
  text: string;
}

/** A tool invocation by the assistant. Collapsible in the UI. */
export interface ToolUseTurn extends TurnBase {
  kind: "tool_use";
  /** Anthropic tool_use block id; pairs with a later tool_result. */
  toolUseId: string;
  /** Tool name, e.g. "Bash", "Read". */
  toolName: string;
  /** Pretty-printed JSON of the tool input/arguments. */
  inputPretty: string;
}

/** A tool result. Collapsible; paired to its tool_use via `toolUseId`. */
export interface ToolResultTurn extends TurnBase {
  kind: "tool_result";
  /** Matches the originating tool_use block's id (or null if absent). */
  toolUseId: string | null;
  /** The tool_use this result pairs with, if found earlier in the stream. */
  pairedToolName: string | null;
  /** Pretty-printed result text (JSON pretty-printed when structured). */
  resultPretty: string;
  /** True when the tool reported an error result. */
  isError: boolean;
}

/** A line that could not be parsed/classified; rendered verbatim. */
export interface RawTurn extends TurnBase {
  kind: "raw";
  /** The original line, verbatim. */
  raw: string;
  /** Why it surfaced raw (parse failure vs unclassifiable event). */
  reason: "unparseable" | "unclassified";
}

export type ConversationTurn =
  | AssistantTurn
  | UserTurn
  | ToolUseTurn
  | ToolResultTurn
  | RawTurn;

/** The structured model the UI renders. */
export interface ConversationModel {
  turns: ConversationTurn[];
  /** Present (and rendered as a banner) only when the read was truncated. */
  truncatedNotice: string | null;
}

/** Pretty-print an arbitrary value as 2-space-indented JSON; never throws. */
function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    // Circular or otherwise non-serialisable — fall back to String().
    return String(value);
  }
}

/** True for a non-null, non-array object (the shape every block/event has). */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Render a tool_result `content` (string | block[] | other) to display text.
 * Text blocks are concatenated; anything else is pretty-printed JSON.
 */
function renderToolResultContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (isRecord(block) && block["type"] === "text" && typeof block["text"] === "string") {
        parts.push(block["text"]);
      } else {
        parts.push(prettyJson(block));
      }
    }
    return parts.join("\n");
  }
  return prettyJson(content);
}

/**
 * Classify the content blocks of one conversational event into turns,
 * appending to `turns`. `pairing` tracks tool_use id → name so a later
 * tool_result can name its originator.
 */
function classifyBlocks(
  blocks: unknown[],
  role: string,
  lineIndex: number,
  turns: ConversationTurn[],
  pairing: Map<string, string>,
): void {
  // Coalesce consecutive text blocks of one event into a single turn.
  const textParts: string[] = [];
  const flushText = (): void => {
    if (textParts.length === 0) return;
    const text = textParts.join("");
    textParts.length = 0;
    if (text.trim() === "") return;
    if (role === "assistant") {
      turns.push({ kind: "assistant", lineIndex, text });
    } else {
      turns.push({ kind: "user", lineIndex, text });
    }
  };

  for (const block of blocks) {
    if (!isRecord(block)) continue;
    const type = block["type"];
    if (type === "text" && typeof block["text"] === "string") {
      textParts.push(block["text"]);
    } else if (type === "tool_use") {
      flushText();
      const toolUseId = typeof block["id"] === "string" ? block["id"] : "";
      const toolName = typeof block["name"] === "string" ? block["name"] : "(unknown tool)";
      if (toolUseId !== "") pairing.set(toolUseId, toolName);
      turns.push({
        kind: "tool_use",
        lineIndex,
        toolUseId,
        toolName,
        inputPretty: prettyJson(block["input"]),
      });
    } else if (type === "tool_result") {
      flushText();
      const toolUseId = typeof block["tool_use_id"] === "string" ? block["tool_use_id"] : null;
      const pairedToolName = toolUseId !== null ? pairing.get(toolUseId) ?? null : null;
      turns.push({
        kind: "tool_result",
        lineIndex,
        toolUseId,
        pairedToolName,
        resultPretty: renderToolResultContent(block["content"]),
        isError: block["is_error"] === true,
      });
    }
    // Unknown block types are ignored (e.g. thinking/image); the line is not
    // surfaced raw because it parsed as a known event.
  }
  flushText();
}

/**
 * Parse a single already-JSON-parsed event object into zero or more turns.
 * Returns true if the event was classified (even into zero turns); false if it
 * was a conversational event with no usable content (caller surfaces it raw).
 */
function classifyEvent(
  event: Record<string, unknown>,
  lineIndex: number,
  turns: ConversationTurn[],
  pairing: Map<string, string>,
): boolean {
  const message = event["message"];
  if (!isRecord(message)) {
    // Non-conversational events (attachment, system, summary, …) carry no
    // message content to render; treat as classified-but-empty.
    return true;
  }
  const role = typeof message["role"] === "string" ? message["role"] : "assistant";
  const content = message["content"];

  if (typeof content === "string") {
    if (content.trim() === "") return true;
    turns.push(
      role === "assistant"
        ? { kind: "assistant", lineIndex, text: content }
        : { kind: "user", lineIndex, text: content },
    );
    return true;
  }
  if (Array.isArray(content)) {
    classifyBlocks(content, role, lineIndex, turns, pairing);
    return true;
  }
  // A message with neither string nor array content is unclassifiable.
  return false;
}

/**
 * Parse a raw `.jsonl` transcript string into the structured conversation
 * model. Never throws: malformed lines surface as `raw`-marker turns.
 *
 * @param raw       the file content (`ReadLogResult.content`)
 * @param truncated the `ReadLogResult.truncated` flag
 */
export function parseRawLog(raw: string, truncated = false): ConversationModel {
  const turns: ConversationTurn[] = [];
  const pairing = new Map<string, string>();
  const lines = raw.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined || line.trim() === "") continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      turns.push({ kind: "raw", lineIndex: i, raw: line, reason: "unparseable" });
      continue;
    }
    if (!isRecord(event)) {
      turns.push({ kind: "raw", lineIndex: i, raw: line, reason: "unclassified" });
      continue;
    }
    const classified = classifyEvent(event, i, turns, pairing);
    if (!classified) {
      turns.push({ kind: "raw", lineIndex: i, raw: line, reason: "unclassified" });
    }
  }

  return {
    turns,
    truncatedNotice: truncated ? `truncated at ${TRUNCATION_CAP}` : null,
  };
}
