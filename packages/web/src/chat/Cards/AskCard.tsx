/**
 * AskCard.tsx — AskUserQuestion tool_use card.
 *
 * Renders the AskUserQuestion input (per sdk-tools.d.ts:608):
 *   - 1–4 questions, each with a `question` text, `header` chip, and 2–4 `options`.
 *   - Each option has a `label`, `description`, and optional `preview`.
 *   - `multiSelect: true` → checkboxes; otherwise → radio buttons.
 *
 * On submit, calls `onReply` with a `ChatQuestionReply`-compatible payload:
 *   { toolUseId, answers: { "<questionIndex>": [<selectedLabel>, ...] } }
 *
 * CONSTRAINT (PR-31-D01): Candidate A answer injection (synthetic tool_result
 * SDKUserMessage) is untested against the real bundled CLI. If real-SDK testing
 * in PR-51 disconfirms, fall back to Options.disallowedTools:['AskUserQuestion'].
 */

import { useState } from "react";
import styles from "../../styles/AskCard.module.css";

// ---------------------------------------------------------------------------
// SDK types (structural, per sdk-tools.d.ts:608)
// ---------------------------------------------------------------------------

export interface AskOption {
  label: string;
  description: string;
  preview?: string;
}

export interface AskQuestion {
  question: string;
  header: string;
  options: [AskOption, AskOption, ...AskOption[]];
  multiSelect: boolean;
}

export interface AskUserQuestionInput {
  questions: [AskQuestion, ...AskQuestion[]];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuestionReplyPayload {
  toolUseId: string;
  /** Map of question index (as string) → selected labels. */
  answers: Record<string, unknown>;
}

export interface AskCardProps {
  toolUseId: string;
  input: AskUserQuestionInput;
  onReply: (payload: QuestionReplyPayload) => void;
}

// ---------------------------------------------------------------------------
// AskCard component
// ---------------------------------------------------------------------------

export function AskCard({ toolUseId, input, onReply }: AskCardProps): React.ReactElement {
  // State: for each question, track selected labels.
  // For radio (multiSelect=false): one label string or "" if nothing selected.
  // For checkbox (multiSelect=true): array of selected labels.
  const [selections, setSelections] = useState<Record<number, string[]>>(() => {
    const init: Record<number, string[]> = {};
    input.questions.forEach((_, idx) => {
      init[idx] = [];
    });
    return init;
  });

  function toggleRadio(qIdx: number, label: string): void {
    setSelections((prev) => ({ ...prev, [qIdx]: [label] }));
  }

  function toggleCheckbox(qIdx: number, label: string, checked: boolean): void {
    setSelections((prev) => {
      const current = prev[qIdx] ?? [];
      const next = checked
        ? [...current, label]
        : current.filter((l) => l !== label);
      return { ...prev, [qIdx]: next };
    });
  }

  function isComplete(): boolean {
    return input.questions.every((_, idx) => (selections[idx]?.length ?? 0) > 0);
  }

  function handleSubmit(): void {
    if (!isComplete()) return;
    const answers: Record<string, unknown> = {};
    input.questions.forEach((_, idx) => {
      answers[String(idx)] = selections[idx] ?? [];
    });
    onReply({ toolUseId, answers });
  }

  return (
    <div className={styles.root} data-testid="ask-card">
      <div className={styles.header}>
        <span className={styles.icon}>❓</span>
        <span className={styles.title}>Claude has a question</span>
      </div>
      <div className={styles.body}>
        {input.questions.map((q, qIdx) => (
          <div key={qIdx} className={styles.question} data-testid={`ask-question-${qIdx}`}>
            <div className={styles.questionHeader}>{q.header}</div>
            <div className={styles.questionText}>{q.question}</div>
            <div className={styles.options} role={q.multiSelect ? "group" : "radiogroup"}>
              {q.options.map((opt, oIdx) => {
                const isSelected = (selections[qIdx] ?? []).includes(opt.label);
                const inputType = q.multiSelect ? "checkbox" : "radio";
                const name = `ask-q${qIdx}`;
                const id = `ask-q${qIdx}-o${oIdx}`;
                return (
                  <label
                    key={oIdx}
                    htmlFor={id}
                    className={styles.option}
                    data-testid={`ask-option-${qIdx}-${oIdx}`}
                  >
                    <div className={styles.optionInput}>
                      <input
                        id={id}
                        type={inputType}
                        name={name}
                        value={opt.label}
                        checked={isSelected}
                        data-testid={`ask-input-${qIdx}-${oIdx}`}
                        onChange={(e) => {
                          if (q.multiSelect) {
                            toggleCheckbox(qIdx, opt.label, e.target.checked);
                          } else {
                            toggleRadio(qIdx, opt.label);
                          }
                        }}
                      />
                      <span className={styles.optionLabel}>{opt.label}</span>
                    </div>
                    {opt.description !== "" && (
                      <div className={styles.optionDescription}>{opt.description}</div>
                    )}
                    {opt.preview !== undefined && isSelected && (
                      <pre className={styles.optionPreview}>{opt.preview}</pre>
                    )}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className={styles.actions}>
        <button
          className={`${styles.btn} ${styles.btnSubmit}`}
          onClick={handleSubmit}
          disabled={!isComplete()}
          data-testid="ask-submit"
        >
          Submit
        </button>
      </div>
    </div>
  );
}
