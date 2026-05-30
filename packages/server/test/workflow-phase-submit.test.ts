/**
 * workflow-phase-submit.test.ts — boundary tests for the Claude phase-subagent
 * submit tool (CLARIFY-SUBMIT-01).
 *
 * Defect: the submit tool advertised `payload` as `z.unknown()`, which
 * serializes to an empty JSON Schema (`{}`). The SDK CLI tool bridge then
 * coerced the model's object to a JSON STRING in transit, so the handler's
 * `spec.schema.safeParse(payload)` failed with "expected object, received
 * string" on EVERY submit (reproduced 7× live by the clarify-reviewer).
 *
 * The SUCCESS path through the real SDK subprocess is not unit-testable (see
 * workflow-producer.test.ts), so we test the extracted `parsePhaseSubmission`
 * boundary directly: it reproduces the failure shape and proves the fix.
 */

import { describe, it, expect } from "bun:test";
import { parsePhaseSubmission } from "../src/workflow/claudePhaseSubagent.js";
import {
  CLARIFY_REVIEW_SPEC,
  PLAN_REVIEW_SPEC,
} from "../src/workflow/phases.js";

describe("phase submit payload boundary (CLARIFY-SUBMIT-01)", () => {
  const clarifyPayload = { clear: true, contradictions: [], newQuestions: [] };

  it("documents the defect: raw schema.safeParse rejects a stringified payload", () => {
    // This is exactly what the old handler did — and what failed 7× live.
    const r = CLARIFY_REVIEW_SPEC.schema.safeParse(JSON.stringify(clarifyPayload));
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]!.code).toBe("invalid_type");
      expect(r.error.issues[0]!.message).toContain("expected object");
    }
  });

  it("accepts a payload delivered as a JSON string (transport coercion)", () => {
    const res = parsePhaseSubmission(CLARIFY_REVIEW_SPEC, JSON.stringify(clarifyPayload));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual(clarifyPayload);
  });

  it("accepts the same payload delivered as a real object", () => {
    const obj = { clear: false, contradictions: ["x conflicts with y"], newQuestions: [] };
    const res = parsePhaseSubmission(CLARIFY_REVIEW_SPEC, obj);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.value).toEqual(obj);
  });

  it("still rejects a genuinely malformed payload (object or string)", () => {
    expect(parsePhaseSubmission(CLARIFY_REVIEW_SPEC, { clear: "yes" }).ok).toBe(false);
    expect(parsePhaseSubmission(CLARIFY_REVIEW_SPEC, "not json at all").ok).toBe(false);
    expect(parsePhaseSubmission(CLARIFY_REVIEW_SPEC, JSON.stringify({ clear: 1 })).ok).toBe(false);
  });

  it("works for other phase specs too (plan-review)", () => {
    const payload = { satisfied: true, findings: [], newQuestions: [] };
    expect(parsePhaseSubmission(PLAN_REVIEW_SPEC, payload).ok).toBe(true);
    expect(parsePhaseSubmission(PLAN_REVIEW_SPEC, JSON.stringify(payload)).ok).toBe(true);
  });
});
