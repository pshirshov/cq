# implement-flow round 1 — T79 + T81 (both disapprove→approve)

## T79 (M18 web archived-milestone unify)
- Round 0: worker ae4cab1dff29fb0c4 → 48318e4. Reviewer a2fe6cb1f8353d368 DISAPPROVED (1 criticism): lazy archive-fetch had no `.catch` → swallowed rejection, stuck `loading…`.
- Round 1: worker a49ff4406b7f08371 → d8f6f8c (harness placed it in a fresh worktree; reset onto 48318e4 + fix on top). Threaded onError→setFlash via errMsg; `.catch` marks pointer failed (retryable archive-error placeholder), re-expand retries; rejection test (FakeClient.failArchiveFetch) verified to fail on pre-fix code. check 569 green.
- Round 1 reviewer adba55197d150f185 APPROVE 0/0 (R-T79): criticism reproduced-as-fixed, all acceptance clauses asserted, 569/0, no orphans.

## T81 (M18 TUI milestone-header statusColor)
- Round 0: worker a96d40bc8b2a8e6d8 → 0e49ce2 (STALE base d23954f; rebase aborted after git-stash-in-main mishap — main verified intact). Reviewer a57c279a9ee77879d DISAPPROVED (1 criticism, TEST-ONLY): 4 tests asserted whole-frame ANSI; cyan/green leaked from selected-row + item badges, so reverting source left tests green. Production code correct.
- Round 1: worker a8fcbad8bf05389f8 → d7aeb5e. Exported buildItemEntries/Row/ListEntry; replaced 4 frame-assertions with unit tests walking the header `node` element tree asserting the `color` prop. Reproduction verified: 3/4 fail when source coloring removed.
- Round 1 reviewer a384115d4eaba48e3 APPROVE 0/0 (R-T81): reproduction confirmed, statusColor(status,MILESTONES_SCHEMA) open→cyan/done→green, label preserved (T85 memo stable), exports test-only.

Merge: cherry-pick ranges b17c49a..d8f6f8c (T79) + d23954f..d7aeb5e (T81) onto main.
