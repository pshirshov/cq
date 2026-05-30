/**
 * goals-theme.test.ts — PLAN-D03.
 *
 * The Goals tab hardcoded the light-theme palette (violet accents, white/
 * near-white surfaces, near-black body text), which renders poorly on a dark
 * theme. It now sources theme-sensitive surfaces, borders, text, and accents
 * from the app's global.css `:root` variables.
 *
 * CSS-module class names are hashed and happy-dom does not apply external
 * stylesheets, so the most robust assertion is over the CSS SOURCE: the
 * theme-sensitive light-palette hexes are gone (as bare values) and the
 * theme-variable references are present. The companion render check lives in
 * goals-tab.test.ts (the tab mounts).
 */

import { describe, test, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const cssPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../src/styles/Goals.module.css",
);
const css = readFileSync(cssPath, "utf8");

/** Strip the literal fallbacks inside `var(--x, #hex)` so we only inspect the
 *  values the stylesheet actually APPLIES as bare colours. Also strip the
 *  `.status*` chip rules: those encode goal STATUS (clarifying/planning/done/…)
 *  as semantic pastels, not theme surface, and intentionally stay literal —
 *  the same convention the History tab uses. */
const cssNoFallbacks = css
  .replace(/var\([^)]*\)/g, "VAR")
  .replace(/\.status\w+\s*\{[^}]*\}/g, "");

describe("PLAN-D03 — Goals tab theming uses CSS variables, not hardcoded light hexes", () => {
  test("the light-theme VIOLET accents are no longer applied as bare values", () => {
    for (const violet of ["#7c3aed", "#4c1d95", "#5b21b6", "#ddd6fe"]) {
      expect(cssNoFallbacks.includes(violet)).toBe(false);
    }
  });

  test("the white / near-white SURFACE fills are no longer applied as bare values", () => {
    for (const surface of ["#faf5ff", "#f5f3ff", "#ede9fe", "#f6f8fa"]) {
      expect(cssNoFallbacks.includes(surface)).toBe(false);
    }
  });

  test("near-black body text (#1c1b1f) is no longer applied as a bare value", () => {
    expect(cssNoFallbacks.includes("#1c1b1f")).toBe(false);
  });

  test("theme variables ARE referenced for surface/text/border/accent", () => {
    for (const v of [
      "var(--bg",
      "var(--surface",
      "var(--border",
      "var(--text-primary",
      "var(--text-secondary",
      "var(--accent",
    ]) {
      expect(css.includes(v)).toBe(true);
    }
  });

  test("question + option text is bumped to a legible size (>= 0.875rem)", () => {
    // .questionText and .chip carry the question/option text the user found
    // too small; both must now be at least the readable AskCard/Chat size.
    const questionTextSize = /\.questionText\s*\{[^}]*font-size:\s*([0-9.]+)rem/m.exec(css);
    const chipSize = /\.chip\s*\{[^}]*font-size:\s*([0-9.]+)rem/m.exec(css);
    expect(questionTextSize).not.toBeNull();
    expect(chipSize).not.toBeNull();
    expect(Number(questionTextSize![1])).toBeGreaterThanOrEqual(0.875);
    expect(Number(chipSize![1])).toBeGreaterThanOrEqual(0.875);
  });
});

describe("PLAN-D02 — Goals scroll container is a bounded flex child", () => {
  test(".wrapper uses flex + min-height:0 so overflow:auto engages", () => {
    const wrapper = /\.wrapper\s*\{([^}]*)\}/m.exec(css);
    expect(wrapper).not.toBeNull();
    const body = wrapper![1]!;
    expect(/flex:\s*1/.test(body)).toBe(true);
    expect(/min-height:\s*0/.test(body)).toBe(true);
    expect(/overflow:\s*auto/.test(body)).toBe(true);
  });
});
