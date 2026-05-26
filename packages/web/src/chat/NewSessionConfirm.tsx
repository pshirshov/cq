/**
 * NewSessionConfirm.tsx — modal dialog that confirms cancelling the active session
 * and starting a new one.
 *
 * Shown only when a session is in progress (caller's responsibility). Two buttons:
 *   Cancel  — does nothing; calls onCancel().
 *   Confirm — calls onConfirm(); caller should interrupt then start a new session.
 */

import styles from "../styles/Header.module.css";

export interface NewSessionConfirmProps {
  onCancel: () => void;
  onConfirm: () => void;
}

export function NewSessionConfirm({ onCancel, onConfirm }: NewSessionConfirmProps): React.ReactElement {
  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="nsc-title">
      <div className={styles.dialog}>
        <p id="nsc-title" className={styles.dialogTitle}>Start a new session?</p>
        <p className={styles.dialogBody}>
          This will cancel the current session in progress. Any in-flight tool calls will be interrupted.
        </p>
        <div className={styles.dialogButtons}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancel
          </button>
          <button className={styles.confirmBtn} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
