/**
 * T413: `cq log put` — git-object backend write path integration tests.
 *
 * Acceptance (against a throwaway git repo with backend='git-object'):
 *   - `cq log put --stdin --dest logs/raw/x.jsonl` lands the blob at tree path
 *     logs/raw/x.jsonl on refs/heads/cq-ledger (verify via GitPlumbing.catFile);
 *   - the working tree + index + HEAD stay byte-identical (git status clean —
 *     ref-only; NO persistent worktree copy);
 *   - a pre-seeded foreign tree path (tmp/marker) AND a pre-existing
 *     ledgers.yaml / <ledger>.md survive the put;
 *   - a SECOND interleaved item-write advance does NOT clobber the log entry
 *     (both present in the final tree);
 *   - a simulated StaleRefError on the first CAS triggers a successful retry;
 *   - two racing puts of different logs both land.
 *
 * The redaction + strict-JSONL validation are SHARED with the fs path (covered
 * by log-put-fs.test.ts); here we add one redaction assertion to confirm the
 * shared pre-write step still runs on the git-object branch, plus a validation-
 * failure-before-ref-mutation assertion.
 *
 * Throwaway repos via mkdtemp; cleaned up in afterAll.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import {
  GitPlumbing,
  nodeGitRunner,
  type GitRunner,
  type GitResult,
  type TreeEntry,
} from "@cq/ledger";
import { runLogPut, parseLogPutArgs, type LogPutIo } from "../src/logPut.js";

const exec = promisify(execFile);
const dirs: string[] = [];

afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => undefined);
});

/** A throwaway git repo with one committed file + a cq.toml selecting git-object. */
async function gitObjectRepo(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "cq-log-put-git-"));
  dirs.push(dir);
  await exec("git", ["init", "-q"], { cwd: dir });
  await exec("git", ["config", "user.email", "t@example.com"], { cwd: dir });
  await exec("git", ["config", "user.name", "t"], { cwd: dir });
  await exec("git", ["config", "commit.gpgsign", "false"], { cwd: dir });
  await writeFile(path.join(dir, "README.md"), "# repo\n");
  await exec("git", ["add", "README.md"], { cwd: dir });
  await exec("git", ["commit", "-q", "-m", "init"], { cwd: dir });
  await writeFile(path.join(dir, "cq.toml"), '[ledger]\nbackend = "git-object"\n', "utf8");
  return dir;
}

const REF = "refs/heads/cq-ledger";

/** Real GitPlumbing bound to a repo root, scratch index under .git (production shape). */
function plumbing(root: string): GitPlumbing {
  return GitPlumbing.withCwd(root, path.join(root, ".git"));
}

/**
 * Seed the orphan ref with a set of tree entries (foreign + ledger paths) so we
 * can assert they survive a `log put`. Returns nothing; advances REF by one
 * orphan commit built from the given (path → content) map.
 */
async function seedRef(
  root: string,
  files: Readonly<Record<string, string>>,
): Promise<void> {
  const git = plumbing(root);
  const entries: TreeEntry[] = [];
  for (const [p, content] of Object.entries(files)) {
    const sha = await git.hashObject(content);
    entries.push({ mode: "100644", sha, path: p });
  }
  const tree = await git.writeTree(entries);
  const commit = await git.commitTree(tree, null, "seed");
  await git.updateRef(REF, commit, null);
}

function makeIo(stdinContent: string): LogPutIo & { outs: string[]; errs: string[] } {
  const outs: string[] = [];
  const errs: string[] = [];
  return {
    outs,
    errs,
    out: (l) => outs.push(l),
    err: (l) => errs.push(l),
    readStdin: async () => stdinContent,
  };
}

// ---------------------------------------------------------------------------
// Lands the blob on the orphan ref, ref-only (no working-tree perturbation)
// ---------------------------------------------------------------------------

describe("cq log put git-object — lands on the orphan ref, ref-only", () => {
  it("commits logs/raw/x.jsonl on refs/heads/cq-ledger; working tree stays clean", async () => {
    const root = await gitObjectRepo();
    const statusBefore = await exec("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).then((r) => r.stdout);
    const headBefore = await exec("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).then((r) => r.stdout.trim());

    const input = '{"event":"start","ts":1}\n';
    const io = makeIo(input);
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/x.jsonl"]);
    const outcome = await runLogPut(args, io);

    expect(outcome.exitCode).toBe(0);
    expect(io.errs).toEqual([]);

    // The blob landed at the docs-relative tree path on the orphan ref.
    const got = await plumbing(root).catFile(REF, "logs/raw/x.jsonl");
    expect(got).toBe(input);

    // Ref-only: working tree + index + HEAD byte-identical.
    const statusAfter = await exec("git", ["status", "--porcelain"], {
      cwd: root,
      encoding: "utf8",
    }).then((r) => r.stdout);
    const headAfter = await exec("git", ["rev-parse", "HEAD"], {
      cwd: root,
      encoding: "utf8",
    }).then((r) => r.stdout.trim());
    // cq.toml is the only untracked addition; nothing under logs/ or docs/.
    expect(statusAfter).toBe(statusBefore);
    expect(statusAfter.includes("logs/")).toBe(false);
    expect(statusAfter.includes("docs/")).toBe(false);
    expect(headAfter).toBe(headBefore);
  });

  it("applies redaction on the git-object path (shared pre-write step)", async () => {
    const root = await gitObjectRepo();
    const io = makeIo('{"event":"auth","key":"AKIAIOSFODNN7EXAMPLE"}\n');
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/secret.jsonl"]);
    const outcome = await runLogPut(args, io);
    expect(outcome.exitCode).toBe(0);

    const got = await plumbing(root).catFile(REF, "logs/raw/secret.jsonl");
    expect(got).toContain("[REDACTED:aws-key]");
    expect(got).not.toContain("AKIAIOSFODNN7EXAMPLE");
  });

  it("malformed JSONL exits non-zero and does NOT mutate the ref", async () => {
    const root = await gitObjectRepo();
    // Seed the ref so we can assert it is unchanged after the rejected put.
    await seedRef(root, { "ledgers.yaml": "version: 1\n" });
    const refBefore = await plumbing(root).readRef(REF);

    const io = makeIo('{\n  "event": "bad"\n}\n'); // pretty-printed → not JSONL
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/bad.jsonl"]);
    const outcome = await runLogPut(args, io);

    expect(outcome.exitCode).not.toBe(0);
    expect(io.errs.join("\n")).toContain("malformed JSONL");

    const refAfter = await plumbing(root).readRef(REF);
    expect(refAfter).toBe(refBefore); // ref untouched — validation failed first
  });
});

// ---------------------------------------------------------------------------
// Foreign tree paths + existing ledger files survive the put
// ---------------------------------------------------------------------------

describe("cq log put git-object — foreign + ledger tree paths survive", () => {
  it("preserves tmp/marker, ledgers.yaml and tasks.md across the put", async () => {
    const root = await gitObjectRepo();
    await seedRef(root, {
      "tmp/marker": "keep-me\n",
      "ledgers.yaml": "version: 1\n",
      "tasks.md": "# tasks\n",
    });

    const io = makeIo('{"event":"ok"}\n');
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/y.jsonl"]);
    const outcome = await runLogPut(args, io);
    expect(outcome.exitCode).toBe(0);

    const git = plumbing(root);
    expect(await git.catFile(REF, "tmp/marker")).toBe("keep-me\n");
    expect(await git.catFile(REF, "ledgers.yaml")).toBe("version: 1\n");
    expect(await git.catFile(REF, "tasks.md")).toBe("# tasks\n");
    expect(await git.catFile(REF, "logs/raw/y.jsonl")).toBe('{"event":"ok"}\n');
  });
});

// ---------------------------------------------------------------------------
// Interleaved item-write advance does NOT clobber the log entry
// ---------------------------------------------------------------------------

describe("cq log put git-object — interleaved advance does not clobber", () => {
  it("a foreign advance between read and CAS retries; both paths land", async () => {
    const root = await gitObjectRepo();
    await seedRef(root, { "tasks.md": "# tasks v1\n" });

    // Inject a runner that, on the FIRST `update-ref` CAS, first performs a
    // REAL competing advance (writes tasks.md v2) and THEN lets the original CAS
    // proceed — which now fails with a stale-ref ("cannot lock ref") because the
    // ref moved. The retry re-reads the (advanced) tree and rebuilds, so BOTH
    // the foreign tasks.md v2 and our log entry survive.
    const realRunner = nodeGitRunner(root);
    let interleaved = false;
    const interleavingRunner: GitRunner = async (gitArgs, opts): Promise<GitResult> => {
      if (gitArgs[0] === "update-ref" && !interleaved) {
        interleaved = true;
        // Competing advance: replace tasks.md on the ref out-of-band.
        const peer = plumbing(root);
        const old = await peer.readRef(REF);
        const entries = old === null ? [] : await peer.lsTreeEntries(REF);
        const sha = await peer.hashObject("# tasks v2\n");
        const kept = entries.filter((e: TreeEntry) => e.path !== "tasks.md");
        kept.push({ mode: "100644", sha, path: "tasks.md" });
        const tree = await peer.writeTree(kept);
        const commit = await peer.commitTree(tree, old, "peer advance");
        await peer.updateRef(REF, commit, old);
      }
      return realRunner(gitArgs, opts);
    };
    const factory = (): GitPlumbing =>
      new GitPlumbing({ runner: interleavingRunner, scratchDir: path.join(root, ".git") });

    const io = makeIo('{"event":"log"}\n');
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/z.jsonl"]);
    const outcome = await runLogPut(args, io, factory);
    expect(outcome.exitCode).toBe(0);
    expect(interleaved).toBe(true);

    const git = plumbing(root);
    // Both the foreign advance and our log entry are present in the final tree.
    expect(await git.catFile(REF, "tasks.md")).toBe("# tasks v2\n");
    expect(await git.catFile(REF, "logs/raw/z.jsonl")).toBe('{"event":"log"}\n');
  });
});

// ---------------------------------------------------------------------------
// Simulated StaleRefError on the first CAS triggers a successful retry
// ---------------------------------------------------------------------------

describe("cq log put git-object — StaleRefError retry", () => {
  it("a stale CAS on the first attempt retries and succeeds", async () => {
    const root = await gitObjectRepo();
    await seedRef(root, { "ledgers.yaml": "version: 1\n" });

    // Inject a runner that fails the FIRST `update-ref` with a CAS-style
    // "cannot lock ref" stderr (→ StaleRefError) and lets the SECOND succeed.
    const realRunner = nodeGitRunner(root);
    let casCalls = 0;
    const flakyRunner: GitRunner = async (gitArgs, opts): Promise<GitResult> => {
      if (gitArgs[0] === "update-ref") {
        casCalls++;
        if (casCalls === 1) {
          return {
            stdout: "",
            stderr: `error: cannot lock ref '${REF}': is at deadbeef but expected cafebabe`,
            code: 1,
          };
        }
      }
      return realRunner(gitArgs, opts);
    };
    const factory = (): GitPlumbing =>
      new GitPlumbing({ runner: flakyRunner, scratchDir: path.join(root, ".git") });

    const io = makeIo('{"event":"retry"}\n');
    const args = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/retry.jsonl"]);
    const outcome = await runLogPut(args, io, factory);

    expect(outcome.exitCode).toBe(0);
    expect(casCalls).toBeGreaterThanOrEqual(2); // first failed, retry succeeded
    expect(io.errs).toEqual([]);

    const git = plumbing(root);
    expect(await git.catFile(REF, "logs/raw/retry.jsonl")).toBe('{"event":"retry"}\n');
    expect(await git.catFile(REF, "ledgers.yaml")).toBe("version: 1\n"); // survived
  });
});

// ---------------------------------------------------------------------------
// Two racing puts of different logs both land
// ---------------------------------------------------------------------------

describe("cq log put git-object — concurrent puts of different logs", () => {
  it("two racing puts both land their entries", async () => {
    const root = await gitObjectRepo();
    await seedRef(root, { "ledgers.yaml": "version: 1\n" });

    const ioA = makeIo('{"who":"a"}\n');
    const ioB = makeIo('{"who":"b"}\n');
    const argsA = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/a.jsonl"]);
    const argsB = parseLogPutArgs(root, ["--stdin", "--dest", "logs/raw/b.jsonl"]);

    const [outA, outB] = await Promise.all([
      runLogPut(argsA, ioA),
      runLogPut(argsB, ioB),
    ]);

    expect(outA.exitCode).toBe(0);
    expect(outB.exitCode).toBe(0);

    const git = plumbing(root);
    expect(await git.catFile(REF, "logs/raw/a.jsonl")).toBe('{"who":"a"}\n');
    expect(await git.catFile(REF, "logs/raw/b.jsonl")).toBe('{"who":"b"}\n');
    expect(await git.catFile(REF, "ledgers.yaml")).toBe("version: 1\n");
  });
});
