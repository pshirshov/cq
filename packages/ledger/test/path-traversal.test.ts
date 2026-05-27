/**
 * D-LED-01 — path-traversal hardening.
 *
 * Three layers of defence:
 *   1. `applyCreateMilestone`/`applyCreateItem` reject ids that don't match
 *      `/^[A-Za-z0-9_-]+$/` (InvalidIdError).
 *   2. `FsLedgerStore.archiveMilestone` refuses to write outside `docsDir`
 *      even when the in-memory state has been forged with a bad id.
 *   3. `FsLedgerStore.fetchArchive` refuses to read outside `docsDir` even
 *      when the in-memory `archivePointers` entry has been forged with a
 *      relative path that resolves outside.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  FsLedgerStore,
  InMemoryLedgerStore,
  InvalidIdError,
  LedgerError,
  serializeRegistry,
  type Ledger,
  type LedgerSchema,
} from "../src/index.js";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

const schema: LedgerSchema = {
  statusValues: ["open", "done"],
  terminalStatuses: ["done"],
  fields: { note: { type: "string", required: false } },
};

async function setupFs(): Promise<{ store: FsLedgerStore; root: string }> {
  const root = await mkdtemp(path.join(tmpdir(), "ledger-trav-"));
  dirs.push(root);
  const docsDir = path.join(root, "docs");
  await mkdir(docsDir, { recursive: true });
  await writeFile(
    path.join(docsDir, "ledgers.yaml"),
    serializeRegistry({ version: 1, ledgers: [{ name: "todos", schema }] }),
    "utf8",
  );
  const store = new FsLedgerStore({ root });
  await store.init();
  return { store, root };
}

describe("D-LED-01 — id validation in core helpers", () => {
  const badIds = ["../etc/passwd", "a/b", "a b", "", "..", ".", "a.b", "a/../b"];

  it.each(badIds)("applyCreateMilestone rejects id %p", async (badId) => {
    const store = new InMemoryLedgerStore({ seed: [{ name: "todos", schema }] });
    await store.init();
    await expect(
      store.createMilestone("todos", { id: badId, title: "x" }),
    ).rejects.toThrow(InvalidIdError);
  });

  it.each(badIds)("applyCreateItem rejects id %p", async (badId) => {
    const store = new InMemoryLedgerStore({ seed: [{ name: "todos", schema }] });
    await store.init();
    await store.createMilestone("todos", { title: "m" });
    await expect(
      store.createItem("todos", "M1", { id: badId, status: "open", fields: {} }),
    ).rejects.toThrow(InvalidIdError);
  });

  it("safe ids are accepted (positive control)", async () => {
    const store = new InMemoryLedgerStore({ seed: [{ name: "todos", schema }] });
    await store.init();
    const m = await store.createMilestone("todos", { id: "M-safe_1", title: "x" });
    expect(m.id).toBe("M-safe_1");
    const it = await store.createItem("todos", "M-safe_1", {
      id: "T-ok",
      status: "open",
      fields: {},
    });
    expect(it.id).toBe("T-ok");
  });
});

describe("D-LED-01 — FsLedgerStore defense-in-depth", () => {
  it("archiveMilestone refuses to write outside docsDir for a forged in-memory milestone id", async () => {
    const { store, root } = await setupFs();
    // Reach into the private ledgers map and forge a milestone whose id
    // bypasses the create-time check (simulating a future regression that
    // smuggled a bad id past the validators).
    const internalLedgers = (store as unknown as { ledgers: Map<string, Ledger> })
      .ledgers;
    const ledger = internalLedgers.get("todos");
    if (ledger === undefined) throw new Error("test bug: todos not seeded");
    // Use enough `..` segments to escape `<docs>/archive/<ledger>/` AND
    // `docsDir` itself — i.e. ≥3 levels above `archive/todos/`.
    const forgedId = "../../../../tmp/pwned";
    ledger.milestones.push({
      id: forgedId,
      title: "forged",
      description: "",
      items: [],
    });

    await expect(
      store.archiveMilestone("todos", forgedId, "summary"),
    ).rejects.toThrow(LedgerError);

    // Confirm nothing was written at the escaped target.
    const escaped = path.resolve(
      path.join(root, "docs", "archive", "todos"),
      `${forgedId}.md`,
    );
    expect(escaped.startsWith(path.join(root, "docs") + path.sep)).toBe(false);
    await expect(stat(escaped)).rejects.toBeDefined();
  });

  it("fetchArchive refuses to read outside docsDir for a forged archive pointer", async () => {
    const { store, root } = await setupFs();
    // Pre-create a real file *outside* docsDir we could leak if the check fails.
    const outsidePath = path.join(root, "secret.md");
    await writeFile(outsidePath, "---\nschemaVersion: 1\n---\n# leaked\n", "utf8");

    const internalLedgers = (store as unknown as { ledgers: Map<string, Ledger> })
      .ledgers;
    const ledger = internalLedgers.get("todos");
    if (ledger === undefined) throw new Error("test bug: todos not seeded");
    ledger.archivePointers.push({
      id: "leak",
      // path is relative to docsDir; this escapes to <root>/secret.md.
      path: "../secret.md",
      summary: "forged",
    });

    await expect(store.fetchArchive("todos", "leak")).rejects.toThrow(LedgerError);
  });
});
