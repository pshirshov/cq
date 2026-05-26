/**
 * Thinking.tsx — renders an Anthropic "thinking" content block.
 *
 * Extended thinking blocks (`{type: 'thinking', thinking: string, signature?: string}`)
 * are collapsed by default to avoid cluttering the conversation. The disclosure
 * shows the token count (approximated as Math.ceil(length / 4) — a rough proxy
 * for the ~4 UTF-16 code units per token heuristic used by the Anthropic tokeniser
 * for English prose).
 *
 * Expanded view renders the raw thinking text as markdown via <Markdown>.
 */

import { Markdown } from "../Markdown";
import styles from "../../styles/Thinking.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThinkingBlock {
  type: "thinking";
  thinking: string;
  signature?: string;
}

export interface ThinkingProps {
  block: ThinkingBlock;
}

// ---------------------------------------------------------------------------
// Token count heuristic
// ---------------------------------------------------------------------------

/**
 * Approximate token count for a UTF-16 string.
 *
 * Heuristic: Math.ceil(length / 4).
 * English prose averages ~4 UTF-16 code units per BPE token.
 * This is a display proxy only — not a billing count.
 */
export function approximateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Thinking({ block }: ThinkingProps): React.ReactElement {
  const tokenCount = approximateTokenCount(block.thinking);

  return (
    <details className={styles.root} data-testid="thinking-disclosure">
      <summary className={styles.summary} data-testid="thinking-summary">
        Thinking ({tokenCount} tokens)
      </summary>
      <div className={styles.body} data-testid="thinking-body">
        <Markdown>{block.thinking}</Markdown>
      </div>
    </details>
  );
}
