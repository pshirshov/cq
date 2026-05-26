/**
 * read-file.test.ts — PR-36: handleReadFile server handler.
 *
 * Test cases:
 *  1. Stub query.readFile returning a 30-line file; handler returns lines 7..17
 *     (around line=12, context±5) for a ChatReadFileRequest with line:12.
 *  2. Stub query.readFile throwing → result.error is set; content is "".
 *  3. Stub query.readFile returning null → result.error is set.
 */

import { describe, it, expect } from "bun:test";
import { handleReadFile } from "../src/agent/readFile";
import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { ChatReadFileRequest } from "@cq/shared";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const UUID = "00000000-0000-4000-8000-000000000001";
const SESSION_UUID = "00000000-0000-4000-8000-000000000002";

function makeRequest(overrides: Partial<ChatReadFileRequest> = {}): ChatReadFileRequest {
  return {
    type: "chat.read_file_request",
    seq: 0,
    ts: Date.now(),
    requestId: UUID,
    sessionId: SESSION_UUID,
    path: "/tmp/test.txt",
    around: { line: 12, contextBefore: 5, contextAfter: 5 },
    ...overrides,
  };
}

/** Build a 30-line file string ("Line 1\nLine 2\n...Line 30"). */
function make30LineFile(): string {
  return Array.from({ length: 30 }, (_, i) => `Line ${i + 1}`).join("\n");
}

/** Create a minimal stub Query with a readFile implementation. */
function makeQueryStub(
  readFileImpl: (path: string) => Promise<{ contents: string; absPath: string } | null>,
): Query {
  return {
    readFile: readFileImpl,
    // Implement minimal AsyncIterator interface so the type checker is satisfied.
    [Symbol.asyncIterator]() { return this as unknown as AsyncIterator<never>; },
    next: () => Promise.resolve({ value: undefined as unknown as never, done: true as const }),
    interrupt: () => Promise.resolve(),
    close: () => undefined,
  } as unknown as Query;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleReadFile", () => {
  it("returns lines 7..17 (start=7) for line=12 ± 5 in a 30-line file", async () => {
    const content = make30LineFile();
    const query = makeQueryStub(async () => ({
      contents: content,
      absPath: "/tmp/test.txt",
    }));

    const frame = makeRequest({ around: { line: 12, contextBefore: 5, contextAfter: 5 } });
    const result = await handleReadFile(query, frame, 1);

    expect(result.type).toBe("chat.read_file_result");
    expect(result.requestId).toBe(UUID);
    expect(result.error).toBeUndefined();
    // startLine should be 7 (1-based: line 12 - 5 = 7)
    expect(result.startLine).toBe(7);
    // Content should be "Line 7\nLine 8\n...Line 17" (11 lines)
    const lines = result.content.split("\n");
    expect(lines.length).toBe(11);
    expect(lines[0]).toBe("Line 7");
    expect(lines[10]).toBe("Line 17");
  });

  it("uses default context (5) when contextBefore/After are not specified", async () => {
    const content = make30LineFile();
    const query = makeQueryStub(async () => ({
      contents: content,
      absPath: "/tmp/test.txt",
    }));

    const frame = makeRequest({ around: { line: 12 } });
    const result = await handleReadFile(query, frame, 2);

    expect(result.error).toBeUndefined();
    expect(result.startLine).toBe(7);
    const lines = result.content.split("\n");
    expect(lines[0]).toBe("Line 7");
    expect(lines[lines.length - 1]).toBe("Line 17");
  });

  it("clamps to file start when line - context < 1", async () => {
    const content = make30LineFile();
    const query = makeQueryStub(async () => ({
      contents: content,
      absPath: "/tmp/test.txt",
    }));

    const frame = makeRequest({ around: { line: 2, contextBefore: 5, contextAfter: 5 } });
    const result = await handleReadFile(query, frame, 3);

    expect(result.error).toBeUndefined();
    // line 2 - 5 = -3 → clamped to 0 (idx) → startLine 1
    expect(result.startLine).toBe(1);
    expect(result.content.split("\n")[0]).toBe("Line 1");
  });

  it("clamps to file end when line + context > file length", async () => {
    const content = make30LineFile();
    const query = makeQueryStub(async () => ({
      contents: content,
      absPath: "/tmp/test.txt",
    }));

    const frame = makeRequest({ around: { line: 28, contextBefore: 5, contextAfter: 5 } });
    const result = await handleReadFile(query, frame, 4);

    expect(result.error).toBeUndefined();
    // Should end at line 30
    const lines = result.content.split("\n");
    expect(lines[lines.length - 1]).toBe("Line 30");
  });

  it("sets result.error when query.readFile throws", async () => {
    const query = makeQueryStub(async () => {
      throw new Error("permission denied");
    });

    const frame = makeRequest();
    const result = await handleReadFile(query, frame, 5);

    expect(result.error).toContain("permission denied");
    expect(result.content).toBe("");
    expect(result.startLine).toBe(0);
  });

  it("sets result.error when query.readFile returns null", async () => {
    const query = makeQueryStub(async () => null);

    const frame = makeRequest();
    const result = await handleReadFile(query, frame, 6);

    expect(result.error).toContain("readFile returned null");
    expect(result.content).toBe("");
    expect(result.startLine).toBe(0);
  });
});
