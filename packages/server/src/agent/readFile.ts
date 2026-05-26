/**
 * readFile.ts — handles chat.read_file_request frames.
 *
 * Calls Query.readFile(path) from the SDK, slices the returned content
 * around the requested line number, and returns a ChatReadFileResult.
 *
 * Line numbers are 1-based in the request; startLine in the result is
 * also 1-based (first line of the returned slice).
 */

import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { ChatReadFileRequest, ChatReadFileResult } from "@cq/shared";

const DEFAULT_CONTEXT = 5;

/**
 * Handles a chat.read_file_request and returns a ChatReadFileResult.
 *
 * @param query  - active SDK Query (must support readFile)
 * @param frame  - the incoming request frame
 * @param seq    - sequence number for the result frame
 */
export async function handleReadFile(
  query: Query,
  frame: ChatReadFileRequest,
  seq: number,
): Promise<ChatReadFileResult> {
  const base: Omit<ChatReadFileResult, "content" | "startLine"> = {
    type: "chat.read_file_result",
    seq,
    ts: Date.now(),
    requestId: frame.requestId,
  };

  let fileContents: string;
  try {
    const result = await query.readFile(frame.path);
    if (result === null) {
      return { ...base, content: "", startLine: 0, error: `readFile returned null for: ${frame.path}` };
    }
    fileContents = result.contents;
  } catch (err: unknown) {
    return { ...base, content: "", startLine: 0, error: String(err) };
  }

  const lines = fileContents.split("\n");
  const targetLine = frame.around.line; // 1-based
  const before = frame.around.contextBefore ?? DEFAULT_CONTEXT;
  const after = frame.around.contextAfter ?? DEFAULT_CONTEXT;

  // Compute slice bounds (0-based indices, clamped to array bounds)
  const startIdx = Math.max(0, targetLine - 1 - before);
  const endIdx = Math.min(lines.length, targetLine + after); // exclusive

  const slice = lines.slice(startIdx, endIdx);
  return {
    ...base,
    content: slice.join("\n"),
    startLine: startIdx + 1, // 1-based
  };
}
