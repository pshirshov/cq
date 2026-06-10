/**
 * ensureGitBackendGitignore — the SINGLE source of the git-backend `.gitignore`
 * block text (T357 / R418), shared by `createLedgerStore` (fresh git-object
 * startup / `cq init`) and T354's `cq move-ledger`.
 *
 * The git-object backend stores the ledger on an ORPHAN ref and NEVER touches
 * the working tree, so the on-disk `docs/*.md` + `docs/ledgers.yaml` (written by
 * the FS mirror / a prior fs-backed ledger / init) must be gitignored on the
 * working branch — otherwise a fresh git-object ledger would be accidentally
 * tracked. This helper appends a MARKER-DELIMITED block to `<root>/.gitignore`
 * idempotently: if the marker is already present the file is left untouched, so
 * repeated startups / `cq init` runs / `cq move-ledger` invocations never
 * duplicate it.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";

/** Marker comment guarding the git-backend block (idempotency anchor). */
export const GIT_BACKEND_GITIGNORE_MARKER = "# cq git-object ledger backend (managed) — do not edit";

/**
 * The full block appended to `.gitignore` for the git-object backend. The ledger
 * lives on the orphan ref, so its on-disk projection under `docs/` stays
 * untracked on the working branch. The lockfiles under `docs/.locks` are already
 * runtime-only and must never be committed either.
 */
export const GIT_BACKEND_GITIGNORE_BLOCK = [
  GIT_BACKEND_GITIGNORE_MARKER,
  "docs/*.md",
  "docs/ledgers.yaml",
  "docs/.locks/",
].join("\n");

/**
 * Idempotently ensure `<root>/.gitignore` contains the git-backend block.
 *
 * - Absent `.gitignore` → created with the block.
 * - Present without the marker → the block is appended (preserving existing
 *   content), separated by a blank line.
 * - Present WITH the marker → left untouched (no duplicate).
 *
 * Returns `true` when the block was written/added, `false` when it was already
 * present.
 */
export async function ensureGitBackendGitignore(root: string): Promise<boolean> {
  const gitignorePath = path.join(root, ".gitignore");
  let existing: string | null = null;
  try {
    existing = await fs.readFile(gitignorePath, "utf8");
  } catch {
    existing = null;
  }

  if (existing !== null && existing.includes(GIT_BACKEND_GITIGNORE_MARKER)) {
    return false; // already present — idempotent no-op
  }

  if (existing === null || existing.length === 0) {
    await fs.writeFile(gitignorePath, `${GIT_BACKEND_GITIGNORE_BLOCK}\n`, "utf8");
    return true;
  }

  // Append, ensuring exactly one blank line separates prior content from the block.
  const sep = existing.endsWith("\n") ? "\n" : "\n\n";
  await fs.writeFile(gitignorePath, `${existing}${sep}${GIT_BACKEND_GITIGNORE_BLOCK}\n`, "utf8");
  return true;
}
