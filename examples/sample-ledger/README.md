# sample-ledger

A synthetic dataset for trying the ledger UIs. Its `docs/` tree is committed,
so you can point a server at it directly. Regenerate it any time with:

```sh
bun run examples/seed-sample-ledger.ts
```

It contains a small project with a milestone dependency DAG
(`M1 → M2 → M3 → M4`, plus `M2 → M4`) and items across every canonical
ledger:

| ledger | items |
|---|---|
| milestones | 5 (M-AMBIENT + M1–M4; M4 is `blocked`) |
| tasks | 9 (done / wip / planned / blocked) |
| defects | 3 |
| hypothesis | 2 |
| questions | 2 |
| decisions | 3 |
| goals | 1 |

## Try the UIs against it

`--cwd` must be **absolute** — run these from the repo root so `$PWD` resolves.

### With Bun (from source)

```sh
# 1. Ledger MCP server over HTTP, pointed at the sample data:
bun run packages/ledger-mcp/src/main.ts --cwd "$PWD/examples/sample-ledger" --http 7777

# 2a. Terminal UI (new shell):
bun run packages/ledger-tui/src/main.tsx --url http://127.0.0.1:7777/mcp

# 2b. Browser UI (new shell), then open the printed http://127.0.0.1:5180/ :
bun run packages/ledger-web/src/serve.ts --port 5180 --mcp-url http://127.0.0.1:7777/mcp
```

### With Nix

```sh
nix run .#ledger-mcp -- --cwd "$PWD/examples/sample-ledger" --http 7777
nix run .#ledger-tui -- --url http://127.0.0.1:7777/mcp
nix run .#ledger-web -- --port 5180 --mcp-url http://127.0.0.1:7777/mcp
```

In the **TUI**: `↑↓`/`jk` move, `Enter` opens, `/` searches, `n` creates,
`s` sets status, `Esc` goes back, `q` quits.

In the **web** console: click a ledger in the sidebar, click an item for the
detail/edit panel, use the search box, and click **graph** (top right) for the
milestone DAG — click a node to open that milestone.

> Edits write back through the server to the Markdown files under
> `examples/sample-ledger/docs/` — re-run the seed script to reset.
