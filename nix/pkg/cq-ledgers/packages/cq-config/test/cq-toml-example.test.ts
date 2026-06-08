/**
 * T234: Reproducible test that verifies cq.toml.example (repo root) is
 * provider-qualified and resolves correctly under the T231 grammar.
 *
 * T274: Added regression guard — parseConfig on cq.toml.example must
 * succeed with no CqConfigError (ensures the shipped example always stays
 * valid under the current grammar).
 *
 * Acceptance:
 *  - The file contains no bare slash-free `pi:<word>` tokens.
 *  - parseConfig resolves the minimax alias to {harness:'pi', model:'minimax-m3', provider:'ollama-cloud'}.
 *  - parseConfig resolves codex and grok aliases to {harness:'pi', model:'grok-build', provider:'grok-build'}.
 *  - parseConfig does NOT throw (T274 regression guard).
 *
 * Uses parseConfig (not loadConfig) so the test reads cq.toml.example
 * directly and does not depend on the gitignored live cq.toml being present.
 */

import { describe, it, expect } from "bun:test";
import * as path from "node:path";
import { readFileSync } from "node:fs";
import { parseConfig, type CqConfig } from "../src/index.js";

// Resolve the repo root by walking up 6 levels from this test file's directory:
// test/ -> cq-config/ -> packages/ -> cq-ledgers/ -> pkg/ -> nix/ -> repo root
const REPO_ROOT = path.resolve(import.meta.dir, "../../../../../../");
const EXAMPLE_PATH = path.join(REPO_ROOT, "cq.toml.example");

// T274: Regression guard — the example file must parse cleanly with no CqConfigError.
describe("cq.toml.example — T274 regression guard: no CqConfigError", () => {
  it("parseConfig on cq.toml.example does not throw CqConfigError", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    expect(() => parseConfig(contents)).not.toThrow();
  });

  it("parseConfig on cq.toml.example yields a non-null tiers config", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    // The example has a [tiers] block, so tiers must be non-null.
    expect(config.tiers).not.toBeNull();
  });

  it("parseConfig on cq.toml.example yields non-null agentTiers", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    expect(config.agentTiers).not.toBeNull();
  });

  it("parseConfig on cq.toml.example — [tiers] uses token-keyed classifier form", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    // All entries in the parsed tiers.entries must have a resolved token
    // (not an alias stub) — confirms the inverted token-keyed classifier
    // form is used and parsed correctly.
    expect(config.tiers!.entries.length).toBeGreaterThan(0);
    for (const entry of config.tiers!.entries) {
      expect(entry.token.harness === "claude" || entry.token.harness === "pi").toBe(true);
      expect(entry.token.model).toBeTruthy();
    }
  });
});

describe("cq.toml.example — T234 provider-qualification checks", () => {
  it("contains no bare slash-free pi:<word> tokens", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    // Match any `pi:` followed by one or more non-slash, non-whitespace, non-quote chars
    // without a subsequent `/` before the closing quote — i.e. a bare pi token.
    const bareMatch = contents.match(/"pi:[^/"'\s]+"/g);
    expect(bareMatch).toBeNull();
  });

  it("resolves minimax alias to {harness:'pi', model:'minimax-m3', provider:'ollama-cloud'}", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    expect(config.aliases["minimax"]).toEqual({
      harness: "pi",
      model: "minimax-m3",
      provider: "ollama-cloud",
    });
  });

  it("resolves codex alias to {harness:'pi', model:'grok-build', provider:'grok-build'}", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    expect(config.aliases["codex"]).toEqual({
      harness: "pi",
      model: "grok-build",
      provider: "grok-build",
    });
  });

  it("resolves grok alias to {harness:'pi', model:'grok-build', provider:'grok-build'}", () => {
    const contents = readFileSync(EXAMPLE_PATH, "utf8");
    const config: CqConfig = parseConfig(contents);
    expect(config.aliases["grok"]).toEqual({
      harness: "pi",
      model: "grok-build",
      provider: "grok-build",
    });
  });
});
