/**
 * sessionRegistry.ts — process-lifetime registry of per-session replay buffers.
 *
 * A session survives WS connection close. The registry is instantiated once
 * in main.ts and passed into the server layer. Tests construct their own
 * instances.
 *
 * PR-19 will call `create()` on `chat.start` and associate the returned
 * sessionId with the WsSession. PR-48 will clean up entries on graceful
 * shutdown.
 */

import { createReplayBuffer, type ReplayBuffer } from "./replayBuffer";

// ---------------------------------------------------------------------------
// Per-session state held by the registry
// ---------------------------------------------------------------------------

export interface SessionState {
  readonly sessionId: string;
  readonly buffer: ReplayBuffer;
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class SessionRegistry {
  private readonly sessions = new Map<string, SessionState>();

  /** Look up a session by id. Returns undefined if not found. */
  get(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /** Create a new session with a fresh UUID and empty replay buffer. */
  create(): { sessionId: string; state: SessionState } {
    const sessionId = crypto.randomUUID();
    const state: SessionState = {
      sessionId,
      buffer: createReplayBuffer(),
    };
    this.sessions.set(sessionId, state);
    return { sessionId, state };
  }

  /** Remove a session from the registry. No-op if not found. */
  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Number of sessions currently tracked. */
  get size(): number {
    return this.sessions.size;
  }
}
