# RECOVERY NOTE — redeploy caused a schema-divergence backup-reinit

## What happened
`/cq:advance redeployed` (user redeployed the new @cq/ledger + @cq/config build and
restarted the ledger-mcp). On startup the NEW build's widened HANDOFFS_SCHEMA
(G30's `user-action-required` 5th status) diverged from the OLD on-disk
`docs/ledgers.yaml` schema, so FsLedgerStore.init() fired the D2/G4
**backup-and-reinit**: it moved the prior ledger state to
`docs/.backup/2026-06-08T14-26-35.715Z/` and wrote fresh-canonical (empty)
`docs/*.md` + a new-schema `docs/ledgers.yaml`.

This is EXACTLY the hazard that HO27/Q143 step 3 (T246 — the deploy-coupled live
`ledgers.yaml` migration) was meant to prevent: the live schema must be migrated
to the new canonical BEFORE the new build restarts. It could not be applied
autonomously (deploy-coupled), and was not applied before the restart.

## Data is safe (two copies)
- git HEAD `5a2845b` (the prior run's final ledger commit) — full records.
- `docs/.backup/2026-06-08T14-26-35.715Z/` — the pre-reinit snapshot.

## Recovery performed (on disk)
- `git restore --source=HEAD --worktree -- docs/` — restored all `docs/*.md`
  record files (goals 26, defects 21, tasks 62, handoffs incl. HO18-HO27,
  questions 21, reviews 85, milestones 93; counters intact, e.g. goals item:33).
- `docs/ledgers.yaml` (gitignored runtime registry) already carries the NEW
  canonical schema (the reinit wrote it; handoffs.statusValues now includes
  `user-action-required`). So on-disk = full records + matching schema =
  CONSISTENT; a fresh MCP load will NOT re-diverge.

## BLOCKING USER ACTION (the agent cannot do this)
The RUNNING ledger-mcp still serves its stale in-memory reinit state (empty,
counters reset to 0) and exposes no reload mechanism. Writing ANY item via it now
would flush that empty state over the restored `docs/*.md` (data loss). Therefore:

1. **RESTART the ledger-mcp** so it reloads the recovered on-disk ledger. Because
   `docs/ledgers.yaml` already matches the new canonical schema, the restart loads
   the full records cleanly — NO second reinit.
2. Do NOT let anything write to the ledger via the stale MCP before the restart.
3. Then re-run `/cq:advance` to continue (re-derive predicates from the recovered
   state; finish the remaining live-config `cq.toml` qualification + close goals).

No run-level handoff was written this turn: the MCP is in a corrupted reinit state
and any ledger write would clobber the recovery. This note is the durable trace.
