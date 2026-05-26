/**
 * askUserQuestion.ts — Candidate-A answer injection for AskUserQuestion tool.
 *
 * Candidate A (§ 5.7.2): push a synthetic SDKUserMessage with a tool_result
 * content block onto the streaming-input AsyncQueue, using the same mechanism
 * as chat.input (SDKUserMessage{type:'user', message:{role:'user',
 * content:[{type:'tool_result', tool_use_id, content}]}}). The SDK subprocess
 * should interpret this as the user's chosen answer to the AskUserQuestion call.
 *
 * CONSTRAINT (PR-31-D01): This path is untested against the real bundled CLI
 * (`@anthropic-ai/claude-agent-sdk-linux-x64` is not installed in this env).
 * If a future PR confirms the subprocess rejects this form, fall back to
 * `Options.disallowedTools:['AskUserQuestion']`.
 */

import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

/**
 * The minimal queue interface required by injectAnswer.
 * Matches AsyncQueue<SDKUserMessage>.push from bridge.ts.
 */
export interface PushableQueue {
  push(item: SDKUserMessage): void;
}

/**
 * Build the answer payload content string from a map of questionIndex → chosenLabel(s).
 * The SDK's AskUserQuestion tool result is unspecified in the public docs;
 * Candidate A encodes answers as a JSON object: { answers: { "0": ["label"], ... } }.
 */
function buildAnswerContent(answers: Record<string, unknown>): string {
  return JSON.stringify({ answers });
}

/**
 * Inject a synthetic SDKUserMessage tool_result onto the streaming-input queue.
 *
 * @param queue     The AsyncQueue<SDKUserMessage> from the active Bridge session.
 * @param toolUseId The tool_use_id from the AskUserQuestion tool_use block.
 * @param answers   Map of question index (as string) → selected labels (string[]).
 */
export function injectAnswer(
  queue: PushableQueue,
  toolUseId: string,
  answers: Record<string, unknown>,
): void {
  const content = buildAnswerContent(answers);

  const msg: SDKUserMessage = {
    type: "user",
    message: {
      role: "user",
      content: [
        {
          type: "tool_result",
          tool_use_id: toolUseId,
          content,
        },
      ],
    } as SDKUserMessage["message"],
    parent_tool_use_id: null,
  };

  queue.push(msg);
}
