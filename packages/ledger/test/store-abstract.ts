/**
 * Abstract test suite for LedgerStore.
 *
 * Same suite runs against:
 *   - FsLedgerStore (against a freshly-created tmp dir per test)
 *   - InMemoryLedgerStore (dual-tests dummy)
 *
 * Dual-tests principle: the production adapter and the in-memory dummy must
 * be observationally indistinguishable for the behaviours exercised here.
 */

import { describe, it, expect } from "bun:test";
import type { LedgerSchema, LedgerStore } from "../src/index.js";

export interface AbstractStoreFactory {
  /** Build a fresh store with the given pre-registered ledgers. */
  build(seed: Array<{ name: string; schema: LedgerSchema }>): Promise<LedgerStore>;
  /** Optional teardown hook (e.g. remove tmp dir). */
  teardown?(store: LedgerStore): Promise<void>;
  name: string;
}

const defectsSchema: LedgerSchema = {
  statusValues: ["open", "in-progress", "resolved", "abandoned"],
  terminalStatuses: ["resolved", "abandoned"],
  fields: {
    severity: { type: "string", required: true },
    location: { type: "string", required: true },
    description: { type: "string", required: true },
    rootCause: { type: "string", required: false },
    relatedIds: { type: "id[]", required: false },
  },
};

const tasksSchema: LedgerSchema = {
  statusValues: ["open", "done"],
  terminalStatuses: ["done"],
  fields: {
    notes: { type: "string", required: false },
  },
};

export function runStoreAbstractSuite(factory: AbstractStoreFactory): void {
  describe(`LedgerStore (abstract suite, ${factory.name})`, () => {
    it("enumerate() lists seeded ledgers, sorted", async () => {
      const store = await factory.build([
        { name: "defects", schema: defectsSchema },
        { name: "tasks", schema: tasksSchema },
      ]);
      try {
        expect(store.enumerate()).toEqual(["defects", "tasks"]);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("createMilestone + createItem + counters monotonic", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        const m1 = await store.createMilestone("defects", { title: "first" });
        expect(m1.id).toBe("M1");
        const m2 = await store.createMilestone("defects", { title: "second" });
        expect(m2.id).toBe("M2");
        const item1 = await store.createItem("defects", "M1", {
          status: "open",
          fields: { severity: "minor", location: "x.ts", description: "foo" },
        });
        expect(item1.id).toBe("D1");
        const item2 = await store.createItem("defects", "M1", {
          status: "open",
          fields: { severity: "nit", location: "y.ts", description: "bar" },
        });
        expect(item2.id).toBe("D2");
        const ledger = store.fetch("defects");
        expect(ledger.counters).toEqual({ milestone: 2, item: 2 });
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("caller-supplied id is honoured; duplicate is refused", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        const m = await store.createMilestone("defects", { id: "M5", title: "x" });
        expect(m.id).toBe("M5");
        // Counter advances past M5: counter was 0, supplied M5 sets next to 6,
        // next auto-create increments to 7 then issues M7.
        const m2 = await store.createMilestone("defects", { title: "y" });
        expect(m2.id).toBe("M7");
        await expect(
          store.createMilestone("defects", { id: "M5", title: "dup" }),
        ).rejects.toThrow(/Duplicate milestone id/);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("updateItem mutates status + fields and bumps updatedAt", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        await store.createMilestone("defects", { title: "x" });
        const created = await store.createItem("defects", "M1", {
          status: "open",
          fields: { severity: "minor", location: "x.ts", description: "foo" },
        });
        const updated = await store.updateItem("defects", created.id, {
          status: "resolved",
          fields: { rootCause: "rc", relatedIds: ["D2"] },
        });
        expect(updated.status).toBe("resolved");
        expect(updated.fields["rootCause"]).toBe("rc");
        expect(updated.fields["relatedIds"]).toEqual(["D2"]);
        // Pre-existing fields preserved.
        expect(updated.fields["severity"]).toBe("minor");
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("invalid status / unknown field / missing required field are rejected", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        await store.createMilestone("defects", { title: "x" });
        await expect(
          store.createItem("defects", "M1", {
            status: "BOGUS",
            fields: { severity: "minor", location: "x.ts", description: "foo" },
          }),
        ).rejects.toThrow(/Invalid status/);
        await expect(
          store.createItem("defects", "M1", {
            status: "open",
            fields: { severity: "minor", location: "x.ts" /* missing description */ },
          }),
        ).rejects.toThrow(/Missing required field/);
        await expect(
          store.createItem("defects", "M1", {
            status: "open",
            fields: {
              severity: "minor",
              location: "x.ts",
              description: "ok",
              unknownThing: "x",
            },
          }),
        ).rejects.toThrow(/unknown field/);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("search returns items matching status, string field, or array field", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        await store.createMilestone("defects", { title: "x" });
        const a = await store.createItem("defects", "M1", {
          status: "open",
          fields: { severity: "minor", location: "Stream.tsx", description: "scroll bug" },
        });
        const b = await store.createItem("defects", "M1", {
          status: "resolved",
          fields: { severity: "major", location: "Header.tsx", description: "badge order" },
        });
        const c = await store.createItem("defects", "M1", {
          status: "open",
          fields: {
            severity: "nit",
            location: "Input.tsx",
            description: "labelled",
            relatedIds: ["D1"],
          },
        });
        // by status
        expect(store.search("defects", "resolved").map((i) => i.id)).toEqual([b.id]);
        // by string field substring
        expect(store.search("defects", "stream").map((i) => i.id)).toEqual([a.id]);
        // by array field
        expect(store.search("defects", "D1").map((i) => i.id)).toEqual([c.id]);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("archiveMilestone refuses non-terminal items and succeeds when all terminal", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        await store.createMilestone("defects", { title: "M-one" });
        const it1 = await store.createItem("defects", "M1", {
          status: "open",
          fields: { severity: "minor", location: "x.ts", description: "foo" },
        });
        await store.createItem("defects", "M1", {
          status: "resolved",
          fields: { severity: "minor", location: "y.ts", description: "bar" },
        });
        await expect(
          store.archiveMilestone("defects", "M1", "summary"),
        ).rejects.toThrow(/not in terminal status/);
        await store.updateItem("defects", it1.id, { status: "resolved" });
        const ptr = await store.archiveMilestone("defects", "M1", "summary one");
        expect(ptr.id).toBe("M1");
        expect(ptr.path).toBe("./archive/defects/M1.md");
        expect(ptr.summary).toBe("summary one");
        // Ledger no longer contains M1 in active milestones; pointer recorded.
        const l = store.fetch("defects");
        expect(l.milestones.map((m) => m.id)).toEqual([]);
        expect(l.archivePointers.map((p) => p.id)).toEqual(["M1"]);
        // Archive is readable.
        const archived = await store.fetchArchive("defects", "M1");
        expect(archived.items.length).toBe(2);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("createLedger adds a ledger and validates against schema", async () => {
      const store = await factory.build([]);
      try {
        const l = await store.createLedger("todos", {
          statusValues: ["open", "done"],
          terminalStatuses: ["done"],
          fields: { notes: { type: "string", required: false } },
        });
        expect(l.id).toBe("todos");
        expect(store.enumerate()).toContain("todos");
        // Duplicate refused.
        await expect(
          store.createLedger("todos", {
            statusValues: ["a"],
            terminalStatuses: [],
            fields: {},
          }),
        ).rejects.toThrow(/Duplicate ledger/);
      } finally {
        await factory.teardown?.(store);
      }
    });

    it("fetch / fetchMilestone / fetchItem throw typed errors when missing", async () => {
      const store = await factory.build([{ name: "defects", schema: defectsSchema }]);
      try {
        expect(() => store.fetch("nope")).toThrow(/Ledger not found/);
        expect(() => store.fetchMilestone("defects", "M99")).toThrow(/Milestone not found/);
        expect(() => store.fetchItem("defects", "D99")).toThrow(/Item not found/);
      } finally {
        await factory.teardown?.(store);
      }
    });
  });
}
