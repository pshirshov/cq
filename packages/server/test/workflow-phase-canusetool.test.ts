/**
 * PLAN-D01 — the headless phase-subagent tool gate + explore-first prompts.
 *
 * Proves the read-but-not-write contract: every Claude phase subagent (producer
 * + clarify-reviewer + planner + plan-reviewer + continuation) may now READ the
 * repo via Read/Grep/Glob to ground its output, may call its own `submit_*`
 * tool, and may do NOTHING ELSE — every write/exec tool (Edit/Write/Bash/
 * NotebookEdit) and any unknown tool is DENIED, preserving the
 * harness-owns-all-writes guarantee. Also asserts each phase prompt builder
 * carries the explore-first instruction (the Codex lane inherits it because it
 * uses the same shared builders).
 */

import { describe, it, expect } from "bun:test";
import {
  makePhaseCanUseTool,
  PHASE_READONLY_TOOLS,
  EXPLORE_FIRST_INSTRUCTION,
  buildProducerPrompt,
  buildClarifyReviewPrompt,
  buildPlannerPrompt,
  buildPlanReviewPrompt,
  buildContinuationPrompt,
  buildContinuationPlannerPrompt,
} from "../src/workflow/index";

const SUBMIT = "mcp__wf__submit_plan";

describe("PLAN-D01 — phase canUseTool read-but-not-write gate", () => {
  it("ALLOWS the read-only exploration built-ins (Read/Grep/Glob)", async () => {
    const gate = makePhaseCanUseTool(SUBMIT);
    for (const tool of PHASE_READONLY_TOOLS) {
      const r = await gate(tool);
      expect(r.behavior).toBe("allow");
      // Allowed tools carry an empty updatedInput (SDK contract).
      if (r.behavior === "allow") expect(r.updatedInput).toEqual({});
    }
    // Pin the exact allow-set so a future widening is a conscious change.
    expect([...PHASE_READONLY_TOOLS]).toEqual(["Read", "Grep", "Glob"]);
  });

  it("ALLOWS the phase's own fully-qualified submit tool", async () => {
    const gate = makePhaseCanUseTool(SUBMIT);
    const r = await gate(SUBMIT);
    expect(r.behavior).toBe("allow");
  });

  it("DENIES every write/exec tool (Edit/Write/Bash/NotebookEdit)", async () => {
    const gate = makePhaseCanUseTool(SUBMIT);
    for (const tool of ["Edit", "Write", "Bash", "NotebookEdit", "MultiEdit"]) {
      const r = await gate(tool);
      expect(r.behavior).toBe("deny");
    }
  });

  it("DENIES ledger-mutation MCP tools and any unknown tool", async () => {
    const gate = makePhaseCanUseTool(SUBMIT);
    for (const tool of [
      "mcp__ledger__create_item",
      "mcp__ledger__update_item",
      "mcp__wf__some_other_tool",
      "WebFetch",
      "totally_unknown_tool",
    ]) {
      const r = await gate(tool);
      expect(r.behavior).toBe("deny");
    }
  });

  it("the deny set is the COMPLEMENT of {readonly ∪ submit} — no write tool leaks", async () => {
    // A distinct fq submit name proves only THIS phase's submit tool is allowed.
    const gate = makePhaseCanUseTool("mcp__wf__submit_plan_review");
    expect((await gate("mcp__wf__submit_plan_review")).behavior).toBe("allow");
    expect((await gate("Read")).behavior).toBe("allow");
    // The phase-1 producer's submit tool is NOT this phase's — denied.
    expect((await gate("mcp__wf__submit_plan")).behavior).toBe("deny");
    expect((await gate("Edit")).behavior).toBe("deny");
  });
});

describe("PLAN-D01 — explore-first instruction is present on every phase prompt", () => {
  const qna = [{ question: "Q?", answer: "A" }];
  const plan = {
    milestones: [{ title: "M", description: "d" }],
    tasks: [{ milestone: "M", headline: "T", description: "d" }],
  };

  it("the shared constant names the repo-grounding sources and forbids discoverable questions", () => {
    expect(EXPLORE_FIRST_INSTRUCTION).toContain("EXPLORE this repository");
    expect(EXPLORE_FIRST_INSTRUCTION).toContain("CLAUDE.md");
    expect(EXPLORE_FIRST_INSTRUCTION).toContain("docs/");
    expect(EXPLORE_FIRST_INSTRUCTION).toContain("Do NOT ask clarifying questions whose answers are discoverable");
  });

  it("buildProducerPrompt includes the explore-first instruction", () => {
    expect(buildProducerPrompt("ship a feature")).toContain(EXPLORE_FIRST_INSTRUCTION);
  });

  it("buildClarifyReviewPrompt includes the explore-first instruction", () => {
    expect(buildClarifyReviewPrompt("goal", qna)).toContain(EXPLORE_FIRST_INSTRUCTION);
  });

  it("buildPlannerPrompt includes the explore-first instruction", () => {
    expect(buildPlannerPrompt("goal", qna)).toContain(EXPLORE_FIRST_INSTRUCTION);
  });

  it("buildPlanReviewPrompt includes the explore-first instruction", () => {
    expect(buildPlanReviewPrompt("goal", qna, plan, [])).toContain(EXPLORE_FIRST_INSTRUCTION);
  });

  it("buildContinuationPrompt includes the explore-first instruction", () => {
    expect(buildContinuationPrompt("goal", ["M1"], qna, "new feature")).toContain(EXPLORE_FIRST_INSTRUCTION);
  });

  it("buildContinuationPlannerPrompt includes the explore-first instruction", () => {
    expect(buildContinuationPlannerPrompt("goal", plan, qna)).toContain(EXPLORE_FIRST_INSTRUCTION);
  });
});
