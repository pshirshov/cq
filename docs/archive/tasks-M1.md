# M1 — WebSocket spine — archive

Closed: 2026-05-26.
Active span: 14 PRs (PR-06 … PR-18, incl. PR-09a). All [x]. One defect opened (`PR-18-D01`, minor, deferred to PR-51).
Acceptance at close: `bun x tsc -b` 0; `bun x eslint .` 0; `bun test` → 210/210 pass across 22 files; resilient-ws-ui Part-3 reliability + indicator coverage complete (R2–R13, V1–V10); E2E (`ws-resilience.test.ts`) runs in 1.3 s.

## Part-3 ticking summary

**Reliability (R2-R13):** all 11 items shipped.
- R2 (4-state machine + STALE grace) → PR-08
- R3 (per-ping nonces + timeouts) → PR-08
- R4 (connect timeout + readyState check) → PR-08
- R5 (full-jitter backoff + cap + max attempts + terminal) → PR-09
- R6 (overlapping-connection failover + pool cap) → PR-09
- R7 (close-code classification) → PR-09 + shared `isRetriable()`
- R8 (time-jump detector → proactive reconnect) → PR-11
- R9 (Page Lifecycle full wiring) → PR-10
- R10 (defer-while-hidden Phoenix pattern) → PR-10
- R11 (server setImmediate + nonce lookback) → PR-07
- R12 (destroyed flag guarding all handlers) → PR-12
- R13 (never-lie terminal labelling) → PR-12 + PR-16

**Indicator (V1-V10):** all 9 items shipped.
- V1 (single compact widget + aria-label) → PR-13
- V2 (derived state, never stored) → PR-13
- V3 (two non-color channels) → PR-13
- V4 (countdown ring) → PR-14
- V5 (throttled rAF + event-driven refresh) → PR-14
- V6 (expanded tooltip pool + RTT + loss + backoff + last close) → PR-15
- V7 (document.title mirror) → PR-16
- V8 (bounded event log) → PR-16
- V9 (card-active class) → PR-15
- V10 (never-lie labels) → PR-16

## G2c review patches applied in M1

- F-04 (server seq replay buffer) → PR-09a delivered the ring-buffer infrastructure + `session.request_state` handler (chat.event traffic plumbs in PR-19+).
- F-10 (replace curl smoke with happy-dom app-mount) → PR-17 delivered `app-mount.test.ts`.
- F-17 (per-PR write-scope bullets) → enforced throughout M1 dispatch briefs.
- F-18 (no module-global Manager — context DI) → PR-17 delivered `ConnectionProvider` / `useConnection`.
- F-19 (Origin host:port equality check) → PR-06 delivered `ws/origin.ts` + pre-upgrade HTTP 403.

## PR-by-PR (one line each; commits + headline outcome)

- **PR-06** `c05b27a` — `/ws` upgrade path + Zod validate every frame + Origin check (HTTP 403 pre-upgrade). 4-frame validation cases + 3 origin cases. 44 server tests.
- **PR-07** `d18c606` — server heartbeat (`hb.sping`/`hb.spong`) with `setImmediate` defer + nonce current+previous lookback. 6 heartbeat tests. Tick R11.
- **PR-08** `ed6393a` — client `Connection` class (NEW/ALIVE/STALE/DEAD) + per-nonce ping `Map<nonce, sentAt>` + connect timeout. 8 connection tests via `MockWebSocket`. Tick R2/R3/R4.
- **PR-09** `078f5f8` — client `Manager` (backoff + overlapping reconnect + close-code classify, pool cap 3). 10 manager tests. Tick R5/R6/R7.
- **PR-09a** `eff293a` — server-side seq replay buffer (500 entries / 5 MB ring) + `SessionRegistry` + `session.request_state` handler. 14 tests. F-04 delivered.
- **PR-10** `b0af38e` — Page Lifecycle wiring (visibilitychange / freeze / resume / pagehide(persisted) / pageshow(persisted) / online / offline / NI API) + Phoenix defer-while-hidden. 9 lifecycle tests. Tick R9/R10.
- **PR-11** `b4be4ae` — time-jump detector (1 s tick; elapsed > tick+threshold → handleResume/checkConnections; injectable `setInterval`/`clock`). 4 time-jump tests. Tick R8.
- **PR-12** `85a463e` — destroyed-flag guard re-tightening + `isTerminal` truthful labelling. 6 destroy tests. Tick R12/R13.
- **PR-13** `5bd2a88` — Indicator widget (32×32 fixed top-right) + `deriveWidgetState` pure + 3 channels (color + data-state + aria-label) + CSS modules infrastructure + happy-dom test env. 14 tests. Tick V1/V2/V3.
- **PR-14** `5226563` — `CountdownRing` SVG + `computeRingRemaining` pure + 10 Hz rAF loop + event-driven refresh. 11 tests. Tick V4/V5. Fixed happy-dom `CloseEvent` defect in `MockWebSocket` along the way.
- **PR-15** `8ef269c` — Tooltip (pool / active conn / loss % / RTT windows 30s/1m/5m / backoff / last close) + Manager RTT-windows tracking. 23 tests (tooltip + rtt-windows). Tick V6/V9.
- **PR-16** `06602c9` — `attachTitleMirror` + bounded event log (500 retained / 100 displayed) wired to Manager transitions + Tooltip event-log section. 14 tests. Tick V7/V8/V10.
- **PR-17** `37c0e8d` — `<ConnectionProvider>` context + `useConnection` hook + `useConnectionStats` via `useSyncExternalStore`. Manager construction moved from `App.tsx` to `main.tsx`. 4 app-mount tests via happy-dom. F-18 + F-10 applied.
- **PR-18** `26cdf1d` — E2E `ws-resilience.test.ts`: server bring-up + 3 scenarios (freeze, IP-change via `dropAllSockets`, server restart with 1012). Runtime 1.3 s. Scope split: server-side invariants only; full Manager-against-real-server deferred to PR-51 (defect `PR-18-D01`).

## Cross-cutting changes during M1

- Renamed `ClientHbPond` → `ClientHbPong` across 4 files (typo carried from PR-02; commit `168f117`).
- `packages/web/test/helpers/MockWebSocket.ts` fixed during PR-14 to use `Object.defineProperty` for `CloseEvent.code/reason/wasClean` (happy-dom's CloseEvent ignores its init dict).
- happy-dom registered per-test-file (not as global preload), preserving Bun's fake-timer support in non-DOM tests.
- `packages/web/test/helpers/MockDocument.ts` shipped in PR-10 for non-DOM lifecycle tests.
- `bunfig.toml` at root excludes `**/dist/**` from test discovery (PR-04 latent-defect fix).

## Acceptance dashboard (final M1)

```
$ bun --version
1.3.13
$ bun x tsc -b
$ bun x eslint .
$ bun test
[210 tests pass across 22 files; 0 fail; 3.86 s]
$ bun run start --cwd /tmp --port 5180 &
$ curl -sf http://127.0.0.1:5180/ | grep -q 'id="root"' && echo OK   # OK
$ kill -INT %1 && wait %1; echo $?                                    # 0
```

## What M1 hands off to M2

- A complete, resilient WebSocket spine end-to-end (server + client), tested against freeze / IP-change / server-restart scenarios at the server-side invariant level.
- A working `<ConnectionProvider>` + `useConnection()` context surface that M2's Chat UI subscribes to.
- A `SessionRegistry` + `ReplayBuffer` already in place server-side; M2's bridge will start appending `chat.event` frames as soon as the SDK starts emitting.
- Indicator + ring + tooltip + title + event-log = full operator-visible connection-health surface.
- One known defect (`PR-18-D01`, deferred to PR-51).

## Metrics dashboard (M1)

```
Metrics:
- WIP max 1; review rounds (per PR: each 1 inner cycle, no adversarial re-review at PR level)
- S3-S4 firings research:0 replan:0; time-to-stabilize n/a
- Material scope delta none (all PRs stayed within their write scope)
- Verification complete (every PR has commit + exact bun-command predicates)
- Audit discrepancies 0 (one bookkeeping correction: PR-02 "76 tests" was double-counted .ts+.js before PR-04's bunfig fix; true count was always 38)
- Algedonic ordinary:0 bypass:0 depth-limit:0; bypass false-positives 0
```

M2 begins at PR-19 (server SDK bridge skeleton + streaming-input mode).
