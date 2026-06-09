/**
 * Docs-style help-body sidebar + scrollspy tests (T328, happy-dom).
 *
 * The Item-States, Flows, and Agents help tabs render a persistent left
 * vertical nav SIDEBAR + a scrolling content pane (the Shortcuts tab does NOT).
 * Each sidebar lists one entry per rendered section, derived from the same
 * source as the section bodies:
 *   - Item-States: one per enumerated ledger schema  → help-item-state-<ledger>
 *   - Flows:       one per ROLE_FLOWS entry           → help-flow-<id>
 *   - Agents:      one per AGENT_ROLES role           → help-agent-<id>
 *
 * Asserts:
 *   (1) each tab's sidebar entry count == its rendered help-*-<id> section count
 *       (and the anchorIds match the documented scheme verbatim);
 *   (2) clicking an entry invokes Element.prototype.scrollIntoView (spied) on the
 *       matching anchor element (exact id);
 *   (3) driving the exposed active-section setter (helpActiveSectionSetters,
 *       since happy-dom lacks IntersectionObserver) marks exactly that entry
 *       with aria-current + the active class — and no other entry;
 *   (4) the Shortcuts tab renders NO sidebar;
 *   (5) scrollToHelpSection is exported and smooth-scrolls a target by anchor id.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, scrollToHelpSection, helpActiveSectionSetters } from "../src/App";
import { FakeClient } from "./fakeClient";
import { ROLE_FLOWS } from "../src/roleActions";
import { AGENT_ROLES } from "../src/agentsCatalogue";

let container: HTMLElement;
let root: Root;
let fake: FakeClient;

const sleep = (ms = 15): Promise<void> => new Promise((r) => setTimeout(r, ms));
async function flush(): Promise<void> {
  await act(async () => {
    await sleep(10);
  });
}
// The Item-States tab fires a batched schema fetch AND an async elk layout per
// diagram; flush a few times so both settle before asserting.
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

beforeEach(() => {
  localStorage.clear();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  helpActiveSectionSetters.clear();
});

// happy-dom has no Element.prototype.scrollIntoView; install a spy that records
// the receiver element, restored after each assertion block by the caller.
function spyScrollIntoView(): { calls: Element[]; restore: () => void } {
  const calls: Element[] = [];
  const proto = Element.prototype as unknown as Record<string, unknown>;
  const prev = proto["scrollIntoView"];
  proto["scrollIntoView"] = function (this: Element): void {
    calls.push(this);
  };
  return {
    calls,
    restore: () => {
      proto["scrollIntoView"] = prev;
    },
  };
}

describe("help docs sidebar + scrollspy (T328)", () => {
  it("Item-States: sidebar entry count == rendered section count; entries match the ledger anchors", async () => {
    await mount();
    press("?");
    await flush();
    click(testid("help-tab-item-states"));
    await settle();

    const nav = testid("help-nav-item-states");
    expect(nav).not.toBeNull();

    const ledgers = (await fake.enumerateLedgers()).map((l) => l.name);
    const sections = container.querySelectorAll('[data-testid^="help-item-state-"]');
    // Only top-level <section> anchors (filter out svg/node/edge sub-testids).
    const sectionAnchors = Array.from(sections).filter((el) => el.tagName.toLowerCase() === "section");
    expect(sectionAnchors).toHaveLength(ledgers.length);

    const entries = container.querySelectorAll('[data-testid^="help-nav-entry-help-item-state-"]');
    expect(entries).toHaveLength(ledgers.length);
    for (const name of ledgers) {
      expect(testid(`help-nav-entry-help-item-state-${name}`)).not.toBeNull();
      // The section carries a DOM id equal to its anchor/testid.
      expect(container.querySelector(`section#help-item-state-${name}`)).not.toBeNull();
    }
  });

  it("Flows: one entry per ROLE_FLOWS; clicking an entry scrolls the matching anchor", async () => {
    await mount();
    press("?");
    await flush();
    click(testid("help-tab-flows"));
    await settle();

    const entries = container.querySelectorAll('[data-testid^="help-nav-entry-help-flow-"]');
    expect(entries).toHaveLength(ROLE_FLOWS.length);

    const spy = spyScrollIntoView();
    try {
      const target = ROLE_FLOWS[1]!; // investigate
      click(testid(`help-nav-entry-help-flow-${target.id}`));
      expect(spy.calls).toHaveLength(1);
      // The scrolled element is exactly the matching section anchor.
      const expected = container.querySelector(`section#help-flow-${target.id}`);
      expect(expected).not.toBeNull();
      expect(spy.calls[0]).toBe(expected!);
    } finally {
      spy.restore();
    }
  });

  it("Agents: one entry per AGENT_ROLES role; each role renders a help-agent-<id> section", async () => {
    await mount();
    press("?");
    await flush();
    click(testid("help-tab-agents"));
    await flush();

    const entries = container.querySelectorAll('[data-testid^="help-nav-entry-help-agent-"]');
    expect(entries).toHaveLength(AGENT_ROLES.length);
    for (const role of AGENT_ROLES) {
      expect(testid(`help-nav-entry-help-agent-${role.id}`)).not.toBeNull();
      expect(container.querySelector(`section[id="help-agent-${role.id}"]`)).not.toBeNull();
    }

    // Clicking an entry scrolls the matching anchor.
    const spy = spyScrollIntoView();
    try {
      const role = AGENT_ROLES[0]!;
      click(testid(`help-nav-entry-help-agent-${role.id}`));
      expect(spy.calls).toHaveLength(1);
      expect(spy.calls[0]).toBe(container.querySelector(`section[id="help-agent-${role.id}"]`)!);
    } finally {
      spy.restore();
    }
  });

  it("driving the exposed active-section setter marks exactly that entry aria-current/active", async () => {
    await mount();
    press("?");
    await flush();
    click(testid("help-tab-flows"));
    await settle();

    const setActive = helpActiveSectionSetters.get("flows");
    expect(setActive).toBeDefined();

    const target = ROLE_FLOWS[2]!; // implement
    act(() => {
      setActive!(`help-flow-${target.id}`);
    });

    for (const flow of ROLE_FLOWS) {
      const entry = testid(`help-nav-entry-help-flow-${flow.id}`)!;
      const isTarget = flow.id === target.id;
      expect(entry.getAttribute("aria-current")).toBe(isTarget ? "true" : null);
      expect(entry.classList.contains("lw-help-nav-entry-active")).toBe(isTarget);
    }
  });

  it("the Shortcuts tab renders NO sidebar", async () => {
    await mount();
    press("?");
    await flush();
    // Shortcuts is the default tab.
    expect(testid("help-shortcuts")).not.toBeNull();
    expect(testid("help-nav-shortcuts")).toBeNull();
    expect(container.querySelector(".lw-help-nav")).toBeNull();
    expect(container.querySelector(".lw-help-docs")).toBeNull();
  });

  it("scrollToHelpSection smooth-scrolls a target element by anchor id", async () => {
    const el = document.createElement("section");
    el.id = "help-flow-plan";
    container.appendChild(el);
    const spy = spyScrollIntoView();
    try {
      scrollToHelpSection("help-flow-plan");
      expect(spy.calls).toHaveLength(1);
      expect(spy.calls[0]).toBe(el);
      // A missing target is a no-op.
      scrollToHelpSection("help-flow-does-not-exist");
      expect(spy.calls).toHaveLength(1);
    } finally {
      spy.restore();
      el.remove();
    }
  });
});
