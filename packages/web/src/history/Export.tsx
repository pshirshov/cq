/**
 * Export.tsx — "Copy as Markdown" + "Download as JSON" buttons for the
 * history Detail view (PR-46).
 *
 * Props:
 *   events  — the ChatEvent[] streamed by Detail.
 *   header  — HeaderInfo derived from the HistoryRowFull row.
 */

import type { ChatEvent } from "@cq/shared";
import { toMarkdown, toJson } from "./exportFormats";
import type { HeaderInfo } from "./exportFormats";
import styles from "../styles/History.module.css";

export type { HeaderInfo };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ExportProps {
  events: ChatEvent[];
  header: HeaderInfo;
}

export function Export({ events, header }: ExportProps): React.ReactElement {
  function handleCopyMarkdown(): void {
    const md = toMarkdown(events, header);
    void navigator.clipboard.writeText(md);
  }

  function handleDownloadJson(): void {
    const json = toJson(events, header);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invocation-${header.invocationId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <span className={styles.exportActions} data-testid="export-actions">
      <button
        className={styles.exportBtn}
        onClick={handleCopyMarkdown}
        data-testid="export-copy-md"
        title="Copy transcript as Markdown"
      >
        Copy as Markdown
      </button>
      <button
        className={styles.exportBtn}
        onClick={handleDownloadJson}
        data-testid="export-download-json"
        title="Download transcript as JSON"
      >
        Download as JSON
      </button>
    </span>
  );
}
