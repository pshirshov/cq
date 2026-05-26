/**
 * WebCard.tsx — renders tool_use blocks for WebFetch and WebSearch tools.
 *
 * WebFetch: header shows URL; body shows a truncated snippet of the fetched content.
 * WebSearch: header shows query; body shows a truncated snippet of the search results.
 */

import styles from "../../styles/WebCard.module.css";

export interface WebFetchInput {
  url?: string;
  [key: string]: unknown;
}

export interface WebSearchInput {
  query?: string;
  [key: string]: unknown;
}

export interface WebCardProps {
  toolName: "WebFetch" | "WebSearch";
  input: WebFetchInput | WebSearchInput;
  /** Raw tool_result content, if available. */
  resultContent?: unknown;
}

const SNIPPET_MAX_CHARS = 400;

/** Extract plain text from result content (string or array of text blocks). */
function extractText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (
        block !== null &&
        typeof block === "object" &&
        (block as Record<string, unknown>)["type"] === "text" &&
        typeof (block as Record<string, unknown>)["text"] === "string"
      ) {
        parts.push((block as Record<string, unknown>)["text"] as string);
      }
    }
    return parts.join("");
  }
  return "";
}

/** Truncate text to at most `max` characters, appending ellipsis if cut. */
function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

export function WebCard({ toolName, input, resultContent }: WebCardProps): React.ReactElement {
  const label =
    toolName === "WebFetch"
      ? ((input as WebFetchInput).url ?? "(no URL)")
      : ((input as WebSearchInput).query ?? "(no query)");

  const subLabel = toolName === "WebFetch" ? "url" : "query";
  const fullText = extractText(resultContent);
  const snippet = truncate(fullText.trim(), SNIPPET_MAX_CHARS);

  return (
    <div className={styles.card} data-testid="web-card">
      <div className={styles.header}>
        <span className={styles.toolName}>{toolName}</span>
        <span className={styles.subLabel}>{subLabel}</span>
        <span className={styles.target} data-testid="web-target">{label}</span>
      </div>
      {snippet !== "" && (
        <div className={styles.body}>
          <pre className={styles.snippet} data-testid="web-snippet">{snippet}</pre>
        </div>
      )}
    </div>
  );
}
