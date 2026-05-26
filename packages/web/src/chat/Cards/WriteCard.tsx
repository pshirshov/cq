/**
 * WriteCard.tsx — renders a tool_use block for the Write tool.
 *
 * Shows: file_path (in header), content preview (first 500 chars), result.
 */

import styles from "../../styles/Cards.module.css";

export interface WriteInput {
  file_path?: string;
  content?: string;
  [key: string]: unknown;
}

export interface WriteCardProps {
  input: WriteInput;
  /** Raw tool_result content, if available. */
  resultContent?: unknown;
}

const PREVIEW_MAX = 500;

function resultText(content: unknown): string {
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

export function WriteCard({ input, resultContent }: WriteCardProps): React.ReactElement {
  const filePath = input.file_path ?? "(unknown path)";
  const content = input.content ?? "";
  const preview = content.length > PREVIEW_MAX ? content.slice(0, PREVIEW_MAX) + "…" : content;
  const result = resultText(resultContent);

  return (
    <div className={styles.card} data-testid="write-card">
      <div className={styles.header}>
        <span className={styles.toolName}>Write</span>
        <span>{filePath}</span>
        <span>{content.length} bytes</span>
      </div>
      <div className={styles.body}>
        {preview !== "" && (
          <div className={styles.section}>
            <div className={styles.label}>content preview</div>
            <pre className={styles.pre}>{preview}</pre>
          </div>
        )}
        {result !== "" && (
          <div className={styles.section}>
            <div className={styles.label}>result</div>
            <pre className={styles.pre}>{result}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
