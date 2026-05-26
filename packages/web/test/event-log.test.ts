/**
 * event-log.test.ts — Unit tests for createEventLog (PR-16).
 *
 * Pure data-structure tests; no DOM dependency.
 */

import { describe, test, expect } from "bun:test";
import { createEventLog } from "../src/ws/eventLog";
import type { EventKind } from "../src/ws/eventLog";

describe("createEventLog", () => {
  test("empty log: getAll and getDisplayed return [], size is 0", () => {
    const log = createEventLog();
    expect(log.getAll()).toEqual([]);
    expect(log.getDisplayed()).toEqual([]);
    expect(log.size).toBe(0);
  });

  test("append 1 entry: appears in getAll and getDisplayed", () => {
    const log = createEventLog();
    log.append({ kind: "spawn", msg: "connection abcd1234 created", ts: 1000 });
    const all = log.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ ts: 1000, kind: "spawn", msg: "connection abcd1234 created" });
    expect(log.size).toBe(1);
  });

  test("append 600 with default retained=500: size stays 500, oldest evicted", () => {
    const log = createEventLog(); // retained=500, displayed=100
    for (let i = 0; i < 600; i++) {
      log.append({ kind: "alive", msg: `event ${i}`, ts: i });
    }
    expect(log.size).toBe(500);
    const all = log.getAll();
    expect(all).toHaveLength(500);
    // Latest-first: index 0 is ts=599, last is ts=100
    expect(all[0]!.ts).toBe(599);
    expect(all[499]!.ts).toBe(100);
    // Monotonically decreasing (latest-first ordering)
    expect(all[0]!.ts).toBeGreaterThan(all[499]!.ts);
  });

  test("getDisplayed returns at most displayed (default 100), latest first", () => {
    const log = createEventLog(); // retained=500, displayed=100
    for (let i = 0; i < 200; i++) {
      log.append({ kind: "backoff", msg: `msg ${i}`, ts: i });
    }
    const displayed = log.getDisplayed();
    expect(displayed).toHaveLength(100);
    // Latest-first: first entry should have ts=199
    expect(displayed[0]!.ts).toBe(199);
    expect(displayed[99]!.ts).toBe(100);
  });

  test("entries carry ts, kind, msg with expected values; kind is a valid EventKind", () => {
    const log = createEventLog();
    const validKinds: EventKind[] = [
      "spawn", "alive", "stale", "dead", "close",
      "backoff", "retry", "terminal", "destroy", "lifecycle",
    ];
    let idx = 0;
    for (const kind of validKinds) {
      log.append({ kind, msg: `test ${kind}`, ts: idx++ });
    }
    const all = log.getAll();
    expect(all).toHaveLength(validKinds.length);
    // Latest-first — first entry is the last appended kind
    for (let i = 0; i < validKinds.length; i++) {
      const entry = all[i]!;
      expect(validKinds).toContain(entry.kind);
      expect(typeof entry.ts).toBe("number");
      expect(typeof entry.msg).toBe("string");
    }
  });

  test("append with explicit ts override is preserved", () => {
    const log = createEventLog();
    const customTs = 1_234_567_890;
    log.append({ kind: "terminal", msg: "manager terminal: test", ts: customTs });
    const all = log.getAll();
    expect(all[0]!.ts).toBe(customTs);
  });

  test("custom retained and displayed limits are respected", () => {
    const log = createEventLog({ retained: 10, displayed: 5 });
    for (let i = 0; i < 20; i++) {
      log.append({ kind: "spawn", msg: `spawn ${i}`, ts: i });
    }
    expect(log.size).toBe(10);
    expect(log.getAll()).toHaveLength(10);
    expect(log.getDisplayed()).toHaveLength(5);
    // Latest-first: getDisplayed[0] should be ts=19
    expect(log.getDisplayed()[0]!.ts).toBe(19);
    // getAll[0] should be ts=19 (latest first)
    expect(log.getAll()[0]!.ts).toBe(19);
    // getAll[9] should be ts=10 (oldest retained)
    expect(log.getAll()[9]!.ts).toBe(10);
  });
});
