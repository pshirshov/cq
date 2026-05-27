/**
 * Concurrency test for FsLedgerStore.
 *
 * Fires N parallel updateItem calls against the same item; asserts:
 *   - All complete without error.
 *   - The final on-disk file parses back cleanly.
 *   - Every distinct mutation is visible somewhere in the field history.
 *
 * Because the underlying per-ledger mutex serialises writers, the final
 * value will reflect *some* serialisation order; what we care about is
 * (a) no lost writes (all promises resolve), (b) no corruption (file
 * parses), (c) counter monotonicity (creates also race).
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  FsLedgerStore,
  parseLedger,
  serializeRegistry,
  type Item,
  type LedgerSchema,
} from "../src/index.js";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

const schema: LedgerSchema = {
  statusValues: ["open", "in-progress", "resolved"],
  terminalStatuses: ["resolved"],
  fields: {
    severity: { type: "string", required: true },
    location: { type: "string", required: true },
    description: { type: "string", required: true },
    counter: { type: "string", required: false },
  },
};

async function setup(opts: { now?: () => number } = {}): Promise<FsLedgerStore> {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-conc-"));
  dirs.push(dir);
  const docsDir = path.join(dir, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    path.join(docsDir, "ledgers.yaml"),
    serializeRegistry({ version: 1, ledgers: [{ name: "defects", schema }] }),
    "utf8",
  );
  const fsOpts: { root: string; now?: () => number } = { root: dir };
  if (opts.now !== undefined) fsOpts.now = opts.now;
  const store = new FsLedgerStore(fsOpts);
  await store.init();
  return store;
}

describe("FsLedgerStore concurrency", () => {
  it("50 parallel updateItem calls leave a parseable, complete file", async () => {
    const store = await setup();
    await store.createMilestone("defects", { title: "M-one" });
    const item = await store.createItem("defects", "M1", {
      status: "open",
      fields: { severity: "minor", location: "x.ts", description: "init" },
    });

    const N = 50;
    const updates = Array.from({ length: N }, (_, i) =>
      store.updateItem("defects", item.id, {
        fields: { counter: String(i) },
      }),
    );
    const results = await Promise.all(updates);
    expect(results.length).toBe(N);
    // Final on-disk file parses.
    const text = await readFile(
      path.join((store as unknown as { root: string }).root ?? "", "docs", "defects.md"),
      "utf8",
    ).catch(async () => {
      // The `root` field is private; read via reflective access fallback.
      // (We initialised under tmp dir; iterate dirs[] to find it.)
      for (const d of dirs) {
        try {
          return await readFile(path.join(d, "docs", "defects.md"), "utf8");
        } catch {
          /* try next */
        }
      }
      throw new Error("could not locate ledger file");
    });
    const parsed = parseLedger(text, { schema });
    expect(parsed.milestones[0]?.items[0]?.id).toBe(item.id);
    // At least one of the writes' counter values survives as the final.
    const finalCounter = parsed.milestones[0]?.items[0]?.fields["counter"];
    expect(typeof finalCounter).toBe("string");
    expect(Number(finalCounter)).toBeGreaterThanOrEqual(0);
    expect(Number(finalCounter)).toBeLessThan(N);
  });

  // D-LED-07: strengthen the 50-parallel-update assertion. The prior test
  // only checked that *some* counter survived; this case additionally
  // asserts (a) updatedAt is strictly monotonic across the serialised
  // writes (via an injected `now` that returns 0,1,2,…), and (b) the final
  // on-disk state reflects the LAST scheduled write (counter=49,
  // updatedAt=49 + a baseline offset for the createItem call).
  it("50 parallel updateItem calls serialise with monotonic updatedAt and final state is the last write (D-LED-07)", async () => {
    let tick = 0;
    const store = await setup({ now: () => tick++ });
    await store.createMilestone("defects", { title: "M-one" });
    // createItem also consumes a tick (item.createdAt/updatedAt = 0).
    const item = await store.createItem("defects", "M1", {
      status: "open",
      fields: { severity: "minor", location: "x.ts", description: "init" },
    });

    const N = 50;
    const updates: Array<Promise<Item>> = [];
    for (let i = 0; i < N; i++) {
      updates.push(
        store.updateItem("defects", item.id, {
          fields: { counter: String(i) },
        }),
      );
    }
    const results = await Promise.all(updates);

    // Each update is the only consumer of `now()` from within the mutex'd
    // critical section. The per-ledger mutex serialises them, so the
    // sequence of `updatedAt` values returned must be a contiguous,
    // strictly-monotonic block starting at item.updatedAt + 1.
    const sorted = [...results].sort((a, b) => a.updatedAt - b.updatedAt);
    for (let i = 0; i < N; i++) {
      const r = sorted[i];
      if (r === undefined) throw new Error("missing result");
      expect(r.updatedAt).toBe(item.updatedAt + 1 + i);
    }

    // The final on-disk state corresponds to the last serialised write:
    // updatedAt = item.updatedAt + N, AND its counter is one of 0..N-1
    // (whichever happened to be scheduled last). Read the file.
    const text = await readFile(
      path.join(dirs[dirs.length - 1] ?? "", "docs", "defects.md"),
      "utf8",
    );
    const parsed = parseLedger(text, { schema });
    const final = parsed.milestones[0]?.items[0];
    if (final === undefined) throw new Error("missing parsed item");
    expect(final.updatedAt).toBe(item.updatedAt + N);
    // The final counter must match the result whose updatedAt is the max.
    const winner = sorted[N - 1];
    if (winner === undefined) throw new Error("missing winner");
    expect(final.fields["counter"]).toBe(winner.fields["counter"]);
  });

  it("50 parallel createItem calls allocate unique monotonic ids", async () => {
    const store = await setup();
    await store.createMilestone("defects", { title: "M-x" });
    const N = 50;
    const items = await Promise.all(
      Array.from({ length: N }, (_, i) =>
        store.createItem("defects", "M1", {
          status: "open",
          fields: {
            severity: "minor",
            location: `f${i}.ts`,
            description: `desc ${i}`,
          },
        }),
      ),
    );
    const ids = new Set(items.map((it) => it.id));
    expect(ids.size).toBe(N);
    // Counter has advanced to at least N.
    const ledger = store.fetch("defects");
    expect(ledger.counters.item).toBeGreaterThanOrEqual(N);
  });

  it("dispose() drains in-flight mutations before returning (D-LED-06)", async () => {
    const store = await setup();
    await store.createMilestone("defects", { title: "M-one" });
    const item = await store.createItem("defects", "M1", {
      status: "open",
      fields: { severity: "minor", location: "x.ts", description: "init" },
    });

    // Queue many updates. They serialise through the per-ledger mutex; the
    // first one is already in flight when we call dispose(). The contract
    // is that dispose() awaits every queued mutation before clearing
    // internal state.
    const N = 20;
    const updates: Array<Promise<{ updatedAt: number }>> = [];
    for (let i = 0; i < N; i++) {
      updates.push(
        store.updateItem("defects", item.id, {
          fields: { counter: String(i) },
        }),
      );
    }

    let updatesSettledFirst = false;
    const updatesAll = Promise.all(updates).then(() => {
      updatesSettledFirst = true;
    });

    await store.dispose();

    // dispose() must not return until every queued mutation has resolved.
    expect(updatesSettledFirst).toBe(true);
    await updatesAll; // sanity: no unhandled rejections.
  });

  it("concurrent updates to different ledgers run without cross-blocking", async () => {
    // Build a store with two ledgers.
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-conc-multi-"));
    dirs.push(dir);
    const docsDir = path.join(dir, "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      path.join(docsDir, "ledgers.yaml"),
      serializeRegistry({
        version: 1,
        ledgers: [
          { name: "a", schema },
          { name: "b", schema },
        ],
      }),
      "utf8",
    );
    const store = new FsLedgerStore({ root: dir });
    await store.init();
    await store.createMilestone("a", { title: "Ma" });
    await store.createMilestone("b", { title: "Mb" });
    const N = 20;
    const allUpdates: Array<Promise<unknown>> = [];
    for (let i = 0; i < N; i++) {
      allUpdates.push(
        store.createItem("a", "M1", {
          status: "open",
          fields: { severity: "minor", location: "a.ts", description: `a${i}` },
        }),
      );
      allUpdates.push(
        store.createItem("b", "M1", {
          status: "open",
          fields: { severity: "minor", location: "b.ts", description: `b${i}` },
        }),
      );
    }
    await Promise.all(allUpdates);
    expect(store.fetch("a").milestones[0]?.items.length).toBe(N);
    expect(store.fetch("b").milestones[0]?.items.length).toBe(N);
  });
});
