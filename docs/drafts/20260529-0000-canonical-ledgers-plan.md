# Plan — Canonical ledger schemas (canon cycle)

Driver: vsm-loop, serialise-fallback (no Task subagent tool). Phases run
inline but distinct; findings recorded in `./tasks.md` / `./defects.md`.

Authoritative design: `docs/drafts/20260528-2129-canonical-ledger-schemas.md`.
Baseline: 807 pass / 0 fail (captured pre-change). e2e target: 21/0/0.

## Milestone M-CANON

### PR-01 — `idPrefix` schema field + global prefix uniqueness (§8a, Q-CANL-8)
- `LedgerSchema.idPrefix?: string` (types.ts).
- `effectiveIdPrefix(name, schema)` helper: explicit `idPrefix` else first
  uppercase letter of name. Replaces `itemIdPrefix(ledger)` in core.ts.
- `ITEM_ID_RE` per-ledger: caller-supplied item ids must match
  `^<prefix>\d+$` (M-AMBIENT exception for milestones). New
  `CrossPrefixIdError`.
- `createLedger` refuses prefix collision against existing ledgers:
  `DuplicatePrefixError`.
- Registry parse/serialize round-trips `idPrefix`.
- validateSchema accepts/validates `idPrefix` shape (`^[A-Za-z]\d*` → just
  uppercase letters; keep `^[A-Z][A-Za-z]*$`? Design: "first uppercase
  letter" → single letter conventionally, but allow multi-char for safety).
  Decision: prefix must match `^[A-Za-z][A-Za-z0-9]*$` and not be empty.
- verify: new unit tests for prefix default/override/collision/mismatch.

### PR-02 — Bootstrap five canonical + goals ledgers (§8, B)
- constants.ts: DEFECTS/TASKS/HYPOTHESIS/QUESTIONS/DECISIONS/GOALS ledger
  names + `<X>_SCHEMA` each carrying canonical fields + idPrefix.
- `CANONICAL_LEDGERS: ReadonlyArray<{name, schema}>` (milestones first).
- Bootstrap on init() in BOTH FsLedgerStore + InMemoryLedgerStore: provision
  from canonical schema if absent; divergence-guard refuses start if on-disk
  schema diverges (same as milestones guard, generalised).
- verify: enumerate() lists all 7; bootstrap idempotent; divergence guard
  fires for each.

### PR-03 — M-AMBIENT bootstrap milestone (§8b)
- On init, create milestones item `M-AMBIENT` (title "ambient", open) if
  missing. Immortal: archive refused, terminal-move refused.
- `^M\d+$` exception for `M-AMBIENT` on caller-supplied milestone create.
- verify: bootstrapped; archive refused; terminal move refused; other
  ledgers can reference `## M-AMBIENT`.

### PR-04 — Milestones §8c rename + §8d `## active` group
- §8c: MILESTONES_SCHEMA `blocked`→`blockedBy`, `depends`→`dependsOn`.
  Update CreateMilestoneItemInit/UpdateMilestoneItemPatch, core.ts mappers,
  ledgerTools.ts + cq-mcp main.ts milestone tool args.
- §8d: MILESTONES_ACTIVE_GROUP_ID becomes the literal header `active` (no id
  form). Parser/serializer: milestones depth-2 header is literal `active`
  (no em-dash); exactly one group; reject legacy `## M0 — active` / `## M<id>
  — title`. Other ledgers unchanged (bare `## <id>`).
- Rewrite all milestones fixtures/tests + repo-root docs/milestones.md +
  docs/ledgers.yaml to new schema/format.
- verify: parser round-trip; reject legacy group; reject >1 group.

### PR-05 — Test fixtures + dual-suite extension + repo docs regen
- store-abstract.ts: stop seeding `defects`/`tasks` (now bootstrapped);
  rename collidng custom ledgers (`todos`→ unique prefix). Add per-canonical-
  ledger round-trip create/update/fetch/search/archive.
- Add §11 example fixtures parser round-trip per new ledger.
- Fix concurrency.test.ts + cq-mcp main.test.ts `todos` prefix collision.
- Regenerate repo-root docs/* via a one-shot init against repo root.
- verify: bun run check 0; e2e 21/0/0; nix build; cq-mcp smoke;
  enumerate against fresh cwd lists all 7.

## Cross-cutting decisions (locked)
- K-CANON-1: prefix uniqueness enforced at createLedger AND at bootstrap
  registration (two bootstrapped ledgers cannot share a prefix — they don't).
- K-CANON-2: M-AMBIENT is the single `^M\d+$` exception; encoded as a named
  constant `MILESTONES_AMBIENT_ID`.
- K-CANON-3: `## active` special-case keyed on `ledger.id===MILESTONES_LEDGER`
  only; MILESTONES_ACTIVE_GROUP_ID stays `"active"` (was `"M0"`).
