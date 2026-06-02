---
ledger: hypothesis
counters:
  milestone: 0
  item: 8
archives: []
---

# hypothesis

## M11

### H1 — wrong

- createdAt: 2026-06-02T08:37:34.271Z
- updatedAt: 2026-06-02T08:42:08.733Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: ledger-mcp server startup throws when the ledger registry (docs/ledgers.yaml) is absent — no default/auto-init
- description: "ROOT-CAUSE CANDIDATE. The MCP server entrypoint eagerly loads/validates the ledger registry (docs/ledgers.yaml) at startup; if the file is missing it throws and the process exits before completing the MCP handshake, so the client reports 'connection failed'. Would be TRUE if: the server main/serve path reads docs/ledgers.yaml (or CANONICAL_LEDGERS divergence-guards against it) and has no branch that initializes a default registry when absent."
- ledgerRefs: ["defects:D2"]
- evidence: ["[correct] packages/ledger/src/store/FsLedgerStore.ts:254-291 (orchestrator-verified) — init() mkdir's docs/+.locks/+archive/ recursively, catches ENOENT on reading docs/ledgers.yaml and WRITES serializeRegistry(EMPTY_REGISTRY) instead of throwing, then bootstraps every CANONICAL_LEDGERS entry when absent. The ONLY throw is BootstrapViolationError on schema DIVERGENCE of an existing ledger (L283-289), never on a missing file. Rules out 'missing registry throws at startup'.","[correct] packages/ledger-mcp/src/main.ts:337-344 — main() awaits store.init() before building/connecting any transport; since init auto-inits, startup succeeds on an empty cwd.","[correct] REPRODUCTION (orchestrator-run): `bun packages/ledger-mcp/src/main.ts --cwd <fresh empty tmpdir>` printed 'serving stdio MCP on cwd=...', exited 0, and created docs/{ledgers.yaml,milestones,tasks,defects,hypothesis,questions,reviews,decisions,goals}.md + archive/ + .locks/. Decisively rules out H1."]

### H2 — wrong

- createdAt: 2026-06-02T08:37:39.341Z
- updatedAt: 2026-06-02T08:42:11.895Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: FsLedgerStore construction/index build throws on a missing docs/ dir or absent ledger files instead of treating an uninitialized dir as empty
- description: "ROOT-CAUSE CANDIDATE. The store layer (FsLedgerStore) — during construction or initial index build — reads the docs/ directory and per-ledger markdown files; a missing dir/file raises ENOENT (or a parse/validation error) rather than degrading to empty state, propagating up and aborting server bring-up. Would be TRUE if: FsLedgerStore (or its index refresh) does fs reads without an exists-check/auto-create, and no auto-init creates the canonical files. Disjoint from H1 (store layer vs server-entrypoint/registry-load)."
- ledgerRefs: ["defects:D2"]
- evidence: ["[correct] packages/ledger/src/store/FsLedgerStore.ts:254-340 (orchestrator-verified) — init() auto-creates docs/.locks/archive via fs.mkdir({recursive:true}); per-ledger markdown reads swallow ENOENT (L298-303) and seed freshLedger(entry) instead of throwing. A missing docs/ dir or absent ledger files degrade to empty/fresh state, not an error.","[correct] REPRODUCTION (orchestrator-run): running the server against a fresh empty tmpdir created the full docs/ tree (all canonical ledger .md files + ledgers.yaml) and exited 0 — empirical proof the store layer does not throw on an uninitialized directory."]

### H3 — open

- createdAt: 2026-06-02T08:41:56.700Z
- updatedAt: 2026-06-02T08:41:56.700Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "The observed failure is ENVIRONMENTAL, not missing-init: a stale globally-registered (home-manager/Nix) ledger-mcp binary, --cwd, or .mcp.json wiring"
- description: "ROOT-CAUSE CANDIDATE (needs user's environment data to adjudicate). Source auto-init works (H1/H2 refuted by reproduction), so any real 'connection fails' must come from outside the source init path. Leading suspects: (a) VERSION SKEW — the ledger MCP is plugin-registered globally via home-manager/Nix; if that built binary predates the FsLedgerStore.init() auto-create code, it would fail against a fresh dir even though source works (cf. resolved defect D1, also a version-skew 'connection failed'). (b) --cwd resolution to a non-existent/unwritable path. (c) the target directory has no .mcp.json / no ledger server wired at all (then it's 'not configured', not a connection failure). (d) a non-ENOENT fs/permission error under init's mkdir. CANNOT adjudicate without the user's actual error text + how the server is launched — parked on Q37."
- parentHypothesis: ""
- ledgerRefs: ["defects:D2"]

### H4 — confirmed

- createdAt: 2026-06-02T11:26:20.034Z
- updatedAt: 2026-06-02T11:26:20.034Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "CONFIRMED: startup aborts via BootstrapViolationError on schema divergence (FsLedgerStore.ts:283-289), not missing init"
- description: "The specific confirmed mechanism under H3 (environmental). FsLedgerStore.init() bootstraps each CANONICAL_LEDGERS entry; for an EXISTING on-disk ledger whose schema differs from the canonical bootstrap schema it THROWS BootstrapViolationError (packages/ledger/src/store/FsLedgerStore.ts:283-289) — which main() lets crash the process before the MCP handshake, so the client reports connection failure. This is the divergence path H1's evidence identified as 'the only startup throw' (which we incorrectly set aside after the empty-dir repro). Divergence arises from version skew: a stale globally-built ledger-mcp binary vs an evolved on-disk docs/ledgers.yaml (or vice-versa)."
- parentHypothesis: H3
- evidence: ["[correct] USER-OBSERVED runtime error (decisive): `ledger-mcp: fatal: Bootstrap invariant violated: existing goals ledger has a different schema than its canonical bootstrap schema` — the exact BootstrapViolationError message, naming the goals ledger schema divergence.","[correct] packages/ledger/src/store/FsLedgerStore.ts:283-289 (orchestrator-verified earlier): `else if (!schemasEqual(entry.schema, canonical.schema)) { throw new BootstrapViolationError(...) }` — the only startup throw on a non-ENOENT tree; fires on an existing-but-divergent on-disk schema.","[correct] packages/ledger-mcp/src/main.ts:337-344: main() awaits store.init() before serving, so this throw aborts the connection."]
- ledgerRefs: ["defects:D2"]

## M14

### H5 — confirmed

- createdAt: 2026-06-02T17:19:33.207Z
- updatedAt: 2026-06-02T17:24:25.000Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D3 root cause: @cq/ledger exports/main point at ./dist/*.js but tsc emits ./dist/src/*.js"
- description: "packages/ledger/package.json declares main + exports['.'] = ./dist/index.js, exports['./relationships'] = ./dist/relationships.js, exports['./columns'] = ./dist/src/columns.js (mixed), but the tsc build (tsconfig include:[src,test], outDir ./dist, no rootDir override) emits everything under ./dist/src/. So ./dist/index.js etc. do NOT exist; only ./dist/src/index.js does. Masked in-repo because all consumers resolve @cq/ledger* via tsconfig paths→source. A clean (dist-less) checkout / published or nix consumer relying on the exports map would fail to resolve @cq/ledger and its subpaths."
- rationale: Filed by the T61 reviewer with the exact mismatch. Validate against CURRENT packages/ledger/package.json (exports/main targets) + the tsc output layout (tsconfig.json include/outDir/rootDir → does dist emit ./dist/*.js or ./dist/src/*.js?). Confirm at least one declared export target file does not exist post-build.
- ledgerRefs: ["defects:D3","goals:G2"]
- evidence: ["package.json:6-20 — main + exports['.']=./dist/index.js, ['./relationships']=./dist/relationships.js, but ['./columns']=./dist/src/columns.js (inconsistent)","On disk (validated): dist/index.js + dist/relationships.js MISSING; dist/src/index.js + dist/src/relationships.js + dist/src/columns.js EXIST","tsconfig.json: outDir ./dist, include [src,test], NO rootDir → tsc roots at packages/ledger/ → emits dist/src/*","ledger-web/tsconfig.json:11-16 paths map @cq/ledger* → ../ledger/src/*.ts (masks the mismatch in-repo)","No test asserts export-target existence"]

### H6 — confirmed

- createdAt: 2026-06-02T17:19:38.350Z
- updatedAt: 2026-06-02T17:24:32.689Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D4 root cause: columns.ts eligibleColumnFields offers `headline` (summary-source) as a redundant column"
- description: packages/ledger/src/columns.ts eligibleColumnFields excludes only LONG_FIELD_DENYLIST plus id/status/summary; `headline` (and likely `title`/`question`) is in neither set, so the column picker offers it as a toggleable extra column. Since summarize() picks headline first, selecting it renders the headline text BOTH as an extra column cell AND as the trailing summary — duplicated per row. Cosmetic.
- rationale: "Filed by the T62 reviewer. Validate against CURRENT packages/ledger/src/columns.ts: confirm eligibleColumnFields' allow/deny logic includes `headline` (and whether title/question) in the eligible set, and that summarize() uses headline as the summary source."
- ledgerRefs: ["defects:D4","goals:G2"]
- evidence: ["columns.ts:35-47 LONG_FIELD_DENYLIST excludes description/rationale/...; NOT headline/title/question","columns.ts:55-72 eligibleColumnFields = schema fields minus denylist minus {id,status,summary} → headline/title/question pass","constants.ts: headline is required field in defects/tasks/hypothesis/decisions; title in milestones/goals; question in questions","tui app.tsx:82-86 + web App.tsx:181-185 summarize() picks headline ?? title ?? question ?? summary first","tui app.tsx:1200-1210 ItemRowLabel renders each extra column cell AND {summary} → headline column duplicates summary; picker mounts eligibleColumnFields verbatim (app.tsx:1809)","No dedicated columns.test.ts exists"]

## M18

### H7 — confirmed

- createdAt: 2026-06-02T17:19:44.975Z
- updatedAt: 2026-06-02T17:24:35.908Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D5 root cause: ArchivePointer + archive group Milestone carry no `status`, so archived heads cannot badge it"
- description: "packages/ledger/src/types.ts: ArchivePointer is {id,path,summary} and the ArchiveContent 'group' variant carries a Milestone ({id,status?,title,description}?) — need to confirm which milestone shape the archive payload carries and whether it includes status. Only ResolvedMilestone has status. So the archived MilestoneSubsection head (web App.tsx) has no reachable status to render the #10 badge. NOTE: planned task T91 will add `title`+`status` to ArchivePointer (shared with D8) — confirm whether T91's planned extension fully covers D5's render need or whether a separate archived-head badge RENDER task is still required."
- rationale: Filed by the T80 reviewer. Validate against CURRENT packages/ledger/src/types.ts (ArchivePointer + Milestone vs ResolvedMilestone shapes) and packages/ledger-web/src/App.tsx ArchiveSubsections head render. Assess overlap with the planned T91 ArchivePointer extension.
- ledgerRefs: ["defects:D5","goals:G2"]
- evidence: ["types.ts:155-162 ArchivePointer = {id,path,summary} (no status)","types.ts:97-104 Milestone = {id,title,description,items} (no status); types.ts:116-121 ResolvedMilestone has status (only one)","store/LedgerStore.ts:42-44 ArchiveContent group variant carries Milestone (statusless); core.ts:497 builds pointer {id,path,summary}","web App.tsx:1853 ACTIVE head passes milestoneStatus={ms.status}; App.tsx:2002-2008 ARCHIVED head passes NO milestoneStatus; badge gated on milestoneStatus!==undefined (App.tsx:1659); comment App.tsx:1640 documents the gap","T91 (planned, M21) extends ArchivePointer with title+status → D5 reduces to a RENDER-only task; NEW: the @cq/shared/MCP fetch_ledger WIRE Zod mirror of archivePointers[] must ALSO carry status to survive the cross-process boundary"]

### H8 — confirmed

- createdAt: 2026-06-02T17:19:50.455Z
- updatedAt: 2026-06-02T17:24:41.901Z
- author: "opus-4.8[1m]"
- session: 0a4a7acf-25b6-4783-83a1-a45870023493
- headline: "D6 root cause: @cq/ledger has no browser-safe constants export, forcing web to duplicate MILESTONES_SCHEMA"
- description: "packages/ledger/package.json exposes only `.`, `./relationships`, `./columns` subpaths; the `.` index re-exports store/parser code that pulls Node builtins (fs/path) into a browser bundle, so the web client cannot import MILESTONES_SCHEMA from @cq/ledger without dragging Node deps in. Hence T80 hand-duplicated MILESTONE_STATUS_SCHEMA in App.tsx, which can drift. Same family as D3 (exports map). Fix folds into D3's exports cleanup: add a browser-safe `./constants` subpath export (constants.ts has no Node deps)."
- rationale: Filed by the T80 reviewer; explicitly related to D3. Validate against CURRENT packages/ledger/package.json exports + packages/ledger/src/index.ts (does the `.` barrel pull Node-builtin modules?) + constants.ts (confirm it has no Node imports, so a `./constants` export would be browser-safe). Confirm App.tsx's duplicated MILESTONE_STATUS_SCHEMA exists.
- ledgerRefs: ["defects:D6","goals:G2","defects:D3"]
- evidence: ["package.json:8-21 exports = only ., ./relationships, ./columns (grep confirms NO ./constants)","index.ts:50 barrel re-exports FsLedgerStore; FsLedgerStore.ts:29-30 imports node:fs + node:path → importing constants via '.' drags Node builtins into the browser bundle","constants.ts:25-27 only a type-only import (LedgerSchema); no Node builtins → a ./constants subpath would be browser-safe; exports MILESTONES_SCHEMA (L47)","web App.tsx:69-82 hand-duplicated MILESTONE_STATUS_SCHEMA with a comment that the schema is not importable from the @cq/ledger main index (Node builtins)","App.tsx already uses the leaf-subpath pattern: imports @cq/ledger/relationships (L25) + @cq/ledger/columns (L29); serve.ts:55-59 Bun.build target browser over source → fix = ./constants export + tsconfig paths entry, same as D3 family"]
