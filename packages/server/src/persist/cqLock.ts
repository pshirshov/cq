import { existsSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";

export interface CqLock {
  acquired: boolean;
  release(): void;
}

/**
 * Best-effort PID lock at <dbPath>.lock.
 *
 * - If the lock file exists AND its PID is alive (process.kill(pid, 0) succeeds),
 *   the lock is held by another process. Returns { acquired: false }.
 * - Otherwise (no file, or stale PID), claims the lock by writing our PID.
 *   Returns { acquired: true, release: () => unlink the file }.
 * - Never throws on filesystem errors; the caller skips destructive actions
 *   like reaping when acquired === false.
 *
 * Crash-on-SIGKILL leaves a stale lock. The next start detects this via
 * process.kill(stalePid, 0) throwing ESRCH (no such process) and reclaims.
 */
export function tryAcquireDbLock(
  dbPath: string,
  logger?: { warn(msg: string, data?: Record<string, unknown>): void },
): CqLock {
  const lockPath = `${dbPath}.lock`;
  const noop = (): void => {};

  try {
    if (existsSync(lockPath)) {
      const raw = readFileSync(lockPath, "utf8").trim();
      const stalePid = parseInt(raw, 10);
      if (!isNaN(stalePid)) {
        try {
          // signal 0 = probe only; throws if process does not exist.
          process.kill(stalePid, 0);
          // Process is alive — lock is held by another process.
          logger?.warn("persist.lock_held_by_other", { lockPath, pid: stalePid });
          return { acquired: false, release: noop };
        } catch {
          // ESRCH or EPERM → process no longer exists; stale lock — reclaim.
        }
      }
    }

    // Write our PID.
    writeFileSync(lockPath, String(process.pid), "utf8");

    let released = false;
    function release(): void {
      if (released) return;
      released = true;
      try {
        unlinkSync(lockPath);
      } catch {
        // Best-effort; ignore if already removed.
      }
    }

    return { acquired: true, release };
  } catch {
    // Any filesystem error → degrade gracefully: don't hold the lock, don't reap.
    logger?.warn("persist.lock_error", { lockPath });
    return { acquired: false, release: noop };
  }
}
