/**
 * Shared confirmation IO for the destructive `cq` subcommands (`reset`,
 * `erase`). Lifted from ledger-mcp's `--reset` path (ResetIo) and generalised
 * to `ConfirmIo` since BOTH subcommands reuse the SAME policy:
 *
 *   - `--yes`/`-y`        → proceed unattended (no prompt).
 *   - TTY, no `--yes`     → prompt; proceed only on a `y`/`Y` answer.
 *   - non-TTY, no `--yes` → REFUSE (exit 2) — never wipe a tree silently
 *     (Q109 + Q110).
 *
 * Injectable so subcommand tests drive the policy without a real TTY (and
 * without the prompt blocking the test process). Production wires `defaultConfirmIo`
 * to `process.std*` + `readline`.
 */

/** Exit code returned when a destructive op is refused in a non-interactive
 * (non-TTY) context without `--yes`. */
export const EXIT_REFUSED = 2;
/** Exit code returned when an interactive operator answers anything but `y`. */
export const EXIT_ABORTED = 1;

/**
 * Injectable IO for a destructive-operation confirmation, so the
 * operator-facing prompt + decision can be driven from a test without touching
 * the real TTY or blocking on stdin.
 */
export interface ConfirmIo {
  /** Whether stdin is an interactive terminal (gates the prompt). */
  isTty: boolean;
  /** Write an informational/summary line (stdout in production). */
  out(line: string): void;
  /** Write a warning/error line (stderr in production). */
  err(line: string): void;
  /**
   * Show `question`, read one line, resolve the trimmed answer. Only called on
   * a TTY without `--yes`. Production reads a single line via `readline`.
   */
  prompt(question: string): Promise<string>;
}

/** How {@link confirmDestructive} resolved: proceed, or one of the two refusals. */
export type ConfirmOutcome =
  | { proceed: true }
  | { proceed: false; exitCode: number };

export function defaultConfirmIo(): ConfirmIo {
  return {
    isTty: process.stdin.isTTY === true,
    out: (line) => process.stdout.write(`${line}\n`),
    err: (line) => process.stderr.write(`${line}\n`),
    prompt: async (question) => {
      const rl = (await import("node:readline")).createInterface({
        input: process.stdin,
        output: process.stderr,
      });
      try {
        return await new Promise<string>((resolve) => rl.question(question, resolve));
      } finally {
        rl.close();
      }
    },
  };
}

/**
 * Apply the shared confirmation policy for a destructive operation:
 *
 *   - `yes` true            → proceed (no prompt).
 *   - TTY, `yes` false      → prompt with `question`; proceed only on `y`/`Y`,
 *     otherwise abort (exit {@link EXIT_ABORTED}).
 *   - non-TTY, `yes` false  → REFUSE (exit {@link EXIT_REFUSED}); never act
 *     silently. `refusalMessage` is written to `err`.
 *
 * Pure decision logic + IO via the injected `io`; callers perform the actual
 * destructive effect only when `{ proceed: true }`.
 */
export async function confirmDestructive(
  yes: boolean,
  question: string,
  refusalMessage: string,
  io: ConfirmIo = defaultConfirmIo(),
): Promise<ConfirmOutcome> {
  if (yes) return { proceed: true };

  if (!io.isTty) {
    io.err(refusalMessage);
    return { proceed: false, exitCode: EXIT_REFUSED };
  }

  const answer = await io.prompt(question);
  if (answer.trim().toLowerCase() !== "y") {
    return { proceed: false, exitCode: EXIT_ABORTED };
  }
  return { proceed: true };
}
