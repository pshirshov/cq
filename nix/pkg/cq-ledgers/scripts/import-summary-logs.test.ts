/**
 * T415 (G49) — fixture test for the import-summary-logs helper.
 *
 * Acceptance:
 *   - A fixture repo whose main history contains deleted docs/logs/*.md files
 *     referenced by sessionLogs in ledger items runs the import → all land in
 *     the orphan ref (lsTree shows logs/<f>).
 *   - A re-run is a no-op (ref SHA unchanged — idempotency).
 *   - Imported bytes match the source commit (modulo redaction, which runs in
 *     cq log put).
 *   - Raw logs under docs/logs/raw/ are NOT imported (summaries-only scope).
 *
 * The fixture is a throwaway git repo; cleaned up in afterAll.
 *
 * The tests exercise the SHIPPED script by importing its exported functions
 * (importSummaryLogs, collectSessionLogRefs, extractSessionLogsFromText,
 * isSummaryLogRef, refPathFromDocsPath, recoverFromHistory) directly — no
 * duplicated inline logic.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { execFile } from "node:child_process";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { GitPlumbing, type TreeEntry } from "../packages/ledger/src/index.js";
// Import from the shipped script — tests exercise the real artifact.
import {
  importSummaryLogs,
  extractSessionLogsFromText,
  isSummaryLogRef,
  refPathFromDocsPath,
  collectSessionLogRefs,
  recoverFromHistory,
} from "./import-summary-logs.ts";

const execP = promisify(execFile);
const dirs: string[] = [];

afterAll(async () => {
  for (const d of dirs) await rm(d, { recursive: true, force: true }).catch(() => undefined);
});

const REF = "refs/heads/cq-ledger";

async function git(cwd: string, ...args: string[]): Promise<string> {
  const r = await execP("git", args, {
    cwd,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: "t",
      GIT_AUTHOR_EMAIL: "t@example.com",
      GIT_COMMITTER_NAME: "t",
      GIT_COMMITTER_EMAIL: "t@example.com",
      LC_ALL: "C",
      LANG: "C",
    },
  });
  return r.stdout;
}

/** Real GitPlumbing bound to a repo root. */
function plumbing(root: string): GitPlumbing {
  return GitPlumbing.withCwd(root, path.join(root, ".git"));
}

/**
 * Create the fixture throwaway repo:
 *   main branch history:
 *     commit-0: README.md
 *     commit-1: docs/logs/2026-01-summary.md, docs/logs/2026-02-summary.md,
 *               docs/logs/raw/2026-01-raw.md  (raw — must NOT be imported)
 *     commit-2: delete docs/logs/2026-01-summary.md
 *     commit-3: delete docs/logs/2026-02-summary.md (and raw)
 *
 * The orphan ref (refs/heads/cq-ledger) holds:
 *   tasks.md — a ledger file with sessionLogs referencing summary1
 *   archive/tasks/M99.md — archive file referencing summary2
 *
 * The cq.toml has backend = "git-object".
 */
async function fixtureRepo(): Promise<{
  root: string;
  summary1: string;
  summary2: string;
  rawLog: string;
}> {
  const dir = await mkdtemp(path.join(tmpdir(), "cq-import-summary-"));
  dirs.push(dir);

  await git(dir, "init", "-q");
  await git(dir, "config", "user.email", "t@example.com");
  await git(dir, "config", "user.name", "t");
  await git(dir, "config", "commit.gpgsign", "false");

  // commit-0: README
  await writeFile(path.join(dir, "README.md"), "# repo\n");
  await git(dir, "add", "README.md");
  await git(dir, "commit", "-q", "-m", "init");

  // commit-1: create docs/logs/ summary files + a raw log
  await mkdir(path.join(dir, "docs", "logs", "raw"), { recursive: true });
  const summary1Content = "# Session summary 2026-01\n\nImplemented feature X.\n";
  const summary2Content = "# Session summary 2026-02\n\nFixed bug Y.\n";
  const rawLogContent = "raw harness transcript content\n";
  await writeFile(path.join(dir, "docs", "logs", "2026-01-summary.md"), summary1Content);
  await writeFile(path.join(dir, "docs", "logs", "2026-02-summary.md"), summary2Content);
  await writeFile(path.join(dir, "docs", "logs", "raw", "2026-01-raw.md"), rawLogContent);
  await git(dir, "add", "docs/");
  await git(dir, "commit", "-q", "-m", "add summary logs");

  // commit-2: delete summary1
  await git(dir, "rm", "-q", "docs/logs/2026-01-summary.md");
  await git(dir, "commit", "-q", "-m", "delete 2026-01 summary");

  // commit-3: delete summary2 and raw log
  await git(dir, "rm", "-q", "docs/logs/2026-02-summary.md");
  await git(dir, "rm", "-q", "docs/logs/raw/2026-01-raw.md");
  await git(dir, "commit", "-q", "-m", "delete 2026-02 summary and raw log");

  // Write cq.toml with git-object backend
  await writeFile(
    path.join(dir, "cq.toml"),
    '[ledger]\nbackend = "git-object"\n',
    "utf8",
  );

  // Seed the orphan ref with a tasks.md that references summary1,
  // plus archive/tasks/M99.md that references summary2 (tests archive scanning).
  const tasksMd = [
    "---",
    "ledger: tasks",
    "counters:",
    "  milestone: 1",
    "  item: 3",
    "archives:",
    "  - id: M99",
    "    path: ./archive/tasks/M99.md",
    "    summary: archived milestone",
    "    title: archived milestone",
    "    status: done",
    "---",
    "",
    "# tasks",
    "",
    "## active",
    "",
    "### T1 — done",
    "",
    "- createdAt: 2026-01-01T00:00:00.000Z",
    "- updatedAt: 2026-01-02T00:00:00.000Z",
    "- headline: task one",
    `- sessionLogs: ["docs/logs/2026-01-summary.md"]`,
    "",
    "### T2 — done",
    "",
    "- createdAt: 2026-02-01T00:00:00.000Z",
    "- updatedAt: 2026-02-02T00:00:00.000Z",
    "- headline: task two",
    "- sessionLogs: []",
    "",
  ].join("\n");

  // Archive file for M99 referencing summary2.
  const archiveMd = [
    "## M99",
    "",
    "### T3 — done",
    "",
    "- createdAt: 2026-03-01T00:00:00.000Z",
    "- updatedAt: 2026-03-02T00:00:00.000Z",
    "- headline: task three (archived)",
    `- sessionLogs: ["docs/logs/2026-02-summary.md"]`,
    "",
  ].join("\n");

  const gitPlumb = plumbing(dir);
  const tSha = await gitPlumb.hashObject(tasksMd);
  const aSha = await gitPlumb.hashObject(archiveMd);
  const entries: TreeEntry[] = [
    { mode: "100644", sha: tSha, path: "tasks.md" },
    { mode: "100644", sha: aSha, path: "archive/tasks/M99.md" },
  ];
  const tree = await gitPlumb.writeTree(entries);
  const commit = await gitPlumb.commitTree(tree, null, "seed ledger");
  await gitPlumb.updateRef(REF, commit, null);

  return { root: dir, summary1: summary1Content, summary2: summary2Content, rawLog: rawLogContent };
}

// ---------------------------------------------------------------------------
// Unit tests for the pure utility functions (shipped code)
// ---------------------------------------------------------------------------

describe("isSummaryLogRef (shipped)", () => {
  it("accepts docs/logs/*.md summary paths", () => {
    expect(isSummaryLogRef("docs/logs/2026-01-summary.md")).toBe(true);
    expect(isSummaryLogRef("docs/logs/session.md")).toBe(true);
  });

  it("rejects docs/logs/raw/* paths", () => {
    expect(isSummaryLogRef("docs/logs/raw/2026-01-raw.md")).toBe(false);
    expect(isSummaryLogRef("docs/logs/raw/deep/nested.md")).toBe(false);
  });

  it("rejects paths outside docs/logs/", () => {
    expect(isSummaryLogRef("docs/other/file.md")).toBe(false);
    expect(isSummaryLogRef("file.md")).toBe(false);
  });

  it("rejects non-.md extensions", () => {
    expect(isSummaryLogRef("docs/logs/file.jsonl")).toBe(false);
    expect(isSummaryLogRef("docs/logs/file.txt")).toBe(false);
  });
});

describe("refPathFromDocsPath (shipped)", () => {
  it("strips the docs/ prefix", () => {
    expect(refPathFromDocsPath("docs/logs/foo.md")).toBe("logs/foo.md");
    expect(refPathFromDocsPath("docs/logs/raw/bar.md")).toBe("logs/raw/bar.md");
  });
});

describe("extractSessionLogsFromText (shipped)", () => {
  it("extracts summary log refs and filters via isSummaryLogRef", () => {
    const text = [
      `- sessionLogs: ["docs/logs/2026-01-summary.md","docs/logs/raw/2026-01-raw.md"]`,
    ].join("\n");
    const out = new Set<string>();
    extractSessionLogsFromText(text, out);
    expect(out.has("docs/logs/2026-01-summary.md")).toBe(true);
    // raw/ paths are filtered by isSummaryLogRef inside extractSessionLogsFromText
    expect(out.has("docs/logs/raw/2026-01-raw.md")).toBe(false);
  });

  it("handles empty sessionLogs array", () => {
    const out = new Set<string>();
    extractSessionLogsFromText("- sessionLogs: []", out);
    expect(out.size).toBe(0);
  });

  it("handles multiple sessionLogs lines", () => {
    const text = [
      `- sessionLogs: ["docs/logs/a.md"]`,
      `- sessionLogs: ["docs/logs/b.md","docs/logs/c.md"]`,
    ].join("\n");
    const out = new Set<string>();
    extractSessionLogsFromText(text, out);
    expect(out.size).toBe(3);
    expect(out.has("docs/logs/a.md")).toBe(true);
    expect(out.has("docs/logs/b.md")).toBe(true);
    expect(out.has("docs/logs/c.md")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration tests exercising the shipped importSummaryLogs driver
// ---------------------------------------------------------------------------

describe("import-summary-logs (shipped importSummaryLogs)", () => {
  it("imports all missing docs/logs/*.md summary logs into the orphan ref", async () => {
    const { root, summary1, summary2 } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    // Before import: neither summary log is present in the ref.
    const treeBefore = await gitPlumb.lsTree(REF);
    expect(treeBefore).not.toContain("logs/2026-01-summary.md");
    expect(treeBefore).not.toContain("logs/2026-02-summary.md");

    const result = await importSummaryLogs({ root });

    // Both summary logs imported; no failures.
    expect(result.imported).toBe(2);
    expect(result.failed).toBe(0);

    const treeAfter = await gitPlumb.lsTree(REF);
    expect(treeAfter).toContain("logs/2026-01-summary.md");
    expect(treeAfter).toContain("logs/2026-02-summary.md");

    // Raw log must NOT have been imported.
    expect(treeAfter.find((p) => p.includes("raw/"))).toBeUndefined();

    // Content matches the source (modulo redaction — no secrets in fixtures).
    const got1 = await gitPlumb.catFile(REF, "logs/2026-01-summary.md");
    expect(got1).toBe(summary1);
    const got2 = await gitPlumb.catFile(REF, "logs/2026-02-summary.md");
    expect(got2).toBe(summary2);
  });

  it("scans archive files for sessionLogs references (not just active items)", async () => {
    const { root } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    const result = await importSummaryLogs({ root });

    // T3 in archive/tasks/M99.md references 2026-02-summary.md — it must be imported.
    expect(result.imported).toBeGreaterThanOrEqual(1);
    const treeAfter = await gitPlumb.lsTree(REF);
    expect(treeAfter).toContain("logs/2026-02-summary.md");
  });

  it("is idempotent: a re-run leaves the ref SHA unchanged", async () => {
    const { root } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    // First run: imports both files.
    const run1 = await importSummaryLogs({ root });
    expect(run1.imported).toBe(2);
    const refShaAfterRun1 = run1.refSha;
    expect(refShaAfterRun1).not.toBeNull();

    // Second run: all files already present → no writes.
    const run2 = await importSummaryLogs({ root });
    expect(run2.imported).toBe(0);
    expect(run2.failed).toBe(0);

    // The orphan ref SHA must be byte-identical to after run 1.
    const refShaAfterRun2 = await gitPlumb.readRef(REF);
    expect(refShaAfterRun2).toBe(refShaAfterRun1);
  });

  it("does not import docs/logs/raw/* files (raw transcripts excluded)", async () => {
    const { root } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    // Add a sessionLogs reference to a raw log so the script would attempt it if
    // the filter were absent.  We patch the orphan ref's tasks.md to include a raw reference.
    const refSha = await gitPlumb.readRef(REF);
    if (refSha === null) throw new Error("fixture: ref must exist");

    const tasksMdWithRawRef = [
      "---",
      "ledger: tasks",
      "counters:",
      "  milestone: 0",
      "  item: 1",
      "archives: []",
      "---",
      "",
      "# tasks",
      "",
      "## active",
      "",
      "### T99 — done",
      "",
      "- createdAt: 2026-01-01T00:00:00.000Z",
      "- updatedAt: 2026-01-01T00:00:00.000Z",
      "- headline: task with raw and summary refs",
      // Reference both a summary and a raw log.
      `- sessionLogs: ["docs/logs/2026-01-summary.md","docs/logs/raw/2026-01-raw.md"]`,
      "",
    ].join("\n");

    // Re-seed the orphan ref with this tasks.md (no archive entry).
    const currentEntries = await gitPlumb.lsTreeEntries(REF);
    const tSha = await gitPlumb.hashObject(tasksMdWithRawRef);
    const kept = currentEntries.filter((e) => e.path !== "tasks.md" && e.path !== "archive/tasks/M99.md");
    kept.push({ mode: "100644", sha: tSha, path: "tasks.md" });
    const tree = await gitPlumb.writeTree(kept);
    const commit = await gitPlumb.commitTree(tree, refSha, "patch: add raw ref");
    await gitPlumb.updateRef(REF, commit, refSha);

    const result = await importSummaryLogs({ root });

    // Only the summary log is imported; the raw log is excluded.
    const treeAfter = await gitPlumb.lsTree(REF);
    expect(treeAfter).toContain("logs/2026-01-summary.md");
    expect(treeAfter.find((p) => p.startsWith("logs/raw/"))).toBeUndefined();

    // raw log was neither imported nor counted as a failure.
    expect(result.failed).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Integration tests for collectSessionLogRefs and recoverFromHistory
// ---------------------------------------------------------------------------

describe("collectSessionLogRefs (shipped)", () => {
  it("collects refs from active and archive ledger files in the orphan ref", async () => {
    const { root } = await fixtureRepo();
    const gitPlumb = plumbing(root);
    const treeNames = await gitPlumb.lsTree(REF);
    const refs = await collectSessionLogRefs(gitPlumb, REF, treeNames);

    // tasks.md has docs/logs/2026-01-summary.md, archive/tasks/M99.md has 2026-02-summary.md
    expect(refs.has("docs/logs/2026-01-summary.md")).toBe(true);
    expect(refs.has("docs/logs/2026-02-summary.md")).toBe(true);
    // Raw refs must not appear (filtered by extractSessionLogsFromText → isSummaryLogRef)
    for (const r of refs) {
      expect(isSummaryLogRef(r)).toBe(true);
    }
  });
});

describe("recoverFromHistory (shipped)", () => {
  it("recovers a deleted file from git history", async () => {
    const { root, summary1 } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    const contents = await recoverFromHistory(root, "docs/logs/2026-01-summary.md", gitPlumb);
    expect(contents.length).toBeGreaterThan(0);
    expect(contents[0]).toBe(summary1);
  });

  it("returns empty array for a path that never existed in history", async () => {
    const { root } = await fixtureRepo();
    const gitPlumb = plumbing(root);

    const contents = await recoverFromHistory(root, "docs/logs/nonexistent.md", gitPlumb);
    expect(contents).toEqual([]);
  });
});
