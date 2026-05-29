/**
 * @cq/server workflow module — `/plan` WorkflowRuntime (phase 1).
 */

export { parsePlanCommand } from "./commandRegistry.js";
export type {
  ParsedCommand,
  PlanNewCommand,
  PlanContinueCommand,
  MalformedCommand,
} from "./commandRegistry.js";
export {
  WorkflowRuntime,
  SPEC_MILESTONE_TITLE,
} from "./workflowRuntime.js";
export type {
  WorkflowRuntimeOpts,
  WorkflowEventSink,
  ProducerSelector,
  StartPlanInput,
  StartPlanResult,
} from "./workflowRuntime.js";
export {
  ProducerOutputSchema,
  ProducerQuestionSchema,
  buildProducerPrompt,
} from "./producer.js";
export type {
  WorkflowProducer,
  ProducerOutput,
  ProducerQuestion,
  ProduceRequest,
} from "./producer.js";
export { ClaudeProducer } from "./claudeProducer.js";
export type { ClaudeProducerOpts, QueryFactory as ProducerQueryFactory } from "./claudeProducer.js";
export { CodexProducer } from "./codexProducer.js";
export type { CodexProducerOpts } from "./codexProducer.js";
