/**
 * T284: isEffort guard + effort enum acceptance tests.
 *
 * Acceptance cases:
 *  - isEffort('pi','xhigh') === true
 *  - isEffort('claude','xhigh') === true
 *  - isEffort('pi','max') === false  (max is claude-only)
 *  - isEffort('claude','off') === false  (off is pi-only)
 *  - isEffort('pi','bogus') === false
 *  - PI_EFFORTS and CLAUDE_EFFORTS are re-exported from @cq/config
 *  - ReviewerToken.effort field exists and accepts Effort | null | undefined
 */

import { describe, it, expect } from "bun:test";
import {
  isEffort,
  PI_EFFORTS,
  CLAUDE_EFFORTS,
  type Effort,
  type PiEffort,
  type ClaudeEffort,
  type ReviewerToken,
} from "../src/index.js";

describe("isEffort", () => {
  it("accepts xhigh for pi", () => {
    expect(isEffort("pi", "xhigh")).toBe(true);
  });

  it("accepts xhigh for claude", () => {
    expect(isEffort("claude", "xhigh")).toBe(true);
  });

  it("rejects max for pi (max is claude-only)", () => {
    expect(isEffort("pi", "max")).toBe(false);
  });

  it("rejects off for claude (off is pi-only)", () => {
    expect(isEffort("claude", "off")).toBe(false);
  });

  it("rejects bogus for pi", () => {
    expect(isEffort("pi", "bogus")).toBe(false);
  });

  it("accepts all PI_EFFORTS for pi", () => {
    for (const e of PI_EFFORTS) {
      expect(isEffort("pi", e)).toBe(true);
    }
  });

  it("accepts all CLAUDE_EFFORTS for claude", () => {
    for (const e of CLAUDE_EFFORTS) {
      expect(isEffort("claude", e)).toBe(true);
    }
  });

  it("rejects pi-only efforts for claude", () => {
    const piOnly = PI_EFFORTS.filter(
      (e) => !(CLAUDE_EFFORTS as readonly string[]).includes(e),
    );
    for (const e of piOnly) {
      expect(isEffort("claude", e)).toBe(false);
    }
  });

  it("rejects claude-only efforts for pi", () => {
    const claudeOnly = CLAUDE_EFFORTS.filter(
      (e) => !(PI_EFFORTS as readonly string[]).includes(e),
    );
    for (const e of claudeOnly) {
      expect(isEffort("pi", e)).toBe(false);
    }
  });
});

describe("ReviewerToken.effort field", () => {
  it("accepts effort: null on a ReviewerToken", () => {
    const token: ReviewerToken = {
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: null,
    };
    expect(token.effort).toBeNull();
  });

  it("accepts effort omitted on a ReviewerToken", () => {
    const token: ReviewerToken = {
      harness: "pi",
      model: "minimax-m3",
      provider: "ollama-cloud",
    };
    expect(token.effort).toBeUndefined();
  });

  it("accepts a valid Effort value on a ReviewerToken", () => {
    const token: ReviewerToken = {
      harness: "claude",
      model: "opus-4.8[1m]",
      provider: null,
      effort: "high",
    };
    expect(token.effort).toBe("high");
  });
});

// Type-level assertions: ensure the exported types are structurally correct.
const _piEffort: PiEffort = "off";
const _claudeEffort: ClaudeEffort = "max";
const _effort: Effort = "xhigh";
void _piEffort;
void _claudeEffort;
void _effort;
