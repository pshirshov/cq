# implement-worker — T87 (M19) TUI number-keys pick-suggestion — PASS

Agent a56b7bde6ed60b41a. resultCommit c326c5c, branch implement/T87 (rebased onto b9a4007). check 592 pass / 0 fail.

Added getSuggestions() helper; bound keys 1-9 in BOTH list-focus and content-focus (mirroring `r`) gated on canAnswer + non-empty suggestions + N in range → applyAnswer(cur, suggestionText) (save + mark answered). Added '1-9 pick suggestion' hint. 8 ink tests: pick path, out-of-range no-op, non-answerable no-op, content-focus path, hint visibility. Files: app.tsx, test/app.test.tsx.
