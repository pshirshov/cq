import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import React from "react";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { statusBucket, statusColor, isTerminal } from "../src/status.js";
import type { LedgerSchema } from "../src/types.js";
import { REVIEWS_SCHEMA, DEFECTS_SCHEMA } from "@cq/ledger";

// Resolve chalk via ink's dependency to force ANSI output in tests.
const inkPath = import.meta.resolve("ink");
const chalkPath = import.meta.resolve("chalk", inkPath);
const chalkMod = await import(chalkPath);
const chalk = chalkMod.default ?? chalkMod;

const tasks: LedgerSchema = {
  statusValues: ["planned", "wip", "done", "blocked", "abandoned"],
  terminalStatuses: ["done", "abandoned"],
  fields: {},
};

describe("status buckets", () => {
  it("classifies non-terminal statuses by vocabulary", () => {
    expect(statusBucket("planned", tasks)).toBe("start");
    expect(statusBucket("wip", tasks)).toBe("progress");
    expect(statusBucket("blocked", tasks)).toBe("blocked");
  });

  it("classifies terminal statuses as done vs dropped", () => {
    expect(statusBucket("done", tasks)).toBe("done");
    expect(statusBucket("abandoned", tasks)).toBe("dropped");
    expect(isTerminal("done", tasks)).toBe(true);
    expect(isTerminal("wip", tasks)).toBe(false);
  });

  it("falls back to start for unknown non-terminal statuses", () => {
    const custom: LedgerSchema = {
      statusValues: ["triage", "shipped"],
      terminalStatuses: ["shipped"],
      fields: {},
    };
    expect(statusBucket("triage", custom)).toBe("start");
    expect(statusBucket("shipped", custom)).toBe("done");
  });

  it("maps buckets to distinct ink colors; terminal-dropped is gray", () => {
    expect(statusColor("wip", tasks)).toBe("yellow");
    expect(statusColor("blocked", tasks)).toBe("red");
    expect(statusColor("done", tasks)).toBe("green");
    expect(statusColor("abandoned", tasks)).toBe("gray");
  });
});

describe("warning bucket (reviews schema)", () => {
  it("revise → warning", () => {
    expect(statusBucket("revise", REVIEWS_SCHEMA)).toBe("warning");
  });

  it("go-ahead → done", () => {
    expect(statusBucket("go-ahead", REVIEWS_SCHEMA)).toBe("done");
  });

  it("statusColor: revise → magenta (distinct from yellow used by progress)", () => {
    expect(statusColor("revise", REVIEWS_SCHEMA)).toBe("magenta");
  });

  it("statusColor: go-ahead → green (unchanged)", () => {
    expect(statusColor("go-ahead", REVIEWS_SCHEMA)).toBe("green");
  });
});

describe("defects schema — new lifecycle statuses (T117)", () => {
  it("root-caused → ready bucket (non-terminal)", () => {
    expect(isTerminal("root-caused", DEFECTS_SCHEMA)).toBe(false);
    expect(statusBucket("root-caused", DEFECTS_SCHEMA)).toBe("ready");
  });

  it("inconclusive → warning bucket (non-terminal)", () => {
    expect(isTerminal("inconclusive", DEFECTS_SCHEMA)).toBe(false);
    expect(statusBucket("inconclusive", DEFECTS_SCHEMA)).toBe("warning");
  });

  it("wontfix → dropped bucket (terminal)", () => {
    expect(isTerminal("wontfix", DEFECTS_SCHEMA)).toBe(true);
    expect(statusBucket("wontfix", DEFECTS_SCHEMA)).toBe("dropped");
  });

  it("wontfix color is gray (muted, NOT green)", () => {
    const color = statusColor("wontfix", DEFECTS_SCHEMA);
    expect(color).toBe("gray");
    expect(color).not.toBe("green");
  });

  it("root-caused color is blueBright (distinct from yellow/progress and green/done)", () => {
    const color = statusColor("root-caused", DEFECTS_SCHEMA);
    expect(color).toBe("blueBright");
    expect(color).not.toBe("yellow");
    expect(color).not.toBe("green");
  });

  it("inconclusive color is magenta (warning)", () => {
    expect(statusColor("inconclusive", DEFECTS_SCHEMA)).toBe("magenta");
  });

  it("open → start bucket; wip → progress bucket; resolved → done bucket", () => {
    expect(statusBucket("open", DEFECTS_SCHEMA)).toBe("start");
    expect(statusBucket("wip", DEFECTS_SCHEMA)).toBe("progress");
    expect(statusBucket("resolved", DEFECTS_SCHEMA)).toBe("done");
  });
});


// ANSI magenta = [35m; green = [32m.  Force chalk.level=1 so ink
// emits escape codes even in a non-TTY test runner.
const ANSI_MAGENTA = "[35m";
const ANSI_GREEN = "[32m";

describe("ink badge color (warning bucket → magenta)", () => {
  let prevLevel: number;
  beforeAll(() => {
    prevLevel = (chalk as { level: number }).level;
    (chalk as { level: number }).level = 1;
  });
  afterAll(() => {
    (chalk as { level: number }).level = prevLevel;
  });

  it("renders revise badge in magenta (ANSI 35)", () => {
    const color = statusColor("revise", REVIEWS_SCHEMA); // "magenta"
    const r = render(<Text color={color}>revise</Text>);
    const frame = r.lastFrame() ?? "";
    r.unmount();
    expect(frame).toContain(ANSI_MAGENTA);
  });

  it("renders go-ahead badge in green (ANSI 32, unchanged)", () => {
    const color = statusColor("go-ahead", REVIEWS_SCHEMA); // "green"
    const r = render(<Text color={color}>go-ahead</Text>);
    const frame = r.lastFrame() ?? "";
    r.unmount();
    expect(frame).toContain(ANSI_GREEN);
  });
});
