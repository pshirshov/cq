/**
 * Internal pure logic for mutating in-memory Ledger state.
 * No I/O, no locking — those concerns live in FsLedgerStore.
 *
 * Shared between FsLedgerStore (which wraps these with persist + lock) and
 * InMemoryLedgerStore (the dual-tests dummy).
 */

import type {
  ArchivePointer,
  FieldSpec,
  FieldValue,
  Item,
  Ledger,
  Milestone,
} from "../types.js";
import {
  DuplicateIdError,
  InvalidIdError,
  InvalidStatusError,
  ItemNotFoundError,
  MilestoneNotFoundError,
  MissingRequiredFieldError,
  NonTerminalItemsError,
  SchemaValidationError,
} from "../types.js";
import type {
  CreateItemInit,
  CreateMilestoneInit,
  UpdateItemPatch,
  UpdateMilestonePatch,
} from "./LedgerStore.js";

const MILESTONE_ID_RE = /^M(\d+)$/;
const ITEM_ID_RE = /^[A-Za-z]+(\d+)$/;

/**
 * Caller-supplied milestone/item ids must match this regex. The set is
 * deliberately narrow — no `/`, no `.`, no whitespace — so an id cannot
 * escape the filesystem path that `FsLedgerStore` derives from it
 * (`./archive/<ledger>/<id>.md`). D-LED-01.
 */
export const SAFE_ID_RE = /^[A-Za-z0-9_-]+$/;

function assertSafeId(kind: "milestone" | "item", id: string): void {
  if (!SAFE_ID_RE.test(id)) {
    throw new InvalidIdError(kind, id);
  }
}

/**
 * Status values become markdown headings via the em-dash separator
 * `### <id> — <status>`; a status containing `—` would break heading
 * round-trip. Restrict to alphanumerics, space, dash, underscore.
 * D-LED-02.
 */
const STATUS_VALUE_RE = /^[A-Za-z0-9 _-]+$/;

/**
 * Field names are stable identifiers (no spaces, no `:` that would
 * collide with the field-list YAML serialization, no em-dash). Mirrors
 * the JS identifier convention. D-LED-02.
 */
const FIELD_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Reserved field names that collide with intrinsic Item fields. D-LED-02. */
const RESERVED_FIELD_NAMES = new Set(["createdAt", "updatedAt"]);

/**
 * Validate a LedgerSchema against the invariants every layer must honour
 * (Zod tool schema, on-disk registry, adapter constructors). Called
 * defensively at every entry point so a schema that slips past one layer
 * is still caught by the next. D-LED-02.
 *
 * Invariants:
 *  - `statusValues` is non-empty and every entry matches STATUS_VALUE_RE.
 *  - Every `terminalStatuses` entry is also in `statusValues`.
 *  - Every field name matches FIELD_NAME_RE and is not reserved.
 */
export function validateSchema(schema: {
  statusValues: string[];
  terminalStatuses: string[];
  fields: Record<string, { type: string; required: boolean }>;
}): void {
  if (schema.statusValues.length === 0) {
    throw new SchemaValidationError("statusValues must be non-empty");
  }
  for (const sv of schema.statusValues) {
    if (!STATUS_VALUE_RE.test(sv)) {
      throw new SchemaValidationError(
        `status value "${sv}" contains disallowed characters; allowed: A-Za-z0-9, space, dash, underscore`,
      );
    }
  }
  const svSet = new Set(schema.statusValues);
  for (const t of schema.terminalStatuses) {
    if (!svSet.has(t)) {
      throw new SchemaValidationError(
        `terminalStatuses entry "${t}" is not in statusValues`,
      );
    }
  }
  for (const name of Object.keys(schema.fields)) {
    if (RESERVED_FIELD_NAMES.has(name)) {
      throw new SchemaValidationError(
        `field name "${name}" is reserved (collides with intrinsic Item field)`,
      );
    }
    if (!FIELD_NAME_RE.test(name)) {
      throw new SchemaValidationError(
        `field name "${name}" must match /^[A-Za-z_][A-Za-z0-9_]*$/`,
      );
    }
  }
}

export function findMilestone(ledger: Ledger, milestoneId: string): Milestone {
  for (const m of ledger.milestones) if (m.id === milestoneId) return m;
  throw new MilestoneNotFoundError(ledger.id, milestoneId);
}

export function findItem(ledger: Ledger, itemId: string): { milestone: Milestone; item: Item } {
  for (const m of ledger.milestones) {
    for (const it of m.items) {
      if (it.id === itemId) return { milestone: m, item: it };
    }
  }
  throw new ItemNotFoundError(ledger.id, itemId);
}

export function searchItems(ledger: Ledger, query: string): Item[] {
  const q = query.toLowerCase();
  const out: Item[] = [];
  for (const m of ledger.milestones) {
    for (const it of m.items) {
      if (it.status.toLowerCase().includes(q)) {
        out.push(it);
        continue;
      }
      let matched = false;
      for (const v of Object.values(it.fields)) {
        if (matched) break;
        if (typeof v === "string" && v.toLowerCase().includes(q)) matched = true;
        else if (Array.isArray(v) && v.some((s) => s.toLowerCase().includes(q))) matched = true;
        else if (typeof v === "number" && String(v).includes(q)) matched = true;
      }
      if (matched) out.push(it);
    }
  }
  return out;
}

export function applyUpdateMilestone(
  ledger: Ledger,
  milestoneId: string,
  patch: UpdateMilestonePatch,
): Milestone {
  const m = findMilestone(ledger, milestoneId);
  if (patch.title !== undefined) m.title = patch.title;
  if (patch.description !== undefined) m.description = patch.description;
  return m;
}

export function applyUpdateItem(
  ledger: Ledger,
  itemId: string,
  patch: UpdateItemPatch,
  now: number,
): Item {
  const { item } = findItem(ledger, itemId);
  if (patch.status !== undefined) {
    assertStatusAllowed(ledger, patch.status);
    item.status = patch.status;
  }
  if (patch.fields !== undefined) {
    validateFields(ledger, patch.fields, /*creating*/ false);
    for (const [k, v] of Object.entries(patch.fields)) {
      item.fields[k] = v;
    }
  }
  item.updatedAt = now;
  return item;
}

export function applyCreateItem(
  ledger: Ledger,
  milestoneId: string,
  init: CreateItemInit,
  now: number,
): Item {
  const milestone = findMilestone(ledger, milestoneId);
  assertStatusAllowed(ledger, init.status);
  validateFields(ledger, init.fields, /*creating*/ true);
  let id: string;
  if (init.id !== undefined) {
    assertSafeId("item", init.id);
    if (itemIdExists(ledger, init.id)) throw new DuplicateIdError("item", init.id);
    id = init.id;
    const n = numericPart(init.id, ITEM_ID_RE);
    if (n !== null && n >= ledger.counters.item) {
      ledger.counters.item = n + 1;
    }
  } else {
    ledger.counters.item += 1;
    id = itemIdPrefix(ledger) + String(ledger.counters.item);
    // Avoid colliding with a caller-supplied id elsewhere.
    while (itemIdExists(ledger, id)) {
      ledger.counters.item += 1;
      id = itemIdPrefix(ledger) + String(ledger.counters.item);
    }
    // Defense-in-depth: the auto-generated id must also satisfy the safe regex.
    assertSafeId("item", id);
  }
  const item: Item = {
    id,
    milestoneId,
    status: init.status,
    fields: { ...init.fields },
    createdAt: now,
    updatedAt: now,
  };
  milestone.items.push(item);
  return item;
}

export function applyCreateMilestone(
  ledger: Ledger,
  init: CreateMilestoneInit,
): Milestone {
  let id: string;
  if (init.id !== undefined) {
    assertSafeId("milestone", init.id);
    if (milestoneIdExists(ledger, init.id)) throw new DuplicateIdError("milestone", init.id);
    id = init.id;
    const n = numericPart(init.id, MILESTONE_ID_RE);
    if (n !== null && n >= ledger.counters.milestone) {
      ledger.counters.milestone = n + 1;
    }
  } else {
    ledger.counters.milestone += 1;
    id = "M" + String(ledger.counters.milestone);
    while (milestoneIdExists(ledger, id)) {
      ledger.counters.milestone += 1;
      id = "M" + String(ledger.counters.milestone);
    }
    // Defense-in-depth: the auto-generated id must also satisfy the safe regex.
    assertSafeId("milestone", id);
  }
  const milestone: Milestone = {
    id,
    title: init.title,
    description: init.description ?? "",
    items: [],
  };
  ledger.milestones.push(milestone);
  return milestone;
}

/**
 * Detach a milestone from the active ledger after verifying every item is in
 * a terminal status. Returns the detached milestone for the caller to
 * persist into the archive directory; the caller is also responsible for
 * appending the `ArchivePointer` returned alongside.
 */
export function applyArchiveMilestone(
  ledger: Ledger,
  milestoneId: string,
  summary: string,
  archiveRelPath: string,
): { milestone: Milestone; pointer: ArchivePointer } {
  const idx = ledger.milestones.findIndex((m) => m.id === milestoneId);
  if (idx < 0) throw new MilestoneNotFoundError(ledger.id, milestoneId);
  const milestone = ledger.milestones[idx];
  if (milestone === undefined) throw new MilestoneNotFoundError(ledger.id, milestoneId);
  const terminal = new Set(ledger.schema.terminalStatuses);
  const offending = milestone.items.filter((it) => !terminal.has(it.status)).map((it) => it.id);
  if (offending.length > 0) {
    throw new NonTerminalItemsError(milestoneId, offending);
  }
  ledger.milestones.splice(idx, 1);
  const pointer: ArchivePointer = { id: milestoneId, path: archiveRelPath, summary };
  ledger.archivePointers.push(pointer);
  return { milestone, pointer };
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function assertStatusAllowed(ledger: Ledger, status: string): void {
  if (!ledger.schema.statusValues.includes(status)) {
    throw new InvalidStatusError(status, ledger.schema.statusValues);
  }
}

function validateFields(
  ledger: Ledger,
  fields: Record<string, FieldValue>,
  creating: boolean,
): void {
  for (const [name, value] of Object.entries(fields)) {
    const spec = ledger.schema.fields[name];
    if (spec === undefined) {
      throw new SchemaValidationError(`unknown field "${name}" for ledger ${ledger.id}`);
    }
    assertFieldType(name, spec, value);
  }
  if (creating) {
    for (const [name, spec] of Object.entries(ledger.schema.fields)) {
      if (spec.required && fields[name] === undefined) {
        throw new MissingRequiredFieldError(name);
      }
    }
  }
}

function assertFieldType(name: string, spec: FieldSpec, value: FieldValue): void {
  switch (spec.type) {
    case "string":
    case "id":
      if (typeof value !== "string") {
        throw new SchemaValidationError(`field "${name}" must be a string`);
      }
      return;
    case "string[]":
    case "id[]":
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) {
        throw new SchemaValidationError(`field "${name}" must be a string[]`);
      }
      return;
    case "timestamp":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new SchemaValidationError(`field "${name}" must be a number (epoch ms)`);
      }
      return;
  }
}

function itemIdPrefix(ledger: Ledger): string {
  // Derive prefix from the ledger name's first uppercase letter, defaulting
  // to the first character. e.g. "defects" → "D", "tasks" → "T".
  const first = ledger.id[0];
  if (first === undefined) return "X";
  return first.toUpperCase();
}

function itemIdExists(ledger: Ledger, id: string): boolean {
  for (const m of ledger.milestones) for (const it of m.items) if (it.id === id) return true;
  // Don't check archived items — once a milestone is archived its ids are
  // out of the active namespace. The counter alone prevents reuse in
  // newly-issued ids.
  return false;
}

function milestoneIdExists(ledger: Ledger, id: string): boolean {
  for (const m of ledger.milestones) if (m.id === id) return true;
  for (const p of ledger.archivePointers) if (p.id === id) return true;
  return false;
}

function numericPart(id: string, re: RegExp): number | null {
  const m = re.exec(id);
  if (m === null || m[1] === undefined) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}
