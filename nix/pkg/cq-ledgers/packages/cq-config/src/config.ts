/**
 * cq.toml parse / resolve / load logic (T170, T237).
 *
 * Pure module: validates at the boundary and fails fast with precise errors.
 * No transport/MCP concerns — that lands in the next task (T171).
 *
 * Token grammar (T237 BREAKING change):
 *  - pi tokens MUST be `pi:<provider>/<model>` (e.g. pi:ollama-cloud/minimax-m3)
 *  - claude tokens MUST be `claude:<model>` (e.g. claude:opus-4.8[1m])
 * Bare pi tokens and provider qualifiers on claude tokens are rejected as
 * CqConfigErrors. See parseReviewerToken for the full grammar.
 */

import { existsSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { parseToml, type RawWebui } from "./toml.js";
import {
  isHarness,
  isTier,
  DEFAULT_TIER,
  type CqConfig,
  type ReviewerToken,
  type Tier,
  type TierEntry,
  type TiersConfig,
  type WebuiConfig,
} from "./types.js";

/** The cq.toml filename, resolved relative to a repo root. */
export const CQ_CONFIG_FILENAME = "cq.toml";

/** The lowest / highest valid TCP port number. */
const MIN_PORT = 1;
const MAX_PORT = 65535;

/** Thrown when cq.toml is structurally valid TOML but violates the schema. */
export class CqConfigError extends Error {
  constructor(message: string) {
    super(`cq.toml: ${message}`);
    this.name = "CqConfigError";
  }
}

/**
 * Parse a reviewer token string into a typed ReviewerToken.
 *
 * Token grammar (T237 BREAKING change):
 *  - pi tokens MUST be `pi:<provider>/<model>` where:
 *    - The FIRST `:` separates the harness from the model segment.
 *    - The FIRST `/` in the model segment separates provider from model.
 *    - Both provider and model must be non-empty.
 *    - A bare pi token (missing `/`) is rejected as a CqConfigError (BREAKING).
 *  - claude tokens MUST be `claude:<model>` where:
 *    - The FIRST `:` separates the harness from the model.
 *    - No `/` is permitted in the model (provider qualifiers are pi-only).
 *    - A `/` in the model is rejected as a CqConfigError.
 *
 * Further colons in the model segment (after the first `:`) are preserved.
 * Throws a `CqConfigError` if the harness is unknown, the token format is
 * invalid, or any required segment is empty.
 */
export function parseReviewerToken(token: string): ReviewerToken {
  const sep = token.indexOf(":");
  if (sep < 0) {
    throw new CqConfigError(
      `token "${token}" is not "<harness>:<model>" (missing ':')`,
    );
  }
  const harness = token.slice(0, sep);
  const modelSegment = token.slice(sep + 1);
  if (harness === "") {
    throw new CqConfigError(`token "${token}" has an empty harness`);
  }
  if (modelSegment === "") {
    throw new CqConfigError(`token "${token}" has an empty model`);
  }
  if (!isHarness(harness)) {
    throw new CqConfigError(
      `unknown harness "${harness}" in token "${token}" (expected "claude" or "pi")`,
    );
  }

  const slash = modelSegment.indexOf("/");

  if (harness === "pi") {
    if (slash < 0) {
      throw new CqConfigError(
        `pi token "${token}" must be "pi:<provider>/<model>" (missing provider qualifier '/'; bare pi tokens are no longer accepted)`,
      );
    }
    const provider = modelSegment.slice(0, slash);
    const model = modelSegment.slice(slash + 1);
    if (provider === "") {
      throw new CqConfigError(
        `pi token "${token}" has an empty provider (before '/')`,
      );
    }
    if (model === "") {
      throw new CqConfigError(
        `pi token "${token}" has an empty model (after '/')`,
      );
    }
    return { harness, model, provider };
  }

  // harness === "claude": provider qualifiers are pi-only.
  if (slash >= 0) {
    throw new CqConfigError(
      `claude token "${token}" must not contain a provider qualifier '/' (provider qualifiers are pi-only)`,
    );
  }
  return { harness, model: modelSegment, provider: null };
}

/**
 * Parse a cq.toml document string into a typed CqConfig.
 *
 * Throws on malformed TOML (via the parser), an unknown harness in an alias
 * token, or a non-array `reviewers`.
 */
export function parseConfig(source: string): CqConfig {
  const raw = parseToml(source);

  const aliases: Record<string, ReviewerToken> = {};
  for (const [name, token] of Object.entries(raw.aliases)) {
    aliases[name] = parseReviewerToken(token);
  }

  const reviewers = raw.reviewers ?? [];
  const planners = raw.planners ?? [];
  const webui = raw.webui === null ? null : parseWebui(raw.webui);
  const tiers = raw.tiers === null ? null : parseTiers(raw.tiers, aliases);
  const agentTiers =
    raw.agentTiers === null ? null : parseAgentTiers(raw.agentTiers);
  return { aliases, reviewers, planners, webui, tiers, agentTiers };
}

/**
 * Parse the inverted, token-keyed `[tiers]` CLASSIFIER table into a
 * `TiersConfig` (Q149/Q150; rewritten in T270).
 *
 * Each `[tiers]` entry is `KEY = VALUE` where:
 *  - the KEY is a reviewer token, resolved EXACTLY as a `reviewers`/`planners`
 *    or old per-slot tier value was: if the KEY names an entry in `[aliases]`,
 *    use that alias's token; otherwise parse the KEY directly with
 *    `parseReviewerToken` (the G29 grammar: `claude:<model>` |
 *    `pi:<provider>/<model>`). An alias miss that is also a malformed token
 *    throws a precise `CqConfigError` from `parseReviewerToken`.
 *  - the VALUE is a tier CLASS name, validated by `isTier`. A value that is
 *    not `fast`/`standard`/`frontier` throws a `CqConfigError`.
 *
 * The resulting `entries` array records, per configured token, the parsed
 * {@link ReviewerToken}, the raw KEY string it was keyed by, and the assigned
 * class — so a token can be classified (token -> class) and the tokens of a
 * class can be enumerated (class -> tokens).
 */
function parseTiers(
  raw: Record<string, string>,
  aliases: Record<string, ReviewerToken>,
): TiersConfig {
  const entries: TierEntry[] = [];

  for (const [key, value] of Object.entries(raw)) {
    // Resolve the KEY to a token: if the KEY names a known alias, use it;
    // otherwise parse the KEY directly as a "<harness>:<model>" token. A
    // malformed/unknown token key surfaces parseReviewerToken's precise error.
    const token =
      aliases[key] !== undefined ? aliases[key]! : parseReviewerToken(key);
    // Validate the VALUE as a tier class name.
    if (!isTier(value)) {
      throw new CqConfigError(
        `tiers["${key}"] = "${value}" is not a valid tier class (expected fast, standard, or frontier)`,
      );
    }
    entries.push({ token, raw: key, class: value });
  }

  return { entries };
}

/**
 * Parse the `[agent_tiers]` raw string table into a `Record<string, Tier>`.
 *
 * Every value must be a known tier name (fast/standard/frontier).
 */
function parseAgentTiers(raw: Record<string, string>): Record<string, Tier> {
  const result: Record<string, Tier> = {};
  for (const [agentName, tierName] of Object.entries(raw)) {
    if (!isTier(tierName)) {
      throw new CqConfigError(
        `agent_tiers["${agentName}"] = "${tierName}" is not a valid tier (expected fast, standard, or frontier)`,
      );
    }
    result[agentName] = tierName;
  }
  return result;
}

/**
 * Type-check + range-check the raw `[webui]` table at the boundary.
 *
 * `host` (if present) must be a string; `port` (if present) must be an
 * INTEGER in 1..65535. Throws a precise `CqConfigError` otherwise.
 */
function parseWebui(raw: RawWebui): WebuiConfig {
  let host: string | null = null;
  if (raw.host !== undefined) {
    if (typeof raw.host !== "string") {
      throw new CqConfigError("[webui] host must be a string");
    }
    host = raw.host;
  }

  let port: number | null = null;
  if (raw.port !== undefined) {
    if (typeof raw.port !== "number" || !Number.isInteger(raw.port)) {
      throw new CqConfigError("[webui] port must be an integer");
    }
    if (raw.port < MIN_PORT || raw.port > MAX_PORT) {
      throw new CqConfigError(
        `[webui] port must be in ${MIN_PORT}..${MAX_PORT}, got ${raw.port}`,
      );
    }
    port = raw.port;
  }

  return { host, port };
}

/**
 * Resolve each `reviewers` alias name through `[aliases]` into a
 * ReviewerToken. Throws a precise `CqConfigError` on a dangling alias.
 */
export function resolveReviewers(config: CqConfig): ReviewerToken[] {
  return config.reviewers.map((alias) => {
    const token = config.aliases[alias];
    if (token === undefined) {
      throw new CqConfigError(
        `reviewers references undefined alias "${alias}" (not declared in [aliases])`,
      );
    }
    return token;
  });
}

/**
 * Resolve each `planners` alias name through `[aliases]` into a
 * ReviewerToken. Throws a precise `CqConfigError` on a dangling alias.
 */
export function resolvePlanners(config: CqConfig): ReviewerToken[] {
  return config.planners.map((alias) => {
    const token = config.aliases[alias];
    if (token === undefined) {
      throw new CqConfigError(
        `planners references undefined alias "${alias}" (not declared in [aliases])`,
      );
    }
    return token;
  });
}

/**
 * Resolve a named agent to its tier, using `[agent_tiers]` if present and
 * the agent is listed; falls back to `DEFAULT_TIER` otherwise.
 */
export function resolveAgentTier(config: CqConfig, agentName: string): Tier {
  if (config.agentTiers !== null) {
    const tier = config.agentTiers[agentName];
    if (tier !== undefined) {
      return tier;
    }
  }
  return DEFAULT_TIER;
}

/**
 * Resolve a tier name to a `ReviewerToken` using the `[tiers]` table.
 *
 * Throws a `CqConfigError` if `[tiers]` is absent or the requested tier slot
 * is not configured.
 */
export function resolveTierToken(
  config: CqConfig,
  tier: Tier,
): ReviewerToken {
  if (config.tiers === null) {
    throw new CqConfigError(
      `cannot resolve tier "${tier}": [tiers] table is absent from cq.toml`,
    );
  }
  // T268 minimal bridge: enumerate the classifier for an entry of this class.
  // The full classifier resolver (classifyToken/selectTokensForTier) is owned
  // by T271; here we pick the first entry assigned to `tier`.
  const entry = config.tiers.entries.find((e) => e.class === tier);
  if (entry === undefined) {
    throw new CqConfigError(
      `tier "${tier}" is not configured in [tiers] (no token classified as "${tier}")`,
    );
  }
  return entry.token;
}

/**
 * Resolve a named agent end-to-end: agent-name -> tier -> ReviewerToken.
 *
 * Combines `resolveAgentTier` and `resolveTierToken`. Throws a
 * `CqConfigError` if the resolved tier has no entry in `[tiers]`.
 */
export function resolveAgentModel(
  config: CqConfig,
  agentName: string,
): ReviewerToken {
  const tier = resolveAgentTier(config, agentName);
  return resolveTierToken(config, tier);
}

/**
 * Load cq.toml from `repoRoot`.
 *
 * Returns `null` when no cq.toml exists (feature OFF => caller falls back to
 * a single native Claude reviewer). Otherwise parses, validates, and eagerly
 * resolves the reviewers list (so a dangling alias throws at load time).
 */
export function loadConfig(repoRoot: string): CqConfig | null {
  const file = path.join(repoRoot, CQ_CONFIG_FILENAME);
  if (!existsSync(file)) {
    return null;
  }
  const source = readFileSync(file, "utf8");
  const config = parseConfig(source);
  // Eagerly resolve so a dangling alias is reported at load time, not later.
  resolveReviewers(config);
  resolvePlanners(config);
  return config;
}
