/**
 * Unit tests for the Flows-tab render-data (T204).
 *
 * Asserts the structural invariants the Flows tab relies on:
 *   - all four flows are present in the Q115 order (plan, investigate,
 *     implement, advance);
 *   - every edge endpoint resolves to a node id in the SAME flow (no dangling
 *     edges — the property the layout layer assumes);
 *   - the advance overview carries the three named cross-flow handoff edges;
 *   - the node/edge shape is exactly the generic model DiagramSvg consumes
 *     (so a flow feeds `layoutDiagram` directly).
 */

import { describe, it, expect } from "bun:test";
import {
  FLOWS,
  HANDOFF_FILE_DEFER_TO_INVESTIGATE,
  HANDOFF_SEED_GOAL_TO_PLAN,
  HANDOFF_PLANNED_TO_IMPLEMENT,
} from "../src/flowData";
import type { DiagramModel } from "../src/diagramLayout";

describe("FLOWS render-data", () => {
  it("exports exactly the four flows in Q115 order", () => {
    expect(FLOWS.map((f) => f.id)).toEqual(["plan", "investigate", "implement", "advance"]);
  });

  it("gives every flow a non-empty title and graph", () => {
    for (const flow of FLOWS) {
      expect(flow.title.length).toBeGreaterThan(0);
      expect(flow.nodes.length).toBeGreaterThan(0);
      expect(flow.edges.length).toBeGreaterThan(0);
    }
  });

  it("resolves every edge from/to to a node id in the same flow", () => {
    for (const flow of FLOWS) {
      const ids = new Set(flow.nodes.map((n) => n.id));
      for (const e of flow.edges) {
        expect(ids.has(e.from)).toBe(true);
        expect(ids.has(e.to)).toBe(true);
      }
    }
  });

  it("uses unique node ids within each flow", () => {
    for (const flow of FLOWS) {
      const ids = flow.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("includes the three named cross-flow handoff edges in the advance flow", () => {
    const advance = FLOWS.find((f) => f.id === "advance")!;
    const has = (from: string, to: string): boolean =>
      advance.edges.some((e) => e.from === from && e.to === to);

    // plan file-and-defer-defect → investigate
    expect(
      has(HANDOFF_FILE_DEFER_TO_INVESTIGATE.from, HANDOFF_FILE_DEFER_TO_INVESTIGATE.to),
    ).toBe(true);
    // investigate seed-goal → plan
    expect(has(HANDOFF_SEED_GOAL_TO_PLAN.from, HANDOFF_SEED_GOAL_TO_PLAN.to)).toBe(true);
    // plan planned → implement
    expect(has(HANDOFF_PLANNED_TO_IMPLEMENT.from, HANDOFF_PLANNED_TO_IMPLEMENT.to)).toBe(true);
  });

  it("models the plan flow's planning↔clarifying revise loop", () => {
    const plan = FLOWS.find((f) => f.id === "plan")!;
    expect(plan.edges.some((e) => e.from === "clarifying" && e.to === "planning")).toBe(true);
    expect(plan.edges.some((e) => e.from === "planning" && e.to === "clarifying")).toBe(true);
  });

  it("each flow's nodes/edges are assignable to the generic DiagramModel", () => {
    for (const flow of FLOWS) {
      // A compile-time + run-time check that the shape DiagramSvg consumes is
      // satisfied: FlowNode widens DiagramNode, FlowEdge IS DiagramEdge.
      const model: DiagramModel = { nodes: flow.nodes, edges: flow.edges };
      expect(model.nodes.length).toBe(flow.nodes.length);
      expect(model.edges.length).toBe(flow.edges.length);
    }
  });
});
