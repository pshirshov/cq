/**
 * shiki.ts — singleton Shiki highlighter, shared across all CodeBlock renders.
 *
 * The 12 bundled languages are loaded eagerly; any other language is loaded on
 * demand by CodeBlock via `highlighter.loadLanguage(lang)`.
 *
 * `getHighlighter()` memoises the in-flight promise so concurrent renders that
 * call it before the first resolution share a single initialisation.
 */

import { getSingletonHighlighter, type Highlighter } from "shiki";

/**
 * The 12 languages bundled at startup (F-20 allow-list).
 * Names match Shiki's canonical language identifiers.
 */
export const BUNDLED_LANGS = [
  "typescript",
  "javascript",
  "python",
  "rust",
  "go",
  "bash",
  "json",
  "markdown",
  "yaml",
  "html",
  "css",
  "sql",
] as const satisfies readonly string[];

export type BundledLang = (typeof BUNDLED_LANGS)[number];

/** Aliases users may pass in the code-fence info string. */
const LANG_ALIASES: Readonly<Record<string, BundledLang>> = {
  ts: "typescript",
  js: "javascript",
  py: "python",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
};

/** Normalise a fence info-string to a bundled lang name if possible. */
export function normaliseLang(raw: string): string {
  const lower = raw.toLowerCase().trim();
  return LANG_ALIASES[lower] ?? lower;
}

/** Returns true when `lang` is in the bundled 12. */
export function isBundledLang(lang: string): lang is BundledLang {
  return (BUNDLED_LANGS as readonly string[]).includes(normaliseLang(lang));
}

let highlighterPromise: Promise<Highlighter> | null = null;

/** Returns the singleton Shiki highlighter, initialising it on first call. */
export function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getSingletonHighlighter({
      langs: [...BUNDLED_LANGS],
      themes: ["github-light", "github-dark"],
    });
  }
  return highlighterPromise;
}
