/**
 * Tests for parallel-edge label distinctness and visibility (T334).
 *
 * Three acceptance criteria:
 *
 * (1) LAYOUT TEST — distinct labelPos for parallel edges.
 *     Fails before the fix if ELK maps parallel same-pair edges to coincident
 *     labelPos. Passes after fix (ELK already routes them; the test codifies
 *     the invariant and guards against regressions).
 *
 * (2) RENDER TEST — parallel-edge labels all visible in the SVG.
 *     The testid scheme formerly used `${idPrefix}-edge-label-${from}-${to}`,
 *     which COLLIDES for parallel edges — every parallel label on an
 *     orchestrator→worktree pair got the same testid, so test selectors could
 *     not individually address each one. The fix changes the label testid to
 *     include the global edge index: `${idPrefix}-edge-label-${from}-${to}-${i}`.
 *     The test below FAILS before the fix (index-suffixed testids don't exist)
 *     and PASSES after.
 *
 * (3) DATA TEST — every ROLE_FLOWS edge has a non-empty label; parallel edges
 *     on a node pair have distinct label strings.
 */

import { registerDom } from "./helpers/dom";
registerDom();

import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { layoutDiagram, type LaidOutDiagram } from "../src/diagramLayout";
import { DiagramSvg } from "../src/DiagramSvg";
import { ROLE_FLOWS } from "../src/roleActions";

// ---------------------------------------------------------------------------
// (3) DATA TEST — label completeness + distinctness in ROLE_FLOWS source data
// ---------------------------------------------------------------------------

describe("ROLE_FLOWS edge-label data invariants (T334)", () => {
  it("every edge in every flow has a non-empty label string", () => {
    for (const flow of ROLE_FLOWS) {
      for (const edge of flow.model.edges) {
        expect({
          flow: flow.id,
          from: edge.from,
          to: edge.to,
          label: edge.label,
          hasLabel: typeof edge.label === "string" && edge.label.length > 0,
        }).toMatchObject({ hasLabel: true });
      }
    }
  });

  it("parallel edges between the same node pair carry distinct label strings in every flow", () => {
    for (const flow of ROLE_FLOWS) {
      // Group edges by from→to.
      const groups = new Map<string, string[]>();
      for (const edge of flow.model.edges) {
        const key = `${edge.from}→${edge.to}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(edge.label ?? "");
      }
      for (const [pair, labels] of groups) {
        if (labels.length > 1) {
          const unique = new Set(labels);
          expect({
            flow: flow.id,
            pair,
            labels,
            allDistinct: unique.size === labels.length,
          }).toMatchObject({ allDistinct: true });
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (1) LAYOUT TEST — distinct labelPos for parallel edges
// ---------------------------------------------------------------------------

/**
 * Minimum separation in pixels between adjacent label centres (sorted by y)
 * for labels not to overlap. Font-size 11 → ~14 px tall; labelPos is the
 * centre, so adjacent centres need ≥14 px separation to avoid overlap.
 */
const MIN_LABEL_SEP = 14;

describe("layoutDiagram — parallel-edge label positions (T334)", () => {
  it("every labeled parallel-group edge in the implement flow has a defined labelPos", async () => {
    const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
    const out = await layoutDiagram(impl.model);

    const groups = new Map<string, typeof out.edges[0][]>();
    for (const e of out.edges) {
      const key = `${e.from}→${e.to}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    for (const [pair, edges] of groups) {
      if (edges.length > 1) {
        for (const edge of edges) {
          expect({
            pair,
            label: edge.label,
            labelPosDefined: edge.labelPos !== undefined,
          }).toMatchObject({ labelPosDefined: true });
        }
      }
    }
  });

  it("parallel same-pair edges in the implement flow have distinct labelPos (no two coincide)", async () => {
    const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
    const out = await layoutDiagram(impl.model);

    const groups = new Map<string, typeof out.edges[0][]>();
    for (const e of out.edges) {
      const key = `${e.from}→${e.to}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    for (const [pair, edges] of groups) {
      if (edges.length > 1) {
        const positions = edges.map((e) => e.labelPos!);
        for (let i = 0; i < positions.length; i++) {
          for (let j = i + 1; j < positions.length; j++) {
            const pi = positions[i]!, pj = positions[j]!;
            const coincide =
              Math.abs(pi.x - pj.x) < 1 && Math.abs(pi.y - pj.y) < 1;
            expect({
              pair,
              labelI: edges[i]!.label,
              labelJ: edges[j]!.label,
              coincide,
            }).toMatchObject({ coincide: false });
          }
        }
      }
    }
  });

  it("parallel same-pair edges in the implement flow have ≥MIN_LABEL_SEP px y-separation (no vertical overlap)", async () => {
    const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
    const out = await layoutDiagram(impl.model);

    const groups = new Map<string, typeof out.edges[0][]>();
    for (const e of out.edges) {
      const key = `${e.from}→${e.to}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(e);
    }

    for (const [pair, edges] of groups) {
      if (edges.length > 1) {
        const sorted = [...edges].sort(
          (a, b) => (a.labelPos?.y ?? 0) - (b.labelPos?.y ?? 0),
        );
        for (let i = 0; i < sorted.length - 1; i++) {
          const pi = sorted[i]!.labelPos!, pj = sorted[i + 1]!.labelPos!;
          const yGap = pj.y - pi.y;
          expect({
            pair,
            labelI: sorted[i]!.label,
            labelJ: sorted[i + 1]!.label,
            yGap: Math.round(yGap),
            sufficient: yGap >= MIN_LABEL_SEP,
          }).toMatchObject({ sufficient: true });
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (2) RENDER TEST — per-label testids include global edge index (post-fix)
//
// Before the fix, `DiagramSvg` used `${idPrefix}-edge-label-${from}-${to}` for
// every edge label — parallel edges shared the same testid. After the fix the
// label testid is `${idPrefix}-edge-label-${from}-${to}-${i}` (global index),
// so every label is uniquely addressable.
//
// The tests below FAIL before the fix (index-suffixed testids absent) and
// PASS after the fix.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
});

/**
 * Lay out the implement flow and render it, return the container element.
 * Each call re-renders into the current `container`/`root`.
 */
async function renderImplFlow(): Promise<LaidOutDiagram> {
  const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
  const laidOut = await layoutDiagram(impl.model);
  await act(async () => {
    root.render(createElement(DiagramSvg, { idPrefix: "impl", model: laidOut }));
  });
  return laidOut;
}

describe("DiagramSvg — per-index edge-label testids for parallel edges (T334)", () => {
  it("every edge label gets a unique testid that includes the global edge index", async () => {
    const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
    const laidOut = await renderImplFlow();

    // Each labeled edge must produce exactly ONE element with testid
    // `impl-edge-label-${from}-${to}-${i}` (where i is the edge's index in
    // the laidOut.edges array).
    for (let i = 0; i < laidOut.edges.length; i++) {
      const e = laidOut.edges[i]!;
      if (e.label === undefined || e.labelPos === undefined) continue;
      const testid = `impl-edge-label-${e.from}-${e.to}-${i}`;
      const el = container.querySelector(`[data-testid="${testid}"]`);
      expect({
        index: i,
        from: e.from,
        to: e.to,
        label: e.label,
        testid,
        found: el !== null,
      }).toMatchObject({ found: true });
    }

    // Verify specifically that the three orchestrator→worktree labels each have
    // a distinct index-suffixed testid (the formerly-colliding case).
    const wt0 = impl.model.edges.findIndex(
      (e) => e.from === "orchestrator" && e.to === "worktree",
    );
    const wt1 = impl.model.edges.findIndex(
      (e, i) => i > wt0 && e.from === "orchestrator" && e.to === "worktree",
    );
    const wt2 = impl.model.edges.findIndex(
      (e, i) => i > wt1 && e.from === "orchestrator" && e.to === "worktree",
    );
    expect(wt0).toBeGreaterThanOrEqual(0);
    expect(wt1).toBeGreaterThan(wt0);
    expect(wt2).toBeGreaterThan(wt1);

    for (const idx of [wt0, wt1, wt2]) {
      const testid = `impl-edge-label-orchestrator-worktree-${idx}`;
      const el = container.querySelector(`[data-testid="${testid}"]`);
      expect({
        idx,
        testid,
        found: el !== null,
        text: el?.textContent,
      }).toMatchObject({ found: true });
    }
  });

  it("the three parallel orchestrator→worktree labels have distinct text content and distinct y positions", async () => {
    const impl = ROLE_FLOWS.find((f) => f.id === "implement")!;
    await renderImplFlow();

    const wt0 = impl.model.edges.findIndex(
      (e) => e.from === "orchestrator" && e.to === "worktree",
    );
    const wt1 = impl.model.edges.findIndex(
      (e, i) => i > wt0 && e.from === "orchestrator" && e.to === "worktree",
    );
    const wt2 = impl.model.edges.findIndex(
      (e, i) => i > wt1 && e.from === "orchestrator" && e.to === "worktree",
    );

    const labels = [wt0, wt1, wt2].map((idx) => {
      const el = container.querySelector(
        `[data-testid="impl-edge-label-orchestrator-worktree-${idx}"]`,
      );
      return {
        text: el?.textContent ?? "",
        y: parseFloat(el?.getAttribute("y") ?? "0"),
      };
    });

    // All three must be non-empty text.
    for (const l of labels) {
      expect(l.text.length).toBeGreaterThan(0);
    }

    // All three label texts must be distinct.
    expect(new Set(labels.map((l) => l.text)).size).toBe(3);

    // All three y positions must be distinct and ≥ MIN_LABEL_SEP apart.
    const ySorted = labels.map((l) => l.y).sort((a, b) => a - b);
    expect(new Set(ySorted).size).toBe(3);
    for (let i = 0; i < ySorted.length - 1; i++) {
      const gap = ySorted[i + 1]! - ySorted[i]!;
      expect({
        i,
        yGap: Math.round(gap),
        sufficient: gap >= MIN_LABEL_SEP,
      }).toMatchObject({ sufficient: true });
    }
  });
});
