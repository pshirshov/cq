/**
 * T170: cq.toml schema + parser/resolver tests (written reproduce-first).
 *
 * Covers the four acceptance cases:
 *  - valid [aliases]+reviewers resolves to the expected ReviewerToken[];
 *  - absent cq.toml => loadConfig returns null;
 *  - dangling alias => throws a precise error;
 *  - unknown harness => throws.
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  loadConfig,
  resolveReviewers,
  resolvePlanners,
  parseConfig,
  parseReviewerToken,
  CqConfigError,
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
