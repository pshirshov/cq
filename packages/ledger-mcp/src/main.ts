#!/usr/bin/env -S bun run
/**
 * ledger-mcp — standalone stdio MCP server exposing the 14 ledger tools.
 *
 * This is the cq-free counterpart to `@cq/cq-mcp`: it speaks the
 * `@modelcontextprotocol/sdk` stdio protocol over stdin/stdout and shells
 * every operation through to a file-backed `FsLedgerStore` rooted at the
 * supplied `--cwd` directory. It has NO dependency on the cq server — no
 * internal WebSocket channel, no `ask_user_question`/`submit_workflow_phase`
 * relays — so any MCP client (Claude Code, Codex, a bespoke harness) can run
 * it directly to read and mutate a ledger tree.
 *
 * CLI:
 *   ledger-mcp --cwd <absolute path>
 *
 * Lifecycle:
 *   1. Parse CLI flags. `--cwd <abs>` is required.
 *   2. Construct `FsLedgerStore({ root: cwd })` and `init()` it
 *      (auto-bootstraps the milestones ledger on first run).
 *   3. Register the 14 ledger tools on an `McpServer` via
 *      `registerLedgerStdioTools` (shared with cq-mcp through `@cq/ledger`).
 *   4. Connect a `StdioServerTransport` and run until the parent closes
 *      stdin (which the MCP SDK signals via the transport's onclose).
 *
 * Output discipline. Stdout is reserved for MCP protocol traffic only.
 * All logs and parse errors go to stderr — anything on stdout that is not
 * a JSON-RPC frame corrupts the protocol and the client tears down the
 * channel.
 */

import * as path from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FsLedgerStore, registerLedgerStdioTools } from "@cq/ledger";

interface ParsedArgs {
  cwd: string;
}

export function parseArgs(argv: readonly string[]): ParsedArgs {
  let cwd: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--cwd") {
      i += 1;
      const v = argv[i];
      if (v === undefined) {
        throw new Error("ledger-mcp: --cwd requires a value");
      }
      cwd = v;
    } else if (a !== undefined && a.startsWith("--cwd=")) {
      cwd = a.slice("--cwd=".length);
    }
  }
  if (cwd === undefined || cwd === "") {
    throw new Error("ledger-mcp: --cwd <absolute path> is required");
  }
  if (!path.isAbsolute(cwd)) {
    throw new Error(`ledger-mcp: --cwd must be an absolute path; got: ${cwd}`);
  }
  return { cwd };
}

export async function main(argv: readonly string[]): Promise<void> {
  const { cwd } = parseArgs(argv);

  // Construct the store, init it, then register tools. If init fails we
  // surface the error to stderr and exit non-zero — the parent MCP client
  // sees the channel close and treats the server as unhealthy.
  const store = new FsLedgerStore({ root: cwd });
  await store.init();

  const server = new McpServer(
    { name: "ledger-mcp", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );
  registerLedgerStdioTools(server, store);

  // Graceful shutdown on SIGTERM / SIGINT.
  const shutdown = (): void => {
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // McpServer holds the process open by virtue of the stdio listener;
  // exiting here would close stdin and tear the channel down immediately.
  process.stderr.write(`ledger-mcp: serving stdio MCP on cwd=${cwd}\n`);
}

// Only run main() when executed directly (not when imported by the test
// suite). `import.meta.main` is bun-specific but available in the bun
// runtime that hosts this binary.
const meta = import.meta as unknown as { main?: boolean };
if (meta.main === true) {
  void main(process.argv.slice(2)).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`ledger-mcp: fatal: ${msg}\n`);
    process.exit(1);
  });
}
