/**
 * refresh-resume.spec.ts — D47: page refresh rejoins or resumes prior session.
 *
 * Scenario:
 *   1. Open the page and wait for ALIVE + idle (session established).
 *   2. Send a message, wait for the assistant reply to appear.
 *   3. Reload the page.
 *   4. Assert: the assistant reply is STILL VISIBLE after reload (rejoin replayed
 *      history from persistence).
 *   5. Assert: the textarea is enabled (session ready for more input).
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("refresh-resume: assistant reply is visible after page reload", async ({ cq, mock, page }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Script a reply.
  const replyText = "refresh-resume reply unique-abc123";
  await mock.script(makeTextSSEEvents(replyText));

  // Send a message and wait for the reply.
  await cq.sendMessage("hello refresh");
  await cq.waitForTextInStream(replyText, 25_000);

  // Verify the textarea is enabled (turn is done) before reloading.
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // Reload the page — triggers the rejoin flow (D47).
  await page.reload();

  // Wait for the connection to come back alive.
  await cq.waitForAlive(15_000);

  // Wait for the textarea to become enabled (session resumed / started).
  await expect(cq.textarea).toBeEnabled({ timeout: 15_000 });

  // The assistant reply must be visible again (history replayed after rejoin).
  await cq.waitForTextInStream(replyText, 15_000);
});
