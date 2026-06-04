/**
 * Acceptance test for T52: a reviews item with status 'revise' must render a
 * status badge whose className carries the `warning` bucket class, not `done`.
 * The badge markup mirrors App.tsx exactly: `lw-status lw-status-${bucket}`,
 * where the bucket comes from statusBucket() over the reviews schema.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { statusBucket } from "../src/status";
import { REVIEWS_SCHEMA } from "@cq/ledger";

let container: HTMLElement;
let root: Root;

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

function StatusBadge(props: { status: string }): ReturnType<typeof createElement> {
  // Identical to the badge App.tsx renders for an item row.
  return createElement(
    "span",
    { className: `lw-status lw-status-${statusBucket(props.status, REVIEWS_SCHEMA)}`, "data-testid": "badge" },
    props.status,
  );
}

describe("reviews 'revise' status badge (T52)", () => {
  it("renders the warning bucket class, not done", () => {
    act(() => {
      root.render(createElement(StatusBadge, { status: "revise" }));
    });
    const badge = container.querySelector('[data-testid="badge"]');
    expect(badge).not.toBeNull();
    expect(badge!.className).toContain("lw-status-warning");
    expect(badge!.className).not.toContain("lw-status-done");
  });
});
