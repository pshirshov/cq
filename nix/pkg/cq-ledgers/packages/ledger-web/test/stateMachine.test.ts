/**
 * Unit tests for the pure state-machine diagram model (T5).
 *
 * Asserts the model's node colors come from the shared statusBucket→BUCKET_HEX
 * palette (so the diagram matches the badges) and that every transition pair
 * produces a directed edge; a schema without a `transitions` map is edgeless.
 */

import { describe, it, expect } from "bun:test";
import { computeStateMachine } from "../src/stateMachine";
import { BUCKET_HEX, statusBucket } from "../src/status";
import type { LedgerSchema } from "../src/types";

const guarded: LedgerSchema = {
  statusValues: ["open", "wip", "closed"],
  terminalStatuses: ["closed"],
  fields: { headline: { type: "string", required: true } },
  transitions: { open: ["wip", "closed"], wip: ["closed", "open"], closed: [] },
};

const unguarded: LedgerSchema = {
  statusValues: ["open", "closed"],
  terminalStatuses: ["closed"],
  fields: { headline: { type: "string", required: true } },
};

describe("computeStateMachine", () => {
  it("colors every node via statusBucket + BUCKET_HEX", () => {
    const m = computeStateMachine(guarded);
    expect(m.nodes.map((n) => n.status).sort()).toEqual(["closed", "open", "wip"]);
    for (const n of m.nodes) {
      expect(n.fill).toBe(BUCKET_HEX[statusBucket(n.status, guarded)]);
    }
    // terminal flag tracks terminalStatuses.
    expect(m.nodes.find((n) => n.status === "closed")!.terminal).toBe(true);
    expect(m.nodes.find((n) => n.status === "open")!.terminal).toBe(false);
  });

  it("emits one directed edge per transition pair", () => {
    const m = computeStateMachine(guarded);
    const pairs = m.edges.map((e) => `${e.from}->${e.to}`).sort();
    expect(pairs).toEqual(["open->closed", "open->wip", "wip->closed", "wip->open"].sort());
    expect(m.edgeless).toBe(false);
  });

  it("renders nodes-only (no edges) for a schema without transitions", () => {
    const m = computeStateMachine(unguarded);
    expect(m.edges).toHaveLength(0);
    expect(m.edgeless).toBe(true);
    expect(m.nodes).toHaveLength(2);
    expect(m.nodes[0]!.fill).toBe(BUCKET_HEX[statusBucket("open", unguarded)]);
  });
});
