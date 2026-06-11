/**
 * T401: ledgerTreePaths includes logs/** in the portable tree; .locks/.backup
 * are excluded. removeLedgerArtifacts still removes ALL of logs/.locks/.backup.
 */

import { describe, it, expect, afterAll } from "bun:test";
import * as fs from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { ledgerTreePaths, removeLedgerArtifacts } from "../src/store/ledgerArtifacts.js";

const dirs: string[] = [];
afterAll(async () => {
  for (const d of dirs) await fs.rm(d, { recursive: true, force: true }).catch(() => undefined);
});

async function makeDocsDir(): Promise<string> {
  const tmp = await fs.mkdtemp(path.join(tmpdir(), "cq-artifacts-"));
  dirs.push(tmp);
  const docs = path.join(tmp, "docs");
  await fs.mkdir(docs, { recursive: true });
  return docs;
}

describe("ledgerTreePaths", () => {
  it("(a) includes logs/a.md and logs/raw/b.jsonl alongside ledgers.yaml and <name>.md", async () => {
    const docs = await makeDocsDir();

    // Seed a minimal ledger registry + one ledger file.
    await fs.writeFile(path.join(docs, "ledgers.yaml"), "version: 1\nledgers:\n  - tasks\n");
    await fs.writeFile(path.join(docs, "tasks.md"), "# tasks\n");

    // Seed archive/** so we can confirm it is also included.
    await fs.mkdir(path.join(docs, "archive", "tasks"), { recursive: true });
    await fs.writeFile(path.join(docs, "archive", "tasks", "M1.md"), "# M1\n");

    // Seed logs/** — the portable runtime content.
    await fs.mkdir(path.join(docs, "logs", "raw"), { recursive: true });
    await fs.writeFile(path.join(docs, "logs", "a.md"), "log entry\n");
    await fs.writeFile(path.join(docs, "logs", "raw", "b.jsonl"), '{"x":1}\n');

    // Seed ephemeral dirs that must NOT appear in ledgerTreePaths.
    await fs.mkdir(path.join(docs, ".locks"), { recursive: true });
    await fs.writeFile(path.join(docs, ".locks", "writer.lock"), "pid=1\n");
    await fs.mkdir(path.join(docs, ".backup", "20260101-000000"), { recursive: true });
    await fs.writeFile(path.join(docs, ".backup", "20260101-000000", "tasks.md"), "# backup\n");

    const paths = await ledgerTreePaths(docs);

    // Portable tree must include logs/** entries.
    expect(paths).toContain("logs/a.md");
    expect(paths).toContain("logs/raw/b.jsonl");

    // Portable tree must include the standard ledger artifacts.
    expect(paths).toContain("ledgers.yaml");
    expect(paths).toContain("tasks.md");
    expect(paths).toContain("archive/tasks/M1.md");

    // Ephemeral dirs must NOT appear.
    expect(paths.some((p) => p.startsWith(".locks"))).toBe(false);
    expect(paths.some((p) => p.startsWith(".backup"))).toBe(false);

    // Result is sorted.
    expect(paths).toEqual([...paths].sort());
  });

  it("(a') logs/ absent → ledgerTreePaths still works and returns no logs/** entries", async () => {
    const docs = await makeDocsDir();
    await fs.writeFile(path.join(docs, "ledgers.yaml"), "version: 1\nledgers:\n  - tasks\n");
    await fs.writeFile(path.join(docs, "tasks.md"), "# tasks\n");

    const paths = await ledgerTreePaths(docs);
    expect(paths).toContain("ledgers.yaml");
    expect(paths).toContain("tasks.md");
    expect(paths.some((p) => p.startsWith("logs"))).toBe(false);
  });
});

describe("removeLedgerArtifacts", () => {
  it("(b) still removes logs/, .locks/, and .backup/ (erase behaviour unchanged)", async () => {
    const docs = await makeDocsDir();

    await fs.writeFile(path.join(docs, "ledgers.yaml"), "version: 1\nledgers:\n  - tasks\n");
    await fs.writeFile(path.join(docs, "tasks.md"), "# tasks\n");
    await fs.mkdir(path.join(docs, "logs"), { recursive: true });
    await fs.writeFile(path.join(docs, "logs", "session.log"), "log\n");
    await fs.mkdir(path.join(docs, ".locks"), { recursive: true });
    await fs.writeFile(path.join(docs, ".locks", "writer.lock"), "pid=1\n");
    await fs.mkdir(path.join(docs, ".backup", "snap"), { recursive: true });
    await fs.writeFile(path.join(docs, ".backup", "snap", "tasks.md"), "# bak\n");

    const result = await removeLedgerArtifacts(docs);

    // All three runtime dirs removed.
    async function exists(p: string): Promise<boolean> {
      try {
        await fs.stat(p);
        return true;
      } catch {
        return false;
      }
    }
    expect(await exists(path.join(docs, "logs"))).toBe(false);
    expect(await exists(path.join(docs, ".locks"))).toBe(false);
    expect(await exists(path.join(docs, ".backup"))).toBe(false);

    // Standard ledger artifacts removed too.
    expect(await exists(path.join(docs, "ledgers.yaml"))).toBe(false);
    expect(await exists(path.join(docs, "tasks.md"))).toBe(false);

    // Result records the removals.
    expect(result.removed.length).toBeGreaterThan(0);
  });
});
