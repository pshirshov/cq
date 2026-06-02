/**
 * ledger-web UI test.
 *
 * Renders <App> under happy-dom with the in-memory FakeClient and drives the
 * DOM (clicks + controlled-input changes) to cover navigation (ledgers →
 * items → detail), status editing, milestone creation, and search.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { App, clampPanelSize } from "../src/App";
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
const text = (): string => container.textContent ?? "";

function click(el: Element | null): void {
  if (el === null) throw new Error("click: element not found");
  act(() => {
    (el as HTMLElement).click();
  });
}
function setValue(el: Element | null, value: string): void {
  if (el === null) throw new Error("setValue: element not found");
  act(() => {
    const node = el as HTMLInputElement | HTMLSelectElement;
    node.focus();
    const desc = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), "value");
    desc?.set?.call(node, value);
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
/** Dispatch a document-level keydown (drives the global keyboard nav). */
function press(key: string): void {
  act(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}
/** Dispatch a keydown on a specific element (drives element-level onKeyDown). */
function pressOn(el: Element | null, key: string): void {
  if (el === null) throw new Error("pressOn: element not found");
  act(() => {
    el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}
async function mount(): Promise<void> {
  fake = new FakeClient();
  await act(async () => {
    root.render(createElement(App, { connect: async () => fake, initialUrl: "http://x/mcp" }));
  });
  await flush(); // resolve connect + enumerateLedgers
}

beforeEach(() => {
  // Isolate persisted UI state (panel layout + restored view) across tests.
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

describe("ledger-web App", () => {
  it("connects and lists ledgers", async () => {
    await mount();
    expect(testid("conn-status")?.textContent).toContain("connected");
    expect(testid("ledger-bugs")).not.toBeNull();
    expect(testid("ledger-milestones")).not.toBeNull();
  });

  it("shows each ledger's item count in the sidebar", async () => {
    await mount();
    // FakeClient: bugs has 2 items (M1/D1 + M2/D3); plain/milestones have 1.
    expect(testid("ledger-count-bugs")?.textContent).toBe("2");
    expect(testid("ledger-count-milestones")?.textContent).toBe("1");
    expect(testid("ledger-count-plain")?.textContent).toBe("1");
  });

  it("persists the current view (ledger + item) to localStorage as you navigate", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    const saved = JSON.parse(localStorage.getItem("ledger-web.view") ?? "{}") as {
      ledger?: string;
      itemId?: string;
      mainView?: string;
    };
    expect(saved.ledger).toBe("bugs");
    expect(saved.itemId).toBe("D1");
    expect(saved.mainView).toBe("ledger");
  });

  it("restores the saved ledger + item on load (reload persistence)", async () => {
    localStorage.setItem(
      "ledger-web.view",
      JSON.stringify({ ledger: "bugs", itemId: "D1", mainView: "ledger" }),
    );
    await mount();
    await flush();
    // The restored ledger's items render and the saved item is selected.
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("detail-id")?.textContent).toBe("D1");
  });

  it("restores graph mode on load", async () => {
    localStorage.setItem(
      "ledger-web.view",
      JSON.stringify({ ledger: "bugs", itemId: null, mainView: "dag" }),
    );
    await mount();
    await flush();
    expect(testid("toggle-dag")?.className).toContain("lw-toggle-active");
  });

  it("opens a ledger and shows its items", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    expect(testid("item-D1")).not.toBeNull();
    expect(text()).toContain("warp leak");
  });

  it("colorizes the status badge and filters items by status type", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    // D1 is "open" → non-terminal "start" bucket badge.
    expect(testid("status-D1")?.className).toContain("lw-status-start");

    // Filter to terminal: D1 (open) drops out, table shows the empty state.
    setValue(testid("status-filter"), "terminal");
    await flush();
    expect(testid("item-D1")).toBeNull();
    expect(text()).toContain("(no items)");

    // Filter to active: D1 returns.
    setValue(testid("status-filter"), "active");
    await flush();
    expect(testid("item-D1")).not.toBeNull();
  });

  it("answers a question and resolves it in one action", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();
    expect(testid("answer-box")).not.toBeNull();
    setValue(testid("answer-input"), "ship it");
    click(testid("answer-submit"));
    await flush();
    const q = await fake.fetchItem("questions", "Q1");
    expect(q.status).toBe("answered");
    expect(q.fields["answer"]).toBe("ship it");
  });

  it("answers a question 'as recommended' with one click", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();
    click(testid("answer-as-recommended"));
    await flush();
    const q = await fake.fetchItem("questions", "Q1");
    expect(q.status).toBe("answered");
    expect(q.fields["answer"]).toBe("as recommended");
  });

  it("renders a question with a highlighted recommendation and fixed field order", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q1"));
    await flush();

    // The recommendation is rendered in a highlighted block.
    const rec = testid("recommendation");
    expect(rec).not.toBeNull();
    expect(rec?.classList.contains("lw-recommendation")).toBe(true);

    // DOM order: question → context → recommendation → answer (the editable box,
    // since Q1 is open/answerable).
    const question = testid("detail-field-question");
    const context = testid("detail-field-context");
    const recommendation = testid("detail-field-recommendation");
    const answer = testid("answer-box");
    for (const el of [question, context, recommendation, answer]) expect(el).not.toBeNull();
    const follows = (a: HTMLElement | null, b: HTMLElement | null): boolean =>
      (a!.compareDocumentPosition(b!) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(question, context)).toBe(true);
    expect(follows(context, recommendation)).toBe(true);
    expect(follows(recommendation, answer)).toBe(true);
  });

  it("renders suggestions string[] as a bulleted list (three <li> entries)", async () => {
    await mount();
    click(testid("ledger-questions"));
    await flush();
    click(testid("item-Q2"));
    await flush();
    const dd = testid("detail-field-suggestions");
    expect(dd).not.toBeNull();
    const items = dd?.querySelectorAll("li");
    expect(items?.length).toBe(3);
    expect(items?.[0]?.textContent).toBe("opt a");
    expect(items?.[1]?.textContent).toBe("opt b");
    expect(items?.[2]?.textContent).toBe("opt c");
    // Must NOT be a joined comma string.
    expect(dd?.textContent).not.toContain("opt a, opt b");
  });

  it("opens item detail when a row is clicked", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    expect(testid("detail-id")?.textContent).toBe("D1");
    expect(testid("detail-status")?.textContent).toBe("open");
    // string field values render as markdown ("**intermittent** glitch")
    const strong = testid("detail-field-note")?.querySelector("strong");
    expect(strong?.textContent).toBe("intermittent");
  });

  it("edits status + a field through the edit form and persists", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    // view mode → click Edit → form appears
    click(testid("edit"));
    await flush();
    expect(testid("edit-form")).not.toBeNull();
    setValue(testid("edit-status"), "wip");
    setValue(testid("edit-field-headline"), "warp leak fixed");
    click(testid("save"));
    await flush();
    const item = await fake.fetchItem("bugs", "D1");
    expect(item.status).toBe("wip");
    expect(item.fields["headline"]).toBe("warp leak fixed");
    // back in view mode, reflecting the saved values
    expect(testid("edit-form")).toBeNull();
    expect(testid("detail-status")?.textContent).toBe("wip");
    // a human edit stamps author="user", surfaced in the provenance line
    expect(item.author).toBe("user");
    expect(testid("detail-provenance")?.textContent).toContain("user");
  });

  it("renders guard-aligned quick-transition buttons and applies one on click", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1")); // D1 is "open" → transitions[open] = [wip, closed]
    await flush();
    // One button per legal target; the illegal self-status "open" is absent.
    expect(testid("transitions")).not.toBeNull();
    expect(testid("transition-wip")).not.toBeNull();
    expect(testid("transition-closed")).not.toBeNull();
    expect(testid("transition-open")).toBeNull();
    // Click "wip": issues the update with the target status, preserving fields.
    click(testid("transition-wip"));
    await flush();
    const item = await fake.fetchItem("bugs", "D1");
    expect(item.status).toBe("wip");
    expect(item.fields["headline"]).toBe("warp leak"); // unchanged
    expect(item.author).toBe("user"); // stamped via the existing update path
    expect(testid("detail-status")?.textContent).toBe("wip");
  });

  it("shows no quick-transition buttons from a terminal status ([])", async () => {
    await mount();
    // Move D1 to the terminal status first.
    await fake.updateItem("bugs", "D1", { status: "closed" });
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    expect(testid("detail-status")?.textContent).toBe("closed");
    expect(testid("transitions")).toBeNull(); // transitions[closed] = [] → none
  });

  it("shows no quick-transition buttons for a ledger without a map", async () => {
    await mount();
    click(testid("ledger-plain"));
    await flush();
    click(testid("item-P1"));
    await flush();
    expect(testid("detail-status")?.textContent).toBe("open");
    expect(testid("transitions")).toBeNull(); // no map → existing editor only
    expect(testid("edit")).not.toBeNull(); // the existing status editor is intact
  });

  it("cancels an edit without saving", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    click(testid("edit"));
    await flush();
    setValue(testid("edit-field-headline"), "should not stick");
    click(testid("cancel-edit"));
    await flush();
    expect(testid("edit-form")).toBeNull();
    expect((await fake.fetchItem("bugs", "D1")).fields["headline"]).toBe("warp leak");
  });

  it("creates a milestone in the milestones ledger", async () => {
    await mount();
    click(testid("ledger-milestones"));
    await flush();
    click(testid("new-item-or-milestone"));
    await flush();
    setValue(testid("ms-title"), "Phase Two");
    click(testid("ms-create"));
    await flush();
    expect(testid("flash")?.textContent).toContain("created M2");
    const ms = await fake.fetchLedger("milestones");
    const titles = ms.milestones.flatMap((g) => g.items.map((i) => i.fields["title"]));
    expect(titles).toContain("Phase Two");
  });

  it("creates an item through the shared editor (new item reuses the edit panel)", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("new-item-or-milestone"));
    await flush(); // editor opens in create mode + loads milestones
    // It is the same editor as edit mode: same form + a milestone picker.
    expect(testid("edit-form")).not.toBeNull();
    expect(testid("edit-milestone")).not.toBeNull();
    expect(testid("detail-id")?.textContent).toBe("new item");
    setValue(testid("edit-field-headline"), "ion drive misalignment");
    click(testid("save"));
    await flush();
    const ledger = await fake.fetchLedger("bugs");
    const headlines = ledger.milestones.flatMap((g) => g.items.map((i) => i.fields["headline"]));
    expect(headlines).toContain("ion drive misalignment");
  });

  it("searches across ledgers as you type and opens a hit into detail", async () => {
    await mount();
    // As-you-type: typing into the box debounces, then runs the search — no
    // button. Wait past the debounce window.
    setValue(testid("search-input"), "warp");
    await act(async () => {
      await sleep(260);
    });
    expect(testid("search-results")).not.toBeNull();
    expect(testid("hit-D1")).not.toBeNull();
    click(testid("hit-D1"));
    await flush();
    expect(testid("detail-id")?.textContent).toBe("D1");
  });

  it("clears search results when the box is emptied", async () => {
    // The query language itself (status:/ledger:/OR/…) is exercised server-side
    // in the library tests; here we only assert the as-you-type UX: a match
    // shows results, and clearing the input leaves search mode.
    await mount();
    setValue(testid("search-input"), "warp");
    await act(async () => {
      await sleep(260);
    });
    expect(testid("search-results")).not.toBeNull();
    setValue(testid("search-input"), "");
    await act(async () => {
      await sleep(260);
    });
    expect(testid("search-results")).toBeNull();
  });

  it("toggles the detail-panel orientation and persists it to localStorage", async () => {
    localStorage.removeItem("ledger-web.panel");
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1")); // selecting an item shows the panel + splitter
    await flush();
    expect(q(".lw-workarea-right")).not.toBeNull();
    expect(testid("splitter")).not.toBeNull();
    click(testid("panel-orientation"));
    await flush();
    expect(q(".lw-workarea-bottom")).not.toBeNull();
    const saved = JSON.parse(localStorage.getItem("ledger-web.panel") ?? "{}") as { orientation?: string };
    expect(saved.orientation).toBe("bottom");
  });

  it("hides the MCP URL/connect behind a gear popup", async () => {
    await mount();
    expect(testid("mcp-url")).toBeNull(); // not shown until the gear is opened
    click(testid("settings-toggle"));
    await flush();
    expect(testid("mcp-url")).not.toBeNull();
    expect(testid("connect")).not.toBeNull();
    click(testid("settings-toggle"));
    await flush();
    expect(testid("mcp-url")).toBeNull(); // toggles closed
  });

  it("in edit mode shows save/cancel in the header and hides close", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("item-D1"));
    await flush();
    expect(testid("detail-close")).not.toBeNull(); // view mode: close present
    click(testid("edit"));
    await flush();
    expect(testid("save")).not.toBeNull();
    expect(testid("cancel-edit")).not.toBeNull();
    expect(testid("detail-close")).toBeNull(); // close hidden while editing
    expect(testid("edit")).toBeNull();
  });

  // ---- milestone subsections (Req2) + milestone filter (Req3) ----

  it("renders per-milestone collapsible subsections for non-milestones ledgers", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    // Both milestone groups from FakeClient appear as sections.
    expect(testid("ms-section-M1")).not.toBeNull();
    expect(testid("ms-section-M2")).not.toBeNull();
    // The header text carries id + title + status.
    expect(testid("ms-toggle-M1")?.textContent).toContain("M1");
    expect(testid("ms-toggle-M1")?.textContent).toContain("Bootstrap");
    expect(testid("ms-toggle-M2")?.textContent).toContain("M2");
    expect(testid("ms-toggle-M2")?.textContent).toContain("Phase Two");
    // Items from each group are visible by default (expanded).
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).not.toBeNull();
    // No per-row milestone column (the subsection header carries it): table has
    // id/status/summary columns only (not milestone).
    const ths = container.querySelectorAll(".lw-table th");
    const colNames = Array.from(ths).map((th) => th.textContent?.trim());
    expect(colNames).not.toContain("milestone");
  });

  it("milestones ledger keeps the flat milestone-column table (no subsections)", async () => {
    await mount();
    click(testid("ledger-milestones"));
    await flush();
    // The milestones ledger must NOT render subsection headers.
    expect(testid("ms-toggle-active")).toBeNull();
    // But it must still show items and the milestone column.
    expect(testid("item-M1")).not.toBeNull();
    const ths = container.querySelectorAll(".lw-table th");
    const colNames = Array.from(ths).map((th) => th.textContent?.trim());
    expect(colNames).toContain("milestone");
  });

  it("collapses and expands a milestone subsection on header click", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    // D1 is in M1 (expanded by default).
    expect(testid("item-D1")).not.toBeNull();
    // Click the M1 toggle → collapses; D1 disappears.
    click(testid("ms-toggle-M1"));
    await flush();
    expect(testid("item-D1")).toBeNull();
    // D3 (M2) is still visible.
    expect(testid("item-D3")).not.toBeNull();
    // Click again → expands; D1 returns.
    click(testid("ms-toggle-M1"));
    await flush();
    expect(testid("item-D1")).not.toBeNull();
  });

  it("milestone dropdown is present for non-milestones ledgers and absent for milestones", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    expect(testid("milestone-filter")).not.toBeNull();
    click(testid("ledger-milestones"));
    await flush();
    expect(testid("milestone-filter")).toBeNull();
  });

  it("milestone dropdown narrows to a single milestone and ANDs with the status filter", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    // Both items visible initially.
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).not.toBeNull();
    // Filter to M1 only: D3 (M2) disappears.
    setValue(testid("milestone-filter"), "M1");
    await flush();
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).toBeNull();
    // AND with status=terminal: D1 (open) also drops out → (no items).
    setValue(testid("status-filter"), "terminal");
    await flush();
    expect(testid("item-D1")).toBeNull();
    expect(text()).toContain("(no items)");
    // Reset status filter: D1 returns.
    setValue(testid("status-filter"), "all");
    await flush();
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).toBeNull(); // M2 still filtered out
  });

  it("milestone filter resets when switching to a different ledger", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    setValue(testid("milestone-filter"), "M1");
    await flush();
    expect(testid("item-D3")).toBeNull(); // M2 hidden
    // Switch to plain ledger and back: the milestone filter should be reset.
    click(testid("ledger-plain"));
    await flush();
    click(testid("ledger-bugs"));
    await flush();
    // Both D1 and D3 visible again (filter cleared).
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).not.toBeNull();
  });

  // ---- summarize() + badge/summary-cell styling (Req5) ----

  it("shows the summary field for modern reviews (has summary)", async () => {
    await mount();
    click(testid("ledger-reviews"));
    await flush();
    // R2 has a summary field — it should appear as the cell text.
    const row = testid("item-R2");
    expect(row).not.toBeNull();
    // The text of the row should contain the summary, not a joined criticism string.
    expect(row?.textContent).toContain("Looks good overall");
    expect(row?.textContent).not.toContain("Minor nit only");
  });

  it("shows a truncated single-line fallback for legacy reviews with no summary", async () => {
    await mount();
    click(testid("ledger-reviews"));
    await flush();
    // R1 has no summary field — should show the first criticism line, truncated.
    const row = testid("item-R1");
    expect(row).not.toBeNull();
    // First criticism: "The plan lacks detail on error handling"
    expect(row?.textContent).toContain("The plan lacks detail on error handling");
    // The second criticism "Missing rollback strategy" must NOT be joined in.
    expect(row?.textContent).not.toContain("Missing rollback strategy");
  });

  it("status badge has nowrap class and summary cell has ellipsis class", async () => {
    await mount();
    click(testid("ledger-reviews"));
    await flush();
    // lw-status badge must not wrap: white-space:nowrap is on the element.
    const badge = testid("status-R1");
    expect(badge).not.toBeNull();
    expect(badge?.className).toContain("lw-status");
    // Summary cell must carry lw-summary-cell for overflow:hidden + ellipsis.
    // The summary <td> is the last td in the row.
    const row = testid("item-R1");
    const tds = row?.querySelectorAll("td");
    const summaryTd = tds?.[tds.length - 1];
    expect(summaryTd?.className).toContain("lw-summary-cell");
  });

  // ---- archive affordance (Req1 T32) ----

  it("shows the 'show archived' toggle only for ledgers that have archive pointers", async () => {
    await mount();
    // bugs ledger has an archive pointer (A1) in FakeClient.
    click(testid("ledger-bugs"));
    await flush();
    expect(testid("toggle-archive")).not.toBeNull();

    // plain ledger has no archive pointers.
    click(testid("ledger-plain"));
    await flush();
    expect(testid("toggle-archive")).toBeNull();
  });

  it("toggle shows/hides the archive section and resets on ledger change", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    // Not shown by default.
    expect(testid("archive-section")).toBeNull();

    // Click toggle → archive section appears.
    click(testid("toggle-archive"));
    await flush();
    expect(testid("archive-section")).not.toBeNull();
    // The pointer A1 is listed.
    expect(testid("archive-pointer-A1")).not.toBeNull();

    // Switch to another ledger → archive section disappears, toggle resets.
    click(testid("ledger-plain"));
    await flush();
    expect(testid("archive-section")).toBeNull();
    expect(testid("toggle-archive")).toBeNull();

    // Back to bugs: toggle is off again (was reset).
    click(testid("ledger-bugs"));
    await flush();
    expect(testid("archive-section")).toBeNull();
    expect(testid("toggle-archive")?.className).not.toContain("lw-toggle-active");
  });

  it("selecting an archive pointer fetches and lists its archived items", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("toggle-archive"));
    await flush();
    // The pointer is listed; click it to load the archive.
    click(testid("archive-pointer-A1"));
    await flush();
    // The archived item D99 appears in the archive table.
    expect(testid("archive-items")).not.toBeNull();
    expect(testid("archive-item-D99")).not.toBeNull();
    expect(testid("archive-item-D99")?.textContent).toContain("archived bug");
  });

  it("opening an archived item shows it read-only with NO edit/transition/answer controls", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("toggle-archive"));
    await flush();
    click(testid("archive-pointer-A1"));
    await flush();
    // Click the archived item to open it in the detail panel.
    click(testid("archive-item-D99"));
    await flush();
    // Detail panel opens with the archived item.
    expect(testid("detail-id")?.textContent).toBe("D99");
    // The "archived" badge is visible.
    expect(testid("archived-badge")).not.toBeNull();
    // NO edit button.
    expect(testid("edit")).toBeNull();
    // NO transition buttons.
    expect(testid("transitions")).toBeNull();
    // NO answer box.
    expect(testid("answer-box")).toBeNull();
    // Close button is still present.
    expect(testid("detail-close")).not.toBeNull();
  });

  it("active-item editing is unaffected by the archive toggle", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();
    click(testid("toggle-archive"));
    await flush();
    // Select a normal (active) item.
    click(testid("item-D1"));
    await flush();
    // The edit button is present for active items even when the archive is shown.
    expect(testid("edit")).not.toBeNull();
    expect(testid("transitions")).not.toBeNull();
    // No archived badge.
    expect(testid("archived-badge")).toBeNull();
  });

  // ---- M6 follow-up cross-cutting regression (T34) ----
  // Confirms that the combined archive/subsection/column follow-up changes do NOT
  // break active-item editing or plan/implement flows. No single per-task test
  // owns this because it spans subsection rendering + milestone filter + archive
  // toggle + edit/transition affordances all simultaneously.

  it("cross-cutting: edit and transition affordances survive subsections + milestone-filter + archive all active", async () => {
    await mount();
    click(testid("ledger-bugs"));
    await flush();

    // (1) Subsections are rendered (M6 T31 follow-up): both milestone groups
    //     visible, items accessible under their headers.
    expect(testid("ms-section-M1")).not.toBeNull();
    expect(testid("ms-section-M2")).not.toBeNull();
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).not.toBeNull();

    // (2) Apply milestone filter (narrows to M1) while subsections are shown.
    setValue(testid("milestone-filter"), "M1");
    await flush();
    expect(testid("item-D1")).not.toBeNull();
    expect(testid("item-D3")).toBeNull(); // M2 filtered out

    // (3) Open the archive toggle while the milestone filter is also active.
    click(testid("toggle-archive"));
    await flush();
    expect(testid("archive-section")).not.toBeNull(); // archive section visible

    // (4) In this combined state, select an active item and confirm it is
    //     fully editable — edit form and quick-transition buttons are intact.
    click(testid("item-D1"));
    await flush();
    expect(testid("archived-badge")).toBeNull(); // not an archived item
    expect(testid("edit")).not.toBeNull(); // edit affordance present
    expect(testid("transitions")).not.toBeNull(); // transition buttons present (D1 is "open")
    expect(testid("transition-wip")).not.toBeNull();
    expect(testid("transition-closed")).not.toBeNull();

    // (5) Exercise a full edit round-trip (simulating the plan/implement write path).
    click(testid("edit"));
    await flush();
    expect(testid("edit-form")).not.toBeNull();
    setValue(testid("edit-status"), "wip");
    setValue(testid("edit-field-headline"), "warp leak [T34 regression]");
    click(testid("save"));
    await flush();
    const item = await fake.fetchItem("bugs", "D1");
    expect(item.status).toBe("wip");
    expect(item.fields["headline"]).toBe("warp leak [T34 regression]");
    expect(testid("edit-form")).toBeNull(); // back to view mode

    // (6) Quick-transition from the new status still works (wip → closed/open).
    expect(testid("transitions")).not.toBeNull();
    click(testid("transition-closed"));
    await flush();
    const closed = await fake.fetchItem("bugs", "D1");
    expect(closed.status).toBe("closed");
  });
});

describe("ledger-web keyboard navigation", () => {
  it("opens a ledger from the sidebar with arrows + Enter", async () => {
    await mount();
    // sidebar focused, cursor on the first ledger (bugs, sorted first)
    expect(testid("ledger-bugs")?.className).toContain("lw-ledger-cursor");
    press("ArrowDown"); // → milestones
    await flush();
    expect(testid("ledger-milestones")?.className).toContain("lw-ledger-cursor");
    press("ArrowUp"); // back → bugs
    await flush();
    press("Enter"); // open bugs
    await flush();
    expect(testid("item-D1")).not.toBeNull();
  });

  it("moves through items into the detail panel and Esc closes it", async () => {
    await mount();
    press("Enter"); // open bugs → main zone
    await flush();
    expect(testid("detail")).toBeNull(); // nothing selected yet
    press("ArrowDown"); // select first row (D1) → live preview
    await flush();
    expect(testid("detail-id")?.textContent).toBe("D1");
    press("Escape"); // close detail
    await flush();
    expect(testid("detail")).toBeNull();
  });

  it("'/' focuses the search box", async () => {
    await mount();
    press("/");
    await flush();
    expect(document.activeElement).toBe(testid("search-input"));
  });

  it("Enter in the search box hands focus to the results", async () => {
    await mount();
    setValue(testid("search-input"), "warp");
    await act(async () => {
      await sleep(260);
    });
    expect(testid("hit-D1")).not.toBeNull();
    // Enter in the box commits + blurs → results take over keyboard focus.
    pressOn(testid("search-input"), "Enter");
    await flush();
    expect(document.activeElement).not.toBe(testid("search-input"));
    // A document-level Enter now opens the highlighted hit.
    press("Enter");
    await flush();
    expect(testid("detail-id")?.textContent).toBe("D1");
  });

  it("'?' toggles the keyboard-shortcuts help (Esc closes)", async () => {
    await mount();
    expect(testid("help-overlay")).toBeNull();
    press("?");
    await flush();
    expect(testid("help-overlay")).not.toBeNull();
    press("Escape");
    await flush();
    expect(testid("help-overlay")).toBeNull();
  });
});

describe("clampPanelSize", () => {
  it("clamps to the [min, max] band", () => {
    expect(clampPanelSize(50, 800)).toBe(180); // below min
    expect(clampPanelSize(400, 800)).toBe(400); // within band
    expect(clampPanelSize(900, 800)).toBe(800); // above max
    expect(clampPanelSize(900, 50)).toBe(180); // max below min → min wins
  });
});

// Minimal fake WebSocket the test drives.
class FakeWS {
  static instances: FakeWS[] = [];
  readyState = 0;
  onopen: ((e: unknown) => void) | null = null;
  onmessage: ((e: unknown) => void) | null = null;
  onclose: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  constructor(public url: string) {
    FakeWS.instances.push(this);
  }
  send(): void {}
  close(): void {
    this.readyState = 3;
  }
  open(): void {
    this.readyState = 1;
    this.onopen?.({});
  }
  push(obj: unknown): void {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
}

describe("ledger-web live updates", () => {
  it("shows the live indicator and refetches on a pushed change", async () => {
    FakeWS.instances = [];
    fake = new FakeClient();
    await act(async () => {
      root.render(
        createElement(App, {
          connect: async () => fake,
          initialUrl: "http://x/mcp",
          liveUrl: "ws://x/ws",
          liveWsCtor: FakeWS as unknown as { new (url: string): WebSocket },
        }),
      );
    });
    await flush();
    // a live socket was created; open it → indicator goes live
    expect(FakeWS.instances.length).toBeGreaterThanOrEqual(1);
    const ws = FakeWS.instances[0]!;
    act(() => ws.open());
    await flush();
    expect(testid("live-status")?.getAttribute("data-state")).toBe("alive");

    // open the bugs ledger
    click(testid("ledger-bugs"));
    await flush();
    expect(testid("item-D2")).toBeNull(); // not there yet

    // an external writer adds an item, then the server pushes `changed`
    await fake.createItem("bugs", "M1", { status: "open", fields: { headline: "pushed in" } });
    act(() => ws.push({ type: "changed", ledger: "bugs" }));
    await flush();
    // the table refetched and now shows the new item
    expect(text()).toContain("pushed in");
  });
});
