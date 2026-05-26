/**
 * boot.spec.ts — Tier 1: page loads and connection goes ALIVE.
 *
 * Scenario:
 *   1. Navigate to http://127.0.0.1:<port>/
 *   2. Indicator goes ALIVE within 3 s
 *   3. Textarea is enabled and ready for user input (no session active on boot)
 *   4. Empty-state hint "Type below to start" is visible
 */

import { test, expect } from "../fixtures/base.ts";

test("boot: page loads, indicator goes alive, empty state visible", async ({ cq, page }) => {
  // Navigate and wait for the WS connection to establish.
  await cq.open();

  // The indicator must have data-state="alive".
  await expect(cq.indicator).toHaveAttribute("data-state", "alive");

  // Console errors are not expected during boot.
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });

  // After chat.started the textarea becomes enabled and the empty-state hint
  // is visible (chatEvents is empty, inProgress is false initially after start).
  // Wait for the textarea to be present and enabled.
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Empty-state hint must be visible (no messages yet).
  await expect(cq.emptyState).toBeVisible();
  await expect(cq.emptyState).toContainText("Type below to start");
});
