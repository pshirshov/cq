/**
 * D13 / T132 — DISTINCT-per-item-description navigation-perf bench.
 *
 * Figure of merit (DETERMINISTIC): bytes written to stdout per cursor MOVE.
 *
 * Rationale: ink's standard renderer (log-update.js createStandard) erases and
 * rewrites the WHOLE frame on every change (`eraseLines(prev) + str`). Its
 * incremental renderer (createIncremental) diffs line-by-line and rewrites only
 * the lines that actually changed. On a cursor move the newly-selected item's
 * detail content legitimately changes — but with DISTINCT long descriptions the
 * detail block is the dominant, changing region while the surrounding chrome
 * (list rows, borders, header) is largely stable. Under the standard renderer
 * the whole frame (chrome + detail) is rewritten every move; under incremental
 * only the changed lines are. We measure the per-move stdout-write volume under
 * BOTH modes against the SAME distinct-description ledger.
 *
 * This is the CONFOUND-FREE bench: each item has a DIFFERENT long markdown body
 * (the same-description bench under-counts because V8/ink optimise
 * identical-output re-renders).
 *
 * Run: bun run debug/20260603-150000-d13-distinct-navperf.tsx
 */

import { EventEmitter } from "node:events";
import React from "react";
import { render } from "ink";
import { App } from "../src/app.js";
import type {
  ArchiveContent,
  FetchedLedger,
  Item,
  ItemInit,
  ItemPatch,
  LedgerClient,
  LedgerSummary,
  LedgerSchema,
  MilestonePatch,
} from "../src/types.js";

const TS = "2026-01-01T00:00:00.000Z";
const ENTER = "\r";
const tick = (ms = 25): Promise<void> => new Promise((r) => setTimeout(r, ms));

const tasksSchema: LedgerSchema = {
  statusValues: ["planned", "wip", "done"],
  terminalStatuses: ["done"],
  idPrefix: "T",
  transitions: { planned: ["wip", "done"], wip: ["done"], done: [] },
  fields: {
    headline: { type: "string", required: true },
    description: { type: "string", required: false },
  },
};

/**
 * A DISTINCT long markdown body for item i — a different multi-paragraph block
 * per item, so no two items render the same detail content.
 */
function distinctLongDescription(i: number): string {
  const lines: string[] = [];
  lines.push(`# Item ${i} detail`);
  lines.push("");
  for (let p = 0; p < 6; p++) {
    lines.push(
      `Paragraph ${p} of item ${i}: ` +
        `the quick brown fox number ${i * 7 + p} jumps over the lazy dog ` +
        `repeatedly across many words to force a multi-line wrapped block ${i}.`,
    );
    lines.push("");
  }
  lines.push("- bullet alpha " + i);
  lines.push("- bullet beta " + (i + 1));
  lines.push("- bullet gamma " + (i + 2));
  return lines.join("\n");
}

class DistinctClient implements LedgerClient {
  constructor(private readonly n: number) {}
  displayName(): string {
    return "distinct";
  }
  async enumerateLedgers(): Promise<LedgerSummary[]> {
    return [{ name: "tasks", itemCount: this.n }];
  }
  async fetchLedger(_ledgerId: string): Promise<FetchedLedger> {
    const items: Item[] = Array.from({ length: this.n }, (_, i) => ({
      id: `T${i + 1}`,
      milestoneId: "M1",
      status: i % 2 === 0 ? "planned" : "wip",
      fields: { headline: `task ${i + 1}`, description: distinctLongDescription(i + 1) },
      createdAt: TS,
      updatedAt: TS,
    }));
    return {
      id: "tasks",
      schema: tasksSchema,
      counters: { milestone: 2, item: this.n + 1 },
      milestones: [
        { id: "M1", milestone: { id: "M1", status: "open", title: "Distinct", description: "" }, items },
      ],
      archivePointers: [],
    };
  }
  async fetchLedgerArchive(): Promise<ArchiveContent> {
    throw new Error("not implemented");
  }
  async fetchItem(): Promise<Item> {
    throw new Error("not implemented");
  }
  async createItem(_l: string, _m: string, _init: ItemInit): Promise<Item> {
    throw new Error("not implemented");
  }
  async updateItem(_l: string, _id: string, _p: ItemPatch): Promise<Item> {
    throw new Error("not implemented");
  }
  async ftsSearch(): Promise<never[]> {
    return [];
  }
  async createMilestone(): Promise<Item> {
    throw new Error("not implemented");
  }
  async updateMilestone(_id: string, _p: MilestonePatch): Promise<Item> {
    throw new Error("not implemented");
  }
  async close(): Promise<void> {}
}

/** A fake TTY stdout that counts every byte written. */
function makeCountingStdout(): NodeJS.WriteStream & { bytes: number; frames: string[] } {
  const e = new EventEmitter() as unknown as NodeJS.WriteStream & {
    bytes: number;
    frames: string[];
  };
  e.bytes = 0;
  e.frames = [];
  e.columns = 120;
  e.rows = 40;
  (e as unknown as { isTTY: boolean }).isTTY = true;
  e.write = ((chunk: string | Uint8Array): boolean => {
    const s = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    e.bytes += Buffer.byteLength(s, "utf8");
    e.frames.push(s);
    return true;
  }) as NodeJS.WriteStream["write"];
  return e;
}

/**
 * A fake stdin ink can attach to in raw mode. Ink reads input via the
 * `'readable'` event + `stdin.read()` (App.js handleReadable), NOT `'data'`, so
 * `send` must store the chunk, emit `'readable'`, and have `read()` return it
 * once then clear — exactly as ink-testing-library's Stdin does.
 */
function makeFakeStdin(): NodeJS.ReadStream & { send: (s: string) => void } {
  const e = new EventEmitter() as unknown as NodeJS.ReadStream & { send: (s: string) => void };
  let pending: string | null = null;
  (e as unknown as { isTTY: boolean }).isTTY = true;
  e.setRawMode = (() => e) as NodeJS.ReadStream["setRawMode"];
  e.setEncoding = (() => e) as NodeJS.ReadStream["setEncoding"];
  e.resume = (() => e) as NodeJS.ReadStream["resume"];
  e.pause = (() => e) as NodeJS.ReadStream["pause"];
  e.ref = (() => e) as NodeJS.ReadStream["ref"];
  e.unref = (() => e) as NodeJS.ReadStream["unref"];
  e.read = (() => {
    const d = pending;
    pending = null;
    return d;
  }) as NodeJS.ReadStream["read"];
  e.send = (s: string): void => {
    pending = s;
    e.emit("readable");
    e.emit("data", s);
  };
  return e;
}

interface RunResult {
  perMoveBytes: number[];
  total: number;
  mean: number;
}

async function runScenario(incrementalRendering: boolean, n: number, nav: number): Promise<RunResult> {
  const stdout = makeCountingStdout();
  const stdin = makeFakeStdin();
  const client = new DistinctClient(n);
  const app = render(<App client={client} />, {
    stdout,
    stdin,
    incrementalRendering,
    patchConsole: false,
    exitOnCtrlC: false,
  });
  await tick(300); // enumerateLedgers resolves + kitty-protocol detection (200ms) settles
  stdin.send(ENTER); // open the only ledger
  // settle until items frame shows T1
  let opened = false;
  for (let i = 0; i < 300; i++) {
    if (stdout.frames.join("").includes("T1")) {
      opened = true;
      break;
    }
    await tick(10);
  }
  // extra settle so all mount-time renders flush
  await tick(200);
  process.stderr.write(
    `[diag incr=${incrementalRendering}] opened=${opened} bytesAtSettle=${stdout.bytes} frames=${stdout.frames.length}\n`,
  );

  const perMoveBytes: number[] = [];
  for (let i = 0; i < nav; i++) {
    const before = stdout.bytes;
    stdin.send("j"); // vim down — pure cursor move
    await tick(60); // let the throttled (30fps) render flush
    perMoveBytes.push(stdout.bytes - before);
  }
  app.unmount();
  await tick(20);

  const total = perMoveBytes.reduce((a, b) => a + b, 0);
  return { perMoveBytes, total, mean: total / Math.max(1, perMoveBytes.length) };
}

async function main(): Promise<void> {
  const N = 60;
  const NAV = 25;
  // Standard (pre-fix baseline) first, then incremental (the T132 fix).
  const baseline = await runScenario(false, N, NAV);
  const fixed = await runScenario(true, N, NAV);

  const fmt = (r: RunResult): string =>
    `mean=${r.mean.toFixed(0)} B/move  total=${r.total} B over ${r.perMoveBytes.length} moves  ` +
    `min=${Math.min(...r.perMoveBytes)} max=${Math.max(...r.perMoveBytes)}`;

  const reduction = ((baseline.mean - fixed.mean) / baseline.mean) * 100;

  process.stderr.write(
    `\n==== D13/T132 distinct-description per-move stdout-write bench (N=${N}, NAV=${NAV}) ====\n` +
      `BEFORE (incrementalRendering=false, standard full-frame redraw):\n  ${fmt(baseline)}\n` +
      `AFTER  (incrementalRendering=true,  line-diff redraw):\n  ${fmt(fixed)}\n` +
      `PER-MOVE REDUCTION: ${reduction.toFixed(1)}%  (${baseline.mean.toFixed(0)} -> ${fixed.mean.toFixed(0)} B/move)\n` +
      `==========================================================================\n`,
  );
  process.exit(0);
}

void main();
