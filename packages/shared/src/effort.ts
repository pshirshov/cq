/**
 * effort.ts — reasoning-effort enum shared between Claude and Codex platforms.
 *
 * The enum is a single string set; each platform maps it to its native
 * concept at the bridge boundary:
 *
 * - Claude: maps to `thinking.budget_tokens` on the SDK Options (a numeric
 *   token budget; `none` disables thinking entirely).
 * - Codex:  maps to `modelReasoningEffort` on ThreadOptions (a 5-value enum
 *   `"minimal" | "low" | "medium" | "high" | "xhigh"`).
 *
 * Persisted on `session.effort` and round-tripped via `ChatStart.effort`.
 */
import { z } from "zod";

/** The single canonical effort enum used UI-side and on the wire. */
export const EFFORT_VALUES = ["none", "low", "medium", "high", "max"] as const;

export type Effort = (typeof EFFORT_VALUES)[number];

export const EffortSchema = z.enum(EFFORT_VALUES);

/** Default when no value has been set anywhere (DB DEFAULT, localStorage miss). */
export const DEFAULT_EFFORT: Effort = "none";

/**
 * Claude mapping: returns the `thinking.budget_tokens` value, or `null`
 * when thinking should be disabled entirely (`none`).
 *
 * `max` saturates at 31_999 — one below the SDK's hard cap of 32k tokens
 * so the bridge does not trip the API's cap-validation off-by-one.
 */
export function effortToClaudeBudgetTokens(effort: Effort): number | null {
  switch (effort) {
    case "none":   return null;
    case "low":    return 4_000;
    case "medium": return 10_000;
    case "high":   return 16_000;
    case "max":    return 31_999;
  }
}

/**
 * Codex mapping: returns the `modelReasoningEffort` string value the Codex
 * SDK accepts. The codex-sdk's union is
 *   "minimal" | "low" | "medium" | "high" | "xhigh"
 * so we have a real 5-tier mapping (no saturation).
 */
export type CodexEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export function effortToCodexEffort(effort: Effort): CodexEffort {
  switch (effort) {
    case "none":   return "minimal";
    case "low":    return "low";
    case "medium": return "medium";
    case "high":   return "high";
    case "max":    return "xhigh";
  }
}
