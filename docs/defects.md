---
ledger: defects
counters:
  milestone: 0
  item: 2
archives: []
---

# defects

## M2

### D1 — resolved

- createdAt: 2026-06-01T19:45:51.333Z
- updatedAt: 2026-06-01T19:45:51.333Z
- author: "opus-4.8[1m]"
- session: b946b5c5-0dca-4058-a5bf-45caaea6111d
- headline: "Web UI crash on connect: r.counts is undefined when server omits counts"
- severity: major
- description: "After the enumerate_ledgers `counts` change, McpLedgerClient.enumerateLedgers() dereferenced r.counts[name] unconditionally. Against a ledger-mcp server build that predates the change (version skew — the externally-run --http server was not restarted), the response is {ledgers} with no counts, so r.counts is undefined and the map callback threw 'can't access property \"decisions\", r.counts is undefined', surfaced as 'connection failed'. Fix: default counts to {} at the boundary in both frontends' mcpClient. Regression test added (injected stub response without counts → itemCount 0)."

## M3

### D2 — resolved

- createdAt: 2026-06-01T20:42:11.985Z
- updatedAt: 2026-06-01T20:42:48.907Z
- author: "opus-4.8[1m]"
- session: 94b7733c-6379-4acb-a300-7d92f856f321
- headline: "implement-flow worktree dep bootstrap: a symlinked root node_modules is insufficient for a bun workspace"
- severity: minor
- description: "Surfaced by the T12 dogfood. The advance.md orchestrator (Codex manual-worktree path) and the implement-worker body both say 'ensure deps available (node_modules); run bun install if missing'. In the dogfood I shortcut this by symlinking the parent checkout's root node_modules into the fresh worktree. For a bun WORKSPACE that is not enough: per-package deps (bun-types, react, react-dom, @types/*) resolved via packages/*/node_modules are absent, so `tsc -b` aborts with TS2688 before reaching source, and a subsequent `bun install` reports 'no changes' (the symlinked node_modules looks present), masking the gap. A real `bun install` inside the worktree (no symlink) fixes it (854 pkgs from the global cache, ~4s, offline). NOTE: the implement-flow ASSETS are not at fault — a genuinely fresh `git worktree add` has no node_modules, so the worker's `bun install` runs correctly (verified: gate then went green, 379 pass). This is a hardening note, not a loop break."
- rootCause: bun workspaces hoist most deps to the root node_modules but keep per-package node_modules; a single root-level symlink does not reproduce the per-package layout, and an existing-but-incomplete node_modules makes `bun install` a no-op.
- suggestedFix: "In implement/advance.md (Codex manual-worktree path) state explicitly: do NOT symlink the parent node_modules; rely on the worker running a real `bun install` in the fresh worktree (cheap with a warm global cache, offline-capable). Optionally strengthen implement-worker.md step 1 to detect an INCOMPLETE node_modules (e.g. probe a known workspace dep) and force `bun install --force` rather than trusting presence alone. Minor companion note: workers writing to gitignored paths (e.g. debug/) must `git add -f` — observed during the dogfood."
- ledgerRefs: ["goals:G1","tasks:T12"]
- fix: "Hardened both assets: implement/advance.md (Codex worktree bullet) now says do NOT symlink the parent node_modules and to let the worker run a real bun install; implement-worker.md step 1 now says a fresh worktree has no node_modules, don't trust a pre-existing one blindly, and run `bun install --force` on a symlink or a TS2688 failure. Markdown-only; repo-root bun run check remains green (379 pass)."
