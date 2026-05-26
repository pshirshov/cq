/**
 * ToastStack.tsx — fixed top-right stack of toast notifications (PR-49).
 *
 * Subscribes to the toast store via subscribeToasts().
 * Auto-dismisses info/success entries after 5 s via setTimeout.
 * Error entries remain until the user clicks ×.
 */

import { useState, useEffect } from "react";
import { subscribeToasts, dismiss } from "./toast";
import type { ToastEntry } from "./toast";
import styles from "../styles/Toast.module.css";

const AUTO_DISMISS_MS = 5_000;

/**
 * Hook: mirrors the toast store into component state and wires auto-dismiss
 * timers for info/success entries.
 */
function useToasts(): ReadonlyArray<ToastEntry> {
  const [toasts, setToasts] = useState<ReadonlyArray<ToastEntry>>([]);

  useEffect(() => {
    return subscribeToasts((snapshot) => {
      setToasts(snapshot);
    });
  }, []);

  // Arm auto-dismiss timers when toasts change.
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const t of toasts) {
      if (t.level === "info" || t.level === "success") {
        const timer = setTimeout(() => {
          dismiss(t.id);
        }, AUTO_DISMISS_MS);
        timers.push(timer);
      }
    }
    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [toasts]);

  return toasts;
}

function levelClass(level: ToastEntry["level"]): string {
  if (level === "success") return styles.toastSuccess ?? "";
  if (level === "error") return styles.toastError ?? "";
  return styles.toastInfo ?? "";
}

export function ToastStack(): React.ReactElement | null {
  const toasts = useToasts();

  if (toasts.length === 0) return null;

  return (
    <div className={styles.stack} role="region" aria-label="Notifications">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${styles.toast ?? ""} ${levelClass(t.level)}`}
          role="alert"
          aria-live="assertive"
        >
          <span className={styles.text}>{t.text}</span>
          {t.level === "error" && (
            <button
              className={styles.dismiss}
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
