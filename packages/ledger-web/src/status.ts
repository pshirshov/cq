/**
 * Status → semantic bucket, derived from the ledger schema. Mirror of the
 * TUI's status helper (packages/ledger-tui/src/status.ts) — kept as a small
 * duplicate rather than a shared module because the two frontends ship
 * independently and render colors differently (CSS class here, ink color name
 * there). The bucket maps to a `lw-status-<bucket>` CSS class.
 */

import type { LedgerSchema } from "./types.js";

export type StatusBucket = "start" | "progress" | "blocked" | "done" | "dropped";

const PROGRESS = new Set(["wip", "building", "planning", "in-progress", "in_progress", "doing"]);
const BLOCKED = new Set(["blocked"]);
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

/** Encode a filter as a stable string for a <select> value, and back. */
export function filterToValue(f: StatusFilter): string {
  return f.kind === "status" ? `status:${f.value}` : f.kind;
}

export function valueToFilter(v: string): StatusFilter {
  if (v === "all" || v === "active" || v === "terminal") return { kind: v };
  if (v.startsWith("status:")) return { kind: "status", value: v.slice("status:".length) };
  return { kind: "all" };
}
