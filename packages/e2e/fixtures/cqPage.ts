/**
 * cqPage.ts — Page-object wrapper for the cq UI.
 *
 * Exposes high-level actions (open, sendMessage, waitForResponse, etc.)
 * so individual test files don't repeat raw Playwright locator calls.
 *
 * Usage via test.extend():
 *   import { test, expect } from './base';
 *   test('example', async ({ cq }) => {
 *     await cq.open();
 *     await cq.sendMessage('hello');
 *     await cq.waitForResponse();
 *   });
 */

import type { Page, Locator } from "@playwright/test";

// ---------------------------------------------------------------------------
// CqPage
// ---------------------------------------------------------------------------

export class CqPage {
  readonly page: Page;

  // Stable locators via data-testid.
  readonly indicator: Locator;
  readonly streamRoot: Locator;
  readonly emptyState: Locator;
  readonly textarea: Locator;
  readonly stopButton: Locator;
  readonly jumpToLatestBtn: Locator;
  readonly searchBar: Locator;
  readonly searchInput: Locator;
  readonly searchCounter: Locator;

  constructor(page: Page) {
    this.page = page;
    this.indicator = page.locator("[id='ws-indicator']");
    this.streamRoot = page.locator("[data-testid='stream-root']");
    this.emptyState = page.locator("[data-testid='stream-empty-state']");
    this.textarea = page.locator("textarea[aria-label='Chat input']");
    this.stopButton = page.locator("button[aria-label='Stop generation']");
    this.jumpToLatestBtn = page.locator("[data-testid='jump-to-latest-btn']");
    this.searchBar = page.locator("[data-testid='search-bar']");
    this.searchInput = page.locator("[data-testid='search-input']");
    this.searchCounter = page.locator("[data-testid='search-counter']");
  }

  /** Navigate to the app root and wait for the connection indicator to go alive. */
  async open(): Promise<void> {
    await this.page.goto("/");
    await this.waitForAlive();
  }

  /**
   * Wait until the WS indicator reports state=alive.
   * The auto-start sequence fires chat.start right after going alive; we wait
   * a bit extra for the initial chat.started round-trip.
   */
  async waitForAlive(timeoutMs = 10_000): Promise<void> {
    await this.indicator.waitFor({ state: "visible", timeout: timeoutMs });
    await this.page.waitForFunction(
      () => document.querySelector("[id='ws-indicator']")?.getAttribute("data-state") === "alive",
      { timeout: timeoutMs },
    );
  }

  /**
   * Type text into the chat textarea and submit with Enter.
   * Waits for the textarea to be enabled (session idle) before filling.
   * Does NOT wait for the response — call waitForResponse() separately.
   */
  async sendMessage(text: string, timeoutMs = 10_000): Promise<void> {
    // Wait for the textarea to be enabled, meaning a session is ready for input.
    await this.page.waitForFunction(
      () => {
        const ta = document.querySelector("textarea[aria-label='Chat input']") as HTMLTextAreaElement | null;
        return ta !== null && !ta.disabled;
      },
      { timeout: timeoutMs },
    );
    await this.textarea.click();
    await this.textarea.fill(text);
    await this.page.keyboard.press("Enter");
  }

  /**
   * Wait until the textarea is enabled again (indicates the response is complete
   * and the session is idle). Timeout defaults to 15 s.
   */
  async waitForIdle(timeoutMs = 15_000): Promise<void> {
    await this.page.waitForFunction(
      () => !(document.querySelector("textarea[aria-label='Chat input']") as HTMLTextAreaElement | null)?.disabled,
      { timeout: timeoutMs },
    );
  }

  /**
   * Wait for the "thinking" indicator to appear (i.e. a response is in progress).
   */
  async waitForThinking(timeoutMs = 5_000): Promise<void> {
    await this.page.locator("[data-testid='stream-thinking']").waitFor({
      state: "visible",
      timeout: timeoutMs,
    });
  }

  /**
   * Return the text content of the last visible assistant message bubble.
   */
  async lastAssistantText(): Promise<string> {
    // Wait for at least one message to appear.
    await this.page.locator("[data-testid^='stream-message-']").first().waitFor({ timeout: 10_000 });
    const bubbles = this.page.locator("[data-testid^='stream-message-']");
    const count = await bubbles.count();
    if (count === 0) return "";
    return (await bubbles.nth(count - 1).textContent()) ?? "";
  }

  /**
   * Wait until the stream contains text matching the given substring.
   */
  async waitForTextInStream(substring: string, timeoutMs = 10_000): Promise<void> {
    await this.page.waitForFunction(
      (sub) => {
        const root = document.querySelector("[data-testid='stream-root']");
        return root?.textContent?.includes(sub) ?? false;
      },
      substring,
      { timeout: timeoutMs },
    );
  }

  /**
   * Open search via Ctrl+F and wait for the search bar to appear.
   */
  async openSearch(): Promise<void> {
    await this.page.keyboard.press("Control+f");
    await this.searchBar.waitFor({ state: "visible", timeout: 3_000 });
  }

  /**
   * Type text into the search input.
   */
  async typeInSearch(text: string): Promise<void> {
    await this.searchInput.fill(text);
  }

  /**
   * Navigate to the History tab.
   */
  async goToHistory(): Promise<void> {
    await this.page.getByRole("tab", { name: "History" }).click();
  }

  /**
   * Navigate to the Chat tab.
   */
  async goToChat(): Promise<void> {
    await this.page.getByRole("tab", { name: "Chat" }).click();
  }

  /**
   * Scroll the stream to the top (simulate user scrolling up).
   */
  async scrollStreamToTop(): Promise<void> {
    await this.streamRoot.evaluate((el) => { el.scrollTop = 0; });
  }
}
