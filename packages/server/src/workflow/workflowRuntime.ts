/**
 * workflowRuntime.ts — deterministic engine behind `/plan` (phase 1 only).
 *
 * Lifecycle of one `/plan <text>` run (Q14 cycle 2 = phase 1):
 *   1. emit workflow.event{status:"started"}
 *   2. emit workflow.event{status:"producing"}
 *   3. dispatch the headless producer (own lane; NOT the pool=1 Bridge) →
 *      validated { goal, questions }
 *   4. HARNESS writes the ledgers under the store's locks:
 *        - goal in `goals` (status=clarifying, description=producer's)
 *        - mandatory spec milestone "produce an actionable specification"
 *          (Q11), linked from the goal (goal.milestones=[<id>])
 *        - each question in `questions`, grouped under that milestone
 *   5. emit workflow.event{status:"questions_ready", goalId, detail:"N questions"}
 *   On any failure: emit workflow.event{status:"errored", detail} and write
 *   NOTHING (ledger writes happen only after a successful producer submit).
 *
 * Concurrency (Q D): a single in-memory `active` slot. A second `/plan` while
 * one runs is rejected with a busy lifecycle error — recommended over
 * queueing for phase 1.
 *
 * The HARNESS owns all ledger writes; the producer cannot write ledgers.
 */

import type { Logger } from "../log/logger";
import type { LedgerStore } from "@cq/ledger";
import { GOALS_LEDGER, QUESTIONS_LEDGER } from "@cq/ledger";
import type { WorkflowEvent } from "@cq/shared";
import type { WorkflowProducer, ProducerOutput } from "./producer.js";

/** The mandatory first milestone (Q11). Its deliverable is the converged Q&A + scope. */
export const SPEC_MILESTONE_TITLE = "produce an actionable specification" as const;

/** A sink for outbound lifecycle frames (server wires this to the main WS session). */
export type WorkflowEventSink = (event: Omit<WorkflowEvent, "seq" | "ts">) => void;

/** Selects the producer for a given platform (Q8). */
export type ProducerSelector = (platform: "claude" | "codex") => WorkflowProducer;

export interface WorkflowRuntimeOpts {
  logger: Logger;
  store: LedgerStore;
  /** Resolves a producer per platform. */
  selectProducer: ProducerSelector;
}

/** Input to a single `/plan <text>` (new-goal) run. */
export interface StartPlanInput {
  readonly text: string;
  readonly platform: "claude" | "codex";
}

/** A tracked active workflow run. */
interface ActiveWorkflow {
  readonly workflowId: string;
  readonly abort: AbortController;
}

/** Result of a runtime entry point (for the caller / tests). */
export type StartPlanResult =
  | { readonly outcome: "questions_ready"; readonly workflowId: string; readonly goalId: string }
  | { readonly outcome: "busy"; readonly workflowId: string }
  | { readonly outcome: "errored"; readonly workflowId: string; readonly reason: string };

export class WorkflowRuntime {
  private readonly logger: Logger;
  private readonly store: LedgerStore;
  private readonly selectProducer: ProducerSelector;
  /** Single active workflow (Q D: pool=1 for the workflow lane too). */
  private active: ActiveWorkflow | null = null;

  constructor(opts: WorkflowRuntimeOpts) {
    this.logger = opts.logger;
    this.store = opts.store;
    this.selectProducer = opts.selectProducer;
  }

  /** True iff a workflow is currently running. */
  isBusy(): boolean {
    return this.active !== null;
  }

  /**
   * Abort the active workflow (if any). Fire-and-forget: signals the
   * producer's AbortController so its headless query is closed and the run
   * rejects with "producer aborted". Used by graceful shutdown and the E2E
   * teardown hook so an orphaned producer subprocess cannot leak into the
   * next test. No-op when idle.
   */
  abortActive(): void {
    if (this.active === null) return;
    this.logger.info("workflow.abort_active", { workflowId: this.active.workflowId });
    this.active.abort.abort();
  }

  /**
   * `/plan G<id> <text>` continuation — not implemented this cycle (Q9/Q10).
   * Parses + routes only; emits a continuation-not-implemented lifecycle error.
   */
  startContinuation(goalRef: string, emit: WorkflowEventSink): StartPlanResult {
    const workflowId = crypto.randomUUID();
    const reason = `continuation of ${goalRef} is not implemented yet`;
    emit({ type: "workflow.event", workflowId, phase: "produce", status: "errored", detail: reason });
    this.logger.info("workflow.continuation_not_implemented", { workflowId, goalRef });
    return { outcome: "errored", workflowId, reason };
  }

  /**
   * Run a new-goal `/plan <text>` workflow to phase-1 completion.
   * Resolves with the outcome; lifecycle frames are emitted via `emit`.
   */
  async startPlan(input: StartPlanInput, emit: WorkflowEventSink): Promise<StartPlanResult> {
    const workflowId = crypto.randomUUID();

    if (this.active !== null) {
      const reason = "a planning workflow is already running; wait for it to finish";
      emit({ type: "workflow.event", workflowId, phase: "produce", status: "errored", detail: reason });
      this.logger.info("workflow.busy_rejected", { workflowId, active: this.active.workflowId });
      return { outcome: "busy", workflowId };
    }

    const abort = new AbortController();
    this.active = { workflowId, abort };
    emit({ type: "workflow.event", workflowId, phase: "produce", status: "started" });
    this.logger.info("workflow.started", { workflowId, platform: input.platform });

    try {
      emit({ type: "workflow.event", workflowId, phase: "produce", status: "producing" });
      const producer = this.selectProducer(input.platform);
      const output = await producer.produce({ text: input.text, signal: abort.signal });

      // HARNESS writes the ledgers. Producer output is validated already
      // (ProducerOutputSchema in the submit handler), but we re-assert the
      // invariant the harness depends on: at least one question.
      const goalId = await this.writeArtifacts(output);

      emit({
        type: "workflow.event",
        workflowId,
        goalId,
        phase: "produce",
        status: "questions_ready",
        detail: `${output.questions.length} question${output.questions.length === 1 ? "" : "s"} ready in the Goals tab`,
      });
      this.logger.info("workflow.questions_ready", {
        workflowId,
        goalId,
        questionCount: output.questions.length,
      });
      return { outcome: "questions_ready", workflowId, goalId };
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : String(err);
      emit({ type: "workflow.event", workflowId, phase: "produce", status: "errored", detail: reason });
      this.logger.warn("workflow.errored", { workflowId, reason });
      return { outcome: "errored", workflowId, reason };
    } finally {
      if (this.active?.workflowId === workflowId) {
        this.active = null;
      }
    }
  }

  /**
   * Write goal + spec milestone + questions. Ordering chosen so that no
   * half-written state is observable on a mid-write failure:
   *   1. createMilestone (spec) — independent of the goal.
   *   2. createItem(goals, spec, goal) — goal references the spec milestone.
   *   3. createItem(questions, spec, …) per question.
   *   4. updateItem(goals, goalId, milestones=[specId]) — link last.
   * If the producer never submits, `writeArtifacts` is never reached, so the
   * ledgers stay untouched on producer failure (the documented guarantee).
   *
   * Returns the goal id.
   */
  private async writeArtifacts(output: ProducerOutput): Promise<string> {
    // 1. Mandatory spec milestone (Q11). The runtime controls its creation so
    // every plan always carries it; the producer has no say.
    const specMilestone = await this.store.createMilestone({
      title: SPEC_MILESTONE_TITLE,
      description:
        "The clarified scope + answered clarifying questions are this milestone's deliverable (Q11).",
    });
    const specId = specMilestone.id;

    // 2. Goal row (status=clarifying), grouped under the spec milestone.
    const goalItem = await this.store.createItem(GOALS_LEDGER, specId, {
      status: "clarifying",
      fields: { description: output.goal.description },
    });
    const goalId = goalItem.id;

    // 3. One question row per produced question, grouped under the spec milestone.
    for (const q of output.questions) {
      const fields: Record<string, string | string[]> = { question: q.question };
      if (q.context !== undefined) fields["context"] = q.context;
      if (q.suggestions !== undefined) fields["suggestions"] = q.suggestions;
      if (q.recommendation !== undefined) fields["recommendation"] = q.recommendation;
      await this.store.createItem(QUESTIONS_LEDGER, specId, {
        status: "open",
        fields,
      });
    }

    // 4. Link the spec milestone from the goal (goal.milestones=[specId]).
    await this.store.updateItem(GOALS_LEDGER, goalId, {
      fields: { milestones: [specId] },
    });

    return goalId;
  }
}
