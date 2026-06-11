/**
 * T354: `cq move-ledger --to git|local` — lossless bidirectional migration of
 * the live ledger between the docs/ working tree and the orphan ref.
 *
 * Acceptance (R418): in a throwaway git repo, seed docs/ ledgers, then
 *   - `cq move-ledger --to git`  → the orphan ref carries identical ledger bytes,
 *     docs ledger files UNTRACKED (`git ls-files docs/` empty) but STILL PRESENT
 *     on disk (left-in-place), cq.toml backend=git-object;
 *   - `cq move-ledger --to local` → restores TRACKED docs/*.md byte-identical to
 *     the orphan-ref content + backend=fs;
 *   - the round trip is provably LOSSLESS including on-disk file state (docs/*.md
 *     bytes before --to git EQUAL the bytes after --to local) AND tracked-state
 *     (tracked → untracked → tracked);
 *   - refuses a non-empty target without --force; refuses without --to.
 *
 * Throwaway repos via mkdtemp; cleaned up in afterAll.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, readFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { dispatch, type ConfirmIo, type DispatchIo } from "../src/main.js";

const exec = promisify(execFile);
const dirs: string[] = [];

afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => undefined);
});

const silentConfirm: ConfirmIo = {
  isTty: false,
  out: () => {},
  err: () => {},
  prompt: async () => "",
};

function recordingIo(): DispatchIo & { outs: string[]; errs: string[] } {
  const outs: string[] = [];
  const errs: string[] = [];
  return { outs, errs, out: (l) => outs.push(l), err: (l) => errs.push(l), confirm: silentConfirm };
}

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await exec("git", args, { cwd, encoding: "utf8" });
  return r.stdout;
}

async function gitRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "cq-move-"));
  dirs.push(dir);
  await git(dir, "init", "-q");
  await git(dir, "config", "user.email", "t@example.com");
  await git(dir, "config", "user.name", "t");
  await git(dir, "config", "commit.gpgsign", "false");
  await writeFile(path.join(dir, "README.md"), "# repo\n");
  await git(dir, "add", "README.md");
  await git(dir, "commit", "-q", "-m", "init");
  return dir;
}

/** Seed docs/ with a non-trivial ledger via `cq init` (fs backend), then tracked. */
async function seedDocs(root: string): Promise<Record<string, string>> {
  const docs = path.join(root, "docs");
  await mkdir(path.join(docs, "archive", "tasks"), { recursive: true });
  const files: Record<string, string> = {
    "docs/ledgers.yaml": "version: 1\nledgers:\n  - tasks\n",
    "docs/tasks.md": "# tasks\n\n- [T1] seed task — non-empty body\n",
    "docs/defects.md": "# defects\n\n- [D1] a seeded defect\n",
    "docs/archive/tasks/M1.md": "# archived milestone M1\n\narchived content\n",
  };
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(path.join(root, rel), content, "utf8");
  }
  // Track them on the working branch (the pre-migration tracked state).
  await git(root, "add", "docs");
  await git(root, "commit", "-q", "-m", "seed docs ledger");
  return files;
}

describe("cq move-ledger", () => {
  it("refuses without --to", async () => {
    const root = await gitRepo();
    await seedDocs(root);
    const io = recordingIo();
    const outcome = await dispatch(["move-ledger", "--cwd", root], io);
    expect(outcome.exitCode).toBe(2);
    expect(io.errs.join("\n")).toMatch(/--to <git\|local> is required/);
  });

  it("rejects an invalid --to value", async () => {
    const root = await gitRepo();
    await expect(dispatch(["move-ledger", "--cwd", root, "--to", "bogus"], recordingIo())).rejects.toThrow(
      /--to must be "git" or "local"/,
    );
  });

  it("round-trips docs/ ↔ orphan ref losslessly (bytes + tracked-state)", async () => {
    const root = await gitRepo();
    const seeded = await seedDocs(root);

    // Capture the pre-migration on-disk bytes.
    const before: Record<string, string> = {};
    for (const rel of Object.keys(seeded)) {
      before[rel] = await readFile(path.join(root, rel), "utf8");
    }
    // `before` IS the seeded content (anchor for the before===after claim below).
    expect(before).toEqual(seeded);
    // Pre-migration: all docs files are TRACKED.
    const trackedBefore = (await git(root, "ls-files", "docs/")).trim().split("\n").sort();
    expect(trackedBefore).toEqual([
      "docs/archive/tasks/M1.md",
      "docs/defects.md",
      "docs/ledgers.yaml",
      "docs/tasks.md",
    ]);

    // --- --to git ---
    const io1 = recordingIo();
    const out1 = await dispatch(["move-ledger", "--cwd", root, "--to", "git"], io1);
    expect(out1.exitCode).toBe(0);

    // The orphan ref carries identical ledger bytes (docs-relative tree paths).
    for (const [rel, content] of Object.entries(seeded)) {
      const treePath = rel.slice("docs/".length);
      const refBytes = await git(root, "cat-file", "-p", `cq-ledger:${treePath}`);
      expect(refBytes).toBe(content);
    }

    // docs ledger files UNTRACKED on the working branch.
    const trackedAfterGit = (await git(root, "ls-files", "docs/")).trim();
    expect(trackedAfterGit).toBe("");

    // ... but STILL PRESENT on disk (left in place, R418), bytes unchanged.
    for (const [rel, content] of Object.entries(before)) {
      const onDisk = await readFile(path.join(root, rel), "utf8");
      expect(onDisk).toBe(content);
    }

    // cq.toml backend = git-object.
    const toml1 = await readFile(path.join(root, "cq.toml"), "utf8");
    expect(toml1).toMatch(/\[ledger\]/);
    expect(toml1).toMatch(/backend\s*=\s*"git-object"/);

    // .gitignore carries the git-backend block.
    const gi1 = await readFile(path.join(root, ".gitignore"), "utf8");
    expect(gi1).toMatch(/cq git-object ledger backend/);

    // --- --to local ---
    // R418 LEAVES the docs/*.md on disk after --to git, so the local target is
    // "non-empty"; the round trip back uses --force (the realistic flow once the
    // operator round-trips a left-in-place tree).
    const io2 = recordingIo();
    const out2 = await dispatch(["move-ledger", "--cwd", root, "--to", "local", "--force"], io2);
    expect(out2.exitCode).toBe(0);

    // docs/*.md restored byte-identical to the orphan-ref content — and, since
    // `seeded` IS the pre-migration on-disk content captured in `before`, this
    // proves LOSSLESS on-disk state (before === after).
    for (const [rel, content] of Object.entries(seeded)) {
      const onDisk = await readFile(path.join(root, rel), "utf8");
      expect(onDisk).toBe(content);
    }

    // TRACKED again (tracked → untracked → tracked).
    const trackedAfterLocal = (await git(root, "ls-files", "docs/")).trim().split("\n").sort();
    expect(trackedAfterLocal).toEqual([
      "docs/archive/tasks/M1.md",
      "docs/defects.md",
      "docs/ledgers.yaml",
      "docs/tasks.md",
    ]);

    // cq.toml backend = fs.
    const toml2 = await readFile(path.join(root, "cq.toml"), "utf8");
    expect(toml2).toMatch(/backend\s*=\s*"fs"/);

    // .gitignore git-backend block removed (reversible).
    let gi2 = "";
    try {
      gi2 = await readFile(path.join(root, ".gitignore"), "utf8");
    } catch {
      gi2 = "";
    }
    expect(gi2).not.toMatch(/cq git-object ledger backend/);
  });

  it("refuses a non-empty git target without --force", async () => {
    const root = await gitRepo();
    await seedDocs(root);
    // First migration populates the orphan ref.
    expect((await dispatch(["move-ledger", "--cwd", root, "--to", "git"], recordingIo())).exitCode).toBe(0);

    // Re-seed docs so a second --to git has a source, then refuse (ref non-empty).
    await writeFile(path.join(root, "docs", "tasks.md"), "# tasks\n\n- [T2] more\n", "utf8");
    const io = recordingIo();
    const outcome = await dispatch(["move-ledger", "--cwd", root, "--to", "git"], io);
    expect(outcome.exitCode).toBe(2);
    expect(io.errs.join("\n")).toMatch(/already holds a non-empty ledger/);
  });

  it("refuses a non-empty local target without --force", async () => {
    const root = await gitRepo();
    const seeded = await seedDocs(root);
    expect((await dispatch(["move-ledger", "--cwd", root, "--to", "git"], recordingIo())).exitCode).toBe(0);
    // docs/*.md are still on disk (non-empty) → --to local refuses.
    const io = recordingIo();
    const outcome = await dispatch(["move-ledger", "--cwd", root, "--to", "local"], io);
    expect(outcome.exitCode).toBe(2);
    expect(io.errs.join("\n")).toMatch(/already holds a non-empty ledger/);

    // --force proceeds.
    const io2 = recordingIo();
    expect((await dispatch(["move-ledger", "--cwd", root, "--to", "local", "--force"], io2)).exitCode).toBe(0);
    for (const [rel, content] of Object.entries(seeded)) {
      expect(await readFile(path.join(root, rel), "utf8")).toBe(content);
    }
  });

  it("--to git leaves a NON-ledger docs/*.md (not a registered ledger) tracked + out of the ref", async () => {
    const root = await gitRepo();
    await seedDocs(root);
    // A user keeps an unrelated markdown file under docs/ — NOT a registered
    // ledger. move-ledger must not claim, snapshot, or untrack it.
    await writeFile(path.join(root, "docs", "notes.md"), "# design notes — not a ledger\n", "utf8");
    await git(root, "add", "docs/notes.md");
    await git(root, "commit", "-q", "-m", "add user notes");

    expect((await dispatch(["move-ledger", "--cwd", root, "--to", "git"], recordingIo())).exitCode).toBe(0);

    // The real ledger files are untracked; the non-ledger notes.md stays TRACKED.
    const tracked = (await git(root, "ls-files", "docs/")).trim().split("\n").filter(Boolean);
    expect(tracked).toEqual(["docs/notes.md"]);

    // notes.md is NOT carried into the orphan ref tree.
    await expect(git(root, "cat-file", "-p", "cq-ledger:notes.md")).rejects.toThrow();

    // It is still on disk, untouched.
    expect(await readFile(path.join(root, "docs", "notes.md"), "utf8")).toBe(
      "# design notes — not a ledger\n",
    );
  });
});
