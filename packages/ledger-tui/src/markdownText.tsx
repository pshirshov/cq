/**
 * Minimal markdown → Ink renderer for the terminal.
 *
 * Terminal markdown is necessarily approximate: this covers the common
 * constructs — ATX headings, bullet/ordered lists, blockquotes, fenced code
 * blocks, and inline **bold** / *italic* / `code` / [links](url) — mapping
 * them to styled Ink <Text>. It is intentionally dependency-free (no remark in
 * the TUI closure) and lenient; unknown syntax falls through as plain text.
 */

import React from "react";
import { Box, Text } from "ink";

const INLINE_RE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\n]+\*)|(\b_[^_\n]+_\b)|(\[[^\]]+\]\([^)]+\))/;

/**
 * Render inline markdown spans within a line. Plain runs are emitted as raw
 * strings (not wrapped <Text>) so Ink concatenates them with adjacent styled
 * spans reliably — wrapping every run in its own <Text> caused a trailing span
 * to be dropped inside nested flex layout.
 */
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  while (rest.length > 0) {
    const m = INLINE_RE.exec(rest);
    if (m === null || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) {
      out.push(
        <Text key={`${keyBase}-${k++}`} color="cyan">
          {tok.slice(1, -1)}
        </Text>,
      );
    } else if (tok.startsWith("**")) {
      out.push(
        <Text key={`${keyBase}-${k++}`} bold>
          {tok.slice(2, -2)}
        </Text>,
      );
    } else if (tok.startsWith("*") || tok.startsWith("_")) {
      out.push(
        <Text key={`${keyBase}-${k++}`} italic>
          {tok.slice(1, -1)}
        </Text>,
      );
    } else {
      const lbl = /\[([^\]]+)\]/.exec(tok)?.[1] ?? tok;
      out.push(
        <Text key={`${keyBase}-${k++}`} underline color="blue">
          {lbl}
        </Text>,
      );
    }
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

type Block =
  | { t: "heading"; level: number; text: string }
  | { t: "para"; text: string }
  | { t: "ul"; text: string }
  | { t: "ol"; n: string; text: string }
  | { t: "quote"; text: string }
  | { t: "code"; lines: string[] }
  | { t: "blank" };

function parseBlocks(src: string): Block[] {
  const lines = src.split("\n");
  const blocks: Block[] = [];
  let i = 0;
  let para: string[] = [];
  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ t: "para", text: para.join(" ") });
      para = [];
    }
  };
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const fence = /^```/.test(line);
    if (fence) {
      flushPara();
      const code: string[] = [];
      i += 1;
      while (i < lines.length && !/^```/.test(lines[i] ?? "")) {
        code.push(lines[i] ?? "");
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ t: "code", lines: code });
      continue;
    }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara();
      blocks.push({ t: "heading", level: h[1]!.length, text: h[2]! });
      i += 1;
      continue;
    }
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      blocks.push({ t: "ul", text: ul[1]! });
      i += 1;
      continue;
    }
    const ol = /^\s*(\d+)\.\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      blocks.push({ t: "ol", n: ol[1]!, text: ol[2]! });
      i += 1;
      continue;
    }
    const q = /^>\s?(.*)$/.exec(line);
    if (q) {
      flushPara();
      blocks.push({ t: "quote", text: q[1]! });
      i += 1;
      continue;
    }
    if (line.trim() === "") {
      flushPara();
      blocks.push({ t: "blank" });
      i += 1;
      continue;
    }
    para.push(line.trim());
    i += 1;
  }
  flushPara();
  return blocks;
}

export function Markdown({ text }: { text: string }): React.ReactElement {
  const blocks = parseBlocks(text);
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) => {
        const key = `b${i}`;
        switch (b.t) {
          case "heading":
            return (
              <Text key={key} bold color={b.level <= 2 ? "green" : "white"}>
                {renderInline(b.text, key)}
              </Text>
            );
          case "para":
            return <Text key={key}>{renderInline(b.text, key)}</Text>;
          case "ul":
            return (
              <Text key={key}>
                {"  • "}
                {renderInline(b.text, key)}
              </Text>
            );
          case "ol":
            return (
              <Text key={key}>
                {`  ${b.n}. `}
                {renderInline(b.text, key)}
              </Text>
            );
          case "quote":
            return (
              <Text key={key} dimColor>
                {"│ "}
                {renderInline(b.text, key)}
              </Text>
            );
          case "code":
            return (
              <Box key={key} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
                {b.lines.map((cl, j) => (
                  <Text key={`${key}-${j}`} color="cyan">
                    {cl.length > 0 ? cl : " "}
                  </Text>
                ))}
              </Box>
            );
          case "blank":
            return <Text key={key}> </Text>;
        }
      })}
    </Box>
  );
}
