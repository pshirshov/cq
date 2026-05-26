/**
 * replayBuffer.ts — per-session ring buffer of the last 500 chat.event frames
 * (or 5 MB serialized, whichever limit trips first; oldest entries evicted).
 *
 * INVARIANT: Bridge must call `append()` synchronously *before* `ws.send()` so
 * that a WS death mid-send leaves the frame in the buffer and it can be replayed
 * on reconnect. PR-19 will enforce this when chat.event traffic is wired.
 *
 * Sequence numbers are owned by the buffer (monotone from 1). Each `append()`
 * returns the assigned seq. PR-19 uses that seq as the `seq` field on the
 * outbound `chat.event` frame.
 */

import type { ChatEvent } from "@cq/shared";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BufferedEntry {
  readonly seq: number;
  readonly frame: ChatEvent;
  /** Pre-computed JSON.stringify length for O(1) size tracking. */
  readonly bytes: number;
}

export interface ReplayBuffer {
  /**
   * Append a frame. Assigns the next monotone seq, stores the entry, and
   * evicts oldest entries until both maxEntries and maxBytes constraints hold.
   * Returns the assigned seq.
   */
  append(frame: ChatEvent): { seq: number };

  /**
   * Return all entries with seq > lastSeenSeq.
   *
   * - `null` → return everything currently in the buffer (may be []).
   * - numeric → return entries with seq > lastSeenSeq.
   *   If lastSeenSeq is less than the buffer's earliest seq (i.e. some entries
   *   have been evicted that the client hasn't seen), returns "GAP_EXCEEDS".
   *   If lastSeenSeq >= serverSeq (client is up to date), returns [].
   */
  getSince(lastSeenSeq: number | null): ReadonlyArray<BufferedEntry> | "GAP_EXCEEDS";

  /** Highest assigned seq (0 if no entries have been appended yet). */
  readonly serverSeq: number;

  /** Current number of buffered entries. */
  readonly size: number;

  /** Current total serialized-byte tally across all buffered entries. */
  readonly bytes: number;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const DEFAULT_MAX_ENTRIES = 500;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function createReplayBuffer(opts?: {
  maxEntries?: number;
  maxBytes?: number;
}): ReplayBuffer {
  const maxEntries = opts?.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxBytes = opts?.maxBytes ?? DEFAULT_MAX_BYTES;

  // Ring buffer stored as a plain array used as a queue (oldest at index 0).
  const entries: BufferedEntry[] = [];
  let nextSeq = 1;
  let totalBytes = 0;

  function evict(): void {
    while (
      entries.length > 0 &&
      (entries.length > maxEntries || totalBytes > maxBytes)
    ) {
      const oldest = entries.shift()!;
      totalBytes -= oldest.bytes;
    }
  }

  return {
    append(frame: ChatEvent): { seq: number } {
      const assignedSeq = nextSeq++;
      const serialized = JSON.stringify(frame);
      const bytes = serialized.length;
      entries.push({ seq: assignedSeq, frame, bytes });
      totalBytes += bytes;
      evict();
      return { seq: assignedSeq };
    },

    getSince(lastSeenSeq: number | null): ReadonlyArray<BufferedEntry> | "GAP_EXCEEDS" {
      if (lastSeenSeq === null) {
        return entries.slice();
      }

      if (entries.length === 0) {
        // Buffer is empty; if client's lastSeen < nextSeq-1, those entries are
        // gone but we can't distinguish "never existed" from "evicted". However
        // if nextSeq === 1 (nothing was ever appended) there's no gap.
        // If nextSeq > 1, some frames existed and are gone — GAP_EXCEEDS.
        if (nextSeq - 1 > lastSeenSeq && nextSeq > 1) {
          return "GAP_EXCEEDS";
        }
        return [];
      }

      const earliestSeq = entries[0]!.seq;

      // Client claims to have seen up to lastSeenSeq.
      // If the earliest entry in our buffer has seq > lastSeenSeq + 1,
      // then the entry at lastSeenSeq+1 was evicted → gap exceeds buffer.
      if (lastSeenSeq < earliestSeq - 1) {
        return "GAP_EXCEEDS";
      }

      // If lastSeenSeq is before the earliest entry but exactly one behind
      // (earliestSeq - 1 === lastSeenSeq), client needs everything from
      // earliestSeq onward — that's a normal slice with no gap.
      return entries.filter((e) => e.seq > lastSeenSeq);
    },

    get serverSeq(): number {
      return nextSeq - 1;
    },

    get size(): number {
      return entries.length;
    },

    get bytes(): number {
      return totalBytes;
    },
  };
}
