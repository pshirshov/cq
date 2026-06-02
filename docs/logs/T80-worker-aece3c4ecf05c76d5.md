# implement-worker — T80 (M18) web milestone-status badge — PASS

Agent aece3c4ecf05c76d5. resultCommit 5c52cb86abbe12be7dcb5bfa1fafb808dfafe4aa, branch implement/T80 (rebased onto d6e9d52). check 575 pass / 0 fail.

Added `milestoneStatus` optional prop to MilestoneSubsection rendering `<span class='lw-status lw-status-<bucket>'>` via statusBucket; removed bare `[<status>]` text from ItemTable headerLabel. Local MILESTONE_STATUS_SCHEMA const (avoids importing @cq/ledger main index into browser bundle). 2 happy-dom tests: badge presence + correct bucket class (start for open, done for done), absence of bare [status]. NOTE: archived sections can't show status badge — ArchiveContent's Milestone type carries no `status` (only ResolvedMilestone does); badge applies to ACTIVE heads only. Files: App.tsx, test/app.test.tsx.
