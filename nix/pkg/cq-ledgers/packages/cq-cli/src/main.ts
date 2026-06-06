#!/usr/bin/env -S bun run
/**
 * cq — the ledger-suite CLI.
 *
 * An argv dispatcher routing the FIRST positional argument to one of three
 * subcommands operating on a ledger root:
 *
 *   cq init  [--cwd <path>]            # initialise the canonical ledger set
 *   cq reset [--cwd <path>] [--yes|-y] # backup + reinit (destructive)
 *   cq erase [--cwd <path>] [--yes|-y] # remove the ledger tree (destructive)
 *
 * Ledger-root precedence (shared with ledger-mcp / ledger-web): each subcommand
 * resolves its root as `--cwd > $LEDGER_ROOT > process CWD`; a relative value
 * resolves against the CWD.
 *
 * This module lands the package skeleton: the dispatcher, the shared
 * confirmation helper (see ./confirm.ts), and STUB subcommand handlers that
 * throw "not implemented". T189/T190/T191 fill `init`/`reset`/`erase`.
 *
 * Unknown or absent subcommand → usage to stderr + exit 2.
 */

import * as path from "node:path";
import {
  type ConfirmIo,
  defaultConfirmIo,
} from "./confirm.js";

export { type ConfirmIo, type ConfirmOutcome, defaultConfirmIo, confirmDestructive } from "./confirm.js";

/** Exit code for an unknown/absent subcommand (usage error). */
export const EXIT_USAGE = 2;

/** The three subcommands the dispatcher routes to. */
export const SUBCOMMANDS = ["init", "reset", "erase"] as const;
export type Subcommand = (typeof SUBCOMMANDS)[number];

function isSubcommand(s: string): s is Subcommand {
  return (SUBCOMMANDS as readonly string[]).includes(s);
}

/** Flags common to all subcommands plus the destructive-op confirmation flag. */
export interface SubcommandArgs {
  /** Resolved ledger root (--cwd > $LEDGER_ROOT > CWD, absolute). */
  cwd: string;
  /** `--yes`/`-y`: skip the interactive confirmation (destructive subcommands). */
  yes: boolean;
}

export const USAGE = [
  "usage: cq <command> [options]",
  "",
  "commands:",
  "  init   [--cwd <path>]             initialise the canonical ledger set",
  "  reset  [--cwd <path>] [--yes|-y]  backup + reinitialise the ledgers (destructive)",
  "  erase  [--cwd <path>] [--yes|-y]  remove the ledger tree (destructive)",
  "",
  "ledger root: --cwd > $LEDGER_ROOT > current working directory",
].join("\n");

/**
 * Resolve the ledger root with the precedence shared across the suite:
 * `--cwd > $LEDGER_ROOT > process CWD`. A non-empty relative value resolves
 * against the CWD. (Mirrors ledger-mcp's parseArgs root logic.)
 */
export function resolveRoot(cwdArg: string | undefined): string {
  const fromArg = cwdArg !== undefined && cwdArg !== "" ? cwdArg : undefined;
  const fromEnv = process.env["LEDGER_ROOT"];
  const chosen = fromArg ?? (fromEnv !== undefined && fromEnv !== "" ? fromEnv : undefined);
  return chosen !== undefined ? path.resolve(chosen) : process.cwd();
}

/**
 * Parse a subcommand's own flags from the args *after* the subcommand token.
 * Recognises `--cwd <path>` / `--cwd=<path>` and `--yes`/`-y`; the resolved
 * root applies the suite-wide precedence. Unknown flags are ignored here (the
 * subcommand handlers, filled by T189/T190/T191, may tighten this).
 */
export function parseSubcommandArgs(argv: readonly string[]): SubcommandArgs {
  let cwd: string | undefined;
  let yes = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--yes" || a === "-y") {
      yes = true;
    } else if (a === "--cwd") {
      i += 1;
      const v = argv[i];
      if (v === undefined) {
        throw new Error("cq: --cwd requires a value");
      }
      cwd = v;
    } else if (a !== undefined && a.startsWith("--cwd=")) {
      cwd = a.slice("--cwd=".length);
    }
  }
  return { cwd: resolveRoot(cwd), yes };
}

/** Outcome of a dispatch: the process exit code main() should propagate. */
export interface DispatchOutcome {
  exitCode: number;
}

/** IO seam for the dispatcher so tests can capture usage output. */
export interface DispatchIo {
  err(line: string): void;
  /** Confirmation IO threaded to the destructive subcommand handlers. */
  confirm: ConfirmIo;
}

function defaultDispatchIo(): DispatchIo {
  return {
    err: (line) => process.stderr.write(`${line}\n`),
    confirm: defaultConfirmIo(),
  };
}

// --- STUB subcommand handlers (filled by T189/T190/T191) ---------------------

export function runInit(_args: SubcommandArgs, _io: DispatchIo): Promise<DispatchOutcome> {
  throw new Error("cq init: not implemented");
}

export function runReset(_args: SubcommandArgs, _io: DispatchIo): Promise<DispatchOutcome> {
  throw new Error("cq reset: not implemented");
}

export function runErase(_args: SubcommandArgs, _io: DispatchIo): Promise<DispatchOutcome> {
  throw new Error("cq erase: not implemented");
}

const HANDLERS: Record<Subcommand, (args: SubcommandArgs, io: DispatchIo) => Promise<DispatchOutcome>> = {
  init: runInit,
  reset: runReset,
  erase: runErase,
};

/**
 * Route `argv` (the args after the program name) to a subcommand. The FIRST
 * positional arg selects the subcommand; the rest are its flags. An unknown or
 * absent subcommand prints {@link USAGE} to stderr and resolves exit
 * {@link EXIT_USAGE} WITHOUT invoking a handler.
 */
export async function dispatch(
  argv: readonly string[],
  io: DispatchIo = defaultDispatchIo(),
): Promise<DispatchOutcome> {
  const first = argv[0];
  if (first === undefined || !isSubcommand(first)) {
    io.err(USAGE);
    return { exitCode: EXIT_USAGE };
  }
  const args = parseSubcommandArgs(argv.slice(1));
  return HANDLERS[first](args, io);
}

export async function main(argv: readonly string[]): Promise<void> {
  const { exitCode } = await dispatch(argv);
  process.exit(exitCode);
}

// Only run main() when executed directly (not when imported by the test
// suite). `import.meta.main` is bun-specific.
const meta = import.meta as unknown as { main?: boolean };
if (meta.main === true) {
  void main(process.argv.slice(2)).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`cq: fatal: ${msg}\n`);
    process.exit(1);
  });
}
