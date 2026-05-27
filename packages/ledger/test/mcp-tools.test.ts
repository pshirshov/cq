/**
 * MCP tool factory tests.
 *
 * We invoke each tool's handler directly (no SDK transport) and assert that
 * the returned CallToolResult has `content[0].text` that JSON-decodes to the
 * expected shape.
 */

import { describe, it, expect } from "bun:test";
import { z } from "zod";
import {
  InMemoryLedgerStore,
  LEDGER_TOOL_NAMES,
  createLedgerMcpTools,
  type LedgerSchema,
} from "../src/index.js";

const schema: LedgerSchema = {
  statusValues: ["open", "done"],
  terminalStatuses: ["done"],
  fields: {
    note: { type: "string", required: false },
  },
};

async function buildStore() {
  const store = new InMemoryLedgerStore({ seed: [{ name: "todos", schema }] });
  await store.init();
  return store;
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

describe("ledger MCP tools", () => {
  it("exports the expected tool names", async () => {
    const store = await buildStore();
    const tools = createLedgerMcpTools(store);
    expect(tools.map((t) => t.name).sort()).toEqual([...LEDGER_TOOL_NAMES].sort());
  });

  it("enumerate_ledgers + create_ledger + fetch_ledger round-trip", async () => {
    const store = await buildStore();
    const tools = createLedgerMcpTools(store);

    const enum1 = decode<{ ledgers: string[] }>(
      await callTool(tools, "enumerate_ledgers", {}),
    );
    expect(enum1.ledgers).toEqual(["todos"]);

    await callTool(tools, "create_ledger", {
      name: "alpha",
      schema: {
        statusValues: ["open", "done"],
        terminalStatuses: ["done"],
        fields: { tag: { type: "string", required: false } },
      },
    });
    const enum2 = decode<{ ledgers: string[] }>(
      await callTool(tools, "enumerate_ledgers", {}),
    );
    expect(enum2.ledgers).toEqual(["alpha", "todos"]);

    const fetched = decode<{ ledger: { id: string; counters: { milestone: number; item: number } } }>(
      await callTool(tools, "fetch_ledger", { ledger_id: "alpha" }),
    );
    expect(fetched.ledger.id).toBe("alpha");
    expect(fetched.ledger.counters).toEqual({ milestone: 0, item: 0 });
  });

  it("create_milestone + create_item + ledger_fetch + ledger_update flow", async () => {
    const store = await buildStore();
    const tools = createLedgerMcpTools(store);

    const m = decode<{ milestone: { id: string; title: string } }>(
      await callTool(tools, "create_milestone", { ledger_id: "todos", title: "first" }),
    );
    expect(m.milestone.id).toBe("M1");

    const it = decode<{ item: { id: string; status: string } }>(
      await callTool(tools, "create_item", {
        ledger_id: "todos",
        milestone_id: "M1",
        status: "open",
        fields: { note: "buy milk" },
      }),
    );
    expect(it.item.id).toBe("T1");
    expect(it.item.status).toBe("open");

    const fetched = decode<{ item: { fields: Record<string, string> } }>(
      await callTool(tools, "ledger_fetch", { ledger_id: "todos", item_id: "T1" }),
    );
    expect(fetched.item.fields["note"]).toBe("buy milk");

    const updated = decode<{ item: { status: string; fields: Record<string, string> } }>(
      await callTool(tools, "ledger_update", {
        ledger_id: "todos",
        item_id: "T1",
        status: "done",
        fields: { note: "bought milk" },
      }),
    );
    expect(updated.item.status).toBe("done");
    expect(updated.item.fields["note"]).toBe("bought milk");
  });

  it("archive_milestone refuses non-terminal items, succeeds on terminal", async () => {
    const store = await buildStore();
    const tools = createLedgerMcpTools(store);
    await callTool(tools, "create_milestone", { ledger_id: "todos", title: "x" });
    await callTool(tools, "create_item", {
      ledger_id: "todos",
      milestone_id: "M1",
      status: "open",
      fields: {},
    });
    await expect(
      callTool(tools, "archive_milestone", {
        ledger_id: "todos",
        milestone_id: "M1",
        summary: "no",
      }),
    ).rejects.toThrow(/not in terminal status/);
    await callTool(tools, "ledger_update", {
      ledger_id: "todos",
      item_id: "T1",
      status: "done",
    });
    const ptr = decode<{ pointer: { id: string; path: string } }>(
      await callTool(tools, "archive_milestone", {
        ledger_id: "todos",
        milestone_id: "M1",
        summary: "done!",
      }),
    );
    expect(ptr.pointer.id).toBe("M1");
    expect(ptr.pointer.path).toBe("./archive/todos/M1.md");
  });

  // D-LED-02 — Zod-layer rejection of invalid schemas at create_ledger.
  describe("D-LED-02 — Zod schema validation in create_ledger", () => {
    function parseCreateLedger(
      tools: ReturnType<typeof createLedgerMcpTools>,
      args: Record<string, unknown>,
    ): { success: boolean } {
      const t = tools.find((x) => x.name === "create_ledger");
      if (t === undefined) throw new Error("create_ledger not found");
      return z.object(t.inputSchema).safeParse(args);
    }

    it("rejects terminalStatuses not in statusValues", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      expect(
        parseCreateLedger(tools, {
          name: "x",
          schema: {
            statusValues: ["open"],
            terminalStatuses: ["done"],
            fields: {},
          },
        }).success,
      ).toBe(false);
    });

    it("rejects status values containing em-dash", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      expect(
        parseCreateLedger(tools, {
          name: "x",
          schema: {
            statusValues: ["open", "in—progress"],
            terminalStatuses: [],
            fields: {},
          },
        }).success,
      ).toBe(false);
    });

    it("rejects reserved field names createdAt/updatedAt", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      for (const name of ["createdAt", "updatedAt"]) {
        expect(
          parseCreateLedger(tools, {
            name: "x",
            schema: {
              statusValues: ["open"],
              terminalStatuses: [],
              fields: { [name]: { type: "timestamp", required: false } },
            },
          }).success,
        ).toBe(false);
      }
    });

    it("rejects field names with spaces or leading digits", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      for (const name of ["bad name", "1bad", "with:colon"]) {
        expect(
          parseCreateLedger(tools, {
            name: "x",
            schema: {
              statusValues: ["open"],
              terminalStatuses: [],
              fields: { [name]: { type: "string", required: false } },
            },
          }).success,
        ).toBe(false);
      }
    });

    it("accepts a clean schema (positive control)", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      expect(
        parseCreateLedger(tools, {
          name: "x",
          schema: {
            statusValues: ["open", "done"],
            terminalStatuses: ["done"],
            fields: { note: { type: "string", required: false } },
          },
        }).success,
      ).toBe(true);
    });
  });

  // D-LED-01 — Zod-layer rejection of unsafe ids.
  describe("D-LED-01 — Zod id validation", () => {
    const badIds = ["../etc/passwd", "a/b", "a b", "a.b"];
    function parseInput(
      tools: ReturnType<typeof createLedgerMcpTools>,
      name: string,
      args: Record<string, unknown>,
    ): { success: boolean } {
      const t = tools.find((x) => x.name === name);
      if (t === undefined) throw new Error(`tool not found: ${name}`);
      return z.object(t.inputSchema).safeParse(args);
    }

    it("create_milestone rejects unsafe ids at the Zod boundary", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      for (const badId of badIds) {
        const r = parseInput(tools, "create_milestone", {
          ledger_id: "todos",
          title: "x",
          id: badId,
        });
        expect(r.success).toBe(false);
      }
    });

    it("create_item rejects unsafe ids (item id and milestone_id)", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      for (const badId of badIds) {
        const rItem = parseInput(tools, "create_item", {
          ledger_id: "todos",
          milestone_id: "M1",
          status: "open",
          fields: {},
          id: badId,
        });
        expect(rItem.success).toBe(false);
        const rMile = parseInput(tools, "create_item", {
          ledger_id: "todos",
          milestone_id: badId,
          status: "open",
          fields: {},
        });
        expect(rMile.success).toBe(false);
      }
    });

    it("update_milestone and archive_milestone reject unsafe milestone_id", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      for (const badId of badIds) {
        expect(
          parseInput(tools, "update_milestone", {
            ledger_id: "todos",
            milestone_id: badId,
          }).success,
        ).toBe(false);
        expect(
          parseInput(tools, "archive_milestone", {
            ledger_id: "todos",
            milestone_id: badId,
            summary: "x",
          }).success,
        ).toBe(false);
      }
    });

    it("safe ids parse cleanly (positive control)", async () => {
      const store = await buildStore();
      const tools = createLedgerMcpTools(store);
      const r = parseInput(tools, "create_milestone", {
        ledger_id: "todos",
        title: "x",
        id: "M-ok_1",
      });
      expect(r.success).toBe(true);
    });
  });

  it("search_items returns items matching fields", async () => {
    const store = await buildStore();
    const tools = createLedgerMcpTools(store);
    await callTool(tools, "create_milestone", { ledger_id: "todos", title: "x" });
    await callTool(tools, "create_item", {
      ledger_id: "todos",
      milestone_id: "M1",
      status: "open",
      fields: { note: "buy milk" },
    });
    await callTool(tools, "create_item", {
      ledger_id: "todos",
      milestone_id: "M1",
      status: "open",
      fields: { note: "wash car" },
    });
    const hits = decode<{ items: Array<{ id: string }> }>(
      await callTool(tools, "search_items", { ledger_id: "todos", query: "milk" }),
    );
    expect(hits.items.map((i) => i.id)).toEqual(["T1"]);
  });
});
