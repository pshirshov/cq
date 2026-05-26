import { useState, useEffect } from "react";
import type { Manager, ManagerStats } from "./Manager";
import { deriveWidgetState } from "./deriveWidgetState";
import type { WidgetState } from "./deriveWidgetState";
import styles from "../styles/Indicator.module.css";

// ---------------------------------------------------------------------------
// Glyph channel (shape / non-color channel 2)
// ---------------------------------------------------------------------------

/** Short glyph rendered inside the circle for non-color disambiguation. */
const STATE_GLYPH: Record<WidgetState, string> = {
  new: "…",
  alive: "✓",
  stale: "~",
  connecting: "↻",
  dead: "✕",
  terminal: "■",
};

/** CSS class for the per-state background color (channel 1). */
const STATE_CLASS: Record<WidgetState, string> = {
  new: styles.stateNew ?? "",
  alive: styles.stateAlive ?? "",
  stale: styles.stateStale ?? "",
  connecting: styles.stateConnecting ?? "",
  dead: styles.stateDead ?? "",
  terminal: styles.stateTerminal ?? "",
};

// ---------------------------------------------------------------------------
// Aria label composition (channel 3)
// ---------------------------------------------------------------------------

function buildAriaLabel(ws: WidgetState, stats: ManagerStats): string {
  const activeConn = stats.activeConnectionId !== null
    ? stats.connections.find((c) => c.id === stats.activeConnectionId)
    : null;

  switch (ws) {
    case "new":
      return "Connection initialising";
    case "alive": {
      const rtt = activeConn?.rtt;
      return rtt !== null && rtt !== undefined
        ? `Connection alive — last RTT ${rtt} ms`
        : "Connection alive";
    }
    case "stale":
      return "Connection stale, attempting reconnect";
    case "connecting": {
      if (stats.nextRetryAt !== null) {
        const secsLeft = Math.max(0, Math.round((stats.nextRetryAt - Date.now()) / 1000));
        return `Reconnecting — retry in ${secsLeft} s (attempt ${stats.attempt} of ${stats.maxAttempts})`;
      }
      if (stats.pendingReconnectOnVisible) {
        return "Reconnect deferred until page is visible";
      }
      return `Connecting (attempt ${stats.attempt} of ${stats.maxAttempts})`;
    }
    case "dead":
      return "Connection lost — no retry scheduled";
    case "terminal":
      return "Connection lost — stopped retrying";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface IndicatorProps {
  manager: Manager;
}

/**
 * <Indicator> — 32×32 fixed-position connection-status widget.
 *
 * Renders three independent state channels (resilient-ws-ui V3):
 *   1. Color class  — background per widget state
 *   2. data-state + glyph — non-color shape channel
 *   3. aria-label   — human-readable phrase
 *
 * Widget state is DERIVED from ManagerStats on every update (V2);
 * it is never stored separately.
 *
 * PR-17 will move Manager construction into a ConnectionProvider context;
 * for now the manager is passed as a prop.
 */
export function Indicator({ manager }: IndicatorProps): React.ReactElement {
  const [stats, setStats] = useState<ManagerStats>(() => manager.stats);

  useEffect(() => {
    // Sync on mount in case stats changed between initial read and subscription.
    setStats(manager.stats);
    const unsub = manager.onUpdate((s) => setStats(s));
    return unsub;
  }, [manager]);

  const ws = deriveWidgetState(stats);
  const ariaLabel = buildAriaLabel(ws, stats);
  const glyph = STATE_GLYPH[ws];
  const colorClass = STATE_CLASS[ws];

  return (
    <div
      id="ws-indicator"
      className={`${styles.indicator ?? ""} ${colorClass}`}
      data-state={ws}
      aria-label={ariaLabel}
      role="status"
      title={ariaLabel}
    >
      {glyph}
    </div>
  );
}
