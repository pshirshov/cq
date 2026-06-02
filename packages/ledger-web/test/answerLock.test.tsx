/**
 * Tests for T88 / Web #15: disable 'as recommended' and per-suggestion 'pick'
 * buttons once the answer textarea contains non-whitespace text.
 *
 * The answer textarea is UNCONTROLLED (ref + defaultValue). Under happy-dom,
 * onInput fires when the textarea value is set via the native property setter
 * and a synthetic input event is dispatched — the same pattern used by
 * setValue() in app.test.tsx. Controlled-input onChange does NOT fire, but
 * onInput on uncontrolled textareas DOES (per CLAUDE.md).
 *
 * Covered:
 * - Detail panel: typing non-whitespace disables 'as recommended' and all
 *   per-suggestion 'pick' buttons.
 * - Detail panel: clearing the field (or whitespace-only) re-enables them.
 * - Detail panel: switching to a different item resets the lock.
 * - Batch modal: typing non-whitespace disables 'as recommended'.
 * - Batch modal: clearing re-enables it.
 * - Batch modal: navigating to the next question resets the lock.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../src/App";
import { FakeClient } from "./fakeClient";

let container: HTMLElement;
let root: Root;
let fake: FakeClient;

const sleep = (ms = 15): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function flush(): Promise<void> {
  await act(async () => {
    await sleep(10);
  });
}

const q = (sel: string): HTMLElement | null => container.querySelector(sel);
const testid = (id: string): HTMLElement | null => q(`[data-testid="${id}"]`);

function click(el: Element | null): void {
  if (el === null) throw new Error("click: element not found");
  act(() => {
    (el as HTMLElement).click();
  });
}

/**
 * Fire onInput on an uncontrolled textarea by setting its value via the native
 * property descriptor and dispatching a synthetic input event (happy-dom safe).
 */
function fireInput(el: Element | null, value: string): void {
  if (el === null) throw new Error("fireInput: element not found");
  act(() => {
    const node = el as HTMLTextAreaElement;
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value");
    desc?.set?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function mount(): Promise<void> {
  fake = new FakeClient();
  await act(async () => {
    root.render(createElement(App, { connect: async () => fake, initialUrl: "http://x/mcp" }));
  });
  await flush();
}

beforeEach(() => {
  localStorage.clear();
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

// ---------------------------------------------------------------------------
// Detail panel
// ---------------------------------------------------------------------------

describe("detail panel answer lock (T88 / Web #15)", () => {
  it("'as recommended' is enabled initially (no text typed)", async () => {
    await mount();
    // Q1 has a recommendation; open it.
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();

    const btn = testid("answer-as-recommended");
    expect(btn).not.toBeNull();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("typing non-whitespace disables 'as recommended'", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();

    fireInput(testid("answer-input"), "my answer");
    await flush();

    const btn = testid("answer-as-recommended");
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("whitespace-only input does NOT disable 'as recommended'", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();

    fireInput(testid("answer-input"), "   ");
    await flush();

    const btn = testid("answer-as-recommended");
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("clearing the field after typing re-enables 'as recommended'", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();

    // Type something → disabled.
    fireInput(testid("answer-input"), "draft text");
    await flush();
    expect((testid("answer-as-recommended") as HTMLButtonElement).disabled).toBe(true);

    // Clear → re-enabled.
    fireInput(testid("answer-input"), "");
    await flush();
    expect((testid("answer-as-recommended") as HTMLButtonElement).disabled).toBe(false);
  });

  it("typing non-whitespace disables all per-suggestion 'pick' buttons", async () => {
    await mount();
    // Q2 has suggestions but no recommendation; open it.
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q2"));
    await flush();

    // Buttons should be enabled initially.
    expect((testid("answer-pick-suggestion-0") as HTMLButtonElement).disabled).toBe(false);
    expect((testid("answer-pick-suggestion-1") as HTMLButtonElement).disabled).toBe(false);
    expect((testid("answer-pick-suggestion-2") as HTMLButtonElement).disabled).toBe(false);

    fireInput(testid("answer-input"), "x");
    await flush();

    expect((testid("answer-pick-suggestion-0") as HTMLButtonElement).disabled).toBe(true);
    expect((testid("answer-pick-suggestion-1") as HTMLButtonElement).disabled).toBe(true);
    expect((testid("answer-pick-suggestion-2") as HTMLButtonElement).disabled).toBe(true);
  });

  it("clearing the field re-enables per-suggestion 'pick' buttons", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q2"));
    await flush();

    fireInput(testid("answer-input"), "draft");
    await flush();
    expect((testid("answer-pick-suggestion-0") as HTMLButtonElement).disabled).toBe(true);

    fireInput(testid("answer-input"), "");
    await flush();
    expect((testid("answer-pick-suggestion-0") as HTMLButtonElement).disabled).toBe(false);
  });

  it("switching to a different item resets the lock", async () => {
    await mount();
    // Open Q3 which has both suggestions and a recommendation.
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q3"));
    await flush();

    // Type into Q3's answer → lock.
    fireInput(testid("answer-input"), "typing here");
    await flush();
    expect((testid("answer-as-recommended") as HTMLButtonElement).disabled).toBe(true);

    // Switch to Q1 → lock must reset.
    click(testid("item-Q1"));
    await flush();

    const btn = testid("answer-as-recommended");
    expect(btn).not.toBeNull();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Batch modal
// ---------------------------------------------------------------------------

describe("batch modal answer lock (T88 / Web #15)", () => {
  it("'as recommended' in batch modal is enabled initially", async () => {
    await mount();
    // Open the batch modal; Q1 (index 0) has a recommendation.
    click(testid("batch-open"));
    await flush();

    const btn = testid("batch-answer-as-recommended");
    expect(btn).not.toBeNull();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it("typing non-whitespace disables batch 'as recommended'", async () => {
    await mount();
    click(testid("batch-open"));
    await flush();

    fireInput(testid("batch-answer-input"), "my batch answer");
    await flush();

    expect((testid("batch-answer-as-recommended") as HTMLButtonElement).disabled).toBe(true);
  });

  it("whitespace-only does NOT disable batch 'as recommended'", async () => {
    await mount();
    click(testid("batch-open"));
    await flush();

    fireInput(testid("batch-answer-input"), "  \n  ");
    await flush();

    expect((testid("batch-answer-as-recommended") as HTMLButtonElement).disabled).toBe(false);
  });

  it("clearing the batch field re-enables 'as recommended'", async () => {
    await mount();
    click(testid("batch-open"));
    await flush();

    fireInput(testid("batch-answer-input"), "draft");
    await flush();
    expect((testid("batch-answer-as-recommended") as HTMLButtonElement).disabled).toBe(true);

    fireInput(testid("batch-answer-input"), "");
    await flush();
    expect((testid("batch-answer-as-recommended") as HTMLButtonElement).disabled).toBe(false);
  });

  it("navigating to next question in batch modal resets the lock", async () => {
    await mount();
    click(testid("batch-open"));
    await flush();

    // Q1 is first (has recommendation). Type something → lock.
    fireInput(testid("batch-answer-input"), "my draft");
    await flush();
    expect((testid("batch-answer-as-recommended") as HTMLButtonElement).disabled).toBe(true);

    // Navigate to next; Q3 (index 2) has a recommendation.
    // Navigate forward until we land on a question with a recommendation.
    click(testid("batch-next"));
    await flush();
    click(testid("batch-next"));
    await flush();

    // After navigation the lock must be reset even if we land on a question
    // with a recommendation.
    const btn = testid("batch-answer-as-recommended");
    // Q3 has a recommendation so the button should exist.
    expect(btn).not.toBeNull();
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });
});
