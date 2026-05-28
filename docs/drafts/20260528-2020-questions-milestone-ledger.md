# Clarifications: unify milestones across ledgers via a dedicated `milestones` ledger

**Context:** Today each ledger embeds its own `Milestone` (id, title,
description, items[]) inside its markdown file. The new design: a
single `milestones` ledger is the source of truth for milestone
metadata; other ledgers group items per-milestone but the milestone
header is **just the ID** — references rather than copies. Several
design decisions need settling before the refactor is dispatched.

**How to answer:** Write your response on the `Answer:` line under each
question. Reference questions by their ID in chat if convenient.

---

## Q1: Is the `milestones` ledger special (bootstrapped) or just one of many?

**Suggestions:**

- **Bootstrapped** (recommended) — Created automatically on `FsLedgerStore.init()` if `docs/milestones.md` doesn't exist, with a fixed canonical schema. Cannot be deleted/archived as a whole; cannot be re-created with a different schema via `create_ledger`. Hardcoded `MILESTONES_LEDGER = "milestones"` constant.
- **Regular** — Just another ledger. User/agent must `create_ledger('milestones', {...})` before any other ledger can reference milestones. Surprising; one extra step everywhere.
- **Configurable** — A `--milestones-ledger=<name>` server flag picks the name. Adds a knob nobody will tune.

Answer: special, as recommended

---

## Q2: Schema of the `milestones` ledger?

**Context:** Today, a `Milestone` carries `{id, title, description}` and lives next to its items in the same file. In the new design, a milestone becomes an `Item` in the `milestones` ledger. We need a schema.

**Suggestions:**

- **Minimal** (recommended): `statusValues = ['open', 'done']`, `terminalStatuses = ['done']`, `fields = { title: string-required, description: string-optional }`. Existing Item shape works as-is. Item id is the milestone id.
- **Richer**: also `owner: string`, `dueAt: timestamp`, `priority: enum`. More expressive but speculative.
- **Status omitted**: just title + description. But then archiving has no signal. Drop.

Answer: `statusValues = ['open', 'done', 'postponed', 'blocked']`, `terminalStatuses = ['done']` `fields = { title: string-required, description: string-optional, blocked: list-of-item/milestone references, depends: list-of-item/milestone references }`

---

## Q3: How are milestones rendered in **other** ledgers' markdown files?

**Context:** Today: `## M3 — third milestone — with em-dash in title`. New design says only the ID.

**Suggestions:**

- **Header is the ID alone**: `## M3`. The parser knows to look up the title via the milestones ledger if needed for display. Cleanest.
- **Header carries a non-authoritative title hint**: `## M3 — third milestone (cached)`. The cache is rebuilt from the milestones ledger on every serialization. Human-friendly when viewing the file directly, but harder to keep in sync.
- **Header is `## M3` plus a one-line link**: `## M3` then a paragraph `> see [[milestones#M3]]`. Verbose.

Answer: ID alone

---

## Q4: Tool surface changes — what disappears, what stays, what's new?

**Context:** Today the MCP tools include `create_milestone(ledger, ...)`, `update_milestone(ledger, milestoneId, patch)`, `fetch_milestone(ledger, milestoneId)`, `archive_milestone(ledger, milestoneId, ...)`. After the refactor, milestones live in one ledger.

**Suggestions:**

- **Remove the per-ledger milestone tools entirely** (recommended). Replace with:
  - `create_milestone(title, description?)` — adds an `Item` to the `milestones` ledger, returns the new milestone id.
  - `update_milestone(milestoneId, patch)` — updates fields of that item.
  - `fetch_milestone(milestoneId)` — returns the milestone with its references summarised (e.g. counts per ledger).
  - `archive_milestone(milestoneId, summary)` — see Q6.
  - `create_item(ledger, milestoneId, fields)` — unchanged shape, but `milestoneId` MUST resolve in the `milestones` ledger (Q5).
  - `list_milestone_items(milestoneId)` — convenience: items grouped per-ledger that reference this milestone.
- **Keep both forms** — per-ledger AND global. Confusing; two truths.
- **Keep the per-ledger tools as thin facades** — they validate that the milestone exists globally, then operate on the local grouping. Surface inflation.

Answer: as recommended

---

## Q5: Existence enforcement when an item references a milestone?

**Suggestions:**

- **Strict**: `create_item(ledger, milestoneId, ...)` throws `MilestoneNotFoundError` if `milestoneId` isn't an active item in the `milestones` ledger (recommended).
- **Permissive**: dangling references are allowed; warn-only. (Worse — silently broken state.)
- **Auto-create**: a missing milestone is created on demand with an empty title. (Hides bugs.)

Answer: recommended

---

## Q6: Archive semantics for a milestone — what happens to referencing items in other ledgers?

**Context:** Today, `archive_milestone(ledger, milestoneId, summary)` moves THE milestone + ITS items to an archive file, refusing if any item is non-terminal. After the refactor, a milestone has items in potentially MANY ledgers. What does archiving mean?

**Suggestions:**

- **Two-level archive** (recommended): `archive_milestone(milestoneId, summary)` (1) refuses if ANY referencing item across ANY ledger is non-terminal, then (2) for each referencing ledger, moves the milestone's item group into that ledger's `archive/<ledger>/<milestoneId>.md` file (mirroring today's per-ledger archive layout), and (3) moves the milestone itself in the `milestones` ledger to its archive. Symmetrical, atomic across ledgers.
- **Per-ledger archive only**: `archive_milestone(ledger, milestoneId, summary)` (rename to e.g. `archive_milestone_group`) archives the milestone's items in ONE ledger and leaves the milestone (and other ledgers' references) alone. The milestones ledger's own archive happens separately. More steps; clearer.
- **Lazy / GC**: the milestone moves to terminal status; referencing items stay where they are; nothing physically moves until you call a separate `gc_archive()`. Complex.

Answer: as recommended

---

## Q7: Migration of existing `docs/<ledger>.md` files on disk?

**Context:** Existing files (and any user-curated ledgers in projects already using cq) have `## M3 — title` and per-ledger milestones. The new design requires migration.

**Suggestions:**

- **Auto-migrate on first `init()` after upgrade** (recommended): on startup, for each ledger, if any milestone header carries an em-dash + title (legacy format), (1) extract `{id, title, description}`, (2) upsert into the `milestones` ledger (preserve ids; if the same id exists in two ledgers with conflicting titles, prefer the first read alphabetically and log a warning with the rejected variants), (3) rewrite the source ledger's headers to ID-only. Logged with a clear marker; idempotent on second run.
- **Manual migration tool** (`bun run packages/ledger/scripts/migrate-milestones.ts`) — explicit; safer if state is precious; one more thing for the user to run.
- **Fail fast**: on encountering a legacy header, throw `SchemaValidationError("legacy milestone format — run migration tool")`. Safest; most annoying.

Answer: ignore backward compat, this was not deployed yet

---

## Q8: Cross-ledger lock ordering for atomic operations?

**Context:** Operations like `archive_milestone(milestoneId)` touch the milestones ledger + every referencing ledger atomically. Today, per-ledger mutexes + lockfiles serialise within a ledger but not across ledgers — concurrent operations on different ledgers run in parallel by design.

**Suggestions:**

- **Total order by ledger name (alphabetical)** (recommended): any operation that needs ≥2 ledgers acquires their locks in alphabetical order. `milestones` sorts first (literally) so it's always acquired first when present. Prevents deadlock.
- **A dedicated cross-ledger "registry lock"**: every multi-ledger op acquires the existing `__registry__` lock first, then per-ledger locks. Simpler reasoning, more contention.
- **Optimistic concurrency**: read versions, prepare changes in memory, commit under per-ledger locks, retry on conflict. Overkill for this size.

Answer: global lock for milestone operations

---

## Q9: Active-items view through the milestone lens?

**Suggestions:**

- **`fetch_ledger(name)` returns items grouped by milestone id**; each group also includes the milestone's title/description (resolved from the `milestones` ledger at read time). Saves the agent a second tool call. (recommended)
- **`fetch_ledger(name)` returns items grouped by milestone id only**; agent calls `fetch_milestone(id)` separately if it needs the title. Minimal coupling.

Answer: recommended

---

## Q10: Scope of the cycle — atomic refactor or staged?

**Suggestions:**

- **Atomic refactor on the existing worktree** (recommended): one `/vsm-loop` cycle that ships the schema change + migration + tool-surface change + full test rebaseline. Rest of the codebase already uses very few ledgers (only `tasks.md` and `defects.md` in the working tree, neither of which is a `@cq/ledger` markdown file in the new sense — they're hand-written), so the blast radius is contained.
- **Staged**: (1) introduce the `milestones` ledger but keep the embedded form working as fallback; (2) migrate consumers; (3) remove the embedded form. Three cycles, three discharge gates.

Answer: recommended

---
