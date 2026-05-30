/**
 * fakePhaseSubagent — a scriptable PhaseSubagent for workflow loop tests.
 *
 * Each phase (clarify-review / planner / plan-review) is driven by a queue of
 * canned outputs keyed by the spec's toolName. `dispatch` shifts the next
 * canned output for the matching phase. A function entry is invoked lazily so a
 * test can vary output per round (e.g. an always-unsatisfied reviewer).
 */

import type { PhaseSubagent, PhaseSpec, PhaseRequest } from "../../src/workflow/index";
import type { PhaseUsage } from "../../src/workflow/producer";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

type Canned<O> = O | (() => O);

export class FakePhaseSubagent implements PhaseSubagent {
  /** Per-toolName queue of canned outputs. */
  private readonly queues = new Map<string, Array<Canned<unknown>>>();
  /** When set, every dispatch fires `req.onUsage` with this usage (wfhist-4). */
  private usage: PhaseUsage | undefined;
  /** When set, every dispatch fires `req.onEvent` with these messages (pcontent-1). */
  private events: SDKMessage[] | undefined;

  /** Make every dispatch fire `onUsage` with the given usage before resolving. */
  fireUsage(usage: PhaseUsage): this {
    this.usage = usage;
    return this;
  }

  /**
   * Make every dispatch forward these SDK messages through `req.onEvent` before
   * resolving — models the real lane forwarding its drained message stream so the
   * phase-event recording path (WF-HIST-02a) is exercised.
   */
  fireEvents(events: SDKMessage[]): this {
    this.events = events;
    return this;
  }

  /** Per-toolName sticky output used once the queue drains (for unbounded loops). */
  private readonly sticky = new Map<string, Canned<unknown>>();
  /** Per-toolName dispatch count (assertable). */
  readonly calls = new Map<string, number>();
  /** Prompts seen per toolName (assertable — e.g. findings folded in). */
  readonly prompts = new Map<string, string[]>();

  /** Queue a canned output for a phase tool. */
  enqueue<O>(spec: PhaseSpec<O>, out: Canned<O>): this {
    const q = this.queues.get(spec.toolName) ?? [];
    q.push(out as Canned<unknown>);
    this.queues.set(spec.toolName, q);
    return this;
  }

  /** Set a sticky output returned after the queue drains (unbounded). */
  setSticky<O>(spec: PhaseSpec<O>, out: Canned<O>): this {
    this.sticky.set(spec.toolName, out as Canned<unknown>);
    return this;
  }

  dispatch<O>(spec: PhaseSpec<O>, req: PhaseRequest): Promise<O> {
    this.calls.set(spec.toolName, (this.calls.get(spec.toolName) ?? 0) + 1);
    const seen = this.prompts.get(spec.toolName) ?? [];
    seen.push(req.prompt);
    this.prompts.set(spec.toolName, seen);

    const q = this.queues.get(spec.toolName) ?? [];
    let entry: Canned<unknown> | undefined;
    if (q.length > 0) entry = q.shift();
    else entry = this.sticky.get(spec.toolName);
    if (entry === undefined) {
      return Promise.reject(new Error(`FakePhaseSubagent: no canned output for ${spec.toolName}`));
    }
    const value = typeof entry === "function" ? (entry as () => unknown)() : entry;
    if (this.events !== undefined && req.onEvent !== undefined) {
      for (const msg of this.events) req.onEvent(msg);
    }
    if (this.usage !== undefined && req.onUsage !== undefined) req.onUsage(this.usage);
    return Promise.resolve(value as O);
  }
}
