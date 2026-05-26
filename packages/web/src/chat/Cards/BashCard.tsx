/**
 * BashCard.tsx — renders a tool_use block for the Bash tool.
 *
 * Shows: command (in header), stdout, stderr, exit code, run_in_background flag.
 * The tool_result for Bash typically has content text of the form:
 *   <stdout>\n...\n</stdout>\n<stderr>\n...\n</stderr>
 * or plain text. We render whatever is available.
 */

import styles from "../../styles/Cards.module.css";

export interface BashInput {
  command?: string;
  timeout?: number;
  run_in_background?: boolean;
  [key: string]: unknown;
}

/** Parsed Bash tool_result fields. */
export interface BashResult {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

export interface BashCardProps {
  input: BashInput;
  /** Parsed result, if available. */
  result?: BashResult;
}

function renderSection(label: string, text: string | undefined): React.ReactElement | null {
  if (text === undefined || text === "") return null;
  return (
    <div className={styles.section}>
      <div className={styles.label}>{label}</div>
      <pre className={styles.pre}>{text}</pre>
    </div>
  );
}

export function BashCard({ input, result }: BashCardProps): React.ReactElement {
  const command = input.command ?? "(no command)";
  const isBackground = input.run_in_background === true;

  const exitCodeEl =
    result?.exitCode !== undefined ? (
      <span className={result.exitCode === 0 ? styles.exitOk : styles.exitFail}>
        exit {result.exitCode}
      </span>
    ) : null;

  return (
    <div className={styles.card} data-testid="bash-card">
      <div className={styles.header}>
        <span className={styles.toolName}>Bash</span>
        {isBackground && <span className={styles.badge}>background</span>}
        {exitCodeEl}
      </div>
      <div className={styles.body}>
        <div className={styles.section}>
          <div className={styles.label}>command</div>
          <pre className={styles.pre}>{command}</pre>
        </div>
        {renderSection("stdout", result?.stdout)}
        {renderSection("stderr", result?.stderr)}
      </div>
    </div>
  );
}
