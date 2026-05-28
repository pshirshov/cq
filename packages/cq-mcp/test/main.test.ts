/**
 * cq-mcp end-to-end test.
 *
 * Spawns the stdio binary as a subprocess, drives it through the
 * @modelcontextprotocol/sdk Client + StdioClientTransport pair, and
 * asserts that:
 *   1. enumerate_ledgers returns the seeded list from the on-disk
 *      docs/ledgers.yaml registry, and
 *   2. create_milestone mutates the docs/<ledger>.md file on disk.
 *
 * The test seeds the docs/ tree with a fixture registry + ledger
 * markdown using the FsLedgerStore directly (so the seeding format
 * stays in lockstep with the production reader), then closes the store
 * before spawning the binary so file locks don't collide.
 *
 * Stderr from the subprocess is inherited so any startup failure is
 * visible in the test output rather than blackholed by the transport.
 */

import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { FsLedgerStore } from "@cq/ledger";

/** Resolve the binary path against the worktree's node_modules/.bin. */
function resolveBinPath(): { command: string; args: string[] } {
  // The simplest portable path: invoke the entrypoint with `bun run`,
  // pointing at the source file. That bypasses bin-link resolution
  // entirely and works regardless of where the test is executed from.
  // The integration test in `codexBridge-mcp.test.ts` covers the
  // production resolution (node_modules/.bin/cq-mcp) separately.
  const here = new URL(".", import.meta.url).pathname;
  const main = path.resolve(here, "..", "src", "main.ts");
  return { command: process.execPath, args: ["run", main] };
}

let tmpRoot: string;

beforeAll(async () => {
  tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "cq-mcp-"));
  // Seed the docs/ tree by running the production store and creating a
  // ledger; then dispose so the lock is released before the subprocess
  // starts.
  const store = new FsLedgerStore({ root: tmpRoot });
  await store.init();
  await store.createLedger("todos", {
    statusValues: ["open", "done"],
    terminalStatuses: ["done"],
    fields: { note: { type: "string", required: false } },
  });
  await store.dispose();
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

async function withClient(
  fn: (client: Client) => Promise<void>,
): Promise<void> {
  const { command, args } = resolveBinPath();
  const transport = new StdioClientTransport({
    command,
    args: [...args, "--cwd", tmpRoot],
    // "inherit" surfaces the binary's stderr to the test runner.
    stderr: "inherit",
  });
  const client = new Client(
    { name: "cq-mcp-test", version: "0.0.1" },
    { capabilities: {} },
  );
  await client.connect(transport);
  try {
    await fn(client);
  } finally {
    await client.close();
  }
}

describe("cq-mcp stdio binary", () => {
  it("lists the 12 ledger tools", async () => {
    await withClient(async (client) => {
      const list = await client.listTools();
      const names = list.tools.map((t) => t.name).sort();
      expect(names).toEqual([
        "archive_milestone",
        "create_item",
        "create_ledger",
        "create_milestone",
        "enumerate_ledgers",
        "fetch_ledger",
        "fetch_ledger_archive",
        "fetch_milestone",
        "ledger_fetch",
        "ledger_update",
        "search_items",
        "update_milestone",
      ]);
    });
  });

  it("enumerate_ledgers returns the seeded list", async () => {
    await withClient(async (client) => {
      const result = await client.callTool({
        name: "enumerate_ledgers",
        arguments: {},
      });
      const block = (result.content as Array<{ type: string; text: string }>)[0];
      expect(block).toBeDefined();
      expect(block!.type).toBe("text");
      const decoded = JSON.parse(block!.text) as { ledgers: string[] };
      expect(decoded.ledgers).toEqual(["todos"]);
    });
  });

  it("create_milestone mutates the on-disk ledger file", async () => {
    await withClient(async (client) => {
      await client.callTool({
        name: "create_milestone",
        arguments: {
          ledger_id: "todos",
          id: "M-CQMCP",
          title: "Validate cq-mcp roundtrip",
        },
      });
    });
    // Re-read the ledger file with the production parser to confirm
    // the milestone landed. We reopen with a fresh store so the in-memory
    // state of the previous run cannot mask a missing on-disk write.
    const verify = new FsLedgerStore({ root: tmpRoot });
    await verify.init();
    const milestone = verify.fetchMilestone("todos", "M-CQMCP");
    expect(milestone.title).toBe("Validate cq-mcp roundtrip");
    await verify.dispose();
  });
});
