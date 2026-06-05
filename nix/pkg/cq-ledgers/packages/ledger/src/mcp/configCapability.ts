/**
 * config capability (T1 / R193 / G18).
 *
 * The `get_reviewers` / `get_config` MCP tools surface a repo's resolved
 * reviewer configuration (its `cq.toml`) on the ledger MCP. Per the same
 * discipline as `read_log` (see ./readLog.ts), the actual config parsing is
 * a capability the OUTER package supplies — it is NOT baked into `@cq/ledger`
 * core, which stays config-agnostic. `@cq/ledger` must NOT import `@cq/config`;
 * the `loadConfig`/`resolveReviewers` call lives ONLY in the `@cq/ledger-mcp`
 * capability implementation, which is constructed there (T2) and injected here.
 *
 * The result types below are therefore STRUCTURAL (e.g. `harness: string`) so
 * core need not know `@cq/config`'s `Harness` union; the ledger-mcp
 * implementation produces values that are assignable to them.
 */

/**
 * A single resolved reviewer, as returned by `get_reviewers`: the parsed
 * harness + model PLUS the `alias` name it was declared under in `cq.toml`
 * (so the orchestrators can echo a human-meaningful label).
 */
export interface ResolvedReviewer {
  readonly harness: string;
  readonly model: string;
  readonly alias: string;
}

/**
 * The `get_reviewers` payload. `configured` is true only when a `cq.toml`
 * exists AND declares a non-empty `reviewers` list; otherwise the caller falls
 * back to a single native Claude reviewer.
 */
export interface GetReviewersResult {
  readonly configured: boolean;
  readonly reviewers: readonly ResolvedReviewer[];
}

/** The `get_config` payload: the full parsed config (or `configured:false`). */
export interface GetConfigResult {
  readonly configured: boolean;
  readonly aliases: Record<string, { harness: string; model: string }>;
  readonly reviewers: readonly string[];
}

/**
 * The injected config capability: computes the `get_reviewers` / `get_config`
 * payloads against a config root the OUTER package bound it to. Supplied by the
 * ledger-mcp layer (over `@cq/config`); absent for config-agnostic factories
 * (e.g. an in-memory store with no cq.toml-capable root).
 */
export interface ConfigCapability {
  computeReviewers(): GetReviewersResult;
  computeConfig(): GetConfigResult;
}

/**
 * Thrown when `get_reviewers` / `get_config` is invoked on a factory wired
 * WITHOUT a config capability (no cq.toml-capable root). Mirrors
 * `ReadLogNotImplementedError`: the OTHER tools remain unaffected.
 */
export class ConfigNotImplementedError extends Error {
  constructor() {
    super(
      "get_reviewers/get_config is not implemented for this store: no " +
        "cq.toml-capable config root is available (config capability absent)",
    );
    this.name = "ConfigNotImplementedError";
  }
}
