/**
 * cq.toml data model (T170, T223, T237).
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
 */

/** The two reviewer harnesses cq knows how to drive. */
export const HARNESSES = ["claude", "pi"] as const;

/** A reviewer harness identifier (the part before the `:` in a token). */
export type Harness = (typeof HARNESSES)[number];

/**
 * A reviewer token parsed from a `"<harness>:<model>"` string.
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
 * Reference: D36 (pi provider routing).
 */
export interface ReviewerToken {
  readonly harness: Harness;
  readonly model: string;
  /** The pi `--provider` (before the first `/`); null for claude. */
  readonly provider: string | null;
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
 * The `[tiers]` table: maps each tier name to a resolved ReviewerToken
 * (parsed from a `"<harness>:<model>"` string via `[aliases]` or directly).
 *
 * All three tier slots are optional; absent tiers are `undefined` so callers
 * can detect an unconfigured tier rather than silently getting a zero value.
 */
export interface TiersConfig {
  readonly fast: ReviewerToken | undefined;
  readonly standard: ReviewerToken | undefined;
  readonly frontier: ReviewerToken | undefined;
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
 * - `tiers`: the `[tiers]` table mapping fast/standard/frontier to a
 *   ReviewerToken, or null if `[tiers]` is absent.
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
