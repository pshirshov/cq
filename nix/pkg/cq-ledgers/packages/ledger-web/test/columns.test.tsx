/**
 * ledger-web column-selector test (T61).
 *
 * Drives <App> under happy-dom with the in-memory FakeClient to cover:
 *  1. the `tasks` ledger shows a `suggestedModel` column by default
 *     (seeded from defaultColumns("tasks"));
 *  2. the ⋮ menu lists the schema's eligibleColumnFields as checkboxes, and
 *     toggling one adds/removes the matching column header + cells;
 *  3. the selection persists across a remount (localStorage) and is
 *     independent per ledger.
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

async function mount(): Promise<void> {
  fake = new FakeClient();
  await act(async () => {
    root.render(createElement(App, { connect: async () => fake, initialUrl: "http://x/mcp" }));
  });
  await flush(); // resolve connect + enumerateLedgers
}

async function openLedger(name: string): Promise<void> {
  click(testid(`ledger-${name}`));
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

describe("ledger-web column selector", () => {
  it("shows the suggestedModel column for tasks by default", async () => {
    await mount();
    await openLedger("tasks");
    // Header present (subsection layout — at least one section renders it).
    expect(testid("column-header-suggestedModel")).not.toBeNull();
    // Cell values come from fieldToString of the item field.
    expect(testid("cell-T1-suggestedModel")?.textContent).toBe("opus");
    expect(testid("cell-T2-suggestedModel")?.textContent).toBe("sonnet");
    // A denylisted long field is NOT shown as a default column.
    expect(testid("column-header-description")).toBeNull();
  });

  it("lists eligible fields in the ⋮ menu and toggles a column on/off", async () => {
    await mount();
    await openLedger("tasks");

    click(testid("column-menu-toggle"));
    const popup = testid("column-popup");
    expect(popup).not.toBeNull();
    // Eligible fields offered: suggestedModel, acceptance.
    // headline is excluded (summary-source field); description is excluded (long/narrative);
    // intrinsic id/status are not offered either.
    expect(testid("column-toggle-headline")).toBeNull();
    expect(testid("column-toggle-suggestedModel")).not.toBeNull();
    expect(testid("column-toggle-acceptance")).not.toBeNull();
    expect(testid("column-toggle-description")).toBeNull();

    // suggestedModel is checked (default); acceptance is not.
    expect((testid("column-toggle-suggestedModel") as HTMLInputElement).checked).toBe(true);
    expect((testid("column-toggle-acceptance") as HTMLInputElement).checked).toBe(false);

    // Toggle `acceptance` ON → its header + cell appear.
    click(testid("column-toggle-acceptance"));
    await flush();
    expect(testid("column-header-acceptance")).not.toBeNull();
    expect(testid("cell-T1-acceptance")?.textContent).toBe("renders");

    // Toggle `suggestedModel` OFF → its header + cells disappear.
    click(testid("column-toggle-suggestedModel"));
    await flush();
    expect(testid("column-header-suggestedModel")).toBeNull();
    expect(testid("cell-T1-suggestedModel")).toBeNull();
  });

  it("persists the selection across a remount and keeps it per-ledger", async () => {
    await mount();
    await openLedger("tasks");

    // Customise tasks: turn suggestedModel OFF, acceptance ON.
    click(testid("column-menu-toggle"));
    click(testid("column-toggle-suggestedModel"));
    click(testid("column-toggle-acceptance"));
    await flush();
    expect(testid("column-header-suggestedModel")).toBeNull();
    expect(testid("column-header-acceptance")).not.toBeNull();

    // Remount with a fresh client/root (localStorage NOT cleared) → restored.
    act(() => {
      root.unmount();
    });
    container.remove();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await mount();
    await openLedger("tasks");
    expect(testid("column-header-suggestedModel")).toBeNull();
    expect(testid("column-header-acceptance")).not.toBeNull();

    // The bugs ledger is independent: its default extra columns are none, so
    // no eligible-field headers are shown (only the always-shown columns).
    await openLedger("bugs");
    // `note` is an eligible field for bugs but not a default column.
    expect(testid("column-header-note")).toBeNull();
    expect(testid("column-header-acceptance")).toBeNull();
  });
});
