/**
 * Tooltip.tsx — Expanded connection-status panel (PR-15 / resilient-ws-ui V6).
 *
 * Opened by <Indicator> on hover (transient) or click (persistent).
 * Renders:
 *   - Pool summary: connection count + per-connection card (id, state, uptime)
 *   - Active connection: id + uptime + in-flight pings
 *   - Packet-loss %
 *   - RTT windows: 30s / 1m / 5m — min / median / max / count
 *   - Backoff state: attempt N/max + ETA, or "deferred (tab hidden)", or "stopped"
 *   - Last close code + reason
 *
 * Pure presentational — receives ManagerStats; no side effects.
 */

import type React from "react";
import type { ManagerStats } from "./Manager";
import styles from "../styles/Tooltip.module.css";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  const min = Math.floor(ms / 60_000);
  const sec = Math.round((ms % 60_000) / 1_000);
  return `${min}m ${sec}s`;
}

function fmtUptime(ms: number): string {
  return fmtMs(ms);
}

function fmtEta(nextRetryAt: number, now: number): string {
  const remaining = Math.max(0, nextRetryAt - now);
  return fmtMs(remaining);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface RttRowProps {
  label: string;
  summary: ManagerStats["rttWindows"]["30s"];
}

function RttRow({ label, summary }: RttRowProps): React.ReactElement {
  if (summary === null) {
    return (
      <tr>
        <td>{label}</td>
        <td colSpan={4} style={{ textAlign: "center", color: "#585b70" }}>
          —
        </td>
      </tr>
    );
  }
  return (
    <tr>
      <td>{label}</td>
      <td>{summary.min}</td>
      <td>{summary.median}</td>
      <td>{summary.max}</td>
      <td>{summary.count}</td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface TooltipProps {
  stats: ManagerStats;
  /** Current epoch ms — injected so tests can control time. Default: Date.now(). */
  now?: number;
}

/**
 * Expanded indicator panel.
 *
 * The `now` prop defaults to Date.now() so the Indicator can pass its
 * rAF-driven `now` value and keep the ETA countdown in sync with the ring.
 */
export function Tooltip({ stats, now = Date.now() }: TooltipProps): React.ReactElement {
  const activeConn = stats.activeConnectionId !== null
    ? (stats.connections.find((c) => c.id === stats.activeConnectionId) ?? null)
    : null;

  // --- Backoff section text (V10: never lie) ---
  let backoffText: string;
  if (stats.isTerminal) {
    backoffText = "stopped";
  } else if (stats.pendingReconnectOnVisible) {
    backoffText = "deferred (tab hidden)";
  } else if (stats.nextRetryAt !== null) {
    const eta = fmtEta(stats.nextRetryAt, now);
    backoffText = `attempt ${stats.attempt} / ${stats.maxAttempts} — retry in ${eta}`;
  } else if (stats.attempt > 0) {
    backoffText = `attempt ${stats.attempt} / ${stats.maxAttempts}`;
  } else {
    backoffText = "—";
  }

  // --- Loss % formatting ---
  const lossPctText = `${stats.lossPct.toFixed(1)} %`;

  return (
    <div className={styles.panel} role="tooltip" aria-label="Connection detail">
      {/* Pool summary */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          Pool ({stats.connections.length} connection{stats.connections.length !== 1 ? "s" : ""})
        </div>
        {stats.connections.length === 0 ? (
          <span style={{ color: "#585b70" }}>no connections</span>
        ) : (
          stats.connections.map((c) => {
            const isActive = c.id === stats.activeConnectionId;
            return (
              <div
                key={c.id}
                className={`${styles.connCard ?? ""} ${isActive ? (styles.connCardActive ?? "") : ""}`}
                data-active={isActive ? "true" : "false"}
              >
                <span className={styles.label}>id</span>{" "}
                <span data-testid="conn-id">{c.id.slice(0, 8)}</span>
                {isActive && <span style={{ color: "#89b4fa", marginLeft: 4 }}>●</span>}
                {"  "}
                <span className={styles.label}>state</span>{" "}
                <span data-testid="conn-state">{c.state}</span>
                {"  "}
                <span className={styles.label}>up</span>{" "}
                <span>{fmtUptime(c.uptimeMs)}</span>
              </div>
            );
          })
        )}
      </div>

      <hr className={styles.divider} />

      {/* Active connection detail */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Active connection</div>
        {activeConn !== null ? (
          <>
            <div className={styles.row}>
              <span className={styles.label}>id</span>
              <span className={styles.value} data-testid="active-id">{activeConn.id}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>uptime</span>
              <span className={styles.value} data-testid="active-uptime">{fmtUptime(activeConn.uptimeMs)}</span>
            </div>
            <div className={styles.row}>
              <span className={styles.label}>in-flight pings</span>
              <span className={styles.value} data-testid="active-inflight">{activeConn.rtt !== null ? `last RTT ${activeConn.rtt} ms` : "—"}</span>
            </div>
          </>
        ) : (
          <span style={{ color: "#585b70" }}>none</span>
        )}
      </div>

      <hr className={styles.divider} />

      {/* Loss */}
      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>packet loss</span>
          <span className={styles.value} data-testid="loss-pct">{lossPctText}</span>
        </div>
      </div>

      <hr className={styles.divider} />

      {/* RTT windows */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>RTT (min / median / max / count)</div>
        <table className={styles.rttTable}>
          <thead>
            <tr>
              <th>window</th>
              <th>min</th>
              <th>med</th>
              <th>max</th>
              <th>n</th>
            </tr>
          </thead>
          <tbody data-testid="rtt-windows">
            <RttRow label="30s" summary={stats.rttWindows["30s"]} />
            <RttRow label="1m" summary={stats.rttWindows["1m"]} />
            <RttRow label="5m" summary={stats.rttWindows["5m"]} />
          </tbody>
        </table>
      </div>

      <hr className={styles.divider} />

      {/* Backoff */}
      <div className={styles.section}>
        <div className={styles.row}>
          <span className={styles.label}>backoff</span>
          <span className={styles.value} data-testid="backoff-state">{backoffText}</span>
        </div>
      </div>

      <hr className={styles.divider} />

      {/* Last close */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Last close</div>
        <div className={styles.row}>
          <span className={styles.label}>code</span>
          <span className={styles.value} data-testid="last-close-code">
            {stats.lastCloseCode !== null ? String(stats.lastCloseCode) : "—"}
          </span>
        </div>
        {stats.lastCloseReason !== "" && (
          <div className={styles.row}>
            <span className={styles.label}>reason</span>
            <span className={styles.value} data-testid="last-close-reason" style={{ wordBreak: "break-all" }}>
              {stats.lastCloseReason}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
