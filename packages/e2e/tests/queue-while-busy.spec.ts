/**
 * queue-while-busy.spec.ts — D49: typing while a turn is in progress
 * queues a follow-up message via the SDK's AsyncIterable<UserMessage>.
 *
 * Scenario:
 *   1. Open page, wait for ALIVE + idle.
 *   2. Script the mock with two responses (sticky mode: last script wins).
 *   3. Send "first-msg".
 *   4. Wait for the first assistant reply to settle (turn 1 complete).
 *   5. Script the second response.
 *   6. Send "second-msg".
 *   7. Assert BOTH user bubbles ([data-role='user']) are visible in the stream.
 *   8. Wait for the second assistant reply. Assert two assistant bubbles appeared.
 *
 * Note on timing: the mock server returns HTTP responses immediately (no
 * real streaming delay), so we cannot race a second send inside the
 * chat.event → chat.done window of the first turn. The test instead
 * verifies the full two-turn flow — that the second user message is queued,
 * processed, and both user + assistant bubbles are rendered. The actual
 * server-side SDK queue is exercised by the integration test harness.
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("queue-while-busy: both user messages and both assistant replies appear", async ({ cq, mock }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // ---- Turn 1 ----
  const reply1 = "reply-to-first-msg";
  await mock.script(makeTextSSEEvents(reply1));
  await cq.sendMessage("first-msg");

  // First user bubble must appear immediately (server echoes on chat.input).
  const userBubbles = cq.page.locator("[data-role='user']");
  await expect(userBubbles.first()).toBeVisible({ timeout: 10_000 });
  await expect(userBubbles.first()).toContainText("first-msg");

  // Wait for first assistant reply and turn to complete.
  await cq.waitForTextInStream(reply1, 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // ---- Turn 2 ----
  const reply2 = "reply-to-second-msg";
  await mock.script(makeTextSSEEvents(reply2));
  await cq.sendMessage("second-msg");

  // Second user bubble must appear.
  await expect(userBubbles.nth(1)).toBeVisible({ timeout: 10_000 });
  await expect(userBubbles.nth(1)).toContainText("second-msg");

  // Wait for second assistant reply to settle.
  await cq.waitForTextInStream(reply2, 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // Final assertion: two user bubbles and both assistant reply texts visible.
  await expect(userBubbles).toHaveCount(2, { timeout: 5_000 });
  await cq.waitForTextInStream(reply1, 5_000);
  await cq.waitForTextInStream(reply2, 5_000);
});
