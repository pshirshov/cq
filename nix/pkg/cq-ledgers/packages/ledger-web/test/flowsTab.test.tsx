/**
 * Flows help-tab render test (T205, happy-dom).
 *
 * Drives the new third HelpOverlay tab end-to-end and asserts:
 *   (1) the third tab button exists (`help-tab-flows`) and is selectable
 *       (aria-selected flips on click);
 *   (2) selecting it renders a <section> + DiagramSvg for each of the four
 *       flows under the documented T202 testid scheme
 *       (`help-flow-${id}` section + `help-flow-${id}-svg` svg +
 *       `help-flow-${id}-node-${nodeId}`);
 *   (3) a labelled cross-flow handoff edge in the advance overview renders its
 *       edge-label <text> (the actually-emitted `…-edge-label-${from}-${to}`
 *       id from DiagramSvg), with the label text present;
 *   (4) Esc and `?` still close the dialog (capture behavior unchanged).
 *
 * Pure-data: layout is elkjs (no getBBox / ResizeObserver / DOMMatrix).
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App } from "../src/App";
import { FakeClient } from "./fakeClient";
import { FLOWS, HANDOFF_SEED_GOAL_TO_PLAN } from "../src/flowData";

let container: HTMLElement;
let root: Root;
let fake: FakeClient;

const sleep = (ms = 15): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function flush(): Promise<void> {
  await act(async () => {
    await sleep(10);
  });
}
// The tab runs an async elk layout per flow; flush a few times so all settle.
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await flush();
}
const q = (sel: string): HTMLElement | null => container.querySelector(sel);
const testid = (id: string): HTMLElement | null => q(`[data-testid="${id}"]`);

function click(el: Element | null): void {
  if (el === null) throw new Error("click: element not found");
  act(() => {
    (el as HTMLElement).click();
  });
}
function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

async function mount(): Promise<void> {
  fake = new FakeClient();
  await act(async () => {
    root.render(createElement(App, { connect: async () => fake, initialUrl: "http://x/mcp" }));
  });
  await flush();
}

async function openFlowsTab(): Promise<void> {
  await mount();
  press("?");
  await flush();
  click(testid("help-tab-flows"));
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("Flows tab (T205)", () => {
  it("exposes a selectable third tab button", async () => {
    await mount();
    press("?");
    await flush();

    const btn = testid("help-tab-flows");
    expect(btn).not.toBeNull();
    expect(btn!.getAttribute("aria-selected")).toBe("false");

    click(btn);
    await settle();
    expect(testid("help-tab-flows")!.getAttribute("aria-selected")).toBe("true");
    expect(testid("help-flows")).not.toBeNull();
  });

  it("renders a section + DiagramSvg for each of the four flows", async () => {
    await openFlowsTab();

    expect(FLOWS.map((f) => f.id)).toEqual(["plan", "investigate", "implement", "advance"]);
    for (const flow of FLOWS) {
      // Per-flow section container.
      expect(testid(`help-flow-${flow.id}`)).not.toBeNull();
      // Exactly ONE svg per flow (idPrefix `help-flow-${flow.id}`).
      const svgs = container.querySelectorAll(`[data-testid="help-flow-${flow.id}-svg"]`);
      expect(svgs).toHaveLength(1);
      // Every node of the flow renders under the documented scheme.
      for (const n of flow.nodes) {
        expect(testid(`help-flow-${flow.id}-node-${n.id}`)).not.toBeNull();
      }
    }
  });

  it("renders the advance overview's labelled cross-flow handoff edge", async () => {
    await openFlowsTab();

    const { from, to } = HANDOFF_SEED_GOAL_TO_PLAN;
    // The polyline edge for the seed-goal → plan handoff.
    expect(testid(`help-flow-advance-edge-${from}-${to}`)).not.toBeNull();
    // …and its rendered edge-label <text> (the actually-emitted T202 id).
    const label = testid(`help-flow-advance-edge-label-${from}-${to}`);
    expect(label).not.toBeNull();
    expect(label!.textContent).toContain("seed-goal");
  });

  it("still closes the dialog on Esc and on ?", async () => {
    await openFlowsTab();
    expect(testid("help-overlay")).not.toBeNull();
    press("Escape");
    await flush();
    expect(testid("help-overlay")).toBeNull();

    // Re-open on the Flows tab and close with `?`.
    await openFlowsTab();
    expect(testid("help-overlay")).not.toBeNull();
    press("?");
    await flush();
    expect(testid("help-overlay")).toBeNull();
  });
});
