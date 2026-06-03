/**
 * read_log tests (T147 / Q87).
 *
 * Exercises the FS-store-backed `read_log` capability via the SDK tool factory:
 *  - happy path: reads a file under <root>/docs/logs/
 *  - rejects `..` traversal escaping docs/logs/
 *  - rejects absolute paths resolving outside docs/logs/
 *  - truncates an oversized file and sets `truncated: true`
 *
 * The confinement root is the EXPLICIT FsLedgerStore root, not the generic
 * LedgerStore interface (R137 #6); the in-memory not-implemented behaviour is
 * asserted in mcp-tools.test.ts.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  FsLedgerStore,
  createLedgerMcpTools,
  MAX_READ_LOG_BYTES,
  type ReadLogResult,
} from "../src/index.js";

const dirs: string[] = [];

afterAll(async () => {
  await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
});

async function buildFsStore(): Promise<{ store: FsLedgerStore; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "ledger-readlog-"));
  dirs.push(root);
  await mkdir(path.join(root, "docs"), { recursive: true });
  const store = new FsLedgerStore({ root });
  await store.init();
  return { store, root };
}

function callTool(
  tools: ReturnType<typeof createLedgerMcpTools>,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const t = tools.find((x) => x.name === name);
  if (t === undefined) throw new Error(`tool not found: ${name}`);
  return t.handler(args as never, null) as Promise<{
    content: Array<{ type: string; text: string }>;
  }>;
}

function decode<T>(result: { content: Array<{ type: string; text: string }> }): T {
  const first = result.content[0];
  if (first === undefined || first.type !== "text") {
    throw new Error("expected single text content block");
  }
  return JSON.parse(first.text) as T;
}

describe("read_log (FS-backed)", () => {
  it("returns the content of a file under <root>/docs/logs/", async () => {
    const { store, root } = await buildFsStore();
    const logsDir = path.join(root, "docs", "logs");
    await mkdir(logsDir, { recursive: true });
    await writeFile(path.join(logsDir, "session.md"), "hello log\n", "utf8");

    const tools = createLedgerMcpTools(store, (p) => store.readLog(p));
    const res = decode<ReadLogResult>(
      await callTool(tools, "read_log", { path: "session.md" }),
    );
    expect(res.path).toBe("session.md");
    expect(res.content).toBe("hello log\n");
    expect(res.truncated).toBeUndefined();
  });

  it("rejects `..` traversal escaping docs/logs/", async () => {
    const { store, root } = await buildFsStore();
    // A secret file directly under docs/ (one level above docs/logs/).
    await writeFile(path.join(root, "docs", "secret.md"), "TOP SECRET", "utf8");
    await mkdir(path.join(root, "docs", "logs"), { recursive: true });

    const tools = createLedgerMcpTools(store, (p) => store.readLog(p));
    await expect(
      callTool(tools, "read_log", { path: "../secret.md" }),
    ).rejects.toThrow(/escapes docs\/logs/);
  });

  it("rejects an absolute path resolving outside docs/logs/", async () => {
    const { store } = await buildFsStore();
    const tools = createLedgerMcpTools(store, (p) => store.readLog(p));
    await expect(
      callTool(tools, "read_log", { path: "/etc/passwd" }),
    ).rejects.toThrow(/absolute paths are not allowed/);
  });

  it("truncates an oversized file and sets truncated:true", async () => {
    const { store, root } = await buildFsStore();
    const logsDir = path.join(root, "docs", "logs");
    await mkdir(logsDir, { recursive: true });
    const big = "x".repeat(MAX_READ_LOG_BYTES + 1024);
    await writeFile(path.join(logsDir, "big.log"), big, "utf8");

    const tools = createLedgerMcpTools(store, (p) => store.readLog(p));
    const res = decode<ReadLogResult>(
      await callTool(tools, "read_log", { path: "big.log" }),
    );
    expect(res.truncated).toBe(true);
    expect(res.content.length).toBe(MAX_READ_LOG_BYTES);
  });
});
