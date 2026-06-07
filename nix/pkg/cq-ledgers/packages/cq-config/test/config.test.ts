/**
 * T170: cq.toml schema + parser/resolver tests (written reproduce-first).
 * T223: [tiers] + [agent_tiers] additive tables.
 *
 * Covers the four acceptance cases:
 *  - valid [aliases]+reviewers resolves to the expected ReviewerToken[];
 *  - absent cq.toml => loadConfig returns null;
 *  - dangling alias => throws a precise error;
 *  - unknown harness => throws.
 *
 * T223 acceptance cases (a–d):
 *  (a) [tiers] parses fast/standard/frontier into a resolved provider+model;
 *  (b) [agent_tiers] parses agent-name->tier; unlisted agent resolves to DEFAULT_TIER;
 *  (c) named agent resolves end-to-end: agent-name -> tier -> provider+model;
 *  (d) cq.toml WITHOUT either new table still yields configured:true with the
 *      existing aliases/reviewers/planners intact.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  loadConfig,
  resolveReviewers,
  resolvePlanners,
  resolveAgentTier,
  resolveTierToken,
  resolveAgentModel,
  parseConfig,
  parseReviewerToken,
  CqConfigError,
  DEFAULT_TIER,
  type ReviewerToken,
  type CqConfig,
} from "../src/index.js";

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), "cq-config-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeCqToml(contents: string): void {
  writeFileSync(path.join(dir, "cq.toml"), contents, "utf8");
}

const VALID_TOML = `
reviewers = ["codex", "grok", "opus"]

[aliases]
codex = "pi:gpt-5-codex"
grok = "pi:grok-4"
opus = "claude:opus-4.8"
`;

describe("parseReviewerToken", () => {
  it("parses a claude harness token", () => {
    const tok: ReviewerToken = parseReviewerToken("claude:opus-4.8");
    expect(tok).toEqual({ harness: "claude", model: "opus-4.8" });
  });

  it("parses a pi harness token", () => {
    expect(parseReviewerToken("pi:grok-4")).toEqual({
      harness: "pi",
      model: "grok-4",
    });
  });

  it("preserves colons inside the model segment", () => {
    expect(parseReviewerToken("pi:provider:model")).toEqual({
      harness: "pi",
      model: "provider:model",
    });
  });

  it("throws on an unknown harness", () => {
    expect(() => parseReviewerToken("gemini:flash")).toThrow(/unknown harness/i);
  });

  it("throws on a missing harness separator", () => {
    expect(() => parseReviewerToken("opus-4.8")).toThrow();
  });

  it("throws on an empty model segment", () => {
    expect(() => parseReviewerToken("claude:")).toThrow();
  });
});

describe("loadConfig", () => {
  it("returns null when cq.toml is absent", () => {
    expect(loadConfig(dir)).toBeNull();
  });

  it("loads and resolves a valid cq.toml", () => {
    writeCqToml(VALID_TOML);
    const config = loadConfig(dir);
    expect(config).not.toBeNull();
    const cfg = config as CqConfig;
    expect(cfg.aliases).toEqual({
      codex: { harness: "pi", model: "gpt-5-codex" },
      grok: { harness: "pi", model: "grok-4" },
      opus: { harness: "claude", model: "opus-4.8" },
    });
    // CqConfig.reviewers holds the raw ALIAS names (not yet resolved).
    expect(cfg.reviewers).toEqual(["codex", "grok", "opus"]);
    // Resolution through [aliases] yields the ReviewerToken[].
    expect(resolveReviewers(cfg)).toEqual([
      { harness: "pi", model: "gpt-5-codex" },
      { harness: "pi", model: "grok-4" },
      { harness: "claude", model: "opus-4.8" },
    ]);
  });

  it("throws on a dangling alias in reviewers", () => {
    writeCqToml(`
reviewers = ["codex", "ghost"]

[aliases]
codex = "pi:gpt-5-codex"
`);
    expect(() => loadConfig(dir)).toThrow(/undefined alias.*ghost/i);
  });

  it("throws on an unknown harness in an alias token", () => {
    writeCqToml(`
reviewers = ["weird"]

[aliases]
weird = "gemini:flash"
`);
    expect(() => loadConfig(dir)).toThrow(/unknown harness/i);
  });

  it("throws on malformed TOML", () => {
    writeCqToml(`[aliases\ncodex = "pi:gpt-5-codex"`);
    expect(() => loadConfig(dir)).toThrow();
  });
});

describe("resolveReviewers", () => {
  it("resolves reviewers through aliases", () => {
    const config = parseConfig(VALID_TOML);
    const resolved: ReviewerToken[] = resolveReviewers(config);
    expect(resolved).toEqual([
      { harness: "pi", model: "gpt-5-codex" },
      { harness: "pi", model: "grok-4" },
      { harness: "claude", model: "opus-4.8" },
    ]);
  });
});

// T12: planners=[...] support

const VALID_TOML_WITH_PLANNERS = `
reviewers = ["codex"]
planners = ["opus"]

[aliases]
codex = "pi:gpt-5-codex"
opus = "claude:opus-4.8"
`;

describe("parseConfig with planners", () => {
  it("whitelist rejects an unknown top-level key but accepts planners", () => {
    // (a) Unknown top-level key hits the same rejection path that `planners`
    //     hit before the whitelist was extended — verifies the guard is live.
    expect(() => parseConfig(`bogus = []\n`)).toThrow(
      /unexpected top-level key bogus/,
    );
    // (b) After the fix, `planners` is whitelisted — must parse without error.
    expect(() => parseConfig(VALID_TOML_WITH_PLANNERS)).not.toThrow();
  });

  it("parses a cq.toml carrying both reviewers and planners", () => {
    const config = parseConfig(VALID_TOML_WITH_PLANNERS);
    expect(config.reviewers).toEqual(["codex"]);
    expect(config.planners).toEqual(["opus"]);
  });

  it("defaults planners to [] when absent", () => {
    const config = parseConfig(VALID_TOML);
    expect(config.planners).toEqual([]);
  });
});

describe("resolvePlanners", () => {
  it("resolves planner aliases through [aliases]", () => {
    const config = parseConfig(VALID_TOML_WITH_PLANNERS);
    const resolved: ReviewerToken[] = resolvePlanners(config);
    expect(resolved).toEqual([{ harness: "claude", model: "opus-4.8" }]);
  });

  it("throws on a dangling planner alias", () => {
    const config = parseConfig(`
planners = ["ghost"]
[aliases]
`);
    expect(() => resolvePlanners(config)).toThrow(/undefined alias.*ghost/i);
  });
});

// T185: smol-toml swap + typed [webui] table (host string + integer port).

const VALID_TOML_WITH_WEBUI = `
reviewers = ["codex"]

[aliases]
codex = "pi:gpt-5-codex"

[webui]
host = "0.0.0.0"
port = 5180
`;

describe("parseConfig with [webui]", () => {
  it("parses host + integer port, port stays a number", () => {
    const config = parseConfig(VALID_TOML_WITH_WEBUI);
    expect(config.webui).toEqual({ host: "0.0.0.0", port: 5180 });
    expect(typeof config.webui?.port).toBe("number");
  });

  it("defaults webui to null when absent", () => {
    expect(parseConfig(VALID_TOML).webui).toBeNull();
  });

  it("allows a [webui] table with only host", () => {
    expect(parseConfig(`[webui]\nhost = "127.0.0.1"\n`).webui).toEqual({
      host: "127.0.0.1",
      port: null,
    });
  });

  it("allows a [webui] table with only port", () => {
    expect(parseConfig(`[webui]\nport = 8080\n`).webui).toEqual({
      host: null,
      port: 8080,
    });
  });

  it("throws on an unknown key inside [webui]", () => {
    expect(() => parseConfig(`[webui]\nbogus = 1\n`)).toThrow(
      /unexpected key "bogus" in \[webui\]/,
    );
  });

  it("throws CqConfigError on a string port", () => {
    expect(() => parseConfig(`[webui]\nport = "5180"\n`)).toThrow(
      CqConfigError,
    );
  });

  it("throws CqConfigError on a non-integer port", () => {
    expect(() => parseConfig(`[webui]\nport = 5180.5\n`)).toThrow(
      CqConfigError,
    );
  });

  it("throws CqConfigError on an out-of-range port", () => {
    expect(() => parseConfig(`[webui]\nport = 0\n`)).toThrow(CqConfigError);
    expect(() => parseConfig(`[webui]\nport = 70000\n`)).toThrow(
      CqConfigError,
    );
  });

  it("throws CqConfigError on a non-string host", () => {
    expect(() => parseConfig(`[webui]\nhost = 123\n`)).toThrow(CqConfigError);
  });
});

describe("whitelist over smol-toml output", () => {
  it("rejects an unknown top-level table", () => {
    expect(() => parseConfig(`[bogus]\nx = 1\n`)).toThrow(
      /unexpected top-level key bogus/,
    );
  });

  it("rejects an unknown top-level key", () => {
    expect(() => parseConfig(`bogus = []\n`)).toThrow(
      /unexpected top-level key bogus/,
    );
  });

  it("still throws on malformed TOML (wrapped TomlError)", () => {
    expect(() => parseConfig(`[aliases\ncodex = "pi:x"`)).toThrow();
  });
});

describe("loadConfig with planners", () => {
  it("loads and resolves a cq.toml with planners", () => {
    writeCqToml(VALID_TOML_WITH_PLANNERS);
    const config = loadConfig(dir);
    expect(config).not.toBeNull();
    const cfg = config as CqConfig;
    expect(cfg.planners).toEqual(["opus"]);
    expect(resolvePlanners(cfg)).toEqual([
      { harness: "claude", model: "opus-4.8" },
    ]);
  });

  it("throws at load time on a dangling planner alias", () => {
    writeCqToml(`
planners = ["ghost"]
[aliases]
`);
    expect(() => loadConfig(dir)).toThrow(/undefined alias.*ghost/i);
  });
});

// T223: [tiers] + [agent_tiers] additive tables.

const VALID_TOML_WITH_TIERS = `
reviewers = ["opus"]
planners = ["opus"]

[aliases]
opus = "claude:opus-4.8[1m]"
minimax = "pi:minimax-m3"
grok = "pi:grok-build"

[tiers]
fast = "pi:minimax-m3"
standard = "minimax"
frontier = "opus"

[agent_tiers]
investigate-explorer = "frontier"
plan-reviewer = "frontier"
implement-worker = "standard"
implement-reviewer = "standard"
`;

describe("parseConfig with [tiers] (T223 acceptance a)", () => {
  it("parses fast/standard/frontier into resolved ReviewerTokens (direct token)", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    expect(config.tiers).not.toBeNull();
    // 'fast' is a direct "<harness>:<model>" token (not an alias).
    expect(config.tiers!.fast).toEqual({ harness: "pi", model: "minimax-m3" });
  });

  it("resolves a tier value that names an alias", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    // 'standard' = "minimax" — a name in [aliases] -> pi:minimax-m3
    expect(config.tiers!.standard).toEqual({ harness: "pi", model: "minimax-m3" });
    // 'frontier' = "opus" — a name in [aliases] -> claude:opus-4.8[1m]
    expect(config.tiers!.frontier).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
    });
  });

  it("defaults tiers to null when [tiers] is absent", () => {
    const config = parseConfig(VALID_TOML);
    expect(config.tiers).toBeNull();
  });

  it("throws on an unknown key in [tiers]", () => {
    expect(() =>
      parseConfig(`
[tiers]
ultra = "claude:opus-4.8[1m]"
`),
    ).toThrow(/unexpected key "ultra" in \[tiers\]/);
  });

  it("throws on a tier value with an unknown harness", () => {
    expect(() =>
      parseConfig(`
[tiers]
fast = "gemini:flash"
`),
    ).toThrow(/unknown harness/i);
  });
});

describe("parseConfig with [agent_tiers] (T223 acceptance b)", () => {
  it("parses agent-name -> tier map", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    expect(config.agentTiers).not.toBeNull();
    expect(config.agentTiers!["investigate-explorer"]).toBe("frontier");
    expect(config.agentTiers!["implement-worker"]).toBe("standard");
  });

  it("an unlisted agent resolves to DEFAULT_TIER via resolveAgentTier", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    const tier = resolveAgentTier(config, "unknown-agent");
    expect(tier).toBe(DEFAULT_TIER);
  });

  it("a listed agent resolves to its configured tier", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    expect(resolveAgentTier(config, "investigate-explorer")).toBe("frontier");
    expect(resolveAgentTier(config, "implement-worker")).toBe("standard");
  });

  it("resolveAgentTier falls back to DEFAULT_TIER when [agent_tiers] is absent", () => {
    const config = parseConfig(VALID_TOML);
    expect(config.agentTiers).toBeNull();
    expect(resolveAgentTier(config, "any-agent")).toBe(DEFAULT_TIER);
  });

  it("defaults agentTiers to null when [agent_tiers] is absent", () => {
    const config = parseConfig(VALID_TOML);
    expect(config.agentTiers).toBeNull();
  });

  it("throws on an invalid tier value in [agent_tiers]", () => {
    expect(() =>
      parseConfig(`
[agent_tiers]
my-agent = "ultra"
`),
    ).toThrow(/not a valid tier/i);
  });
});

describe("resolveAgentModel end-to-end (T223 acceptance c)", () => {
  it("resolves agent-name -> tier -> provider+model", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    // investigate-explorer -> frontier -> opus alias -> claude:opus-4.8[1m]
    expect(resolveAgentModel(config, "investigate-explorer")).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
    });
    // implement-worker -> standard -> minimax alias -> pi:minimax-m3
    expect(resolveAgentModel(config, "implement-worker")).toEqual({
      harness: "pi",
      model: "minimax-m3",
    });
  });

  it("resolves an unlisted agent through DEFAULT_TIER", () => {
    const config = parseConfig(VALID_TOML_WITH_TIERS);
    // unlisted agent -> standard (DEFAULT_TIER) -> minimax alias -> pi:minimax-m3
    const token = resolveAgentModel(config, "unlisted-agent");
    expect(token).toEqual({ harness: "pi", model: "minimax-m3" });
  });

  it("resolveTierToken throws when [tiers] is absent", () => {
    const config = parseConfig(VALID_TOML);
    expect(() => resolveTierToken(config, "standard")).toThrow(CqConfigError);
  });

  it("resolveTierToken throws when the requested tier slot is not configured", () => {
    const config = parseConfig(`
[tiers]
frontier = "claude:opus-4.8[1m]"
`);
    expect(() => resolveTierToken(config, "fast")).toThrow(CqConfigError);
  });
});

describe("additive-only regression (T223 acceptance d)", () => {
  it("cq.toml WITHOUT [tiers]/[agent_tiers] still yields configured:true with existing config intact", () => {
    const config = parseConfig(VALID_TOML);
    // existing fields intact
    expect(config.aliases).toEqual({
      codex: { harness: "pi", model: "gpt-5-codex" },
      grok: { harness: "pi", model: "grok-4" },
      opus: { harness: "claude", model: "opus-4.8" },
    });
    expect(config.reviewers).toEqual(["codex", "grok", "opus"]);
    expect(config.planners).toEqual([]);
    // new fields are null (not present)
    expect(config.tiers).toBeNull();
    expect(config.agentTiers).toBeNull();
    // resolveReviewers still works
    expect(resolveReviewers(config)).toEqual([
      { harness: "pi", model: "gpt-5-codex" },
      { harness: "pi", model: "grok-4" },
      { harness: "claude", model: "opus-4.8" },
    ]);
  });

  it("whitelist still rejects unknown top-level keys", () => {
    expect(() => parseConfig(`[bogus]\nx = 1\n`)).toThrow(
      /unexpected top-level key bogus/,
    );
  });
});
