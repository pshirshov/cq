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
  const userBubble = cq.page.locator("[data-role='user']").first();
  await expect(userBubble).toBeVisible({ timeout: 5_000 });
  await expect(userBubble).toContainText(userText);

  // Wait for the assistant reply to land — this drives the late chat.started
  // frame from the SDK. D33: the user bubble must SURVIVE this; the prior
  // bug wiped chatEvents on every chat.started, including the late one.
  await cq.waitForTextInStream("acknowledged", 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // Re-assert the user bubble after the assistant reply has rendered.
  // If chatEvents was wiped by the second chat.started, the user bubble
  // would be gone by now.
  await expect(cq.page.locator("[data-role='user']").first()).toBeVisible();
  await expect(cq.page.locator("[data-role='user']").first()).toContainText(userText);
});
