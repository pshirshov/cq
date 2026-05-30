# noprogress-trigger — derive the no-progress guard from the ledger (WFL-D01)

Date: 2026-05-30. Worktree: `.claude/worktrees/noprogress-trigger` (branch
`noprogress-trigger` off `a35b4ed`). Single milestone M-NPG / one PR `npg-1`.

## Problem

The plan-review loop's WFL-D01 no-progress guard escalates when a revise round
produces a planner output whose in-memory STRUCTURAL FINGERPRINT
(`lastReviseFingerprint`) equals the prior round's AND the reviewer raised no
new questions. Two issues:

1. The fingerprint is in-memory; a server restart mid-loop loses it, so the
   first post-resume round can never be no-progress even if it should be (noted
   resume edge in WF-D02).
2. It compares the planner OUTPUT, decoupled from what actually landed in the
   ledger.

## Chosen trigger (user's formulation)

> A planning/revise round that produces NO LEDGER UPDATE — no new questions AND
> no net change to the goal's milestones/tasks — is declared no-progress.

Logically equivalent in the cases that matter (the planner revise uses
replace-semantics, so an identical plan is a no-op write) but derived from
DURABLE ledger state: simpler, restart-safe, generalizes to clarify.

## Design — detect from the ledger

`revisePlanWithGuard(goalId, …, findings)`:

1. **Before** persisting: snapshot `planArtifacts(goalId)` (milestone
   title/description + task headline/description/acceptance, grouped per
   milestone — read from the ledger) and `totalQuestionCount(goalId)`.
2. Dispatch the planner → `plan`.
3. `persistPlan(goalId, plan)` (replace-semantics).
4. **After**: snapshot the same two.
5. If the plan structure is unchanged (deep-equal of the two `planArtifacts`)
   AND the question count did not grow ⇒ no ledger update this round ⇒ emit the
   SAME `escalated` frame and STOP. Else re-review.

Why `planArtifacts`: it already reads the goal's CURRENT (referenced)
milestones+tasks from the ledger, so detached orphans from a prior replace do
not pollute the compare; an identical re-plan yields byte-identical artifacts
(K-NPG-2). The question-count delta is structurally zero on the revise path
(that branch is only reached when the reviewer returned zero new questions) but
is captured for correctness and to make the predicate uniform with clarify.

### Removals

- `lastReviseFingerprint: Map<string,string>` field.
- `fingerprintPlan(plan)` method.
- All 4 mutation sites: `runPlanner` reset, `revisePlanWithGuard` set,
  `runPlanReview` satisfied/newQuestions resets, `submitEscalationReply`
  proceed/abandon/guidance clears. (The guidance "clear the fingerprint"
  comment + delete become unnecessary — a guided round that writes a changed
  plan is naturally not no-progress.)

### Clarify generalization (minimal)

Today `runClarifyReview`: `if (!out.clear || out.newQuestions.length > 0)` →
write the new questions, emit `questions_ready`, return. The degenerate output
`clear:false` + `newQuestions:[]` writes ZERO questions then emits
`questions_ready` with "0 more questions" and the goal sits in `clarifying`
with no open questions forever (a stall: `derivePosition` → `awaiting_answers`,
nothing to answer). That round produced no ledger update → escalate. Add a
guard: when the clarify-reviewer is not-clear AND wrote no new questions,
escalate with the same frame instead of emitting an empty `questions_ready`.

This is reachable (the schema permits `clear:false, newQuestions:[]`), so it is
handled, not documented-as-unreachable.

## Tests (in `workflow-loops.test.ts`)

- **would-spin → escalate (ledger-diff path)**: existing test, sticky identical
  plan + never-satisfied reviewer → `escalated`, loop stops, goal stays
  `planning`, planner bounded. Keep, it now exercises the ledger-diff trigger.
- **revise that writes something → no escalate**: sticky reviewer unsatisfied,
  planner returns a DIFFERENT plan each round for ≥3 rounds, then satisfied →
  never escalates, reaches `planned` (no-cap preserved / churning planner).
- **resume after escalation edge**: drive to one revise round, drop+recreate
  the runtime, then a no-progress round after resume STILL escalates (the
  concrete win — fingerprint-loss edge gone).
- **clarify degenerate**: clarify-reviewer `clear:false, newQuestions:[]` →
  `escalated`, goal not stuck.
- Existing escalation_reply tests (`workflow-goals.test.ts`
  proceed/guidance/abandon, blank-text, terminal no-op) + resume-reconcile
  tests stay green unchanged.

## Discharge

- `bun run check` ×2 (determinism), baseline 986/0.
- `bun run e2e` ≥2× (don't regress WFL-D02 ordering / LOCK-D01 / Codex relay /
  continuation). Target 25/25.
- `nix build .#default` exit 0.
- `defects.md` WFL-D01 updated: trigger is now "no ledger update in a round"
  (durable, restart-safe); fingerprint removed; escalation unchanged.

## Adversarial focus

1. ledger-diff correctness — a no-op revise truly produces no `planArtifacts`
   change (verify replace-semantics) and a real change is always detected.
2. first plan never false-triggers (initial plan from empty ⇒ change).
3. fingerprint removal genuinely fixes the resume edge (test it).
4. churning planner (different plan each round) never escalates (no cap).
5. escalation behavior byte-identical from the user's POV.
