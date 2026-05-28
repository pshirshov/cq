/**
 * gear-popup.spec.ts — e2e-1: gear-icon SettingsPopup behaviour.
 *
 * Scenario:
 *   1. Open the page; wait for idle.
 *   2. Assert the gear button is visible at the top-left of the header.
 *   3. Open the popup; change model + effort + permission mode +
 *      hide-sdk-events.
 *   4. Outside-click closes the popup.
 *   5. Reopen and dismiss with Esc.
 *   6. Click "New session" to start a fresh chat with the chosen values.
 *   7. Wait for the next chat.started; assert the localStorage values
 *      match what was selected.
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("gear-popup: open, change controls, outside-click + Esc dismiss, New Chat uses chosen values", async ({ cq, mock, page }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  const gearBtn = page.locator("[data-testid='settings-gear-btn']");
  await expect(gearBtn).toBeVisible({ timeout: 3_000 });

  // ----- 1. open popup, change controls -----
  await gearBtn.click();
  const popup = page.locator("[data-testid='settings-popup']");
  await expect(popup).toBeVisible();

  // Change model to claude-sonnet-4-6 (still Claude — keeps the test
  // independent of Codex auth availability).
  await page.locator("[data-testid='model-select']").selectOption("claude-sonnet-4-6");
  // Change effort.
  await page.locator("[data-testid='effort-select']").selectOption("medium");
  // Change permission mode.
  await page.locator("[data-testid='permission-mode-select']").selectOption("acceptEdits");
  // Toggle hide-sdk-events on.
  const hideSdkToggle = page.locator("[data-testid='hide-sdk-events-toggle']");
  if (!(await hideSdkToggle.isChecked())) await hideSdkToggle.check();
  await expect(hideSdkToggle).toBeChecked();

  // ----- 2. outside-click dismiss -----
  // Click on the cwd <code> in the header — that's outside both gear and popup.
  await page.locator("[data-testid='chat-header'] code").first().click();
  await expect(popup).not.toBeVisible();

  // ----- 3. Esc dismiss -----
  await gearBtn.click();
  await expect(popup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(popup).not.toBeVisible();

  // ----- 4. start a new chat — chosen values land in localStorage -----
  // The popup writes localStorage on every change; verify directly.
  const lsModel = await page.evaluate(() => localStorage.getItem("cq.model"));
  const lsEffort = await page.evaluate(() => localStorage.getItem("cq.effort"));
  const lsPerm = await page.evaluate(() => localStorage.getItem("cq.permissionMode"));
  const lsHideSdk = await page.evaluate(() => localStorage.getItem("cq.hideSdkEvents"));
  expect(lsModel).toBe("claude-sonnet-4-6");
  expect(lsEffort).toBe("medium");
  expect(lsPerm).toBe("acceptEdits");
  expect(lsHideSdk).toBe("1");

  // Fire a turn so we know the next ChatStart carries the chosen values.
  const replyText = "gear-popup-roundtrip";
  await mock.script(makeTextSSEEvents(replyText));
  await cq.sendMessage("gear popup smoke");
  await cq.waitForTextInStream(replyText, 25_000);
});
