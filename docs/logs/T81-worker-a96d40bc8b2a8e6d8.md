# implement-worker — T81 (M18) TUI milestone-header statusColor — PASS (stale base)

Agent a96d40bc8b2a8e6d8. resultCommit 0e49ce2, branch implement/T81. Worker check 534/0 but worktree base STALE (cut at d23954f; rebase aborted after a `git stash`-in-main mishap — main verified intact, no stash left). Re-validated via integration check on cherry-pick to main.

Extended ListEntry header variant with optional `node?: React.ReactNode` (preserves `label` string for T85 memo-key stability). buildItemEntries now accepts MILESTONES_SCHEMA and builds a colored React element per milestone subsection header (statusColor for the status token). ScrollList renders node when present, label otherwise. 4 ink tests: cyan 'open' vs green 'done' via forced chalk ANSI, item rows unchanged. Files: app.tsx, test/app.test.tsx.
