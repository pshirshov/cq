/**
 * FileRefAnchor.tsx — clickable anchor for file:line references in Markdown.
 *
 * Props:
 *   path   — file path string (e.g. "/etc/hosts")
 *   line   — line number (1-based)
 *
 * Behaviour:
 *   - Renders as a styled anchor with text "{path}:{line}".
 *   - On click, sends a chat.read_file_request via manager.send().
 *   - Listens for the matching chat.read_file_result (by requestId).
 *   - Expands inline to show the snippet (lines ± 5 around the target line).
 *   - On error, shows the error message instead of a snippet.
 *
 * The component subscribes to manager.onMessage() for the duration of the
 * pending request and cleans up on unmount.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useConnection } from "../ws/useConnection";
import type { ChatReadFileRequest, ChatReadFileResult } from "@cq/shared";
import styles from "../styles/FileRefAnchor.module.css";

export interface FileRefAnchorProps {
  path: string;
  line: number;
}

const CONTEXT_LINES = 5;

export function FileRefAnchor({ path, line }: FileRefAnchorProps): React.ReactElement {
  const manager = useConnection();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snippet, setSnippet] = useState<string | null>(null);
  const [startLine, setStartLine] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const seqRef = useRef(0);

  // unsubscribe ref so we can clean it up when result arrives or on unmount
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      if (unsubRef.current !== null) {
        unsubRef.current();
        unsubRef.current = null;
      }
    };
  }, []);

  const handleClick = useCallback(() => {
    if (expanded) {
      // Toggle off
      setExpanded(false);
      return;
    }
    if (snippet !== null || error !== null) {
      // Already fetched — just show
      setExpanded(true);
      return;
    }

    const requestId = manager.crypto.randomUUID();
    setLoading(true);

    // Subscribe to incoming server frames to catch the result.
    const unsub = manager.onMessage((frame) => {
      if (
        frame.type === "chat.read_file_result" &&
        (frame as ChatReadFileResult).requestId === requestId
      ) {
        const result = frame as ChatReadFileResult;
        if (unsubRef.current !== null) {
          unsubRef.current();
          unsubRef.current = null;
        }
        setLoading(false);
        if (result.error !== undefined && result.error !== "") {
          setError(result.error);
        } else {
          setSnippet(result.content);
          setStartLine(result.startLine);
        }
        setExpanded(true);
      }
    });
    unsubRef.current = unsub;

    const frame: ChatReadFileRequest = {
      type: "chat.read_file_request",
      seq: seqRef.current++,
      ts: Date.now(),
      requestId,
      // sessionId must come from somewhere; use a placeholder UUID since the
      // server validates the session by matching the active session id.
      // ChatTab would normally inject sessionId; here we use an empty UUID
      // and the server will respond with an error if no session is active.
      sessionId: "00000000-0000-0000-0000-000000000000",
      path,
      around: {
        line,
        contextBefore: CONTEXT_LINES,
        contextAfter: CONTEXT_LINES,
      },
    };
    manager.send(frame);
  }, [expanded, snippet, error, manager, path, line]);

  return (
    <span>
      <span
        className={styles.anchor}
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleClick(); }}
        data-testid="file-ref-anchor"
        data-path={path}
        data-line={line}
        aria-expanded={expanded}
      >
        {path}:{line}
      </span>
      {loading && <span data-testid="file-ref-loading"> …</span>}
      {expanded && snippet !== null && (
        <pre className={styles.snippet} data-testid="file-ref-snippet" data-start-line={startLine}>
          {snippet}
        </pre>
      )}
      {expanded && error !== null && (
        <span className={styles.error} data-testid="file-ref-error">{error}</span>
      )}
    </span>
  );
}
