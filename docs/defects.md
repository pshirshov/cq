---
ledger: defects
counters:
  milestone: 0
  item: 6
archives:
  - id: M2
    path: ./archive/defects/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
---

# defects

## M11

### D2 — wip

- createdAt: 2026-06-02T08:37:01.114Z
- updatedAt: 2026-06-02T11:26:29.040Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: ledger-mcp fails to connect in a directory with no initialized ledger (should auto-init)
- severity: major
- description: "MCP connection fails when an agent (Claude Code / Codex) starts in a directory that has NO initialized ledger — i.e. no docs/ ledger state / no docs/ledgers.yaml present. The `@cq/ledger-mcp` server fails to connect/serve instead of degrading gracefully, so the session has no ledger tools. Desired behavior: instead of failing, automatically initialize the canonical ledger set (init the ledgers) on startup so the MCP connection succeeds in a fresh directory. Investigate the root cause — where/why the server errors on missing ledger state, what \"initialized\" means (which files/dirs are required), whether `--cwd` resolution or a missing docs/ledgers.yaml is the trigger, and where an auto-init hook should live (server startup vs store construction) — then seed fix tasks. Severity: major (blocks using the tool in any uninitialized repo; workaround = manually init the ledger files)."
- rootCause: "ledger-mcp aborts at startup with BootstrapViolationError ('existing <ledger> ledger has a different schema than its canonical bootstrap schema') thrown by FsLedgerStore.init() (packages/ledger/src/store/FsLedgerStore.ts:283-289) when an EXISTING on-disk ledger's schema diverges from its CANONICAL_LEDGERS bootstrap schema. main() (packages/ledger-mcp/src/main.ts:337-344) awaits store.init() BEFORE serving, so the throw crashes the process before the MCP handshake → client sees 'connection failed'. NOT a missing-init problem (the empty-dir auto-init path works). The divergence is a version-skew artifact (stale built/global binary vs evolved docs/ledgers.yaml, or vice-versa). Confirmed by the user's verbatim runtime error (hypothesis H4, parent H3)."
- suggestedFix: "Replace the fatal throw with a graceful BACKUP-AND-REINIT: when FsLedgerStore.init() detects a schema divergence for an existing ledger (the schemasEqual==false branch), instead of throwing BootstrapViolationError, (a) move/copy the divergent on-disk ledger file(s) (and docs/ledgers.yaml) into a timestamped backup location (e.g. docs/.backup/<ISO-timestamp>/), then (b) write fresh canonical ledger(s) + registry from CANONICAL_LEDGERS and continue startup. Surface a loud WARNING (stderr) naming the backup path so no data is silently lost. Consider a guard/opt-out flag if a non-destructive abort is ever wanted, but default to backup-and-reinit per the user. Add tests: a seeded divergent on-disk schema → init() backs up + reinitializes + serves (no throw); backup dir contains the prior files."

## M14

### D3 — open

- createdAt: 2026-06-02T12:19:08.216Z
- updatedAt: 2026-06-02T12:19:08.216Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Stale @cq/ledger exports map: '.', './relationships', 'main' point at non-existent ./dist/*.js (real layout is ./dist/src/*.js)"
- severity: major
- description: "Out-of-scope defect surfaced by the T61 reviewer (pre-existing, not introduced by T61). packages/ledger/package.json declares main=./dist/index.js, exports['.']=./dist/index.js, exports['./relationships']=./dist/relationships.js, but the tsc build (tsconfig include:[src,test] + outDir:./dist) emits everything under dist/src/ — the real files are dist/src/index.js, dist/src/relationships.js. ./dist/index.js etc. do NOT exist. Masked today because all in-repo consumers resolve @cq/ledger* via tsconfig `paths` to SOURCE, so the exports-map dist paths are never exercised in-repo. But a published consumer, or the nix ledger-web/ledger-mcp products that bundle without a prior `tsc` and rely on the exports map (dist gitignored), would fail to resolve @cq/ledger / @cq/ledger/relationships in a clean checkout. suggestedFix: realign every exports/main entry to the real output layout (./dist/src/index.js, ./dist/src/relationships.js, ./dist/src/columns.js, etc.), OR set the ledger tsconfig rootDir:src so the build emits ./dist/*.js matching the declared paths. (T61's own @cq/ledger/columns gap is fixed separately as in-scope criticism via a web-tsconfig paths→source entry.)"
- suggestedFix: "Realign packages/ledger/package.json main + exports to ./dist/src/* (the real tsc output), or change the ledger package tsconfig to rootDir:'src' so dist emits flat ./dist/*.js matching the existing export paths. Add a test asserting each declared export target file exists after `tsc -b`."
- ledgerRefs: ["tasks:T61","goals:G2"]

### D4 — open

- createdAt: 2026-06-02T12:19:14.330Z
- updatedAt: 2026-06-02T12:19:14.330Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "`headline` is column-eligible — column picker can show a redundant headline/summary column"
- severity: low
- description: "Out-of-scope defect surfaced by the T62 reviewer (property of the T60 helper, not the T62 diff). In packages/ledger/src/columns.ts, eligibleColumnFields excludes only LONG_FIELD_DENYLIST plus id/status/summary; `headline` is in neither set, so the column picker (T61 web / T62 TUI) offers `headline` as a toggleable extra column. Selecting it renders the headline text BOTH as an extra column cell AND as the trailing summary (summarize() picks headline first), duplicating it in each row. Affects no acceptance clause; cosmetic. suggestedFix: add `headline` (and likely `title`/`question`) to the always-shown/denylist set in columns.ts so summary-source fields are never offered as redundant extra columns."
- suggestedFix: In packages/ledger/src/columns.ts, exclude the summary-source fields (headline, title, question) from eligibleColumnFields (add to ALWAYS_SHOWN or the denylist) so the column picker never offers a field that just duplicates the summary cell. Add a unit test.
- ledgerRefs: ["tasks:T62","goals:G2"]

## M18

### D5 — open

- createdAt: 2026-06-02T13:39:23.597Z
- updatedAt: 2026-06-02T13:39:23.597Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: Archived milestone subsection heads cannot render a status badge — ArchivePointer/Milestone carry no status
- description: "ArchiveSubsections (packages/ledger-web/src/App.tsx) renders archived heads from ArchivePointer ({id,path,summary}) and lazily-fetched ArchiveContent whose 'group' variant carries a Milestone (packages/ledger/src/types.ts L97-104) — neither has a `status` field; only ResolvedMilestone (L116-121) does. So an archived head omits the T80 status badge. T80's acceptance only requires an active milestone head; the description gated archived coverage on item #9 (T79), which did not thread status through. Closing this requires adding the milestone's terminal status to ArchivePointer or the archive group payload over MCP, then passing it as milestoneStatus to the archived MilestoneSubsection."
- severity: low
- suggestedFix: Add the milestone terminal status to ArchivePointer (or ArchiveContent group payload) over MCP; pass as milestoneStatus to the archived MilestoneSubsection.
- ledgerRefs: ["tasks:T80","goals:G2"]

### D6 — open

- createdAt: 2026-06-02T13:39:28.419Z
- updatedAt: 2026-06-02T13:39:28.419Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: MILESTONE_STATUS_SCHEMA duplicates canonical MILESTONES_SCHEMA in the web bundle (no browser-safe constants export)
- description: packages/ledger-web/src/App.tsx (T80) adds a hand-maintained MILESTONE_STATUS_SCHEMA const that must stay in sync with MILESTONES_SCHEMA (packages/ledger/src/constants.ts). The duplication exists because @cq/ledger exposes no browser-safe subpath export for its constants — only `.`, `./relationships`, `./columns`, and the `.` index pulls Node-builtin-laden store/parser code into the browser bundle. The copy can drift silently. Related to D3 (stale @cq/ledger exports map).
- severity: low
- suggestedFix: Add a browser-safe `@cq/ledger/constants` subpath export (constants.ts has no Node deps) and import MILESTONES_SCHEMA from it, removing the duplicate. Fold into D3's exports-map cleanup.
- ledgerRefs: ["tasks:T80","goals:G2","defects:D3"]
