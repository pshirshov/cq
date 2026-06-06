---
ledger: tasks
counters:
  milestone: 0
  item: 198
archives:
  - id: M5
    path: ./archive/tasks/M5.md
    summary: "Dogfood complete: T24 driven to done through the real implement-flow loop (manual worktree (K4 Codex path) -> implement-worker created+committed the marker -> bun run check green in worktree (379 pass) -> implement-reviewer approved 0/0 -> ff merge-back into throwaway dogfood/base). Throwaway branches deleted; nothing landed on main. Two setup findings recorded as defects under goals:G1."
    title: "Dogfood: implement-flow smoke test"
    status: done
  - id: M2
    path: ./archive/tasks/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
    title: TUI + web UI improvements
    status: done
  - id: M3
    path: ./archive/tasks/M3.md
    summary: Build /implement:* command family (goal G1) — complete. Decision K4 (model tiers + dual worktree strategy); implement-worker/-reviewer/-conflict-resolver agents (T5–T7); /implement:start + /implement:advance (T8/T9); plan-advance sets suggestedModel (T11); cross-flow session-log convention (T15); wiring (T10); end-to-end dogfood (T12, defect D2 resolved). Shipped on main (commit 4f430b3).
    title: Build /implement:* command family
    status: done
  - id: M4
    path: ./archive/tasks/M4.md
    summary: Plan-flow maintenance — complete. Subagent MCP tool access made server-name-independent via denylist (T13); /plan:follow-up command + goal re-open transitions, decision K5 (T25); /plan:advance with no argument advances all unlocked goals (T14). Shipped on main (commits 4f430b3, 67727e9).
    title: Plan-flow maintenance and improvements
    status: done
  - id: M6
    path: ./archive/tasks/M6.md
    summary: UI/schema follow-up (G1) — COMPLETE. reviews `summary` field (T26); summarize() legacy fallback + badge/cell nowrap-ellipsis both UIs (T27); summary threaded through reviewer prompts + implement:advance recorder (T28); fetchLedgerArchive client web+TUI (T29); web subsections + milestone dropdown (T30); TUI column table + subsections (T31); web (T32) + TUI (T33) read-only archive views; integration gate + cross-cutting regression (T34). Tasks T26-T34; reviews R7/R8/R11/R12/R14/R15/R16/R17/R22. Shipped on main; final check 483 pass.
    title: "UI/schema follow-up: archives, milestone grouping, TUI table, reviews summary"
    status: done
  - id: M7
    path: ./archive/tasks/M7.md
    summary: "investigate:* flow assets (G1 #2) — COMPLETE. Design lock K8 (T35); investigate-explorer read-only evidence-gatherer (T36); /investigate:advance DFS/adjudication loop with file-and-defer handoff + defect-seeded clarify-skip (T37); /investigate:start intake + inline advance (T38, round-1 fixed phantom-subagent); LINKS wiring (T39). Tasks T35-T39; reviews R9/R13/R18/R19. Shipped on main; all investigate:* symlinks resolve; final check 483 pass."
    title: investigate:* flow — research-loop-style defect investigation assets
    status: done
  - id: M8
    path: ./archive/tasks/M8.md
    summary: "defect-awareness in plan:*/implement:* prompts (G1 #2) — COMPLETE. plan-reviewer defects[] bucket (T40); implement-reviewer defects[] JSON (T42); plan-flow defect-aware planning + bidirectional linkage + reviewer-defects file-and-defer + defect-seeded clarify-skip (T41); implement/advance files reviewer defects + orchestrator-owned closure on merge-back (T43); cross-prompt 6-grep-invariant audit (T44). Tasks T40-T44; reviews R23/R24/R25/R26/R27. Shipped on main. Closed loop defect->investigate->plan->implement->resolve confirmed."
    title: defect-awareness in plan:* and implement:* prompts
    status: done
  - id: M9
    path: ./archive/tasks/M9.md
    summary: "defect/hypothesis relationship views (G1 #2, Q28 Full) — COMPLETE. Schema-sufficiency spike, no @cq/ledger change (T45); pure shared helpers defectFixTaskIds + hypothesisRelationships (T46); web detail-panel relationship views via ./relationships subpath (T47); TUI content-pane views (T48); cross-UI single-source regression + full-suite gate (T49). Tasks T45-T49; reviews R10/R20/R21/R28. Shipped on main; final check 483 pass."
    title: defect/hypothesis relationship views in TUI + web (Full scope, Q28)
    status: done
  - id: M12
    path: ./archive/tasks/M12.md
    summary: G2-W1 shared status→color foundation — COMPLETE. 'warning' StatusBucket + WARNING={revise} (T50, mirror both status.ts); TUI warning=magenta (T51); web canonical BUCKET_HEX single source as --lw-status-* vars, warning=#e0a341 (T52); DagView nodes via shared BUCKET_HEX[statusBucket(status,schema)] (T53). Tasks T50-T53; reviews R34/R40/R43/R44.
    title: "G2-W1: Shared status→color foundation (revise bucket + graph colorization)"
    status: done
  - id: M13
    path: ./archive/tasks/M13.md
    summary: G2-W2 Questions UX — COMPLETE. parseFieldValue string[] on ;/newline, id[] keeps comma (T54); normalizeSuggestions helper+script idempotent (T55, live data-run DEFERRED — run with MCP quiesced + restart); web (T56)+TUI (T57) suggestions bulleted list; web (T58)+TUI (T59) question field order milestone,status,by,question,context,suggestions,recommendation,answer. Tasks T54-T59; reviews R35/R39/R46/R50/R51/R53.
    title: "G2-W2: Questions UX (field order + suggestions-as-list)"
    status: done
  - id: M16
    path: ./archive/tasks/M16.md
    summary: G3-B never auto-close goals — COMPLETE. implement/advance.md hard rule 'never auto-transition goal building→done' + ready-to-close report, milestone auto-archive preserved (T69); authoritative invariant once in plan-advance.md, building→done stays legal user-driven (T70); verify gate green (T71). Tasks T69-T71; reviews R36/R45/R55.
    title: "G3-B: never auto-close goals (prompt edits)"
    status: done
  - id: M17
    path: ./archive/tasks/M17.md
    summary: G3-A auto-investigate from plan:* — COMPLETE. K12 supersedes K8 pt3 (pins pts1/2/4/5; plan:* commands auto-launch /investigate:advance inline) (T72); plan-advance.md file-only defects (T73); plan/advance.md auto-investigate phase + enumerated convergent stop predicates replacing 4-iter cap (T74); plan/start+follow-up conditional auto-investigate (T75); implement/advance.md 8-round ceiling removed (T76); cross-flow wording reconciled (T77); verify gate (T78). Tasks T72-T78; reviews R37/R38/R48/R49/R52/R56.
    title: "G3-A: auto-investigate from plan:* (prompt edits + K8 supersession)"
    status: done
  - id: M19
    path: ./archive/tasks/M19.md
    summary: "G2 follow-up #14-#15 — COMPLETE. Web per-suggestion 'pick' button (T86); TUI keys 1-9 pick Nth suggestion (T87); web disable as-recommended+pick on non-whitespace answer, detail+batch (T88); TUI r/1-9 inert + batch Ctrl+R when persisted answer non-empty (T89). Tasks T86-T89; reviews R69-R72. Integration 623 pass."
    title: "G2 follow-up: per-suggestion pick-as-answer + disable answer-fill when typing (#14-#15)"
    status: done
  - id: M14
    path: ./archive/tasks/M14.md
    summary: G2-W3 column selector + batch-answer + project title — COMPLETE. T60-T68 (eligibleColumnFields/defaultColumns, web+TUI column selectors, web batch-answer modal + TUI overlay, displayName + web/TUI titles). Out-of-scope defects D3 (exports map) + D4 (column eligibility) RESOLVED via G5; Q52 withdrawn (K13). Reviews R54/R57-R61. Shipped on main.
    title: "G2-W3: Column selector, batch-answer mode, project title"
    status: done
  - id: M18
    path: ./archive/tasks/M18.md
    summary: "G2 follow-up #9-13 — COMPLETE. T79 archived-subsection unification, T80/T81 milestone-status badge (web)/color (TUI), T82 colgroup column proportions, T83/T84 goals flat-list, T85 TUI nav-perf memoization. Out-of-scope D5 (archived-head badge) + D6 (browser-safe constants) RESOLVED via G5; Q53 withdrawn (K13). Reviews R62-R68. Shipped on main."
    title: "G2 follow-up: web milestone-section rendering + column-width + goals flat-list + TUI nav-perf (#9-#13)"
    status: done
  - id: M22
    path: ./archive/tasks/M22.md
    summary: G4-W D2 backup-and-reinit — COMPLETE. T94 backupAndReinit helper (timestamped docs/.backup/, ENOENT-tolerant, fresh canonical + WARNING); T95 init() !schemasEqual branch → backup-and-reinit by default + onSchemaDivergence:'abort' opt-out; T96 tests (divergence/abort/no-divergence/empty-dir) + abort-suite migration; T97 repo gate. Defect D2 RESOLVED. Reviews R80/R85/R89/R91. Shipped on main; check 661.
    title: "G4-W: D2 backup-and-reinit on ledger schema divergence"
    status: done
  - id: M24
    path: ./archive/tasks/M24.md
    summary: G5 Fix Unit A @cq/ledger packaging — COMPLETE. T98 realigned package.json main+exports → ./dist/src/* (consistent w/ ./columns); T99 browser-safe ./constants subpath export + web tsconfig paths; T100 App.tsx consumes @cq/ledger/constants, deletes MILESTONE_STATUS_SCHEMA dup; T101 package-exports.test.ts (asserts all export targets exist post-build). Defects D3 + D6 RESOLVED. Reviews R81/R86/R87/R88. Shipped on main.
    title: G5 Fix Unit A — @cq/ledger packaging (D3 + D6)
    status: done
  - id: M25
    path: ./archive/tasks/M25.md
    summary: G5 Fix Unit B column eligibility — COMPLETE. T102 added SUMMARY_SOURCE_FIELDS {headline,title,question} excluded from eligibleColumnFields (grounded in summarize() precedence) + first columns.test.ts; suggestedModel still eligible. Defect D4 RESOLVED. Review R82. Shipped on main.
    title: G5 Fix Unit B — column eligibility (D4)
    status: done
  - id: M26
    path: ./archive/tasks/M26.md
    summary: "G5 Fix Unit C archived-head status badge — COMPLETE. T104 passes archived pointer status as milestoneStatus to the archived MilestoneSubsection (empty-status guarded) → T80 badge renders for archived heads; happy-dom test. T103 withdrawn (R77: no @cq/shared wire mirror — T91's ArchivePointer.status flows over the wire as-is). Defect D5 RESOLVED. Review R92. Shipped on main; check 661."
    title: G5 Fix Unit C — archived-head status badge (D5)
    status: done
  - id: M21
    path: ./archive/tasks/M21.md
    summary: "G2 follow-up #4 (items 16-19) — COMPLETE. T90 (!isMilestones gate, D7); T91 (ArchivePointer title+status extension, D8, lands status for D5); T92 (retire /investigate:start routing-questions per K13, item 18); T93 (batch-answer modal wider/taller/smaller-font/scrolls, item 19). Defects D7/D8 resolved; out-of-scope D9/D10 surfaced here, resolved via G6/M28 (T105/T106). Reviews R79/R83/R84/R90. Last G2 work milestone."
    title: "G2 follow-up #4: milestones-ledger archived rendering, routing-question retirement, batch-modal sizing"
    status: done
  - id: M30
    path: ./archive/tasks/M30.md
    summary: "G7 fixes COMPLETE — six confirmed dogfood defects fixed + merged. T110 (D16: backfill non-milestones archive-pointer titles from docs/archive/milestones/<id>.md by id; 48f4e93). T111 (D14: spawnWithFreePort retry-on-EADDRINUSE closes the bind-then-close TOCTOU; 6e223bb). T112 (D15: bounded wait-for de-flakes the live-badge test; 40385f6). T113 (D17: removed archived badge from row id cell; 1dec462). T114 (D18: per-suggestion pick buttons in the batch answer modal; ae0e5f8). T115 (D19: batch modal closes on open-set drain; 051fb27). Reviews R105-R110 (all go-ahead). Decision K19. Defects D14-D19 resolved. Final integration check 696 pass / 0 fail. Seeded + driven by the simulated /advance pipeline."
    title: "G7 fixes: confirmed dogfood UI/store defects (D14-D19)"
    status: done
  - id: M28
    path: ./archive/tasks/M28.md
    summary: G6 work milestone M28 — COMPLETE (auto-archived by the milestone-completion rule). Tasks T105 (D9), T106 (D10), T107 (D11), T108+T109 (D12) done; defects D9/D10/D11/D12 + the out-of-scope D14/D15/D16/D17 all resolved (via G7/M30); reviews R98-R102. Decisions K17/K18. Integration green.
    title: "G6 fixes: D9 test flake, D10 store parity, D11 sticky toolbar"
    status: done
  - id: M31
    path: ./archive/tasks/M31.md
    summary: "G6 #2/#4B — COMPLETE. T125 (authored llm/commands/advance.md universal sequencer), T126 (wired into link-prompts.ts + committed .codex/prompts/advance.md symlink), T127 (implement worker cap N=4→8), T128 (factored milestone auto-close+archive sweep predicate in advance.md + implement/advance.md), T129 (one-shot backlog sweep: archived M15/M20/M23/M28; guard-skipped M10/M11/M29/M27/M32/M33). Reviews R119/R122/R123/R124. Integration green."
    title: "G6 #2/#4B — universal /advance command, parallelism bump (N=4→8), milestone auto-close+archive sweep"
    status: done
  - id: M36
    path: ./archive/tasks/M36.md
    summary: "G8 fix — COMPLETE. T130 (bfa70ed): de-flaked the ledger-tui ink-testing-library suite (fixed-tick→poll-until-condition across all flaky sites; navMemo T85 explicit timeout + reduced N; settle-then-assert for negative inert-key tests) → deterministic full-suite `bun run check` (725/0). T131 (8c33435): reset()/backupAndReinit now back up + unlink non-canonical ledger .md files and remove their FTS docs (no orphans/stale index). Reviews R127/R128. Decision K21. Defects D20+D21 resolved; residuals D22 (s-test vacuity, low) + D23 (advance()-helper flake, medium) filed."
    title: "G8 fix: D20 ledger-tui test flakiness + D21 reset non-canonical ledgers"
    status: done
  - id: M38
    path: ./archive/tasks/M38.md
    summary: "G10 work milestone — COMPLETE. T132 (6bd6623): enabled ink incrementalRendering via exported TUI_RENDER_OPTIONS in ledger-tui/src/main.tsx → ~53% per-move stdout-write reduction (D13). T134 (effbd60): advance() test-helper deadline 1500→4000ms + 20_000ms per-test timeout (D23). T133 (bbbfb44): deterministic per-move byte-count regression guard navRenderBytes.test.tsx (negative-control verified). T135: no-op (UX defer not needed). Reviews R132/R133/R134 go-ahead. Defects D13+D23 resolved. bun run check green 728/0."
    title: G10 fix work — D13 TUI nav-perf memo boundaries + D23 multi-step-form test flake (file-disjoint, parallel-safe)
    status: done
  - id: M32
    path: ./archive/tasks/M32.md
    summary: "G6 #3 work milestone — COMPLETE. ledger-mcp --reset (backup-first whole-tree reset) shipped; tasks T123/T131 done; defect D21 (reset ignored non-canonical ledgers) resolved; reviews terminal. Auto-archived by the /advance whole-ledger sweep."
    title: "G6 #3 — ledger-mcp --reset command (backup-first whole-tree reset)"
    status: done
  - id: M33
    path: ./archive/tasks/M33.md
    summary: "G6 #4A work milestone — COMPLETE. Formal defect-lifecycle states (open/wip/root-caused/inconclusive/resolved/wontfix) landed in @cq/ledger CANONICAL_LEDGERS + investigate/plan/implement flow prompts; live open-defect migration done; tasks + reviews terminal. Auto-archived by the /advance whole-ledger sweep."
    title: "G6 #4A — formal defect-lifecycle states (root-caused/inconclusive) across schema + flow prompts"
    status: done
  - id: M41
    path: ./archive/tasks/M41.md
    summary: "G12 work milestone — COMPLETE. T136 (b8df1c6): made the 's'-key-inert archived-item test regression-sensitive (content-pane '[archived · read-only]' badge-present + content-pane-scoped picker-absence), resolving D24 (ex-D22). Review R141 go-ahead. Integration check green 783/0. G12 goal is `planned` and ready for the user to close."
    title: "G12 fix: regression-sensitive 's'-key-inert archived-item test (D24)"
    status: done
  - id: M42
    path: ./archive/tasks/M42.md
    summary: G11 W1 (@cq/ledger schema + store foundations) — COMPLETE. T137 handoffs CANONICAL_LEDGERS entry (idPrefix HO, all-terminal); T138 sessionLogs:string[] on 6 work-producing schemas; T139/T140 fts (status:open OR status:wip) adjudicated GREEN (usage artifact, docs-only); T141 reopenItem + group-keyed unarchiveItem (both stores); T142 projectCompact + paginate (strips grounding/recommendation/suggestions); T143 cross-ledger snapshot(). Reviews R142-R147 go-ahead. Shipped on main.
    title: G11 W1 — @cq/ledger schema + store foundations
    status: done
  - id: M43
    path: ./archive/tasks/M43.md
    summary: G11 W2 (@cq/ledger-mcp tool surface) — COMPLETE. T144 fetch_ledger compact/offset/limit params (fixes 51.8KB/142.7KB overflow); T145 snapshot tool; T146 reopen_item + unarchive_item; T147 read_log (bounded, root-confined); T148 tool-count reconciliation (14→18 across all refs); T149 query-language doc clarifications. Reviews R148-R153 go-ahead. Out-of-scope defects D25/D26 filed here, both later resolved (G13). Shipped on main.
    title: G11 W2 — @cq/ledger-mcp tool surface
    status: done
  - id: M44
    path: ./archive/tasks/M44.md
    summary: G11 W3 (@cq/ledger-web HoldButton + sessionLogs viewer) — COMPLETE. T150 reusable HoldButton (HOLD_MS=1000, pointer+keyboard hold-to-confirm, progress bar, injectable HoldClock); T151 all 10 state-mutating web buttons hold-gated; T152 sessionLogs rendered as clickable links → popup via read_log MCP tool. Reviews R154/R157/R160 go-ahead (T151 r0 missed the 2 quick-transition buttons, fixed r1). Recovered a partial-cherry-pick of T151 during merge-back. Shipped on main.
    title: G11 W3 — @cq/ledger-web HoldButton + sessionLogs viewer
    status: done
  - id: M45
    path: ./archive/tasks/M45.md
    summary: G11 W4 (flow-prompt wiring) — COMPLETE. T153 advance.md §Provenance permits the single run-level handoffs write; T154 per-flow handoff writes with contextual /advance suppression; T155 sessionLogs population in each outcome write; T156 snapshot-first /advance bootstrap recipe. Reviews R155/R156/R158/R159 go-ahead (T154 r0 used an env var, fixed r1 → contextual). Out-of-scope defect D27 filed here, later resolved (G13). Docs/prompt-only. Shipped on main.
    title: G11 W4 — flow-prompt wiring (handoff writes + bootstrap recipe + docs)
    status: done
  - id: M46
    path: ./archive/tasks/M46.md
    summary: "G11 W5 (integration verification) — COMPLETE. T157 verification-only gate: bun run check green 847/0 on main (697aec8); bun.lock unchanged → no flake FOD refresh; all 5 ergonomics wins demonstrated via passing tests (snapshot one-call, fetch_ledger compact no-overflow, reopen/unarchive recovery, handoffs bootstrap, web hold-gate+sessionLogs popup). Review R161 go-ahead. G11 fully built (21 tasks); goal planned, ready for the user to close."
    title: G11 W5 — integration verification (bun run check)
    status: done
  - id: M48
    path: ./archive/tasks/M48.md
    summary: "G13 fix work (D25/D26/D27 G11 follow-up cleanup) — COMPLETE. T158 (D26): readLog symlink-escape hardening (realpath both target+root); T159 (D25): removed stale eslint-disable; T160 (D27): reworded CHAINED handoff trigger + made start/follow-up wrappers the single handoff writer (7 files). Reviews R163/R164/R165 go-ahead (T158/T160 each r0 disapprove→r1 approve). H15/H16/H18 confirmed. Defects D25/D26 resolved (also D28 filed here from T158 review, resolved via G14). Merged 311b8a1."
    title: "G13 fix tasks: D25/D26/D27 code-quality cleanup"
    status: done
  - id: M50
    path: ./archive/tasks/M50.md
    summary: "G14 fix work (D28 readLog TOCTOU) — COMPLETE. T161: readLog now reads the validated canonical path (fs.readFile(real ?? resolved)) instead of the symlink-bearing resolved, closing the check-then-read TOCTOU; ENOENT unmasked. Deterministic TOCTOU regression test (spies fs.realpath to swap the target at the check→use boundary; verified to fail against the pre-fix read). Review R167 go-ahead (r0 disapprove: non-discriminating test → r1 made it fail against pre-fix code). Defect D28 resolved. Merged 537017f."
    title: Close D28 readLog check-then-read TOCTOU (read validated canonical path)
    status: done
  - id: M54
    path: ./archive/tasks/M54.md
    summary: "G16/D29 fix built+merged: backend questions-answer StatusChangePrecondition (dual-store) + web/TUI empty-answer UX guards. Tasks T162/T163/T164 done, reviews R172/R174/R175 go-ahead. Integrated bun run check green 908/0. D29 resolved."
    title: D29 fix — reject empty/whitespace answer on a question's `answered` transition
    status: done
  - id: M58
    path: ./archive/tasks/M58.md
    summary: "G17/D30 fix built+merged: link-prompts.ts made import-safe + repointed 14 LINKS off the vanished llm/ root onto ../cq-assets/, hardened to throw on missing targets; cq-assets README de-staled. Tasks T179/T180/T181 done, reviews R173/R176/R177 go-ahead. D30 resolved; bun run link-prompts now produces non-dangling symlinks."
    title: "G17 fix: repoint link-prompts.ts + cq-assets README off vanished `llm/` root (D30)"
    status: done
  - id: M55
    path: ./archive/tasks/M55.md
    summary: "G15 Feature 1 (explorer two-tier RW) built+merged: investigate-explorer JSON contract extended with optional probeRequest (T165); new execution-capable investigate-prober.md agent (Bash + throwaway worktree, read+execute, local-only/no-network) (T166); prober dispatch wired into investigate/advance.md gated on probeRequest with harvest-then-discard (T167); prober registered in link-prompts.ts + README (T168). Tasks T165-T168 done, reviews go-ahead. Integrated bun run check green."
    title: G15 W1 — Explorer two-tier RW (investigate-prober)
    status: done
  - id: M56
    path: ./archive/tasks/M56.md
    summary: "G15 Feature 2 (pluggable parallel reviewers) built+merged: pi non-interactive spike confirmed (K30 invocation contract) (T169); @cq/config cq.toml parser package (T170) + cq-config MCP server exposing get_reviewers + Nix package (T171); registered in dev-llm.nix + .mcp.json (T172); shared /cq:plan-review (T173) + /cq:implement-review (T174) rubrics; reconciliation (strictest-wins+union-with-source-tags, get_reviewers MCP tool, pi shellout) wired into plan/advance.md (T175) + implement/advance.md (T176); /cq:reviewers session-only override (T177); cq.toml.example + cq/* link entries + README (T178). Tasks T169-T178 done, reviews go-ahead, K30 locked. Integrated bun run check green 930/0; all new asset symlinks resolve."
    title: G15 W2 — Pluggable parallel reviewers (cq.toml + cq-config MCP + pi shellout)
    status: done
  - id: M62
    path: ./archive/tasks/M62.md
    summary: "G18 PART 2 — pluggable parallel planners — COMPLETE. All 6 tasks done + merged to main (T12 84f1bfe @cq/config planners=[] parser/resolvePlanners; T13 7a3806d get_planners + get_config.planners on BOTH ledger-MCP surfaces, count 20→21 + drift-guard + e2e stdio; T14 6f2397e plan-advance CANDIDATE mode emitting task-DAG JSON; T15 d949db6 multi-planner generate-N-then-JUDGE+SYNTHESIS step in plan/advance.md; T16 b3278b3 commands/cq/planners.md session-only override; T17 7e403fe convergence gate — assets glob picks up planners.md, cq.toml.example planners= example, mcp__cq-config__ grep clean). Reviews R206-R211 all go-ahead (T12 + T13 each after 1 criticism round: T12 empty-test→real reproduction, T13 5 stale '20-tool' strings→21). bun run check green 931/0. Tip 7e403fe."
    title: G18 PART 2 — Pluggable parallel planners (generate-N-then-judge w/ synthesis)
    status: done
  - id: M64
    path: ./archive/tasks/M64.md
    summary: D32 fix COMPLETE. Single doc-only task T182 (commit 418b641, merged to main) repointed nix/pkg/cq-assets/README.md 'Configuration' section off the removed standalone cq-config MCP server to the ledger MCP (heading 'cq.toml and the ledger MCP'; prose attributes parsing to the @cq/config parser package + surfacing to the ledger MCP exposing get_reviewers/get_config/get_planners as mcp__ledger__*). Review R213 go-ahead. D32 resolved (orchestrator-owned closure). bun run check 931/0.
    title: Repoint cq-assets/README.md Configuration section off cq-config MCP server (D32 fix)
    status: done
  - id: M61
    path: ./archive/tasks/M61.md
    summary: G18 PART 1 — Merge cq-config into ledger MCP + remove standalone server — COMPLETE. 11 tasks done + merged (T1 get_reviewers/get_config on BOTH ledger-MCP surfaces behind injected ConfigCapability; T2 buildServer wiring + e2e stdio; T3 count 18→20 + drift-guard; T4 delete cq-config-mcp package; T5 flake.nix removal + @cq/config symlink; T6 dev-llm.nix; T7 .mcp.json; T8/T9/T10 repoint reviewers.md/implement-advance/plan-advance to mcp__ledger__*; T11 FOD hash refresh + nix build .#ledger-mcp/.#ledger-tui/.#ledger-web green + .#cq-config-mcp attr-not-found). Reviews R195-R205 go-ahead. Out-of-scope defect D32 (README still referenced the removed server) auto-investigated→root-caused (H23)→defect-seeded G19→planned (K32/R212)→BUILT (T182, R213)→D32 RESOLVED in the same run; Q104 traceability withdrawn. bun run check green 931/0; main tip 418b641. @cq/config PARSER library retained.
    title: G18 PART 1 — Merge cq-config into ledger MCP + remove standalone server
    status: done
  - id: M67
    path: ./archive/tasks/M67.md
    summary: G21/D31 fix — COMPLETE. T183 (reproduce-first RED happy-dom test for the press-started-inside backdrop dismiss, d073a27) + T184 (shared useBackdropDismiss hook — closes only when target===currentTarget on BOTH pointerdown/mousedown and click — wired into all three overlays batch/help/log, 99576bc). Reviews R219/R220 go-ahead. D31 RESOLVED; bun run check green 977/0 at merge. main bdd2720.
    title: G21/D31 fix — safe modal backdrop (press must start on backdrop to dismiss)
    status: done
  - id: M68
    path: ./archive/tasks/M68.md
    summary: G20 FEATURE 1 (cq.toml [webui] + ledger-web port auto-increment) — COMPLETE. T185 (swap @cq/config parser to smol-toml 1.6.1 + typed [webui] host/integer-port, whitelist preserved, G18 planners intact — 96b7031) + T186 (resolveWebOpts per-field CLI>cq.toml>default + bounded scanForPort MAX=64 EADDRINUSE-only host-immutable — f71f9b9) + T187 (main() wires loadConfig+resolveWebOpts+scanForPort, reports actual bound URL to STDOUT keeping the stderr line, + ledgerWeb @cq/config flake symlink — 0c21f43). Reviews R217/R221/R223 go-ahead (one plan revise round R215→R216). bun run check green; nix build .#ledger-web verified in T192.
    title: G20 FEATURE 1 — cq.toml [webui] + ledger-web port auto-increment (depends on G18 landing)
    status: done
  - id: M69
    path: ./archive/tasks/M69.md
    summary: "G20 FEATURE 2 (new `cq` CLI init/reset/erase) — COMPLETE. T188 (scaffold @cq/cli package + dispatcher + injectable ConfirmIo — 8f60e59) + T189 (cq init: idempotent FsLedgerStore.init-if-none, no cq.toml — da1aa82) + T190 (cq reset: relocate the wrapper off ledger-mcp via FsLedgerStore.reset+ConfirmIo, REMOVE --reset from ledger-mcp — 3d96f3c) + T191 (cq erase: bounded irreversible delete of <root>/docs + cq.toml, no path-escape, confirm-gated — e597b68) + T192 (closing gate: cqCli flake.nix derivation + apps.cq + node-modules FOD entry + consolidated hash refresh; nix build .#cq/.#node-modules/.#ledger-mcp/.#ledger-tui/.#ledger-web all green + cq bin init/reset/erase e2e — bdd2720). Reviews R218/R222/R224/R225/R226 go-ahead. bun run check green 986/0. main bdd2720."
    title: G20 FEATURE 2 — new `cq` CLI (init / reset / erase)
    status: done
---

# tasks

## M71

### T193 — planned

- createdAt: 2026-06-06T12:28:53.555Z
- updatedAt: 2026-06-06T12:28:53.555Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: "Sidebar: group-ordered ledger nav with splitters (part 1)"
- description: |
    Reorganize the @cq/ledger-web left sidebar (packages/ledger-web/src/App.tsx, ~L785-1099) to the exact grouping with `<hr class="lw-sidebar-divider">` splitters between groups (top→bottom):
      1. questions ledger + the existing `Q&A` button (`.lw-batch-open`, testid `batch-open`)  — splitter
      2. goals, milestones  — splitter
      3. defects, tasks  — splitter
      4. handoffs  — splitter
      5. decisions, hypothesis, reviews  — (splitter)
      6. any CUSTOM ledgers (any ledger not named in groups 1-5), last.
    
    Mechanics: replace the two ad-hoc `visualLedgers.map` blocks (block A = questions+Q&A button; block B = all-others-in-original-order) with a single GROUP-ORDERED render driven by an explicit ordered group array of ledger ids. `Q&A` is NOT a ledger — it is the batch-answer trigger button; keep it directly after the `questions` ledger button within group 1. Rebuild the `visualLedgers` useMemo (~L788) so its order EXACTLY matches the new visual order (group order, then custom ledgers), because `ledgerCursor` keyboard nav indexes `visualLedgers` and the invariant cursor-index == visual-position MUST hold (verify ArrowUp/Down still walks the list in visual order). Any canonical ledger absent from the current connection is simply skipped; any non-canonical ledger falls into group 6. Do not drop any ledger. Add the splitter `<hr>` elements between rendered groups only (no trailing/leading splitter, and skip a splitter when an adjacent group renders empty). Reuse the existing `.lw-sidebar-divider` style (add it between the new groups; styles.css L266). Keep all existing `data-testid` attributes (`ledger-<name>`, `ledger-count-<name>`, `batch-open`, `sidebar-divider`) so existing tests keep resolving; if multiple dividers now render, ensure tests asserting a single `sidebar-divider` still pass or update them.
- acceptance: "`bun test` passes (run from nix/pkg/cq-ledgers/, incl. ledger-web App tests); `bun run check` (tsc -b && eslint . && bun test) is green. In the rendered sidebar the ledger buttons appear in the order questions, (Q&A button), goals, milestones, defects, tasks, handoffs, decisions, hypothesis, reviews, then any custom ledgers, with horizontal-rule splitters between the groups. Keyboard ArrowDown from the top steps through the buttons in that exact visual order (cursor highlight follows visual position). No canonical or custom ledger is missing from the list."
- suggestedModel: standard
- ledgerRefs: ["goals:G22"]

### T194 — planned

- createdAt: 2026-06-06T12:29:08.577Z
- updatedAt: 2026-06-06T12:29:08.577Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: "Help popup: large constant size, no jump across tabs (part 2)"
- description: |
    Stop the help dialog (HelpOverlay, App.tsx ~L1453-1546; `.lw-help` styles.css L161-169) from resizing when switching between its two tabs ('Keyboard shortcuts' and 'State machines'). Currently `.lw-help` is content-driven (min-width:440px; max-width:90vw; no fixed height), so the box jumps per tab.
    
    Fix (primarily styles.css): give `.lw-help` a LARGE CONSTANT width AND height — a sensible default such as `width: min(900px, 92vw); height: min(80vh, 720px)` — and make the BODY region (everything below `.lw-help-head`) scroll internally so both tabs occupy the same fixed outer box. Use a flex column on `.lw-help` (head fixed, body `flex:1; min-height:0; overflow-y:auto`). If a body wrapper is needed for the scroll container, add a single wrapping `<div class="lw-help-body">` around the tab-content (the `<dl class=lw-help-list>` and the `.lw-help-statemachines` block) in HelpOverlay (App.tsx) and move overflow there; the existing `.lw-help-statemachines{max-height:70vh;overflow-y:auto}` should be reconciled so scrolling happens once (in the shared body), not nested. Keep `role=dialog`, the backdrop-dismiss, the tab strip, and all `data-testid`s (`help-overlay`, `help`, `help-tab-*`, `help-shortcuts`, `help-statemachines`, `help-close`) intact.
    
    Serialize after the sidebar task (shares App.tsx + styles.css).
- acceptance: "`bun run check` green (tsc -b && eslint . && bun test from nix/pkg/cq-ledgers/). The help dialog presents at a fixed large size; switching between the 'Keyboard shortcuts' and 'State machines' tabs does NOT change the dialog's outer width or height (the box stays put; overflow scrolls inside the body). Existing HelpOverlay tests still pass (or are updated to the new body wrapper while preserving their assertions)."
- suggestedModel: standard
- dependsOn: ["T193"]
- ledgerRefs: ["goals:G22"]

### T195 — planned

- createdAt: 2026-06-06T12:29:25.971Z
- updatedAt: 2026-06-06T12:29:25.971Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: "State-machine SVGs: normalise to consistent left alignment (part 3)"
- description: |
    Make every per-ledger state-machine diagram in the help dialog's 'State machines' tab present consistently LEFT-aligned. The alignment is INSIDE the SVG (StateMachineDiagram, App.tsx ~L1555-1603; layout from stateMachine.ts `computeStateMachine` → dagLayout.ts `computeDagLayout`; CSS `.lw-statemachine-svg` styles.css L227-233). Diagrams are GENERATED (not hand-authored): each `<svg width={model.width} viewBox='0 0 W H'>` has a per-ledger intrinsic width (more transition layers → wider). With `.lw-statemachine-svg{display:block;max-width:100%}`, wide SVGs scale down (centering content via default preserveAspectRatio xMidYMid) while narrow ones keep their small width — producing the inconsistent left/center/right look.
    
    Fix INSIDE the svg/its sizing (do NOT just wrap the HTML): give each `<svg>` an explicit `preserveAspectRatio="xMinYMid meet"` so when it scales to fit the container the content pins to the LEFT (xMin) rather than centering; and set a consistent presented width (e.g. `width: 100%` on `.lw-statemachine-svg` with `height:auto`, or render at a uniform max width) so all diagrams share the same left origin. The node layout already starts at `x = opts.pad` (left edge) in computeDagLayout, so left-pinning the viewBox mapping is the lever. Verify with the `help-statemachine-svg-<ledger>` testids that each diagram's left edge lines up across ledgers. Keep all node/edge testids and the bucket fills unchanged. Pure presentation change — no change to computeStateMachine/computeDagLayout math unless needed to expose a uniform width.
    
    Serialize after the help-size task (shares App.tsx + styles.css).
- acceptance: "`bun run check` green (tsc -b && eslint . && bun test from nix/pkg/cq-ledgers/). In the 'State machines' help tab, every ledger's diagram is left-aligned with a consistent left edge (no diagram appears centered or right-shifted relative to others). The `<svg>` carries `preserveAspectRatio=\"xMinYMid meet\"` (or equivalent left-pinning) and a consistent presented width. Existing stateMachine/StateMachineDiagram tests pass (or are updated for the new svg attrs while keeping their node/edge assertions)."
- suggestedModel: standard
- dependsOn: ["T194"]
- ledgerRefs: ["goals:G22"]

## M72

### T196 — planned

- createdAt: 2026-06-06T12:29:44.201Z
- updatedAt: 2026-06-06T12:35:37.354Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: Relocate the 3 command files into commands/cq/ (git mv) + fix their own self-refs
- description: |
    Relocate (git mv, preserving history) the three renamed command files under nix/pkg/cq-assets/:
      - commands/advance.md          → commands/cq/advance.md        (/advance → /cq:advance)
      - commands/plan/start.md       → commands/cq/plan.md           (/plan:start → /cq:plan)
      - commands/investigate/start.md → commands/cq/investigate.md   (/investigate:start → /cq:investigate)
    
    Do NOT move the per-flow *:advance / *:follow-up files — commands/plan/advance.md, commands/plan/follow-up.md, commands/implement/advance.md, commands/investigate/advance.md all KEEP their current paths and slash names. The /cq:* namespace already holds commands/cq/{plan-review,implement-review,reviewers,planners}.md — do not disturb them; just add the three new files alongside.
    
    Within EACH of the three relocated files, rewrite ALL references to ANY of the three renamed-FROM command names — NOT merely the file's own self-reference — applying the WHOLE rename mapping in-file:
      /advance            → /cq:advance
      /plan:start         → /cq:plan
      /investigate:start  → /cq:investigate
    This closes the cross-file gap the reviewer flagged (R227): e.g. the relocated commands/cq/plan.md (was commands/plan/start.md) mentions /investigate:start in its frontmatter `description` (~L2) and body (~L29, L35, L37); those must all become /cq:investigate here, because T198 explicitly EXCLUDES these three files from its sweep. After this task, the three relocated files contain NONE of the renamed-FROM tokens.
    
    This includes the `description:` frontmatter and any body prose. Update relative-path mentions of the moved files' own location if any (e.g. 'llm/commands/...').
    
    CRITICAL — do NOT touch the STAYING names: /plan:advance, /implement:advance, /investigate:advance, /plan:follow-up, /implement:start must remain verbatim. Use word-boundary-anchored matching: replacing '/advance' must not corrupt '/plan:advance' / '/implement:advance' / '/investigate:advance' (they end ':advance', not standalone '/advance'); replacing '/plan:start' / '/investigate:start' must not touch '/implement:start' or any '*:advance'/'*:follow-up' name. After the moves, the directory `commands/plan/` still contains advance.md + follow-up.md (non-empty), `commands/investigate/` still contains advance.md (non-empty).
    
    NOTE: assets.nix `collectMd` derives command keys from the directory tree, so this relocation alone re-keys the bundle (cq/advance → /cq:advance) — NO edit to assets.nix or dev-llm.nix is required.
- acceptance: "The three files exist at commands/cq/{advance,plan,investigate}.md and no longer at their old paths; `git status`/`git log --follow` shows them as renames. commands/plan/ and commands/investigate/ still contain their *:advance/*:follow-up files. In EACH relocated file, every reference to a renamed-FROM command (its own old name AND any cross-reference to the other two) now uses the NEW cq: name; no reference to a staying command (/plan:advance, /implement:advance, /investigate:advance, /plan:follow-up, /implement:start) was altered. ACCEPTANCE GREP: `grep -rnE '/advance\\b|/plan:start\\b|/investigate:start\\b' nix/pkg/cq-assets/commands/cq/{advance,plan,investigate}.md` returns NO hits (the three relocated files contain none of the three renamed-FROM tokens) — note '/advance\\b' is word-boundary-anchored so it does not match ':advance'. The staying names still appear verbatim wherever they were."
- suggestedModel: standard
- ledgerRefs: ["goals:G22"]

### T197 — planned

- createdAt: 2026-06-06T12:29:58.746Z
- updatedAt: 2026-06-06T12:29:58.746Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: Update scripts/link-prompts.ts LINKS to the new cq/ paths
- description: |
    Update the LINKS array in nix/pkg/cq-ledgers/scripts/link-prompts.ts (L31-50) so the three relocated commands link from their NEW source paths to NEW .claude/ link paths under the cq namespace:
      - { link: '.claude/commands/cq/advance.md',     source: '../cq-assets/commands/cq/advance.md' }   (was .claude/commands/advance.md ← ../cq-assets/commands/advance.md)
      - { link: '.claude/commands/cq/plan.md',        source: '../cq-assets/commands/cq/plan.md' }      (was .claude/commands/plan/start.md ← ../cq-assets/commands/plan/start.md)
      - { link: '.claude/commands/cq/investigate.md', source: '../cq-assets/commands/cq/investigate.md' } (was .claude/commands/investigate/start.md ← ../cq-assets/commands/investigate/start.md)
    
    Leave the *:advance / *:follow-up / agents / existing cq/* (plan-review, implement-review, reviewers) entries unchanged. The .claude link paths should mirror the slash command (/cq:advance → .claude/commands/cq/advance.md) so Claude discovers them in the cq namespace. Then run `bun run link-prompts -- --check` (or `bun link-prompts --check`) which `checkLinks` uses to assert every `source` resolves on disk — it must pass (depends on T196 having created the new source files). If any link-prompts test asserts the LINKS contents, update it to the new paths.
    
    Serialize after T196 (the relocation must land first so the new sources exist).
- acceptance: "`bun run link-prompts -- --check` exits 0 (all targets present). The LINKS array references commands/cq/{advance,plan,investigate}.md as sources and .claude/commands/cq/{advance,plan,investigate}.md as links; no entry points at the old commands/advance.md, commands/plan/start.md, or commands/investigate/start.md paths. `bun run check` from nix/pkg/cq-ledgers/ is green (any link-prompts unit test updated to the new paths passes)."
- suggestedModel: fast
- dependsOn: ["T196"]
- ledgerRefs: ["goals:G22"]

### T198 — planned

- createdAt: 2026-06-06T12:30:21.140Z
- updatedAt: 2026-06-06T12:35:50.622Z
- author: "opus-4.8[1m]"
- session: 58a3012b-08b8-4f7a-816b-008d6fb1d8d5
- headline: "Sweep all cross-references to /advance, /plan:start, /investigate:start → cq:* (other bodies + README)"
- description: |
    Update every INTERNAL cross-reference to the three renamed-FROM command names across the REST of nix/pkg/, EXCLUDING the three files T196 already FULLY owns (commands/cq/{advance,plan,investigate}.md). Partition invariant: T196 owns ALL renamed-FROM refs INSIDE those three relocated files (its own name + cross-refs to the other two); T198 owns everything ELSE under nix/pkg/. No gap, no overlap. Targets:
      - all OTHER files under nix/pkg/cq-assets/commands/ (e.g. plan/advance.md, plan/follow-up.md, implement/{start,advance}.md, investigate/advance.md, cq/{plan-review,implement-review,reviewers,planners}.md) and nix/pkg/cq-assets/agents/*.md;
      - the cq-assets README (if present, e.g. nix/pkg/cq-assets/README.md) — update any command-name listing/table;
      - any skill assets or flow prose under nix/pkg/ that say 're-run /advance', 'run /plan:start', 'kick off /investigate:start', etc. (e.g. SKILL.md set in nix/pkg/llm-skills, llm-contexts) — grep the whole nix/pkg tree, but skip the three relocated files.
    
    Rename mapping (WHOLE-token, careful):
      /advance            → /cq:advance
      /plan:start         → /cq:plan
      /investigate:start  → /cq:investigate
    
    CRITICAL — do NOT touch the STAYING names: /plan:advance, /plan:follow-up, /implement:start, /implement:advance, /investigate:advance must remain verbatim. When replacing '/advance' use a word-boundary match so '/plan:advance', '/implement:advance', '/investigate:advance' are NOT corrupted (they end ':advance', not standalone '/advance'); when replacing '/plan:start' / '/investigate:start' do not touch '/implement:start' (it keeps its name). Also update any prose path mentions if the docs reference the old file locations (commands/advance.md, commands/plan/start.md, commands/investigate/start.md) → the new commands/cq/* paths.
    
    Grep to drive completeness: `grep -rn` for '/advance', '/plan:start', '/investigate:start' across nix/pkg, EXCLUDING commands/cq/{advance,plan,investigate}.md, then fix each remaining hit. Serialize after T197 (keep M72 edits linear).
- acceptance: |
    Acceptance is scoped to nix/pkg/ EXCLUDING the three relocated files T196 owns (commands/cq/{advance,plan,investigate}.md) — exclude them via `--exclude` / a pruning `grep -v` so the sweep is satisfiable independent of T196's in-file edits:
      `grep -rn --exclude-dir=.git '/plan:start\|/investigate:start' nix/pkg/ | grep -v 'commands/cq/\(advance\|plan\|investigate\)\.md'` returns no hits.
      `grep -rnE '(^|[^:])/advance\b' nix/pkg/ | grep -v 'commands/cq/\(advance\|plan\|investigate\)\.md'` (standalone /advance, not *:advance) returns no hits referring to the renamed command.
    (T196's own acceptance grep covers the three excluded files; together the two tasks cover all of nix/pkg with no gap.) The staying names /plan:advance, /plan:follow-up, /implement:start, /implement:advance, /investigate:advance still appear unchanged where they were. The cq-assets README (if any) lists the three commands under their new cq: names. `bun run check` from nix/pkg/cq-ledgers/ stays green (no code touched; doc/markdown only). If a build of the nix asset bundle is feasible, `nix build` of the affected products / the dev-llm assertion (commandKeyToStem collision check) does not regress.
- suggestedModel: standard
- dependsOn: ["T197"]
- ledgerRefs: ["goals:G22"]
