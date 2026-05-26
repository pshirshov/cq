/**
 * base.ts — Extended Playwright test fixture providing `cq` and `mock`.
 *
 * Every test file that needs the page-object or mock client should import
 * `test` and `expect` from this module instead of @playwright/test directly.
 *
 *   import { test, expect } from '../fixtures/base';
 */

import { test as base, expect } from "@playwright/test";
import { CqPage } from "./cqPage.ts";
import { MockServerClient } from "./adminMock.ts";

export { expect };

type E2EFixtures = {
  cq: CqPage;
  mock: MockServerClient;
};

export const test = base.extend<E2EFixtures>({
  cq: async ({ page }, use) => {
    const cq = new CqPage(page);
    await use(cq);
    // After each test: force-interrupt the active bridge session via the CQ
    // server's admin endpoint. This is more reliable than UI interaction
    // because it bypasses the SDK subprocess timing and directly clears
    // bridge.active, ensuring the next test starts with a clean state.
    try {
      const cqUrl = process.env["CQ_BASE_URL"] ?? "http://127.0.0.1:5173";
      const res = await fetch(`${cqUrl}/__e2e/interrupt`, {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // Non-fatal — try the UI fallback below.
        throw new Error(`/__e2e/interrupt returned ${res.status}`);
      }
    } catch {
      // Fallback: UI-based teardown (click Stop if visible, wait for idle).
      try {
        const stopBtn = page.locator("button[aria-label='Stop generation']");
        const visible = await stopBtn.isVisible({ timeout: 1_000 }).catch(() => false);
        if (visible) {
          await stopBtn.click();
        }
        await page.waitForFunction(
          () => !(document.querySelector("textarea[aria-label='Chat input']") as HTMLTextAreaElement | null)?.disabled,
          { timeout: 10_000 },
        );
      } catch {
        /* ignore teardown errors */
      }
    }
  },

  // eslint-disable-next-line no-empty-pattern
  mock: async ({}, use) => {
    const adminUrl = process.env["MOCK_ADMIN_URL"];
    if (!adminUrl) throw new Error("MOCK_ADMIN_URL not set — did globalSetup run?");
    const client = new MockServerClient(adminUrl);
    // Reset the mock state before each test.
    await client.reset();
    await use(client);
  },
});
