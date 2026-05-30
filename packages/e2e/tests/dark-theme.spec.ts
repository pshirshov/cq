/**
 * dark-theme.spec.ts — DARK-01 e2e: theme toggle in the gear popup.
 *
 * Scenario:
 *   1. Open the page; wait for idle.
 *   2. Open the gear popup; set Theme = Dark.
 *   3. Assert <html data-theme="dark"> AND that a theme-following surface's
 *      computed background-color resolves to the DARK page background (not
 *      white) — proving the CSS sweep applies, not just the attribute.
 *   4. Set Theme = Light; assert <html data-theme="light"> and the surface
 *      background returns to the light value (white-ish, not the dark value).
 *   5. Assert the choice persisted to localStorage['cq.theme'].
 *
 * Auto/OS-dark resolution is covered in the unit test (theme.test.ts) via a
 * matchMedia mock — Playwright cannot easily drive the live OS scheme through
 * the same code path, so it is intentionally not asserted here.
 *
 * Project: `main` (per WFL-D02 ordering — this is neither a /plan workflow
 * spec nor stop.spec, so it runs after the `prelude` project).
 */

import { test, expect } from "../fixtures/base.ts";

/** Parse "rgb(r, g, b)" / "rgba(...)" → [r,g,b]. */
function parseRgb(s: string): [number, number, number] {
  const m = s.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) throw new Error(`not an rgb color: ${s}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Perceived luminance (0..255) — light surfaces are high, dark are low. */
function luminance([r, g, b]: [number, number, number]): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

test("dark-theme: gear popup Theme=Dark applies app-wide (attribute + computed surface), Light reverts", async ({ cq, page }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // The document body background follows var(--bg) — our canonical themed
  // surface. Sample its computed color across theme switches.
  const bodyBg = () =>
    page.evaluate(() => getComputedStyle(document.body).backgroundColor);

  const gearBtn = page.locator("[data-testid='settings-gear-btn']");
  await expect(gearBtn).toBeVisible({ timeout: 3_000 });

  // ----- 1. open popup, select Dark -----
  await gearBtn.click();
  const popup = page.locator("[data-testid='settings-popup']");
  await expect(popup).toBeVisible();

  const themeSelect = page.locator("[data-testid='theme-select']");
  await expect(themeSelect).toBeVisible();
  await themeSelect.selectOption("dark");

  // Attribute applied live.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark", { timeout: 3_000 });

  // Computed surface is actually dark (low luminance), not white.
  const darkBg = await bodyBg();
  const darkLum = luminance(parseRgb(darkBg));
  expect(darkLum).toBeLessThan(80); // dark --bg (#121212) ≈ luminance 18

  // localStorage persisted.
  expect(await page.evaluate(() => localStorage.getItem("cq.theme"))).toBe("dark");

  // ----- 2. switch to Light -----
  await themeSelect.selectOption("light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light", { timeout: 3_000 });

  const lightBg = await bodyBg();
  const lightLum = luminance(parseRgb(lightBg));
  expect(lightLum).toBeGreaterThan(200); // light --bg (#ffffff) ≈ luminance 255
  // and it is genuinely different from the dark value
  expect(lightLum).toBeGreaterThan(darkLum + 100);

  expect(await page.evaluate(() => localStorage.getItem("cq.theme"))).toBe("light");
});
