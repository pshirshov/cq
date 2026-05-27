/**
 * user-message-visible.spec.ts — regression for D24.
 *
 * Confirms the user's typed input appears in the chat stream as a
 * role="user" MessageBubble. The SDK does not echo typed-user input
 * back through the event stream (only tool_result wrapper "user"
 * frames appear), so the client must synthesize a local ChatEvent
 * on submit. This test pins that contract.
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("user-message-visible: typed input renders as a user bubble", async ({ cq, mock }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Scripted assistant reply so the round-trip completes cleanly.
  await mock.script(makeTextSSEEvents("acknowledged"));

  const userText = `regression-probe-${Date.now()}`;
  await cq.sendMessage(userText);

  // The user bubble must appear in the stream with role="user".
  // We assert: (a) at least one element with data-role="user" exists;
  //            (b) its visible text contains exactly what the user typed.
  const userBubble = cq.page.locator("[data-role='user']").first();
  await expect(userBubble).toBeVisible({ timeout: 5_000 });
  await expect(userBubble).toContainText(userText);

  // Sanity: the assistant response also rendered so the flow completed.
  await cq.waitForTextInStream("acknowledged", 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });
});
