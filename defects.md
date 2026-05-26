# cq — active defect ledger

Schema: one row per defect, id format `PR-NN-DMM`. Status: `[ ] open` / `[~] in-progress` / `[x] resolved` / `[!] blocked`. Severity: critical / major / minor / nit. Closed defects' PR groups migrate to `./docs/archive/defects-<milestone-id>.md` on milestone close.

| ID | Status | Severity | Location | Description | Root cause | Fix |
|----|--------|----------|----------|-------------|------------|-----|
| `PR-18-D01` | `[ ]` open | minor | `packages/server/test/e2e/ws-resilience.test.ts` | M1 E2E does not drive a client `Manager` in-process; it observes server-side invariants only (clean close handling, immediate accept-after-drop, port re-bind). Manager-against-real-server integration is not tested at E2E level. | Importing `Manager` from `packages/web/src/ws/` into a server-side test requires making the web package a TS composite project; deemed out of scope for PR-18. | Defer to **PR-51** (M5 polish: "End-to-end suite the one mandated by brief § 7"). Make `packages/web` composite, import Manager, drive the three scenarios with a real client state machine. |
