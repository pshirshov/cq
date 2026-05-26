/**
 * MockDocument.ts — Minimal event-target stubs for Page Lifecycle testing.
 *
 * Provides MockDoc, MockWindow, and MockNav that implement the
 * DocumentLike / EventTargetLike / NavigatorLike interfaces used by
 * attachPageLifecycle. Tests drive events via dispatchEvent().
 *
 * No dependency on a real DOM; works in the Bun test runner (no window/document).
 */

import type {
  DocumentLike,
  EventTargetLike,
  NavigatorLike,
  EventListenerLike,
} from "../../src/lib/pageLifecycle";

// ---------------------------------------------------------------------------
// Shared EventTarget implementation
// ---------------------------------------------------------------------------

class MockEventTarget {
  private readonly _handlers: Map<string, Set<EventListenerLike>> = new Map();

  addEventListener(type: string, listener: EventListenerLike): void {
    if (!this._handlers.has(type)) {
      this._handlers.set(type, new Set());
    }
    this._handlers.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: EventListenerLike): void {
    this._handlers.get(type)?.delete(listener);
  }

  /** Dispatch an event synchronously to all registered listeners. */
  dispatchEvent(type: string, event: Event): void {
    const handlers = this._handlers.get(type);
    if (!handlers) return;
    for (const h of handlers) {
      h(event);
    }
  }

  /** Returns the count of listeners for a given event type. */
  listenerCount(type: string): number {
    return this._handlers.get(type)?.size ?? 0;
  }
}

// ---------------------------------------------------------------------------
// MockDoc — implements DocumentLike
// ---------------------------------------------------------------------------

export class MockDoc extends MockEventTarget implements DocumentLike {
  visibilityState: "visible" | "hidden" = "visible";
}

// ---------------------------------------------------------------------------
// MockWindow — implements EventTargetLike
// ---------------------------------------------------------------------------

export class MockWindow extends MockEventTarget implements EventTargetLike {}

// ---------------------------------------------------------------------------
// MockNav — implements NavigatorLike (with optional connection)
// ---------------------------------------------------------------------------

export class MockConnection extends MockEventTarget implements EventTargetLike {}

export class MockNav implements NavigatorLike {
  /** Set to a MockConnection to simulate the Network Information API. */
  connection?: MockConnection | undefined;

  private readonly _target = new MockEventTarget();

  addEventListener(type: string, listener: EventListenerLike): void {
    this._target.addEventListener(type, listener);
  }

  removeEventListener(type: string, listener: EventListenerLike): void {
    this._target.removeEventListener(type, listener);
  }

  dispatchEvent(type: string, event: Event): void {
    this._target.dispatchEvent(type, event);
  }

  listenerCount(type: string): number {
    return this._target.listenerCount(type);
  }
}

// ---------------------------------------------------------------------------
// Helper to build a PageTransitionEvent-like plain object
// ---------------------------------------------------------------------------

/**
 * Create a minimal Event that carries a `persisted` boolean, matching the
 * PageTransitionEvent shape that pageLifecycle handlers cast to.
 */
export function makePageTransitionEvent(type: string, persisted: boolean): Event {
  // We need a real Event object so that `e instanceof Event` checks pass, but
  // we also need to attach `.persisted`. We do that via Object.assign on
  // a plain Event — the lifecycle handlers only read `.persisted`, so this is sufficient.
  const evt = new Event(type);
  Object.defineProperty(evt, "persisted", { value: persisted, writable: false });
  return evt;
}
