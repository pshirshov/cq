/**
 * D11: sticky toolbar CSS assertion.
 *
 * Verifies that .lw-toolbar in styles.css carries position:sticky with top:-8px
 * (offsets the 8px top-padding of .lw-main so content does not peek above the
 * bar while scrolling), an opaque background, and a z-index below the
 * column-selector popup (z-index:10).
 *
 * Actual scroll behaviour is not observable under happy-dom, so we assert the
 * CSS rule directly by parsing styles.css.
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

describe("D11 — .lw-toolbar sticky positioning (T107)", () => {
  it(".lw-toolbar rule exists in styles.css", () => {
    expect(ruleBody(".lw-toolbar")).not.toBeNull();
  });

  it(".lw-toolbar has position: sticky", () => {
    const body = ruleBody(".lw-toolbar")!;
    expect(body).toContain("position: sticky");
  });

  it(".lw-toolbar top offsets the .lw-main padding (top: -8px)", () => {
    const body = ruleBody(".lw-toolbar")!;
    expect(body).toContain("top: -8px");
  });

  it(".lw-toolbar z-index is below .lw-column-popup (z-index: 10)", () => {
    const body = ruleBody(".lw-toolbar")!;
    // Extract numeric z-index value and confirm it is less than 10.
    const m = body.match(/z-index:\s*(\d+)/);
    expect(m).not.toBeNull();
    const zIndex = parseInt(m![1]!, 10);
    expect(zIndex).toBeLessThan(10);
  });

  it(".lw-toolbar has an opaque background (background property set)", () => {
    const body = ruleBody(".lw-toolbar")!;
    expect(body).toMatch(/background:/);
  });
});
