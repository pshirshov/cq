#!/usr/bin/env -S bun run
/**
 * cq-mcp — standalone stdio MCP server exposing the 12 ledger tools
 * (`mcp__cq__*` family) so that Codex sessions can reach the same
 * `FsLedgerStore` the cq server reads from.
 *
 * Rationale (defects.md D-GC-1 / D-OUTER7-02). The Codex SDK
 * (`@openai/codex-sdk@0.134.0`) does not accept in-process MCP servers.
 * It forwards `CodexOptions.config.mcp_servers.<name>` to the underlying
 * CLI which spawns each entry as an external stdio binary. This entry
 * point is that binary: it speaks the `@modelcontextprotocol/sdk` stdio
 * protocol over stdin/stdout and shells the operations through to a
 * file-backed `FsLedgerStore` rooted at the supplied `--cwd` directory.
 *
 * CLI:
 *   cq-mcp --cwd <absolute path>
 *
 * Lifecycle:
 *   1. Parse CLI flags. `--cwd <abs>` is required.
 *   2. Construct `FsLedgerStore({ root: cwd })` and `init()` it.
 *   3. Register the 12 ledger tools on an `McpServer`.
 *   4. Connect a `StdioServerTransport` and run until the parent closes
 *      stdin (which the MCP SDK signals via the transport's onclose).
 *
 * Output discipline. Stdout is reserved for MCP protocol traffic only.
 * All logs, warnings, and parse errors go to stderr — anything on
 * stdout that is not a JSON-RPC frame corrupts the protocol and the
 * Codex CLI's MCP client tears down the channel.
 *
 * Scope intentionally NOT included. `ask_user_question` is omitted. It
 * is a Claude-side feature that needs a WebSocket round-trip to the
 * user's browser; a standalone binary spawned by Codex has no such
 * channel and faking it would deadlock the model. Codex sessions that
 * need user input must use Codex's own approval-policy flow instead.
 *
 * Schemas. The Zod shapes here mirror the Claude-facing factory in
 * `packages/ledger/src/mcp/ledgerTools.ts`. They are intentionally
 * duplicated rather than imported because the Claude-side factory
 * builds Claude-SDK-typed `SdkMcpToolDefinition` objects via
 * `@anthropic-ai/claude-agent-sdk`'s `tool()` helper, whereas the MCP
 * stdio server takes raw Zod shapes through `McpServer.registerTool`.
 * Both paths share the same operational semantics; if either is
 * changed without the other, the test suite at
 * `packages/cq-mcp/test/main.test.ts` will catch the drift on the
 * standalone path and the ledger-MCP tests on the Claude path.
 */

import * as path from "node:path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { FsLedgerStore, type LedgerStore, type FieldValue, type LedgerSchema } from "@cq/ledger";

// ---------------------------------------------------------------------------
// Shared Zod fragments (mirror packages/ledger/src/mcp/ledgerTools.ts)
// ---------------------------------------------------------------------------

const FIELD_TYPE_VALUES = ["string", "string[]", "id", "id[]", "timestamp"] as const;

const fieldSpecSchema = z.object({
  type: z.enum(FIELD_TYPE_VALUES),
  required: z.boolean(),
});

const statusValueSchema = z
  .string()
  .min(1)
  .regex(
    /^[A-Za-z0-9 _-]+$/,
    "status value may only contain A-Za-z0-9, space, dash, underscore",
  );

const RESERVED_FIELD_NAMES_ZOD = ["createdAt", "updatedAt"];
const fieldNameSchema = z
  .string()
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "field name must match /^[A-Za-z_][A-Za-z0-9_]*$/",
  )
  .refine((n) => !RESERVED_FIELD_NAMES_ZOD.includes(n), {
    message: "field name is reserved (createdAt/updatedAt)",
  });

const schemaSchema = z
  .object({
    statusValues: z.array(statusValueSchema).min(1),
    terminalStatuses: z.array(z.string()),
    fields: z.record(fieldNameSchema, fieldSpecSchema),
  })
  .refine(
    (s) => s.terminalStatuses.every((t) => s.statusValues.includes(t)),
    {
      message: "every terminalStatuses entry must be in statusValues",
      path: ["terminalStatuses"],
    },
  );

const fieldValueSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.number(),
]);

const fieldsSchema = z.record(z.string(), fieldValueSchema);

const safeIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]+$/, "id may only contain A-Za-z0-9_-");

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

function jsonResult(value: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

/**
 * Register the 12 ledger tools on the given MCP server. Each handler
 * forwards directly to a LedgerStore method, serialises the result as
 * JSON, and returns it as a text content block — identical semantics to
 * the Claude-side factory in `@cq/ledger`.
 *
 * Exported so the unit test can drive it without spawning a subprocess
 * if a future iteration wants a faster path; the standalone binary uses
 * it via main().
 */
export function registerLedgerTools(server: McpServer, store: LedgerStore): void {
  server.registerTool(
    "enumerate_ledgers",
    {
      description: "List all known ledger names.",
      inputSchema: {},
    },
    async () => jsonResult({ ledgers: store.enumerate() }),
  );

  server.registerTool(
    "fetch_ledger",
    {
      description: "Fetch a ledger: schema, active milestones (with their items), and archive pointers.",
      inputSchema: { ledger_id: z.string() },
    },
    async (args) => jsonResult({ ledger: store.fetch(args.ledger_id) }),
  );

  server.registerTool(
    "fetch_ledger_archive",
    {
      description: "Fetch a specific archived milestone (full items).",
      inputSchema: {
        ledger_id: z.string(),
        archive_id: z.string(),
      },
    },
    async (args) =>
      jsonResult({ milestone: await store.fetchArchive(args.ledger_id, args.archive_id) }),
  );

  server.registerTool(
    "fetch_milestone",
    {
      description: "Fetch a single active milestone by id.",
      inputSchema: {
        ledger_id: z.string(),
        milestone_id: z.string(),
      },
    },
    async (args) =>
      jsonResult({ milestone: store.fetchMilestone(args.ledger_id, args.milestone_id) }),
  );

  server.registerTool(
    "update_milestone",
    {
      description: "Update a milestone's title and/or description. Items are not affected.",
      inputSchema: {
        ledger_id: z.string(),
        milestone_id: safeIdSchema,
        title: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async (args) => {
      const patch: { title?: string; description?: string } = {};
      if (args.title !== undefined) patch.title = args.title;
      if (args.description !== undefined) patch.description = args.description;
      const milestone = await store.updateMilestone(args.ledger_id, args.milestone_id, patch);
      return jsonResult({ milestone });
    },
  );

  server.registerTool(
    "ledger_fetch",
    {
      description: "Fetch a single item by id.",
      inputSchema: {
        ledger_id: z.string(),
        item_id: z.string(),
      },
    },
    async (args) => jsonResult({ item: store.fetchItem(args.ledger_id, args.item_id) }),
  );

  server.registerTool(
    "ledger_update",
    {
      description: "Update an item's status and/or fields. Provided fields replace existing values; omitted fields are preserved.",
      inputSchema: {
        ledger_id: z.string(),
        item_id: z.string(),
        status: z.string().optional(),
        fields: fieldsSchema.optional(),
      },
    },
    async (args) => {
      const patch: { status?: string; fields?: Record<string, FieldValue> } = {};
      if (args.status !== undefined) patch.status = args.status;
      if (args.fields !== undefined) patch.fields = args.fields as Record<string, FieldValue>;
      const item = await store.updateItem(args.ledger_id, args.item_id, patch);
      return jsonResult({ item });
    },
  );

  server.registerTool(
    "create_item",
    {
      description: "Create a new item under a milestone. Status must be in the schema's statusValues. Fields must satisfy the schema (required fields present, types match).",
      inputSchema: {
        ledger_id: z.string(),
        milestone_id: safeIdSchema,
        status: z.string(),
        fields: fieldsSchema,
        id: safeIdSchema.optional(),
      },
    },
    async (args) => {
      const init: { id?: string; status: string; fields: Record<string, FieldValue> } = {
        status: args.status,
        fields: args.fields as Record<string, FieldValue>,
      };
      if (args.id !== undefined) init.id = args.id;
      const item = await store.createItem(args.ledger_id, args.milestone_id, init);
      return jsonResult({ item });
    },
  );

  server.registerTool(
    "create_milestone",
    {
      description: "Create a new milestone in a ledger. Returns the new milestone with its allocated id.",
      inputSchema: {
        ledger_id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        id: safeIdSchema.optional(),
      },
    },
    async (args) => {
      const init: { id?: string; title: string; description?: string } = { title: args.title };
      if (args.description !== undefined) init.description = args.description;
      if (args.id !== undefined) init.id = args.id;
      const milestone = await store.createMilestone(args.ledger_id, init);
      return jsonResult({ milestone });
    },
  );

  server.registerTool(
    "create_ledger",
    {
      description: "Create a new ledger. Schema specifies allowed statuses, which subset is terminal, and the typed fields each item carries.",
      inputSchema: {
        name: z.string(),
        schema: schemaSchema,
      },
    },
    async (args) => {
      const ledger = await store.createLedger(args.name, args.schema as LedgerSchema);
      return jsonResult({ ledger });
    },
  );

  server.registerTool(
    "archive_milestone",
    {
      description: "Archive a milestone (move it to docs/archive/<ledger>/<id>.md). Refused if any item is not in a terminal status.",
      inputSchema: {
        ledger_id: z.string(),
        milestone_id: safeIdSchema,
        summary: z.string(),
      },
    },
    async (args) => {
      const pointer = await store.archiveMilestone(
        args.ledger_id,
        args.milestone_id,
        args.summary,
      );
      return jsonResult({ pointer });
    },
  );

  server.registerTool(
    "search_items",
    {
      description: "Substring search across status and field values within a single ledger.",
      inputSchema: {
        ledger_id: z.string(),
        query: z.string(),
      },
    },
    async (args) => jsonResult({ items: store.search(args.ledger_id, args.query) }),
  );
}

// ---------------------------------------------------------------------------
// CLI entrypoint
// ---------------------------------------------------------------------------

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
        throw new Error("cq-mcp: --cwd requires a value");
      }
      cwd = v;
    } else if (a !== undefined && a.startsWith("--cwd=")) {
      cwd = a.slice("--cwd=".length);
    }
  }
  if (cwd === undefined || cwd === "") {
    throw new Error("cq-mcp: --cwd <absolute path> is required");
  }
  if (!path.isAbsolute(cwd)) {
    throw new Error(`cq-mcp: --cwd must be an absolute path; got: ${cwd}`);
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
    { name: "cq-mcp", version: "0.0.1" },
    { capabilities: { tools: {} } },
  );
  registerLedgerTools(server, store);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // McpServer holds the process open by virtue of the stdio listener;
  // exiting here would close stdin and tear the channel down immediately.
  process.stderr.write(`cq-mcp: serving stdio MCP on cwd=${cwd}\n`);
}

// Only run main() when executed directly (not when imported as a module
// by the test suite). `import.meta.main` is bun-specific but available
// in the bun runtime that hosts cq.
const meta = import.meta as unknown as { main?: boolean };
if (meta.main === true) {
  void main(process.argv.slice(2)).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`cq-mcp: fatal: ${msg}\n`);
    process.exit(1);
  });
}
