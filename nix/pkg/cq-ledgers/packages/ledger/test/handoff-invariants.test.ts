/**
 * D39 — DIRECT unit test of the pure `assertHandoffInvariants` helper.
 *
 * The helper is a status-conditional invariant on a `handoffs` item's
 * (status, fields), enforced in the store layer so no client can write an
 * incoherent handoff. The HANDOFFS_SCHEMA keeps `blockingQuestions` /
 * `handoffReasons` as `required:false`; the requirement is conditional on
 * status and lives in the helper (a drained/illness handoff legitimately has
 * neither). This test exercises the full matrix directly; the store-API
 * wiring is covered by the follow-up task (T258).
 */

import { describe, it, expect } from "bun:test";
import { SchemaValidationError } from "../src/index.js";
import { assertHandoffInvariants } from "../src/store/core.js";
import type { FieldValue } from "../src/types.js";

const fields = (f: Record<string, FieldValue>): Record<string, FieldValue> => f;

describe("assertHandoffInvariants (D39 — pure helper)", () => {
  it("THROWS for status=mixed with an empty blockingQuestions array", () => {
    expect(() =>
      assertHandoffInvariants("HO1", "mixed", fields({ summary: "x", blockingQuestions: [] })),
    ).toThrow(SchemaValidationError);
  });

  it("THROWS for status=mixed with blockingQuestions absent", () => {
    expect(() =>
      assertHandoffInvariants("HO1", "mixed", fields({ summary: "x" })),
    ).toThrow(SchemaValidationError);
  });

  it("THROWS for status=answers-required with an empty blockingQuestions array", () => {
    expect(() =>
      assertHandoffInvariants(
        "HO2",
        "answers-required",
        fields({ summary: "x", blockingQuestions: [] }),
      ),
    ).toThrow(SchemaValidationError);
  });

  it("THROWS for status=user-action-required with an empty handoffReasons array", () => {
    expect(() =>
      assertHandoffInvariants(
        "HO3",
        "user-action-required",
        fields({ summary: "x", handoffReasons: [] }),
      ),
    ).toThrow(SchemaValidationError);
  });

  it("THROWS for status=user-action-required with handoffReasons absent", () => {
    expect(() =>
      assertHandoffInvariants("HO3", "user-action-required", fields({ summary: "x" })),
    ).toThrow(SchemaValidationError);
  });

  it("returns void for status=mixed with a non-empty blockingQuestions array", () => {
    expect(
      assertHandoffInvariants(
        "HO4",
        "mixed",
        fields({ summary: "x", blockingQuestions: ["Q1"] }),
      ),
    ).toBeUndefined();
  });

  it("returns void for status=answers-required with a non-empty blockingQuestions array", () => {
    expect(
      assertHandoffInvariants(
        "HO5",
        "answers-required",
        fields({ summary: "x", blockingQuestions: ["Q1", "Q2"] }),
      ),
    ).toBeUndefined();
  });

  it("returns void for status=user-action-required with a non-empty handoffReasons array", () => {
    expect(
      assertHandoffInvariants(
        "HO6",
        "user-action-required",
        fields({ summary: "x", handoffReasons: ["manual deploy"] }),
      ),
    ).toBeUndefined();
  });

  it("returns void for status=drained with no blockingQuestions/handoffReasons", () => {
    expect(
      assertHandoffInvariants("HO7", "drained", fields({ summary: "x" })),
    ).toBeUndefined();
  });

  it("returns void for status=illness-detected with no blockingQuestions/handoffReasons", () => {
    expect(
      assertHandoffInvariants("HO8", "illness-detected", fields({ summary: "x" })),
    ).toBeUndefined();
  });
});
