/**
 * InMemoryLedgerStore — hand-written dummy adapter used by the dual-tests
 * pattern. Persistence is a Map; archived milestones live in a sibling Map
 * keyed by `<ledger>/<milestone-id>`. No locks, no I/O.
 *
 * Concurrency: uses the same per-ledger AsyncMutex discipline as the real
 * adapter so tests that exercise concurrency behave the same way.
 */

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
import {
  applyArchiveMilestone,
  applyCreateItem,
  applyCreateMilestone,
  applyUpdateItem,
  applyUpdateMilestone,
  findItem,
  findMilestone,
  searchItems,
  validateSchema,
} from "./core.js";
import type {
  CreateItemInit,
  CreateMilestoneInit,
  LedgerStore,
  UpdateItemPatch,
  UpdateMilestonePatch,
} from "./LedgerStore.js";
import { AsyncMutex } from "./mutex.js";

export interface InMemoryLedgerStoreOpts {
  now?: () => number;
  /** Pre-populate registered ledgers (empty by default). */
  seed?: Array<{ name: string; schema: LedgerSchema }>;
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly ledgers = new Map<string, Ledger>();
  private readonly archives = new Map<string, Milestone>(); // key: `<ledger>/<id>`
  private readonly mutexes = new Map<string, AsyncMutex>();
  private readonly now: () => number;
  private initialised = false;

  constructor(opts: InMemoryLedgerStoreOpts = {}) {
    this.now = opts.now ?? Date.now;
    if (opts.seed !== undefined) {
      for (const { name, schema } of opts.seed) {
        this.ledgers.set(name, freshLedger(name, schema));
      }
    }
  }

  async init(): Promise<void> {
    this.initialised = true;
  }

  async dispose(): Promise<void> {
    this.ledgers.clear();
    this.archives.clear();
    this.mutexes.clear();
    this.initialised = false;
  }

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
    const key = `${ledgerId}/${archiveId}`;
    const m = this.archives.get(key);
    if (m === undefined) {
      throw new LedgerError(`archive ${archiveId} not found in ledger ${ledgerId}`);
    }
    return cloneMilestone(m);
  }

  async updateMilestone(
    ledgerId: string,
    milestoneId: string,
    patch: UpdateMilestonePatch,
  ): Promise<Milestone> {
    return this.withLock(ledgerId, async () => {
      return cloneMilestone(applyUpdateMilestone(this.getLedger(ledgerId), milestoneId, patch));
    });
  }

  async updateItem(ledgerId: string, itemId: string, patch: UpdateItemPatch): Promise<Item> {
    return this.withLock(ledgerId, async () => {
      return cloneItem(applyUpdateItem(this.getLedger(ledgerId), itemId, patch, this.now()));
    });
  }

  async createItem(
    ledgerId: string,
    milestoneId: string,
    init: CreateItemInit,
  ): Promise<Item> {
    return this.withLock(ledgerId, async () => {
      return cloneItem(applyCreateItem(this.getLedger(ledgerId), milestoneId, init, this.now()));
    });
  }

  async createMilestone(
    ledgerId: string,
    init: CreateMilestoneInit,
  ): Promise<Milestone> {
    return this.withLock(ledgerId, async () => {
      return cloneMilestone(applyCreateMilestone(this.getLedger(ledgerId), init));
    });
  }

  async createLedger(name: string, schema: LedgerSchema): Promise<Ledger> {
    this.assertInit();
    // D-LED-02: defensively validate the schema before storing it.
    validateSchema(schema);
    if (this.ledgers.has(name)) throw new DuplicateIdError("ledger", name);
    const ledger = freshLedger(name, schema);
    this.ledgers.set(name, ledger);
    return cloneLedger(ledger);
  }

  async archiveMilestone(
    ledgerId: string,
    milestoneId: string,
    summary: string,
  ): Promise<ArchivePointer> {
    return this.withLock(ledgerId, async () => {
      const ledger = this.getLedger(ledgerId);
      const relPath = `./archive/${ledgerId}/${milestoneId}.md`;
      const { milestone, pointer } = applyArchiveMilestone(
        ledger,
        milestoneId,
        summary,
        relPath,
      );
      this.archives.set(`${ledgerId}/${milestoneId}`, milestone);
      return { ...pointer };
    });
  }

  // --- internals ---
  private async withLock<T>(ledgerId: string, fn: () => Promise<T>): Promise<T> {
    if (!this.ledgers.has(ledgerId)) throw new LedgerNotFoundError(ledgerId);
    const mutex = this.mutexFor(ledgerId);
    return mutex.run(fn);
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
  private assertInit(): void {
    if (!this.initialised) throw new LedgerError("InMemoryLedgerStore not initialised");
  }
}

// --- duplicated tiny helpers (avoid importing private symbols across stores) ---

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
    schema: {
      statusValues: [...l.schema.statusValues],
      terminalStatuses: [...l.schema.terminalStatuses],
      fields: Object.fromEntries(Object.entries(l.schema.fields).map(([k, v]) => [k, { ...v }])),
    },
    counters: { ...l.counters },
    milestones: l.milestones.map(cloneMilestone),
    archivePointers: l.archivePointers.map((p) => ({ ...p })),
  };
}

function cloneMilestone(m: Milestone): Milestone {
  return { id: m.id, title: m.title, description: m.description, items: m.items.map(cloneItem) };
}

function cloneItem(i: Item): Item {
  return {
    id: i.id,
    milestoneId: i.milestoneId,
    status: i.status,
    fields: Object.fromEntries(
      Object.entries(i.fields).map(([k, v]) => [k, Array.isArray(v) ? [...v] : v]),
    ) as Item["fields"],
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  };
}
