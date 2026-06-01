/**
 * Terminal markdown renderer tests (isolated, reliable). Asserts that markup
 * is stripped from the visible text and block structure is preserved. ANSI
 * styling (bold/italic/colour) is not asserted — only the rendered glyphs.
 */

import { describe, it, expect } from "bun:test";
import { createElement } from "react";
import { render } from "ink-testing-library";
import { Markdown } from "../src/markdownText.js";

const tick = (ms = 30): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function frameOf(text: string): Promise<string> {
  const r = render(createElement(Markdown, { text }));
  await tick();
  const f = r.lastFrame() ?? "";
  r.unmount();
  return f;
}

describe("Markdown (terminal renderer)", () => {
  it("strips inline markers, keeps the text", async () => {
    const f = await frameOf("fix *the* parser and **ship** it now");
    expect(f).toContain("fix the parser and ship it now");
    expect(f).not.toContain("**");
    expect(f).not.toContain("*the*");
  });

  it("renders inline code without backticks", async () => {
    const f = await frameOf("see `code` here");
    expect(f).toContain("see code here");
    expect(f).not.toContain("`");
  });

  it("renders a link's label without the URL syntax", async () => {
    const f = await frameOf("read the [docs](https://x.test/p)");
    expect(f).toContain("read the docs");
    expect(f).not.toContain("](");
    expect(f).not.toContain("https://x.test");
  });

  it("renders a heading + bullet list + paragraph as separate lines", async () => {
    const f = await frameOf("## Title\n\n- one\n- two\n\ntail");
    expect(f).toContain("Title");
    expect(f).toContain("• one");
    expect(f).toContain("• two");
    expect(f).toContain("tail");
    expect(f).not.toContain("## Title");
    expect(f).not.toContain("- one");
  });

  it("renders a fenced code block verbatim", async () => {
    const f = await frameOf("```\nconst x = 1;\n```");
    expect(f).toContain("const x = 1;");
    expect(f).not.toContain("```");
  });
});
