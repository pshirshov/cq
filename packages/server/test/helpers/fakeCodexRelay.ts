/**
 * fakeCodexRelay — a deterministic fake for the headless Codex workflow lane
 * (codexwf) that exercises the REAL relay seam end-to-end WITHOUT spawning a
 * codex CLI or a cq-mcp child.
 *
 * The real path is: headless Codex thread → cq-mcp child's
 * `submit_workflow_phase` tool → `workflow.submit` over the internal WS →
 * `WorkflowSubmitProxy.onSubmit` → validate + resolve the dispatch.
 *
 * This fake replaces only the "codex thread + cq-mcp child" middle: when
 * `runStreamed` is invoked, it reads the `submitId` + `phase` the dispatch
 * primed into `config.mcp_servers.cq.env` (the SAME env the real cq-mcp child
 * would read) and calls a supplied `relay(submitId, phase, payload)` — which a
 * test wires to `WorkflowSubmitProxy.onSubmit`. So the proxy correlation,
 * per-phase Zod validation, ack, and the runtime's ledger writes are all the
 * REAL code under test; only the model + transport are faked.
 *
 * A canned payload is selected per phase. A function entry is invoked lazily so
 * a test can vary output per round (e.g. an unsatisfied reviewer).
 */

import type {
  Codex,
  CodexOptions,
  Thread,
  ThreadEvent,
  ThreadOptions,
  RunStreamedResult,
} from "@openai/codex-sdk";
import type { WorkflowSubmitPhase } from "@cq/shared";

export type RelayFn = (submitId: string, phase: WorkflowSubmitPhase, payload: unknown) => void;

type Canned = unknown | (() => unknown);

export interface FakeCodexRelayOpts {
  /** Drives a relayed submit into the system under test (e.g. proxy.onSubmit). */
  relay: RelayFn;
  /** Per-phase canned payload the fake "model" submits. */
  payloads: Partial<Record<WorkflowSubmitPhase, Canned>>;
  /**
   * If set for a phase, the fake yields events and ends WITHOUT submitting
   * (simulates a model that never calls the tool → dispatch rejects on
   * stream-end / timeout). Used by the no-submit regression test.
   */
  noSubmit?: Partial<Record<WorkflowSubmitPhase, boolean>>;
}

/** Read the primed env from the dispatch's CodexOptions. */
function readEnv(options: CodexOptions | undefined): { submitId: string; phase: WorkflowSubmitPhase } {
  const cfg = options?.config as
    | undefined
    | { mcp_servers?: { cq?: { env?: Record<string, string> } } };
  const env = cfg?.mcp_servers?.cq?.env ?? {};
  const submitId = env["CQ_WORKFLOW_SUBMIT_ID"];
  const phase = env["CQ_WORKFLOW_PHASE"];
  if (submitId === undefined || phase === undefined) {
    throw new Error("fakeCodexRelay: CodexOptions did not carry CQ_WORKFLOW_SUBMIT_ID / CQ_WORKFLOW_PHASE env");
  }
  return { submitId, phase: phase as WorkflowSubmitPhase };
}

class FakeThread {
  constructor(
    private readonly submitId: string,
    private readonly phase: WorkflowSubmitPhase,
    private readonly opts: FakeCodexRelayOpts,
  ) {}

  get id(): string | null {
    return "fake-thread";
  }

  async runStreamed(_input: string, _turnOptions?: unknown): Promise<RunStreamedResult> {
    const submitId = this.submitId;
    const phase = this.phase;
    const opts = this.opts;
    async function* events(): AsyncGenerator<ThreadEvent> {
      yield { type: "thread.started", thread_id: "fake-thread" } as ThreadEvent;
      yield { type: "turn.started" } as ThreadEvent;
      const skip = opts.noSubmit?.[phase] === true;
      if (!skip) {
        const canned = opts.payloads[phase];
        if (canned === undefined) {
          throw new Error(`fakeCodexRelay: no canned payload for phase ${phase}`);
        }
        const payload = typeof canned === "function" ? (canned as () => unknown)() : canned;
        // Simulate the cq-mcp child relaying the model's submit upstream.
        opts.relay(submitId, phase, payload);
      }
      yield {
        type: "turn.completed",
        usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1, reasoning_output_tokens: 0 },
      } as ThreadEvent;
    }
    return { events: events() };
  }

  async run(): Promise<never> {
    throw new Error("fakeCodexRelay: run() not exercised");
  }
}

class FakeCodex {
  constructor(private readonly opts: FakeCodexRelayOpts, private readonly options: CodexOptions | undefined) {}

  startThread(_threadOptions?: ThreadOptions): Thread {
    const { submitId, phase } = readEnv(this.options);
    return new FakeThread(submitId, phase, this.opts) as unknown as Thread;
  }

  resumeThread(_id: string, _threadOptions?: ThreadOptions): Thread {
    return this.startThread();
  }
}

/**
 * Build a `CodexFactory` for the headless lane that relays the canned payload
 * for each phase into the supplied `relay` callback.
 */
export function makeFakeCodexFactory(
  opts: FakeCodexRelayOpts,
): (options?: CodexOptions) => Promise<Codex> {
  return async (options?: CodexOptions): Promise<Codex> =>
    new FakeCodex(opts, options) as unknown as Codex;
}
