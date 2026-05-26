import { appendFileSync, mkdirSync, openSync, fsyncSync, closeSync } from "node:fs";
import { dirname } from "node:path";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

// ---------------------------------------------------------------------------
// SqliteEventLog — JSONL file per invocation, sync append, fsync on close
// ---------------------------------------------------------------------------

export class SqliteEventLog {
  /** Maps invocationId → absolute path to its .jsonl file */
  private readonly paths = new Map<string, string>();
  /** Maps invocationId → open file descriptor (for fsync on close) */
  private readonly fds = new Map<string, number>();

  constructor(private readonly eventsDir: string) {}

  private pathFor(invocationId: string): string {
    const cached = this.paths.get(invocationId);
    if (cached) return cached;
    const p = `${this.eventsDir}/${invocationId}.jsonl`;
    this.paths.set(invocationId, p);
    return p;
  }

  /** Ensure the file exists and return its fd, opening it lazily. */
  private fdFor(invocationId: string): number {
    const cached = this.fds.get(invocationId);
    if (cached !== undefined) return cached;
    const p = this.pathFor(invocationId);
    mkdirSync(dirname(p), { recursive: true });
    const fd = openSync(p, "a");
    this.fds.set(invocationId, fd);
    return fd;
  }

  append(invocationId: string, event: SDKMessage): void {
    // Ensure dir/file exist via the fd (lazy open), then write via appendFileSync.
    this.fdFor(invocationId);
    const p = this.pathFor(invocationId);
    appendFileSync(p, JSON.stringify(event) + "\n");
  }

  async *readAll(invocationId: string): AsyncIterable<SDKMessage> {
    const p = this.pathFor(invocationId);
    let text: string;
    try {
      text = await Bun.file(p).text();
    } catch {
      return; // file doesn't exist yet
    }
    for (const line of text.split("\n")) {
      if (line.trim()) {
        yield JSON.parse(line) as SDKMessage;
      }
    }
  }

  close(invocationId: string): void {
    const fd = this.fds.get(invocationId);
    if (fd !== undefined) {
      try {
        fsyncSync(fd);
        closeSync(fd);
      } catch {
        // best-effort: fd may already be closed
      }
      this.fds.delete(invocationId);
    }
  }
}

// ---------------------------------------------------------------------------
// InMemoryEventLog — stores events in a Map<invocationId, SDKMessage[]>
// ---------------------------------------------------------------------------

export class InMemoryEventLog {
  private readonly store = new Map<string, SDKMessage[]>();

  append(invocationId: string, event: SDKMessage): void {
    let list = this.store.get(invocationId);
    if (!list) {
      list = [];
      this.store.set(invocationId, list);
    }
    list.push(event);
  }

  async *readAll(invocationId: string): AsyncIterable<SDKMessage> {
    const list = this.store.get(invocationId) ?? [];
    for (const e of list) {
      yield e;
    }
  }

  // No-op for in-memory; accept the param to satisfy the interface shape.
  close(invocationId: string): void {
    void invocationId;
  }
}
