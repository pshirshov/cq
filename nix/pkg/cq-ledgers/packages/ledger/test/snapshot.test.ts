/**
 * Unit tests for the pure snapshot/summarize helpers (T143, Q75).
 *
 * These exercise the projection logic in isolation (no store), plus an
 * output-size guard: a realistic-scale snapshot must stay well under the
 * token-overflow threshold that motivated the goal.
 */

import { describe, it, expect } from "bun:test";
import type { FetchedLedger, Item } from "../src/index.js";
import { buildSnapshot, summarize } from "../src/index.js";

function item(id: string, status: string, fields: Item["fields"]): Item {
  return {
    id,
    milestoneId: "M1",
    status,
    fields,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function ledger(id: string, items: Item[]): FetchedLedger {
  return {
    id,
    schema: { statusValues: [], terminalStatuses: [], fields: {} },
    counters: { milestone: 0, item: items.length },
    milestones: [
      {
        id: "M1",
        milestone: { id: "M1", status: "open", title: "m", description: "" },
        items,
      },
    ],
    archivePointers: [],
  };
}

describe("summarize() precedence", () => {
  it("follows headline ?? title ?? question ?? summary", () => {
    expect(summarize(item("X1", "open", { headline: "H", title: "T" }))).toBe("H");
    expect(summarize(item("X2", "open", { title: "T", question: "Q" }))).toBe("T");
    expect(summarize(item("X3", "open", { question: "Q", summary: "S" }))).toBe("Q");
    expect(summarize(item("X4", "open", { summary: "S", other: "O" }))).toBe("S");
  });

  it("falls back to the first criticism line, then the first field", () => {
    expect(
      summarize(item("X5", "open", { criticism: ["first crit\nsecond"], notes: "n" })),
    ).toBe("first crit");
    expect(summarize(item("X6", "open", { notes: "only field" }))).toBe("only field");
    expect(summarize(item("X7", "open", {}))).toBe("");
  });

  it("comma-joins array values", () => {
    expect(summarize(item("X8", "open", { title: ["a", "b"] }))).toBe("a, b");
  });
});

describe("buildSnapshot()", () => {
  it("groups by ledger × status with counts and {id,status,summary} stubs", () => {
    const snap = buildSnapshot([
      ledger("defects", [
        item("D1", "open", { headline: "h1", description: "LONG body" }),
        item("D2", "open", { headline: "h2" }),
        item("D3", "wip", { headline: "h3" }),
      ]),
      ledger("questions", [item("Q1", "open", { question: "q?" })]),
    ]);

    expect(snap["defects"]?.["open"]?.count).toBe(2);
    expect(snap["defects"]?.["wip"]?.count).toBe(1);
    expect(snap["questions"]?.["open"]?.count).toBe(1);

    const d1 = snap["defects"]?.["open"]?.items.find((i) => i.id === "D1");
    expect(d1).toEqual({ id: "D1", status: "open", summary: "h1" });
    // No long fields leak.
    expect(JSON.stringify(snap)).not.toContain("LONG body");
  });

  it("omits ledgers with no active items", () => {
    const snap = buildSnapshot([ledger("defects", []), ledger("questions", [item("Q1", "open", { question: "q" })])]);
    expect(Object.keys(snap)).toEqual(["questions"]);
  });

  it("stays well under the token-overflow threshold for a realistic ledger", () => {
    // Simulate a realistic active set: 300 items spread across 6 ledgers.
    const ledgers: FetchedLedger[] = [];
    for (let l = 0; l < 6; l++) {
      const items: Item[] = [];
      for (let i = 0; i < 50; i++) {
        items.push(
          item(`L${l}I${i}`, i % 2 === 0 ? "open" : "wip", {
            headline: `item ${l}-${i} with a moderately long human-readable headline`,
            description: "X".repeat(2000), // long field that MUST be stripped
          }),
        );
      }
      ledgers.push(ledger(`ledger${l}`, items));
    }
    const snap = buildSnapshot(ledgers);
    const bytes = JSON.stringify(snap).length;
    // Long descriptions stripped: 300 × 2000 = 600 KB would blow the budget.
    // The stub-only snapshot must be a tiny fraction. Threshold: 64 KB.
    expect(bytes).toBeLessThan(64 * 1024);
    expect(JSON.stringify(snap)).not.toContain("XXXX");
  });
});
