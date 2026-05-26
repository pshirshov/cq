import type { SessionRow, InvocationRow } from "@cq/shared";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type {
  Persistence,
  SessionFilter,
  SortSpec,
  PageSpec,
  PagedResult,
} from "./Persistence.js";
import { InMemoryEventLog } from "./events.js";

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

const SESSION_SORT_KEYS: Record<string, keyof SessionRow> = {
  startedAt: "startedAt",
  endedAt: "endedAt",
  totalCostUsd: "totalCostUsd",
};

function cmp(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b));
}

// ---------------------------------------------------------------------------
// InMemoryPersistence
// ---------------------------------------------------------------------------

/**
 * Hand-written in-memory dummy `Persistence` adapter.
 *
 * - Sessions and invocations are stored in plain `Map`s.
 * - FTS is implemented as a linear substring scan on `promptExcerpt` and
 *   `agentName` (shape-parity with SQLite FTS5).
 * - Events are stored in an `InMemoryEventLog` (in-process `Map`).
 */
export class InMemoryPersistence implements Persistence {
  private readonly sessionMap = new Map<string, SessionRow>();
  private readonly invocationMap = new Map<string, InvocationRow>();
  private readonly eventLog = new InMemoryEventLog();

  readonly sessions = {
    insert: (row: SessionRow): void => {
      this.sessionMap.set(row.id, { ...row });
    },

    update: (id: string, patch: Partial<SessionRow>): void => {
      const existing = this.sessionMap.get(id);
      if (!existing) return;
      this.sessionMap.set(id, { ...existing, ...patch });
    },

    get: (id: string): SessionRow | undefined => {
      const r = this.sessionMap.get(id);
      return r ? { ...r } : undefined;
    },

    list: (filter: SessionFilter, sort: SortSpec, page: PageSpec): PagedResult<SessionRow> => {
      let rows = [...this.sessionMap.values()];

      if (filter.endedReason !== undefined) {
        rows = rows.filter((r) => r.endedReason === filter.endedReason);
      }
      if (filter.search) {
        const q = filter.search.toLowerCase();
        rows = rows.filter(
          (r) => r.title.toLowerCase().includes(q) || r.cwd.toLowerCase().includes(q)
        );
      }

      const key = SESSION_SORT_KEYS[sort.field] ?? "startedAt";
      rows.sort((a, b) => {
        const c = cmp(a[key], b[key]);
        return sort.dir === "desc" ? -c : c;
      });

      const total = rows.length;
      return {
        rows: rows.slice(page.offset, page.offset + page.limit).map((r) => ({ ...r })),
        total,
      };
    },

    delete: (id: string): void => {
      this.sessionMap.delete(id);
      // Cascade: delete all invocations for this session
      for (const [invId, inv] of this.invocationMap) {
        if (inv.sessionId === id) {
          this.invocationMap.delete(invId);
        }
      }
    },
  };

  readonly invocations = {
    insert: (row: InvocationRow): void => {
      this.invocationMap.set(row.id, { ...row });
    },

    update: (id: string, patch: Partial<InvocationRow>): void => {
      const existing = this.invocationMap.get(id);
      if (!existing) return;
      this.invocationMap.set(id, { ...existing, ...patch });
    },

    get: (id: string): InvocationRow | undefined => {
      const r = this.invocationMap.get(id);
      return r ? { ...r } : undefined;
    },

    listForSession: (sessionId: string): InvocationRow[] => {
      return [...this.invocationMap.values()]
        .filter((r) => r.sessionId === sessionId)
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((r) => ({ ...r }));
    },

    delete: (id: string): void => {
      this.invocationMap.delete(id);
    },

    /**
     * Linear substring scan over `promptExcerpt` and `agentName`.
     * Treats the query as a single search term (no FTS5 syntax).
     */
    searchFts: (query: string, limit: number): InvocationRow[] => {
      const q = query.toLowerCase();
      return [...this.invocationMap.values()]
        .filter(
          (r) =>
            r.promptExcerpt.toLowerCase().includes(q) ||
            r.agentName.toLowerCase().includes(q)
        )
        .slice(0, limit)
        .map((r) => ({ ...r }));
    },
  };

  readonly events = {
    append: (invocationId: string, event: SDKMessage): void =>
      this.eventLog.append(invocationId, event),
    readAll: (invocationId: string): AsyncIterable<SDKMessage> =>
      this.eventLog.readAll(invocationId),
    close: (invocationId: string): void => this.eventLog.close(invocationId),
  };

  withTx<T>(fn: () => T): T {
    // Snapshot both maps before the transaction; restore on error.
    const sessionSnapshot = new Map(
      [...this.sessionMap.entries()].map(([k, v]) => [k, { ...v }])
    );
    const invocationSnapshot = new Map(
      [...this.invocationMap.entries()].map(([k, v]) => [k, { ...v }])
    );

    try {
      const result = fn();
      return result;
    } catch (err) {
      // Restore pre-transaction state
      this.sessionMap.clear();
      for (const [k, v] of sessionSnapshot) this.sessionMap.set(k, v);
      this.invocationMap.clear();
      for (const [k, v] of invocationSnapshot) this.invocationMap.set(k, v);
      throw err;
    }
  }

  close(): void {
    // No-op for in-memory adapter.
  }
}
