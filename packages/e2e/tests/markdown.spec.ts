/**
 * markdown.spec.ts — Tier 1: assistant returns a fenced code block, Shiki
 * highlights it, and the copy button works.
 *
 * Scenario:
 *   1. Open the page
 *   2. Script a response with a TypeScript fenced code block
 *   3. Send a message to trigger the response
 *   4. Wait for the code block to appear and be Shiki-highlighted
 *      (contains a <span> with a Shiki class inside a <pre>)
 *   5. Click the "Copy" button and verify the clipboard content
 */

import { test, expect } from "../fixtures/base.ts";
import { makeTextSSEEvents } from "../fixtures/adminMock.ts";

const TS_CODE = `const greet = (name: string): string => {
  return \`Hello, \${name}!\`;
};`;

const MARKDOWN_RESPONSE = `Here is a TypeScript example:

\`\`\`ts
${TS_CODE}
\`\`\`

That's the greeting function.`;

test("markdown: fenced code block is highlighted and copy button works", async ({
  cq,
  mock,
  page,
  context,
}) => {
  // Grant clipboard permissions (also set in playwright.config.ts, but be explicit).
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await cq.open();
  await expect(cq.textarea).toBeEnabled({ timeout: 10_000 });

  // Script the markdown response.
  await mock.script(makeTextSSEEvents(MARKDOWN_RESPONSE));

  await cq.sendMessage("show me typescript");

  // Wait for the code block container to appear.
  // The CodeBlock component normalises "ts" to "typescript" for the data-testid.
  const codeBlock = page.locator("[data-testid='code-block-typescript']");
  await codeBlock.waitFor({ state: "visible", timeout: 25_000 });

  // D49: textarea is always enabled now; signal "turn done" via Stop disabled.
  await expect(cq.stopButton).toBeDisabled({ timeout: 25_000 });

  // The Shiki-highlighted HTML should contain a <pre> element.
  const preEl = codeBlock.locator("pre");
  await expect(preEl).toBeVisible();

  // Shiki wraps tokens in <span> elements with style attributes.
  // Verify at least one <span> with a style attribute exists inside the pre.
  const styledSpan = codeBlock.locator("pre span[style]").first();
  await expect(styledSpan).toBeVisible({ timeout: 8_000 });

  // Click the copy button and verify the clipboard content.
  const copyBtn = codeBlock.locator("button[aria-label='Copy code to clipboard']");
  await expect(copyBtn).toBeVisible();
  await copyBtn.click();

  // Wait for the "Copied!" feedback.
  await expect(copyBtn).toContainText("Copied!");

  // Read the clipboard content via page.evaluate.
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText).toBe(TS_CODE);
});
