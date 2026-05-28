/**
 * Runs the abstract LedgerStore suite against FsLedgerStore (real fs in tmp dir).
 *
 * Each test gets a fresh tmp dir; the registry is pre-seeded by writing the
 * yaml file before init().
 */

import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  FsLedgerStore,
  serializeRegistry,
  type LedgerSchema,
  type LedgerStore,
} from "../src/index.js";
import { runStoreAbstractSuite } from "./store-abstract.js";

const dirs: string[] = [];

runStoreAbstractSuite({
  name: "FsLedgerStore",
  async build(seed: Array<{ name: string; schema: LedgerSchema }>): Promise<LedgerStore> {
    const dir = await mkdtemp(path.join(tmpdir(), "ledger-fs-"));
    dirs.push(dir);
    const docsDir = path.join(dir, "docs");
    await mkdir(docsDir, { recursive: true });
    await writeFile(
      path.join(docsDir, "ledgers.yaml"),
      serializeRegistry({ version: 1, ledgers: seed }),
      "utf8",
    );
    const store = new FsLedgerStore({ root: dir });
    await store.init();
    return store;
  },
  async teardown(store: LedgerStore): Promise<void> {
    await store.dispose();
  },
});

// Cleanup tmp dirs after the file finishes.
import { afterAll } from "bun:test";
afterAll(async () => {
  for (const d of dirs) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});
