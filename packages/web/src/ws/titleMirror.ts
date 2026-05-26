/**
 * titleMirror.ts — Mirrors Manager state into document.title (PR-16 / resilient-ws-ui V7).
 *
 * Exports attachTitleMirror(manager, opts?) that subscribes to manager.onUpdate
 * and writes document.title on each update.
 *
 * Title format (never-lie labels):
 *   - isTerminal          → "(0/0) cq [STOPPED]"
 *   - pendingReconnectOnVisible && no ALIVE  → "(0/<total>) cq [DEFERRED]"
 *   - any STALE           → "(<alive>/<total>) cq [STALE]"
 *   - NEW only (no ALIVE) → "(0/<total>) cq [CONNECTING]"
 *   - ≥1 ALIVE            → "(<alive>/<total>) cq"
 *   - empty manager       → "(0/0) cq"
 *
 * When typeof document === 'undefined': no-op (SSR / Node environment).
 *
 * Test seam: opts.doc accepts { title: string } so tests avoid happy-dom.
 */

import type { ManagerStats } from "./Manager";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TitleMirrorOpts {
  /** Override the base application name. Default: "cq". */
  baseTitle?: string;
  /**
   * Test seam: inject a fake document-like object instead of relying on the
   * global `document`. Skips the typeof-document guard.
   */
  doc?: { title: string };
}

export interface TitleMirror {
  detach(): void;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

function deriveTitle(stats: ManagerStats, baseTitle: string): string {
  const total = stats.connections.length;
  const alive = stats.connections.filter((c) => c.state === "ALIVE").length;

  if (stats.isTerminal) {
    return `(0/0) ${baseTitle} [STOPPED]`;
  }

  if (stats.pendingReconnectOnVisible && alive === 0) {
    return `(0/${total}) ${baseTitle} [DEFERRED]`;
  }

  const hasStale = stats.connections.some((c) => c.state === "STALE");
  if (hasStale) {
    return `(${alive}/${total}) ${baseTitle} [STALE]`;
  }

  // No ALIVE yet and we have connections in NEW state → CONNECTING
  const hasNew = stats.connections.some((c) => c.state === "NEW");
  if (alive === 0 && hasNew) {
    return `(0/${total}) ${baseTitle} [CONNECTING]`;
  }

  if (alive === 0 && total === 0) {
    return `(0/0) ${baseTitle}`;
  }

  return `(${alive}/${total}) ${baseTitle}`;
}

export function attachTitleMirror(
  manager: { onUpdate(cb: (stats: ManagerStats) => void): () => void },
  opts?: TitleMirrorOpts,
): TitleMirror {
  const baseTitle = opts?.baseTitle ?? "cq";

  // Resolve the document target.
  let docTarget: { title: string } | null;
  if (opts?.doc !== undefined) {
    docTarget = opts.doc;
  } else if (typeof document !== "undefined") {
    docTarget = document;
  } else {
    // SSR / Node environment — no-op.
    return { detach(): void { /* no-op */ } };
  }

  const target = docTarget;

  const unsub = manager.onUpdate((stats: ManagerStats) => {
    target.title = deriveTitle(stats, baseTitle);
  });

  return {
    detach(): void {
      unsub();
    },
  };
}
