/**
 * MessageBubble.tsx — chat bubble wrapper for rendered messages (F5).
 *
 * Responsibilities:
 *   - Visually distinguish assistant vs user messages (role = "assistant" |
 *     "user" | "tool" | "unknown").
 *   - Show a small timestamp at the top-right of each bubble.
 *   - Show a Copy button on hover that copies the bubble's text content via
 *     navigator.clipboard.
 *   - Render children (Markdown, ToolCard, etc.) inside the bubble body.
 *
 * Search highlight (F4):
 *   - When searchQuery is non-empty, the plain-text content of the message
 *     is compared case-insensitively. If this bubble index appears in the
 *     activeMatchIndex list, the bubble receives a highlight ring via CSS class.
 *   - Actual <mark> highlighting inside Markdown is handled by the Markdown
 *     renderer via the searchQuery prop; this component adds a ring on the
 *     outermost bubble for scroll-target purposes.
 */

import { useRef, useState } from "react";
import styles from "../styles/MessageBubble.module.css";

export type MessageRole = "assistant" | "user" | "tool" | "unknown";

export interface MessageBubbleProps {
  role: MessageRole;
  /** Epoch ms when the message was produced; 0 when unknown. */
  timestamp: number;
  /** Plain-text content used for the Copy button. */
  plainText: string;
  /** Whether this bubble is the active search match (adds highlight ring). */
  isActiveMatch?: boolean;
  /** Forwarded data-testid from the message key. */
  testId?: string;
  children?: React.ReactNode;
}

/** Format epoch ms as "HH:MM" in local time. Returns empty string for 0. */
function formatTime(ts: number): string {
  if (ts === 0) return "";
  const d = new Date(ts);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

export function MessageBubble({
  role,
  timestamp,
  plainText,
  isActiveMatch = false,
  testId,
  children,
}: MessageBubbleProps): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCopy(): void {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(plainText).then(() => {
        setCopied(true);
        if (copyTimeoutRef.current !== null) clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = setTimeout(() => setCopied(false), 1500);
      });
    }
  }

  const roleClass =
    role === "assistant"
      ? styles.assistant
      : role === "user"
        ? styles.user
        : role === "tool"
          ? styles.tool
          : styles.unknown;

  const timeText = formatTime(timestamp);

  return (
    <div
      className={`${styles.bubble} ${roleClass} ${isActiveMatch ? styles.activeMatch : ""}`}
      data-testid={testId}
      data-role={role}
    >
      {/* Top row: role label + timestamp + copy button */}
      <div className={styles.meta}>
        <span className={styles.roleLabel}>{role}</span>
        {timeText.length > 0 && (
          <span className={styles.timestamp} aria-label={`Sent at ${timeText}`}>{timeText}</span>
        )}
        <button
          className={`${styles.copyBtn} ${copied ? styles.copyBtnDone : ""}`}
          onClick={handleCopy}
          type="button"
          aria-label="Copy message"
          data-testid="message-copy"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      {/* Message body */}
      <div className={styles.body}>
        {children}
      </div>
    </div>
  );
}
