# implement-worker — T86 (M19) web per-suggestion pick button — PASS

Agent afbb4b5a1e7be6a80. resultCommit 40f290113c753533a4fc285a3cefd4eabb5c79ce, branch worktree-agent-afbb4b5a1e7be6a80 (rebased onto 066bfe9). check 602 pass / 0 fail.

Per-suggestion 'pick' button inside each suggestion <li> in renderQuestionFields; renders only when answerable (open + canAnswer); calls answerWith(suggestionText); data-testid='answer-pick-suggestion-<index>'. BatchAnswerModal unaffected (uses separate renderListField). 6 new happy-dom tests (pickSuggestion.test.tsx). Updated a pre-existing list-render test toBe→toContain (<li> now includes pick button text). T88 can add `disabled` to the button element without structural change. Files: App.tsx, test/pickSuggestion.test.tsx, test/app.test.tsx.
