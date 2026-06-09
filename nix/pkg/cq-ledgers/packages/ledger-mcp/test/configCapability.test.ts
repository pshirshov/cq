/**
 * T232: provider threading through @cq/config resolvers + configCapability.
 *
 * Asserts that computeReviewers / computeConfig / computePlanners correctly
 * propagate the `provider` field from parsed ReviewerTokens into the
 * GetReviewersResult / GetConfigResult surfaces:
 *   - pi token "pi:ollama-cloud/minimax-m3" → provider: "ollama-cloud"
 *   - claude token "claude:opus-4.8[1m]"   → provider: null
 */

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  computeReviewers,
  computePlanners,
  computeConfig,
} from "../src/configCapability.js";
import { FsLedgerStore } from "@cq/ledger";

let dir: string;

beforeEach(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "t232-"));
  const store = new FsLedgerStore({ root: dir });
  await store.init();
  await store.dispose();
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function writeCqToml(contents: string): void {
  writeFileSync(path.join(dir, "cq.toml"), contents, "utf8");
}

const FIXTURE = [
  'reviewers = ["minimax", "claude"]',
  'planners  = ["claude"]',
  "",
  "[aliases]",
  '  minimax = "pi:ollama-cloud/minimax-m3"',
  '  claude  = "claude:opus-4.8[1m]"',
  "",
].join("\n");

describe("T232: provider threading — computeReviewers", () => {
  it("returns provider:'ollama-cloud' for pi token and provider:null for claude token", () => {
    writeCqToml(FIXTURE);
    const result = computeReviewers(dir);
    expect(result.configured).toBe(true);
    expect(result.reviewers).toHaveLength(2);

    const minimax = result.reviewers[0]!;
    expect(minimax.harness).toBe("pi");
    expect(minimax.model).toBe("minimax-m3");
    expect(minimax.provider).toBe("ollama-cloud");
    expect(minimax.alias).toBe("minimax");

    const claude = result.reviewers[1]!;
    expect(claude.harness).toBe("claude");
    expect(claude.model).toBe("opus-4.8[1m]");
    expect(claude.provider).toBeNull();
    expect(claude.alias).toBe("claude");
  });
});

describe("T232: provider threading — computePlanners", () => {
  it("returns provider:null for the claude planner token", () => {
    writeCqToml(FIXTURE);
    const result = computePlanners(dir);
    expect(result.configured).toBe(true);
    expect(result.planners).toHaveLength(1);

    const claude = result.planners[0]!;
    expect(claude.harness).toBe("claude");
    expect(claude.model).toBe("opus-4.8[1m]");
    expect(claude.provider).toBeNull();
    expect(claude.alias).toBe("claude");
  });
});

describe("T232: provider threading — computeConfig aliases", () => {
  it("computeConfig.aliases.minimax.provider === 'ollama-cloud'", () => {
    writeCqToml(FIXTURE);
    const result = computeConfig(dir);
    expect(result.configured).toBe(true);

    const minimax = result.aliases["minimax"];
    expect(minimax).toBeDefined();
    expect(minimax!.provider).toBe("ollama-cloud");
    expect(minimax!.harness).toBe("pi");
    expect(minimax!.model).toBe("minimax-m3");

    const claude = result.aliases["claude"];
    expect(claude).toBeDefined();
    expect(claude!.provider).toBeNull();
  });

  it("computeConfig.aliases.minimax matches full expected shape", () => {
    writeCqToml(FIXTURE);
    const result = computeConfig(dir);
    expect(result.aliases["minimax"]).toEqual({
      harness: "pi",
      model: "minimax-m3",
      provider: "ollama-cloud",
      effort: null,
    });
    expect(result.aliases["claude"]).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: null,
    });
  });
});

describe("T232: provider threading — computeConfig tiers", () => {
  it("threads provider through [tiers] slot", () => {
    writeCqToml(
      [
        'reviewers = ["minimax"]',
        "",
        "[aliases]",
        '  minimax = "pi:ollama-cloud/minimax-m3"',
        '  claude  = "claude:opus-4.8[1m]"',
        "",
        "[tiers]",
        '  minimax = "fast"',
        '  claude  = "standard"',
        "",
      ].join("\n"),
    );
    const result = computeConfig(dir);
    expect(result.tiers).not.toBeNull();
    expect(result.tiers!.fast).toEqual({
      harness: "pi",
      model: "minimax-m3",
      provider: "ollama-cloud",
      effort: null,
    });
    expect(result.tiers!.standard).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: null,
    });
  });
});

// ---- T292: effort threading --------------------------------------------------

const FIXTURE_WITH_EFFORT = [
  'reviewers = ["pi"]',
  'planners  = ["pi"]',
  "",
  "[aliases]",
  '  pi     = "pi:grok-build/grok-build:xhigh"',
  '  claude = "claude:opus-4.8[1m]"',
  "",
].join("\n");

describe("T292: effort threading — computeReviewers", () => {
  it("emits effort:'xhigh' for alias with effort suffix", () => {
    writeCqToml(FIXTURE_WITH_EFFORT);
    const result = computeReviewers(dir);
    expect(result.configured).toBe(true);
    expect(result.reviewers).toHaveLength(1);
    const pi = result.reviewers[0]!;
    expect(pi.harness).toBe("pi");
    expect(pi.model).toBe("grok-build");
    expect(pi.provider).toBe("grok-build");
    expect(pi.alias).toBe("pi");
    expect(pi.effort).toBe("xhigh");
  });

  it("emits effort:null for an effortless alias", () => {
    writeCqToml(
      [
        'reviewers = ["minimax", "claude"]',
        'planners  = ["claude"]',
        "",
        "[aliases]",
        '  minimax = "pi:ollama-cloud/minimax-m3"',
        '  claude  = "claude:opus-4.8[1m]"',
        "",
      ].join("\n"),
    );
    const result = computeReviewers(dir);
    for (const r of result.reviewers) {
      expect(r.effort).toBeNull();
    }
  });
});

describe("T292: effort threading — computePlanners", () => {
  it("emits effort:'xhigh' for planner alias with effort suffix", () => {
    writeCqToml(FIXTURE_WITH_EFFORT);
    const result = computePlanners(dir);
    expect(result.configured).toBe(true);
    expect(result.planners).toHaveLength(1);
    const pi = result.planners[0]!;
    expect(pi.effort).toBe("xhigh");
  });

  it("emits effort:null for an effortless planner", () => {
    writeCqToml(
      [
        'planners = ["claude"]',
        "",
        "[aliases]",
        '  claude = "claude:opus-4.8[1m]"',
        "",
      ].join("\n"),
    );
    const result = computePlanners(dir);
    expect(result.planners[0]!.effort).toBeNull();
  });
});

describe("T292: effort threading — computeConfig aliases", () => {
  it("aliases entry with effort suffix emits effort:'xhigh'", () => {
    writeCqToml(FIXTURE_WITH_EFFORT);
    const result = computeConfig(dir);
    expect(result.aliases["pi"]).toEqual({
      harness: "pi",
      model: "grok-build",
      provider: "grok-build",
      effort: "xhigh",
    });
  });

  it("aliases entry without effort suffix emits effort:null", () => {
    writeCqToml(FIXTURE_WITH_EFFORT);
    const result = computeConfig(dir);
    expect(result.aliases["claude"]).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: null,
    });
  });
});

describe("T292: effort threading — computeConfig tiers", () => {
  it("tiers slot with effort token emits effort:'xhigh'", () => {
    writeCqToml(
      [
        'reviewers = ["pi"]',
        "",
        "[aliases]",
        '  pi = "pi:grok-build/grok-build:xhigh"',
        "",
        "[tiers]",
        '  pi = "fast"',
        "",
      ].join("\n"),
    );
    const result = computeConfig(dir);
    expect(result.tiers).not.toBeNull();
    expect(result.tiers!.fast).toEqual({
      harness: "pi",
      model: "grok-build",
      provider: "grok-build",
      effort: "xhigh",
    });
  });

  it("tiers slot without effort token emits effort:null", () => {
    writeCqToml(
      [
        'reviewers = ["claude"]',
        "",
        "[aliases]",
        '  claude = "claude:opus-4.8[1m]"',
        "",
        "[tiers]",
        '  claude = "standard"',
        "",
      ].join("\n"),
    );
    const result = computeConfig(dir);
    expect(result.tiers!.standard).toEqual({
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: null,
    });
  });
});
