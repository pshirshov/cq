import type { ManagerStats } from "./Manager";

/**
 * Widget display state derived from ManagerStats.
 * Never stored — always recomputed from the latest stats snapshot.
 * (resilient-ws-ui V2 contract)
 *
 * Mapping:
 *   alive      — at least one connection is ALIVE
 *   stale      — at least one connection is STALE (but none ALIVE)
 *   connecting — at least one connection is NEW, OR a retry is pending/deferred
 *   terminal   — manager has permanently given up (non-retriable close or max attempts)
 *   dead       — no connections, not terminal, no retry scheduled (transient gap)
 *
 * Note: "frozen" (page-lifecycle freeze) is intentionally omitted from PR-13;
 * it will be added in PR-14/15 once page-lifecycle freeze state surfaces in stats.
 */
export type WidgetState = "new" | "alive" | "stale" | "connecting" | "dead" | "terminal";

export function deriveWidgetState(stats: ManagerStats): WidgetState {
  if (stats.connections.some((c) => c.state === "ALIVE")) return "alive";
  if (stats.connections.some((c) => c.state === "STALE")) return "stale";
  if (stats.connections.some((c) => c.state === "NEW")) return "connecting";
  if (stats.isTerminal) return "terminal";
  if (stats.nextRetryAt !== null || stats.pendingReconnectOnVisible) return "connecting";
  return "dead";
}
