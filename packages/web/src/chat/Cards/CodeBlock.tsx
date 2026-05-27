/**
 * CodeBlock.tsx — syntax-highlighted code block card.
 *
 * Props:
 *   lang  — fence info string (e.g. "ts", "python", "elm").
 *   code  — raw source text to display.
 *
 * Rendering strategy:
 *   • If `lang` is in the 12-language allow-list (BUNDLED_LANGS), the Shiki
 *     singleton is already warm and the highlighted HTML is produced in the
 *     first effect pass.
 *   • If `lang` is unknown, the component renders raw <pre><code> immediately,
 *     then fires a `useEffect` that calls `highlighter.loadLanguage(lang)` and
 *     re-renders with the highlighted output.
 *
 * Header row:
 *   • Top-left: language label (the normalised identifier, or the raw string
 *     if unknown).
 *   • Top-right: "Copy" button that writes `code` to the clipboard and shows
 *     a transient "Copied!" indicator for ~1.5 s.
 *
 * dangerouslySetInnerHTML:
 *   Shiki returns fully-escaped HTML. No user-supplied string is injected
 *   verbatim — only the output of codeToHtml(), whose values are CSS colours
 *   and XML-entity-escaped source characters. DOMPurify would add a runtime
 *   dependency for zero security benefit here.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { getHighlighter, isBundledLang, normaliseLang } from "../../lib/shiki";
import styles from "../../styles/CodeBlock.module.css";

export interface CodeBlockProps {
  lang: string;
  code: string;
}

const COPY_FEEDBACK_MS = 1500;

export function CodeBlock({ lang, code }: CodeBlockProps): React.ReactElement {
  const normLang = normaliseLang(lang);

  // null  → not yet highlighted (show raw fallback)
  // string → highlighted HTML from Shiki
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function highlight(): Promise<void> {
      try {
        const hl = await getHighlighter();
        // If lang is not bundled, attempt to load it; skip if unsupported.
        if (!isBundledLang(lang)) {
          try {
            await hl.loadLanguage(normLang as Parameters<typeof hl.loadLanguage>[0]);
          } catch (err: unknown) {
            // eslint-disable-next-line no-console
            console.warn("CodeBlock: loadLanguage failed", { lang: normLang, err: err instanceof Error ? err.message : String(err) });
            return;
          }
        }
        const html = hl.codeToHtml(code, {
          lang: normLang,
          theme: "github-dark",
        });
        if (!cancelled) setHighlightedHtml(html);
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn("CodeBlock: codeToHtml failed", { lang: normLang, err: err instanceof Error ? err.message : String(err) });
      }
    }

    void highlight();

    return () => {
      cancelled = true;
    };
  }, [lang, code, normLang]);

  // Cleanup copy timer on unmount.
  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      if (copyTimerRef.current !== null) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        setCopied(false);
      }, COPY_FEEDBACK_MS);
    });
  }, [code]);

  const displayLang = normLang || lang;

  return (
    <div
      className={styles.container}
      data-testid={`code-block-${displayLang}`}
    >
      <div className={styles.header}>
        <span className={styles.lang} data-testid="code-block-lang">
          {displayLang}
        </span>
        <button
          type="button"
          className={`${styles.copyBtn}${copied ? ` ${styles.copied}` : ""}`}
          onClick={handleCopy}
          aria-label="Copy code to clipboard"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {highlightedHtml !== null ? (
        /* Shiki output is fully escaped HTML — no user strings are injected raw. */
        <div
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className={styles.pre}>
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
