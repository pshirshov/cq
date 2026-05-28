/**
 * codex-roundtrip.spec.ts — e2e-3: REAL Codex API roundtrip.
 *
 * Skips cleanly when neither codex-login state nor OPENAI_API_KEY is
 * available in the sandbox. When auth is present, runs a minimal turn
 * through @openai/codex-sdk and asserts:
 *   - the assistant bubble appears
 *   - the History tab shows the resulting row with platform=codex and
 *     effort populated
 *
 * Timeout: 60 s per the brief, since the SDK hits the real API.
 */

import { test, expect } from "../fixtures/base.ts";

/**
 * Auth detection for the e2e spec. Only `OPENAI_API_KEY` is checked because
 * the cq-server is spawned with the test runner's env (not necessarily the
 * caller's HOME), so probing `~/.codex/auth.json` from the test process
 * is not reliable signal that the server-side CodexBridge will authenticate.
 *
 * When OPENAI_API_KEY is not set, this spec skips cleanly so CI never
 * blocks on Codex API availability. To run locally with `codex login`
 * authentication, export `OPENAI_API_KEY` (or set `CQ_E2E_RUN_CODEX=1`
 * to bypass the gate when you have working login state).
 */
function hasCodexAuth(): boolean {
  if (process.env["OPENAI_API_KEY"] !== undefined && process.env["OPENAI_API_KEY"] !== "") {
    return true;
  }
  if (process.env["CQ_E2E_RUN_CODEX"] === "1") {
    return true;
  }
  return false;
}

test("codex-roundtrip: real Codex SDK answers 'say hello' and persists with platform=codex", async ({ cq, page }) => {
  test.skip(!hasCodexAuth(), "codex login state not present and OPENAI_API_KEY unset");
  test.setTimeout(60_000);

  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Switch the model to a Codex id (gpt-5.1) and set effort=low via the
  // popup so the History row has a non-default effort to assert against.
  await page.locator("[data-testid='settings-gear-btn']").click();
  await expect(page.locator("[data-testid='settings-popup']")).toBeVisible();
  await page.locator("[data-testid='model-select']").selectOption("gpt-5.1");
  await page.locator("[data-testid='effort-select']").selectOption("low");
  await page.keyboard.press("Escape");

  // Click "New session" so the next ChatStart uses the chosen model.
  await page.locator("[data-testid='new-session-btn']").click();

  // Wait for the new chat.started to land — the textarea re-enables.
  await expect(cq.textarea).toBeEnabled({ timeout: 30_000 });

  // Send a trivial prompt and wait for any assistant text.
  await cq.sendMessage("say hello");

  // We do not pin the assistant's exact wording — wait for any non-empty
  // assistant bubble.
  await page.waitForFunction(
    () => {
      const root = document.querySelector("[data-testid='stream-root']");
      if (root === null) return false;
      // At least one assistant bubble with non-trivial text.
      const bubbles = root.querySelectorAll("[data-testid^='stream-message-']");
      for (const b of bubbles) {
        const t = (b.textContent ?? "").trim();
        if (t.length > 0) return true;
      }
      return false;
    },
    { timeout: 50_000 },
  );

  // Wait for the textarea to be enabled again — the Codex turn has
  // emitted chat.done.
  await expect(cq.textarea).toBeEnabled({ timeout: 60_000 });

  // Switch to History and assert the new row has platform='codex' and
  // a non-empty Effort cell.
  await cq.goToHistory();
  const firstRow = page.locator("[data-testid^='history-row-']").first();
  await expect(firstRow).toBeVisible({ timeout: 5_000 });
  const rowTestId = await firstRow.getAttribute("data-testid");
  const invocationId = rowTestId!.replace("history-row-", "");

  const platformCell = page.locator(`[data-testid='platform-cell-${invocationId}']`);
  await expect(platformCell).toHaveText("codex", { timeout: 3_000 });

  const effortCell = page.locator(`[data-testid='effort-cell-${invocationId}']`);
  await expect(effortCell).toHaveText("low", { timeout: 3_000 });
});
