---
ledger: milestones
counters:
  milestone: 0
  item: 23
archives:
  - id: M5
    path: ./archive/milestones/M5.md
    summary: "Dogfood complete: T24 driven to done through the real implement-flow loop (manual worktree (K4 Codex path) -> implement-worker created+committed the marker -> bun run check green in worktree (379 pass) -> implement-reviewer approved 0/0 -> ff merge-back into throwaway dogfood/base). Throwaway branches deleted; nothing landed on main. Two setup findings recorded as defects under goals:G1."
  - id: M2
    path: ./archive/milestones/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
  - id: M3
    path: ./archive/milestones/M3.md
    summary: Build /implement:* command family (goal G1) — complete. Decision K4 (model tiers + dual worktree strategy); implement-worker/-reviewer/-conflict-resolver agents (T5–T7); /implement:start + /implement:advance (T8/T9); plan-advance sets suggestedModel (T11); cross-flow session-log convention (T15); wiring (T10); end-to-end dogfood (T12, defect D2 resolved). Shipped on main (commit 4f430b3).
  - id: M4
    path: ./archive/milestones/M4.md
    summary: Plan-flow maintenance — complete. Subagent MCP tool access made server-name-independent via denylist (T13); /plan:follow-up command + goal re-open transitions, decision K5 (T25); /plan:advance with no argument advances all unlocked goals (T14). Shipped on main (commits 4f430b3, 67727e9).
  - id: M6
    path: ./archive/milestones/M6.md
    summary: UI/schema follow-up (G1) — COMPLETE. reviews `summary` field (T26); summarize() legacy fallback + badge/cell nowrap-ellipsis both UIs (T27); summary threaded through reviewer prompts + implement:advance recorder (T28); fetchLedgerArchive client web+TUI (T29); web subsections + milestone dropdown (T30); TUI column table + subsections (T31); web (T32) + TUI (T33) read-only archive views; integration gate + cross-cutting regression (T34). Tasks T26-T34; reviews R7/R8/R11/R12/R14/R15/R16/R17/R22. Shipped on main; final check 483 pass.
  - id: M7
    path: ./archive/milestones/M7.md
    summary: "investigate:* flow assets (G1 #2) — COMPLETE. Design lock K8 (T35); investigate-explorer read-only evidence-gatherer (T36); /investigate:advance DFS/adjudication loop with file-and-defer handoff + defect-seeded clarify-skip (T37); /investigate:start intake + inline advance (T38, round-1 fixed phantom-subagent); LINKS wiring (T39). Tasks T35-T39; reviews R9/R13/R18/R19. Shipped on main; all investigate:* symlinks resolve; final check 483 pass."
  - id: M8
    path: ./archive/milestones/M8.md
    summary: "defect-awareness in plan:*/implement:* prompts (G1 #2) — COMPLETE. plan-reviewer defects[] bucket (T40); implement-reviewer defects[] JSON (T42); plan-flow defect-aware planning + bidirectional linkage + reviewer-defects file-and-defer + defect-seeded clarify-skip (T41); implement/advance files reviewer defects + orchestrator-owned closure on merge-back (T43); cross-prompt 6-grep-invariant audit (T44). Tasks T40-T44; reviews R23/R24/R25/R26/R27. Shipped on main. Closed loop defect->investigate->plan->implement->resolve confirmed."
  - id: M9
    path: ./archive/milestones/M9.md
    summary: "defect/hypothesis relationship views (G1 #2, Q28 Full) — COMPLETE. Schema-sufficiency spike, no @cq/ledger change (T45); pure shared helpers defectFixTaskIds + hypothesisRelationships (T46); web detail-panel relationship views via ./relationships subpath (T47); TUI content-pane views (T48); cross-UI single-source regression + full-suite gate (T49). Tasks T45-T49; reviews R10/R20/R21/R28. Shipped on main; final check 483 pass."
  - id: M12
    path: ./archive/milestones/M12.md
    summary: G2-W1 shared status→color foundation — COMPLETE. 'warning' StatusBucket + WARNING={revise} (T50, mirror both status.ts); TUI warning=magenta (T51); web canonical BUCKET_HEX single source as --lw-status-* vars, warning=#e0a341 (T52); DagView nodes via shared BUCKET_HEX[statusBucket(status,schema)] (T53). Tasks T50-T53; reviews R34/R40/R43/R44.
  - id: M13
    path: ./archive/milestones/M13.md
    summary: G2-W2 Questions UX — COMPLETE. parseFieldValue string[] on ;/newline, id[] keeps comma (T54); normalizeSuggestions helper+script idempotent (T55, live data-run DEFERRED — run with MCP quiesced + restart); web (T56)+TUI (T57) suggestions bulleted list; web (T58)+TUI (T59) question field order milestone,status,by,question,context,suggestions,recommendation,answer. Tasks T54-T59; reviews R35/R39/R46/R50/R51/R53.
  - id: M16
    path: ./archive/milestones/M16.md
    summary: G3-B never auto-close goals — COMPLETE. implement/advance.md hard rule 'never auto-transition goal building→done' + ready-to-close report, milestone auto-archive preserved (T69); authoritative invariant once in plan-advance.md, building→done stays legal user-driven (T70); verify gate green (T71). Tasks T69-T71; reviews R36/R45/R55.
  - id: M17
    path: ./archive/milestones/M17.md
    summary: G3-A auto-investigate from plan:* — COMPLETE. K12 supersedes K8 pt3 (pins pts1/2/4/5; plan:* commands auto-launch /investigate:advance inline) (T72); plan-advance.md file-only defects (T73); plan/advance.md auto-investigate phase + enumerated convergent stop predicates replacing 4-iter cap (T74); plan/start+follow-up conditional auto-investigate (T75); implement/advance.md 8-round ceiling removed (T76); cross-flow wording reconciled (T77); verify gate (T78). Tasks T72-T78; reviews R37/R38/R48/R49/R52/R56.
  - id: M19
    path: ./archive/milestones/M19.md
    summary: "G2 follow-up #14-#15 — COMPLETE. Web per-suggestion 'pick' button (T86); TUI keys 1-9 pick Nth suggestion (T87); web disable as-recommended+pick on non-whitespace answer, detail+batch (T88); TUI r/1-9 inert + batch Ctrl+R when persisted answer non-empty (T89). Tasks T86-T89; reviews R69-R72. Integration 623 pass."
---

# milestones

## active

### M-AMBIENT — open

- createdAt: 2026-06-01T19:15:33.341Z
- updatedAt: 2026-06-01T19:15:33.341Z
- title: ambient

### M1 — open

- createdAt: 2026-06-01T19:24:22.101Z
- updatedAt: 2026-06-01T19:24:22.101Z
- title: "Plan: /implement:* command family"
- description: "Coordination milestone for the goal of building the /implement:* command family (start/advance) that executes the planned roadmap: DAG-ordered task pickup, per-task worktree + implementor subagent, reviewer subagent gate, autonomous criticism loop, and user-answered questions. Groups the goal, its clarifying questions, reviews, and final approval decision. Work tasks live under separate work milestones recorded on the goal's fields.milestones."

### M10 — open

- createdAt: 2026-06-02T08:26:54.034Z
- updatedAt: 2026-06-02T08:26:54.034Z
- title: "Plan: ledger-suite UI/schema enhancements (columns, batch-answer, colors)"
- description: "Coordination milestone for goal G2: UI/schema enhancements for the ledger-suite frontends (TUI + web) — a follow-on to the completed G1. Groups the goal, its clarifying questions, reviews, and final approval decision. Work tasks live under separate work milestones recorded on the goal's fields.milestones during planning."

### M11 — open

- createdAt: 2026-06-02T08:36:51.936Z
- updatedAt: 2026-06-02T08:36:51.936Z
- title: "Investigate: mcp-fails-uninitialized-ledger"
- description: "Coordination milestone for investigating defect: @cq/ledger-mcp fails to connect when started in a directory with no initialized ledger; should auto-init the canonical ledger set instead. Holds the defect, its hypothesis tree, and any clarifying questions."

### M14 — open

- createdAt: 2026-06-02T08:45:57.789Z
- updatedAt: 2026-06-02T08:46:05.126Z
- title: "G2-W3: Column selector, batch-answer mode, project title"
- description: Work milestone for goal G2 items #1 (per-ledger column selector), #5 (batch answer mode in both UIs), and #7 (project dir name in title). #5 depends on W2's suggestions-list rendering. Tracked under goal G2 (milestone M10).
- dependsOn: ["M12","M13"]

### M15 — open

- createdAt: 2026-06-02T09:11:53.285Z
- updatedAt: 2026-06-02T09:11:53.285Z
- title: "Plan: plan/implement flow-behavior changes (auto-investigate + never auto-close goals)"
- description: "Coordination milestone for goal G3: prompt-suite behavior changes to the plan:*/implement:*/investigate:* command flows — (A) make plan:* investigate defects automatically (revisit K8 file-and-defer) and (B) forbid the orchestrator from auto-closing a goal. Groups the goal, its clarifying questions, reviews, and the final approval decision. Work tasks live under separate work milestones recorded on the goal's fields.milestones during planning."

### M18 — open

- createdAt: 2026-06-02T10:35:22.381Z
- updatedAt: 2026-06-02T10:35:22.381Z
- title: "G2 follow-up: web milestone-section rendering + column-width + goals flat-list + TUI nav-perf (#9-#13)"
- description: "Follow-up work milestone for goal G2, items #9-#13 (clarified by Q38-Q41, Q48-Q49). Web: #9 unify archived milestone-groups into the same collapsible subsection renderer + 'archived' badge (lazy-fetch on expand, drop the pointer-button path); #10 render milestone-section status as a badge in BOTH UIs from the shared M12 palette (depends on M12); #11 CSS column proportions (id/status hug content via colgroup width:1%+nowrap, summary flexes) across all web tables; #12 GOALS ledger as a FLAT list (no coordination subsections) showing fields.milestones as a milestones list, in BOTH UIs (user-deviated answer Q48); #13 TUI nav-perf fix (memoize visibleRows/maxIdW/maxStatusW/buildItemEntries). Depends on M12 (shared status palette/badge) and relates to M14 (column work T60-T62, render-path T62)."
- dependsOn: ["M12","M14"]

### M20 — open

- createdAt: 2026-06-02T11:26:47.033Z
- updatedAt: 2026-06-02T11:26:47.033Z
- title: "Plan: fix D2 — graceful backup-and-reinit on ledger schema divergence"
- description: "Coordination milestone for the defect-seeded goal G4: fix D2 (ledger-mcp aborts with BootstrapViolationError on schema divergence) by replacing the fatal throw in FsLedgerStore.init() with backup-and-reinit. Holds the goal, its reviews, and approval decision."

### M21 — open

- createdAt: 2026-06-02T16:16:13.958Z
- updatedAt: 2026-06-02T16:16:13.958Z
- title: "G2 follow-up #4: milestones-ledger archived rendering, routing-question retirement, batch-modal sizing"
- description: "Work milestone for G2 follow-up #4 (items 16-19). Items 16/17/19 are web-only (packages/ledger-web: App.tsx + styles.css); item 18 is prompt-suite markdown (llm/commands/*, llm/agents/*) plus a one-shot ledger-data cleanup, governed by locked decision K13. Items 16/17/19 all touch web App.tsx/styles.css (the App.tsx edits serialize); item 18 is disjoint. Repo gate: bun run check; web tests use happy-dom."
- dependsOn: ["M19"]

### M22 — open

- createdAt: 2026-06-02T16:30:45.859Z
- updatedAt: 2026-06-02T16:30:45.859Z
- title: "G4-W: D2 backup-and-reinit on ledger schema divergence"
- description: "Work milestone for G4 / defect D2. Replace the fatal BootstrapViolationError throw in FsLedgerStore.init() (the !schemasEqual branch at packages/ledger/src/store/FsLedgerStore.ts:283-289) with a graceful backup-and-reinit: back up the divergent on-disk ledger file(s) + docs/ledgers.yaml into docs/.backup/<ISO-timestamp>/, write fresh canonical ledger(s) + registry from CANONICAL_LEDGERS, emit a loud stderr WARNING naming the backup path, and continue startup. Default behavior is backup-and-reinit; an optional opt-out flag preserves the hard abort. Includes dual-tests-style coverage. Repo gate: bun run check."

### M23 — open

- createdAt: 2026-06-02T17:25:15.494Z
- updatedAt: 2026-06-02T17:25:15.494Z
- title: "Plan: @cq/ledger packaging + UI-eligibility defect cleanup (D3-D6)"
