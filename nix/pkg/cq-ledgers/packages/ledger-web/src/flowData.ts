/**
 * Hand-authored render-data for the Flows tab (T204, decision Q114/Q115).
 *
 * This module mirrors — BY HAND — the four cooperating cq: flows described in
 * the phase-1 doc `nix/pkg/cq-assets/docs/flow-state-machines.md` (T200): the
 * *plan*, *investigate*, and *implement* flows plus the *advance* sequencer's
 * cross-flow overview. Per Q114 the doc and this module share NO source of
 * truth; keep the two in sync manually (a reviewer cross-checks them).
 *
 * Each flow's `nodes`/`edges` are exactly the generic graph shape the T202
 * diagram layer ({@link layoutDiagram} / {@link DiagramSvg}) consumes: a
 * {@link FlowNode} widens {@link DiagramNode} with a `kind` discriminator and a
 * {@link FlowEdge} IS a {@link DiagramEdge}. The Flows tab (T205) maps `kind`
 * to the renderer's existing `fill`/`terminal` styling (e.g. waiting-for-input
 * vs handoff get distinct fills) before handing the model to `layoutDiagram`.
 */

import type { DiagramNode, DiagramEdge } from "./diagramLayout.js";

/**
 * The role a flow node plays, used by T205 to drive distinct styling:
 * - `state`    — a durable ledger status the flow drives (e.g. `planning`).
 * - `waiting`  — an orchestration sub-state parked on an `open` user question
 *                (the "awaiting-answers" pause; not a ledger status).
 * - `handoff`  — a cross-flow handoff point (e.g. seed-goal-to-plan).
 * - `terminal` — a terminal ledger status (`done`, `abandoned`, …).
 */
export type FlowNodeKind = "state" | "waiting" | "handoff" | "terminal";

/**
 * A flow diagram node: the generic {@link DiagramNode} widened with a {@link
 * FlowNodeKind}. Assignable to `DiagramNode`, so the array feeds `layoutDiagram`
 * directly once T205 resolves `kind` → `fill`/`terminal`.
 */
export interface FlowNode extends DiagramNode {
  kind?: FlowNodeKind;
}

/** A flow diagram edge — identical to the generic {@link DiagramEdge}. */
export type FlowEdge = DiagramEdge;

/** One flow's render-data: an id, a human title, and its generic graph. */
export interface FlowDefinition {
  id: string;
  title: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
}

// The three named cross-flow handoff edges the advance overview must expose.
// Exported so the test (and any consumer) keys on the same constants the data
// is built from rather than re-typing the endpoint ids.
export const HANDOFF_FILE_DEFER_TO_INVESTIGATE = {
  from: "plan",
  to: "investigate",
} as const;
export const HANDOFF_SEED_GOAL_TO_PLAN = {
  from: "investigate",
  to: "plan",
} as const;
export const HANDOFF_PLANNED_TO_IMPLEMENT = {
  from: "plan",
  to: "implement",
} as const;

/**
 * Plan flow — the `goals` lifecycle (T200 §Plan flow). States
 * clarifying/planning/planned/building/done/abandoned with labelled
 * transitions, including the planning↔clarifying revise loop. `clarifying`'s
 * await-answers pause is modelled as a `waiting` node; `planned` is the handoff
 * point to implement.
 */
const planFlow: FlowDefinition = {
  id: "plan",
  title: "Plan flow (goals)",
  nodes: [
    { id: "clarifying", label: "clarifying", kind: "state" },
    { id: "awaiting-answers", label: "awaiting answers", kind: "waiting" },
    { id: "planning", label: "planning", kind: "state" },
    { id: "planned", label: "planned", kind: "handoff" },
    { id: "building", label: "building", kind: "state" },
    { id: "done", label: "done", kind: "terminal", terminal: true },
    { id: "abandoned", label: "abandoned", kind: "terminal", terminal: true },
  ],
  edges: [
    // The planner files open questions and parks the goal in clarifying.
    { from: "clarifying", to: "awaiting-answers", label: "file questions" },
    { from: "awaiting-answers", to: "clarifying", label: "user answers" },
    // Enough answered context (or defect-seeded) → write the plan.
    { from: "clarifying", to: "planning", label: "context ready" },
    // The planning↔clarifying revise loop: revise with new_questions.
    { from: "planning", to: "clarifying", label: "revise (new questions)" },
    // Reviewer go-ahead locks the plan (locked decision first).
    { from: "planning", to: "planned", label: "go-ahead / plan locked" },
    // Implement begins consuming the DAG.
    { from: "planned", to: "building", label: "implement starts" },
    // User-only close.
    { from: "building", to: "done", label: "user closes" },
    // Follow-up re-open edges.
    { from: "planned", to: "planning", label: "follow-up" },
    { from: "building", to: "planning", label: "follow-up" },
    // Abandon from any non-terminal phase.
    { from: "clarifying", to: "abandoned", label: "abandon" },
    { from: "planning", to: "abandoned", label: "abandon" },
    { from: "planned", to: "abandoned", label: "abandon" },
    { from: "building", to: "abandoned", label: "abandon" },
  ],
};

/**
 * Investigate flow — the `defects` lifecycle (T200 §Investigate flow): the
 * hypothesis-tree round loop (open→wip with re-openable root-caused/inconclusive
 * holds) plus the confirmed-root-cause → seed-goal-to-plan handoff.
 */
const investigateFlow: FlowDefinition = {
  id: "investigate",
  title: "Investigate flow (defects)",
  nodes: [
    { id: "open", label: "open", kind: "state" },
    { id: "wip", label: "wip", kind: "state" },
    { id: "root-caused", label: "root-caused", kind: "state" },
    { id: "inconclusive", label: "inconclusive", kind: "state" },
    { id: "seed-goal", label: "seed goal → plan", kind: "handoff" },
    { id: "resolved", label: "resolved", kind: "terminal", terminal: true },
    { id: "wontfix", label: "wontfix", kind: "terminal", terminal: true },
  ],
  edges: [
    // Research begins this round.
    { from: "open", to: "wip", label: "research begins" },
    { from: "open", to: "resolved", label: "user closes" },
    { from: "open", to: "wontfix", label: "user wontfix" },
    // A confirmed hypothesis node pins the root cause.
    { from: "wip", to: "root-caused", label: "confirmed" },
    // The tree did not converge — a re-openable hold.
    { from: "wip", to: "inconclusive", label: "no convergence" },
    { from: "wip", to: "resolved", label: "fix landed" },
    { from: "wip", to: "wontfix", label: "user wontfix" },
    // Re-open the cause / hold on a new lead (the round loop).
    { from: "root-caused", to: "wip", label: "re-drill" },
    { from: "inconclusive", to: "wip", label: "new lead" },
    // The confirmed-root-cause file-and-defer handoff.
    { from: "root-caused", to: "seed-goal", label: "file-and-defer" },
    { from: "root-caused", to: "resolved", label: "fix landed" },
    { from: "root-caused", to: "wontfix", label: "user abandons" },
    { from: "inconclusive", to: "wontfix", label: "user abandons" },
  ],
};

/**
 * Implement flow — the `tasks` lifecycle (T200 §Implement flow): the
 * pick-ready → implement → review → fix/merge loop plus the user-question
 * register (the `blocked` hold) and the reviewer file-and-defer to investigate.
 */
const implementFlow: FlowDefinition = {
  id: "implement",
  title: "Implement flow (tasks)",
  nodes: [
    { id: "planned", label: "planned (ready)", kind: "state" },
    { id: "wip", label: "wip", kind: "state" },
    { id: "review", label: "review", kind: "state" },
    { id: "blocked", label: "blocked", kind: "waiting" },
    { id: "file-defect", label: "file defect → investigate", kind: "handoff" },
    { id: "done", label: "done (merged)", kind: "terminal", terminal: true },
    { id: "abandoned", label: "abandoned", kind: "terminal", terminal: true },
  ],
  edges: [
    // The orchestrator dispatches a worker for a DAG-ready task.
    { from: "planned", to: "wip", label: "pick ready / dispatch" },
    // Worker passed → adversarial review.
    { from: "wip", to: "review", label: "worker passed" },
    // Autonomous criticism loop: disapprove → re-dispatch same worker.
    { from: "review", to: "wip", label: "criticism / fix" },
    // Success gate: approve + green check → merge-back → done.
    { from: "review", to: "done", label: "approve / merge" },
    // The reviewer's defects[] bucket is filed (file-and-defer).
    { from: "review", to: "file-defect", label: "out-of-scope defect" },
    // Reviewer questions or ill-loop bailout park the task on a question.
    { from: "wip", to: "blocked", label: "question / bailout" },
    { from: "review", to: "blocked", label: "reviewer questions" },
    // Resume bookkeeping once the blocking questions are answered.
    { from: "blocked", to: "planned", label: "answered / resume" },
    // Abandon from any non-terminal state.
    { from: "planned", to: "abandoned", label: "abandon" },
    { from: "wip", to: "abandoned", label: "abandon" },
  ],
};

/**
 * Advance sequencer overview — the cross-flow handoff topology (T200 §Overview).
 * Shows the investigate→plan→implement quiescence loop and the three named
 * cross-flow handoff edges: plan file-and-defer-defect→investigate; investigate
 * seed-goal→plan; plan planned→implement.
 */
const advanceFlow: FlowDefinition = {
  id: "advance",
  title: "Advance sequencer (cross-flow)",
  nodes: [
    { id: "investigate", label: "investigate", kind: "state" },
    { id: "plan", label: "plan", kind: "state" },
    { id: "implement", label: "implement", kind: "state" },
    { id: "quiescent", label: "quiescent", kind: "terminal", terminal: true },
  ],
  edges: [
    // The three named cross-flow handoff edges (see exported constants).
    {
      ...HANDOFF_SEED_GOAL_TO_PLAN,
      label: "seed-goal → plan",
    },
    {
      ...HANDOFF_PLANNED_TO_IMPLEMENT,
      label: "planned → implement",
    },
    {
      ...HANDOFF_FILE_DEFER_TO_INVESTIGATE,
      label: "file-and-defer defect → investigate",
    },
    // The implement reviewer may file new defects → re-check investigate.
    { from: "implement", to: "investigate", label: "file-and-defer defect" },
    // The loop drains to quiescence (all three predicates FALSE).
    { from: "implement", to: "quiescent", label: "drained" },
  ],
};

/**
 * The four flows, in the Q115 order: plan, investigate, implement, advance.
 * The Flows tab (T205) renders them in this array order.
 */
export const FLOWS: readonly FlowDefinition[] = [
  planFlow,
  investigateFlow,
  implementFlow,
  advanceFlow,
];
