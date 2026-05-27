/**
 * subagent-transcript.spec.ts — T2: invocation transcript viewer.
 *
 * Scenario:
 *   1. Open the page and send a message to create an invocation in history.
 *   2. Navigate to the History tab.
 *   3. Click the first invocation row.
 *   4. Assert that the Detail overlay opens (data-testid="detail-overlay").
 *   5. Assert the agent name and session-id labels are visible.
 *   6. Close the overlay via the close button.
 *   7. Assert the overlay is gone.
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("subagent-transcript: clicking history row opens transcript overlay", async ({ cq, mock }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Send a message so there is at least one completed invocation in history.
  const replyText = "transcript-reply-unique";
  await mock.script(makeTextSSEEvents(replyText));
  await cq.sendMessage("transcript-probe");
  await cq.waitForTextInStream(replyText, 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // Navigate to the History tab.
  await cq.goToHistory();

  // Wait for at least one history row to appear.
  const firstRow = cq.page.locator("[data-testid^='history-row-']").first();
  await expect(firstRow).toBeVisible({ timeout: 10_000 });

  // Click the row to open the Detail overlay.
  await firstRow.click();

  // The detail overlay must appear.
  const overlay = cq.page.locator("[data-testid='detail-overlay']");
  await expect(overlay).toBeVisible({ timeout: 5_000 });

  // The agent name label must be present.
  const agentName = cq.page.locator("[data-testid='detail-agent-name']");
  await expect(agentName).toBeVisible({ timeout: 3_000 });

  // The session-id label must be present (proves the header rendered).
  const sessionId = cq.page.locator("[data-testid='detail-session-id']");
  await expect(sessionId).toBeVisible({ timeout: 3_000 });

  // Close the overlay via the close button.
  const closeBtn = cq.page.locator("[data-testid='detail-close-btn']").first();
  await closeBtn.click();
  await expect(overlay).not.toBeVisible({ timeout: 3_000 });
});
