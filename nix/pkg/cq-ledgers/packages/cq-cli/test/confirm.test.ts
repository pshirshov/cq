/**
 * Shared confirmation policy (Q109 + Q110) — the seam both `cq reset` and
 * `cq erase` reuse. Driven with an injected ConfirmIo so the policy is asserted
 * without a real TTY:
 *
 *   - injected non-TTY without --yes => REFUSE (exit 2), refusal message emitted.
 *   - --yes                          => proceed (no prompt consulted).
 *   - TTY answering 'y'              => proceed.
 *   - TTY answering 'n'              => abort (exit 1).
 */

import { describe, it, expect } from "bun:test";
import {
  confirmDestructive,
  EXIT_ABORTED,
  EXIT_REFUSED,
  type ConfirmIo,
} from "../src/confirm.js";

const QUESTION = "Proceed? [y/N] ";
const REFUSAL = "refusing without --yes";

/** A ConfirmIo recording output and answering the prompt with a fixed string. */
function recordingIo(
  isTty: boolean,
  answer = "",
): ConfirmIo & { outs: string[]; errs: string[]; prompts: string[] } {
  const outs: string[] = [];
  const errs: string[] = [];
  const prompts: string[] = [];
  return {
    isTty,
    outs,
    errs,
    prompts,
    out: (l) => outs.push(l),
    err: (l) => errs.push(l),
    prompt: async (q) => {
      prompts.push(q);
      return answer;
    },
  };
}

describe("confirmDestructive", () => {
  it("non-TTY without --yes refuses with exit 2 and never prompts", async () => {
    const io = recordingIo(false);
    const outcome = await confirmDestructive(false, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: false, exitCode: EXIT_REFUSED });
    expect(io.errs).toContain(REFUSAL);
    expect(io.prompts).toHaveLength(0);
  });

  it("--yes proceeds without consulting the prompt (even non-TTY)", async () => {
    const io = recordingIo(false, "n");
    const outcome = await confirmDestructive(true, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: true });
    expect(io.prompts).toHaveLength(0);
    expect(io.errs).toHaveLength(0);
  });

  it("TTY proceeds on a 'y' answer", async () => {
    const io = recordingIo(true, "y");
    const outcome = await confirmDestructive(false, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: true });
    expect(io.prompts).toEqual([QUESTION]);
  });

  it("TTY treats 'Y' (uppercase, padded) as yes", async () => {
    const io = recordingIo(true, "  Y  ");
    const outcome = await confirmDestructive(false, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: true });
  });

  it("TTY aborts on a non-'y' answer with exit 1", async () => {
    const io = recordingIo(true, "n");
    const outcome = await confirmDestructive(false, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: false, exitCode: EXIT_ABORTED });
  });

  it("TTY aborts on an empty answer (default No)", async () => {
    const io = recordingIo(true, "");
    const outcome = await confirmDestructive(false, QUESTION, REFUSAL, io);
    expect(outcome).toEqual({ proceed: false, exitCode: EXIT_ABORTED });
  });
});
