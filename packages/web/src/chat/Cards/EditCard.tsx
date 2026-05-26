/**
 * EditCard.tsx — renders a tool_use block for the Edit tool.
 *
 * Shows: file_path (in header), hand-rolled line-diff of old_string → new_string.
 * Additions are green, deletions are red, unchanged lines are plain.
 */

import { lineDiff } from "./diffLine";
import styles from "../../styles/Cards.module.css";

export interface EditInput {
  file_path?: string;
  old_string?: string;
  new_string?: string;
  replace_all?: boolean;
  [key: string]: unknown;
}

export interface EditCardProps {
  input: EditInput;
  /** Raw tool_result content, if available. */
  resultContent?: unknown;
}

export function EditCard({ input }: EditCardProps): React.ReactElement {
  const filePath = input.file_path ?? "(unknown path)";
  const before = input.old_string ?? "";
  const after = input.new_string ?? "";
  const entries = lineDiff(before, after);

  return (
    <div className={styles.card} data-testid="edit-card">
      <div className={styles.header}>
        <span className={styles.toolName}>Edit</span>
        <span>{filePath}</span>
        {input.replace_all === true && <span>replace_all</span>}
      </div>
      <div className={styles.body}>
        <div className={styles.diff} data-testid="edit-diff">
          {entries.map((entry, idx) => {
            const rowClass =
              entry.type === "add"
                ? styles.diffAdd
                : entry.type === "del"
                  ? styles.diffDel
                  : styles.diffEq;
            const sign = entry.type === "add" ? "+" : entry.type === "del" ? "-" : " ";
            return (
              <div key={idx} className={`${styles.diffRow} ${rowClass}`} data-diff-type={entry.type}>
                <span className={styles.diffLineNo}>{entry.lineNo}</span>
                <span className={styles.diffSign}>{sign}</span>
                <span className={styles.diffText}>{entry.text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
