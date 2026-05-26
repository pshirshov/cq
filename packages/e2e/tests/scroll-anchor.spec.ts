/**
 * scroll-anchor.spec.ts — Tier 2: scroll-up shows "Jump to latest", clicking
 * it scrolls back and resumes auto-scroll.
 *
 * Scenario:
 *   1. Open the page
 *   2. Send 5 messages (scripted) to populate the stream
 *   3. Manually scroll the stream to the top
 *   4. Verify the "Jump to latest" button appears
 *   5. Click "Jump to latest" → button disappears, stream scrolled to bottom
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

test("scroll-anchor: jump-to-latest appears on scroll-up and scrolls back", async ({
  cq,
  mock,
}) => {
  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Send several messages so the stream is long enough to scroll.
  const messageCount = 5;
  for (let i = 0; i < messageCount; i++) {
    await mock.script(makeTextSSEEvents(`Reply number ${i + 1}: lorem ipsum dolor sit amet.`));
    await cq.sendMessage(`Message ${i + 1}`);
    // Wait for the response before sending the next.
    await expect(cq.textarea).toBeEnabled({ timeout: 25_000 });
  }

  // Verify the stream has content.
  await expect(cq.streamRoot).not.toBeEmpty();

  // Scroll the stream to the top to trigger the scroll-up detection.
  await cq.scrollStreamToTop();

  // The "Jump to latest" button should appear.
  await expect(cq.jumpToLatestBtn).toBeVisible({ timeout: 5_000 });

  // Click it.
  await cq.jumpToLatestBtn.click();

  // The button should disappear (auto-scroll resumed).
  await expect(cq.jumpToLatestBtn).not.toBeVisible({ timeout: 5_000 });
});
