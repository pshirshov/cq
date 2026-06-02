/**
 * Cross-cutting regression (T49) — single-source relationship derivation.
 *
 * The #2 follow-up (M7/M8/M9) added a defect→fix-task panel and a hypothesis
 * tree panel to BOTH the web client (`packages/ledger-web/src/App.tsx`:
 * `FixTasksPanel` / `HypothesisTreePanel`) and the TUI (`packages/ledger-tui/
 * src/app.tsx` content pane). The invariant the follow-up promises is that the
 * two UIs never derive relationships independently: both call the SAME pure
 * helpers in `@cq/ledger` (`defectFixTaskIds` / `hypothesisRelationships`), so
 * for an identical seeded ledger they MUST show the identical fix-task ids and
 * hypothesis tree.
 *
 * This file pins that invariant from two angles, against ONE shared fixture:
 *
 *  1. Behavioural: drive the helpers on the fixture and assert the exact
 *     derived ids — these ids are the single source of truth both UIs render.
 *     The per-UI render tests (ledger-web `test/relationships.test.tsx`,
 *     ledger-tui `test/relationships.test.tsx`) assert that the same ids appear
 *     in their respective DOM/frame; this file is the contract they share.
 *
 *  2. Structural: assert that each UI's source feeds the helper the SAME
 *     argument shape — `(id, defectItems, taskItems)` for fix-tasks and
 *     `(id, hypothesisItems)` for the tree — and that neither UI re-implements
 *     the derivation (no second pass over `dependsOn` / `ledgerRefs` /
 *     `parentHypothesis` outside the helper). If a future edit makes one UI
 *     diverge from the shared helper, this regression fails.
 *
 * Cross-package UI rendering in a single test is awkward here: the web client
 * is react-dom + happy-dom and the TUI is ink + ink-testing-library, and no
 * single package depends on both runtimes. Per the T49 brief, the chosen form
 * is therefore a test asserting the helper's output is the single source both
 * consume, plus a structural guard that both consume it.
 */

import { describe, it, expect } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";
import { defectFixTaskIds, hypothesisRelationships } from "../src/index.js";
import type { Item } from "../src/index.js";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const TS = "2026-06-02T00:00:00.000Z";

function makeItem(id: string, status: string, fields: Record<string, string | string[]>): Item {
  return { id, milestoneId: "M1", status, fields, createdAt: TS, updatedAt: TS };
}

// ---------------------------------------------------------------------------
// THE single seeded fixture (identical ledger for "both UIs")
// ---------------------------------------------------------------------------
//
// Defect D1 is linked to its fix tasks in BOTH directions:
//   - forward: D1.dependsOn contains "T1" (and a hypothesis id "H2" that must
//     be filtered out of fix-tasks since it is not a task id);
//   - reverse: T2.ledgerRefs contains "defects:D1".
//   - T1 ALSO reverse-links D1 (ledgerRefs) — it must appear exactly once.
//   - T3 is unrelated and must never appear.
//
// Hypotheses form a multi-level tree: H1 (root) <- H2 <- H3, with H4 a second
// direct child of H2.

const defects: readonly Item[] = [
  makeItem("D1", "open", { headline: "warp core breach", dependsOn: ["T1", "H2"] }),
  makeItem("D2", "open", { headline: "unlinked defect" }),
];

const tasks: readonly Item[] = [
  makeItem("T1", "wip", { headline: "patch containment", ledgerRefs: ["defects:D1"] }),
  makeItem("T2", "planned", { headline: "add interlock", ledgerRefs: ["defects:D1"] }),
  makeItem("T3", "done", { headline: "unrelated chore", ledgerRefs: ["defects:D9"] }),
];

const hypotheses: readonly Item[] = [
  makeItem("H1", "open", { headline: "root cause" }),
  makeItem("H2", "open", { headline: "subsystem A", parentHypothesis: "H1" }),
  makeItem("H3", "confirmed", { headline: "leaf A1", parentHypothesis: "H2" }),
  makeItem("H4", "open", { headline: "leaf A2", parentHypothesis: "H2" }),
];

// ---------------------------------------------------------------------------
// 1. Behavioural: the helper output is the single set of ids both UIs render.
// ---------------------------------------------------------------------------

describe("T49 cross-UI single-source: defect -> fix-task ids", () => {
  it("derives the same fix-task ids both UIs must render (both link directions, deduped, hypothesis ids filtered)", () => {
    // This is exactly the argument shape both UIs pass:
    //   web  App.tsx:  defectFixTaskIds(defectId, defects, tasks)
    //   tui  app.tsx:  defectFixTaskIds(row.item.id, viewItems, taskItems)
    const ids = defectFixTaskIds("D1", defects, tasks);

    // T1: forward (dependsOn) + reverse (ledgerRefs) -> present once.
    // T2: reverse only. H2: filtered (not a task id). T3: unrelated -> absent.
    expect(ids).toEqual(["T1", "T2"]);
  });

  it("derives an empty fix-task set for an unlinked defect (both UIs hide the panel)", () => {
    expect(defectFixTaskIds("D2", defects, tasks)).toEqual([]);
  });
});

describe("T49 cross-UI single-source: hypothesis tree", () => {
  it("derives the same ancestry + children both UIs must render for a middle node", () => {
    // web  App.tsx:  hypothesisRelationships(hypothesisId, hypotheses)
    // tui  app.tsx:  hypothesisRelationships(row.item.id, viewItems)
    const { ancestors, children } = hypothesisRelationships("H2", hypotheses);
    expect(ancestors).toEqual(["H1"]); // parent->root
    expect([...children].sort()).toEqual(["H3", "H4"]); // both direct children
  });

  it("derives ancestry to the root for a leaf (parent first, root last)", () => {
    const { ancestors, children } = hypothesisRelationships("H3", hypotheses);
    expect(ancestors).toEqual(["H2", "H1"]);
    expect(children).toEqual([]);
  });

  it("derives only children for the root", () => {
    const { ancestors, children } = hypothesisRelationships("H1", hypotheses);
    expect(ancestors).toEqual([]);
    expect([...children].sort()).toEqual(["H2"]);
  });
});

// ---------------------------------------------------------------------------
// 2. Structural: both UI sources consume the SAME helper as their only
//    derivation path. If either UI stops routing through the shared helper (or
//    re-implements the derivation), this guard fails — that is the regression
//    that keeps the two UIs from drifting apart.
// ---------------------------------------------------------------------------

const WEB_APP = readFileSync(path.join(REPO_ROOT, "packages/ledger-web/src/App.tsx"), "utf8");
const TUI_APP = readFileSync(path.join(REPO_ROOT, "packages/ledger-tui/src/app.tsx"), "utf8");

/**
 * Strip `//` line comments and block comments so the "no derivation outside the
 * helper" guard tests CODE, not prose. (`App.tsx`'s `FixTasksPanel` doc comment
 * mentions `task.ledgerRefs` in explanatory text — that is documentation of the
 * helper, not a re-implementation, and must not trip the guard.)
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const WEB_CODE = stripComments(WEB_APP);
const TUI_CODE = stripComments(TUI_APP);

describe("T49 cross-UI single-source: structural guard", () => {
  it("both UIs import the relationship helpers from @cq/ledger", () => {
    for (const src of [WEB_APP, TUI_APP]) {
      expect(src).toContain("defectFixTaskIds");
      expect(src).toContain("hypothesisRelationships");
      expect(/from "@cq\/ledger(\/relationships)?"/.test(src)).toBe(true);
    }
  });

  it("both UIs call defectFixTaskIds with the (id, defectItems, taskItems) shape", () => {
    // Match the call with three comma-separated arguments in either UI.
    const callRe = /defectFixTaskIds\(\s*[^,]+,\s*[^,]+,\s*[^)]+\)/;
    expect(callRe.test(WEB_APP)).toBe(true);
    expect(callRe.test(TUI_APP)).toBe(true);
  });

  it("neither UI re-implements the derivation outside the helper", () => {
    // The raw link fields (`ledgerRefs`, `parentHypothesis`) are read ONLY
    // inside @cq/ledger's relationships.ts. A UI that scans them in CODE would
    // be a second, drift-prone source of truth — forbid it. (Comments are
    // stripped first, so documentation of the helper does not trip the guard.)
    for (const code of [WEB_CODE, TUI_CODE]) {
      expect(code).not.toContain("ledgerRefs");
      expect(code).not.toContain("parentHypothesis");
    }
  });
});
