/**
 * AttachmentList.tsx — displays pending attachments above the textarea.
 *
 * Each chip shows the filename, human-readable byte size, and an × button
 * to remove that attachment before sending.
 */

import styles from "../styles/AttachmentList.module.css";
import type { Attachment } from "../lib/attachment";

interface AttachmentListProps {
  attachments: Attachment[];
  onRemove: (index: number) => void;
}

function formatBytes(b64: string): string {
  // Approximate decoded byte size from base64 length.
  const bytes = Math.floor(b64.length * 3 / 4);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentList({ attachments, onRemove }: AttachmentListProps): React.ReactElement | null {
  if (attachments.length === 0) return null;
  return (
    <div className={styles.list}>
      {attachments.map((att, i) => (
        <div key={i} className={styles.chip}>
          <span className={styles.chipName} title={att.name}>{att.name}</span>
          <span className={styles.chipSize}>({formatBytes(att.dataBase64)})</span>
          <button
            className={styles.removeBtn}
            type="button"
            aria-label={`Remove ${att.name}`}
            onClick={() => onRemove(i)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
