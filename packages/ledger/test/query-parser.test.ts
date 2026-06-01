import { describe, it, expect } from "bun:test";
import {
  parseQuery,
  evaluate,
  collectTerms,
  isPlainTextQuery,
  type QueryNode,
  type EvalContext,
} from "../src/search/query.js";

describe("query parser", () => {
  it("parses a bare term", () => {
    expect(parseQuery("warp")).toEqual({ t: "term", text: "warp" });
  });

  it("treats juxtaposition as AND", () => {
    expect(parseQuery("warp leak")).toEqual({
      t: "and",
      nodes: [
        { t: "term", text: "warp" },
        { t: "term", text: "leak" },
      ],
    });
  });

  it("parses qualifiers", () => {
    expect(parseQuery("status:done")).toEqual({ t: "qualifier", key: "status", value: "done" });
    expect(parseQuery("ledger:goals")).toEqual({ t: "qualifier", key: "ledger", value: "goals" });
  });

  it("parses OR with parentheses", () => {
    expect(parseQuery("(status:done OR status:wip)")).toEqual({
      t: "or",
      nodes: [
        { t: "qualifier", key: "status", value: "done" },
        { t: "qualifier", key: "status", value: "wip" },
      ],
    });
  });

  it("parses negation via NOT and -", () => {
    expect(parseQuery("-status:done")).toEqual({
      t: "not",
      node: { t: "qualifier", key: "status", value: "done" },
    });
    expect(parseQuery("NOT leak")).toEqual({ t: "not", node: { t: "term", text: "leak" } });
  });

  it("honors quoted values (spaces preserved)", () => {
    expect(parseQuery('status:"in progress"')).toEqual({
      t: "qualifier",
      key: "status",
      value: "in progress",
    });
    expect(parseQuery('"warp core"')).toEqual({ t: "term", text: "warp core" });
  });

  it("respects precedence: AND binds tighter than OR", () => {
    // `a b OR c` → (a AND b) OR c
    expect(parseQuery("a b OR c")).toEqual({
      t: "or",
      nodes: [
        { t: "and", nodes: [{ t: "term", text: "a" }, { t: "term", text: "b" }] },
        { t: "term", text: "c" },
      ],
    });
  });

  it("combines qualifiers and free text", () => {
    expect(parseQuery("ledger:goals platform")).toEqual({
      t: "and",
      nodes: [
        { t: "qualifier", key: "ledger", value: "goals" },
        { t: "term", text: "platform" },
      ],
    });
  });

  it("treats lowercase or/and as terms, only uppercase as operators", () => {
    expect(parseQuery("a or b")).toEqual({
      t: "and",
      nodes: [
        { t: "term", text: "a" },
        { t: "term", text: "or" },
        { t: "term", text: "b" },
      ],
    });
  });

  it("returns empty for blank input", () => {
    expect(parseQuery("")).toEqual({ t: "empty" });
    expect(parseQuery("   ")).toEqual({ t: "empty" });
  });

  it("classifies plain-text queries", () => {
    expect(isPlainTextQuery(parseQuery("warp leak"))).toBe(true);
    expect(isPlainTextQuery(parseQuery("warp"))).toBe(true);
    expect(isPlainTextQuery(parseQuery("status:done"))).toBe(false);
    expect(isPlainTextQuery(parseQuery("a OR b"))).toBe(false);
  });

  it("collects distinct free-text terms", () => {
    expect(collectTerms(parseQuery("a b OR (c status:done)")).sort()).toEqual(["a", "b", "c"]);
  });
});

describe("query evaluator", () => {
  // Item with: status=done, ledger=tasks, terms {warp, leak}.
  const ctx = (opts: { status: string; ledger: string; terms: Set<string> }): EvalContext => ({
    matchesTerm: (t) => opts.terms.has(t),
    matchesQualifier: (k, v) => {
      if (k === "status") return opts.status === v;
      if (k === "ledger") return opts.ledger === v;
      return false;
    },
  });

  const done = ctx({ status: "done", ledger: "tasks", terms: new Set(["warp", "leak"]) });
  const wip = ctx({ status: "wip", ledger: "goals", terms: new Set(["plan"]) });

  const ev = (q: string, c: EvalContext): boolean => evaluate(parseQuery(q) as QueryNode, c);

  it("evaluates qualifiers", () => {
    expect(ev("status:done", done)).toBe(true);
    expect(ev("status:done", wip)).toBe(false);
  });

  it("evaluates OR groups", () => {
    expect(ev("(status:done OR status:wip)", done)).toBe(true);
    expect(ev("(status:done OR status:wip)", wip)).toBe(true);
    expect(ev("status:blocked OR status:open", done)).toBe(false);
  });

  it("evaluates implicit AND of qualifier + term", () => {
    expect(ev("status:done warp", done)).toBe(true);
    expect(ev("status:done plan", done)).toBe(false); // term miss
    expect(ev("ledger:goals plan", wip)).toBe(true);
  });

  it("evaluates negation", () => {
    expect(ev("-status:wip", done)).toBe(true);
    expect(ev("NOT warp", done)).toBe(false);
    expect(ev("status:done -leak", done)).toBe(false); // has leak → negation fails
  });

  it("empty query matches nothing", () => {
    expect(ev("", done)).toBe(false);
  });
});
