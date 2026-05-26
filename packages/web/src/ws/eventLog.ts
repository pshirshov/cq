/**
 * eventLog.ts — Bounded event log for Manager state transitions (PR-16 / resilient-ws-ui V8).
 *
 * Pure data structure; no DOM or timer dependencies.
 * Appends events in chronological order; evicts oldest beyond `retained`.
 * getAll() / getDisplayed() return latest-first slices.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type EventKind =
  | "spawn"
  | "alive"
  | "stale"
  | "dead"
  | "close"
  | "backoff"
  | "retry"
  | "terminal"
  | "destroy"
  | "lifecycle";

export interface EventLogEntry {
  ts: number;
  kind: EventKind;
  msg: string;
}

export interface EventLog {
  append(entry: { kind: EventKind; msg: string; ts?: number }): void;
  /** Up to `retained` entries, latest first. */
  getAll(): ReadonlyArray<EventLogEntry>;
  /** Up to `displayed` entries, latest first. */
  getDisplayed(): ReadonlyArray<EventLogEntry>;
  readonly size: number;
}

export interface EventLogOpts {
  retained?: number;   // default 500
  displayed?: number;  // default 100
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export function createEventLog(opts?: EventLogOpts): EventLog {
  const retained = opts?.retained ?? 500;
  const displayed = opts?.displayed ?? 100;

  // Chronological order (oldest at index 0, newest at last index).
  const _entries: EventLogEntry[] = [];

  return {
    append({ kind, msg, ts }: { kind: EventKind; msg: string; ts?: number }): void {
      const entry: EventLogEntry = { ts: ts ?? Date.now(), kind, msg };
      _entries.push(entry);
      // Evict oldest entries beyond the cap.
      if (_entries.length > retained) {
        _entries.splice(0, _entries.length - retained);
      }
    },

    getAll(): ReadonlyArray<EventLogEntry> {
      // Return a copy in latest-first order.
      return _entries.slice().reverse();
    },

    getDisplayed(): ReadonlyArray<EventLogEntry> {
      // Latest `displayed` entries, latest first.
      const start = Math.max(0, _entries.length - displayed);
      return _entries.slice(start).reverse();
    },

    get size(): number {
      return _entries.length;
    },
  };
}
