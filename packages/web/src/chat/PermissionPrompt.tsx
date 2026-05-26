/**
 * PermissionPrompt.tsx — inline permission prompt card.
 *
 * Rendered by ChatTab when a `chat.permission_request` frame arrives.
 * Displays the tool name, description, and three action buttons:
 * Allow, Allow Once, and Deny.
 *
 * Props:
 *   frame   — the ChatPermissionRequest frame from the server.
 *   onReply — called with the user's decision; parent sends chat.permission_reply.
 */

import styles from "../styles/PermissionPrompt.module.css";
import type { ChatPermissionRequest } from "@cq/shared";

export type PermissionDecision = "allow" | "deny" | "allow_once";

export interface PermissionPromptProps {
  frame: ChatPermissionRequest;
  onReply: (decision: PermissionDecision) => void;
}

export function PermissionPrompt({ frame, onReply }: PermissionPromptProps): React.ReactElement {
  const title = frame.title ?? `${frame.toolName} wants to run`;
  const description = frame.description;
  const displayName = frame.displayName ?? frame.toolName;

  return (
    <div className={styles.root} data-testid="permission-prompt">
      <div className={styles.header}>
        <span className={styles.icon}>🔒</span>
        <span className={styles.title}>{title}</span>
      </div>
      <div className={styles.body}>
        <div className={styles.toolName} data-testid="permission-prompt-tool">{displayName}</div>
        {description !== undefined && (
          <div className={styles.description}>{description}</div>
        )}
      </div>
      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.btnAllow}`}
          onClick={() => onReply("allow")}
          data-testid="permission-allow"
        >
          Allow
        </button>
        <button
          className={`${styles.btn} ${styles.btnAllowOnce}`}
          onClick={() => onReply("allow_once")}
          data-testid="permission-allow-once"
        >
          Allow Once
        </button>
        <button
          className={`${styles.btn} ${styles.btnDeny}`}
          onClick={() => onReply("deny")}
          data-testid="permission-deny"
        >
          Deny
        </button>
      </div>
    </div>
  );
}
