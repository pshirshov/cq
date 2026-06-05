/**
 * Per-ledger state-machine diagram model for the help dialog's "State machines"
 * tab (T5).
 *
 * Pure (no DOM/React): turns a ledger's {@link LedgerSchema} into positioned
 * nodes + directed edges so the SVG renderer is a thin mapping. Node colors are
 * resolved through the SAME {@link statusBucket} → {@link BUCKET_HEX} palette the
 * status badges and the DAG view use, so a status's diagram fill matches its
 * badge exactly.
 *
 * Layout reuses {@link computeDagLayout}: the `transitions` map supplies the
 * precedence edges; a ledger WITHOUT a transitions map yields colored nodes and
 * no edges (the layout then stacks every status in one column).
 */

import { computeDagLayout, type DagEdge, type LayoutOpts } from "./dagLayout.js";
import { BUCKET_HEX, isTerminal, statusBucket } from "./status.js";
import type { LedgerSchema } from "./types.js";

/** A laid-out status node: position + the bucket fill + terminal flag. */
export interface StateNode {
  status: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Hex fill from the shared bucket palette — matches the status badge. */
  fill: string;
  /** True when the status is in `schema.terminalStatuses`. */
  terminal: boolean;
}

/** A directed transition edge with resolved endpoints. */
export interface StateEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface StateMachineModel {
  nodes: StateNode[];
  edges: StateEdge[];
  width: number;
  height: number;
  /** True when the ledger declares no `transitions` map (nodes only). */
  edgeless: boolean;
}

// State-machine boxes are smaller than DAG milestone cards — a status label is
// short, and we stack several diagrams in a scrollable dialog.
const STATE_LAYOUT_OPTS: LayoutOpts = {
  nodeWidth: 120,
  nodeHeight: 40,
  hGap: 56,
  vGap: 18,
  pad: 16,
};

/** Directed transition pairs from `schema.transitions` (empty when absent). */
function transitionEdges(schema: LedgerSchema): DagEdge[] {
  const t = schema.transitions;
  if (t === undefined) return [];
  const edges: DagEdge[] = [];
  for (const [from, tos] of Object.entries(t)) {
    for (const to of tos) edges.push({ from, to });
  }
  return edges;
}

/**
 * Build the positioned state-machine model for one ledger's schema. Nodes are
 * the schema's `statusValues`; edges are its `transitions` (none when the map is
 * absent). Colors come from {@link statusBucket} + {@link BUCKET_HEX}.
 */
export function computeStateMachine(schema: LedgerSchema): StateMachineModel {
  const statuses = schema.statusValues;
  const edges = transitionEdges(schema);
  const layout = computeDagLayout(statuses, edges, STATE_LAYOUT_OPTS);
  const posByStatus = new Map(layout.nodes.map((n) => [n.id, n]));

  const nodes: StateNode[] = statuses.map((status) => {
    const p = posByStatus.get(status)!;
    return {
      status,
      x: p.x,
      y: p.y,
      w: p.w,
      h: p.h,
      fill: BUCKET_HEX[statusBucket(status, schema)],
      terminal: isTerminal(status, schema),
    };
  });

  const stateEdges: StateEdge[] = layout.edges.map((e) => ({
    from: e.from,
    to: e.to,
    x1: e.x1,
    y1: e.y1,
    x2: e.x2,
    y2: e.y2,
  }));

  return {
    nodes,
    edges: stateEdges,
    width: layout.width,
    height: layout.height,
    edgeless: schema.transitions === undefined,
  };
}
