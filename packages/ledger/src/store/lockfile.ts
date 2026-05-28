/**
 * Advisory lockfile with stale-PID reclaim.
 *
 * Layout: one lockfile per ledger at `<root>/.locks/<ledger>.lock`.
 * Content: JSON `{ pid, hostname, startedAt }`.
 *
 * Acquire algorithm:
 *  1. Ensure `.locks/` exists.
 *  2. Open the lockfile with `O_CREAT | O_EXCL | O_WRONLY`.
 *     - On success: write {pid, hostname, startedAt}, fsync, return release().
 *     - On EEXIST: read holder JSON. If `pid` is not alive (probed by
 *       `process.kill(pid, 0)` which throws ESRCH), unlink the lockfile and
 *       retry exactly once. If still EEXIST after retry, throw LedgerBusyError.
 *
 * The `isPidAlive` and `now` injection points let tests simulate a live
 * holder without forking a real process.
 */

import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { LedgerBusyError } from "../types.js";

export interface LockHolder {
  pid: number;
  hostname: string;
  startedAt: number;
}

export interface LockfileOpts {
  /** Override for tests. Defaults to `process.kill(pid, 0)` probe. */
  isPidAlive?: (pid: number) => boolean;
  /** Override for tests. Defaults to `Date.now`. */
  now?: () => number;
  /** Override for tests. Defaults to `process.pid`. */
  selfPid?: number;
  /** Override for tests. Defaults to `os.hostname()`. */
  selfHostname?: string;
}

export class Lockfile {
  private readonly isPidAlive: (pid: number) => boolean;
  private readonly now: () => number;
  private readonly selfPid: number;
  private readonly selfHostname: string;

  constructor(opts: LockfileOpts = {}) {
    this.isPidAlive = opts.isPidAlive ?? defaultIsPidAlive;
    this.now = opts.now ?? Date.now;
    this.selfPid = opts.selfPid ?? process.pid;
    this.selfHostname = opts.selfHostname ?? os.hostname();
  }

  /**
   * Acquire the lock for `ledgerId` under `locksDir`. Returns a release
   * function which removes the lockfile. Throws `LedgerBusyError` if the
   * lockfile is held by a live PID.
   */
  async acquire(locksDir: string, ledgerId: string): Promise<() => Promise<void>> {
    await fs.mkdir(locksDir, { recursive: true });
    const lockPath = path.join(locksDir, `${ledgerId}.lock`);

    const tryOnce = async (): Promise<"acquired" | "exists"> => {
      let fh;
      try {
        fh = await fs.open(lockPath, "wx");
      } catch (e) {
        const code = (e as NodeJS.ErrnoException).code;
        if (code === "EEXIST") return "exists";
        throw e;
      }
      try {
        const holder: LockHolder = {
          pid: this.selfPid,
          hostname: this.selfHostname,
          startedAt: this.now(),
        };
        await fh.writeFile(JSON.stringify(holder), "utf8");
        await fh.sync();
      } finally {
        await fh.close();
      }
      return "acquired";
    };

    let result = await tryOnce();
    if (result === "exists") {
      // Read holder; if dead, reclaim.
      const holder = await this.readHolder(lockPath, ledgerId);
      if (!this.isPidAlive(holder.pid)) {
        await fs.unlink(lockPath).catch(() => undefined);
        result = await tryOnce();
        if (result === "exists") {
          // A racing reclaimer won — fail honestly.
          const racer = await this.readHolder(lockPath, ledgerId);
          throw new LedgerBusyError(ledgerId, racer);
        }
      } else {
        throw new LedgerBusyError(ledgerId, holder);
      }
    }

    return async () => {
      await fs.unlink(lockPath).catch(() => undefined);
    };
  }

  private async readHolder(lockPath: string, ledgerId: string): Promise<LockHolder> {
    try {
      const text = await fs.readFile(lockPath, "utf8");
      const obj = JSON.parse(text) as unknown;
      if (
        obj === null ||
        typeof obj !== "object" ||
        typeof (obj as Record<string, unknown>)["pid"] !== "number"
      ) {
        // Corrupt lockfile — treat as dead.
        return { pid: -1, hostname: "unknown", startedAt: 0 };
      }
      const o = obj as Record<string, unknown>;
      return {
        pid: o["pid"] as number,
        hostname: typeof o["hostname"] === "string" ? (o["hostname"] as string) : "unknown",
        startedAt: typeof o["startedAt"] === "number" ? (o["startedAt"] as number) : 0,
      };
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        // Disappeared between EEXIST and read — synthesize dead holder.
        return { pid: -1, hostname: "unknown", startedAt: 0 };
      }
      // Any other error — be conservative and report as busy by an unknown holder.
      throw new LedgerBusyError(ledgerId, { pid: 0, hostname: "unknown", startedAt: 0 });
    }
  }
}

function defaultIsPidAlive(pid: number): boolean {
  try {
    // POSIX semantics: kill(pid, 0) does no signal; throws ESRCH if not alive,
    // EPERM if alive but owned by another user (we treat EPERM as alive).
    process.kill(pid, 0);
    return true;
  } catch (e) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "EPERM") return true;
    return false;
  }
}
