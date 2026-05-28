import { test, expect, describe } from "bun:test";
import {
  EFFORT_VALUES,
  EffortSchema,
  DEFAULT_EFFORT,
  effortToClaudeBudgetTokens,
  effortToCodexEffort,
  type Effort,
} from "../src/effort.js";
import { ChatStart } from "../src/protocol.js";

const NOW = Date.now();

describe("Effort enum", () => {
  test("EFFORT_VALUES is the canonical 5-tier list in order", () => {
    expect(EFFORT_VALUES).toEqual(["none", "low", "medium", "high", "max"] as const);
  });

  test("DEFAULT_EFFORT is 'none'", () => {
    expect(DEFAULT_EFFORT).toBe("none");
  });

  test("EffortSchema accepts each value and rejects others", () => {
    for (const v of EFFORT_VALUES) {
      expect(EffortSchema.safeParse(v).success).toBe(true);
    }
    expect(EffortSchema.safeParse("ultra").success).toBe(false);
    expect(EffortSchema.safeParse("").success).toBe(false);
    expect(EffortSchema.safeParse(null).success).toBe(false);
  });
});

describe("effortToClaudeBudgetTokens", () => {
  test("none → null (thinking disabled)", () => {
    expect(effortToClaudeBudgetTokens("none")).toBeNull();
  });
  test("low/medium/high/max map to documented budgets", () => {
    expect(effortToClaudeBudgetTokens("low")).toBe(4_000);
    expect(effortToClaudeBudgetTokens("medium")).toBe(10_000);
    expect(effortToClaudeBudgetTokens("high")).toBe(16_000);
    expect(effortToClaudeBudgetTokens("max")).toBe(31_999);
  });
  test("max budget stays strictly below 32k SDK cap", () => {
    const v = effortToClaudeBudgetTokens("max");
    expect(v).not.toBeNull();
    expect(v!).toBeLessThan(32_000);
  });
});

describe("effortToCodexEffort", () => {
  test("maps each tier to a Codex ModelReasoningEffort string", () => {
    expect(effortToCodexEffort("none")).toBe("minimal");
    expect(effortToCodexEffort("low")).toBe("low");
    expect(effortToCodexEffort("medium")).toBe("medium");
    expect(effortToCodexEffort("high")).toBe("high");
    expect(effortToCodexEffort("max")).toBe("xhigh");
  });
});

describe("ChatStart.effort field", () => {
  test("accepts a frame omitting effort (backwards-compatible)", () => {
    const frame = {
      type: "chat.start" as const,
      seq: 0,
      ts: NOW,
      model: "claude-opus-4-7",
    };
    const r = ChatStart.safeParse(frame);
    expect(r.success).toBe(true);
  });

  test("accepts each valid effort value", () => {
    for (const e of EFFORT_VALUES as readonly Effort[]) {
      const frame = {
        type: "chat.start" as const,
        seq: 0,
        ts: NOW,
        model: "claude-opus-4-7",
        effort: e,
      };
      const r = ChatStart.safeParse(frame);
      expect(r.success).toBe(true);
      if (r.success) expect(r.data.effort).toBe(e);
    }
  });

  test("rejects an unknown effort value", () => {
    const frame = {
      type: "chat.start" as const,
      seq: 0,
      ts: NOW,
      effort: "ultra",
    };
    const r = ChatStart.safeParse(frame);
    expect(r.success).toBe(false);
  });
});
