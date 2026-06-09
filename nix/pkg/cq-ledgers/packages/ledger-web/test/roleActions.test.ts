/**
 * Unit tests for the role→actions catalogue module (T315).
 *
 * Asserts the structural invariants the Flows tab relies on:
 *   - exactly four flows in the canonical order (plan, investigate,
 *     implement, advance);
 *   - every edge's from/to references a node id declared in that flow;
 *   - each flow has ≥1 role node and ≥1 labeled action edge;
 *   - each flow's model is assignable to DiagramModel (compile-time +
 *     run-time check).
 */

import { describe, it, expect } from "bun:test";
import { ROLE_FLOWS } from "../src/roleActions";
import type { DiagramModel } from "../src/diagramLayout";

describe("ROLE_FLOWS catalogue", () => {
  it("exports exactly four flows in canonical order", () => {
    expect(ROLE_FLOWS.map((f) => f.id)).toEqual([
      "plan",
      "investigate",
      "implement",
      "advance",
    ]);
  });

  it("every flow has a non-empty id and title", () => {
    for (const flow of ROLE_FLOWS) {
      expect(flow.id.length).toBeGreaterThan(0);
      expect(flow.title.length).toBeGreaterThan(0);
    }
  });

  it("every flow has ≥1 role node", () => {
    for (const flow of ROLE_FLOWS) {
      expect(flow.model.nodes.length).toBeGreaterThan(0);
    }
  });

  it("every flow has ≥1 labeled action edge", () => {
    for (const flow of ROLE_FLOWS) {
      const labeled = flow.model.edges.filter(
        (e) => e.label !== undefined && e.label.length > 0,
      );
      expect(labeled.length).toBeGreaterThan(0);
    }
  });

  it("resolves every edge from/to to a declared node id in the same flow", () => {
    for (const flow of ROLE_FLOWS) {
      const ids = new Set(flow.model.nodes.map((n) => n.id));
      for (const edge of flow.model.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
      }
    }
  });

  it("uses unique node ids within each flow", () => {
    for (const flow of ROLE_FLOWS) {
      const ids = flow.model.nodes.map((n) => n.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("every flow's model is assignable to DiagramModel", () => {
    for (const flow of ROLE_FLOWS) {
      // Compile-time + run-time check: DiagramModel = { nodes, edges }.
      const model: DiagramModel = flow.model;
      expect(model.nodes.length).toBe(flow.model.nodes.length);
      expect(model.edges.length).toBe(flow.model.edges.length);
    }
  });
});
