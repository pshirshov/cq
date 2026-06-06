/**
 * cq.toml parsing scoped to the cq.toml schema (T170, T185).
 *
 * Parsing is delegated to the maintained `smol-toml` library (pure TS, TOML
 * 1.0, zero native deps, Bun-compatible). smol-toml accepts *any* valid TOML,
 * so this module layers the cq.toml schema on top of it as a post-parse
 * validation pass (fail fast at the boundary):
 *  - only `[aliases]`, `reviewers`, `planners`, and `[webui]` are allowed;
 *    any other top-level key/table throws;
 *  - `aliases` is a table of `name = "value"` string assignments;
 *  - `reviewers` / `planners` are arrays of strings;
 *  - `webui` is a table with an optional string `host` and an optional
 *    integer `port` in 1..65535.
 *
 * A malformed document (smol-toml's `TomlError`) is re-wrapped into the
 * existing `TomlSyntaxError` style so the public surface is unchanged.
 */

import { parse as parseSmolToml, TomlError } from "smol-toml";

/**
 * The raw `[webui]` table as produced by the parser: the `host` / `port`
 * cells are left as smol-toml emitted them (unknown JS values) for the
 * config layer to type-check and range-check at the boundary
 * (`parseConfig` -> `CqConfigError`). Absent cells are `undefined`.
 */
export interface RawWebui {
  readonly host: unknown;
  readonly port: unknown;
}

/** The shape a cq.toml document parses into before schema validation. */
export interface RawToml {
  /** The `[aliases]` table: alias name -> raw token string. */
  readonly aliases: Record<string, string>;
  /** The top-level `reviewers` array of strings, or null if absent. */
  readonly reviewers: readonly string[] | null;
  /** The top-level `planners` array of strings, or null if absent. */
  readonly planners: readonly string[] | null;
  /** The `[webui]` table, or null if absent. */
  readonly webui: RawWebui | null;
}

/** Thrown when cq.toml is not valid TOML, or violates the cq.toml schema. */
class TomlSyntaxError extends Error {
  constructor(message: string) {
    super(`cq.toml: ${message}`);
    this.name = "TomlSyntaxError";
  }
}

/** The exact set of top-level keys/tables cq.toml permits. */
const ALLOWED_TOP_LEVEL = new Set(["aliases", "reviewers", "planners", "webui"]);

/** Narrow an unknown value to a record (TOML table). */
function isTable(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Validate + coerce the `[aliases]` table into `name -> string`. */
function parseAliases(value: unknown): Record<string, string> {
  if (!isTable(value)) {
    throw new TomlSyntaxError("[aliases] must be a table");
  }
  const aliases: Record<string, string> = {};
  for (const [name, raw] of Object.entries(value)) {
    if (typeof raw !== "string") {
      throw new TomlSyntaxError(`alias "${name}" must be a string`);
    }
    aliases[name] = raw;
  }
  return aliases;
}

/** Validate that `value` is an array of strings (for reviewers / planners). */
function parseStringArray(key: string, value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new TomlSyntaxError(`${key} must be an array of strings`);
  }
  return value.map((entry, i) => {
    if (typeof entry !== "string") {
      throw new TomlSyntaxError(`${key}[${i}] must be a string`);
    }
    return entry;
  });
}

/**
 * Structurally validate the `[webui]` table: it must be a table whose only
 * keys are `host` / `port`. The host/port *values* are passed through
 * untouched — `parseConfig` type-checks and range-checks them and raises a
 * `CqConfigError` at the boundary.
 */
function parseWebui(value: unknown): RawWebui {
  if (!isTable(value)) {
    throw new TomlSyntaxError("[webui] must be a table");
  }
  for (const key of Object.keys(value)) {
    if (key !== "host" && key !== "port") {
      throw new TomlSyntaxError(`unexpected key "${key}" in [webui]`);
    }
  }
  return { host: value.host, port: value.port };
}

/**
 * Parse a cq.toml document into its raw shape, or throw a precise
 * `TomlSyntaxError` on malformed input or a schema violation.
 */
export function parseToml(source: string): RawToml {
  let doc: Record<string, unknown>;
  try {
    doc = parseSmolToml(source) as Record<string, unknown>;
  } catch (err) {
    if (err instanceof TomlError) {
      throw new TomlSyntaxError(err.message);
    }
    throw err;
  }

  // Whitelist: only the known top-level keys/tables are permitted.
  for (const key of Object.keys(doc)) {
    if (!ALLOWED_TOP_LEVEL.has(key)) {
      throw new TomlSyntaxError(`unexpected top-level key ${key}`);
    }
  }

  const aliases = "aliases" in doc ? parseAliases(doc.aliases) : {};
  const reviewers =
    "reviewers" in doc ? parseStringArray("reviewers", doc.reviewers) : null;
  const planners =
    "planners" in doc ? parseStringArray("planners", doc.planners) : null;
  const webui = "webui" in doc ? parseWebui(doc.webui) : null;

  return { aliases, reviewers, planners, webui };
}
