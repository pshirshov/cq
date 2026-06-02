# implement-worker — T83 (M18) web goals flat-list — PASS

Agent a2f08ef5607bd65b6. resultCommit 8f12ba63a7287937d2c66e51fc925ea00ff9845f, branch implement/T83 (rebased onto b9a4007). check 588 pass / 0 fail.

Web mirror of T84: goals ledger renders as a single flat table (no per-coordination-milestone <section> subsections, no milestone column) via ItemTable isGoals branch; goal DetailPanel renders fields.milestones (M12/M13/M14) as a `milestones` list replacing the single coordination `milestone` row. Non-goal ledgers keep subsections + single milestone row. Used a dedicated in-test GoalsClient (shared FakeClient has no goals ledger). Composes with T79/T80. Files: App.tsx, test/goalsFlat.test.tsx.
