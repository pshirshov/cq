/**
 * cq.toml data model (T170, T223, T237, T284).
 *
 * Pure, typed domain types — no transport/MCP concerns. A `ReviewerToken`
 * names a reviewer harness + model; a `CqConfig` is the fully-parsed (but
 * not yet alias-resolved) configuration: the `[aliases]` table plus the
 * top-level `reviewers` list of alias names.
 *
 * Token grammar (BREAKING in T237):
 *  - pi tokens: `pi:<provider>/<model>` (e.g. pi:ollama-cloud/minimax-m3)
 *  - claude tokens: `claude:<model>` (e.g. claude:opus-4.8[1m])
 * Bare pi tokens (no provider) and provider qualifiers on claude tokens
 * are CONFIG ERRORs.
 *
 * Token grammar with effort (T284):
 *  - Trailing `:<effort>` suffix, e.g. `claude:opus-4.8[1m]:high`
 *  - pi efforts: off | minimal | low | medium | high | xhigh
 *  - claude efforts: low | medium | high | xhigh | max
 *  Parsing of the effort suffix is deferred to T286.
 */

/** The two reviewer harnesses cq knows how to drive. */
export const HARNESSES = ["claude", "pi"] as const;

/** A reviewer harness identifier (the part before the `:` in a token). */
export type Harness = (typeof HARNESSES)[number];

/**
 * Effort levels for the `pi` harness (thinking budget).
 * These are the closed vocabulary of pi effort strings (T284).
 */
export const PI_EFFORTS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
] as const;

/** A pi effort level (the trailing `:<effort>` suffix for pi tokens). */
export type PiEffort = (typeof PI_EFFORTS)[number];

/**
 * Effort levels for the `claude` harness.
 * `ultracode` is a session-only Claude Code setting, not an effort level —
 * excluded from this vocabulary (T284).
 */
export const CLAUDE_EFFORTS = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
] as const;

/** A Claude effort level (the trailing `:<effort>` suffix for claude tokens). */
export type ClaudeEffort = (typeof CLAUDE_EFFORTS)[number];

/** The union of all recognised effort strings across harnesses. */
export type Effort = PiEffort | ClaudeEffort;

/**
 * Type guard: is `value` a valid effort string for the given `harness`?
 *
 * - pi accepts: off | minimal | low | medium | high | xhigh
 * - claude accepts: low | medium | high | xhigh | max
 */
export function isEffort(harness: Harness, value: string): value is Effort {
  if (harness === "pi") {
    return (PI_EFFORTS as readonly string[]).includes(value);
  }
  return (CLAUDE_EFFORTS as readonly string[]).includes(value);
}

/**
 * A reviewer token parsed from a `"<harness>:<model>[:<effort>]"` string.
 *
 * Token grammar (T237 BREAKING change):
 *  - pi tokens MUST be `pi:<provider>/<model>` where the provider is
 *    separated from model by the FIRST `/`. E.g. `"pi:ollama-cloud/minimax-m3"`
 *    parses to `{ harness: "pi", model: "minimax-m3", provider: "ollama-cloud" }`.
 *    A bare pi token (e.g. `pi:minimax`) missing the provider qualifier is a
 *    CONFIG ERROR (BREAKING).
 *  - claude tokens MUST be `claude:<model>` and never carry a provider.
 *    `provider` is always null for claude tokens, and a `/` in the model
 *    segment is a CONFIG ERROR.
 *
 * Optional trailing effort suffix (T284):
 *  - Append `:<effort>` after the full token to override the provider/model
 *    default, e.g. `claude:opus-4.8[1m]:high` or
 *    `pi:ollama-cloud/minimax-m3:xhigh`.
 *  - `null` means absent (omitted) — the harness/model default applies.
 *  - pi efforts: off | minimal | low | medium | high | xhigh
 *  - claude efforts: low | medium | high | xhigh | max
 *  Parsing of the effort suffix is deferred to T286; this field is populated
 *  as `null` at existing construction sites until T286 is implemented.
 *
 * Reference: D36 (pi provider routing).
 */
export interface ReviewerToken {
  readonly harness: Harness;
  readonly model: string;
  /** The pi `--provider` (before the first `/`); null for claude. */
  readonly provider: string | null;
  /**
   * The optional effort level for this token (the trailing `:<effort>` suffix).
   * `null` (or absent) means no override — the provider/model default applies
   * (current behaviour unchanged). Populated by T286; always `null` until then.
   */
  readonly effort?: Effort | null;
}

/**
 * The `[webui]` table: optional bind host + port for the web UI.
 *
 * - `host`: the bind address string, or null if unset (caller picks a default).
 * - `port`: the TCP port integer (1..65535), or null if unset.
 */
export interface WebuiConfig {
  readonly host: string | null;
  readonly port: number | null;
}

/** Type guard: is `value` a known harness? */
export function isHarness(value: string): value is Harness {
  return (HARNESSES as readonly string[]).includes(value);
}

/** The three suggestedModel tiers cq dispatches at. */
export const TIERS = ["fast", "standard", "frontier"] as const;

/** A tier name (the part before `->` in an agent_tiers mapping). */
export type Tier = (typeof TIERS)[number];

/** Type guard: is `value` a known tier? */
export function isTier(value: string): value is Tier {
  return (TIERS as readonly string[]).includes(value);
}

/**
 * The default tier for agents that have no entry in `[agent_tiers]`.
 * Documented here so callers can reproduce the same fallback.
 */
export const DEFAULT_TIER: Tier = "standard";

/**
 * One entry of the `[tiers]` classifier: a parsed reviewer token, the raw
 * token-grammar key it was parsed from, and the {@link Tier} class it is
 * assigned to.
 */
export interface TierEntry {
  /** The parsed token (harness + model + provider). */
  readonly token: ReviewerToken;
  /**
   * The raw `parseReviewerToken` grammar STRING this entry was keyed by,
   * e.g. `"claude:opus-4.8[1m]"` or `"pi:ollama-cloud/minimax-m3"`.
   */
  readonly raw: string;
  /** The tier class assigned to this token. */
  readonly class: Tier;
}

/**
 * The `[tiers]` table: an INVERTED, token-keyed CLASSIFIER (Q149/Q150).
 *
 * Each `[tiers]` entry keys a `parseReviewerToken` token-grammar STRING
 * (e.g. `"claude:opus-4.8[1m]"`, `"pi:ollama-cloud/minimax-m3"`) to a
 * {@link Tier} class (`fast` | `standard` | `frontier`). The configuration
 * therefore maps a (harness + provider + model) token to its tier class —
 * the inverse of the old per-tier-slot shape.
 *
 * `entries` preserves, for each configured token, the PARSED
 * {@link ReviewerToken}, the raw key string, and the assigned class, so a
 * token can be CLASSIFIED (token -> class) AND the tokens of a class can be
 * ENUMERATED (class -> tokens).
 */
export interface TiersConfig {
  readonly entries: ReadonlyArray<TierEntry>;
}

/**
 * The parsed cq.toml configuration (T170, T223).
 *
 * - `aliases`: the `[aliases]` table, each value parsed into a ReviewerToken.
 * - `reviewers`: the top-level `reviewers = [...]` list of ALIAS names
 *   (not yet resolved — see `resolveReviewers`).
 * - `planners`: the top-level `planners = [...]` list of ALIAS names
 *   (not yet resolved — see `resolvePlanners`).
 * - `webui`: the `[webui]` table (host + port), or null if absent.
 * - `tiers`: the `[tiers]` CLASSIFIER table — an inverted, token-keyed map
 *   from a `parseReviewerToken` token-grammar string to a tier class
 *   (fast/standard/frontier); or null if `[tiers]` is absent. See
 *   {@link TiersConfig}.
 * - `agentTiers`: the `[agent_tiers]` table mapping agent-name -> tier name,
 *   or null if `[agent_tiers]` is absent. An unlisted agent falls back to
 *   `DEFAULT_TIER`.
 */
export interface CqConfig {
  readonly aliases: Record<string, ReviewerToken>;
  readonly reviewers: readonly string[];
  readonly planners: readonly string[];
  readonly webui: WebuiConfig | null;
  /** The `[tiers]` table, or null if absent. */
  readonly tiers: TiersConfig | null;
  /** The `[agent_tiers]` table (agent-name -> tier name), or null if absent. */
  readonly agentTiers: Record<string, Tier> | null;
}
