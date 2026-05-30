/**
 * pcontent (WF-HIST-02) — `/plan` planning CONTENT recorded as replayable events.
 *
 * WF-HIST recorded a `/plan` run as session + root + per-phase child invocations
 * but wrote NO event rows, so the History Detail of a planning run was EMPTY.
 * This suite proves the fix end-to-end against BOTH persistence adapters:
 *
 *  - WF-HIST-02a: each phase subagent's drained SDK messages are appended under
 *    that phase's CHILD invocation (so the child's Detail replays its transcript).
 *  - WF-HIST-02b: an "asked" event (assistant-style) lands under the run ROOT on
 *    every question batch; an "answered" event (user-style) lands on each answer.
 *
 * Events are read back via `persistence.events.readAll(invocationId)` — the exact
 * source `history.get{replay:true}` streams to `<Stream mode="replay">`.
 */

import { describe, it, expect } from "bun:test";
import {
  InMemoryLedgerStore,
  GOALS_LEDGER,
  QUESTIONS_LEDGER,
  type LedgerStore,
} from "@cq/ledger";
import {
  WorkflowRuntime,
  CLARIFY_REVIEW_SPEC,
  PLAN_SPEC,
  PLAN_REVIEW_SPEC,
  type WorkflowProducer,
  type ProducerOutput,
  type ProduceRequest,
  type WorkflowEventSink,
  type ClarifyReviewOutput,
  type PlanOutput,
  type PlanReviewOutput,
} from "../src/workflow/index";
import type { WorkflowEvent, InvocationRow } from "@cq/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import { noopLogger } from "./helpers/mockBridge";
import { FakePhaseSubagent } from "./helpers/fakePhaseSubagent";
import { SqlitePersistence } from "../src/persist/SqlitePersistence.js";
import { InMemoryPersistence } from "../src/persist/InMemoryPersistence.js";
import type { Persistence } from "../src/persist/Persistence.js";

const GROUNDING = "cq is a local-first ledger app; ledgers under docs/; workflow runtime drives /plan.";

const PRODUCER_OUT: ProducerOutput = {
  goal: { title: "Notes app", description: "A local-first encrypted notetaking webapp." },
  questions: [{ question: "Which platforms?", suggestions: ["web", "desktop"], recommendation: "web" }],
  grounding: GROUNDING,
};

/** A synthetic assistant SDK message carrying text (the lane's drained shape). */
function assistantMsg(text: string): SDKMessage {
  return {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text }], id: `a-${text}` },
    parent_tool_use_id: null,
  } as unknown as SDKMessage;
}

/** A producer that forwards SDK events through onEvent (models the real lane). */
class EventingProducer implements WorkflowProducer {
  constructor(private readonly events: SDKMessage[]) {}
  produce(req: ProduceRequest): Promise<ProducerOutput> {
    if (req.onEvent !== undefined) for (const e of this.events) req.onEvent(e);
    return Promise.resolve(PRODUCER_OUT);
  }
}

const CLEAR: ClarifyReviewOutput = { clear: true, contradictions: [], newQuestions: [] };
const PLAN: PlanOutput = {
  milestones: [{ title: "Core", description: "the core build" }],
  tasks: [{ milestoneRef: 0, headline: "Editor", description: "rich text editor", acceptance: "renders" }],
};
const SATISFIED: PlanReviewOutput = { satisfied: true, findings: [], newQuestions: [] };

function collector(): { sink: WorkflowEventSink; events: Array<Omit<WorkflowEvent, "seq" | "ts">> } {
  const events: Array<Omit<WorkflowEvent, "seq" | "ts">> = [];
  return { sink: (e) => events.push(e), events };
}

function makeRuntime(
  store: LedgerStore,
  phase: FakePhaseSubagent,
  persistence: Persistence,
  producer: WorkflowProducer,
): WorkflowRuntime {
  return new WorkflowRuntime({
    logger: noopLogger,
    store,
    selectProducer: () => producer,
    selectPhaseSubagent: () => phase,
    persistence,
    cwd: "/tmp/pcontent-test",
  });
}

/** Collect the text blocks of every event recorded under an invocation. */
async function eventTexts(p: Persistence, invocationId: string): Promise<string[]> {
  const out: string[] = [];
  for await (const ev of p.events.readAll(invocationId)) {
    // The renderer reads message.content[].text on assistant/user messages.
    const msg = (ev as unknown as { message?: { content?: Array<{ type?: string; text?: string }> } }).message;
    for (const block of msg?.content ?? []) {
      if (block.type === "text" && typeof block.text === "string") out.push(block.text);
    }
  }
  return out;
}

function rowsForSession(p: Persistence, sessionId: string): InvocationRow[] {
  return p.invocations.listForSession(sessionId);
}

function runSuite(label: string, factory: () => Persistence): void {
  describe(`workflow-content (${label})`, () => {
    it("each phase records its drained SDK messages under its child invocation (Detail non-empty)", async () => {
      const p = factory();
      try {
        const store = new InMemoryLedgerStore();
        await store.init();
        const phase = new FakePhaseSubagent()
          .fireEvents([assistantMsg("clarify-reasoning"), assistantMsg("plan-reasoning")]);
        phase.enqueue(CLARIFY_REVIEW_SPEC, CLEAR).enqueue(PLAN_SPEC, PLAN).enqueue(PLAN_REVIEW_SPEC, SATISFIED);
        const producer = new EventingProducer([assistantMsg("producer-explored-the-repo")]);
        const rt = makeRuntime(store, phase, p, producer);
        const { sink } = collector();

        const res = await rt.startPlan({ text: "build it", platform: "claude", model: "m" }, sink);
        if (res.outcome !== "questions_ready") throw new Error("unreachable");
        const goalId = res.goalId;
        const link = p.workflowSessions.getByGoal(goalId)!;

        // Producer child has its drained event recorded.
        let rows = rowsForSession(p, link.sessionId);
        const producerRow = rows.find((r) => r.agentName === "producer")!;
        expect(await eventTexts(p, producerRow.id)).toContain("producer-explored-the-repo");

        // Drive clarify → plan → review.
        const goal = store.fetchItem(GOALS_LEDGER, goalId);
        const specId = (goal.fields["milestones"] as string[])[0]!;
        const q0 = (store.listMilestoneItems(specId)[QUESTIONS_LEDGER] ?? [])[0]!.id;
        await rt.submitAnswer(q0, "web");
        await rt.whenDrained();

        rows = rowsForSession(p, link.sessionId);
        // Every looping phase child recorded its forwarded events → its Detail
        // replays a NON-empty transcript.
        const phaseChildren = rows.filter(
          (r) => r.agentName.startsWith("clarify-reviewer") || r.agentName.startsWith("planner") || r.agentName.startsWith("plan-reviewer"),
        );
        expect(phaseChildren.length).toBeGreaterThanOrEqual(3);
        for (const child of phaseChildren) {
          const texts = await eventTexts(p, child.id);
          expect(texts.length).toBeGreaterThan(0); // non-empty Detail
        }
      } finally {
        p.close();
      }
    });

    it("the Q&A (asked + answered) is recorded under the run root", async () => {
      const p = factory();
      try {
        const store = new InMemoryLedgerStore();
        await store.init();
        const phase = new FakePhaseSubagent();
        phase.enqueue(CLARIFY_REVIEW_SPEC, CLEAR).enqueue(PLAN_SPEC, PLAN).enqueue(PLAN_REVIEW_SPEC, SATISFIED);
        const producer = new EventingProducer([]);
        const rt = makeRuntime(store, phase, p, producer);
        const { sink } = collector();

        const res = await rt.startPlan({ text: "build it", platform: "claude" }, sink);
        if (res.outcome !== "questions_ready") throw new Error("unreachable");
        const goalId = res.goalId;
        const link = p.workflowSessions.getByGoal(goalId)!;
        const rootId = link.rootInvocationId;

        // The asked batch is recorded under the root.
        const askedTexts = await eventTexts(p, rootId);
        expect(askedTexts.some((t) => t.includes("Asked 1 clarifying question"))).toBe(true);
        expect(askedTexts.some((t) => t.includes("Which platforms?"))).toBe(true);

        // Answer → the answered event lands under the root, keyed by question id.
        const goal = store.fetchItem(GOALS_LEDGER, goalId);
        const specId = (goal.fields["milestones"] as string[])[0]!;
        const q0 = (store.listMilestoneItems(specId)[QUESTIONS_LEDGER] ?? [])[0]!.id;
        await rt.submitAnswer(q0, "web");
        await rt.whenDrained();

        const afterTexts = await eventTexts(p, rootId);
        expect(afterTexts.some((t) => t === `Answered ${q0}: web`)).toBe(true);
        // A re-answer does NOT duplicate the answered event.
        await rt.submitAnswer(q0, "web");
        const again = await eventTexts(p, rootId);
        expect(again.filter((t) => t === `Answered ${q0}: web`)).toHaveLength(1);
      } finally {
        p.close();
      }
    });

    it("the producer's grounding is persisted on the goal and reaches later phases after a restart", async () => {
      const p = factory();
      try {
        // Run 1: producer (with grounding), then "crash" before answering.
        const store = new InMemoryLedgerStore();
        await store.init();
        const phase1 = new FakePhaseSubagent();
        const rt1 = makeRuntime(store, phase1, p, new EventingProducer([]));
        const res = await rt1.startPlan({ text: "build it", platform: "claude" }, collector().sink);
        if (res.outcome !== "questions_ready") throw new Error("unreachable");
        const goalId = res.goalId;

        // Grounding is durable on the goal.
        const goal = store.fetchItem(GOALS_LEDGER, goalId);
        expect(goal.fields["grounding"]).toBe(GROUNDING);

        // Run 2 (the "restarted" process): fresh runtime, same store + persistence
        // (its in-memory state starts empty → grounding re-read from the goal).
        const phase2 = new FakePhaseSubagent();
        phase2.enqueue(CLARIFY_REVIEW_SPEC, CLEAR).enqueue(PLAN_SPEC, PLAN).enqueue(PLAN_REVIEW_SPEC, SATISFIED);
        const rt2 = makeRuntime(store, phase2, p, new EventingProducer([]));
        rt2.subscribe(collector().sink);
        await rt2.reconcile();

        const specId = (goal.fields["milestones"] as string[])[0]!;
        const q0 = (store.listMilestoneItems(specId)[QUESTIONS_LEDGER] ?? [])[0]!.id;
        await rt2.submitAnswer(q0, "web");
        await rt2.whenDrained();

        // The clarify-reviewer's prompt carried the persisted grounding + the
        // softened instruction (explore-once survives the restart).
        const clarifyPrompts = phase2.prompts.get(CLARIFY_REVIEW_SPEC.toolName) ?? [];
        expect(clarifyPrompts.length).toBeGreaterThan(0);
        expect(clarifyPrompts[0]!).toContain(GROUNDING);
        expect(clarifyPrompts[0]!).toContain("do NOT re-explore");
        // The planner prompt too.
        const plannerPrompts = phase2.prompts.get(PLAN_SPEC.toolName) ?? [];
        expect(plannerPrompts[0]!).toContain(GROUNDING);
      } finally {
        p.close();
      }
    });
  });
}

describe("workflow-content dual-adapter", () => {
  runSuite("sqlite", () => new SqlitePersistence(":memory:"));
  runSuite("memory", () => new InMemoryPersistence());
});
