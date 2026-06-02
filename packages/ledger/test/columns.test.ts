/**
 * Blackbox-Atomic unit tests for the pure column-model helpers (T60).
 * They drive the helpers with the canonical schemas / ledger names — no
 * store, no filesystem.
 */

import { describe, it, expect } from "bun:test";
import {
  eligibleColumnFields,
  defaultColumns,
  TASKS_SCHEMA,
  GOALS_SCHEMA,
  REVIEWS_SCHEMA,
} from "../src/index.js";

describe("eligibleColumnFields", () => {
  it("includes a short field and excludes long/narrative + intrinsic columns", () => {
    const eligible = eligibleColumnFields(TASKS_SCHEMA);
    // short, schema-declared field is eligible
    expect(eligible).toContain("suggestedModel");
    // long/narrative field is excluded
    expect(eligible).not.toContain("description");
    expect(eligible).not.toContain("completion");
    // always-shown intrinsic columns are never offered as extras
    expect(eligible).not.toContain("id");
    expect(eligible).not.toContain("status");
  });

  it("preserves schema field declaration order", () => {
    const eligible = eligibleColumnFields(TASKS_SCHEMA);
    const declared = Object.keys(TASKS_SCHEMA.fields);
    // eligible must be a subsequence of the declared field order
    let cursor = 0;
    for (const name of eligible) {
      cursor = declared.indexOf(name, cursor);
      expect(cursor).toBeGreaterThanOrEqual(0);
      cursor += 1;
    }
  });

  it("excludes the intrinsic `summary` field (reviews ledger)", () => {
    const eligible = eligibleColumnFields(REVIEWS_SCHEMA);
    expect(eligible).not.toContain("summary");
    expect(eligible).not.toContain("criticism");
  });
});

describe("defaultColumns", () => {
  it("defaults tasks to [suggestedModel]", () => {
    expect(defaultColumns("tasks")).toEqual(["suggestedModel"]);
  });

  it("defaults other ledgers to no extra columns", () => {
    expect(defaultColumns("goals")).toEqual([]);
    expect(defaultColumns("defects")).toEqual([]);
    expect(defaultColumns("reviews")).toEqual([]);
  });

  it("only-extra default for tasks is itself an eligible column", () => {
    // a default extra column must be a field a UI is allowed to show
    for (const col of defaultColumns("tasks")) {
      expect(eligibleColumnFields(TASKS_SCHEMA)).toContain(col);
    }
    // goals default is empty, so nothing to check beyond shape
    expect(defaultColumns("goals")).toEqual([]);
    void GOALS_SCHEMA;
  });
});
