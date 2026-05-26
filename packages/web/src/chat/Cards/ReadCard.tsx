/**
 * ReadCard.tsx — renders a tool_use block for the Read tool.
 *
 * Shows: file_path (in header), optional snippet from tool_result content.
 */

import styles from "../../styles/Cards.module.css";

export interface ReadInput {
  file_path?: string;
  offset?: number;
  limit?: number;
  [key: string]: unknown;
}

export interface ReadCardProps {
  input: ReadInput;
  /** Raw tool_result content, if available. Array of content blocks or a string. */
  resultContent?: unknown;
}

function extractResultText(content: unknown): string {
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

export function ReadCard({ input, resultContent }: ReadCardProps): React.ReactElement {
  const filePath = input.file_path ?? "(unknown path)";
  const snippet = extractResultText(resultContent);

  return (
    <div className={styles.card} data-testid="read-card">
      <div className={styles.header}>
        <span className={styles.toolName}>Read</span>
        <span>{filePath}</span>
        {input.offset !== undefined && (
          <span>offset={input.offset}</span>
        )}
        {input.limit !== undefined && (
          <span>limit={input.limit}</span>
        )}
      </div>
      {snippet !== "" && (
        <div className={styles.body}>
          <pre className={styles.pre}>{snippet}</pre>
        </div>
      )}
    </div>
  );
}
