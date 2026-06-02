---
ledger: questions
counters:
  milestone: 0
  item: 60
archives:
  - id: M2
    path: ./archive/questions/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
    title: ""
    status: ""
  - id: M14
    path: ./archive/questions/M14.md
    summary: G2-W3 column selector + batch-answer + project title — COMPLETE. T60-T68 (eligibleColumnFields/defaultColumns, web+TUI column selectors, web batch-answer modal + TUI overlay, displayName + web/TUI titles). Out-of-scope defects D3 (exports map) + D4 (column eligibility) RESOLVED via G5; Q52 withdrawn (K13). Reviews R54/R57-R61. Shipped on main.
    title: ""
    status: ""
  - id: M18
    path: ./archive/questions/M18.md
    summary: "G2 follow-up #9-13 — COMPLETE. T79 archived-subsection unification, T80/T81 milestone-status badge (web)/color (TUI), T82 colgroup column proportions, T83/T84 goals flat-list, T85 TUI nav-perf memoization. Out-of-scope D5 (archived-head badge) + D6 (browser-safe constants) RESOLVED via G5; Q53 withdrawn (K13). Reviews R62-R68. Shipped on main."
    title: ""
    status: ""
---

# questions

## M1

### Q1 — answered

- createdAt: 2026-06-01T19:28:58.613Z
- updatedAt: 2026-06-01T19:38:54.271Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: "Worktree lifecycle: native subagent isolation vs. manual git worktree?"
- context: "Claude Code provides per-subagent `isolation: worktree` (auto-create, auto-remove on no-change, no auto-merge), but the goal text says 'create a git worktree' explicitly. These imply different orchestrator code."
- suggestions: ["Use native `isolation: worktree` subagent frontmatter; orchestrator only handles merge-back","Orchestrator manually runs `git worktree add/remove` per task","Hybrid: native isolation + explicit orchestrator cleanup"]
- recommendation: "Native `isolation: worktree` for the implementor subagent; orchestrator owns merge-back and conflict handling."
- ledgerRefs: ["goals:G1"]
- answer: Use native isolation. But you should tell me if it works on both codex and claude.

### Q2 — answered

- createdAt: 2026-06-01T19:29:02.282Z
- updatedAt: 2026-06-01T19:39:19.694Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: What is the concurrency degree for dispatching independent tasks?
- context: "'every independent pending task' could dispatch unbounded parallel subagents; docs cite 4-8 concurrent worktrees as practical, with Workflow for dozens+. Need a cap."
- suggestions: ["Fixed cap (e.g. 4)","Configurable via command arg","Sequential (one task at a time) for v1"]
- recommendation: Configurable cap, default 4; sequential fallback if unset.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q3 — answered

- createdAt: 2026-06-01T19:29:05.992Z
- updatedAt: 2026-06-01T19:41:26.676Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: Where does the task's 'suggested model' live — add a `suggestedModel` field to the tasks schema?
- context: The goal references a per-task suggested-model and wants a WARNING when unset. The `questions` ledger already has `suggestedModel`, but the `tasks` schema may not. Adding it touches @cq/ledger schema, MCP, and TUI/web clients.
- suggestions: ["Add `suggestedModel` to the tasks schema (and surface in TUI/web)","Read it from an existing free-form field / ledgerRefs convention","Defer model-per-task; always use orchestrator's own class for v1"]
- recommendation: Add an optional `suggestedModel` field to the tasks schema.
- ledgerRefs: ["goals:G1"]
- answer: "Yes, it was supposed to already be there. Check. If not - add. Make sure our /plan:* workflow fills this field!"

### Q4 — answered

- createdAt: 2026-06-01T19:29:10.182Z
- updatedAt: 2026-06-01T19:42:17.378Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: Model resolution & capability ordering for implementor and reviewer?
- context: Agent `model` accepts only sonnet|opus|haiku|inherit|full-ID. Goal wants implementor to default to 'orchestrator's own model class' and reviewer to use 'the most capable model available'. Need the concrete mapping and capability ranking.
- suggestions: ["opus > sonnet > haiku; reviewer always opus","Use `inherit` for implementor default; reviewer pinned to opus","Caller passes explicit model IDs"]
- recommendation: "Implementor: `suggestedModel` else `inherit`; reviewer: opus. Capability order opus > sonnet > haiku."
- ledgerRefs: ["goals:G1"]
- answer: as recommended - but you should account for codex

### Q5 — answered

- createdAt: 2026-06-01T19:29:12.938Z
- updatedAt: 2026-06-01T19:43:40.383Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: What bounds the autonomous criticism (fix-review) loop?
- context: "'criticism handled autonomously in a loop' needs a hard cap to prevent runaway cost (plan-flow caps at 4). Need iteration cap and exhaustion behavior."
- suggestions: ["Cap at 3 fix-review rounds","then register a question","Cap configurable","Cap then mark task blocked/failed"]
- recommendation: Cap at 3 rounds; on exhaustion register a question and stop the task.
- ledgerRefs: ["goals:G1"]
- answer: No iteration cap. The orchestrator should validate implementer/reviewer results for sanity. It should only stop if it detects ill loops.

### Q6 — answered

- createdAt: 2026-06-01T19:29:16.892Z
- updatedAt: 2026-06-01T19:46:45.848Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: Merge-back strategy & conflict handling for parallel worktrees?
- context: Parallel worktrees must integrate into the base branch; conflict and ordering policy are undecided.
- suggestions: ["Sequential merge in DAG order; rebase each remaining worktree on updated base","Integration branch","test","then single merge to main","Open a PR per task","human merges"]
- recommendation: Sequential merge in dependency order with rebase-before-merge; on conflict, register a question and leave the worktree intact.
- ledgerRefs: ["goals:G1"]
- answer: Sequential merge in dependency order with rebase-before-merge. On conflict the model should run a subagent to resolve conflict automatically.

### Q7 — answered

- createdAt: 2026-06-01T19:29:20.981Z
- updatedAt: 2026-06-01T19:47:53.788Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: "Question registration & /implement:advance resumption semantics?"
- context: "Reviewer questions must be registered in the ledger and gate the task until the user answers, then /implement:advance resumes. Need the ledger model: reuse the `questions` ledger with a task->question link? What task status represents 'blocked on a question'?"
- suggestions: ["Reuse `questions` ledger","link via ledgerRefs `tasks:<id>`; introduce a blocked marker the advance loop scans","Add a new task status value for blocked-on-question","Per-goal coordination milestone mirroring plan-flow's M"]
- recommendation: Reuse `questions` ledger linked to the task; introduce/confirm a 'blocked' task status the advance loop scans for.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q8 — answered

- createdAt: 2026-06-01T19:29:24.783Z
- updatedAt: 2026-06-01T19:48:31.479Z
- author: user
- session: 86ec6253-6f0d-405a-9a97-a89319e33ce3
- question: What defines task success and how are failures handled (checks / subagent crash)?
- context: "The goal lists 'failure handling' but does not define it. The repo gate is `bun run check` (tsc + eslint + bun test). Need: what counts as task success, and what happens on implementor failure or non-passing check."
- suggestions: ["Task success = `bun run check` passes in the worktree AND reviewer approves; check failure feeds the criticism loop","Reviewer is the sole gate; checks advisory","Hard-fail the task and surface to user immediately"]
- recommendation: Define task success as `bun run check` green AND reviewer go-ahead; on check failure feed output into the criticism loop.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q11 — answered

- createdAt: 2026-06-01T23:07:00.582Z
- updatedAt: 2026-06-01T23:16:44.241Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Archived items (req 1): how should the UIs surface archives, and what is the read contract? The store keeps archives at ./archive/<ledger>/<id>.md; the MCP exposes fetch_ledger_archive(ledger_id, archive_id) for ONE archive plus archivePointers[] on fetch_ledger, but neither the web nor TUI client exposes archive reads and there is no 'list all archives' enumeration tool. Should viewing archives reuse the per-ledger archivePointers + fetch_ledger_archive (per-ledger, milestone-scoped), or do we add a new cross-ledger 'enumerate_archives' MCP tool first?"
- context: fetch_ledger already returns archivePointers (id, path, summary) per ledger; fetch_ledger_archive returns either a whole archived milestone-group (non-milestones ledger) or a single archived milestone-item (milestones ledger). The web mcpClient does not even implement fetchLedgerArchive yet. Archived items are detached and terminal.
- suggestions: ["Reuse existing archivePointers + fetch_ledger_archive; add an 'archived' toggle/section per ledger that lazily fetches a chosen milestone's archive","Add a new enumerate_archives MCP tool (cross-ledger list of pointers) then build a dedicated archive browser","Just make ftsSearch include_archived=true reachable from the search box (read-only","no dedicated browser)"]
- recommendation: "Reuse archivePointers + fetch_ledger_archive: add an 'archived' affordance per ledger that lists its archive pointers and expands a selected milestone's archived items read-only. No new MCP tool unless a cross-ledger view is wanted."
- ledgerRefs: ["goals:G1"]
- answer: as recommended but you could add new mcp tools if you think the agents may benefit from having them!

### Q12 — answered

- createdAt: 2026-06-01T23:07:07.420Z
- updatedAt: 2026-06-01T23:11:12.480Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Archived items (req 1): should archived items be read-only in both UIs, and should they ALSO appear in the TUI (which currently has no archive affordance at all, only status filters)? The web detail panel has edit/save and quick-transition buttons; archived items are detached/terminal and the store has no 'update archived item' path."
- context: Both UIs share the same edit affordances (status, fields, transitions, answer). Surfacing archives must suppress those for archived items. The TUI also needs a new navigation entry to reach archives, unlike the web where it could be a toggle in the existing toolbar.
- suggestions: ["Archives strictly read-only in both UIs; reach them via a dedicated toggle/section per ledger","Read-only in web only for v1; defer the TUI archive view","Read-only, and reached via a distinct top-level 'archived' pseudo-ledger entry in both"]
- recommendation: Strictly read-only in BOTH UIs (no edit/transition/answer controls); reach archives via a per-ledger 'show archived' toggle that lists archive pointers and expands one milestone's items.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q13 — answered

- createdAt: 2026-06-01T23:07:19.156Z
- updatedAt: 2026-06-01T23:13:11.384Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Per-milestone filter (req 2) + milestone subsections (req 3): are these the SAME feature or two? Today the web ItemTable is a flat <table> with a 'milestone' column and a single status <select>. Option A: add a second milestone <select> (filter to one milestone, ANDed with status). Option B: drop the milestone column and instead render the table as per-milestone subsections (a milestone header row, then its items), which is itself a form of grouping/filtering. Do you want a milestone DROPDOWN filter, milestone SUBSECTIONS, or both (subsections by default + a dropdown to narrow to one)?"
- context: "Req 2 asks for a per-milestone filter control; req 3 asks for milestone table subsections. They overlap: subsections group by milestone; a filter narrows to one. Implementing both naively double-counts the work and competes for the same toolbar/table space."
- suggestions: ["Both: render milestone subsections by default AND add a milestone dropdown that collapses to one milestone (subsection becomes the only group)","Dropdown filter only (req 2), keep the flat milestone column; no subsections","Subsections only (req 3), drop the dropdown — grouping replaces filtering"]
- recommendation: "Both, unified: render per-milestone subsections (collapsible header + its rows) and add a milestone dropdown that narrows to a single milestone; status filter ANDs with it. Drop the redundant per-row milestone column once subsections show it in the header."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q14 — answered

- createdAt: 2026-06-01T23:07:25.871Z
- updatedAt: 2026-06-01T23:11:59.537Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Milestone subsections (req 3): which views get them, and does the subsection ordering follow the milestones DAG (dependsOn) or insertion order? You said 'ledger views where items include a milestone field' — that is every non-milestones ledger (all items carry milestoneId). Should subsections appear in BOTH the web table AND the new TUI table (req 4), and should the milestones ledger itself (where the 'milestone' IS the item) be excluded?"
- context: "Every non-milestones item has a milestoneId; fetch_ledger already returns items grouped into FetchedMilestoneGroup[] with resolved milestone title/status, so grouping data is available without extra calls. The milestones ledger groups under M0 only."
- suggestions: ["Subsections in both web and TUI tables, in fetch_ledger group order, with the resolved milestone title+status as the header; exclude the milestones ledger","Web only for v1; TUI keeps a flat (but column-aligned) table","Subsections everywhere including a synthetic header for the milestones ledger"]
- recommendation: Subsections in BOTH web and TUI tables, ordered as fetch_ledger returns the groups (insertion order), header = resolved milestone id + title + status; the milestones ledger is excluded (it has no meaningful sub-grouping).
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q15 — answered

- createdAt: 2026-06-01T23:07:37.780Z
- updatedAt: 2026-06-01T23:13:59.576Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "TUI column table (req 4): which columns, and how should they degrade in a narrow left pane? The TUI list renders each row as one ink <Text> string 'id [status] summary' inside ScrollList (with a cursor prefix and an optional 1-char scrollbar column), and the pane width is user-resizable (ratio 0.2–0.8) and can dock right or bottom. A column table needs a fixed id-width and status-width with the summary truncating. Should columns be id | status | summary (matching the row content today), or also include milestone (id | milestone | status | summary, mirroring the web table)?"
- context: Misalignment comes from variable id width ('T1' vs 'T14'). The fix is to right-pad the id column to the max id width in the visible set (or a fixed width) and color the status in its own column. The left pane can be very narrow, so the summary must truncate-end (already the wrap mode used).
- suggestions: ["Columns id | status | summary, id padded to the max id width in view, status to the max status width; summary truncates. No milestone column (subsections from req 3 carry milestone)","Columns id | milestone | status | summary mirroring the web table","Fixed id width (e.g. 5) + fixed status width; simplest, no per-view measurement"]
- recommendation: "Columns id | status | summary: pad id to the max id width among visible rows and status to the schema's max statusValue width; summary truncate-end. No milestone column — milestone is conveyed by the req-3 subsection header."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q16 — answered

- createdAt: 2026-06-01T23:07:46.666Z
- updatedAt: 2026-06-01T23:09:57.269Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Reviews summary (req 5): the schema change. Confirmed: docs/ledgers.yaml reviews schema has new_questions[], criticism[], ledgerRefs[], tags[], sourceRefs[] — no 'summary'. The summary column shows criticism because summarize() falls through to the first field. Should 'summary' be an OPTIONAL string field (back-compat: existing reviews have none, so summarize() still needs a graceful fallback), and must I also update examples/sample-ledger/docs/ledgers.yaml and any canonical-ledgers test/seed? And: is summary a single line (a title) or a short paragraph?"
- context: "summarize() in both UIs picks headline ?? title ?? question ?? summary ?? Object.values(f)[0]. Adding an optional 'summary' makes it the natural pick for reviews. docs/ledgers.yaml is the live registry; examples/sample-ledger has its own copy; canonical-ledgers.test.ts asserts the canonical set. Making summary required would break every existing review item."
- suggestions: ["Optional single-line 'summary' string; update docs + examples + canonical tests; summarize() prefers it, falls back to a truncated criticism when absent","Required summary (forces every new review to set it; needs a migration/backfill for existing R1)","No schema change; just fix the UI summary column to truncate criticism (req 5 wrapping only)"]
- recommendation: Add an OPTIONAL single-line 'summary' string to the reviews schema; update docs/ledgers.yaml, examples/sample-ledger, and the canonical-ledgers test; summarize() prefers summary and falls back to a truncated first-criticism line for legacy reviews.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q17 — answered

- createdAt: 2026-06-01T23:07:58.026Z
- updatedAt: 2026-06-01T23:09:07.830Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Reviews badge wrapping (req 5): the status badge wraps badly because the long criticism text in the summary cell pushes layout. Once 'summary' replaces criticism in the summary column, is a CSS fix to the status badge (white-space:nowrap on .lw-status, plus a max-width/ellipsis on the summary cell) sufficient, or do you also want the summary cell itself clamped to one line with ellipsis across ALL ledgers (not just reviews)?"
- context: "The web ItemTable status cell renders <span class='lw-status lw-status-<bucket>'>. The summary <td> currently shows the full first field with no clamp. Reviews' criticism is a string[] joined with ', ' so it is very long. The fix has a schema half (Q16) and a pure-CSS/render half (this)."
- suggestions: ["nowrap the status badge + single-line ellipsis on the summary cell for ALL ledgers (uniform table rows)","Only nowrap the badge; leave summary wrapping as-is for non-review ledgers","Clamp summary to 1–2 lines (line-clamp) rather than a hard single-line ellipsis"]
- recommendation: nowrap the status badge AND clamp the summary cell to a single line with ellipsis for ALL ledgers (uniform, predictable row height); the schema 'summary' field (Q16) makes the reviews summary short anyway.
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q18 — answered

- createdAt: 2026-06-01T23:08:08.090Z
- updatedAt: 2026-06-01T23:15:10.339Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45784023493
- question: "Reviews summary (req 5): the prompt changes — scope and write path. Both reviewers must populate the new 'summary'. plan-reviewer.md writes its reviews item directly via create_item, so it just adds summary to the fields. implement-reviewer.md writes NOTHING — it returns a JSON block (taskId/verdict/criticism/questions/rationale) that the /implement:advance orchestrator records as the terminal reviews item. So req 5 also needs: (a) implement-reviewer's JSON contract gains a 'summary' field, and (b) the implement:advance command (llm/commands/implement/advance.md) must map it into the create_item fields. Confirm both prompt files AND the implement:advance orchestrator are in scope, and should plan-reviewer's existing R-format examples be updated too?"
- context: plan-reviewer.md create_item example currently sets new_questions/criticism/ledgerRefs only. implement-reviewer.md defines the JSON the orchestrator parses. The implement command family was just designed under this same goal (milestone M3) and its prompts may not be written yet — the summary field should be baked in from the start there.
- suggestions: ["In scope: plan-reviewer.md (add summary to its create_item), implement-reviewer.md (add summary to its JSON contract), and implement:advance.md (map summary → create_item). Summary = one-line verdict gist.","Only plan-reviewer for now; implement-* prompts handle summary when they are authored under M3","Add summary to the JSON contract only; let the orchestrator synthesize a summary if the field is missing"]
- recommendation: "All three in scope: add an optional one-line 'summary' to plan-reviewer's create_item, to implement-reviewer's JSON contract, and have implement:advance map it into the recorded reviews item (synthesizing a fallback from the rationale/verdict if the model omits it)."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q19 — answered

- createdAt: 2026-06-01T23:28:44.233Z
- updatedAt: 2026-06-01T23:29:52.436Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Defects vs tasks in plan/implement: parametrize the SAME prompts over a 'work-item ledger' (tasks|defects), or add a thin defect-specific layer on top? The two schemas differ materially: defects use status open/wip/blocked/resolved/abandoned with required `severity`, plus `rootCause`/`suggestedFix`/`fix`; tasks use planned/wip/done/blocked/abandoned with `acceptance`/`resultCommit`/`completion`. The implement loop's READY-SET, success gate ('check green AND reviewer approve'), and merge-back all assume task vocabulary."
- context: "docs/ledgers.yaml: defects schema already exists with rootCause/suggestedFix/fix/severity(required)/dependsOn/ledgerRefs/suggestedModel and terminal=resolved/abandoned; tasks terminal=done/abandoned. The follow-up says they are 'very similar, just ledger names/metadata differ' — but the status sets and required fields differ, so a naive parametrization needs a status/terminal/required-field mapping. Decisive for how every plan/implement prompt is edited."
- suggestions: ["Generalize prompts over a {ledger, statusMap, terminalStatuses, requiredFields} descriptor so one prompt body handles both — minimal duplication, but the prompts carry a mapping table","Keep tasks the only EXECUTABLE unit; defects are never directly implemented — a defect is always decomposed into tasks (defect->tasks), so implement-flow still operates ONLY on tasks and defects are a planning/investigation concern","Treat defects as first-class executable items too (implement-flow picks up resolvable defects directly when a defect needs no decomposition, e.g. a one-line fix)"]
- recommendation: "Option 2 as the spine: the implement EXECUTION loop continues to operate on `tasks` only; a defect is the problem record, its fix is always one-or-more tasks linked back to it (defect->tasks). plan/implement gain defect-AWARENESS (intake, linkage, closing the defect when its tasks are done), not a second execution path. This keeps the success-gate/merge-back semantics intact and matches 'one defect may require one or more tasks'."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q20 — answered

- createdAt: 2026-06-01T23:28:53.577Z
- updatedAt: 2026-06-01T23:30:02.978Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Defect->task linkage: how is it represented in the ledger, and how does a defect become terminal? Options for the link: (a) each fix task carries `ledgerRefs: [\"defects:<D>\"]`; (b) the defect carries `dependsOn: [<taskIds>]`; (c) both directions. And: when do we flip the defect to `resolved` — when all its linked fix tasks are `done`, and who does it (the implement orchestrator on merge-back, or a separate step)?"
- context: "Both schemas expose `dependsOn: id[]` and `ledgerRefs: id[]`. The implement orchestrator already sets tasks done on merge-back and archives milestones when all items terminal. Closing the defect needs an owner and a trigger. The reviewer/plan flows need to discover 'fix tasks for defect D' to know D's progress."
- suggestions: ["Fix tasks ledgerRef the defect (tasks.ledgerRefs += defects:<D>); defect resolves when every task that ledgerRefs it is done; implement orchestrator flips it on the final merge-back","Defect.dependsOn lists its fix tasks; resolve when all dependsOn tasks are done","Both: tasks->defect via ledgerRefs (discoverable from the task) AND defect->tasks via dependsOn (discoverable from the defect), orchestrator resolves the defect when all linked tasks terminal"]
- recommendation: "Option 3 (both directions) for discoverability, with the implement orchestrator owning closure: after merge-back, if every task linked to a defect is `done`, set the defect `resolved` and record the fix summary in defects.fix. The defect's `dependsOn` is the authoritative fix-task set; tasks.ledgerRefs back-link for the reviewer/UI."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q21 — answered

- createdAt: 2026-06-01T23:29:03.574Z
- updatedAt: 2026-06-01T23:30:15.746Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "User-reported defects: which command files an `open` defect into the `defects` ledger, and does it auto-route into investigation? Is there a NEW thin intake command (e.g. /investigate:start <defect text> or /defect:report) that creates the defect and hands to the investigate loop, OR is defect intake folded into the existing /plan:start / /plan:follow-up (which currently create goals, not defects)?"
- context: "Today /plan:start creates a `goals` item and hands to plan-advance for clarifying questions; there is no command that writes a `defects` item. The follow-up wants user-reported defects to land in `defects` and (per the investigate:* requirement) to be researched before fix tasks are planned. severity is a REQUIRED defect field, so intake must capture or default it."
- suggestions: ["New /investigate:start <defect description> — creates the defects item (open, severity captured/defaulted) under a coordination milestone, then hands to investigate-advance (clarify root cause -> hypotheses)","Reuse /plan:start but detect 'this is a defect' and branch to a defect record + investigate flow","Two commands: /defect:report (just file it) and /investigate:start <defectId> (begin research) kept separate"]
- recommendation: "New /investigate:start <defect description> as the intake+bootstrap (mirrors /plan:start): create the defect (open) under a coordination milestone, capture severity (default a sensible tier with a clarifying question if absent), then hand to the investigate-advance loop. A bare /investigate:start <defectId> also resumes an existing defect. This keeps defect intake out of the goal-oriented plan:* commands."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q22 — answered

- createdAt: 2026-06-01T23:29:14.346Z
- updatedAt: 2026-06-01T23:30:29.437Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Reviewer-found defects: when plan-reviewer or implement-reviewer finds a genuine DEFECT (vs a fixable criticism or a user-question), should it file a `defects` item instead of folding it into criticism[]? Today plan-reviewer buckets findings into new_questions[] vs criticism[]; implement-reviewer into questions[] vs criticism[] and the orchestrator records one review. Where does 'this is a defect, file it' fit — a THIRD bucket (`defects[]`) that the orchestrator turns into defects-ledger items?"
- context: The follow-up explicitly says 'when reviewer finds a defect, it should be filed as a defect, not task'. But reviewers currently never create defects. The implement-reviewer is read-only-to-the-ledger and returns JSON the orchestrator records. A defect found mid-implementation is distinct from in-scope criticism (which the worker fixes in the same worktree this round).
- suggestions: ["Add a `defects[]` bucket to both reviewers' output; orchestrator files each as an open defect linked to the goal/task and routes it to investigate (out-of-scope of the current task)","Reviewer only flags 'defect' in rationale; orchestrator decides whether to file a defect vs criticism","Distinguish by scope: in-scope regressions stay criticism (fixed this round); out-of-scope/pre-existing defects are filed as defects and investigated separately"]
- recommendation: "Combine 1+3: reviewers gain a `defects[]` bucket reserved for OUT-OF-SCOPE or pre-existing defects (a fault not caused by, and not fixable within, the current task/plan); in-scope regressions remain `criticism` and are fixed in the same round. The orchestrator files each reviewer defect as an `open` defects item (severity from the reviewer) linked to goals:<G>, and routes it into the investigate flow rather than blocking the current task."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q23 — answered

- createdAt: 2026-06-01T23:29:25.234Z
- updatedAt: 2026-06-01T23:30:51.558Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "investigate:* command family shape: mirror plan-flow exactly? Proposed: thin commands /investigate:start (bootstrap a defect + coordination milestone) and /investigate:advance (drive the research loop one round), plus subagents `investigate-advance` (the orchestrator-side 'brain' — but see Q on the loop owner) and `investigate-explorer` (read-only hypothesis-tester). Confirm the command/subagent set and their llm/{commands,agents} file names so scripts/link-prompts.ts LINKS can be extended."
- context: "plan-flow = commands/plan/{start,advance,follow-up}.md + agents/{plan-advance,plan-reviewer}.md, all symlinked via the LINKS array in scripts/link-prompts.ts. The research-loop skill has THREE roles: orchestrator (hypothesis formation/validation/adjudication), read-only evidence-gathering subagents (parallel when seeding), and no separate reviewer (adjudication is the orchestrator's). investigate:* must map those onto the host's command+subagent surfaces."
- suggestions: ["commands/investigate/{start,advance}.md + agents/{investigate-explorer}.md (no separate reviewer; the advance command is the orchestrator/adjudicator, explorer is the read-only evidence-gatherer)","Add agents/investigate-adjudicator.md too, so /investigate:advance stays thin and the adjudication brain is a subagent like plan-advance","Single /investigate command (no start/advance split)"]
- recommendation: "commands/investigate/{start,advance}.md + a single read-only agents/investigate-explorer.md. The research-loop's orchestration (hypothesis formation, evidence validation, adjudication, DFS) is exactly the work that CANNOT be delegated to a subagent that can't spawn subagents — so it lives in the /investigate:advance command body (the loop owner), and explorer is the parallel read-only evidence-gatherer. No separate reviewer subagent (adjudication is orchestrator work). Extend LINKS accordingly."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q24 — answered

- createdAt: 2026-06-01T23:29:37.464Z
- updatedAt: 2026-06-01T23:31:12.304Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Research-loop hypothesis tree under the subagents-cannot-spawn-subagents constraint: where does the DFS loop live, and is the hypothesis tree stored in the `hypothesis` LEDGER (not a docs/research/*.md file)? The skill keeps a markdown ledger and forms H1/H1.1 trees with evidence E1/E2 and states confirmed/uncertain/wrong. Our hypothesis schema has parentHypothesis(id), evidence(string[]), rationale, status open/uncertain/confirmed/wrong — a near-exact match."
- context: "research-loop says the orchestrator (never a subagent) forms hypotheses, validates evidence against source, and adjudicates; read-only subagents only gather evidence and may run in parallel when seeding. Our platform forbids subagents spawning subagents, so the DFS/adjudication MUST be the /investigate:advance command body (exactly as plan-flow keeps the loop in the command). The hypothesis ledger can hold the durable tree instead of a markdown file."
- suggestions: ["Store the tree in the `hypothesis` LEDGER: each node a hypothesis item (parentHypothesis for ancestry, evidence[] for cited findings, status for verdict), linked to the defect via ledgerRefs; /investigate:advance owns formation+validation+adjudication; investigate-explorer subagents gather evidence (parallel only when seeding disjoint roots, per the skill)","Keep the docs/research/research-<defect>.md markdown ledger as the skill specifies, and only mirror the final root-cause into defects.rootCause","Hybrid: hypothesis ledger as the structured tree + a generated markdown view"]
- recommendation: "Option 1: the `hypothesis` ledger IS the durable tree (parentHypothesis = ancestry, evidence[] = cited 3-5 line excerpts, status = verdict), each node ledgerRef'd to its defect. /investigate:advance is the orchestrator: it forms hypotheses, dispatches investigate-explorer read-only subagents (parallel ONLY when seeding disjoint top-level hypotheses, serial while drilling a branch per the skill), VALIDATES every returned citation against source itself, and adjudicates status. One /investigate:advance call = one research round; the loop is resumable from ledger state. This dogfoods the ledger instead of a side markdown file."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q25 — answered

- createdAt: 2026-06-01T23:29:47.888Z
- updatedAt: 2026-06-01T23:31:46.237Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Investigation -> planning handoff: once a root cause is CONFIRMED, how are the fix tasks produced? Does /investigate:advance itself emit the fix tasks (run a mini planning cycle inline), or does it record rootCause/suggestedFix on the defect and hand off to the plan-flow (create/extend a goal, run plan-advance->plan-reviewer to produce reviewed fix tasks under a work milestone)?"
- context: "The follow-up: 'once root cause is found - planning cycle to produce tasks'. plan-flow already IS the reviewed planning cycle (plan-advance emits tasks, plan-reviewer adversarially reviews, decision locks). Reusing it avoids duplicating the planning/review machinery inside investigate. But a defect's fix may be small enough that a full goal/clarify cycle is overkill."
- suggestions: ["Hand off to plan-flow: on confirmed root cause, /investigate:advance records defects.rootCause + suggestedFix, then creates (or reuses) a goal seeded from the defect and invokes the plan-advance/plan-reviewer cycle to produce reviewed fix tasks linked back to the defect","Inline mini-planning: /investigate:advance emits fix tasks directly (status planned, dependsOn the defect, suggestedModel set) and a plan-reviewer pass reviews them, without creating a goals item","Configurable: small defects get inline tasks; large ones spawn a goal"]
- recommendation: "Option 1 (hand off to plan-flow), to keep ONE reviewed planning cycle in the repo: on a confirmed root cause, write defects.rootCause + suggestedFix, then bridge into plan-flow by creating a goal whose description embeds the defect + confirmed root cause (or extending an existing goal via the follow-up path) and running the standard plan-advance<->plan-reviewer loop; the emitted fix tasks ledgerRef the defect (Q on linkage). This makes investigate -> plan -> implement a clean pipeline and reuses the adversarial plan review for fixes."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q26 — answered

- createdAt: 2026-06-01T23:29:59.213Z
- updatedAt: 2026-06-01T23:32:24.584Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "How is the investigate:* flow INTEGRATED into plan:* and implement:* (the follow-up's explicit requirement)? Concretely: when a reviewer or the user surfaces a defect during /plan:advance or /implement:advance, does that flow AUTO-invoke investigation (orchestrator dispatches the investigate loop in the same session), or does it just FILE an open defect + an open question telling the user to run /investigate:start <D>, keeping the flows decoupled and resumable?"
- context: "Both advance commands are designed idempotent/resumable and gate on user-answerable questions. research-loop investigation can be many rounds and may itself need user input (ambiguous scope / missing access). Auto-running a multi-round investigation inside an implement pass could balloon a single /implement:advance invocation; filing-and-deferring matches the existing 'register a question, user resumes' pattern."
- suggestions: ["Decoupled (file & defer): plan/implement file the open defect and a linked open question ('defect D needs investigation — run /investigate:start D'); the user drives investigation separately, then the produced fix tasks flow back through plan/implement","Auto-invoke: the advance orchestrator runs the investigate loop inline when a defect is discovered, blocking that task until root cause + fix tasks exist","Hybrid by severity: high-severity defects auto-invoke; others are filed and deferred"]
- recommendation: "Option 1 (decoupled file-and-defer), consistent with the existing resumable design: discovering a defect in plan/implement files an `open` defects item (+ optionally an open question pointing the user to /investigate:start) and, in implement, does NOT block the current in-scope task on it (out-of-scope per the reviewer-defect Q). Investigation is its own loop the user runs; its reviewed fix tasks then re-enter implement normally. 'Integrated' = shared ledger + documented routing, not a single mega-invocation."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q27 — answered

- createdAt: 2026-06-01T23:30:10.991Z
- updatedAt: 2026-06-01T23:33:40.813Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "investigate-explorer subagent: read-only (no worktree) and how does it return evidence for orchestrator validation? research-loop mandates read-only evidence-gatherers that share the main checkout (no worktree isolation), returning numbered evidence items with file:line + 3-5 line excerpts, and the ORCHESTRATOR re-opens each citation to mark it correct/incorrect. Confirm explorer is read-only (disallow Write/Edit/Agent, NO isolation:worktree), and that /investigate:advance validates every citation before adjudicating — and where validated evidence is stored (hypothesis.evidence[] with a correct/incorrect marker per item)."
- context: "implement-worker uses isolation:worktree because it edits; research subagents do not edit, so per the skill they need no worktree and may run in parallel. The skill is emphatic that the orchestrator must independently verify each cited file:line (a mis-cited line is the dominant way the loop confirms the wrong hypothesis). Our hypothesis.evidence is a string[]; encoding per-item validation state needs a convention."
- suggestions: ["explorer: read-only (disallow Write/Edit/MultiEdit/Agent, no worktree); returns numbered evidence JSON; /investigate:advance opens each citation, prefixes the stored evidence string with [correct]/[incorrect] (mirroring the skill's E1 [correct] convention) and only draws verdicts from [correct] items","Store evidence as free prose; skip per-item validation markers (lighter, but loses the skill's anti-mis-citation guarantee)","Add a structured evidence sub-schema instead of string[] markers"]
- recommendation: "Option 1: investigate-explorer is strictly read-only (no isolation:worktree, Agent/Write/Edit disallowed), shares the main checkout, and returns numbered evidence with file:line + excerpt; /investigate:advance VALIDATES each citation against source and stores items in hypothesis.evidence[] using a `[correct]`/`[incorrect]` prefix convention (matching research-loop's E-item format), adjudicating status only from [correct] evidence. Parallel explorers only when seeding disjoint top-level hypotheses; serial while drilling."
- ledgerRefs: ["goals:G1"]
- answer: as recommended

### Q28 — answered

- createdAt: 2026-06-01T23:30:22.527Z
- updatedAt: 2026-06-01T23:33:59.301Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Scope confirmation for THIS #2 follow-up: is it PROMPT-ONLY (edit llm/commands+agents, add the investigate:* prompts, extend scripts/link-prompts.ts LINKS) with NO @cq/ledger schema or UI changes — relying on the EXISTING defects/hypothesis schemas as-is? Or do you also want UI/MCP work (e.g. surface defects->tasks and hypothesis-tree relationships in the TUI/web, a defect-centric view), which would expand into the @cq/ledger + clients the way the #1 follow-up (M6) did?"
- context: "The defects and hypothesis schemas ALREADY exist and carry the needed fields (defects: rootCause/suggestedFix/fix/severity/dependsOn/ledgerRefs; hypothesis: parentHypothesis/evidence/rationale). So the core of this follow-up can be delivered as prompt+command edits + new investigate:* assets + a link-prompts update, with zero schema change. The #1 follow-up (M6) DID touch schema/UI. Knowing the boundary fixes how many work milestones and which packages the plan spans."
- suggestions: ["Prompt-only: edit plan/implement prompts for defect-awareness, add commands/investigate/* + agents/investigate-explorer, extend link-prompts LINKS; no schema/UI change (the schemas already suffice)","Prompt + a small UI affordance (e.g. show a defect's linked fix tasks / a hypothesis tree) but no schema change","Full: prompts + UI + any schema tweaks (e.g. a dedicated defect<->task link field) if the existing dependsOn/ledgerRefs prove insufficient"]
- recommendation: "Option 1 (prompt-only) for this round: the existing defects/hypothesis schemas already carry every field the design needs, so deliver the flow as prompt/command/agent edits plus the link-prompts LINKS extension, with NO @cq/ledger or client changes. If a UI defect/hypothesis view is desired, capture it as a SEPARATE follow-up so this round stays bounded and shippable."
- ledgerRefs: ["goals:G1"]
- answer: "Full: prompts + UI + any schema tweaks (e.g. a dedicated defect<->task link field) if the existing dependsOn/ledgerRefs prove insufficient"

## M10

### Q29 — answered

- createdAt: 2026-06-02T08:28:57.456Z
- updatedAt: 2026-06-02T08:35:43.103Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #1 (column selector): Should the chosen column set persist, and at what scope — per-ledger (each ledger remembers its own columns) or one global set? And where should it persist: localStorage (web) / in-memory only, or round-tripped to the server so the TUI and web share it?"
- context: Today both frontends hardcode the table columns to id/status/summary (web ItemTable in App.tsx; TUI ItemRowLabel renders id|status|summary). There is no per-field column config anywhere. Other view state (panel layout, last-open ledger/item) persists to localStorage in the web app (PANEL_KEY, VIEW_KEY) and is NOT shared with the TUI. Frontends are pure MCP clients and never read docs/ directly, so server-side persistence would need a new MCP capability. The natural fork is per-ledger localStorage (matches existing web persistence, keeps the two UIs independent) vs a shared server-stored config (more work, new MCP surface).
- suggestions: ["Per-ledger, client-local (web localStorage; TUI in-memory or its own config) — no server changes","Per-ledger, persisted server-side so TUI and web share one config (new MCP capability)","Single global column set (not per-ledger)"]
- recommendation: Per-ledger, client-local persistence (web localStorage; TUI in-memory for now) — no new MCP surface, consistent with how panel/view state already persists.
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q30 — answered

- createdAt: 2026-06-02T08:29:07.300Z
- updatedAt: 2026-06-02T08:36:02.763Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #1 (column selector): Which fields are eligible as columns, and how is the default-show of `suggestedModel` in the tasks view configured? Confirm the eligibility rule: any non-\"long\" field (the existing isShortField heuristic — single line, <=48 chars), excluding id/status/summary which are always shown?"
- context: "The schema marks field types (string, string[], id[], etc.) but not 'long' vs 'short'. The UIs derive 'short' at render time via isShortField(value) on the actual value, which is data-dependent (a short value in one row may be long in another). For a stable column menu we need a field-level rule, not a per-value one. `suggestedModel` is a real schema field on tasks (COMMON_REF_FIELDS in constants.ts, type string). Default-showing it needs a per-ledger default column config living somewhere (code constant vs derived)."
- suggestions: ["Eligible = every schema field whose declared type is scalar (string/id/enum), excluding multi-line 'description'-like fields by a name/type heuristic; id+status+summary always shown","Eligible = all schema fields; the selector just lets you toggle any of them on","Eligibility decided per-field by a new schema flag (requires schema change)"]
- recommendation: Eligible = all schema fields except a small denylist of known long/narrative ones (description, rationale, criticism, etc.); column defaults (incl. suggestedModel for tasks) live in a per-ledger code constant. Avoid a schema change.
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q31 — answered

- createdAt: 2026-06-02T08:29:17.677Z
- updatedAt: 2026-06-02T08:36:58.818Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #3 (questions field order): The requested order is milestone, status, by, question, suggestions, context, recommendation, answer. Today's QUESTION_FIELD_ORDER is question, context, recommendation, answer (no suggestions; context BEFORE — the new order puts suggestions before context). Confirm: (a) the new exact order including suggestions, with context AFTER suggestions; (b) milestone/status/by are the existing metadata rows (currently rendered around the narrative, not strictly in this sequence) — should they be forced into exactly this leading order; (c) does this apply to BOTH web DetailPanel and the TUI ContentPane?"
- context: "Web: renderQuestionFields() (App.tsx) emits status + transitions first, then metadata (short-first), then question/context/recommendation/answer; 'milestone' and 'by' (provenance) render in a trailing block at the very end of the <dl>. TUI: ContentPane renders id/status, a 'milestone … created … updated' line, a 'by' line, then QUESTION_FIELD_ORDER. So 'milestone, status, by' are currently NOT contiguous leading rows in either UI, and 'suggestions' is treated as generic metadata. Honoring the exact requested sequence means restructuring the metadata block, not just editing QUESTION_FIELD_ORDER."
- suggestions: ["Exactly milestone, status, by, question, suggestions, context, recommendation, answer in both UIs; restructure the metadata rows to lead in that order","Keep current metadata placement; only fix the narrative order to question, suggestions, context, recommendation, answer","Apply the full strict order to web only; TUI keeps its current header lines"]
- recommendation: Apply the exact requested order milestone, status, by, question, suggestions, context, recommendation, answer in BOTH frontends; refactor the leading metadata rows so the sequence is literal.
- ledgerRefs: ["goals:G2"]
- answer: Apply the exact requested order milestone, status, by, question, CONTEXT, suggestions, recommendation, answer in BOTH frontends; refactor the leading metadata rows so the sequence is literal.

### Q32 — answered

- createdAt: 2026-06-02T08:29:28.091Z
- updatedAt: 2026-06-02T08:38:10.548Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #4 (suggestions as a list): The questions `suggestions` field is ALREADY declared `string[]` in the schema (QUESTIONS_SCHEMA in constants.ts). The real gap is (a) the editors write/read it as a single comma-joined string and models actually write SEMICOLON-separated values into one string element, and (b) both UIs render arrays as `v.join(\", \")` rather than a bulleted list. Confirm the intended scope: (1) normalize existing on-disk data so each suggestion is its own array element (splitting on semicolons), (2) make the editors split input into array elements, and (3) render suggestions as a visual list (bullets) — all dogfood-only, no back-compat. Should normalization split on semicolons only, or both semicolons and newlines?"
- context: "constants.ts line 193: suggestions { type: 'string[]' }. parseFieldValue() splits string[] inputs on COMMAS, but models have been writing 'a; b; c' as a single element, so a one-element array like ['a; b; c'] exists on disk. Rendering does Array.isArray(v) ? v.join(', ') in both UIs — never a list. No migration tooling exists; the ledger is markdown-backed and must be edited through the tools (per CLAUDE.md), so 'normalize freely' implies a one-shot update_item pass over existing question items."
- suggestions: ["Split on semicolons AND newlines; one-shot normalize existing items; editors split on the same; render as a bulleted list in both UIs","Split on semicolons only; otherwise as above","Only change rendering to a list + fix editor split; skip normalizing existing data (re-save on next edit)"]
- recommendation: Normalize existing items by splitting on semicolons (and trimming/dropping empties), switch the array editor delimiter to one that doesn't collide with prose (semicolon or newline), and render suggestions as a bulleted list in both frontends.
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q33 — answered

- createdAt: 2026-06-02T08:29:39.860Z
- updatedAt: 2026-06-02T08:38:57.091Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #5 (batch answer mode): For the web, confirm a large modal/popup launched from a button at the bottom of the left sidebar that iterates all OPEN (unanswered) questions one at a time, larger font, with the same 'save & mark answered' + 'as recommended' actions and advance-to-next behavior. For the TUI equivalent, which affordance do you prefer: (a) a dedicated full-screen overlay mode (new Overlay variant) entered by a keybinding, stepping question-by-question with the existing answer prompt, or (b) reuse the existing per-item answer overlay but auto-advance through the open-question set? Also: scope to the questions ledger only, or any ledger matching the answerable convention (canAnswer)?"
- context: "Web has an overlay/modal pattern (HelpOverlay, settings popup) and an answerBox with 'save & mark answered'/'as recommended' (App.tsx). The sidebar (lw-sidebar) currently lists ledgers only — no bottom action button. TUI uses centered overlays that own input (Overlay union in app.tsx: search/status/answer/pickField/...); a batch mode is naturally a new Overlay variant with its own step state, analogous to CreateItemForm's stepper. canAnswer() already generalizes 'answerable' beyond the questions ledger by shape (answer field + answered transition)."
- suggestions: ["Web: sidebar-bottom button → full-screen modal stepping open questions. TUI: new full-screen overlay mode via a keybinding (e.g. 'b'), stepping with the existing answer prompt","TUI option (b): reuse the answer overlay but auto-advance to the next open question after each save","Scope batch mode to the questions ledger only","Scope to any answerable ledger (canAnswer convention)"]
- recommendation: Web sidebar-bottom button opening a large modal that steps through open questions; TUI gets a dedicated full-screen overlay mode (new Overlay variant) on a keybinding, stepping with the existing answer prompt. Scope to any answerable ledger via canAnswer, defaulting to questions.
- ledgerRefs: ["goals:G2"]
- answer: "as recommended, There should be left/right buttons in the popup and keyboard navigation (e.g. ctrl/cmd+[])"

### Q34 — answered

- createdAt: 2026-06-02T08:29:54.209Z
- updatedAt: 2026-06-02T08:39:18.679Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #6 (revise color): `revise` and `go-ahead` both currently bucket to 'done' (both terminal in REVIEWS_SCHEMA, neither in the DROPPED set) → both render green. How should `revise` be distinguished: introduce a new semantic bucket (e.g. 'warning'/'attention') that `revise` maps to, or fold `revise` into the existing 'blocked'/red bucket? And what exact color — the web uses CSS-class buckets (lw-status-<bucket>) and the TUI uses ink color names (start=cyan, progress=yellow, blocked=red, done=green, dropped=gray). A warning would naturally be amber/orange (web) + 'yellow' or 'magenta' (TUI). Note `revise` is terminal, so it must not be mis-bucketed as non-terminal."
- context: "statusBucket() in both status.ts files: terminal → DROPPED.has(s) ? 'dropped' : 'done'. 'revise' isn't in DROPPED, so it greens. Adding a dedicated bucket is the cleanest (shared by item #8). Web bucket colors live in CSS (lw-status-* classes), TUI in BUCKET_COLOR (status.ts). 'yellow' (TUI) already denotes 'progress'; reusing it for revise would conflict, so revise likely wants its own ink color (e.g. 'magenta' or 'redBright')."
- suggestions: ["New 'warning' bucket: revise (and similar 'needs-changes' terminal verdicts) map to it; web amber/orange CSS class, TUI a distinct ink color (e.g. magenta)","Map revise into the existing red/'blocked' bucket (negative)","Special-case the literal status 'revise' to a fixed color without a new bucket"]
- recommendation: Add a dedicated 'warning' bucket that `revise` maps to (terminal-negative), colored amber/orange in web CSS and a distinct ink color (magenta) in the TUI; this same bucket system feeds item #8.
- ledgerRefs: ["goals:G2"]
- answer: ""

### Q35 — answered

- createdAt: 2026-06-02T08:30:01.065Z
- updatedAt: 2026-06-02T08:39:32.184Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #7 (project name in title): Frontends are pure MCP clients and never read the cwd/docs/ directly, so the project directory name (e.g. 'cq1') must come from the MCP server. Today the LedgerClient interface exposes no server-info/cwd method. Acceptable approach: have the server report a project/display name (derived from its --cwd basename) and surface it to the client — via the MCP connection `instructions`/serverInfo it already advertises on connect, or a new lightweight method? And the exact title format — confirm '[<dir>] LLM ledgers' for both the browser document.title and the in-app header (web currently shows 'ledger-web'; TUI shows 'ledger-tui')."
- context: index.html hardcodes <title>ledger-web</title>; the web header span is 'ledger-web' (App.tsx line 758); TUI header is 'ledger-tui' (app.tsx). LedgerClient (types.ts) has enumerateLedgers/fetchLedger/etc. but no serverInfo. --cwd for ledger-mcp must be absolute (per CLAUDE.md), so basename(cwd) gives the project dir name on the server. The MCP server already advertises baseline `instructions` on connect (per project notes), which is one natural carrier for a display name.
- suggestions: ["Server reports a displayName (basename of --cwd) via MCP serverInfo/instructions; client renders '[<displayName>] LLM ledgers' as document.title + header in both UIs","Add a small serverInfo() method to LedgerClient returning { projectName, ... }","Web-only title change; leave TUI header as-is"]
- recommendation: "Server derives a display name from basename(--cwd) and exposes it (via serverInfo/instructions); both frontends render '[<dir>] LLM ledgers' as the title/header. Apply to web document.title + header and the TUI header."
- ledgerRefs: ["goals:G2"]
- answer: ""

### Q36 — answered

- createdAt: 2026-06-02T08:30:13.747Z
- updatedAt: 2026-06-02T08:39:44.672Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #8 (graph node colorization): The web DagView has its own hardcoded STATUS_COLORS map keyed on raw status (only the four milestone statuses: open/done/postponed/blocked) and ambers everything else — but loadDagData graphs ANY ledger, so task/defect/review statuses (planned, wip, go-ahead, revise, …) all fall through to amber today. To share one status→color source with the badges, the bucket system (statusBucket) needs the ledger SCHEMA to classify terminal vs non-terminal, which DagView/DagData currently don't carry. Confirm: (a) thread the schema into the DAG path and color nodes by the SAME bucket→color mapping as badges (including the new 'warning' bucket from item #6); (b) define the canonical bucket→hex palette once and have both the SVG graph and the CSS badges derive from it (single source); (c) is the graph web-only (the TUI has no graph view), so this item is web-scoped?"
- context: DagView.tsx STATUS_COLORS only knows milestone statuses; fallback '#e0b341' (amber) hits every non-milestone status. statusBucket(status, schema) needs terminalStatuses from the schema to bucket correctly — loadDagData has the schema (view.schema) but DagData/DagNode don't carry it forward. Badge colors live in CSS classes (web) with no JS hex palette, so 'single shared source' implies introducing a canonical bucket→hex map (or CSS custom properties) consumed by both the SVG and the badge styles. The TUI has no DAG view, so #8 appears web-only.
- suggestions: ["Thread schema into DagData/DagView; color nodes via statusBucket→shared hex palette (incl. new 'warning' bucket); define the palette once (e.g. CSS custom properties) used by both badges and SVG; web-only","Keep DagView keyed on raw status but extend the map to every canonical status value (no bucketing)","Bucket via schema but keep separate hex constants in DagView (accept minor duplication)"]
- recommendation: Thread the schema through to DagView and color nodes by statusBucket using a single canonical bucket→color palette shared with the badges (CSS custom properties as the one source), including the new 'warning' bucket. Treat #8 as web-only (no TUI graph).
- ledgerRefs: ["goals:G2"]
- answer: ""

### Q38 — answered

- createdAt: 2026-06-02T09:00:46.768Z
- updatedAt: 2026-06-02T09:36:03.169Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #9 (archived milestones render like regular sections): In the WEB app, active non-milestones items render as per-milestone collapsible <section> subsections (ItemTable, App.tsx L1283-1353: header button with id+title+[status], then an id/status/summary table). Archived milestones instead render via a SEPARATE component, ArchiveSection (App.tsx L1404-1484): a flat row of pointer BUTTONS (one per archived milestone-group) where clicking ONE pointer fetches and shows just THAT group's items in a table below — which is exactly the reported 'look like buttons / only one visible'. To make archived milestones render the SAME as regular sections + an 'archived' badge, confirm the intended end state: (a) fold archived milestone-groups into the SAME subsection renderer as active ones (each archived group becomes its own collapsible <section> with the same id/title/table, ALL visible at once, not click-to-reveal), appended after the active sections; (b) the ONLY visual difference is an 'archived' badge in each section head (an .lw-archived-badge class already exists, currently used on the DetailPanel); (c) eager-fetch ALL archived groups' items so every section shows its rows (today only the clicked pointer's items are fetched on demand) — confirm eager fetch-all is acceptable, or should archived sections stay collapsed-by-default and lazy-fetch their items on first expand?"
- context: "Web ItemTable (active) and ArchiveSection (archived) are two different render paths today. The 'buttons + only one visible' symptom is structural: lw-archive-pointer is a <button> per group and only the selected pointer's archive is fetched (onSelectPointer → fetch). Reusing the subsection renderer means archived groups need their items available (fetch_ledger_archive per pointer) and a collapsible <section> each. The badge styling already exists (.lw-archived-badge, styles.css L644). The fork is eager-fetch-all vs lazy-on-expand, and whether archived sections default collapsed."
- suggestions: ["Render each archived milestone-group as its own collapsible <section> via the SAME renderer as active groups, all listed (after active sections), each with an 'archived' badge in the head; eager-fetch all archived groups' items so every section shows rows","Same unified sections + badge, but archived sections default COLLAPSED and lazy-fetch their items on first expand (cheaper if there are many archives)","Keep ArchiveSection separate but restyle it to LOOK like the subsections (visual-only), without unifying the render path"]
- recommendation: "Unify: render archived milestone-groups through the same subsection renderer as active ones, all visible, each with an 'archived' badge in the head; default archived sections COLLAPSED and lazy-fetch items on first expand (parity with the existing per-pointer fetch, avoids fetching every archive up front)."
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q39 — answered

- createdAt: 2026-06-02T09:01:00.773Z
- updatedAt: 2026-06-02T09:38:01.933Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #9 in the TUI: the TUI archive view (T33) does NOT use buttons — when toggled (the 'A' archive hint), it appends archive rows below the active list under a single flat '── archived ──' header (app.tsx L678-689), dimmed, NOT grouped into per-milestone subsections (unlike active items, which DO get per-milestone subsection headers via buildItemEntries). So the web symptom (buttons / only one visible) is web-specific. For the TUI, what does 'render the same as regular sections + archived badge' mean: (a) leave the TUI as-is (it is already a row list, not buttons) and treat #9 as WEB-ONLY; or (b) also bring the TUI archive rows up to parity — group archived rows into per-milestone subsection headers (same as active sections) instead of one flat '── archived ──' header, with an 'archived' marker on each archived subsection header?"
- context: "TUI buildItemEntries already builds per-milestone subsection headers for ACTIVE items (app.tsx L137-145: 'G<id> <title> [<status>]'), but archived rows are appended as a single flat block under one '── archived ──' header (L678-689), so archived items are NOT subsectioned by their milestone the way active items are. The report's exact wording ('buttons', 'only one visible') matches the web ArchiveSection, not this. The fork is whether #9 is web-only or also tightens TUI archive grouping for parity."
- suggestions: ["Treat #9 as WEB-ONLY (the TUI archive view is already a row list, not buttons; leave it as-is)","Also fix the TUI: group archived rows into per-milestone subsection headers like active items, each archived subsection header carrying an 'archived' marker, instead of one flat '── archived ──' header"]
- recommendation: Scope #9 to the WEB app only (that is where the 'buttons / only one visible' defect lives); leave the TUI archive view as-is. If TUI archive grouping parity is wanted, track it as a separate small follow-up rather than folding it into #9.
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q40 — answered

- createdAt: 2026-06-02T09:01:20.422Z
- updatedAt: 2026-06-02T09:37:02.250Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #10 (milestone status as a BADGE in the section head): Today the milestone status in a subsection header is plain text inside the label — web ItemTable builds headerLabel = '<id>: <title> [<status>]' (App.tsx L1293-1295) rendered in a single <span class=lw-ms-label>; TUI buildItemEntries builds the header label '<id> <title> [<status>]' as a plain STRING (app.tsx L141) rendered as a non-selectable header line. Item #10 = render that milestone status using the SAME status badge as item rows (web: <span class='lw-status lw-status-<bucket>'>; TUI: statusColor()), driven by the shared status→color source. This necessarily depends on the W1 shared-badge/palette work (items #6/#8, milestone M12: T50/T52/T53) — the 'warning' bucket + canonical bucket→color palette. Confirm: (a) milestone-section status renders as a badge in BOTH frontends using the shared bucket source from M12; (b) milestone statuses are open/done/postponed/blocked — these bucket via statusBucket with the MILESTONES schema (statusBucket needs the schema to classify terminal), so confirm the milestone schema is threaded to the header badge in both UIs; (c) for the TUI specifically, the header is currently a plain string — OK to change the header entry to carry a rendered element (colored id+title + colored status badge) so the status can be colorized?"
- context: "Web item-row badges already use lw-status lw-status-<bucket> (App.tsx L1337); applying the same to the milestone header is small once M12 lands the shared palette. The milestone statuses (open/done/postponed/blocked) bucket fine via statusBucket WITH the milestones schema. TUI headers are currently 'label: string' (ListEntry.header), so a TUI status badge means the header entry must carry a renderable node (id/title text + statusColor'd status), or a parallel header-render path. #10 depends on M12 (W1 shared status badge/palette) for the single shared color source."
- suggestions: ["Render milestone-section status as a badge in BOTH UIs using the shared M12 bucket→color palette; thread the milestones schema into the header so statusBucket classifies correctly; change the TUI header entry to carry a rendered element","Web-only badge for the milestone header; leave the TUI header as plain '[status]' text","Badge in both, but TUI keeps the header as text and only color-codes the status word (no bordered badge), since ink has no box-badge primitive"]
- recommendation: "Render the milestone-section status as a badge in BOTH frontends from the shared M12 palette (depends on M12: T50/T52/T53). Web: wrap status in lw-status lw-status-<bucket>. TUI: change the header entry to a rendered element and color the status via statusColor (ink has no bordered badge, so a color-coded status token is the parity equivalent). Thread the milestones schema to the header so terminal classification is correct."
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q41 — answered

- createdAt: 2026-06-02T09:01:40.928Z
- updatedAt: 2026-06-02T09:37:11.059Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #11 (column proportions — id/status size to content, summary takes remainder): This is a WEB-only defect. The web .lw-table is width:100% with border-collapse:collapse and NO table-layout / colgroup, so the browser's automatic table layout distributes width by content and can over-allocate id/status (the reported ~1/5 id, ~2/5 status, ~2/5 summary). The .lw-summary-cell uses max-width:0 + ellipsis (styles.css L306-311). The TUI already sizes id/status columns to content via padEnd(maxIdW)/padEnd(maxStatusW) (app.tsx L672-673, L697), so the TUI is NOT affected. Confirm: (a) #11 is web-only; (b) the fix is CSS-level (e.g. id/status columns sized to content via <colgroup> with width:1%; white-space:nowrap, plus table-layout/summary taking the remaining width), applied to ALL web tables (active subsections, the flat milestones table, and the archive table); (c) how does this reconcile with item #1's column selector (M14: T60-T62), which makes the column SET dynamic — should #11 be a standalone CSS fix landing on TODAY's fixed id/status/summary tables, with the #1 selector work later inheriting the same 'scalar columns size to content, the one summary/long column takes the remainder' sizing rule; or should #11 be deferred and folded into the #1 column-selector implementation so the sizing is designed once for arbitrary columns?"
- context: "Web tables (ItemTable active subsections, the isMilestones flat table, ArchiveSection table) all share class lw-table with no explicit column sizing; auto-layout causes the mis-proportion. The clean fix is per-column width control (colgroup + width:1%/nowrap for id/status, summary flexible) and likely table-layout. Item #1 (M14: T60-T62) turns the column set dynamic per-ledger, so #11's sizing rule should generalize to 'narrow scalar columns hug content, the long/summary column takes the remainder'. The fork: ship #11 now against the current fixed columns (and have T60-T62 inherit the rule), or fold #11 into T60-T62."
- suggestions: ["Web-only; ship #11 NOW as a CSS fix on the current id/status/summary tables (colgroup width:1%+nowrap for id/status, summary takes remainder, applied to all three table variants); the #1 column-selector work (T60-T62) later reuses the same content-hug-vs-remainder sizing rule for arbitrary columns","Web-only; DEFER #11 and fold the sizing into the #1 column-selector implementation (T60-T62) so column widths are designed once for the dynamic column set","Apply to both UIs (also revisit TUI column padding), not web-only"]
- recommendation: "Treat #11 as WEB-ONLY and ship it NOW as a standalone CSS fix on the current tables (id/status hug content via colgroup width:1% + white-space:nowrap, summary takes the remainder; apply to active subsections, the flat milestones table, and the archive table). Define the sizing as a reusable rule (scalar columns hug content, the long/summary column flexes) so the #1 column-selector work (M14: T60-T62) inherits it. Place #11's task in a NEW follow-up work milestone but note the M14 relationship; leave the TUI untouched (already content-sized)."
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q48 — answered

- createdAt: 2026-06-02T09:45:11.936Z
- updatedAt: 2026-06-02T09:47:24.996Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #12 (goals view shows a misleading single milestone): A goal links to MANY work milestones via goals.fields.milestones (id[]; e.g. G2 → [M12,M13,M14]), but every goal item also physically sits under ONE coordination milestone (G2 under M10). Today both UIs surface only the coordination milestone, never fields.milestones: web ItemTable groups non-milestones ledgers into per-milestone subsections keyed on the coordination group id (App.tsx L1284-1297; the flat milestones table also has a 'milestone' column L1231/L1254) and the web DetailPanel emits a trailing `milestone: <coordinationId>` row (App.tsx L1839-1840); the TUI buildItemEntries groups rows under the coordination milestone subsection header (app.tsx L137-145) and ContentPane shows `milestone <coordinationId>` (app.tsx L1082). Confirm the intended end state, choosing among the forks: (a) for the GOALS ledger specifically, REPLACE the single-coordination-milestone display with a list of fields.milestones (the work milestones) in BOTH the detail panel/content pane AND wherever the per-item milestone shows; (b) ADDITIONALLY render a dedicated `milestones` (id[]) display for goals while keeping the coordination milestone shown but relabeled (e.g. 'under: M10' vs 'work: M12,M13,M14'); or (c) simply OMIT the single-milestone column/subsection grouping for the goals ledger (don't group goals into a coordination subsection) and show fields.milestones instead. Also: should the goals-list grouping (subsections/TUI headers) change, or only the detail/per-item milestone display?"
- context: "Verified in source. WEB: non-milestones ledgers render as per-milestone collapsible subsections keyed on the coordination group id g.id (App.tsx L1284-1297) — so goals all collapse under one M10/M1/M15 coordination section, never their fields.milestones. The flat milestones-ledger table additionally has an explicit 'milestone' column (L1231, L1254). DetailPanel always appends `<dt>milestone</dt><dd>{row.milestoneId}</dd>` (L1839-1840) = the coordination milestone, not the work milestones. TUI: buildItemEntries headers and ContentPane's `milestone <id>` line (app.tsx L141, L1082) likewise show the coordination milestone. goals.fields.milestones (the work-milestone id[]) is never displayed anywhere today. This interacts with the column work T30/T60 (item #1 column selector) and the milestone-subsection rendering from item #9/#10 — a goals-specific override should be designed to coexist with those. Need the fork decided before writing fix tasks."
- suggestions: ["For the GOALS ledger only: drop the single coordination-milestone display (detail row + per-item column) and instead render fields.milestones as a list of work-milestone ids in both UIs; leave the list grouping (goals still listed under their coordination subsection/header) as-is","For GOALS: keep the coordination milestone but RELABEL it (e.g. 'coordination: M10') AND add a separate 'milestones' (work milestones from fields.milestones) list display in detail/content; do not change list grouping","For GOALS: omit the milestone subsection grouping entirely (flat goals list, no coordination subsection) and show fields.milestones in the detail/per-item display"]
- recommendation: "Scope to the GOALS ledger specifically: in BOTH detail views replace the single coordination-milestone row with a `milestones` list rendered from fields.milestones (the work-milestone id[]); keep the existing coordination-milestone subsection grouping in the LIST view (it is structurally how items attach) but suppress any single-milestone COLUMN for goals. This surfaces the real (many) work milestones without fighting the per-milestone grouping the rest of the UI relies on, and dovetails with the column-selector work (T60) and milestone-badge work (T50/T52)."
- ledgerRefs: ["goals:G2"]
- answer: Do not show milestones in Goals ledger items view - it should be a flat list without subsections - as milestones list.

### Q49 — answered

- createdAt: 2026-06-02T09:45:32.646Z
- updatedAt: 2026-06-02T09:47:46.425Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #13 (TUI navigation latency grows with item count): I localized the cost to the App render path WITHOUT needing an /investigate pass — so confirm we treat this as a fix task (not investigation). Root cause (grounded in packages/ledger-tui/src/app.tsx): every cursor up/down does patchTop({cursor}) → setStack → a FULL re-render of App; the items-frame render body (L644-714) is NOT memoized, so on EVERY keystroke it (i) re-filters all rows via visibleRows (L644), (ii) recomputes maxIdW by reducing over ALL rows (L672) and maxStatusW over all status values (L673), and (iii) rebuilds the ENTIRE ListEntry array over all filtered rows via buildItemEntries (L676). Rendering itself is already windowed (ScrollList only maps the visible slice `win`, L941-971), so the O(N) cost is the per-keystroke recompute, not the row paint. Confirm the fix scope: (a) MEMOIZE the derived list — visibleRows result, maxIdW/maxStatusW, and the buildItemEntries entries — with useMemo keyed on (view, filter, showArchive, archiveRows) so a pure cursor move does NOT recompute them; (b) is that sufficient, or do you also want to AVOID the full-App re-render on cursor moves (e.g. lift the list into a memoized child component / React.memo so only the list re-renders)? (c) Do you want a quick before/after measurement (e.g. a timing harness or a documented keystroke-latency repro at N≈500/1000 items) captured as part of the task's acceptance, or is the memoization fix + an assertion that the heavy builders run once per data-change (not per keystroke) enough?"
- context: "Verified in source (app.tsx). The items branch at L643-735 runs inside App's render on every state change; cursor moves are state changes (patchTop→setStack). visibleRows (L249-253) is a useCallback but is CALLED fresh each render (L644). maxIdW/maxStatusW reduce over allRows/statusValues each render (L672-673). buildItemEntries (L125-147) walks all filtered rows and builds a Map + entries array each render (L676). None of these are wrapped in useMemo, and there is no React.memo boundary around the list, so they all re-execute per keystroke; the per-keystroke cost therefore scales O(N) in item count, matching the reported 'pauses grow with the number of items'. ScrollList already windows the actual draw. This interacts with the TUI column-table rendering (T31, item #1) and the milestone-header badge work (T53, item #10), which also touch this render path — the memoization keys must include whatever those add. Reproduction-first per repo policy: a failing/again-passing latency repro or a 'builders invoked once per data change' assertion is the natural acceptance."
- suggestions: ["Treat as a FIX task (no /investigate): memoize visibleRows result + maxIdW/maxStatusW + buildItemEntries entries via useMemo keyed on (view, filter, showArchive, archiveRows); cursor moves then do no O(N) work. Acceptance asserts the builders run once per data change, not per keystroke","Memoize the derived list AND extract the list into a React.memo child so a cursor move re-renders only the list region, not the whole App (header/content/status bar)","Capture a before/after keystroke-latency measurement (timing harness or documented repro at N≈1000) as part of acceptance, in addition to the memoization fix"]
- recommendation: Treat #13 as a FIX task (the cause is plainly in the render path — no /investigate needed). Memoize the three O(N) derivations (visibleRows result, maxIdW/maxStatusW, buildItemEntries entries) with useMemo keyed on (view, filter, showArchive, archiveRows); that removes per-keystroke O(N) work and is the minimal, surgical fix. Add a quick documented repro/measurement at a large N first (reproduction-first), and make acceptance assert the heavy builders execute once per data change rather than per cursor move. Defer the React.memo list-extraction unless the memoization alone proves insufficient.
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q50 — answered

- createdAt: 2026-06-02T09:45:51.941Z
- updatedAt: 2026-06-02T09:48:12.303Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #14 (per-suggestion 'pick as answer'): Once suggestions render as a list (item #4: web T56 → <ul><li>, TUI T57 → bulleted lines; placed in order by T58/T59), add a per-suggestion affordance that sets THAT suggestion's text as the answer, analogous to the existing 'as recommended' button. Confirm the design forks: (WEB) the existing 'as recommended' button lives in answerBox (App.tsx L1733-1741) and calls answerWith(AS_RECOMMENDED_ANSWER) → onSave(ANSWERED_STATUS, {...fields, answer}); the new control would render a small button after each <li> calling answerWith(suggestionText). But the suggestions list (T56) renders in renderQuestionFields() where `answerable`/`answerWith` are in scope — confirm the per-suggestion button is shown ONLY when the item is `answerable` (open + canAnswer), and whether clicking it (a) immediately saves+marks answered (parity with 'as recommended'), or (b) just PREFILLS the answer textarea so the user can edit before saving. (TUI) The TUI has no buttons; the existing 'as recommended' is the `r` keybinding (app.tsx L572-581) that calls applyAnswer(cur, AS_RECOMMENDED_ANSWER). The parity for 'pick suggestion N as answer' is a keybinding — e.g. a number key 1-9 selecting the Nth suggestion, or entering an indexed pick mode — confirm which, and whether it (a) saves immediately or (b) opens the answer overlay prefilled with that suggestion. Also confirm scope: questions ledger only, or any answerable ledger that has a suggestions field?"
- context: "Verified in source. WEB answerBox (App.tsx L1718-1744): 'save & mark answered' (submitAnswer) and 'as recommended' (answerWith(AS_RECOMMENDED_ANSWER)); answerWith builds onSave(ANSWERED_STATUS, {...fields, [ANSWER_FIELD]: answer}). Suggestions are rendered (today) as v.join(', '); T56 changes that to a bulleted list inside renderQuestionFields(), which already has `answerable` and `answerWith` in scope, so wiring a per-li button is straightforward. TUI: 'as recommended' is the `r` key in both focus modes (app.tsx L548-557, L572-581), gated on canAnswer + hasRecommendation, calling applyAnswer(cur, AS_RECOMMENDED_ANSWER); suggestions list comes from T57. There is no per-suggestion picker yet in either UI. This FEATURE DEPENDS ON the suggestions-list rendering (web T56, TUI T57) and naturally sits with the field-order tasks (T58/T59). The AS_RECOMMENDED_ANSWER sentinel pattern is the model: a per-suggestion pick would instead pass the literal suggestion text. Need the save-vs-prefill and TUI-keybinding decisions before writing the fix/feature tasks, plus the dependency on T56/T57 recorded."
- suggestions: ["Web: per-<li> 'pick' button (shown only when answerable) that immediately saves+marks answered with that suggestion's text (parity with 'as recommended'). TUI: number keys 1-9 pick the Nth suggestion and save immediately (gated on canAnswer + a suggestions field present). Scope: questions ledger only (where suggestions lives)","Same affordances but clicking/picking PREFILLS the answer (web textarea / TUI answer overlay) instead of saving immediately, so the user can edit before confirming","Scope to any answerable ledger that declares a suggestions field (via canAnswer), not just questions"]
- recommendation: "Web: render a small 'pick' button after each suggestion <li> in renderQuestionFields(), shown only when the item is answerable, calling answerWith(suggestionText) to immediately save + mark answered (exact parity with the existing 'as recommended' button). TUI: bind number keys 1-9 to pick the Nth suggestion and call applyAnswer(cur, suggestionText) immediately (gated on canAnswer and presence of suggestions), mirroring the `r` as-recommended key. Scope to the questions ledger (the only ledger with a suggestions field). Record the dependency on T56 (web list) and T57 (TUI list), sequenced after them."
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q51 — answered

- createdAt: 2026-06-02T09:55:43.812Z
- updatedAt: 2026-06-02T10:32:42.191Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #15 (disable answer-fill controls once the user is typing): confirm the three genuine design forks so the fix tasks can be written. (A) WEB 'non-empty answer' signal + threshold: the answer field is an UNCONTROLLED <textarea> (ref={answerRef}, defaultValue=…, App.tsx L1720-1728) — there is currently NO reactive value, so the 'as recommended' button (data-testid answer-as-recommended, L1733-1741) and the per-suggestion 'pick' buttons (item #14 / T56) cannot reactively flip `disabled` today. Fork: introduce a small reactive 'answer is non-empty' signal driven by an onInput/onChange on the (still-uncontrolled) textarea (under happy-dom, onChange on a controlled text input doesn't fire — but onInput on the uncontrolled textarea DOES, and that is exactly the signal to test against), and gate the buttons' `disabled` on it. And what counts as 'entered ANY text' — any NON-WHITESPACE character (recommended; trailing/leading spaces don't lock the buttons) vs literally any keystroke incl. whitespace? (B) TUI 'answer buffer non-empty' semantics: the `r` as-recommended key and the #14 pick keys fire in LIST/CONTENT focus modes (app.tsx L550-557, L574-581), OUTSIDE the answer overlay — they read the PERSISTED cur.item.fields.answer, not a live edit buffer (the live buffer only exists transiently inside the { t:'answer' } overlay). Fork: make those keys inert/no-op when the PERSISTED answer field is non-empty (recommended — fieldToString(cur.item.fields[ANSWER_FIELD]).trim().length>0, symmetric with the web disabled state and with where the keys actually fire) vs trying to gate on a live-typed buffer (which those keys never see). (C) Scope: does the disable-when-typing rule also cover the 'as recommended' / per-suggestion 'pick' controls INSIDE the batch-answer modal (item #5), or only the main detail-panel answerBox? Recommended: apply it wherever those auto-fill controls render, including the batch modal, since the clobber risk is identical there."
- context: "Grounded in source. WEB answerBox (App.tsx L1718-1744): uncontrolled textarea via answerRef + defaultValue (the repo uses uncontrolled inputs precisely because happy-dom doesn't fire onChange on controlled text inputs — CLAUDE.md). 'as recommended' button at L1733-1741 calls answerWith(AS_RECOMMENDED_ANSWER); item #14 (T56) adds per-suggestion 'pick' buttons in renderQuestionFields(). Because the textarea is uncontrolled there is no existing reactive 'is non-empty' value, so #15's web half necessarily adds a minimal input-driven signal and a testable disabled state. TUI: the `r` key (app.tsx L550-557 content-focus, L574-581 list-focus) and the planned #14 pick keys are gated on canAnswer + hasRecommendation and call applyAnswer(cur, …) reading the persisted item — they fire outside the live answer overlay, so 'answer buffer non-empty' for the TUI most coherently means the persisted answer field is non-empty. #15 DEPENDS ON item #14 (T56 web pick buttons, T57 TUI pick keys) and the existing 'as recommended' affordance, so its fix tasks must sequence after T56/T57. This is a small, well-specified item — a single confirm captures the only real forks."
- suggestions: ["Confirm all three recommendations as stated: (A) web — add an input-driven 'answer non-empty (non-whitespace)' signal on the uncontrolled textarea (onInput), gate the 'as recommended' + per-suggestion 'pick' buttons' disabled on it; (B) TUI — make the `r` and #14 pick keys inert when the persisted answer field is non-empty (trimmed); (C) apply the rule everywhere those controls render, including the batch-answer modal (#5)","(A) threshold = any keystroke incl. whitespace instead of non-whitespace","(C) limit the rule to the main detail-panel answerBox only; leave the batch-answer modal controls always enabled","(B) for the TUI, gate only on a live-typed buffer inside the answer overlay (not the persisted field) — note: the `r`/pick keys do not currently fire inside that overlay, so this would also require moving/adding those keybindings into the overlay"]
- recommendation: "Confirm all three recommendations as stated (suggestion 1): web gates on a non-whitespace input signal driven by onInput on the uncontrolled textarea; TUI makes the `r`/pick keys inert when the persisted answer field is non-empty (trimmed); and the rule applies wherever the auto-fill controls render, including the batch-answer modal. Sequence #15's tasks after T56/T57."
- ledgerRefs: ["goals:G2"]
- answer: as recommended

### Q54 — answered

- createdAt: 2026-06-02T14:55:31.510Z
- updatedAt: 2026-06-02T14:57:51.116Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "Item #18 (orchestrator-generated file-and-defer ROUTING questions, e.g. Q52/Q53): these are created by the implement/plan flows (file-and-defer per K8/Q26) to point you at `/investigate:start <D>` for an out-of-scope/pre-existing defect. They carry only question+context+ledgerRefs (no suggestions/recommendation), so they 'don't look like questions'. Decide the model: (a) DO NOT create them as `questions` items at all — the open defect + its `goals:<G>`/`defects:<D>` ledgerRefs already make it discoverable to the orchestrator's ledger query, so the routing pointer is redundant noise in the questions ledger; OR (b) KEEP them as questions but give them proper shape — a routing-question MARKER field plus standard suggestions (e.g. ['run /investigate:start D3','defer','wontfix']) and a recommendation — so they read like real, actionable questions and are visually distinguishable from clarifying questions. Which model do you want, and (if (b)) should the distinction be a dedicated schema field/marker or just convention in the flow prompts?"
- context: "Verified context: the relevant memory (K8 point 3 superseded by K12) is that the /plan:* orchestrator already RE-DERIVES the auto-investigate worklist by QUERYING the ledger for open defects newly linked goals:<G> — so the routing *defect record* (open status + ledgerRefs) is the authoritative signal, NOT the prose routing-question. That makes (a) viable: dropping the routing question loses nothing the orchestrator needs. The counter-argument for (b): a human scanning the questions view sees the pending decision (investigate vs defer vs wontfix) explicitly. This spans the flow prompts (llm/commands/implement/advance.md §3 file-and-defer, llm/commands/plan/advance.md auto-investigate routing, llm/agents/plan-reviewer.md) and possibly the questions schema/rendering (a routing-question marker would be a schema/render change). Because the questions ledger is dogfood-only with no back-compat constraint, either model is cheap to apply. This is the only item in follow-up #4 that is a genuine design/process decision (16/17 are plain rendering fix-tasks, 19 is a CSS refinement) — it warrants a clarifying answer and likely a `decisions` lock recording the chosen routing-pointer model."
- suggestions: ["(a) Do NOT create routing pointers as questions items at all — rely on the open defect + ledgerRefs (which the orchestrator already queries); remove the file-a-question step from the flow prompts","(b) Keep them as questions but give proper shape: add a routing-question marker (schema field) + standard suggestions ['run /investigate:start <D>','defer','wontfix'] + recommendation, rendered distinctly from clarifying questions","(b-lite) Keep them as questions with proper suggestions/recommendation shape but NO new schema marker — distinguish purely by convention/wording in the flow prompts"]
- recommendation: "Prefer (a): stop creating file-and-defer routing POINTERS as `questions` items entirely. Per K12 the orchestrator re-derives the auto-investigate worklist from the ledger (open defects linked goals:<G>), so the routing question is redundant and pollutes the questions ledger; the defect record is already the authoritative, discoverable signal. Apply by removing the 'file a run /investigate:start question' step from llm/commands/implement/advance.md, llm/commands/plan/advance.md, and llm/agents/plan-reviewer.md, and lock the decision. (If you want the human-visible prompt, fall back to (b) with a marker.)"
- ledgerRefs: ["goals:G2"]
- answer: "Direction (a), per the user: the questions ledger is RESERVED for genuine user-interaction questions. Do NOT create file-and-defer 'routing' questions (the Q52/Q53 kind) at all. /investigate:start already accepts a bare defect id (resume path), so no question is needed to point at it; the open defect + its ledgerRefs are already discoverable by ledger query. The triage/deferral note belongs ON the defect record itself (a defect field), not a separate question item. Flow change: implement/advance.md §3, plan/advance.md auto-investigate routing, and plan-reviewer.md must stop filing the 'run /investigate:start <D>' question — file only the open defect (carrying the triage note). One-time cleanup: retire existing routing questions Q52/Q53 and fold their notes into D3/D4/D5/D6. See decision K13."

## M11

### Q37 — answered

- createdAt: 2026-06-02T08:42:37.390Z
- updatedAt: 2026-06-02T11:26:11.572Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "D2 does NOT reproduce from source — the requested auto-init already exists and works. To find the real root cause, what did you actually observe? Please provide: (a) the exact client error / how 'MCP connection fails' surfaced; (b) HOW the ledger MCP server was launched in that directory — from source (`bun … main.ts`), the Nix-built product (`nix build .#ledger-mcp`), or the globally plugin-registered (home-manager) binary [version skew is the prime suspect — see H3 / cf. D1]; (c) whether that directory even had a `.mcp.json` / plugin wiring the ledger server (no wiring = 'not configured', not a connection failure); (d) was it THIS repo or a different/empty project, and was the dir writable?"
- context: "Round 1 of investigation. H1 (server-startup registry-load throws) and H2 (FsLedgerStore construction/index-build throws) both adjudicated WRONG by orchestrator-verified citations + a live reproduction: FsLedgerStore.init() (packages/ledger/src/store/FsLedgerStore.ts:254-340), called by main() (packages/ledger-mcp/src/main.ts:337-344) BEFORE serving, mkdir's docs/ recursively, swallows ENOENT on the registry and each ledger file, writes EMPTY_REGISTRY, and bootstraps CANONICAL_LEDGERS. Reproduction: `bun packages/ledger-mcp/src/main.ts --cwd <fresh empty tmpdir>` printed 'serving stdio MCP', exited 0, and auto-created docs/ledgers.yaml + all canonical ledger files. So the source already does exactly what D2 requests. Remaining live hypothesis H3 (environmental: stale globally-registered/Nix binary version-skew like D1, or --cwd/.mcp.json wiring) needs your environment data to adjudicate. After answering, re-run /investigate:advance D2."
- suggestions: ["Most likely: the globally plugin-registered (home-manager/Nix) ledger-mcp binary is older than the source that has the auto-init — rebuild/refresh it (version skew, cf. D1) and retest","The directory had no .mcp.json wiring the ledger server (so it was never configured, not a 'connection failure')","A --cwd resolved to a non-existent or unwritable path","Something else — paste the actual error"]
- recommendation: Capture the exact failure + launch method; if it's the globally-registered binary, rebuild it and retest before we plan any code fix (source already auto-inits, so a code change may be unnecessary).
- ledgerRefs: ["defects:D2","hypothesis:H3"]
- answer: "User-provided actual error: `ledger-mcp: fatal: Bootstrap invariant violated: existing goals ledger has a different schema than its canonical bootstrap schema`. So the failure is NOT missing-init (the empty-dir auto-init works) — it is the BootstrapViolationError thrown by FsLedgerStore.init() (packages/ledger/src/store/FsLedgerStore.ts:283-289) when an EXISTING on-disk ledger's schema diverges from its CANONICAL_LEDGERS bootstrap schema (e.g. a stale/version-skewed binary vs an evolved docs/ledgers.yaml). Confirms the H3 environmental direction. Desired fix (user): on such a divergence, automatically BACK UP the old/divergent ledger files and set up fresh canonical ledgers, instead of aborting with a fatal error."

## M15

### Q42 — answered

- createdAt: 2026-06-02T09:13:16.879Z
- updatedAt: 2026-06-02T09:46:35.053Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[A] Which interpretation of \"auto-investigate\" do you want — (a) main-session auto-chain (the /plan:advance ORCHESTRATOR detects a defect and runs the /investigate:advance pass INLINE, then resumes planning in the same session), (b) auto-LAUNCH but keep file-and-defer (no inline loop — the orchestrator kicks off /investigate:start automatically and auto-resumes planning once a root cause is confirmed, across separate passes), or (c) hybrid (auto only for reviewer-found IN-PLAN out-of-scope defects; user-reported faults still go through /investigate:start manually)?"
- context: "This is the central fork; everything else in change A depends on it. Today (K8 point 3, locked) the integration is strictly FILE-AND-DEFER: plan-flow files a defect + an open question telling the user to run /investigate:start, and investigate hands back via a user-run /plan:advance. There are exactly two file-and-defer trigger sites today: (i) the plan-reviewer reports out-of-scope faults in its review's defects[] bucket, which plan-advance.md's 'Consuming the reviewer's defects[] bucket' section (lines 213-242) files + routes to /investigate:start; and (ii) a goal that itself describes a fault, which is normally intaked via /investigate:start (per plan/start.md lines 26-37) and only reaches plan-flow already-investigated as a defect-seeded goal. Interpretation (a) is the most automatic but most aggressively reverses K8; (b) preserves the file-and-defer record shape while removing the manual step; (c) is the smallest change and keeps user-reported intake unchanged."
- suggestions: ["(a) main-session orchestrator auto-chains /investigate:advance inline then resumes planning","(b) keep file-and-defer record shape but auto-launch investigation and auto-resume planning on confirmed root cause","(c) hybrid: auto-investigate only reviewer-found in-plan defects; user-reported still manual /investigate:start"]
- recommendation: "(c) hybrid — it is the narrowest reversal of K8 (only the reviewer's out-of-scope defects[] bucket becomes auto-chained), keeps the user-reported /investigate:start intake and the defect-seeded clarify-skip exactly as they are, and avoids unbounded auto-chaining by confining the auto-trigger to the one site already inside a /plan:advance pass."
- ledgerRefs: ["goals:G3"]
- answer: "b: when user provides defect report to plan:* - it should be filed. If defect was found automatically, it should be filed. The orchestrator should launch investigate:* itself once it finishes its primary work - always when possible."

### Q43 — answered

- createdAt: 2026-06-02T09:13:27.704Z
- updatedAt: 2026-06-02T09:50:00.401Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[A] Where must the auto-investigate trigger LIVE — in the /plan:advance command orchestrator (llm/commands/plan/advance.md), or can any part of it go in the plan-advance subagent (llm/agents/plan-advance.md)? Do you accept the constraint that, because subagents cannot spawn subagents, ONLY the main-session /plan:advance orchestrator can run an /investigate:* pass (which itself dispatches investigate-explorer subagents)?"
- context: "Hard architectural constraint to confirm before scoping edits. The plan-advance subagent (llm/agents/plan-advance.md, disallowedTools includes Bash, never spawns subagents) is the one that today files the reviewer's defects[] bucket + routes it to /investigate:start (its 'Consuming the reviewer's defects[] bucket' section). But /investigate:advance (llm/commands/investigate/advance.md) is a COMMAND that dispatches investigate-explorer subagents — a subagent cannot run it. So any INLINE auto-chain (interpretation a) MUST move the trigger logic up into the /plan:advance orchestrator (llm/commands/plan/advance.md), which currently only drives the planner<->reviewer loop and explicitly says 'You do NOT mutate the ledger yourself'. This reshapes the orchestrator's responsibilities. If you pick interpretation (b)/(c), the subagent can still merely FILE the defect and the orchestrator decides whether to auto-launch."
- suggestions: ["Trigger lives entirely in /plan:advance orchestrator (llm/commands/plan/advance.md); the plan-advance subagent only files/flags defects","Split: subagent files the defect + sets a flag, orchestrator reads the flag and auto-launches investigate"]
- recommendation: "Trigger lives entirely in the /plan:advance orchestrator. The plan-advance subagent keeps filing the defect record (its only ledger-write capability) and the orchestrator, after the subagent returns, decides whether to auto-run the /investigate:* pass. This respects subagents-cannot-spawn-subagents and keeps the single-place-for-loops principle the suite already follows."
- ledgerRefs: ["goals:G3"]
- answer: "It should be viewed in the context of Q42 answer - plan:advance, plan:follow-up and plan:start could trigger investigations"

### Q44 — answered

- createdAt: 2026-06-02T09:13:38.518Z
- updatedAt: 2026-06-02T09:51:51.789Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[A] How do you want to bound auto-chaining so it can't run away? \"Automatic\" risks investigate -> (seeds goal) -> plan -> (produces tasks) -> potentially implement, with no user checkpoint. What is the STOP boundary: (i) auto-chain investigate only, then PAUSE and report (user runs /plan:advance to plan the confirmed defect); (ii) auto-chain investigate THEN re-plan, then pause before any /implement; (iii) a depth/iteration cap on how many auto-investigate passes one /plan:advance round may trigger?"
- context: "/plan:advance already has a hard 4-iteration cap per goal on the planner<->reviewer loop (advance.md lines 33,56). Auto-investigate adds a NEW axis of chaining that crosses command boundaries. On a confirmed root cause, /investigate:advance seeds a defect-seeded goal (K8 point 4) that the planner will then turn into fix tasks WITHOUT a clarifying round — so investigate->plan can proceed with zero user input. We must decide where the chain MUST stop and hand control back. Note B (never auto-close goals) already forbids the implement-flow from closing a goal, but does not by itself stop an auto-chain from STARTING implementation."
- suggestions: ["(i) auto-investigate only, then pause + report; user triggers planning","(ii) auto-investigate then auto-re-plan, but always pause before /implement","(iii) allow the chain but cap auto-investigate passes per /plan:advance round (e.g. N=1) and report"]
- recommendation: "(ii) plus an explicit cap: auto-run the investigate pass and, on a confirmed root cause, auto-resume planning to emit reviewed fix tasks, but NEVER auto-start /implement and never exceed one auto-investigate handoff per /plan:advance round — report and stop so the user stays in control of execution."
- ledgerRefs: ["goals:G3"]
- answer: "The stop boundary should be smart: the orchestrator should check what's going on for illness - if it sees that investigation is looping meaninglessly - it should stop communicating the problem to user through a question. We MUST remove any hard-caps and do the same - detect ill loops with model, not hard caps"

### Q45 — answered

- createdAt: 2026-06-02T09:13:48.870Z
- updatedAt: 2026-06-02T09:52:27.221Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[A] How should the locked decision K8 record be handled when auto-investigate reverses/refines its point 3 (file-and-defer, 'MUST NOT re-implement or invoke the planner<->plan-reviewer loop')? Options: (i) supersede K8 with a NEW locked decisions item that cites and overrides point 3 (K8 stays as immutable history); (ii) update K8's fields in place to note the revision; (iii) leave K8 and add the new behavior as a separate decision without explicitly marking the supersession?"
- context: "K8 (decisions ledger, status: locked, milestone M1) point 3 explicitly locks HANDOFF = FILE-AND-DEFER and forbids inline plan loops, and its 'alternatives' field records 'Inline plan loop inside /investigate:advance (rejected ...)'. Change A reverses or refines exactly this. The repo convention (CLAUDE.md) is to record non-obvious choices as decisions items and that locked decisions are immutable choices. Whichever you pick affects whether the plan must create a new decision item or mutate K8. Also: K8 point 3's prohibition is on /investigate:advance running the PLAN loop inline; change A is the SYMMETRIC direction (/plan:advance running the INVESTIGATE loop) — confirm whether you consider that a reversal of K8 or a new, separately-justified direction."
- suggestions: ["Supersede: create a new locked decision that cites K8 and overrides point 3; leave K8 intact as history","Amend K8 in place","New decision, no explicit supersession marker"]
- recommendation: Supersede with a new locked decision that cites K8 point 3, states the new auto-investigate direction and its bound (per the runaway-boundary answer), and leaves K8 immutable as the historical record. This matches 'locked decisions are immutable' while keeping the rationale chain traceable.
- ledgerRefs: ["goals:G3"]
- answer: as recommended

### Q46 — answered

- createdAt: 2026-06-02T09:13:58.762Z
- updatedAt: 2026-06-02T09:38:38.704Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[B] For 'never auto-close goals', is ONLY the terminal building->done goal transition forbidden, or also the planned->building transition at work-start? I.e. may the orchestrator still auto-advance a goal planned->building when /implement:start begins work, and the prohibition is strictly that nothing may transition a goal to done automatically — only the user closes it?"
- context: "The goals state machine (plan-advance.md lines 67-70) has transitions planned->building and building->done. Your error on G1 was auto-running planned->building->done. The desired rule clearly forbids the terminal ->done. But planned->building (work has started) is a non-terminal status change that arguably reflects reality automatically. /implement:start (implement/start.md) is 'fully autonomous by default, no confirmation checkpoints' and does not today mention touching the goal status at all — the offending hint is in implement/advance.md line 204 ('The goal G ... can advance per the plan-flow once the milestone is archived'), which is about post-completion advancement (toward done). Clarify the exact boundary so the edits forbid the right transition(s)."
- suggestions: ["Forbid ONLY automatic ->done; allow automatic planned->building at work-start","Forbid BOTH automatic planned->building AND ->done; the user owns every goal-status transition","Forbid any automatic goal-status change once a plan is planned"]
- recommendation: "Forbid ONLY the automatic terminal ->done transition; allow planned->building to happen automatically at work-start since it merely records that implementation began (non-terminal, reversible-in-spirit, and reflects reality). The hard rule is: an orchestrator never CLOSES a goal — only the user does."
- ledgerRefs: ["goals:G3"]
- answer: as recommended

### Q47 — answered

- createdAt: 2026-06-02T09:14:10.537Z
- updatedAt: 2026-06-02T09:52:50.712Z
- author: user
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- question: "[B] When all of a goal's work milestones complete, what exactly should the orchestrator do and report? Confirm: (1) it still archives the completed work milestones automatically; (2) it prints an explicit 'goal G is ready to close — run `/plan ...` (or the TUI/web) to close it' style hint with the precise command/wording; and (3) it does NOT transition the goal. Also: is there a /plan:* command for the user to close a goal, or do they close it only via the TUI/web (set status to done)?"
- context: "implement/advance.md's 'Milestone completion' section (lines 192-204) currently auto-archives the milestone and ends with 'The goal G ... can advance per the plan-flow once the milestone is archived' — the language that invited the auto-close. The desired behavior is archive + REPORT-ready-to-close + leave the goal alone. I could not find a /plan:close or equivalent command in llm/commands/plan/ (only start, advance, follow-up) — so the user likely closes the goal via the TUI/web by setting status to done, or via /plan:advance which today returns 'completed' for a planned goal but does NOT close it. The exact hint wording must point the user at a real action; confirm which one. This change also wants to honor the standing user rule 'never auto-close goals'."
- suggestions: ["Archive milestones + print 'goal G ready to close; close it in the TUI/web (set status to done)' + do not transition","Archive milestones + print hint referencing a (to-be-added) /plan close command","Also report which milestones were archived and that tasks/defects were marked terminal (those auto-transitions stay allowed)"]
- recommendation: Archive the completed work milestones, then print an explicit 'all work for goal G is complete and its milestones are archived — goal G is ready to close; close it yourself in the TUI/web (set G to done) when satisfied' line, and make NO goal-status change. Keep auto-marking individual tasks/defects terminal (that is fine); the prohibition is strictly on closing the GOAL. Use TUI/web as the close mechanism unless you want a new /plan command (separate, larger scope).
- ledgerRefs: ["goals:G3"]
- answer: as recommended

## M27

### Q55 — answered

- createdAt: 2026-06-02T22:31:00.050Z
- updatedAt: 2026-06-02T22:32:49.299Z
- author: user
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: "For the universal /advance command, what are the concrete LEDGER-QUERY detection predicates for 'anything to investigate / plan / implement'? Propose: (investigate) there exists an `open` (non-terminal) defect NOT blocked solely on an `open` question — i.e. a defect actionable by /investigate:advance; (plan) there exists a goal in a non-terminal planning phase (`clarifying` with no open question, or `planning`) that /plan:advance can move; (implement) there exists a goal in `planned`/`building` with a DAG-ready non-terminal task (per implement/advance.md step-1 READY-SET: non-blocked, deps done, no open question). Confirm or correct each predicate."
- context: "advance.md already defines the implement READY-SET precisely (llm/commands/implement/advance.md:69-74). plan:advance and investigate:advance have analogous internal stop predicates. /advance must re-derive 'is there work' by ledger query (the K12 ledger-as-source-of-truth pattern) rather than parsing sub-command prose. The exact predicates determine when /advance runs each sub-flow vs. skips it."
- recommendation: Adopt the three predicates as proposed above, each expressed as an explicit ledger query, mirroring implement/advance.md's READY-SET derivation.
- ledgerRefs: ["goals:G6"]
- answer: as recommended

### Q56 — open

- createdAt: 2026-06-02T22:31:10.069Z
- updatedAt: 2026-06-02T22:31:10.069Z
- author: "opus-4.8[1m]"
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: Does /advance run ONE pass of each sub-flow in sequence (investigate -> plan -> implement, once) and then report, OR does it LOOP the whole sequence until quiescent (no sub-flow makes progress)? The verbatim request says 'checks ... if so it runs ...' for each in order, which reads as one ordered pass; but because investigate can SEED a goal (-> new plan work) and implement can FILE defects (-> new investigate work), a single pass leaves discovered work for the next manual run.
- context: "Each sub-command (plan:advance, investigate:advance, implement:advance) is itself ALREADY an internal loop that runs until ITS own stop predicate (needs-user / drained). The open question is only about the OUTER composition across the three flows. A loop-until-quiescent outer needs a fixpoint/termination guard (e.g. stop when a full sequence pass produces zero ledger mutations, with a max-iterations safety cap) to avoid spinning."
- suggestions: ["One ordered pass (investigate -> plan -> implement), then report what remains discovered for the next run (simplest; matches the verbatim wording)","Loop the sequence until a full pass makes no progress (fixpoint), with a max-iteration safety cap and per-iteration progress logging","One pass by default, with an explicit opt-in flag/argument to loop-to-quiescence"]
- recommendation: Loop the sequence to quiescence with a max-iteration cap, since the explicit motivation (investigate seeds plan, implement files defects -> investigate) is precisely cross-flow discovery that a single pass would strand; report the drained/blocked state at the fixpoint.
- ledgerRefs: ["goals:G6"]

### Q57 — open

- createdAt: 2026-06-02T22:31:18.689Z
- updatedAt: 2026-06-02T22:31:18.689Z
- author: "opus-4.8[1m]"
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: "Confirm the cross-flow RE-CHECK / ordering contract: after investigate:advance completes, /advance should re-check the PLAN predicate (a confirmed root cause file-and-defers a fix into a goal/plan); after implement:advance completes, /advance should re-check the INVESTIGATE predicate (a reviewer may file out-of-scope defects). Is the canonical cycle therefore investigate -> plan -> implement -> (back to investigate if implement filed defects)? And within the loop, should plan:advance's own auto-investigate phase (it launches /investigate:advance for goal-linked open defects per K12) be left to plan:advance, with /advance NOT separately launching investigate for those same defects (to avoid double-triage)?"
- context: "plan:advance (the COMMAND orchestrator, T74) already re-derives an auto-investigate worklist by ledger query and launches /investigate:advance itself for `open` defects linked to its goal. /advance must not duplicate that triage. Clarifying the ownership boundary prevents /advance and plan:advance both launching investigate on the same defect in one outer iteration."
- recommendation: "Cycle order investigate -> plan -> implement, re-checking the investigate predicate after implement (since implement files defects); rely on plan:advance to own auto-investigate of goal-linked defects, so /advance's standalone investigate step targets only defects NOT already covered by an active goal's plan:advance triage (or simply lets the next outer iteration's plan step pick them up)."
- ledgerRefs: ["goals:G6"]

### Q58 — open

- createdAt: 2026-06-02T22:31:31.025Z
- updatedAt: 2026-06-02T22:31:31.025Z
- author: "opus-4.8[1m]"
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: "Confirm /advance's execution model under the subagents-cannot-spawn-subagents constraint (K12): /advance is a top-level COMMAND run in the MAIN session (not a subagent), so it is permitted to chain the three sub-COMMANDS (investigate:advance, plan:advance, implement:advance) by invoking their loops inline in the main session — the same way each existing command orchestrates its own subagents. /advance itself dispatches NO subagents directly; it only sequences the sub-commands, each of which owns its own subagent dispatch. Is this the intended shape (a command-of-commands), and should it be implemented as a slash-command prompt under llm/commands/advance.md (no namespace) that literally instructs the runtime to run the three sub-commands in order per the resolved predicates?"
- context: K12 keeps 'subagents cannot spawn subagents' in force but explicitly allows a COMMAND to chain other commands' loops. /advance has no namespace (unlike plan/implement/investigate which are families). It needs LINKS wiring in scripts/link-prompts.ts (.claude/commands/advance.md -> llm/commands/advance.md) plus the committed .codex/prompts mirror, like the other command families. Confirming the shape fixes whether /advance is a thin sequencer prompt vs. a new orchestrator with its own ledger logic.
- recommendation: Implement /advance as a thin top-level sequencer command (llm/commands/advance.md, no namespace) run in the main session that evaluates the three ledger predicates and invokes the corresponding existing sub-commands in order, dispatching no subagents of its own; wire it into link-prompts.ts LINKS + .codex/prompts mirror exactly like the existing families.
- ledgerRefs: ["goals:G6"]

### Q59 — open

- createdAt: 2026-06-02T22:31:39.492Z
- updatedAt: 2026-06-02T22:31:39.492Z
- author: "opus-4.8[1m]"
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: "For the 'nothing to do' report, what exactly must /advance distinguish and surface? Proposed taxonomy: (a) DRAINED — no open defects, no goal in a movable planning phase, no DAG-ready task; nothing actionable anywhere. (b) BLOCKED-ON-QUESTIONS — work exists but every actionable item is gated by an `open` question (defects/goals/tasks waiting on user answers); report which question ids block which items and instruct the user to answer them then re-run. (c) MIXED — some progress was made this run AND some items remain blocked-on-questions; report both. Should the report enumerate the blocking question ids (and their owning defect/goal/task), mirroring implement:advance's end-of-pass report?"
- context: The verbatim request requires /advance to 'explain that' when there is nothing to do, distinguishing 'ledgers drained' from 'everything blocked by questions'. implement/advance.md already has a precedent end-of-pass report (lines 216-225) that enumerates blocked tasks + the question ids to answer. /advance's report should compose the three sub-flows' blocked/drained states into one coherent message.
- recommendation: Adopt the (a)/(b)/(c) taxonomy and enumerate blocking question ids with their owning item, mirroring implement/advance.md's report; on DRAINED say so plainly, on BLOCKED list the questions to answer and instruct re-run after answering.
- ledgerRefs: ["goals:G6"]

### Q60 — open

- createdAt: 2026-06-02T22:31:48.832Z
- updatedAt: 2026-06-02T22:31:48.832Z
- author: "opus-4.8[1m]"
- session: fe0aaf85-56b3-45ce-a7fc-718ab19c37e1
- question: "Scope of the N=4 -> N=8 subagent-parallelism bump (item 3): confirm it applies to the implement-flow concurrent-worker cap in llm/commands/implement/advance.md ('Concurrency' rule, currently 'N = 4', line 36) and any N=4 default referenced in llm/commands/implement/start.md. Does the bump apply ANYWHERE ELSE — e.g. does investigate:advance cap concurrent explorer subagents, does plan:advance cap concurrent reviewers, or does the new /advance command introduce/reference any parallelism cap? Should all such caps move to 8 consistently, or is 8 specifically the implement-flow worker cap only?"
- context: "Verified: the only explicit 'N = 4' concurrency cap is in implement/advance.md:36 ('at most N = 4 workers in flight'). Need to confirm whether implement/start.md restates it and whether the investigate/plan families have their own concurrency caps that should move in lockstep, vs. leaving them as-is. This bounds the edit scope (markdown-only) and the bun run check no-op gate."
- suggestions: ["Bump only the implement-flow worker cap (advance.md + any restatement in start.md) to 8; leave other flows untouched","Bump every subagent-concurrency cap across all flows to 8 for consistency","Bump implement to 8 and have /advance document that it inherits each sub-flow's own cap (no new cap of its own)"]
- recommendation: Bump the implement-flow worker cap to 8 in implement/advance.md (and any N=4 restatement in implement/start.md); audit investigate/plan for any concurrency cap and bump those to 8 too only if they exist, so the parallelism story is consistent; /advance introduces no cap of its own (it inherits each sub-flow's).
- ledgerRefs: ["goals:G6"]
