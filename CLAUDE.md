# ledger-suite — project instructions

Markdown-backed ledgers: an MCP server (`@cq/ledger-mcp`) plus a terminal
(`@cq/ledger-tui`) and web (`@cq/ledger-web`) client, over the `@cq/ledger`
library. Bun + TypeScript workspace; products are packaged with Nix.

The Bun workspace lives under `nix/pkg/cq-ledgers/` (run the `bun` commands
below from there); the contributed LLM assets live under `nix/pkg/cq-assets/`.
The repo root holds only the flake plus the migrated coding-agent harness
under `nix/` (see `nix/hm/dev-llm.nix`, `nix/pkg/{yolo,codex,claude-code,…}`).

## Build / test / check

- `bun test` — full suite (run from `nix/pkg/cq-ledgers/`).
- `bun run typecheck` (`tsc -b`) and `bun run lint` (`eslint .`).
- `bun run check` — all three. Run it before declaring work done.
- Nix products (from the repo root): `nix build .#cq`.
- After changing dependencies / `bun.lock`: refresh the FOD hash in
  `flake.nix` — set `outputHash` to 52 `A`s, `nix build .#node-modules`, paste
  the `got:` hash back.

## Conventions (this repo)

- Surgical changes; match surrounding style; no unrelated refactors.
- Reproduce a defect (failing test or documented repro) before fixing it.
- Frontends are pure MCP clients — they never read the ledger files directly.
  This holds in *embedded* mode too (TUI/web with no `--mcp-url`): the frontend
  co-locates the MCP server in its own process (in-memory transport for the TUI,
  co-hosted `/mcp` + `/ws` for the web) and still talks to it over MCP — it does
  not read `docs/` directly.
- `--cwd` for `cq mcp` must be absolute (or relative, resolved vs CWD);
  it defaults to the process CWD.
- Tests: `ink-testing-library` for the TUI, happy-dom for the web; controlled
  *text* inputs don't fire onChange under happy-dom, so use uncontrolled
  inputs (refs) — selects are fine controlled.

## Track work in the ledger (dogfooding)

This repo is wired (`.mcp.json`) to its own ledger via the `ledger` MCP server.
Use it — the `mcp__ledger__*` tools — as the source of truth for multi-step
work, instead of inline TODOs or scratch files.

- **Before starting**: `fts_search` (or `fetch_ledger`) for the topic; if an
  item already exists, work against it — don't duplicate.
- **Starting multi-step work**: `create_milestone`, then `create_item` under it
  in the right ledger:
  - `tasks` — units of work (status: planned → wip → done)
  - `defects` — bugs (severity required; open → wip → resolved)
  - `hypothesis` — things to confirm; `decisions` — locked choices;
    `questions` — open questions for the user.
- **While working**: keep `update_item` status current; record a non-obvious
  choice as a `decisions` item and a bug as a `defects` item.
- **Dependencies**: express milestone ordering via `dependsOn` / `blockedBy`
  (advisory); same fields exist on items for cross-references.
- **On completion**: set items terminal, then `archive_milestone` once every
  item under the milestone is terminal.
- **Detail goes in fields** (markdown is supported), not the headline. Don't
  hand-edit `docs/*.md` — go through the tools so counters/schema stay valid.
- **Provenance**: on every `create_item` / `update_item`, pass `author` (your
  model class, e.g. `opus-4.8[1m]`) and `session` (`$CLAUDE_CODE_SESSION_ID`)
  so the ledger records who wrote each item.
- Don't `create_ledger` unless asked; the canonical set is enough.

> The server also advertises baseline usage `instructions` on connect — this
> section is the repo-specific policy on top of that.
