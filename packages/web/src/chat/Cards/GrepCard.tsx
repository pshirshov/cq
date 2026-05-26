/**
 * GrepCard.tsx — renders tool_use blocks for the Grep and Glob tools.
 *
 * Header: tool name + pattern (or glob path).
 * Body: match count derived from tool_result content.
 * Collapsible <details> expands to show all hits.
 */

import styles from "../../styles/GrepCard.module.css";

export interface GrepInput {
  /** Grep: regex pattern. Glob: file-path pattern. */
  pattern?: string;
  path?: string;
  [key: string]: unknown;
}

export interface GrepCardProps {
  toolName: "Grep" | "Glob";
  input: GrepInput;
  /** Raw tool_result content, if available. */
  resultContent?: unknown;
}

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

/**
 * Count matches in the result text.
 * Grep output is typically one match per line; blank/empty lines are excluded.
 * Returns undefined when no result is available.
 */
function countMatches(text: string): number {
  if (text.trim() === "") return 0;
  return text.split("\n").filter((l) => l.trim() !== "").length;
}

export function GrepCard({ toolName, input, resultContent }: GrepCardProps): React.ReactElement {
  const pattern = input.pattern ?? input.path ?? "(no pattern)";
  const resultText = extractText(resultContent);
  const hasResult = resultContent !== undefined;
  const matchCount = hasResult ? countMatches(resultText) : undefined;

  return (
    <div className={styles.card} data-testid="grep-card">
      <div className={styles.header}>
        <span className={styles.toolName}>{toolName}</span>
        <code className={styles.pattern}>{pattern}</code>
        {matchCount !== undefined && (
          <span className={styles.count} data-testid="grep-match-count">
            {matchCount} {matchCount === 1 ? "hit" : "hits"}
          </span>
        )}
      </div>
      {hasResult && matchCount !== undefined && matchCount > 0 && (
        <details className={styles.details} data-testid="grep-details">
          <summary className={styles.summary}>
            Show {matchCount} {matchCount === 1 ? "hit" : "hits"}
          </summary>
          <pre className={styles.hits} data-testid="grep-hits">{resultText}</pre>
        </details>
      )}
      {hasResult && matchCount === 0 && (
        <div className={styles.empty}>No matches</div>
      )}
    </div>
  );
}
