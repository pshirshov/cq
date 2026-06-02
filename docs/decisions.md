---
ledger: decisions
counters:
  milestone: 0
  item: 12
archives:
  - id: M2
    path: ./archive/decisions/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
  - id: M3
    path: ./archive/decisions/M3.md
    summary: Build /implement:* command family (goal G1) — complete. Decision K4 (model tiers + dual worktree strategy); implement-worker/-reviewer/-conflict-resolver agents (T5–T7); /implement:start + /implement:advance (T8/T9); plan-advance sets suggestedModel (T11); cross-flow session-log convention (T15); wiring (T10); end-to-end dogfood (T12, defect D2 resolved). Shipped on main (commit 4f430b3).
  - id: M4
    path: ./archive/decisions/M4.md
    summary: Plan-flow maintenance — complete. Subagent MCP tool access made server-name-independent via denylist (T13); /plan:follow-up command + goal re-open transitions, decision K5 (T25); /plan:advance with no argument advances all unlocked goals (T14). Shipped on main (commits 4f430b3, 67727e9).
---

# decisions

## M1

### K3 — locked

- createdAt: 2026-06-01T20:20:17.613Z
- updatedAt: 2026-06-01T20:20:17.613Z
- author: "opus-4.8[1m]"
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- headline: "plan review: approved"
- rationale: "Reviewer go-ahead (ref review R1) with empty new_questions; criticism folded into tasks T4/T5/T6/T9. Plan for /implement:* command family is approved."
- ledgerRefs: ["goals:G1"]

### K6 — locked

- createdAt: 2026-06-01T23:24:31.385Z
- updatedAt: 2026-06-01T23:24:31.385Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "plan review: approved"
- rationale: Reviewer go-ahead (ref review R4) with 0 criticisms and 0 new questions for the follow-up plan (work milestone M6, tasks T26-T34). R3 revise criticism on T26/T27/T34 was folded into the tasks; R4 confirms clean.
- ledgerRefs: ["goals:G1"]

### K7 — locked

- createdAt: 2026-06-01T23:46:42.519Z
- updatedAt: 2026-06-01T23:46:42.519Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "plan review: approved"
- rationale: "Reviewer go-ahead (review R6): 0 criticisms, 0 new questions for the #2-follow-up plan (work milestones M7/M8/M9, tasks T35-T49). Plan approved; goal advances to planned."
- ledgerRefs: ["goals:G1"]

### K8 — locked

- createdAt: 2026-06-02T06:06:47.366Z
- updatedAt: 2026-06-02T06:06:47.366Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "investigate:* architecture lock (T35) — hypothesis-ledger tree, command-owned loop, file-and-defer handoff, defect-seeded clarify-skip"
- rationale: |
    Design lock the M7 prompt tasks (T36-T39) and the T41 planner edit cite. Five points:
    
    (1) THE TREE = the `hypothesis` ledger. Each node is a hypothesis item; `parentHypothesis` encodes ancestry; `evidence[]` holds validated citations, each prefixed `[correct]`/`[incorrect]` (research-loop E-item convention); `status` is open|uncertain|confirmed|wrong; each node `ledgerRefs` its defect `defects:<D>`.
    
    (2) LOOP OWNER = the `/investigate:advance` COMMAND body (subagents cannot spawn subagents). `investigate-explorer` is a READ-ONLY evidence-gatherer (no ledger writes, no adjudication). No separate reviewer subagent — the command adjudicates.
    
    (3) HANDOFF = FILE-AND-DEFER, never an inline plan loop (resolves R5 #1). On a confirmed root cause, /investigate:advance: (a) writes `defects.rootCause` + `suggestedFix`; (b) creates OR extends a plan-flow goal SEEDED from the defect — the goal description embeds the confirmed root cause + suggestedFix and a `ledgerRefs:[defects:<D>]` link; (c) files an `open` question / report line telling the user to run `/plan:advance <G>`, and STOPS. It MUST NOT re-implement or invoke the planner<->plan-reviewer loop (a command cannot run another command's loop; inline duplication contradicts the file-and-defer principle, Q26).
    
    (4) DEFECT-SEEDED CLARIFY-SKIP (resolves R5 #2). /plan:start and /plan:follow-up normally re-open a goal to `clarifying`. A defect-seeded goal (carries a `defects:<D>` ledgerRef + an embedded confirmed root cause) proceeds STRAIGHT to planning: the seeding writes the confirmed root cause + suggestedFix so plan-advance has nothing left to clarify, and the planner prompt (T41) explicitly permits skipping the clarifying round when a goal is defect-seeded. `defect-seeded` is the grep-able token.
    
    (5) EXPLORER CONCURRENCY = parallel ONLY when seeding disjoint top-level hypotheses; serial while drilling a single branch (Q27).
- alternatives: "Inline plan loop inside /investigate:advance (rejected: a command cannot run another command's loop; duplicates plan-flow; contradicts file-and-defer). Re-clarifying the defect-seeded goal (rejected: root cause already confirmed; wastes a round — R5 #2). A dedicated investigate-reviewer subagent (rejected: the command adjudicates citations itself, mirroring how plan/implement keep the loop in the command)."
- ledgerRefs: ["goals:G1"]
- tags: ["investigate-flow","design-lock","follow-up-2"]

## M10

### K9 — locked

- createdAt: 2026-06-02T08:57:27.196Z
- updatedAt: 2026-06-02T08:57:27.196Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "plan review: approved"
- rationale: "Reviewer go-ahead (ref review R30): plan T50-T68 across work milestones M12/M13/M14 covers all 8 in-scope items, is fine-grained, correctly sequenced, testable, and grounded against source; all three R29 under-specifications resolved; no new defects."
- ledgerRefs: ["goals:G2"]

### K11 — locked

- createdAt: 2026-06-02T10:40:40.861Z
- updatedAt: 2026-06-02T10:40:40.861Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "plan review: approved"
- rationale: Reviewer go-ahead on the G2 follow-up plan (M18/M19 tasks T79-T89), 0 criticisms / 0 new questions / no out-of-scope defects; ref review R33 (original M12/M13/M14 scope already approved under R30/K9).
- ledgerRefs: ["goals:G2"]

## M15

### K10 — locked

- createdAt: 2026-06-02T10:23:13.487Z
- updatedAt: 2026-06-02T10:23:13.487Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "plan review: approved"
- rationale: "Plan-reviewer go-ahead (ref review R32, 0 criticisms beyond confirmation, 0 new_questions, empty defects[] bucket): revised plan T69-T78 across work milestones M16/M17 resolves all 5 R31 criticisms; Change A auto-investigate loop proven convergent via operationally-checkable stop predicates, Change B never-auto-close-goal sound. Approving G3 to planned."
- ledgerRefs: ["goals:G3"]

### K12 — locked

- createdAt: 2026-06-02T10:43:44.346Z
- updatedAt: 2026-06-02T10:43:44.346Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Auto-investigate from plan:* — supersede K8 point 3's handoff DIRECTION only (K8 pts 1,2,4,5 stay in force)"
- rationale: |
    Implements goal G3 Change A (T72). SUPERSEDES K8 point 3 by REFINING ITS DIRECTION ONLY; it does NOT amend K8 in place (K8 stays locked, immutable history).
    
    (1) SCOPE OF SUPERSESSION. K8 points 1, 2, 4, and 5 REMAIN IN FORCE UNCHANGED. This decision refines ONLY point 3's handoff-direction asymmetry. K8 point 3 forbade /investigate:advance running the PLAN loop inline — that prohibition STILL STANDS (investigate still hands back to the user via file-and-defer; NOT reversed). The NEW direction is the symmetric one: a /plan:* COMMAND, after completing its own primary planning work, MAY run /investigate:advance inline in the same main session. This is legal because a COMMAND does the chaining; a SUBAGENT still cannot (subagents-cannot-spawn-subagents is preserved). K8 POINT 4 (defect-seeded clarify-skip) MUST remain in force — the auto-resume path depends on it.
    
    (2) RULE (Q42). All defects — user-reported AND auto-found by the plan-reviewer — are FILED; the plan:* orchestrator then auto-launches /investigate:advance itself after its primary work, always when possible, REPLACING the prior 'file an open question telling the user to run /investigate:start' manual step.
    
    (3) TRIGGER SITES (Q43). The trigger lives in the plan:* COMMAND orchestrators (plan/advance.md, plan/start.md, plan/follow-up.md). The plan-advance / plan-reviewer SUBAGENTS only file/flag defects — they never spawn subagents and never run /investigate:advance. implement:* does NOT auto-launch investigate (its primary work is execution, not planning); its filed defects are picked up by the next plan:* auto-investigate or a user /investigate:start.
    
    (4) STOP BOUNDARY (Q44). NO hard iteration caps. Removes plan/advance.md's 4-iteration cap and implement/advance.md's 8-round safety ceiling. The orchestrator uses MODEL-JUDGED ill-loop detection with CONCRETE, operationally-pinned termination predicates for the cross-command auto-investigate<->replan chain (enumerated in T74: once-per-defect-per-round; no-relaunch-without-new-confirmed/[correct]-evidence; stop+report once a confirmed root cause seeded/extended its goal; park on a non-converging open->investigated->replanned->open cycle; park on two consecutive no-adjudicable-evidence rounds). When any holds, the orchestrator STOPS auto-relaunching and files an `open` questions item to the user. The defect-seeded goal is NOT auto-resumed while it is parked in `clarifying` on user questions (filed defects are orthogonal to goal clarification).
- alternatives: Narrow hybrid (auto only reviewer-found in-plan defects; user-reported still manual) — rejected by Q42 (broad auto-launch, file all). Keep hard caps as defense-in-depth — rejected by Q44 (model-judged ill-loop detection only). Amend K8 in place — rejected by Q45 (supersede, keep K8 immutable).
- supersedes: ["K8"]
- ledgerRefs: ["goals:G3","decisions:K8"]
- tags: ["plan-flow","investigate-flow","auto-investigate","supersedes-K8","follow-up-G3"]
