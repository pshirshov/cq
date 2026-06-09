/**
 * Flows help-tab render test (T316, happy-dom).
 *
 * The Flows tab now renders the hand-authored role→actions catalogue
 * ({@link ROLE_FLOWS}) instead of the abstract ledger state-machines: each
 * flow's diagram shows ROLE nodes (orchestrator, planner, reviewer, worker, …)
 * connected by labelled ACTION edges (e.g. 'returns verdict', 'merges by SHA').
 *
 * Drives the third HelpOverlay tab end-to-end and asserts:
 *   (1) the third tab button exists (`help-tab-flows`) and is selectable
 *       (aria-selected flips on click);
 *   (2) selecting it renders a <section> + DiagramSvg for each of the four
 *       flows under the documented T202 testid scheme
 *       (`help-flow-${id}` section + `help-flow-${id}-svg` svg +
 *       `help-flow-${id}-node-${nodeId}`);
 *   (3) per flow the SVG carries its ROLE labels (e.g. 'planner', 'reviewer',
 *       'orchestrator') and ≥1 labelled ACTION edge (e.g. 'returns verdict' /
 *       'merges by SHA') — the prior bare state-node labels (clarifying,
 *       planning, root-caused, …) are NO LONGER the Flows-tab content;
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
import { ROLE_FLOWS } from "../src/roleActions";

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

// The full text content of one flow's rendered SVG (node + edge labels).
function flowText(id: string): string {
  const svg = testid(`help-flow-${id}-svg`);
  if (svg === null) throw new Error(`flow svg not found: ${id}`);
  return svg.textContent ?? "";
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

describe("Flows tab (T316 — roles & actions)", () => {
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

    expect(ROLE_FLOWS.map((f) => f.id)).toEqual(["plan", "investigate", "implement", "advance"]);
    for (const flow of ROLE_FLOWS) {
      // Per-flow section container.
      expect(testid(`help-flow-${flow.id}`)).not.toBeNull();
      // Exactly ONE svg per flow (idPrefix `help-flow-${flow.id}`).
      const svgs = container.querySelectorAll(`[data-testid="help-flow-${flow.id}-svg"]`);
      expect(svgs).toHaveLength(1);
      // Every role node of the flow renders under the documented scheme.
      for (const n of flow.model.nodes) {
        expect(testid(`help-flow-${flow.id}-node-${n.id}`)).not.toBeNull();
      }
    }
  });

  it("each flow's SVG carries its role labels and ≥1 action-edge label", async () => {
    await openFlowsTab();

    for (const flow of ROLE_FLOWS) {
      const text = flowText(flow.id);
      // Every role node's label appears in the rendered SVG.
      for (const n of flow.model.nodes) {
        expect(text).toContain(n.label);
      }
      // At least one labelled action edge renders its <text> label.
      const labelledEdges = flow.model.edges.filter((e) => e.label !== undefined);
      expect(labelledEdges.length).toBeGreaterThan(0);
      let renderedLabels = 0;
      for (const e of labelledEdges) {
        if (testid(`help-flow-${flow.id}-edge-label-${e.from}-${e.to}`) !== null) renderedLabels++;
      }
      expect(renderedLabels).toBeGreaterThan(0);
    }
  });

  it("renders the canonical role + action labels (planner/reviewer/orchestrator; returns verdict; merges by SHA)", async () => {
    await openFlowsTab();

    // Plan flow shows the planner↔reviewer↔orchestrator roles.
    const planText = flowText("plan");
    expect(planText).toContain("orchestrator");
    expect(planText).toContain("planner");
    expect(planText).toContain("reviewer");
    // …and the reviewer's 'returns verdict' action edge.
    const planVerdict = testid("help-flow-plan-edge-label-reviewer-orchestrator");
    expect(planVerdict).not.toBeNull();
    expect(planVerdict!.textContent).toContain("returns verdict");

    // Implement flow shows the worker role and the 'merges by SHA' action.
    const implText = flowText("implement");
    expect(implText).toContain("worker");
    const mergeEdge = testid("help-flow-implement-edge-label-orchestrator-main");
    expect(mergeEdge).not.toBeNull();
    expect(mergeEdge!.textContent).toContain("merges by SHA");
  });

  it("no longer renders the prior bare ledger state-node labels", async () => {
    await openFlowsTab();

    // The old flowData state nodes (clarifying / root-caused / quiescent) were
    // the previous Flows-tab content; the roles & actions render replaces them.
    const allFlowsText = ROLE_FLOWS.map((f) => flowText(f.id)).join("\n");
    for (const stale of ["clarifying", "root-caused", "quiescent", "awaiting answers"]) {
      expect(allFlowsText).not.toContain(stale);
    }
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
