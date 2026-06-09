/**
 * plan-reviewer role schema sidecar (T341, goal G41) — generalising the T336
 * one-role proof (plan-advance) across the dispatched-subagent roster
 * (storage-format decision 3: per-role typed sidecar co-located under
 * `./schemas/`, not embedded in the prose `## Catalogue` block).
 *
 * Authored DIRECTLY from `cq-assets/agents/plan-reviewer.md` — its `## Catalogue`
 * block:
 *
 * - **Input** — a goal id `G`. The reviewer reads the goal fields, the Q&A
 *   history, the emitted plan, and prior reviews itself via the ledger MCP tools,
 *   so they are not part of the parent-supplied input contract; the parent
 *   supplies only the goal id.
 *
 * - **Output** — the canonical verdict json (shared `/cq:plan-review` shape):
 *   `{ summary, verdict, new_questions[], criticism[], defects[] }` where
 *   `verdict` is `go-ahead | revise`, `new_questions`/`criticism` are `string[]`,
 *   and each `defects` item is `{ headline, severity, rootCause?, suggestedFix? }`.
 */

import type { RoleSchemaSidecar } from "../promptCatalog.js";

/** The two plan-review verdict tokens, in the asset's order. */
export const PLAN_REVIEW_VERDICTS = ["go-ahead", "revise"] as const;

/** The `defects`-ledger severity vocabulary a reported defect carries. */
const DEFECT_SEVERITIES = ["low", "medium", "high", "critical"] as const;

/**
 * The parent-supplied input contract for a plan-reviewer dispatch: the goal id.
 * `goalId` matches the ledger goal-id token shape (`G` followed by digits).
 */
const inputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "cq:prompt-catalog/plan-reviewer/input",
  title: "plan-reviewer input",
  type: "object",
  properties: {
    goalId: {
      type: "string",
      description: "The goal id G passed in the dispatch prompt (e.g. G41).",
      pattern: "^G[0-9]+$",
    },
  },
  required: ["goalId"],
  additionalProperties: false,
} as const;

/**
 * A reported out-of-scope / pre-existing defect — the `defects`-ledger vocabulary
 * the reviewer returns for file-and-defer. `severity` is REQUIRED (it is a
 * required field on `defects` items); `rootCause`/`suggestedFix` are optional.
 */
const defectSchema = {
  type: "object",
  properties: {
    headline: { type: "string", minLength: 1 },
    severity: { type: "string", enum: [...DEFECT_SEVERITIES] },
    rootCause: { type: "string" },
    suggestedFix: { type: "string" },
  },
  required: ["headline", "severity"],
  additionalProperties: false,
} as const;

/**
 * The canonical verdict-json output contract (shared `/cq:plan-review` shape).
 * `new_questions`/`criticism` are user-only-gap / planner-fixable string lists;
 * `defects` is orthogonal to the verdict (out-of-scope faults to file-and-defer).
 */
const outputSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "cq:prompt-catalog/plan-reviewer/output",
  title: "plan-reviewer verdict",
  type: "object",
  properties: {
    summary: { type: "string" },
    verdict: { type: "string", enum: [...PLAN_REVIEW_VERDICTS] },
    new_questions: { type: "array", items: { type: "string" } },
    criticism: { type: "array", items: { type: "string" } },
    defects: { type: "array", items: defectSchema },
  },
  required: ["summary", "verdict", "new_questions", "criticism", "defects"],
  additionalProperties: false,
} as const;

/** The plan-reviewer per-role schema sidecar (storage-format decision 3). */
export const planReviewerSidecar: RoleSchemaSidecar = {
  id: "plan-reviewer",
  version: 1,
  inputSchema,
  outputSchema,
};
