/**
 * theme.test.ts — DARK-01 theme controller.
 *
 * Verifies the light/dark/auto resolution mechanism:
 *   - persists/reads the mode from localStorage `cq.theme`
 *   - `auto` resolves via an injected matchMedia mock (dark when OS dark,
 *     light otherwise) and sets documentElement.dataset.theme
 *   - re-resolves live on an OS-scheme change event while mode === 'auto'
 *   - explicit `light`/`dark` override the OS and ignore OS-change events
 *
 * The controller's matchMedia dependency is injected (MediaQueryListLike), so
 * these tests do not rely on happy-dom implementing window.matchMedia.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, test, expect, beforeEach } from "bun:test";
import {
  createThemeController,
  readThemeMode,
  writeThemeMode,
  resolveTheme,
  THEME_STORAGE_KEY,
  DEFAULT_THEME_MODE,
  type MediaQueryListLike,
} from "../src/lib/theme";

/** A controllable MediaQueryList mock: flip `matches` then `emit()` a change. */
function makeMql(initialMatches: boolean): MediaQueryListLike & { emit(matches: boolean): void } {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  return {
    matches: initialMatches,
    addEventListener(_type, listener) { listeners.add(listener); },
    removeEventListener(_type, listener) { listeners.delete(listener); },
    emit(matches: boolean) {
      this.matches = matches;
      for (const l of listeners) l({ matches });
    },
  };
}

beforeEach(() => {
  localStorage.removeItem(THEME_STORAGE_KEY);
  delete document.documentElement.dataset.theme;
});

describe("theme controller", () => {
  test("readThemeMode defaults to auto when key missing", () => {
    expect(readThemeMode()).toBe(DEFAULT_THEME_MODE);
    expect(DEFAULT_THEME_MODE).toBe("auto");
  });

  test("writeThemeMode/readThemeMode round-trip the persisted mode", () => {
    writeThemeMode("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(readThemeMode()).toBe("dark");
  });

  test("readThemeMode rejects an invalid stored value, falling back to default", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "neon");
    expect(readThemeMode()).toBe(DEFAULT_THEME_MODE);
  });

  test("resolveTheme: explicit modes ignore the OS; auto follows it", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
    expect(resolveTheme("auto", true)).toBe("dark");
    expect(resolveTheme("auto", false)).toBe("light");
  });

  test("auto resolves to dark when OS is dark and sets dataset.theme", () => {
    writeThemeMode("auto");
    const mql = makeMql(true); // OS dark
    const c = createThemeController({ mql });
    expect(c.getResolved()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    c.dispose();
  });

  test("auto resolves to light when OS is light", () => {
    writeThemeMode("auto");
    const mql = makeMql(false); // OS light
    const c = createThemeController({ mql });
    expect(c.getResolved()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    c.dispose();
  });

  test("auto re-resolves LIVE on an OS-scheme change event", () => {
    writeThemeMode("auto");
    const mql = makeMql(false);
    const c = createThemeController({ mql });
    expect(document.documentElement.dataset.theme).toBe("light");

    mql.emit(true); // OS flips to dark
    expect(c.getResolved()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    mql.emit(false); // OS flips back to light
    expect(document.documentElement.dataset.theme).toBe("light");
    c.dispose();
  });

  test("explicit dark overrides the OS and ignores OS-change events", () => {
    writeThemeMode("dark");
    const mql = makeMql(false); // OS light
    const c = createThemeController({ mql });
    expect(c.getResolved()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    mql.emit(true);  // OS change must NOT alter an explicit mode
    expect(document.documentElement.dataset.theme).toBe("dark");
    mql.emit(false);
    expect(document.documentElement.dataset.theme).toBe("dark");
    c.dispose();
  });

  test("setMode applies live + persists, and switching to auto re-reads the OS", () => {
    writeThemeMode("light");
    const mql = makeMql(true); // OS dark
    const c = createThemeController({ mql });
    expect(document.documentElement.dataset.theme).toBe("light");

    c.setMode("dark");
    expect(c.getMode()).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    c.setMode("auto"); // auto + OS dark → dark
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("auto");
    expect(document.documentElement.dataset.theme).toBe("dark");

    // After switching to auto, OS changes apply again.
    mql.emit(false);
    expect(document.documentElement.dataset.theme).toBe("light");
    c.dispose();
  });

  test("dispose detaches the OS listener (no further live updates)", () => {
    writeThemeMode("auto");
    const mql = makeMql(false);
    const c = createThemeController({ mql });
    c.dispose();
    mql.emit(true); // listener gone → dataset stays at the last applied value
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
