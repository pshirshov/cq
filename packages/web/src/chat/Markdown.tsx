/**
 * Markdown.tsx — renders a markdown string using react-markdown + remark-gfm.
 *
 * Props:
 *   children — the markdown source string.
 *
 * Fenced code blocks (``` lang) are delegated to <CodeBlock lang code />.
 * Tables, footnotes, task lists, and blockquotes are handled by remark-gfm.
 *
 * Static rendering only. Streaming / token-level reflow is PR-22b.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./Cards/CodeBlock";
import styles from "../styles/Markdown.module.css";
import type { Components } from "react-markdown";

export interface MarkdownProps {
  children: string;
}

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

const COMPONENTS: Components = {
  code: codeRenderer,
};

const REMARK_PLUGINS = [remarkGfm];

export function Markdown({ children }: MarkdownProps): React.ReactElement {
  return (
    <div className={styles.root} data-testid="markdown-root">
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        components={COMPONENTS}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
