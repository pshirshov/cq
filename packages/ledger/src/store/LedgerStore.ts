/**
 * LedgerStore — abstract interface implemented by the production
 * FsLedgerStore and the test-only InMemoryLedgerStore.
 *
 * Lifecycle:
 *  1. Construct.
 *  2. `init()` — load all known ledgers (from ./docs/ledgers.yaml + their .md
 *     files) into memory. After init the store serves reads from memory.
 *  3. Read methods are synchronous (in-memory).
 *  4. Mutating methods are async (acquire mutex + lockfile + persist + release).
 *  5. `dispose()` — release any in-process resources.
 */

import type {
  ArchivePointer,
  FieldValue,
  Item,
  Ledger,
  LedgerSchema,
  Milestone,
} from "../types.js";

export interface UpdateMilestonePatch {
  title?: string;
  description?: string;
}

export interface UpdateItemPatch {
  status?: string;
  fields?: Record<string, FieldValue>;
}

export interface CreateItemInit {
  id?: string;
  status: string;
  fields: Record<string, FieldValue>;
}

export interface CreateMilestoneInit {
  id?: string;
  title: string;
  description?: string;
}

export interface LedgerStore {
  init(): Promise<void>;

  // --- reads (sync, in-memory) -------------------------------------------
  enumerate(): string[];
  fetch(ledgerId: string): Ledger;
  fetchArchive(ledgerId: string, archiveId: string): Promise<Milestone>;
  fetchMilestone(ledgerId: string, milestoneId: string): Milestone;
  fetchItem(ledgerId: string, itemId: string): Item;
  search(ledgerId: string, query: string): Item[];

  // --- mutations (async, write-through under lock) ------------------------
  updateMilestone(
    ledgerId: string,
    milestoneId: string,
    patch: UpdateMilestonePatch,
  ): Promise<Milestone>;
  updateItem(
    ledgerId: string,
    itemId: string,
    patch: UpdateItemPatch,
  ): Promise<Item>;
  createItem(
    ledgerId: string,
    milestoneId: string,
    init: CreateItemInit,
  ): Promise<Item>;
  createMilestone(
    ledgerId: string,
    init: CreateMilestoneInit,
  ): Promise<Milestone>;
  createLedger(name: string, schema: LedgerSchema): Promise<Ledger>;
  archiveMilestone(
    ledgerId: string,
    milestoneId: string,
    summary: string,
  ): Promise<ArchivePointer>;

  dispose(): Promise<void>;
}
