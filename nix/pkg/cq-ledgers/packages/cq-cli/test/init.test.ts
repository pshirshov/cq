/**
 * T189: `cq init` — idempotent create-empty-ledgers-if-none.
 *
 * Asserts:
 *   (a) On an empty dir, creates docs/ledgers.yaml + canonical docs/*.md files.
 *   (b) Running again is a no-op that preserves items written between runs.
 *   (c) No cq.toml is created.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import {
  dispatch,
  type ConfirmIo,
  type DispatchIo,
} from "../src/main.js";
import { FsLedgerStore, CANONICAL_LEDGERS, MILESTONES_AMBIENT_ID } from "@cq/ledger";

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

function recordingIo(): DispatchIo & { outs: string[] } {
  const outs: string[] = [];
  return {
    outs,
    out: (l) => outs.push(l),
    err: () => {},
    confirm: silentConfirm,
  };
}

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "cq-init-"));
  dirs.push(dir);
  return dir;
}

describe("cq init", () => {
  it("(a) creates docs/ledgers.yaml + canonical docs/*.md on an empty dir", async () => {
    const root = await makeTmpDir();
    const io = recordingIo();

    const outcome = await dispatch(["init", "--cwd", root], io);
    expect(outcome.exitCode).toBe(0);

    // docs/ledgers.yaml must exist
    expect((await stat(path.join(root, "docs", "ledgers.yaml"))).isFile()).toBe(true);

    // Every canonical ledger file must exist
    for (const { name } of CANONICAL_LEDGERS) {
      expect((await stat(path.join(root, "docs", `${name}.md`))).isFile()).toBe(true);
    }

    // Some output was printed
    expect(io.outs.length).toBeGreaterThan(0);
  });

  it("(b) idempotent: second run preserves items written between runs", async () => {
    const root = await makeTmpDir();

    // First init
    await dispatch(["init", "--cwd", root], recordingIo());

    // Write an item between runs via the store directly
    const store = new FsLedgerStore({ root });
    await store.init();
    const created = await store.createItem("tasks", MILESTONES_AMBIENT_ID, {
      status: "planned",
      fields: { headline: "sentinel task" },
    });
    await store.dispose();

    // Second init (should be a no-op)
    const io2 = recordingIo();
    const outcome2 = await dispatch(["init", "--cwd", root], io2);
    expect(outcome2.exitCode).toBe(0);

    // The sentinel item must still be present
    const store2 = new FsLedgerStore({ root });
    await store2.init();
    const fetched = store2.fetchItem("tasks", created.id);
    await store2.dispose();

    expect(fetched.fields["headline"]).toBe("sentinel task");
  });

  it("(c) no cq.toml is created", async () => {
    const root = await makeTmpDir();
    await dispatch(["init", "--cwd", root], recordingIo());

    const entries = await readdir(root, { recursive: false });
    expect(entries).not.toContain("cq.toml");
  });
});
