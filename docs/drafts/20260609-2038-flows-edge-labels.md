# Proposed final edge-label set for ROLE_FLOWS parallel edges (T334)

This document records the proposed final label texts for parallel (same-pair)
edges in the four ROLE_FLOWS diagrams, for user review before any label edits
are committed to `roleActions.ts`.

## Background

T334 confirmed the rendering defect: parallel edges between the same node pair
(e.g., three `orchestrator→worktree` edges in the implement flow) received the
same `data-testid`, making their labels individually inaccessible to tests and
potentially hard to distinguish visually when rendered close together.

The fix applied in T334:
- Changed the DiagramSvg edge-label `data-testid` from
  `${idPrefix}-edge-label-${from}-${to}` to
  `${idPrefix}-edge-label-${from}-${to}-${i}` (global edge-array index), so
  every parallel edge label is uniquely addressable.
- Added layout tests (distinct labelPos, ≥14 px y-separation) and render tests
  (index-suffixed testids, distinct text content) to the test suite.
- ELK already routes parallel edges to distinct y positions (~30 px apart),
  which exceeds the 14 px threshold; no layout changes were required.

## Audit: current labels vs. proposed labels

Verification was done against `commands/cq/implement/advance.md` (the canonical
implement-flow spec). The column "current label" is what is in `roleActions.ts`
today; "proposed label" is what better names the distinct trigger/action.

### Implement flow — `orchestrator→worktree` (3 parallel edges)

| # | Current label | Proposed label | Verified against advance.md |
|---|--------------|----------------|----------------------------|
| 0 | creates worktree | creates worktree | §1 start-of-pass sweep creates per-task worktree (§2 dispatch) |
| 1 | rebases branch | rebases branch (merge-back) | §7.1 rebase branch onto current base before merge |
| 2 | tears down / prunes worktree | tears down + prunes worktree | §7.3 explicit teardown + prune after done write |

**Verdict**: current labels are sufficiently distinct and accurately describe
separate operations. No change required.

### Implement flow — `orchestrator→worker` (2 parallel edges)

| # | Current label | Proposed label | Verified |
|---|--------------|----------------|---------|
| 0 | dispatches worker | dispatches worker | §2 initial worker dispatch |
| 1 | re-dispatches (criticism) | re-dispatches worker (criticism) | §4 criticism-loop re-dispatch |

**Verdict**: current labels are distinct. The proposed label makes the subject
("worker") explicit in the second edge. Minor optional improvement.

### Implement flow — `orchestrator→ledger` (1 edge, no parallel)

Current: "commits ledger (per task)" — maps to §7.5 per-task ledger commit.

The task description referenced a hypothetical second orchestrator→ledger edge
("create milestone" vs "update item status / append scope"). Reviewing
advance.md: the orchestrator creates/updates ledger items via MCP tool calls
(not a separate edge in the role diagram) — these are in-session MCP calls, not
distinct message flows. The ledger edge correctly represents only the git commit
checkpoint (§7.5), not individual MCP writes. **No second edge needed.**

### Plan flow — `orchestrator→ledger` (2 parallel edges)

| # | Current label | Proposed label | Verified |
|---|--------------|----------------|---------|
| 0 | locks plan (planned) | locks plan (planned) | `update_milestone` to `planned` + any immediate commit |
| 1 | commits ledger (per round) | commits ledger (per round) | per-round ledger commit in plan-flow advance |

**Verdict**: current labels are distinct. No change required.

### Plan flow — `orchestrator→planner` (2 parallel edges)

| # | Current label | Proposed label | Verified |
|---|--------------|----------------|---------|
| 0 | dispatches planner | dispatches planner | initial planner dispatch |
| 1 | re-dispatches (criticism) | re-dispatches planner (criticism) | critic-loop re-dispatch |

**Verdict**: making the subject explicit ("planner") is a minor improvement.

### Investigate flow — `orchestrator→explore` (2 parallel edges)

| # | Current label | Proposed label | Verified |
|---|--------------|----------------|---------|
| 0 | dispatches explorer | dispatches explorer | initial explorer dispatch |
| 1 | re-dispatches (new lead) | re-dispatches explorer (new lead) | new-lead re-dispatch |

**Verdict**: same minor "subject explicit" improvement.

### Investigate flow — `orchestrator→worktree` (2 parallel edges)

| # | Current label | Proposed label | Verified |
|---|--------------|----------------|---------|
| 0 | creates probe worktree | creates probe worktree | probe worktree creation |
| 1 | tears down / prunes worktree | tears down / prunes probe worktree | teardown after probe harvest |

**Verdict**: adding "probe" to the teardown label is a minor improvement for
clarity (distinguishes it from the implement-flow's worktree teardown).

## Summary of proposed changes

All parallel-edge labels are already distinct in meaning (acceptance criterion 3
passes without data changes). The following OPTIONAL minor improvements are
proposed for future label refinement:

1. In plan, implement, investigate flows: append the subject ("planner",
   "worker", "explorer") to the `re-dispatches (criticism/new lead)` labels, e.g.
   "re-dispatches worker (criticism)" — makes the actor explicit in the label.
2. In investigate flow: append "probe" to the worktree teardown label —
   "tears down / prunes probe worktree" — to distinguish it from the
   implement-flow teardown.

These are cosmetic improvements for diagram readability and are OPTIONAL — they
are not required for the T334 defect fix (which is the testid uniqueness + tests).

## What T334 delivered

- `DiagramSvg.tsx`: label testid now includes global edge index `i`, making
  every parallel-edge label individually addressable.
- `test/parallelEdgeLabels.test.ts`: seven new tests covering data invariants
  (non-empty labels, distinct parallel-edge labels), layout invariants (defined
  and non-coincident labelPos, ≥14 px y-separation), and render invariants
  (index-suffixed testids, distinct texts).
- `test/diagramLayout.test.ts` + `test/flowsTab.test.tsx`: updated to use the
  new index-suffixed label testid scheme.
