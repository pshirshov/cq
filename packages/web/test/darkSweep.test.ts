/**
 * darkSweep.test.ts — DARK-01 CSS sweep + light-unchanged invariants.
 *
 * These tests scan the committed CSS sources (no DOM) and assert the
 * structural guarantees of the dark theme:
 *
 *   1. global.css defines a `:root` (light) block and a `[data-theme="dark"]`
 *      block, and EVERY variable defined in `:root` has a dark override
 *      (full parity) — so no theme variable is left at its light value in
 *      dark mode.
 *
 *   2. LIGHT-UNCHANGED: every `var(--X, <fallback>)` used by a swept module
 *      has a fallback whose value equals the `:root` value of `--X`. Because
 *      `--X` is always defined, the resolved LIGHT color is the `:root`
 *      value; asserting fallback == :root value guarantees the swept rule
 *      renders the exact same light color it referenced as a literal before
 *      the sweep (light is visually neutral, proven by value not by eye).
 *
 *   3. SWEEP COMPLETENESS: the theme-sensitive CONTENT modules (everything
 *      except the documented always-dark chrome exceptions) do not hardcode
 *      the known light surface/text/border hexes on theme-sensitive
 *      properties — those colors must go through `var(--…)`.
 *
 * Exceptions are explicit and listed below, matching the sweep's design:
 * Header/Tooltip/Toast/SettingsPopup are intentional always-dark chrome;
 * Indicator carries semantic connection-state colors; a handful of literals
 * inside otherwise-swept files (History .resumeButton dark button, the
 * ElicitationCard translucent focus glow) are theme-neutral by design.
 */

import { describe, test, expect } from "bun:test";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const STYLES_DIR = join(dirname(fileURLToPath(import.meta.url)), "../src/styles");

/** Modules that are intentionally NOT swept (always-dark chrome / semantic). */
const EXCEPTION_FILES = new Set([
  "Header.module.css",   // always-dark VS-Code-style header bar
  "Tooltip.module.css",  // always-dark Catppuccin overlay panel
  "Toast.module.css",    // always-dark toast notifications
  "SettingsPopup.module.css", // always-dark gear popup chrome
  "Indicator.module.css", // semantic connection-state dot colors
]);

function readGlobal(): string {
  return readFileSync(join(STYLES_DIR, "global.css"), "utf8");
}

/** Extract `--name: value;` pairs from the first matching block body. */
function parseBlock(css: string, selectorRe: RegExp): Record<string, string> {
  const m = css.match(selectorRe);
  if (!m) throw new Error(`block not found for ${selectorRe}`);
  const body = m[1]!;
  const out: Record<string, string> = {};
  for (const v of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[v[1]!] = v[2]!.trim();
  }
  return out;
}

/** Normalize a color literal: lowercase, expand #abc → #aabbcc, strip ws. */
function normColor(c: string): string {
  const s = c.toLowerCase().trim();
  const short = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return "#" + short.slice(1).map((ch) => ch + ch).join("");
  return s.replace(/\s+/g, "");
}

describe("DARK-01 — global.css variable parity", () => {
  test(":root and [data-theme=dark] both exist", () => {
    const css = readGlobal();
    expect(/:root\s*\{/.test(css)).toBe(true);
    expect(/\[data-theme="dark"\]\s*\{/.test(css)).toBe(true);
  });

  test("every :root theme variable has a [data-theme=dark] override", () => {
    const css = readGlobal();
    const light = parseBlock(css, /:root\s*\{([\s\S]*?)\n\}/);
    const dark = parseBlock(css, /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
    const lightVars = Object.keys(light);
    const darkVars = new Set(Object.keys(dark));
    const missing = lightVars.filter((v) => !darkVars.has(v));
    expect(missing).toEqual([]);
    // sanity: there is a non-trivial variable set
    expect(lightVars.length).toBeGreaterThan(40);
  });

  test("dark --bg differs from light --bg (the theme actually changes the surface)", () => {
    const css = readGlobal();
    const light = parseBlock(css, /:root\s*\{([\s\S]*?)\n\}/);
    const dark = parseBlock(css, /\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/);
    expect(normColor(light["--bg"]!)).not.toBe(normColor(dark["--bg"]!));
    expect(normColor(light["--text-primary"]!)).not.toBe(normColor(dark["--text-primary"]!));
  });
});

describe("DARK-01 — light is unchanged (fallback == :root value)", () => {
  // Pre-existing inert fallbacks present in the baseline (eff0ca5) BEFORE the
  // sweep. Their fallback literal differs from the canonical `:root` token, but
  // because the variable is always defined the RESOLVED light color is the
  // `:root` value — these were already resolving that way before this work, so
  // they are not a sweep regression. Allow-listed so the test asserts the
  // precise invariant: the sweep introduced NO new light-shifting fallback.
  const PREEXISTING_MISMATCH = new Set([
    "--text-secondary|#888888",
    "--text-secondary|#444444",
    "--text-secondary|#555555",
    "--text-secondary|#999999",
    "--text-secondary|#aaaaaa",
    "--border|#cccccc",
    "--hover|#f7f7f7",
    "--hover|#fee2e2",
    "--accent|#7c3aed",
  ]);

  test("every module var(--X, <color-fallback>) fallback equals :root[--X] (modulo pre-existing inert fallbacks)", () => {
    const css = readGlobal();
    const light = parseBlock(css, /:root\s*\{([\s\S]*?)\n\}/);

    const offenders: string[] = [];
    for (const file of readdirSync(STYLES_DIR)) {
      if (!file.endsWith(".module.css")) continue;
      const body = readFileSync(join(STYLES_DIR, file), "utf8");
      for (const m of body.matchAll(
        /var\(\s*(--[a-z0-9-]+)\s*,\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*\)/g,
      )) {
        const name = m[1]!;
        const fb = m[2]!;
        // A theme var referenced by a module must be defined in :root.
        if (!(name in light)) {
          offenders.push(`${file}: var(${name}) is not defined in :root`);
          continue;
        }
        if (normColor(light[name]!) !== normColor(fb)) {
          if (PREEXISTING_MISMATCH.has(`${name}|${normColor(fb)}`)) continue;
          offenders.push(
            `${file}: var(${name}, ${fb}) but :root ${name} = ${light[name]}`,
          );
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("DARK-01 — sweep completeness (content modules don't hardcode light surfaces)", () => {
  // Known LIGHT surface/text/border hexes that must not appear bare on a
  // theme-sensitive property in a content module.
  const FORBIDDEN_BARE = [
    "#ffffff", "#fafafa", "#f7f7f8", "#f6f8fa", "#d0d7de", "#24292f",
    "#57606a", "#e0e0e0", "#111111",
  ].map(normColor);

  // Within otherwise-swept files, a few literals are theme-neutral by design.
  const ALLOWED_LITERAL: Record<string, RegExp[]> = {
    // History: the .resumeButton is an intentional dark VS-Code-style button
    // on a light table (kept dark in both themes) + its focus ring.
    "History.module.css": [/#2d2d2d/, /#d4d4d4/, /#555/, /#3a3a3a/, /#0e639c/],
    // ElicitationCard: translucent accent focus-glow, theme-neutral.
    "ElicitationCard.module.css": [/rgba\(5,\s*80,\s*174/],
  };

  test("no content module hardcodes a known light surface/text/border hex", () => {
    const offenders: string[] = [];
    for (const file of readdirSync(STYLES_DIR)) {
      if (!file.endsWith(".module.css")) continue;
      if (EXCEPTION_FILES.has(file)) continue;
      const lines = readFileSync(join(STYLES_DIR, file), "utf8").split("\n");
      const allowed = ALLOWED_LITERAL[file] ?? [];
      lines.forEach((line, i) => {
        // Strip the var(--x, #fb) fallbacks — those are inert + already audited.
        const stripped = line.replace(
          /var\(\s*--[a-z0-9-]+\s*,\s*(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\s*\)/g,
          "var()",
        );
        for (const hex of stripped.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
          const norm = normColor(hex[0]);
          if (!FORBIDDEN_BARE.includes(norm)) continue;
          if (allowed.some((re) => re.test(hex[0]))) continue;
          offenders.push(`${file}:${i + 1}: bare ${hex[0]} — ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
