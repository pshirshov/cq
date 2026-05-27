/**
 * Lockfile tests:
 *   - Orphaned lockfile (PID flagged as dead) is reclaimed on acquire.
 *   - Live-holder lockfile is respected (LedgerBusyError).
 *   - Acquire/release round-trip is symmetric.
 */

import { describe, it, expect, afterAll } from "bun:test";
import { mkdtemp, rm, writeFile, mkdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { Lockfile, LedgerBusyError } from "../src/index.js";

const dirs: string[] = [];

async function tmpLocksDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ledger-lock-"));
  dirs.push(dir);
  const locks = path.join(dir, ".locks");
  await mkdir(locks, { recursive: true });
  return locks;
}

afterAll(async () => {
  for (const d of dirs) {
    await rm(d, { recursive: true, force: true }).catch(() => undefined);
  }
});

describe("Lockfile", () => {
  it("acquire / release round-trip leaves no file behind", async () => {
    const locks = await tmpLocksDir();
    const lock = new Lockfile({ isPidAlive: () => false, selfPid: 4242 });
    const release = await lock.acquire(locks, "demo");
    await release();
    await expect(access(path.join(locks, "demo.lock"))).rejects.toThrow();
  });

  it("reclaims an orphaned lockfile written by a dead PID", async () => {
    const locks = await tmpLocksDir();
    // Pre-write a lockfile with a dead PID.
    await writeFile(
      path.join(locks, "demo.lock"),
      JSON.stringify({ pid: 999999, hostname: "dead.example", startedAt: 0 }),
      "utf8",
    );
    const lock = new Lockfile({
      isPidAlive: (pid: number) => pid !== 999999, // 999999 is dead; everyone else alive
      selfPid: 1234,
    });
    const release = await lock.acquire(locks, "demo");
    await release();
  });

  it("refuses when lockfile is held by a live PID", async () => {
    const locks = await tmpLocksDir();
    await writeFile(
      path.join(locks, "demo.lock"),
      JSON.stringify({ pid: 555, hostname: "live.example", startedAt: 0 }),
      "utf8",
    );
    const lock = new Lockfile({
      isPidAlive: (pid: number) => pid === 555,
      selfPid: 1234,
    });
    let caught: unknown = null;
    try {
      await lock.acquire(locks, "demo");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(LedgerBusyError);
    expect(String(caught)).toContain("pid 555");
  });
});
