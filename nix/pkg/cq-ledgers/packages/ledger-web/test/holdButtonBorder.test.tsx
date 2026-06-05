/**
 * T2: orange border on hold-to-confirm HoldButton.
 *
 * Verifies that the `.lw-holdbtn` rule in styles.css carries an orange
 * border-color (#e0a341) as per Q1 recommendation. The rule applies only
 * to the hold-gesture variant (requireHold=true), not the single-click
 * escape hatch (requireHold=false).
 */

import { describe, it, expect } from "bun:test";
import { readFileSync } from "fs";
import { join, dirname } from "path";

const stylesPath = join(
  dirname(import.meta.url.replace("file://", "")),
  "../src/styles.css",
);
const css = readFileSync(stylesPath, "utf-8");

/** Extract the body of the first rule matching `selector` from a CSS string. */
function ruleBody(selector: string): string | null {
  // Match the first `selector { … }` block (non-greedy, stops at first `}`).
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped + "\\s*\\{([^}]*)\\}");
  const m = css.match(re);
  return m ? (m[1] ?? null) : null;
}

describe("T2 — .lw-holdbtn orange border (Q1)", () => {
  it(".lw-holdbtn rule exists in styles.css", () => {
    expect(ruleBody(".lw-holdbtn")).not.toBeNull();
  });

  it(".lw-holdbtn has orange border-color (#e0a341)", () => {
    const body = ruleBody(".lw-holdbtn")!;
    expect(body).toContain("border-color: #e0a341");
  });
});
