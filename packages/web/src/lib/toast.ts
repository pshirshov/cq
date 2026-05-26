/**
 * toast.ts — minimal in-memory toast store for transient user-facing messages.
 *
 * PR-35 uses this for the 5 MB attachment-cap rejection message.
 * PR-49 will replace this with a proper notification system; the interface
 * (showToast / subscribe) is kept narrow to make that migration easy.
 */

export interface ToastEntry {
  id: number;
  message: string;
}

type Listener = (entries: ToastEntry[]) => void;

let nextId = 1;
let entries: ToastEntry[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  const snapshot = [...entries];
  for (const l of listeners) l(snapshot);
}

/**
 * Push a new toast message. It is auto-dismissed after `durationMs`
 * (default 4 000 ms).
 */
export function showToast(message: string, durationMs = 4000): void {
  const id = nextId++;
  entries = [...entries, { id, message }];
  notify();
  setTimeout(() => {
    entries = entries.filter((e) => e.id !== id);
    notify();
  }, durationMs);
}

/**
 * Subscribe to toast updates. Returns an unsubscribe function.
 * The listener is called immediately with the current snapshot.
 */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => { listeners.delete(listener); };
}
