/**
 * search.spec.ts — Tier 2: search bar opens, finds matches, and navigates.
 *
 * Scenario:
 *   1. Open the page
 *   2. Send two messages, each getting a reply containing "unique-marker"
 *   3. Open search via Ctrl+F
 *   4. Type "unique-marker" — counter shows "1 / 2" or "2 / 2"
 *   5. Press the next-match button — active match advances
 *   6. Press Esc — search bar closes
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

const MARKER = "unique-marker-xyz";

test("search: Ctrl+F opens search, finds matches, navigation works", async ({ cq, mock }) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Send two messages whose replies contain the marker.
  for (let i = 0; i < 2; i++) {
    await mock.script(makeTextSSEEvents(`Response ${i + 1}: contains ${MARKER} here.`));
    await cq.sendMessage(`query ${i + 1}`);
    await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });
  }

  // Open search.
  await cq.openSearch();
  await expect(cq.searchBar).toBeVisible();

  // Type the marker.
  await cq.typeInSearch(MARKER);

  // Wait for the counter to appear showing 2 matches.
  await expect(cq.searchCounter).toBeVisible({ timeout: 5_000 });
  const counterText = await cq.searchCounter.textContent();
  // Counter format: "1 / 2" (current / total)
  expect(counterText).toMatch(/1 \/ 2/);

  // Navigate to the next match.
  const nextBtn = cq.page.locator("[data-testid='search-next']");
  await nextBtn.click();

  // Counter should now show "2 / 2".
  await expect(cq.searchCounter).toContainText("2 / 2");

  // Close search via Esc.
  await cq.page.keyboard.press("Escape");
  await expect(cq.searchBar).not.toBeVisible({ timeout: 3_000 });
});
