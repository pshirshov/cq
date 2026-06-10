/**
 * Render a markdown string to sanitized HTML.
 *
 * Field values are arbitrary user/agent content, so output is sanitized with
 * rehype-sanitize (default schema — no raw HTML, safe URLs only). GFM enables
 * tables, task lists, strikethrough, and autolinks.
 *
 * JSON fenced code blocks are pretty-printed and colorized via a small
 * hand-rolled tokenizer. On any parse failure the raw text is rendered as-is.
 */

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";

// ---------------------------------------------------------------------------
// JSON tokenizer — emits React spans with lw-json-* classes
// ---------------------------------------------------------------------------

type Token =
  | { type: "key"; value: string }
  | { type: "string"; value: string }
  | { type: "number"; value: string }
  | { type: "bool"; value: string }
  | { type: "null"; value: string }
  | { type: "punct"; value: string };

/** Tokenize a pretty-printed JSON string into typed tokens. */
function tokenizeJson(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    // Whitespace — pass through as punct so the structure is preserved
    const wsMatch = /^\s+/.exec(src.slice(i));
    if (wsMatch) {
      tokens.push({ type: "punct", value: wsMatch[0] });
      i += wsMatch[0].length;
      continue;
    }

    // String — may be a key or a value; we'll decide after we consume it
    if (src[i] === '"') {
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === "\\") {
          j += 2;
        } else if (src[j] === '"') {
          j++;
          break;
        } else {
          j++;
        }
      }
      const raw = src.slice(i, j);
      // After optional whitespace, a colon means this is a key
      const after = src.slice(j).trimStart();
      const kind: "key" | "string" = after.startsWith(":") ? "key" : "string";
      tokens.push({ type: kind, value: raw });
      i = j;
      continue;
    }

    // Number
    const numMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (numMatch) {
      tokens.push({ type: "number", value: numMatch[0] });
      i += numMatch[0].length;
      continue;
    }

    // true / false / null
    if (src.startsWith("true", i)) {
      tokens.push({ type: "bool", value: "true" });
      i += 4;
      continue;
    }
    if (src.startsWith("false", i)) {
      tokens.push({ type: "bool", value: "false" });
      i += 5;
      continue;
    }
    if (src.startsWith("null", i)) {
      tokens.push({ type: "null", value: "null" });
      i += 4;
      continue;
    }

    // Punctuation: { } [ ] : ,
    tokens.push({ type: "punct", value: src[i]! });
    i++;
  }

  return tokens;
}

/** Convert a token array to an array of React nodes (spans + plain text). */
function renderTokens(tokens: Token[]): React.ReactNode[] {
  return tokens.map((tok, idx) => {
    if (tok.type === "punct") {
      // Whitespace-only punct — render as text for correct newlines/indents
      return tok.value;
    }
    return React.createElement("span", { key: idx, className: `lw-json-${tok.type}` }, tok.value);
  });
}

/** Pretty-print + colorize a JSON string. Returns null on parse failure. */
function renderJson(raw: string): React.ReactElement | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const pretty = JSON.stringify(parsed, null, 2);
  const tokens = tokenizeJson(pretty);
  // Return just <code> — react-markdown supplies the outer <pre>
  return React.createElement("code", { className: "lw-json-code" }, ...renderTokens(tokens));
}

// ---------------------------------------------------------------------------
// Custom code component for react-markdown
// ---------------------------------------------------------------------------

interface CodeProps extends React.HTMLAttributes<HTMLElement> {
  className?: string | undefined;
  children?: React.ReactNode | undefined;
}

function CodeBlock({ className, children, ...rest }: CodeProps): React.ReactElement {
  const isLanguage = typeof className === "string" && className.startsWith("language-");
  const isJsonLang = isLanguage && className!.includes("language-json");

  if (isLanguage) {
    // Fenced block — extract raw text from children
    const rawText = String(
      typeof children === "string"
        ? children
        : Array.isArray(children)
          ? (children as React.ReactNode[]).map((c) => String(c)).join("")
          : children ?? ""
    ).replace(/\n$/, ""); // react-markdown appends a trailing newline

    if (isJsonLang) {
      // Try to auto-detect + pretty-print
      const rendered = renderJson(rawText);
      if (rendered !== null) return rendered;
      // Fallback: invalid JSON — render raw unchanged
    }

    // Non-json fence OR invalid-json fallback: return bare <code> so
    // react-markdown's own <pre> is the sole block wrapper (no nesting).
    return React.createElement("code", { className, ...rest }, children);
  }

  // Inline code — render as-is
  return React.createElement("code", { className, ...rest }, children);
}

// ---------------------------------------------------------------------------
// Exported component
// ---------------------------------------------------------------------------

const MD_COMPONENTS = { code: CodeBlock } as const;

export function Markdown({ text }: { text: string }): React.ReactElement {
  return (
    <div className="lw-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={MD_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
