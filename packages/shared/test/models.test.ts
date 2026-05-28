import { test, expect, describe } from "bun:test";
import {
  MODELS,
  DEFAULT_MODEL,
  modelToPlatform,
  modelsForPlatform,
} from "../src/models.js";

describe("MODELS registry", () => {
  test("has at least one Claude and one Codex entry", () => {
    const claudeCount = MODELS.filter((m) => m.platform === "claude").length;
    const codexCount = MODELS.filter((m) => m.platform === "codex").length;
    expect(claudeCount).toBeGreaterThan(0);
    expect(codexCount).toBeGreaterThan(0);
  });

  test("DEFAULT_MODEL is present in MODELS", () => {
    expect(MODELS.some((m) => m.id === DEFAULT_MODEL)).toBe(true);
  });

  test("all entries have stable label + platform shape", () => {
    for (const m of MODELS) {
      expect(typeof m.id).toBe("string");
      expect(typeof m.label).toBe("string");
      expect(m.platform === "claude" || m.platform === "codex").toBe(true);
    }
  });
});

describe("modelToPlatform", () => {
  test("exact match against curated MODELS resolves correctly", () => {
    for (const m of MODELS) {
      expect(modelToPlatform(m.id)).toBe(m.platform);
    }
  });

  test("claude- prefix routes to claude for unknown ids", () => {
    expect(modelToPlatform("claude-future-9")).toBe("claude");
  });

  test("gpt- prefix routes to codex for unknown ids", () => {
    expect(modelToPlatform("gpt-6")).toBe("codex");
    expect(modelToPlatform("gpt-5-thinking")).toBe("codex");
  });

  test("o-series prefix routes to codex (o3, o4, o3-mini)", () => {
    expect(modelToPlatform("o3")).toBe("codex");
    expect(modelToPlatform("o3-mini")).toBe("codex");
    expect(modelToPlatform("o4")).toBe("codex");
  });

  test("unknown ids without a known prefix fall back to claude", () => {
    expect(modelToPlatform("foobar")).toBe("claude");
    expect(modelToPlatform("")).toBe("claude");
  });
});

describe("modelsForPlatform", () => {
  test("returns only Claude entries for 'claude'", () => {
    const claudes = modelsForPlatform("claude");
    expect(claudes.length).toBeGreaterThan(0);
    for (const m of claudes) expect(m.platform).toBe("claude");
  });

  test("returns only Codex entries for 'codex'", () => {
    const codexes = modelsForPlatform("codex");
    expect(codexes.length).toBeGreaterThan(0);
    for (const m of codexes) expect(m.platform).toBe("codex");
  });
});
