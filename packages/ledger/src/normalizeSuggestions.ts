/**
 * Normalization helpers for the `suggestions` field in the questions ledger.
 *
 * Legacy items may store suggestions as a single element with semicolon- or
 * newline-separated values, e.g. `["a; b; c"]` instead of `["a", "b", "c"]`.
 * These functions split such elements so that each array entry is a single
 * trimmed option, and detect whether a given value needs rewriting.
 *
 * Exported here so both the `scripts/normalize-suggestions.ts` one-shot script
 * and the test suite can import the same logic directly.
 */

import type { FieldValue } from "./types.js";

/**
 * Normalize a raw `suggestions` field value from the ledger store.
 *
 * Rules (applied to the STORED ARRAY — no parseFieldValue):
 *  1. Coerce to array: already-array stays; bare string becomes single-element array.
 *  2. For EACH element: split on semicolons AND newlines, trim each fragment,
 *     drop empty strings, flatten.
 *  3. Return the flattened result.
 *
 * Idempotent: if every element is already split (no embedded ;/\n), the
 * output equals the input structurally.
 */
export function normalizeSuggestions(raw: FieldValue | undefined): string[] {
  if (raw === undefined) return [];
  const arr: string[] = typeof raw === "string" ? [raw] : raw;
  const result: string[] = [];
  for (const element of arr) {
    const fragments = element.split(/[;\n]/);
    for (const fragment of fragments) {
      const trimmed = fragment.trim();
      if (trimmed.length > 0) {
        result.push(trimmed);
      }
    }
  }
  return result;
}

/**
 * Return true if normalization would change the value (i.e. the item
 * needs a write). Avoids spurious `updateItem` calls on already-clean items.
 */
export function needsNormalization(raw: FieldValue | undefined): boolean {
  if (raw === undefined) return false;
  const arr: string[] = typeof raw === "string" ? [raw] : raw;
  const normalized = normalizeSuggestions(raw);
  if (arr.length !== normalized.length) return true;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== normalized[i]) return true;
  }
  return false;
}
