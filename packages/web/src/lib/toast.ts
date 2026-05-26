/**
 * toast.ts — bounded in-memory toast store for transient user-facing messages.
 *
 * PR-35 used an earlier version (showToast(message, durationMs)).
 * PR-49 replaces it with a proper notification system:
 *   - Bounded 50-entry FIFO queue; oldest entry evicted when the queue is full.
 *   - Each entry: { id, level, text, ts }.
 *   - showToast({ level, text }) — push a new toast.
 *   - dismiss(id) — remove a specific toast by id.
 *   - subscribeToasts(cb) — subscribe to snapshot updates; returns unsubscribe fn.
 *
 * Auto-dismiss logic lives in <ToastStack> (it uses setTimeout per toast).
 * This module is deliberately free of browser globals.
 */

export type ToastLevel = "info" | "success" | "error";

export interface ToastEntry {
  id: string;
  level: ToastLevel;
  text: string;
  ts: number;
}

type Listener = (entries: ReadonlyArray<ToastEntry>) => void;

const QUEUE_CAP = 50;

let entries: ToastEntry[] = [];
const listeners = new Set<Listener>();

function notify(): void {
  const snapshot: ReadonlyArray<ToastEntry> = [...entries];
  for (const l of listeners) l(snapshot);
}

/**
 * Push a new toast. When the queue exceeds QUEUE_CAP, the oldest entry is
 * evicted (FIFO).
 */
export function showToast({ level, text }: { level: ToastLevel; text: string }): void {
  const entry: ToastEntry = {
    id: crypto.randomUUID(),
    level,
    text,
    ts: Date.now(),
  };
  const next = [...entries, entry];
  // FIFO eviction: keep only the newest QUEUE_CAP entries.
  entries = next.length > QUEUE_CAP ? next.slice(next.length - QUEUE_CAP) : next;
  notify();
}

/**
 * Remove the toast with the given id. No-op if not found.
 */
export function dismiss(id: string): void {
  entries = entries.filter((e) => e.id !== id);
  notify();
}

/**
 * Subscribe to toast snapshot updates.
 * The listener is called immediately with the current snapshot.
 * Returns an unsubscribe function.
 */
export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener([...entries]);
  return () => { listeners.delete(listener); };
}
