/**
 * Tests for T150: HoldButton — confirm-by-holding (web).
 *
 * Acceptance (per the task):
 *   (a) a full HOLD_MS (1000ms) hold fires onConfirm exactly once;
 *   (b) releasing at 500ms (before threshold) does NOT fire and resets the
 *       progress bar to 0;
 *   (c) Enter/Space held to threshold fires; a keyup before threshold cancels;
 *   (d) requireHold:false fires on a plain click.
 *
 * Timing is driven by a hand-written fake clock injected via the `clock` prop;
 * the test advances it synchronously, so no real wall-clock waiting occurs.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { HoldButton, HOLD_MS, type HoldClock } from "../src/HoldButton";

/**
 * Deterministic fake clock: a virtual `now` plus a min-heap-free list of
 * scheduled callbacks. `advance(ms)` moves `now` forward and fires every
 * callback whose due time has been reached, in due-time order, accounting for
 * callbacks that reschedule themselves (the progress ticks).
 */
class FakeClock implements HoldClock {
  private current = 0;
  private nextHandle = 1;
  private scheduled = new Map<number, { due: number; cb: () => void }>();

  now(): number {
    return this.current;
  }

  setTimeout(cb: () => void, ms: number): number {
    const handle = this.nextHandle++;
    this.scheduled.set(handle, { due: this.current + ms, cb });
    return handle;
  }

  clearTimeout(handle: number): void {
    this.scheduled.delete(handle);
  }

  /** Advance virtual time by `ms`, firing all callbacks that come due. */
  advance(ms: number): void {
    const target = this.current + ms;
    // Loop because firing a callback may schedule a new one before `target`.
    for (;;) {
      let nextHandle: number | null = null;
      let nextDue = Infinity;
      for (const [handle, entry] of this.scheduled) {
        if (entry.due <= target && entry.due < nextDue) {
          nextDue = entry.due;
          nextHandle = handle;
        }
      }
      if (nextHandle === null) break;
      const entry = this.scheduled.get(nextHandle)!;
      this.scheduled.delete(nextHandle);
      this.current = entry.due;
      entry.cb();
    }
    this.current = target;
  }
}

let container: HTMLElement;
let root: Root;

const sleep = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function flush(): Promise<void> {
  await act(async () => {
    await sleep(0);
  });
}

const q = (sel: string): HTMLElement | null => container.querySelector(sel);
const testid = (id: string): HTMLElement | null => q(`[data-testid="${id}"]`);

function btn(): HTMLButtonElement {
  const el = testid("hb");
  if (el === null) throw new Error("HoldButton not found");
  return el as HTMLButtonElement;
}

function progressNow(): number {
  const bar = testid("hb-progress");
  if (bar === null) throw new Error("progress bar not found");
  return Number(bar.getAttribute("aria-valuenow"));
}

function dispatchPointer(type: "pointerdown" | "pointerup" | "pointerout"): void {
  act(() => {
    btn().dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true }));
  });
}

function dispatchKey(type: "keydown" | "keyup", key: string): void {
  act(() => {
    btn().dispatchEvent(new KeyboardEvent(type, { key, bubbles: true, cancelable: true }));
  });
}

function advance(clock: FakeClock, ms: number): void {
  act(() => {
    clock.advance(ms);
  });
}

interface Harness {
  clock: FakeClock;
  calls: () => number;
}

async function mount(props: { requireHold?: boolean } = {}): Promise<Harness> {
  const clock = new FakeClock();
  let count = 0;
  await act(async () => {
    root.render(
      createElement(HoldButton, {
        onConfirm: () => {
          count++;
        },
        clock,
        "data-testid": "hb",
        ...props,
        children: "Delete",
      }),
    );
  });
  await flush();
  return { clock, calls: () => count };
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

describe("HoldButton (T150)", () => {
  it("(a) a full HOLD_MS pointer hold fires onConfirm exactly once", async () => {
    const h = await mount();

    dispatchPointer("pointerdown");
    await flush();
    expect(h.calls()).toBe(0);

    // Advance the full hold duration.
    advance(h.clock, HOLD_MS);
    await flush();

    expect(h.calls()).toBe(1);

    // No double-fire: further advancing does nothing (timer is torn down).
    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(1);
  });

  it("(b) releasing at 500ms does NOT fire and resets the progress bar", async () => {
    const h = await mount();

    dispatchPointer("pointerdown");
    await flush();

    advance(h.clock, 500);
    await flush();
    // Progress is partway (around 50%) and the action has not fired.
    expect(progressNow()).toBeGreaterThan(0);
    expect(h.calls()).toBe(0);

    // Release before threshold: cancels + resets.
    dispatchPointer("pointerup");
    await flush();
    expect(progressNow()).toBe(0);
    expect(h.calls()).toBe(0);

    // Advancing past the original threshold must NOT fire — the hold was reset.
    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(0);
  });

  it("(b') pointer leaving the button before threshold also cancels and resets", async () => {
    const h = await mount();

    dispatchPointer("pointerdown");
    await flush();
    advance(h.clock, 500);
    await flush();
    expect(progressNow()).toBeGreaterThan(0);

    dispatchPointer("pointerout");
    await flush();
    expect(progressNow()).toBe(0);

    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(0);
  });

  it("(c) Enter held to threshold fires; keyup early cancels", async () => {
    const h = await mount();

    // Early keyup cancels.
    dispatchKey("keydown", "Enter");
    await flush();
    advance(h.clock, 500);
    await flush();
    expect(progressNow()).toBeGreaterThan(0);
    dispatchKey("keyup", "Enter");
    await flush();
    expect(progressNow()).toBe(0);
    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(0);

    // Full hold fires.
    dispatchKey("keydown", "Enter");
    await flush();
    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(1);
  });

  it("(c') Space held to threshold fires", async () => {
    const h = await mount();

    dispatchKey("keydown", " ");
    await flush();
    advance(h.clock, HOLD_MS);
    await flush();
    expect(h.calls()).toBe(1);
  });

  it("(d) requireHold:false fires on a plain click", async () => {
    const h = await mount({ requireHold: false });

    // No progress bar in single-click mode.
    expect(testid("hb-progress")).toBeNull();

    act(() => {
      btn().click();
    });
    await flush();
    expect(h.calls()).toBe(1);
  });
});
