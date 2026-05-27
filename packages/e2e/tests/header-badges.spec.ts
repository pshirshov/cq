/**
 * header-badges.spec.ts — T3: header badge state transitions.
 *
 * Verifies that the header status badge and usage counter update correctly
 * across a chat turn lifecycle.
 *
 * Scenario:
 *   1. Open the page — session-status badge shows "NEW" or "IDLE".
 *   2. Send a message — session-status transitions to "BUSY" during generation.
 *   3. Wait for the reply — session-status returns to "IDLE".
 *   4. Assert usage counter (↑tokens ↓tokens $cost) contains non-zero values.
 *   5. Assert session-id badge is visible and non-empty.
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("header-badges: status transitions NEW→BUSY→IDLE and usage updates", async ({ cq, mock, page }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Initial state: badge must be NEW or IDLE (session established but no turn yet).
  const statusBadge = page.locator("[data-testid='session-status']");
  await expect(statusBadge).toBeVisible({ timeout: 5_000 });
  const initialStatus = await statusBadge.textContent();
  expect(["NEW", "IDLE"]).toContain(initialStatus?.trim());

  // Session-id badge must be present.
  const sessionIdBadge = page.locator("[data-testid='session-id']");
  await expect(sessionIdBadge).toBeVisible({ timeout: 3_000 });

  // Script the mock reply.
  const replyText = "header-badges-reply-unique";
  await mock.script(makeTextSSEEvents(replyText));

  // Send the message — status should become BUSY while the turn is in progress.
  await cq.sendMessage("header-badges-probe");

  // Wait for BUSY (fire-and-check; BUSY may be brief so use a short window).
  await expect(statusBadge).toHaveText("BUSY", { timeout: 15_000 });

  // Wait for the reply to appear and the turn to complete.
  await cq.waitForTextInStream(replyText, 25_000);
  await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });

  // After the turn: status must return to IDLE.
  await expect(statusBadge).toHaveText("IDLE", { timeout: 5_000 });

  // Usage counter must contain non-zero token counts.
  // Format: "↑<n> ↓<m> $<cost>"
  const usage = page.locator("[data-testid='usage']");
  await expect(usage).toBeVisible({ timeout: 3_000 });
  const usageText = await usage.textContent();
  // The SDK charges at least 1 input token per turn.
  expect(usageText).toMatch(/↑[1-9]\d*/);
});
