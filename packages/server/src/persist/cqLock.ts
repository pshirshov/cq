import { readFileSync, openSync, writeSync, closeSync, writeFileSync, unlinkSync } from "node:fs";

export interface CqLock {
  acquired: boolean;
  release(): void;
}

/**
 * Best-effort PID lock at <dbPath>.lock.
 *
 * - Uses openSync with the "wx" flag for an atomic exclusive create on POSIX.
 *   Two concurrent callers cannot both create the file; only one succeeds.
 * - If the file already exists (EEXIST from "wx"), we check whether the
 *   recorded PID is still alive:
 *     - process.kill(pid, 0) succeeds → process alive → lock held → { acquired: false }
 *     - throws ESRCH → process truly dead → stale lock, reclaim
 *     - throws EPERM → process alive but foreign-owned → lock held → { acquired: false }
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
    // Attempt an atomic exclusive create ("wx" fails with EEXIST if file exists).
    let fd: number;
    try {
      fd = openSync(lockPath, "wx");
      // Exclusive create succeeded — we own the lock; write our PID.
      writeSync(fd, String(process.pid));
      closeSync(fd);
    } catch (openErr: unknown) {
      const code = (openErr as NodeJS.ErrnoException).code;
      if (code !== "EEXIST") {
        // Unexpected filesystem error — degrade gracefully.
        logger?.warn("persist.lock_error", { lockPath });
        return { acquired: false, release: noop };
      }
      // File already exists — inspect the PID it contains.
      const raw = readFileSync(lockPath, "utf8").trim();
      const stalePid = parseInt(raw, 10);
      if (!isNaN(stalePid)) {
        try {
          // signal 0 = probe only; throws if process does not exist.
          process.kill(stalePid, 0);
          // Process is alive — lock is held by another process.
          logger?.warn("persist.lock_held_by_other", { lockPath, pid: stalePid });
          return { acquired: false, release: noop };
        } catch (killErr: unknown) {
          const killCode = (killErr as NodeJS.ErrnoException).code;
          if (killCode !== "ESRCH") {
            // EPERM means the process is alive but foreign-owned — do NOT reclaim.
            logger?.warn("persist.lock_held_by_other", { lockPath, pid: stalePid, killCode });
            return { acquired: false, release: noop };
          }
          // ESRCH → process truly dead; stale lock — reclaim by overwriting.
        }
      }
      // Reclaim the stale lock by overwriting with our PID.
      writeFileSync(lockPath, String(process.pid), "utf8");
    }

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
