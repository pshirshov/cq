/**
 * send-receive.spec.ts — Tier 1: user sends a message and sees the response.
 *
 * Scenario:
 *   1. Open the page (wait for ALIVE + idle)
 *   2. Script the mock to return "echo hello" as the next response
 *   3. Type "echo hello" in the textarea and press Ctrl+Enter
 *   4. Wait for the assistant response to appear in the Stream
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("send-receive: user sends message and sees assistant response", async ({ cq, mock }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Script the mock to return a specific reply.
  const replyText = "echo hello — reply from mock";
  await mock.script(makeTextSSEEvents(replyText));

  // Send the message.
  await cq.sendMessage("echo hello");

  // Wait for the response to appear in the stream.
  await cq.waitForTextInStream(replyText, 25_000);

  // The textarea should be enabled again (chat.done received).
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });
});
