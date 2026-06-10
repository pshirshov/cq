/**
 * Stdio tool-name prefix tests (T375 / G45).
 *
 * Threads the trailing optional `toolPrefix` through `registerLedgerStdioTools`
 * and asserts — via a real `@modelcontextprotocol/sdk` `McpServer` round-tripped
 * over an in-memory transport with a `Client.listTools()` call — that:
 *  - a non-empty prefix registers exactly `prefixedToolNames(prefix)`;
 *  - the default `''` (and an omitted arg) registers exactly `LEDGER_TOOL_NAMES`.
 *
 * The prefix is a PURE NAME TRANSFORM: only the registered names change; config
 * (description/inputSchema) and handler behaviour are untouched.
 */

import { describe, it, expect } from "bun:test";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import {
  InMemoryLedgerStore,
  registerLedgerStdioTools,
  LEDGER_TOOL_NAMES,
  prefixedToolNames,
  type LedgerStore,
} from "../src/index.js";

async function buildStore(): Promise<LedgerStore> {
  const store = new InMemoryLedgerStore();
  await store.init();
  return store;
}

/**
 * Register the stdio tools (with the given trailing args) on a fresh McpServer,
 * round-trip a Client over an in-memory transport, and return the sorted list of
 * registered tool names via tools/list.
 */
async function registeredNames(
  store: LedgerStore,
  ...trailing: [readLog?: undefined, configCapability?: undefined, promptCatalog?: undefined, toolPrefix?: string]
): Promise<string[]> {
  const server = new McpServer(
    { name: "stdio-prefix-test", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );
  registerLedgerStdioTools(server, store, ...trailing);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "stdio-prefix-test-client", version: "0.0.1" }, { capabilities: {} });
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    return tools.map((t) => t.name).sort();
  } finally {
    await client.close();
  }
}

describe("registerLedgerStdioTools — trailing toolPrefix", () => {
  it("registers prefixedToolNames(prefix) for a non-empty prefix", async () => {
    const store = await buildStore();
    const names = await registeredNames(store, undefined, undefined, undefined, "myproj");
    expect(names).toEqual([...prefixedToolNames("myproj")].sort());
    // Every registered name carries the prefix; the count is preserved.
    expect(names.length).toBe(LEDGER_TOOL_NAMES.length);
    expect(names.every((n) => n.startsWith("myproj_"))).toBe(true);
  });

  it("registers exactly LEDGER_TOOL_NAMES for prefix ''", async () => {
    const store = await buildStore();
    const names = await registeredNames(store, undefined, undefined, undefined, "");
    expect(names).toEqual([...LEDGER_TOOL_NAMES].sort());
  });

  it("registers exactly LEDGER_TOOL_NAMES when toolPrefix is omitted (default '')", async () => {
    const store = await buildStore();
    const names = await registeredNames(store);
    expect(names).toEqual([...LEDGER_TOOL_NAMES].sort());
  });

  it("rejects an invalid (non-alphanumeric) prefix at the boundary", async () => {
    const store = await buildStore();
    const server = new McpServer(
      { name: "stdio-prefix-bad", version: "0.0.1" },
      { capabilities: { tools: {} } },
    );
    expect(() =>
      registerLedgerStdioTools(server, store, undefined, undefined, undefined, "bad prefix"),
    ).toThrow(/Invalid tool prefix/);
  });
});
