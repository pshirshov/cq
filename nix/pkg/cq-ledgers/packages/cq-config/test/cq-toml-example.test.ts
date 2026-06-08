/**
 * T234: Reproducible test that verifies cq.toml.example (repo root) is
 * provider-qualified and resolves correctly under the T231 grammar.
 *
 * Acceptance:
 *  - The file contains no bare slash-free `pi:<word>` tokens.
 *  - parseConfig resolves the minimax alias to {harness:'pi', model:'minimax-m3', provider:'ollama-cloud'}.
 *  - parseConfig resolves codex and grok aliases to {harness:'pi', model:'grok-build', provider:'grok-build'}.
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
