---
ledger: tasks
counters:
  milestone: 0
  item: 107
archives:
  - id: M5
    path: ./archive/tasks/M5.md
    summary: "Dogfood complete: T24 driven to done through the real implement-flow loop (manual worktree (K4 Codex path) -> implement-worker created+committed the marker -> bun run check green in worktree (379 pass) -> implement-reviewer approved 0/0 -> ff merge-back into throwaway dogfood/base). Throwaway branches deleted; nothing landed on main. Two setup findings recorded as defects under goals:G1."
  - id: M2
    path: ./archive/tasks/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
  - id: M3
    path: ./archive/tasks/M3.md
    summary: Build /implement:* command family (goal G1) — complete. Decision K4 (model tiers + dual worktree strategy); implement-worker/-reviewer/-conflict-resolver agents (T5–T7); /implement:start + /implement:advance (T8/T9); plan-advance sets suggestedModel (T11); cross-flow session-log convention (T15); wiring (T10); end-to-end dogfood (T12, defect D2 resolved). Shipped on main (commit 4f430b3).
  - id: M4
    path: ./archive/tasks/M4.md
    summary: Plan-flow maintenance — complete. Subagent MCP tool access made server-name-independent via denylist (T13); /plan:follow-up command + goal re-open transitions, decision K5 (T25); /plan:advance with no argument advances all unlocked goals (T14). Shipped on main (commits 4f430b3, 67727e9).
  - id: M6
    path: ./archive/tasks/M6.md
    summary: UI/schema follow-up (G1) — COMPLETE. reviews `summary` field (T26); summarize() legacy fallback + badge/cell nowrap-ellipsis both UIs (T27); summary threaded through reviewer prompts + implement:advance recorder (T28); fetchLedgerArchive client web+TUI (T29); web subsections + milestone dropdown (T30); TUI column table + subsections (T31); web (T32) + TUI (T33) read-only archive views; integration gate + cross-cutting regression (T34). Tasks T26-T34; reviews R7/R8/R11/R12/R14/R15/R16/R17/R22. Shipped on main; final check 483 pass.
  - id: M7
    path: ./archive/tasks/M7.md
    summary: "investigate:* flow assets (G1 #2) — COMPLETE. Design lock K8 (T35); investigate-explorer read-only evidence-gatherer (T36); /investigate:advance DFS/adjudication loop with file-and-defer handoff + defect-seeded clarify-skip (T37); /investigate:start intake + inline advance (T38, round-1 fixed phantom-subagent); LINKS wiring (T39). Tasks T35-T39; reviews R9/R13/R18/R19. Shipped on main; all investigate:* symlinks resolve; final check 483 pass."
  - id: M8
    path: ./archive/tasks/M8.md
    summary: "defect-awareness in plan:*/implement:* prompts (G1 #2) — COMPLETE. plan-reviewer defects[] bucket (T40); implement-reviewer defects[] JSON (T42); plan-flow defect-aware planning + bidirectional linkage + reviewer-defects file-and-defer + defect-seeded clarify-skip (T41); implement/advance files reviewer defects + orchestrator-owned closure on merge-back (T43); cross-prompt 6-grep-invariant audit (T44). Tasks T40-T44; reviews R23/R24/R25/R26/R27. Shipped on main. Closed loop defect->investigate->plan->implement->resolve confirmed."
  - id: M9
    path: ./archive/tasks/M9.md
    summary: "defect/hypothesis relationship views (G1 #2, Q28 Full) — COMPLETE. Schema-sufficiency spike, no @cq/ledger change (T45); pure shared helpers defectFixTaskIds + hypothesisRelationships (T46); web detail-panel relationship views via ./relationships subpath (T47); TUI content-pane views (T48); cross-UI single-source regression + full-suite gate (T49). Tasks T45-T49; reviews R10/R20/R21/R28. Shipped on main; final check 483 pass."
  - id: M12
    path: ./archive/tasks/M12.md
    summary: G2-W1 shared status→color foundation — COMPLETE. 'warning' StatusBucket + WARNING={revise} (T50, mirror both status.ts); TUI warning=magenta (T51); web canonical BUCKET_HEX single source as --lw-status-* vars, warning=#e0a341 (T52); DagView nodes via shared BUCKET_HEX[statusBucket(status,schema)] (T53). Tasks T50-T53; reviews R34/R40/R43/R44.
  - id: M13
    path: ./archive/tasks/M13.md
    summary: G2-W2 Questions UX — COMPLETE. parseFieldValue string[] on ;/newline, id[] keeps comma (T54); normalizeSuggestions helper+script idempotent (T55, live data-run DEFERRED — run with MCP quiesced + restart); web (T56)+TUI (T57) suggestions bulleted list; web (T58)+TUI (T59) question field order milestone,status,by,question,context,suggestions,recommendation,answer. Tasks T54-T59; reviews R35/R39/R46/R50/R51/R53.
  - id: M16
    path: ./archive/tasks/M16.md
    summary: G3-B never auto-close goals — COMPLETE. implement/advance.md hard rule 'never auto-transition goal building→done' + ready-to-close report, milestone auto-archive preserved (T69); authoritative invariant once in plan-advance.md, building→done stays legal user-driven (T70); verify gate green (T71). Tasks T69-T71; reviews R36/R45/R55.
  - id: M17
    path: ./archive/tasks/M17.md
    summary: G3-A auto-investigate from plan:* — COMPLETE. K12 supersedes K8 pt3 (pins pts1/2/4/5; plan:* commands auto-launch /investigate:advance inline) (T72); plan-advance.md file-only defects (T73); plan/advance.md auto-investigate phase + enumerated convergent stop predicates replacing 4-iter cap (T74); plan/start+follow-up conditional auto-investigate (T75); implement/advance.md 8-round ceiling removed (T76); cross-flow wording reconciled (T77); verify gate (T78). Tasks T72-T78; reviews R37/R38/R48/R49/R52/R56.
  - id: M19
    path: ./archive/tasks/M19.md
    summary: "G2 follow-up #14-#15 — COMPLETE. Web per-suggestion 'pick' button (T86); TUI keys 1-9 pick Nth suggestion (T87); web disable as-recommended+pick on non-whitespace answer, detail+batch (T88); TUI r/1-9 inert + batch Ctrl+R when persisted answer non-empty (T89). Tasks T86-T89; reviews R69-R72. Integration 623 pass."
  - id: M14
    path: ./archive/tasks/M14.md
    summary: G2-W3 column selector + batch-answer + project title — COMPLETE. T60-T68 (eligibleColumnFields/defaultColumns, web+TUI column selectors, web batch-answer modal + TUI overlay, displayName + web/TUI titles). Out-of-scope defects D3 (exports map) + D4 (column eligibility) RESOLVED via G5; Q52 withdrawn (K13). Reviews R54/R57-R61. Shipped on main.
  - id: M18
    path: ./archive/tasks/M18.md
    summary: "G2 follow-up #9-13 — COMPLETE. T79 archived-subsection unification, T80/T81 milestone-status badge (web)/color (TUI), T82 colgroup column proportions, T83/T84 goals flat-list, T85 TUI nav-perf memoization. Out-of-scope D5 (archived-head badge) + D6 (browser-safe constants) RESOLVED via G5; Q53 withdrawn (K13). Reviews R62-R68. Shipped on main."
  - id: M22
    path: ./archive/tasks/M22.md
    summary: G4-W D2 backup-and-reinit — COMPLETE. T94 backupAndReinit helper (timestamped docs/.backup/, ENOENT-tolerant, fresh canonical + WARNING); T95 init() !schemasEqual branch → backup-and-reinit by default + onSchemaDivergence:'abort' opt-out; T96 tests (divergence/abort/no-divergence/empty-dir) + abort-suite migration; T97 repo gate. Defect D2 RESOLVED. Reviews R80/R85/R89/R91. Shipped on main; check 661.
  - id: M24
    path: ./archive/tasks/M24.md
    summary: G5 Fix Unit A @cq/ledger packaging — COMPLETE. T98 realigned package.json main+exports → ./dist/src/* (consistent w/ ./columns); T99 browser-safe ./constants subpath export + web tsconfig paths; T100 App.tsx consumes @cq/ledger/constants, deletes MILESTONE_STATUS_SCHEMA dup; T101 package-exports.test.ts (asserts all export targets exist post-build). Defects D3 + D6 RESOLVED. Reviews R81/R86/R87/R88. Shipped on main.
  - id: M25
    path: ./archive/tasks/M25.md
    summary: G5 Fix Unit B column eligibility — COMPLETE. T102 added SUMMARY_SOURCE_FIELDS {headline,title,question} excluded from eligibleColumnFields (grounded in summarize() precedence) + first columns.test.ts; suggestedModel still eligible. Defect D4 RESOLVED. Review R82. Shipped on main.
  - id: M26
    path: ./archive/tasks/M26.md
    summary: "G5 Fix Unit C archived-head status badge — COMPLETE. T104 passes archived pointer status as milestoneStatus to the archived MilestoneSubsection (empty-status guarded) → T80 badge renders for archived heads; happy-dom test. T103 withdrawn (R77: no @cq/shared wire mirror — T91's ArchivePointer.status flows over the wire as-is). Defect D5 RESOLVED. Review R92. Shipped on main; check 661."
---

# tasks

## M21

### T90 — done

- createdAt: 2026-06-02T16:17:46.146Z
- updatedAt: 2026-06-02T18:25:13.017Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Web: do not render archived subsections for the MILESTONES ledger (fix D7 / item 16)"
- description: Fixes D7 (G2 follow-up #4 item 16). In packages/ledger-web/src/App.tsx, gate the `<ArchiveSubsections .../>` render (currently at ~L1193-1205, conditioned only on `showArchive && view.archivePointers.length > 0 && client !== null && ledger !== null`) on `!isMilestones`, so the milestones ledger view does NOT render archived per-milestone subsections (each archived milestone is already its own row in the flat ItemTable isMilestones branch; rendering it again duplicates it). `isMilestones` is already computed/in scope in App. Do NOT change the non-milestones path — those ledgers must still show their archived coordination-milestone subsections. Surgical change.
- acceptance: "happy-dom test: with the MILESTONES ledger selected and showArchive enabled, no `data-testid=archive-section` (and no archived `ms-section-*` duplicating an already-listed milestone row) is rendered; with a NON-milestones ledger selected and showArchive enabled, the archive subsections still render. `bun run check` (bun test + tsc -b + eslint) passes."
- suggestedModel: standard
- ledgerRefs: ["defects:D7","goals:G2"]
- resultCommit: 208b446
- completion: Added `&& !isMilestones` to the ArchiveSubsections JSX gate (App.tsx ~L1193) so the MILESTONES ledger no longer renders archived per-milestone subsections (already shown as flat rows); non-milestones unchanged. fakeClient milestones-archive entry + 2 happy-dom tests (repro fails pre-fix). Reviewer approve 0/0.

### T91 — done

- createdAt: 2026-06-02T16:17:55.978Z
- updatedAt: 2026-06-02T18:48:58.607Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Web: archived milestone section heads show milestone title, not description (fix D8 / item 17)"
- description: |
    Fixes D8 (G2 follow-up #4 item 17). In packages/ledger-web/src/App.tsx the ArchiveSubsections component builds the head label from the archive pointer `summary` (~L2000: `p.summary.length > 0 ? `${p.id}: ${p.summary}` : p.id`), which carries the milestone DESCRIPTION, not its TITLE. Active milestone sections show the title. Render the milestone `title` in archived heads for parity.
    
    MECHANISM IS NOT IMPLEMENTER'S CHOICE (R73 revision): archived sections default COLLAPSED and lazy-fetch their group content on first expand (ArchiveSubsections ~L1939-1981; app.test.tsx L724-754). Deriving the title from the lazily-fetched ArchiveContent group payload (c.milestone.title) only populates AFTER expand, so a COLLAPSED head built that way would show p.id / p.summary (description) — NOT the title. Therefore the title MUST come from EXTENDING the ArchivePointer payload at the MCP/server boundary: add a `title` field to the ArchivePointer shape in packages/ledger/src/types.ts (ArchivePointer ~L155) AND populate it wherever the server builds archive pointers (the `archivePointers[]` returned by fetch_ledger), then use `p.title` for the archived head label. This is a small `@cq/ledger` + server change. No back-compat constraint (dogfood only).
    
    COORDINATE WITH D5 (R73 non-blocking note): open defect D5 proposes the SAME ArchivePointer-payload extension to carry the milestone terminal `status` (for the #10 archived-head status badge). Do the payload extension ONCE: add BOTH `title` and `status` to the ArchivePointer shape + server build in this task, so D5 does not require a second boundary edit. This task closes the `title` half (its own acceptance) and lands the `status` field too; note that on D5 (D5 stays open for its consuming badge-render work, but its payload-extension prerequisite is satisfied here). Reference defects:D5.
    
    Coordinate with T90: both edit the App.tsx archive render path — sequence after T90 to avoid merge contention. Keep the change surgical.
- acceptance: "happy-dom test: a COLLAPSED (un-expanded) archived milestone section head displays the milestone `title` (NOT its long `description`) — this is satisfiable only via the ArchivePointer-payload `title`, which the test thereby exercises. A unit/type assertion covers the extended ArchivePointer shape (new `title` field, and `status` landed for D5), and the server populates both. `bun run check` (bun test + tsc -b + eslint) passes."
- suggestedModel: standard
- dependsOn: ["T90"]
- ledgerRefs: ["defects:D8","defects:D5","goals:G2"]
- resultCommit: 98e50c6
- completion: "Extended ArchivePointer with title+status, populated at archive time in both FsLedgerStore + InMemoryLedgerStore; frontmatter parser backward-compat defaults; archived head label p.summary→p.title. happy-dom collapsed-head title test (repro-verified). Lands status field for D5/T104. Reviewer approve 0/0 (filed out-of-scope D10: InMemory partial-mutation parity). Resolves D8."

### T92 — done

- createdAt: 2026-06-02T16:18:12.738Z
- updatedAt: 2026-06-02T18:49:01.916Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Retire routing-questions from the flow prompts per K13 (item 18): file-the-defect only, no `/investigate:start` pointer question"
- description: |
    Implements locked decision K13 (G2 follow-up #4 item 18), which REFINES K8/Q26 file-and-defer: the 'defer' half must NOT manifest as a `questions` item. Edit the prompt suite so orchestrators file the `open` defect (triage note in the defect's OWN fields) ONLY and never create a 'run /investigate:start <D>' routing question.
    
    WHERE THE REAL EDIT IS (R73 confirmation — do not hunt for non-existent text):
    1. llm/commands/implement/advance.md §3 — the ONLY file that actually contains a `/investigate:start <D>` routing-question step (the reviewer defects[] file-and-defer, ~L103-108). REAL DELETION: remove the step that creates the 'run /investigate:start <D>' open question; KEEP filing the open defect with the triage note in its fields.
    2. llm/commands/plan/advance.md — ALREADY CONFORMS to K13: its auto-investigate worklist is derived by LEDGER QUERY (~L87-98) and it contains NO routing-question creation. This is a VERIFY / guard step: confirm the LEDGER-QUERY framing still holds and that no routing-question text exists; expect a verify-no-op (no edit, or at most a one-line clarifying touch). Do NOT invent a deletion here.
    3. llm/agents/plan-reviewer.md — ALREADY CONFORMS: its defects[] bucket is report-only (~L62-78), no routing question. VERIFY-no-op / light touch only; confirm the report-only framing, do not invent a deletion.
    
    Preserve file-and-defer's NON-blocking property in all three (defects still do not block the in-scope task; still gate milestone archival until terminal). Rationale to embed in the edited prose: /investigate:start already accepts a BARE defect id (^D\d+$ intake-resume path), and an open defect linked via ledgerRefs is discoverable by ledger query — no pointer-question needed.
    
    NOTE — the one-time ledger-data cleanup half of item 18 is ALREADY DONE (this planning run): routing questions Q52 (D3/D4) and Q53 (D5/D6) were set status=withdrawn, and their triage notes were verified already present on the D3/D4/D5/D6 defect records (description + suggestedFix), so no fold was needed. This task is therefore the PROMPT EDITS only (effectively the single deletion in implement/advance.md §3 plus the two verify-confirmations); as a guard, assert no remaining `open` routing-question items exist.
- acceptance: "llm/commands/implement/advance.md §3 no longer instructs creating a `run /investigate:start <D>` routing question (it files the open defect with triage note only); llm/commands/plan/advance.md and llm/agents/plan-reviewer.md are confirmed already conforming (LEDGER-QUERY worklist / report-only defects[] bucket respectively — verify-no-op, no routing-question text present). All three explicitly preserve non-blocking file-and-defer. No `open` questions item remains whose sole purpose is an /investigate:start pointer (Q52/Q53 already withdrawn). `bun run check` passes (markdown-only edits should not regress it; run it to confirm)."
- suggestedModel: standard
- ledgerRefs: ["decisions:K13","goals:G2"]
- resultCommit: a858b51
- completion: "implement/advance.md §3: removed the create_item('questions',...) routing step (K13), kept open-defect filing + embedded bare-defect-id/ledger-query rationale; non-blocking property preserved. plan/advance.md + plan-reviewer.md verified no-op (already conform). Reviewer approve 0/0."

### T93 — done

- createdAt: 2026-06-02T16:18:24.658Z
- updatedAt: 2026-06-02T19:12:36.575Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Web: make the batch-answer modal wider and taller with a slightly reduced font (item 19)"
- description: |
    G2 follow-up #4 item 19 (FEATURE/POLISH). The batch answer-questions modal (item #5 / T63, done @ commit e677b77, the `.lw-batch` dialog rendered by BatchAnswerModal in packages/ledger-web/src/App.tsx) is currently sized larger-font but cramped.
    
    RE-GROUNDED (R73 revision): packages/ledger-web/src/styles.css (full ~763-line file) contains NO `.lw-batch`, `.lw-batch-body`, or `.lw-batch-nav` rule today. The batch modal reused the HelpOverlay backdrop pattern; `.lw-batch` exists only as a MARKER class on the dialog element (queried in app.test.tsx L1039 as q('.lw-batch')) with no backing CSS rule, and `.lw-batch-body`/`.lw-batch-nav` are unconfirmed anywhere. So the work is to ADD/DEFINE new modal-sizing CSS rules, NOT to tune pre-existing ones.
    
    Work: FIRST confirm against the actual BatchAnswerModal JSX which element(s) carry the box / body / nav classes the rules must target. THEN in packages/ledger-web/src/styles.css ADD a rule for the batch dialog (`.lw-batch`) giving it an explicit WIDER + TALLER box (explicit width/height — larger than the current backdrop-default sizing — via viewport-relative caps like max-width/max-height with vw/vh) and a slightly REDUCED font-size, plus a body rule so long questions SCROLL inside the body (overflow handling) rather than overflowing the dialog. Keep it within the viewport. CSS-only change — no App.tsx logic edits, so this is disjoint from T90/T91 and can proceed in parallel. Match surrounding styles.css conventions.
- acceptance: "happy-dom assertion on the modal: the `.lw-batch` dialog renders carrying the expected sizing class/dimensions — assert its width/height (or max-width/max-height) and font-size resolve to the new larger-box / smaller-font values (via computed style or the literal newly-added CSS rule the test reads). Modal content scrolls within the body for long questions rather than overflowing. `bun run check` passes."
- suggestedModel: fast
- ledgerRefs: ["goals:G2"]
- resultCommit: 261b48f
- completion: "styles.css .lw-batch: width min(900px,90vw) (wider), max-height 90vh (taller than prior 88vh), font-size 0.95rem (reduced), overflow-y auto (scrolls). New batchModalSizing.test.tsx asserts the sizing + non-vacuous scroll clause. Round 1: corrected max-height 85vh→90vh (round-0 had decreased it) + test. Reviewer approve round 1."

## M28

### T105 — planned

- createdAt: 2026-06-02T19:52:29.136Z
- updatedAt: 2026-06-02T19:58:04.984Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D9: de-flake ledger-tui HTTP McpLedgerClient tests (ephemeral port + TCP readiness wait, reuse pty.e2e helpers)"
- description: |
    FIX UNIT A (D9, low). packages/ledger-tui/test/{mcpClient,displayName}.test.ts run McpLedgerClient over HTTP and intermittently fail with 'Unable to connect' under full-suite concurrency. ROOT CAUSE (refined per R93): these harnesses ALREADY run a GET-based waitForServer readiness probe before McpLedgerClient.connect, so the bare-connect-before-listening framing is imprecise — the real flake mechanism is the FIXED ports (mcpClient.test.ts uses 7793, displayName.test.ts uses 7795) colliding under concurrent test execution, and/or the GET probe returning before the MCP session layer is fully ready.
    
    FIX (test harness only; no product-code diff): switch both flaky HTTP tests off fixed ports onto an EPHEMERAL/OS-assigned port, and wait for the server to actually accept connections via a TCP readiness wait. REUSE the existing proven precedent rather than reinventing it: pty.e2e.test.ts:49-76 already implements `freePort()` (bind :0, read the OS-assigned port) + `waitForPort()` (raw TCP connect loop). If those helpers are local to pty.e2e.test.ts, EXTRACT them into a shared test helper module and import from all three sites; otherwise import the existing ones.
    
    AVOID merely relocating the race: do NOT bind-then-close-then-reuse a port (the freePort() bind-:0-read-close pattern has a TOCTOU window between releasing the port and the server re-binding it). PREFER either (a) letting the server bind port 0 / OS-assigned and reading back the actual listening port (no intermediate close), or (b) retry-on-EADDRINUSE, combined with the TCP-connect `waitForPort()` readiness wait (preferred over the bare-GET probe). Reproduction note: the flake is intermittent — verify by running the ledger-tui suite repeatedly and observing no connection-race failures.
- acceptance: The affected ledger-tui HTTP McpLedgerClient tests (mcpClient.test.ts, displayName.test.ts) use a NON-FIXED (ephemeral / OS-assigned) port plus a TCP-connect readiness wait (reusing/sharing pty.e2e.test.ts's freePort()+waitForPort() rather than reinventing), with no bind-then-close TOCTOU reintroducing the race; tests are deterministic across repeated full-suite runs (no 'Unable to connect'); `bun run check` green across multiple consecutive runs. Fix confined to the test harness (no product-code diff).
- suggestedModel: standard
- ledgerRefs: ["defects:D9","goals:G6"]

### T106 — planned

- createdAt: 2026-06-02T19:52:36.278Z
- updatedAt: 2026-06-02T19:58:14.865Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D10: dual-store assertion — no partial mutation after Phase-1b non-terminal archiveMilestone rejection"
- description: |
    FIX UNIT B (D10, low; test-hardening). The behavior is ALREADY fixed: T91 added the Phase-1b terminal guard to InMemoryLedgerStore.performArchive (parity with FsLedgerStore — a non-terminal milestone-ITEM now rejects BEFORE any Phase-2 mutation). The remaining gap is test coverage: the current dual-store abstract suite (store-abstract.ts:261) asserts only the throw, not the no-partial-mutation post-state.
    
    FIX: in packages/ledger/test/store-abstract.ts, extending the existing throw-only assertion at store-abstract.ts:261, add an abstract assertion that after a non-terminal archiveMilestone REJECTION, the non-milestones ledger groups remain ATTACHED (no partial archive), run against BOTH adapters via the existing dual-store harness (FsLedgerStore + InMemoryLedgerStore).
    
    PIN THE SCENARIO (per R93 — the reproduction claim only holds for the Phase-1b path): the rejection MUST come via the Phase-1b milestone-item-non-terminal gate, NOT Phase-1. Concretely: make ALL non-milestones group items TERMINAL (e.g. updateItem(it1, resolved) as at store-abstract.ts:261) while the milestone-ITEM itself stays NON-TERMINAL (open), so performArchive passes Phase-1 and is rejected by the Phase-1b guard (InMemoryLedgerStore.ts ~L464-497) which runs BEFORE Phase-2 (~L500). Then assert the non-milestones groups remain attached. This pinning matters because if the test instead rejects via Phase-1 (a non-terminal GROUP item), no Phase-2 mutation ever runs and the assertion would pass even pre-T91 — a non-reproduction. NOTE in the test that this assertion FAILS against pre-T91 InMemory behavior (where Phase-2 mutated before the Phase-3 throw) and passes now.
- acceptance: "New abstract-suite assertion in packages/ledger/test/store-abstract.ts (extending the throw-only assertion at :261) that PINS the Phase-1b path — all non-milestones group items terminal + milestone-item non-terminal — then asserts the non-milestones groups stay ATTACHED after the rejection; runs against BOTH FsLedgerStore and InMemoryLedgerStore; documented to FAIL against pre-T91 InMemory behavior (reproduction) and pass now; `bun run check` green."
- suggestedModel: standard
- ledgerRefs: ["defects:D10","goals:G6"]

### T107 — planned

- createdAt: 2026-06-02T19:52:42.815Z
- updatedAt: 2026-06-02T19:52:42.815Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D11: make web .lw-toolbar sticky at top of scroll container (styles.css + happy-dom test)"
- description: "FIX UNIT C (D11, low). In ledger-web, .lw-toolbar (styles.css:305) is a normal-flow row inside the scroll container .lw-main (styles.css:274, overflow:auto, padding 8px 12px), so it scrolls away with the items. FIX: give .lw-toolbar `position: sticky; top: 0;` plus an opaque background (var(--bg)/--panel) and a z-index BELOW the column-selector popup (which is z-index:10 at styles.css:316) so the popup still layers above the sticky bar. Handle the .lw-main padding (8px 12px): offset the sticky top so items don't peek above the bar, and make the bar background span the horizontal gutters (e.g. negative side margins + matching padding) so scrolled content doesn't show beside it. Add a happy-dom test asserting the .lw-toolbar rule carries position:sticky (actual scroll behavior isn't observable under happy-dom — assert the rule). TUI is unaffected. Honor the pure-MCP-client invariant (no direct docs/ reads)."
- acceptance: "styles.css .lw-toolbar carries position:sticky; top:0 with opaque background and z-index below the column-selector popup (z-index:10); .lw-main padding handled so items don't peek above the bar and the bar spans the gutters. A happy-dom test asserts the .lw-toolbar rule has position:sticky. `bun run check` green."
- suggestedModel: standard
- ledgerRefs: ["defects:D11","goals:G6"]
