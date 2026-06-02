/**
 * Pure column-model helpers (T60, item #1 — foundation for both UIs).
 *
 * These functions decide which schema fields a frontend may offer as
 * *table columns* and which extra columns each ledger shows by default.
 * They are field-LEVEL rules (which field names can ever be a column),
 * distinct from the per-value `isShortField` heuristic that formats a
 * single rendered cell.
 *
 * They are side-effect-free and depend only on a `LedgerSchema`'s field
 * names and a ledger name, so both the web (T61) and TUI (T62) clients —
 * and their tests — import ONE definition from `@cq/ledger`. No Node
 * builtins are touched, so a plain package-index export is sufficient
 * (cf. the T46 `./relationships` helper, which only needed a leaf subpath
 * because of browser-bundle concerns that do not apply here).
 *
 * Per Q29/Q30:
 *  - `eligibleColumnFields(schema)` — every schema field name EXCEPT a small
 *    denylist of known long/narrative fields, and EXCEPT the intrinsic
 *    `id`/`status`/`summary` columns which are ALWAYS shown (so they are
 *    never offered as toggleable extra columns).
 *  - `defaultColumns(ledgerName)` — the per-ledger set of extra columns shown
 *    by default: `tasks` defaults to `suggestedModel`; every other ledger
 *    defaults to none-extra.
 */

import type { LedgerSchema } from "./types.js";
import { TASKS_LEDGER } from "./constants.js";

/**
 * Schema field names that are long/narrative free-text and therefore never
 * eligible to be shown as a (necessarily narrow) table column. Drawn from the
 * canonical ledger schemas in `constants.ts`.
 */
export const LONG_FIELD_DENYLIST: ReadonlySet<string> = new Set([
  "description",
  "rationale",
  "criticism",
  "context",
  "alternatives",
  "evidence",
  "completion",
  "answer",
  "rootCause",
  "suggestedFix",
  "fix",
]);

/**
 * Intrinsic columns that every table ALWAYS shows. They are excluded from the
 * eligible-fields set because they are not toggleable extra columns. `id` and
 * `status` are intrinsic Item properties; `summary` is the conventional
 * headline-ish field name (e.g. the reviews ledger's `summary`).
 */
export const ALWAYS_SHOWN_COLUMNS: ReadonlySet<string> = new Set([
  "id",
  "status",
  "summary",
]);

/**
 * Returns the schema field names that may be offered as toggleable table
 * columns: every declared field name, minus the long/narrative denylist and
 * minus the always-shown intrinsic columns. Order follows the schema's field
 * declaration order.
 */
export function eligibleColumnFields(schema: LedgerSchema): string[] {
  return Object.keys(schema.fields).filter(
    (name) =>
      !LONG_FIELD_DENYLIST.has(name) && !ALWAYS_SHOWN_COLUMNS.has(name),
  );
}

/**
 * Per-ledger default extra columns (beyond the always-shown intrinsic ones).
 * `tasks` defaults to showing `suggestedModel`; every other ledger defaults
 * to no extra columns.
 */
export function defaultColumns(ledgerName: string): string[] {
  if (ledgerName === TASKS_LEDGER) return ["suggestedModel"];
  return [];
}
