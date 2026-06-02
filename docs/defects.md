---
ledger: defects
counters:
  milestone: 0
  item: 11
archives:
  - id: M2
    path: ./archive/defects/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
  - id: M14
    path: ./archive/defects/M14.md
    summary: G2-W3 column selector + batch-answer + project title — COMPLETE. T60-T68 (eligibleColumnFields/defaultColumns, web+TUI column selectors, web batch-answer modal + TUI overlay, displayName + web/TUI titles). Out-of-scope defects D3 (exports map) + D4 (column eligibility) RESOLVED via G5; Q52 withdrawn (K13). Reviews R54/R57-R61. Shipped on main.
  - id: M18
    path: ./archive/defects/M18.md
    summary: "G2 follow-up #9-13 — COMPLETE. T79 archived-subsection unification, T80/T81 milestone-status badge (web)/color (TUI), T82 colgroup column proportions, T83/T84 goals flat-list, T85 TUI nav-perf memoization. Out-of-scope D5 (archived-head badge) + D6 (browser-safe constants) RESOLVED via G5; Q53 withdrawn (K13). Reviews R62-R68. Shipped on main."
---

# defects

## M11

### D2 — resolved

- createdAt: 2026-06-02T08:37:01.114Z
- updatedAt: 2026-06-02T19:13:37.020Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: ledger-mcp fails to connect in a directory with no initialized ledger (should auto-init)
- severity: major
- description: "MCP connection fails when an agent (Claude Code / Codex) starts in a directory that has NO initialized ledger — i.e. no docs/ ledger state / no docs/ledgers.yaml present. The `@cq/ledger-mcp` server fails to connect/serve instead of degrading gracefully, so the session has no ledger tools. Desired behavior: instead of failing, automatically initialize the canonical ledger set (init the ledgers) on startup so the MCP connection succeeds in a fresh directory. Investigate the root cause — where/why the server errors on missing ledger state, what \"initialized\" means (which files/dirs are required), whether `--cwd` resolution or a missing docs/ledgers.yaml is the trigger, and where an auto-init hook should live (server startup vs store construction) — then seed fix tasks. Severity: major (blocks using the tool in any uninitialized repo; workaround = manually init the ledger files)."
- rootCause: "ledger-mcp aborts at startup with BootstrapViolationError ('existing <ledger> ledger has a different schema than its canonical bootstrap schema') thrown by FsLedgerStore.init() (packages/ledger/src/store/FsLedgerStore.ts:283-289) when an EXISTING on-disk ledger's schema diverges from its CANONICAL_LEDGERS bootstrap schema. main() (packages/ledger-mcp/src/main.ts:337-344) awaits store.init() BEFORE serving, so the throw crashes the process before the MCP handshake → client sees 'connection failed'. NOT a missing-init problem (the empty-dir auto-init path works). The divergence is a version-skew artifact (stale built/global binary vs evolved docs/ledgers.yaml, or vice-versa). Confirmed by the user's verbatim runtime error (hypothesis H4, parent H3)."
- suggestedFix: "Replace the fatal throw with a graceful BACKUP-AND-REINIT: when FsLedgerStore.init() detects a schema divergence for an existing ledger (the schemasEqual==false branch), instead of throwing BootstrapViolationError, (a) move/copy the divergent on-disk ledger file(s) (and docs/ledgers.yaml) into a timestamped backup location (e.g. docs/.backup/<ISO-timestamp>/), then (b) write fresh canonical ledger(s) + registry from CANONICAL_LEDGERS and continue startup. Surface a loud WARNING (stderr) naming the backup path so no data is silently lost. Consider a guard/opt-out flag if a non-destructive abort is ever wanted, but default to backup-and-reinit per the user. Add tests: a seeded divergent on-disk schema → init() backs up + reinitializes + serves (no throw); backup dir contains the prior files."
- dependsOn: ["T94","T95","T96","T97"]
- fix: "Backup-and-reinit on schema divergence (replaces the fatal BootstrapViolationError): T94 (0d66e33) backupAndReinit helper (timestamped docs/.backup/, ENOENT-tolerant copy of prior files, fresh canonical + stderr WARNING); T95 (a26104b) rewired FsLedgerStore.init() !schemasEqual branch to backup-and-reinit BY DEFAULT (collects the divergent set, mutates this.registry in place to canonical) + onSchemaDivergence:'abort' opt-out preserving the throw; T96 (844d240) tests (divergence→backup+reinit / abort / no-divergence / empty-dir) + migrated the 6 divergence-guard cases to the abort opt-out; T97 repo-gate green. ledger-mcp no longer crashes the MCP handshake on a stale/divergent on-disk schema — it backs up + reinitializes and serves. NOTE: a stale already-running GLOBAL binary still needs a rebuild (out of scope, captured in G4). Integration check 659 green."

## M21

### D7 — resolved

- createdAt: 2026-06-02T16:17:17.745Z
- updatedAt: 2026-06-02T18:25:35.516Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "MILESTONES ledger renders archived milestones twice: once as their own row, again as an archived per-milestone subsection (ArchiveSubsections not scoped to exclude the milestones ledger)"
- severity: medium
- description: "G2 follow-up #4 item 16. In packages/ledger-web/src/App.tsx the ArchiveSubsections component (defined ~L1924) is rendered unconditionally whenever `showArchive && view.archivePointers.length > 0 && client !== null && ledger !== null` (App.tsx ~L1193-1205) — it does NOT consult `isMilestones`. The T79 unification (render each archived milestone-group through the SAME collapsible MilestoneSubsection renderer as active groups) is CORRECT for NON-milestones ledgers, where tasks/defects/etc. are grouped by their coordination milestone. But for the MILESTONES ledger itself, each milestone is already its OWN row in the flat table (ItemTable isMilestones branch, App.tsx ~L1757-1763); rendering it again as an archived 'section' duplicates it (shown twice). EXPECTED: for the milestones ledger, do NOT render archived subsections at all (the milestone row is sufficient)."
- rootCause: ArchiveSubsections render site (App.tsx ~L1193) is gated only on showArchive + archivePointers presence, not on the ledger kind; the milestones ledger's own rows already represent each (archived) milestone.
- suggestedFix: Gate the ArchiveSubsections render on `!isMilestones` (the flag is already in scope at App.tsx ~L1232/L1246/L1258). Add a happy-dom assertion that the milestones ledger view, with showArchive on, renders NO archive-section subsections (data-testid `archive-section` absent / no `ms-section-*` duplicate for an already-listed milestone row), while a non-milestones ledger still renders them.
- ledgerRefs: ["goals:G2"]
- dependsOn: ["T90"]
- fix: "T90 (208b446): gated the ArchiveSubsections render on `!isMilestones` so the MILESTONES ledger no longer duplicates an archived milestone as both a flat row and an archived subsection. happy-dom repro + non-milestones regression guard; integration check 634 green."

### D8 — resolved

- createdAt: 2026-06-02T16:17:29.755Z
- updatedAt: 2026-06-02T18:49:22.608Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: Archived milestone subsection TITLES render the milestone `description` instead of its `title`
- severity: medium
- description: "G2 follow-up #4 item 17. In packages/ledger-web/src/App.tsx the ArchiveSubsections component builds each archived section's header from the archive pointer: `const headerLabel = p.summary.length > 0 ? `${p.id}: ${p.summary}` : p.id;` (App.tsx ~L2000), where `p` is an archive pointer ({id, path, summary}). The pointer `summary` carries the milestone `description` (a long field), not its `title`, so archived section heads show the long description rather than the short title — unlike active milestone sections, which show the title (active headerLabel built from the resolved milestone, App.tsx ~L1850-1852 / ms.title). EXPECTED: archived section heads show the milestone `title` (matching active sections). The implementer must thread the milestone `title` to the archived head: either add `title` to the ArchivePointer shape over MCP (packages/ledger/src/types.ts + the server's archivePointer build) and use it, or read it from the lazily-fetched ArchiveContent group payload (which carries the Milestone) and replace the header once content loads. NOTE: with item 16 (D7) fixed, this no longer affects the MILESTONES ledger (no archived subsections there), but it STILL affects non-milestones ledgers whose archived coordination-milestone groups render via ArchiveSubsections."
- rootCause: ArchivePointer.summary is sourced from the milestone description; ArchiveSubsections uses it verbatim as the header label, whereas active sections use the milestone title.
- suggestedFix: Thread the milestone `title` to the archived MilestoneSubsection head and render it (parity with active sections). Prefer adding `title` to the ArchivePointer payload at the MCP/server boundary so the head shows the title on first paint without waiting for lazy content. Add a happy-dom assertion that an archived section head shows the milestone title, not its description.
- ledgerRefs: ["goals:G2"]
- dependsOn: ["T91"]
- fix: "T91 (98e50c6): extended ArchivePointer with `title` (and `status`), populated at archive time in both stores; switched the archived section head label from p.summary (description) to p.title. happy-dom test asserts a COLLAPSED archived head shows the milestone title (repro-verified). Integration check 635 green."

### D9 — open

- createdAt: 2026-06-02T18:25:44.398Z
- updatedAt: 2026-06-02T19:52:48.598Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: Flaky ledger-tui HTTP-client tests under full-suite concurrency (ConnectionRefused / 'Unable to connect')
- severity: low
- description: "Surfaced (out-of-scope) during T90 review. Under one `bun run check` invocation, ~3-4 tests in packages/ledger-tui/test/{mcpClient,displayName}.test.ts failed with 'Unable to connect. Is the computer able to access the url?' (McpLedgerClient over HTTP — update status / surface validation errors; displayName HTTP — serverInfo.title). They PASS on isolated re-run (6/0) and in the full suite on re-run, indicating a connection-setup / port-binding race under concurrent test execution — NOT a product defect, a test-harness flakiness. Independent of any G2/G4/G5 task diff."
- suggestedFix: "In the HTTP McpLedgerClient test harness, allocate an ephemeral port and WAIT for the server to confirm listening (readiness probe) before the client connects, so concurrent test execution cannot race the bind. Or serialize those HTTP tests. Triage via /investigate:start D9 when chosen."
- ledgerRefs: ["tasks:T90","goals:G2"]
- dependsOn: ["T105"]

### D10 — open

- createdAt: 2026-06-02T18:49:30.407Z
- updatedAt: 2026-06-02T19:52:50.122Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: InMemoryLedgerStore.performArchive lacked a pre-mutation terminal guard (partial-mutation divergence from FsLedgerStore)
- severity: low
- description: Surfaced (out-of-scope) during T91 review. Before T91, InMemoryLedgerStore.performArchive relied solely on Phase 3's applyDetachMilestoneItem to reject a non-terminal milestone-item; because Phase 2 (detach+archive of every non-milestones group) runs first, a non-terminal milestone-item left Phase-2 in-memory state mutated before the Phase-3 throw — a partial archive, diverging from FsLedgerStore's pre-existing Phase 1b gate. T91 added the Phase 1b terminal-guard to InMemoryLedgerStore (correct + harmless, restores dual-store parity) as a side effect of needing the milestone-item lookup for title/status. The latent inconsistency it remediates was pre-existing/out-of-scope; it warrants its own tracking item plus a dual-store abstract assertion that post-rejection state is unchanged in BOTH adapters (the current non-terminal test asserts only the throw, not the absence of partial mutation).
- suggestedFix: "Add an abstract store-suite assertion that after a non-terminal archiveMilestone rejection, the non-milestones ledger groups remain attached (no partial archive) in BOTH FsLedgerStore and InMemoryLedgerStore. The Phase 1b guard T91 added already prevents the InMemory partial mutation; this is a test-hardening + tracking item. Triage via /investigate:start D10 when chosen."
- ledgerRefs: ["tasks:T91","goals:G2"]
- dependsOn: ["T106"]

## M27

### D11 — open

- createdAt: 2026-06-02T19:51:24.026Z
- updatedAt: 2026-06-02T19:52:51.146Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "Web: ledger filter/toolbar bar scrolls away with items — should stay pinned (sticky) at the top during scroll"
- severity: low
- description: "User-reported (G2 area). In the web client the filter/toolbar row (.lw-toolbar, styles.css:305 — the status filter + milestone filter + column-selector menu) lives INSIDE the scrolling content container .lw-main (styles.css:274, `overflow: auto`). So scrolling the items list scrolls the toolbar out of view. EXPECTED: the filter bar stays pinned at the top of the items pane while the items scroll beneath it."
- rootCause: "GROUNDED: .lw-main (styles.css:274-280) is the scroll container (overflow:auto, padding 8px 12px); .lw-toolbar (styles.css:305-310) is a normal-flow flex row inside it with no sticky/fixed positioning, so it scrolls with the content."
- suggestedFix: "Make .lw-toolbar `position: sticky; top: 0;` with an opaque background (var(--bg)/--panel) and a z-index BELOW the column-selector popup (which is z-index:10, styles.css:316-320) so the popup still layers above it. Because .lw-main has padding-top:8px, offset the sticky top (e.g. top:0 with a small negative margin / matching padding, or move the padding) so items don't peek above the bar; ensure the bar's background spans the .lw-main horizontal padding (e.g. negative side margins + matching padding) so scrolled content doesn't show in the gutters. Add a happy-dom assertion that the .lw-toolbar rule carries position:sticky (computed scroll behavior isn't observable under happy-dom; assert the rule). TUI is unaffected (no scroll-detached toolbar)."
- ledgerRefs: ["goals:G2"]
- dependsOn: ["T107"]
