/**
 * pageLifecycle.ts — Page Lifecycle event wiring (PR-10).
 *
 * Subscribes to browser Page Lifecycle events and drives Manager behaviour:
 *
 *   visibilitychange → hidden   : no-op (defer logic is in Manager.scheduleBackoff)
 *   visibilitychange → visible  : checkConnections() + runPendingReconnect()
 *   freeze (Chrome)             : log only — resume does the work
 *   resume (Chrome)             : handleResume(pongTimeoutMs * 2) — treat as long freeze
 *   pagehide (persisted:true)   : closeForBFCache()
 *   pagehide (persisted:false)  : no-op (navigation away; Manager.destroy() is caller's job)
 *   pageshow (persisted:true)   : reopenFromBFCache()
 *   online                      : checkConnections()
 *   offline                     : log only
 *   Network Info API change     : checkConnections() (guarded by feature detection)
 *
 * Returns a `detach()` function that removes all listeners.
 *
 * Injectable seams (`doc`, `win`, `nav`) allow tests to supply mock objects
 * without a real DOM environment. Defaults read from the real globals when
 * available; no-ops when the global is absent (e.g. non-browser Bun test env).
 */

import type { Manager } from "../ws/Manager";

// ---------------------------------------------------------------------------
// Injectable seams (for testing without a real DOM)
// ---------------------------------------------------------------------------

export interface PageLifecycleTargets {
  /** The document-like object to listen on for visibilitychange. */
  doc: DocumentLike;
  /** The window-like object to listen on for freeze/resume/pagehide/pageshow. */
  win: EventTargetLike;
  /** The navigator-like object for online/offline and Network Information API. */
  nav: NavigatorLike;
}

export interface DocumentLike {
  readonly visibilityState: "visible" | "hidden" | string;
  addEventListener(type: string, listener: EventListenerLike): void;
  removeEventListener(type: string, listener: EventListenerLike): void;
}

export interface EventTargetLike {
  addEventListener(type: string, listener: EventListenerLike): void;
  removeEventListener(type: string, listener: EventListenerLike): void;
}

export interface NavigatorLike {
  addEventListener?(type: string, listener: EventListenerLike): void;
  removeEventListener?(type: string, listener: EventListenerLike): void;
  /** Network Information API — may be absent. */
  readonly connection?: EventTargetLike | undefined;
}

export type EventListenerLike = (event: Event) => void;

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface PageLifecycleOpts {
  /**
   * Threshold used for the resume event: if the freeze lasted longer than
   * pongTimeoutMs (passed as elapsedMs to Manager.handleResume), a proactive
   * replacement is spawned. PR-11 will wire its own elapsed measurement;
   * here we pass a fixed threshold of pongTimeoutMs * 2.
   */
  resumeElapsedMs?: number;
  /**
   * Injectable DOM targets. Defaults to `document`, `window`, `navigator`
   * when they are globally available; otherwise the function is a no-op.
   */
  targets?: PageLifecycleTargets;
}

// ---------------------------------------------------------------------------
// attachPageLifecycle
// ---------------------------------------------------------------------------

/**
 * Subscribe to Page Lifecycle events and wire them to Manager hooks.
 * Returns a `detach()` function that unregisters all listeners.
 *
 * Safe to call in non-browser environments — if neither `targets` nor the
 * global `document`/`window`/`navigator` are available, `detach()` is a no-op.
 */
export function attachPageLifecycle(
  manager: Manager,
  opts: PageLifecycleOpts = {},
): { detach: () => void } {
  // Resolve injectable targets or fall back to real globals.
  const targets = opts.targets ?? resolveGlobalTargets();
  if (targets === null) {
    // No DOM available — nothing to wire.
    return { detach: () => undefined };
  }

  const { doc, win, nav } = targets;

  // Default resume elapsed: we don't have the real elapsed time here;
  // PR-11 will supply it via its own tick loop. We pass a value that
  // always exceeds pongTimeoutMs so that resume unconditionally triggers
  // the proactive reconnect. The caller may override via opts.
  const resumeElapsedMs = opts.resumeElapsedMs ?? Infinity;

  // ---- Handlers ----

  const onVisibilityChange: EventListenerLike = () => {
    if (doc.visibilityState === "visible") {
      manager.checkConnections();
      manager.runPendingReconnect();
    }
    // hidden: Manager.scheduleBackoff() already defers via _isVisible(); no action here.
  };

  const onFreeze: EventListenerLike = () => {
    // Log only; resume will do the work.
    // (No console.log dependency; lifecycle consumers can attach their own onUpdate.)
  };

  const onResume: EventListenerLike = () => {
    manager.handleResume(resumeElapsedMs);
  };

  const onPageHide: EventListenerLike = (e: Event) => {
    // The `persisted` flag indicates BFCache eligibility.
    if ((e as PageTransitionEvent).persisted) {
      manager.closeForBFCache();
    }
    // persisted:false means navigating away; let the caller destroy() the manager.
  };

  const onPageShow: EventListenerLike = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) {
      manager.reopenFromBFCache();
    }
  };

  const onOnline: EventListenerLike = () => {
    manager.checkConnections();
  };

  const onOffline: EventListenerLike = () => {
    // Log only; connections will detect failure via heartbeat.
  };

  const onNetworkChange: EventListenerLike = () => {
    manager.checkConnections();
  };

  // ---- Register ----

  doc.addEventListener("visibilitychange", onVisibilityChange);
  win.addEventListener("freeze", onFreeze);
  win.addEventListener("resume", onResume);
  win.addEventListener("pagehide", onPageHide);
  win.addEventListener("pageshow", onPageShow);
  nav.addEventListener?.("online", onOnline);
  nav.addEventListener?.("offline", onOffline);

  // Network Information API — optional, feature-detected.
  nav.connection?.addEventListener("change", onNetworkChange);

  // ---- Detach ----

  return {
    detach(): void {
      doc.removeEventListener("visibilitychange", onVisibilityChange);
      win.removeEventListener("freeze", onFreeze);
      win.removeEventListener("resume", onResume);
      win.removeEventListener("pagehide", onPageHide);
      win.removeEventListener("pageshow", onPageShow);
      nav.removeEventListener?.("online", onOnline);
      nav.removeEventListener?.("offline", onOffline);
      nav.connection?.removeEventListener("change", onNetworkChange);
    },
  };
}

// ---------------------------------------------------------------------------
// Resolve real global targets (browser only)
// ---------------------------------------------------------------------------

function resolveGlobalTargets(): PageLifecycleTargets | null {
  if (typeof document === "undefined") return null;
  if (typeof window === "undefined") return null;

  return {
    doc: document as unknown as DocumentLike,
    win: window as unknown as EventTargetLike,
    nav: navigator as unknown as NavigatorLike,
  };
}
