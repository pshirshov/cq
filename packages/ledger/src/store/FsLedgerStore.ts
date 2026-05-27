/**
 * FsLedgerStore — filesystem-backed implementation of `LedgerStore`.
 *
 * Layout under `root` (typically the server's --cwd):
 *   ./docs/ledgers.yaml                              # central registry
 *   ./docs/<ledger>.md                               # active ledger
 *   ./docs/archive/<ledger>/<milestone-id>.md        # archived milestones
 *   ./docs/.locks/<ledger>.lock                      # advisory lockfile
 *
 * On init():
 *   - Read ./docs/ledgers.yaml (create with EMPTY_REGISTRY if missing).
 *   - For each registered ledger, read ./docs/<ledger>.md and parse it
 *     against the schema in the registry. Create an empty file if missing.
 *   - Populate in-memory state.
 *
 * On any mutation:
 *   - Acquire per-ledger AsyncMutex (in-process serialisation).
 *   - Acquire .lockfile (cross-process advisory).
 *   - Mutate in-memory state via core helpers.
 *   - Serialize to <ledger>.md.tmp; fsync; atomic rename to <ledger>.md.
 *   - Release lockfile.
 *   - Release mutex.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import type {
  ArchivePointer,
  Item,
  Ledger,
  LedgerSchema,
  Milestone,
} from "../types.js";
import {
  DuplicateIdError,
  LedgerError,
  LedgerNotFoundError,
} from "../types.js";
import { parseLedger, parseArchive } from "../parser/parse.js";
import { serializeLedger, serializeArchive as serializeArchiveImpl } from "../parser/serialize.js";
import {
  EMPTY_REGISTRY,
  parseRegistry,
  serializeRegistry,
} from "../registry.js";
import type { LedgerRegistry } from "../types.js";
import {
  applyArchiveMilestone,
  applyCreateItem,
  applyCreateMilestone,
  applyUpdateItem,
  applyUpdateMilestone,
  findItem,
  findMilestone,
  searchItems,
} from "./core.js";
import type {
  CreateItemInit,
  CreateMilestoneInit,
  LedgerStore,
  UpdateItemPatch,
  UpdateMilestonePatch,
} from "./LedgerStore.js";
import { AsyncMutex } from "./mutex.js";
import { Lockfile, type LockfileOpts } from "./lockfile.js";

export interface FsLedgerStoreOpts {
  /** Filesystem root (server --cwd). Ledgers live under `<root>/docs/`. */
  root: string;
  /** Override for tests. Defaults to `Date.now`. */
  now?: () => number;
  /** Lockfile injection points for tests (isPidAlive, selfPid, …). */
  lockfile?: LockfileOpts;
}

export class FsLedgerStore implements LedgerStore {
  private readonly root: string;
  private readonly docsDir: string;
  private readonly locksDir: string;
  private readonly archiveDir: string;
  private readonly registryPath: string;
  private readonly mutexes = new Map<string, AsyncMutex>();
  private readonly ledgers = new Map<string, Ledger>();
  private readonly now: () => number;
  private readonly lockfile: Lockfile;
  private registry: LedgerRegistry = { ...EMPTY_REGISTRY, ledgers: [] };
  private initialised = false;

  constructor(opts: FsLedgerStoreOpts) {
    this.root = opts.root;
    this.docsDir = path.join(this.root, "docs");
    this.locksDir = path.join(this.docsDir, ".locks");
    this.archiveDir = path.join(this.docsDir, "archive");
    this.registryPath = path.join(this.docsDir, "ledgers.yaml");
    this.now = opts.now ?? Date.now;
    this.lockfile = new Lockfile(opts.lockfile ?? {});
  }

  async init(): Promise<void> {
    if (this.initialised) return;
    await fs.mkdir(this.docsDir, { recursive: true });
    await fs.mkdir(this.locksDir, { recursive: true });
    await fs.mkdir(this.archiveDir, { recursive: true });

    // Load registry.
    let registryText: string | null = null;
    try {
      registryText = await fs.readFile(this.registryPath, "utf8");
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw e;
    }
    if (registryText === null) {
      await fs.writeFile(this.registryPath, serializeRegistry(EMPTY_REGISTRY), "utf8");
      this.registry = { version: 1, ledgers: [] };
    } else {
      this.registry = parseRegistry(registryText);
    }

    // Load each ledger.
    for (const entry of this.registry.ledgers) {
      const filePath = this.ledgerPath(entry.name);
      let text: string | null = null;
      try {
        text = await fs.readFile(filePath, "utf8");
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") throw e;
      }
      let ledger: Ledger;
      if (text === null) {
        ledger = freshLedger(entry.name, entry.schema);
        await this.writeLedgerFile(ledger);
      } else {
        ledger = parseLedger(text, { schema: entry.schema });
      }
      this.ledgers.set(entry.name, ledger);
    }
    this.initialised = true;
  }

  async dispose(): Promise<void> {
    this.ledgers.clear();
    this.mutexes.clear();
    this.initialised = false;
  }

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  enumerate(): string[] {
    this.assertInit();
    return Array.from(this.ledgers.keys()).sort();
  }

  fetch(ledgerId: string): Ledger {
    return cloneLedger(this.getLedger(ledgerId));
  }

  fetchMilestone(ledgerId: string, milestoneId: string): Milestone {
    return cloneMilestone(findMilestone(this.getLedger(ledgerId), milestoneId));
  }

  fetchItem(ledgerId: string, itemId: string): Item {
    return cloneItem(findItem(this.getLedger(ledgerId), itemId).item);
  }

  search(ledgerId: string, query: string): Item[] {
    return searchItems(this.getLedger(ledgerId), query).map(cloneItem);
  }

  async fetchArchive(ledgerId: string, archiveId: string): Promise<Milestone> {
    const ledger = this.getLedger(ledgerId);
    const ptr = ledger.archivePointers.find((p) => p.id === archiveId);
    if (ptr === undefined) {
      throw new LedgerError(
        `archive ${archiveId} not found in ledger ${ledgerId}`,
      );
    }
    const absPath = path.resolve(this.docsDir, ptr.path);
    const text = await fs.readFile(absPath, "utf8");
    return parseArchive(text);
  }

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async updateMilestone(
    ledgerId: string,
    milestoneId: string,
    patch: UpdateMilestonePatch,
  ): Promise<Milestone> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const m = applyUpdateMilestone(ledger, milestoneId, patch);
      await this.writeLedgerFile(ledger);
      return cloneMilestone(m);
    });
  }

  async updateItem(
    ledgerId: string,
    itemId: string,
    patch: UpdateItemPatch,
  ): Promise<Item> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const it = applyUpdateItem(ledger, itemId, patch, this.now());
      await this.writeLedgerFile(ledger);
      return cloneItem(it);
    });
  }

  async createItem(
    ledgerId: string,
    milestoneId: string,
    init: CreateItemInit,
  ): Promise<Item> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const item = applyCreateItem(ledger, milestoneId, init, this.now());
      await this.writeLedgerFile(ledger);
      return cloneItem(item);
    });
  }

  async createMilestone(
    ledgerId: string,
    init: CreateMilestoneInit,
  ): Promise<Milestone> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const m = applyCreateMilestone(ledger, init);
      await this.writeLedgerFile(ledger);
      return cloneMilestone(m);
    });
  }

  async createLedger(name: string, schema: LedgerSchema): Promise<Ledger> {
    this.assertInit();
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new LedgerError(
        `invalid ledger name "${name}": only A-Za-z0-9_- are allowed`,
      );
    }
    if (this.ledgers.has(name)) {
      throw new DuplicateIdError("ledger", name);
    }
    // Serialise registry mutations under a per-process mutex named "__registry__".
    return this.withRegistryLock(async () => {
      // Re-check after acquiring lock.
      if (this.ledgers.has(name)) {
        throw new DuplicateIdError("ledger", name);
      }
      const ledger = freshLedger(name, schema);
      this.ledgers.set(name, ledger);
      this.registry.ledgers.push({ name, schema });
      await this.writeLedgerFile(ledger);
      await this.writeRegistry();
      return cloneLedger(ledger);
    });
  }

  async archiveMilestone(
    ledgerId: string,
    milestoneId: string,
    summary: string,
  ): Promise<ArchivePointer> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const archiveSubdir = path.join(this.archiveDir, ledgerId);
      const archiveFileName = `${milestoneId}.md`;
      const relPath = `./archive/${ledgerId}/${archiveFileName}`;
      const { milestone, pointer } = applyArchiveMilestone(
        ledger,
        milestoneId,
        summary,
        relPath,
      );
      await fs.mkdir(archiveSubdir, { recursive: true });
      const archivePath = path.join(archiveSubdir, archiveFileName);
      await atomicWrite(archivePath, serializeArchiveImpl(milestone));
      await this.writeLedgerFile(ledger);
      return { ...pointer };
    });
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async withLock<T>(ledgerId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.ledgers.has(ledgerId)) {
      throw new LedgerNotFoundError(ledgerId);
    }
    const mutex = this.mutexFor(ledgerId);
    return mutex.run(async () => {
      const release = await this.lockfile.acquire(this.locksDir, ledgerId);
      try {
        return await fn();
      } finally {
        await release();
      }
    });
  }

  private async withRegistryLock<T>(fn: () => Promise<T>): Promise<T> {
    const mutex = this.mutexFor("__registry__");
    return mutex.run(async () => {
      const release = await this.lockfile.acquire(this.locksDir, "__registry__");
      try {
        return await fn();
      } finally {
        await release();
      }
    });
  }

  private mutexFor(ledgerId: string): AsyncMutex {
    let m = this.mutexes.get(ledgerId);
    if (m === undefined) {
      m = new AsyncMutex();
      this.mutexes.set(ledgerId, m);
    }
    return m;
  }

  private getLedger(ledgerId: string): Ledger {
    this.assertInit();
    const l = this.ledgers.get(ledgerId);
    if (l === undefined) throw new LedgerNotFoundError(ledgerId);
    return l;
  }

  private ledgerPath(name: string): string {
    return path.join(this.docsDir, `${name}.md`);
  }

  private async writeLedgerFile(ledger: Ledger): Promise<void> {
    await atomicWrite(this.ledgerPath(ledger.id), serializeLedger(ledger));
  }

  private async writeRegistry(): Promise<void> {
    await atomicWrite(this.registryPath, serializeRegistry(this.registry));
  }

  private assertInit(): void {
    if (!this.initialised) throw new LedgerError("FsLedgerStore not initialised");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function atomicWrite(filePath: string, text: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const fh = await fs.open(tmp, "w");
  try {
    await fh.writeFile(text, "utf8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  await fs.rename(tmp, filePath);
}

function freshLedger(name: string, schema: LedgerSchema): Ledger {
  return {
    id: name,
    schema,
    counters: { milestone: 0, item: 0 },
    milestones: [],
    archivePointers: [],
  };
}

function cloneLedger(l: Ledger): Ledger {
  return {
    id: l.id,
    schema: cloneSchema(l.schema),
    counters: { ...l.counters },
    milestones: l.milestones.map(cloneMilestone),
    archivePointers: l.archivePointers.map((p) => ({ ...p })),
  };
}

function cloneSchema(s: LedgerSchema): LedgerSchema {
  return {
    statusValues: [...s.statusValues],
    terminalStatuses: [...s.terminalStatuses],
    fields: Object.fromEntries(
      Object.entries(s.fields).map(([k, v]) => [k, { ...v }]),
    ),
  };
}

function cloneMilestone(m: Milestone): Milestone {
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    items: m.items.map(cloneItem),
  };
}

function cloneItem(i: Item): Item {
  return {
    id: i.id,
    milestoneId: i.milestoneId,
    status: i.status,
    fields: cloneFields(i.fields),
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}

function cloneFields(f: Record<string, unknown>): Record<string, never> {
  // Returns a shallow-cloned record. Array values are also cloned.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(f)) {
    out[k] = Array.isArray(v) ? [...v] : v;
  }
  return out as Record<string, never>;
}
