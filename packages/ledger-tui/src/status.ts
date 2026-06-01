/**
 * Status → semantic bucket → ink color, derived from the ledger schema.
 *
 * Statuses are per-ledger free-form strings, but the canonical ledgers use a
 * stable vocabulary and every schema declares which statuses are terminal. We
 * bucket each status into a small set of semantic categories and map those to
 * ink colors so the same status reads consistently across ledgers. A custom
 * ledger's unknown non-terminal status falls back to the neutral "start"
 * bucket; its terminal statuses still gray/green correctly via the schema.
 */

import type { LedgerSchema } from "./types.js";

export type StatusBucket = "start" | "progress" | "blocked" | "done" | "dropped";

// Non-terminal "in progress" vocabulary across the canonical ledgers + common
// synonyms. Terminal statuses are classified via the schema, not this set.
const PROGRESS = new Set(["wip", "building", "planning", "in-progress", "in_progress", "doing"]);
const BLOCKED = new Set(["blocked"]);
// Terminal statuses that mean "did not complete" (rendered muted, not green).
const DROPPED = new Set([
  "abandoned",
  "withdrawn",
  "wrong",
  "superseded",
  "postponed",
  "cancelled",
  "canceled",
  "rejected",
]);

export function isTerminal(status: string, schema: LedgerSchema): boolean {
  return schema.terminalStatuses.includes(status);
}

export function statusBucket(status: string, schema: LedgerSchema): StatusBucket {
  const s = status.toLowerCase();
  if (isTerminal(status, schema)) return DROPPED.has(s) ? "dropped" : "done";
  if (BLOCKED.has(s)) return "blocked";
  if (PROGRESS.has(s)) return "progress";
  return "start";
}

const BUCKET_COLOR: Record<StatusBucket, string> = {
  start: "cyan",
  progress: "yellow",
  blocked: "red",
  done: "green",
  dropped: "gray",
};

/** Ink color name for a status badge. */
export function statusColor(status: string, schema: LedgerSchema): string {
  return BUCKET_COLOR[statusBucket(status, schema)];
}

/**
 * A view filter over item status. `active` = non-terminal, `terminal` =
 * terminal (done/closed), `status` = one exact status value.
 */
export type StatusFilter =
  | { kind: "all" }
  | { kind: "active" }
  | { kind: "terminal" }
  | { kind: "status"; value: string };

export function statusMatchesFilter(
  status: string,
  schema: LedgerSchema,
  filter: StatusFilter,
): boolean {
  switch (filter.kind) {
    case "all":
      return true;
    case "active":
      return !isTerminal(status, schema);
    case "terminal":
      return isTerminal(status, schema);
    case "status":
      return status === filter.value;
  }
}

/** Short human label for a filter, for the header chip. Empty for "all". */
export function filterLabel(filter: StatusFilter): string {
  switch (filter.kind) {
    case "all":
      return "";
    case "active":
      return "active";
    case "terminal":
      return "terminal";
    case "status":
      return filter.value;
  }
}
