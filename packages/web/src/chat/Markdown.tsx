/**
 * Markdown.tsx — renders a markdown string using react-markdown + remark-gfm.
 *
 * Props:
 *   children — the markdown source string.
 *
 * Fenced code blocks (``` lang) are delegated to <CodeBlock lang code />.
 * Tables, footnotes, task lists, and blockquotes are handled by remark-gfm.
 * Text nodes containing file:line references (e.g. /etc/hosts:12) are split
 * by a rehype plugin and rendered as <file-ref> custom elements, which the
 * components map routes to <FileRefAnchor>.
 *
 * Static rendering only. Streaming / token-level reflow is PR-22b.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./Cards/CodeBlock";
import { FileRefAnchor } from "./FileRefAnchor";
import styles from "../styles/Markdown.module.css";
import type { Components } from "react-markdown";

export interface MarkdownProps {
  children: string;
  /** When non-empty, wrap matching substrings in <mark> elements (F4 search). */
  searchQuery?: string;
}

// ---------------------------------------------------------------------------
// File-ref rehype plugin (no external type imports needed — all inlined)
// ---------------------------------------------------------------------------

/**
 * Regex for file:line references. Reset lastIndex before each use (global flag).
 * Matches paths with a dotted extension: /etc/hosts.conf:12  src/index.ts:42  ./foo/bar.js:7:3
 * The leading `/` is optional, word chars, hyphens, dots, slashes, and `@` are all valid.
 * Plan spec: `(/?[\w\-./]+\.\w+):(\d+)(?::\d+)?`
 */
const FILE_REF_RE = /((?:\.{0,2}\/)?[\w\-./@]+\.\w+):(\d+)(?::\d+)?/g;

type HastNode = {
  type: string;
  value?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

/**
 * Split a hast text node value into a list of hast nodes, inserting custom
 * `<file-ref>` element nodes for each path:line match.
 */
function splitTextValue(value: string): HastNode[] {
  const result: HastNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  FILE_REF_RE.lastIndex = 0;

  while ((match = FILE_REF_RE.exec(value)) !== null) {
    const [full, path, lineStr] = match;
    const before = value.slice(lastIndex, match.index);
    if (before.length > 0) {
      result.push({ type: "text", value: before });
    }
    result.push({
      type: "element",
      tagName: "file-ref",
      properties: {
        // hast property names: "data-path" stays as-is; hast-util-to-jsx-runtime
        // passes data-* props to React components with hyphens preserved.
        "data-path": path ?? full,
        "data-line": lineStr ?? "1",
      },
      children: [{ type: "text", value: full }],
    });
    lastIndex = match.index + full.length;
  }

  const tail = value.slice(lastIndex);
  if (tail.length > 0) {
    result.push({ type: "text", value: tail });
  }
  return result;
}

/**
 * Rehype plugin: walk text nodes and replace those containing file:line
 * references with mixed Text + <file-ref> Element nodes.
 *
 * Typed as `() => (tree: unknown) => void` to avoid pulling in `unified`
 * or `hast` types (both are transitive, not direct deps of @cq/web).
 */
function rehypeFileRefs() {
  return function transform(tree: unknown): void {
    visitTextNodes(tree as HastNode);
  };
}


function visitTextNodes(node: HastNode): void {
  if (!node.children) return;

  let i = 0;
  while (i < node.children.length) {
    const child = node.children[i];
    if (child === undefined) { i++; continue; }

    if (
      child.type === "text" &&
      child.value !== undefined &&
      // Skip text inside code/pre blocks.
      node.tagName !== "code" &&
      node.tagName !== "pre"
    ) {
      FILE_REF_RE.lastIndex = 0;
      if (FILE_REF_RE.test(child.value)) {
        const replacements = splitTextValue(child.value);
        // Replace the current child with the split nodes.
        // We must update `node.children` with the new nodes.
        const arr = node.children as HastNode[];
        arr.splice(i, 1, ...replacements);
        i += replacements.length;
        continue;
      }
    }

    // Recurse into child elements.
    if (child.type === "element") {
      visitTextNodes(child);
    }

    i++;
  }
}

// ---------------------------------------------------------------------------
// Search highlight rehype plugin (F4)
// ---------------------------------------------------------------------------

/**
 * Build a rehype plugin that wraps case-insensitive occurrences of `query` in
 * text nodes with `<mark>` element nodes, skipping code/pre blocks.
 *
 * Same traversal structure as rehypeFileRefs: walk text nodes, split on
 * matches, splice in element nodes.
 */
function makeRehypeHighlight(query: string) {
  return function rehypeHighlight() {
    return function transform(tree: unknown): void {
      if (query.length === 0) return;
      visitTextNodesForHighlight(tree as HastNode, query.toLowerCase());
    };
  };
}

function visitTextNodesForHighlight(node: HastNode, lowerQuery: string): void {
  if (!node.children) return;

  let i = 0;
  while (i < node.children.length) {
    const child = node.children[i];
    if (child === undefined) { i++; continue; }

    if (
      child.type === "text" &&
      child.value !== undefined &&
      node.tagName !== "code" &&
      node.tagName !== "pre"
    ) {
      const value = child.value;
      if (value.toLowerCase().includes(lowerQuery)) {
        const replacements = splitTextForHighlight(value, lowerQuery);
        if (replacements.length > 1) {
          const arr = node.children as HastNode[];
          arr.splice(i, 1, ...replacements);
          i += replacements.length;
          continue;
        }
      }
    }

    if (child.type === "element") {
      visitTextNodesForHighlight(child, lowerQuery);
    }

    i++;
  }
}

/** Split a text value into text + mark element nodes. */
function splitTextForHighlight(value: string, lowerQuery: string): HastNode[] {
  const result: HastNode[] = [];
  const queryLen = lowerQuery.length;
  let pos = 0;
  const lowerValue = value.toLowerCase();

  let idx = lowerValue.indexOf(lowerQuery, pos);
  while (idx !== -1) {
    if (idx > pos) {
      result.push({ type: "text", value: value.slice(pos, idx) });
    }
    result.push({
      type: "element",
      tagName: "mark",
      properties: {},
      children: [{ type: "text", value: value.slice(idx, idx + queryLen) }],
    });
    pos = idx + queryLen;
    idx = lowerValue.indexOf(lowerQuery, pos);
  }
  if (pos < value.length) {
    result.push({ type: "text", value: value.slice(pos) });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Custom element renderers
// ---------------------------------------------------------------------------

/**
 * Custom renderer for <code> elements.
 *
 * react-markdown passes `className` as "language-<lang>" for fenced blocks,
 * and no className for inline code. We detect fenced blocks by the presence
 * of a className matching /^language-/.
 */
const codeRenderer: Components["code"] = ({ className, children, ...rest }) => {
  const match = /^language-(\S+)/.exec(className ?? "");
  if (match) {
    // Fenced code block: delegate to CodeBlock.
    const lang = match[1] ?? "";
    const code = String(children).replace(/\n$/, "");
    return <CodeBlock lang={lang} code={code} />;
  }
  // Inline code: render as plain <code>.
  return (
    <code className={className} {...rest}>
      {children}
    </code>
  );
};

/**
 * Renderer for <file-ref> custom elements injected by the rehype plugin.
 * hast-util-to-jsx-runtime passes data-* hast properties as `data-*` React props.
 */
const fileRefRenderer = (props: Record<string, unknown>): React.ReactElement => {
  const path = String(props["data-path"] ?? "");
  const line = parseInt(String(props["data-line"] ?? "1"), 10);
  return <FileRefAnchor path={path} line={line} />;
};

const COMPONENTS = {
  code: codeRenderer,
  // Custom element — lowercase required by react-markdown.
  "file-ref": fileRefRenderer,
} as unknown as Components;

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS_NO_HIGHLIGHT = [rehypeFileRefs];

export function Markdown({ children, searchQuery = "" }: MarkdownProps): React.ReactElement {
  // Build the rehype pipeline. When a searchQuery is active, append the
  // highlight plugin after fileRefs so it can mark matched text in all nodes.
  // useMemo avoids rebuilding the array on every render unless the query changes.
  const rehypePlugins = searchQuery.length > 0
    ? [rehypeFileRefs, makeRehypeHighlight(searchQuery)]
    : REHYPE_PLUGINS_NO_HIGHLIGHT;

  return (
    <div className={styles.root} data-testid="markdown-root">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={rehypePlugins}
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
