/**
 * Unit tests for parseFieldValue: string[] splits on semicolons/newlines,
 * id[] splits on commas (unchanged).
 */

import { describe, it, expect } from "bun:test";
import { parseFieldValue } from "../src/App";

describe("ledger-web parseFieldValue", () => {
  it("string[]: splits on semicolons", () => {
    expect(parseFieldValue("a; b; c", "string[]")).toEqual(["a", "b", "c"]);
  });

  it("string[]: splits on newlines", () => {
    expect(parseFieldValue("a\nb", "string[]")).toEqual(["a", "b"]);
  });

  it("string[]: trims whitespace around each element", () => {
    expect(parseFieldValue("  foo ;  bar  ", "string[]")).toEqual(["foo", "bar"]);
  });

  it("string[]: drops empty elements", () => {
    expect(parseFieldValue("a;; b", "string[]")).toEqual(["a", "b"]);
  });

  it("string[]: handles mixed semicolons and newlines", () => {
    expect(parseFieldValue("a\nb; c", "string[]")).toEqual(["a", "b", "c"]);
  });

  it("id[]: splits on commas (unchanged)", () => {
    expect(parseFieldValue("T1, T2", "id[]")).toEqual(["T1", "T2"]);
  });

  it("id[]: trims whitespace", () => {
    expect(parseFieldValue("  T1 ,  T2  ", "id[]")).toEqual(["T1", "T2"]);
  });

  it("id[]: drops empty elements", () => {
    expect(parseFieldValue("T1,,T2", "id[]")).toEqual(["T1", "T2"]);
  });

  it("string type: returns raw string unchanged", () => {
    expect(parseFieldValue("hello world", "string")).toBe("hello world");
  });
});
