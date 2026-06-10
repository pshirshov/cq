/**
 * Unit tests for the tool-name prefix helpers: assertToolPrefix,
 * prefixToolName, prefixedToolNames (T373).
 */

import { describe, it, expect } from "bun:test";
import {
  LEDGER_TOOL_NAMES,
  assertToolPrefix,
  prefixToolName,
  prefixedToolNames,
} from "../src/index.js";

const SAFE_ID_RE = /^[a-zA-Z0-9_-]+$/;

describe("assertToolPrefix", () => {
  it("accepts the empty string", () => {
    expect(() => assertToolPrefix("")).not.toThrow();
  });

  it("accepts a plain alphanumeric prefix", () => {
    expect(() => assertToolPrefix("myproj")).not.toThrow();
    expect(() => assertToolPrefix("myproj2")).not.toThrow();
    expect(() => assertToolPrefix("ABC")).not.toThrow();
    expect(() => assertToolPrefix("a")).not.toThrow();
  });

  it("throws for a prefix containing an underscore", () => {
    expect(() => assertToolPrefix("a_b")).toThrow();
  });

  it("throws for a prefix containing a hyphen", () => {
    expect(() => assertToolPrefix("a-b")).toThrow();
  });

  it("throws for a prefix containing a space", () => {
    expect(() => assertToolPrefix("a b")).toThrow();
  });

  it("throws for a prefix containing a dot", () => {
    expect(() => assertToolPrefix("a.b")).toThrow();
  });
});

describe("prefixedToolNames", () => {
  it("with '' returns a copy equal to LEDGER_TOOL_NAMES", () => {
    const result = prefixedToolNames("");
    expect(result).toEqual([...LEDGER_TOOL_NAMES]);
  });

  it("with '' returns a NEW array (not the same reference)", () => {
    const result = prefixedToolNames("");
    // Should be a different array object (a copy), not the original tuple
    expect(result).not.toBe(LEDGER_TOOL_NAMES);
  });

  it("with 'myproj' returns prefixed names", () => {
    const result = prefixedToolNames("myproj");
    const expected = LEDGER_TOOL_NAMES.map((n) => `myproj_${n}`);
    expect(result).toEqual(expected);
  });

  it("every element from prefixedToolNames('myproj') matches the safeId charset", () => {
    const result = prefixedToolNames("myproj");
    for (const name of result) {
      expect(name).toMatch(SAFE_ID_RE);
    }
  });

  it("throws for an invalid prefix", () => {
    expect(() => prefixedToolNames("a_b")).toThrow();
    expect(() => prefixedToolNames("a b")).toThrow();
  });
});

describe("prefixToolName", () => {
  it("with '' returns the name unchanged", () => {
    expect(prefixToolName("", "fetch_item")).toBe("fetch_item");
  });

  it("with a prefix returns '<prefix>_<name>'", () => {
    expect(prefixToolName("myproj", "fetch_item")).toBe("myproj_fetch_item");
  });

  it("throws for an invalid prefix", () => {
    expect(() => prefixToolName("a.b", "fetch_item")).toThrow();
  });
});

describe("import from @cq/ledger", () => {
  it("prefixedToolNames is importable from @cq/ledger", () => {
    expect(typeof prefixedToolNames).toBe("function");
  });
});
