/**
 * codexProducer.ts — Codex-backed headless producer (Q8 Codex path).
 *
 * STATUS (WF-D01): the Codex SDK (`@openai/codex-sdk@0.134.0`) exposes only
 * `Thread.runStreamed(text)` with no native structured-output / forced-tool
 * mechanism equivalent to Claude's in-process `submit_plan` MCP tool. The
 * Codex CLI auto-discovers MCP tools via `tools/list` (see codexBridge.ts),
 * so a harness-owned submit tool would have to be exposed through the
 * standalone `cq-mcp` stdio binary — which is exactly the ledger-write path
 * the brief forbids the producer from using, and wiring a SECOND headless
 * stdio MCP binary purely for `submit_plan` is out of scope for phase 1.
 *
 * Per the brief ("if Codex genuinely blocks it, implement Claude + file a
 * defect with the exact Codex API gap"), the Codex producer is deferred. The
 * dispatch path is wired (the runtime selects this producer for
 * platform="codex") and tested against a fake in workflow tests; the REAL
 * Codex structured-output dispatch is the documented gap WF-D01.
 *
 * Calling `produce` rejects with a clear, actionable error rather than
 * silently faking output.
 */

import type { Logger } from "../log/logger";
import type { ProduceRequest, ProducerOutput, WorkflowProducer } from "./producer.js";

export interface CodexProducerOpts {
  logger: Logger;
}

export class CodexProducer implements WorkflowProducer {
  private readonly logger: Logger;

  constructor(opts: CodexProducerOpts) {
    this.logger = opts.logger;
  }

  produce(_req: ProduceRequest): Promise<ProducerOutput> {
    this.logger.warn("workflow.codex_producer_unavailable", {});
    return Promise.reject(
      new Error(
        "Codex producer is not implemented yet (WF-D01): the Codex SDK has no " +
          "structured-output forcing equivalent to Claude's submit_plan tool. " +
          "Switch the model dropdown to a Claude model to run /plan.",
      ),
    );
  }
}
