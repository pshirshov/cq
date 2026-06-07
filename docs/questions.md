---
ledger: questions
counters:
  milestone: 0
  item: 129
archives:
  - id: M2
    path: ./archive/questions/M2.md
    summary: TUI + web UI improvements — complete. Per-ledger counts (T1), answer-and-resolve for questions (T2), view persistence (T3), embedded in-process MCP mode for ledger-tui + ledger-web (T17–T22), question-detail field order + highlighted recommendation (T23). Decision K2 (in-process = co-locate the MCP server, don't bypass MCP). Defect D1 (web counts undefined) resolved. Shipped on main (commits 63df0f3, 5cf4916; merged b510170).
    title: TUI + web UI improvements
    status: done
  - id: M14
    path: ./archive/questions/M14.md
    summary: G2-W3 column selector + batch-answer + project title — COMPLETE. T60-T68 (eligibleColumnFields/defaultColumns, web+TUI column selectors, web batch-answer modal + TUI overlay, displayName + web/TUI titles). Out-of-scope defects D3 (exports map) + D4 (column eligibility) RESOLVED via G5; Q52 withdrawn (K13). Reviews R54/R57-R61. Shipped on main.
    title: "G2-W3: Column selector, batch-answer mode, project title"
    status: done
  - id: M18
    path: ./archive/questions/M18.md
    summary: "G2 follow-up #9-13 — COMPLETE. T79 archived-subsection unification, T80/T81 milestone-status badge (web)/color (TUI), T82 colgroup column proportions, T83/T84 goals flat-list, T85 TUI nav-perf memoization. Out-of-scope D5 (archived-head badge) + D6 (browser-safe constants) RESOLVED via G5; Q53 withdrawn (K13). Reviews R62-R68. Shipped on main."
    title: "G2 follow-up: web milestone-section rendering + column-width + goals flat-list + TUI nav-perf (#9-#13)"
    status: done
  - id: M15
    path: ./archive/questions/M15.md
    summary: "G3 coordination — COMPLETE (auto-archived by the new milestone-sweep rule, T129). Goal G3 (plan/implement flow-behavior changes: auto-investigate + never-auto-close-goals) done; work milestones M16/M17 archived; decisions K10/K12 (K12 supersedes K8 pt3); questions Q42-Q47 answered; reviews R31/R32."
    title: "Plan: plan/implement flow-behavior changes (auto-investigate + never auto-close goals)"
    status: done
  - id: M1
    path: ./archive/questions/M1.md
    summary: G1 coordination — COMPLETE. Goal G1 (build the /implement:* command family) done; work milestones M3/M6/M7/M8/M9 archived; clarifying questions answered, reviews + approval decision terminal. Auto-archived by the /advance whole-ledger sweep.
    title: "Plan: /implement:* command family"
    status: done
  - id: M10
    path: ./archive/questions/M10.md
    summary: "G2 coordination — COMPLETE. Goal G2 (ledger-suite UI/schema enhancements: columns, batch-answer, colors, titles + follow-ups) done; work milestones M12/M13/M14/M18/M19/M21 archived; defects D18/D19/D20 resolved; reviews + approval decision terminal. Auto-archived by the /advance whole-ledger sweep."
    title: "Plan: ledger-suite UI/schema enhancements (columns, batch-answer, colors)"
    status: done
  - id: M27
    path: ./archive/questions/M27.md
    summary: "G6 coordination — COMPLETE. Goal G6 (low-severity cleanup + follow-ups: #2 universal /advance command + N=4→8, #3 ledger-mcp --reset, #4 formal defect-lifecycle states + milestone auto-archive) done; work milestones M28/M31/M32/M33 archived; defects D9/D10/D11/D12/D13 resolved (D13's investigation hypotheses H9/H10 confirmed, H11/H12 refuted); reviews + decisions terminal. Auto-archived by the /advance whole-ledger sweep."
    title: "Plan: low-severity cleanup — D9 test flake, D10 store parity, D11 sticky filter bar"
    status: done
  - id: M33
    path: ./archive/questions/M33.md
    summary: "G6 #4A work milestone — COMPLETE. Formal defect-lifecycle states (open/wip/root-caused/inconclusive/resolved/wontfix) landed in @cq/ledger CANONICAL_LEDGERS + investigate/plan/implement flow prompts; live open-defect migration done; tasks + reviews terminal. Auto-archived by the /advance whole-ledger sweep."
    title: "G6 #4A — formal defect-lifecycle states (root-caused/inconclusive) across schema + flow prompts"
    status: done
  - id: M52
    path: ./archive/questions/M52.md
    summary: "Investigation of D29 (empty-answer-accepted) complete: H19 (backend gap) + H20 (frontend gap) confirmed against source, root cause pinned, fix file-and-deferred to G16 and resolved this run. Q94 pointer withdrawn (fulfilled)."
    title: "Investigate: empty-answer-accepted"
    status: done
  - id: M61
    path: ./archive/questions/M61.md
    summary: G18 PART 1 — Merge cq-config into ledger MCP + remove standalone server — COMPLETE. 11 tasks done + merged (T1 get_reviewers/get_config on BOTH ledger-MCP surfaces behind injected ConfigCapability; T2 buildServer wiring + e2e stdio; T3 count 18→20 + drift-guard; T4 delete cq-config-mcp package; T5 flake.nix removal + @cq/config symlink; T6 dev-llm.nix; T7 .mcp.json; T8/T9/T10 repoint reviewers.md/implement-advance/plan-advance to mcp__ledger__*; T11 FOD hash refresh + nix build .#ledger-mcp/.#ledger-tui/.#ledger-web green + .#cq-config-mcp attr-not-found). Reviews R195-R205 go-ahead. Out-of-scope defect D32 (README still referenced the removed server) auto-investigated→root-caused (H23)→defect-seeded G19→planned (K32/R212)→BUILT (T182, R213)→D32 RESOLVED in the same run; Q104 traceability withdrawn. bun run check green 931/0; main tip 418b641. @cq/config PARSER library retained.
    title: G18 PART 1 — Merge cq-config into ledger MCP + remove standalone server
    status: done
  - id: M60
    path: ./archive/questions/M60.md
    summary: "Investigate D31 (web BatchAnswerModal premature-close) — COMPLETE. User-confirmed repro (Q103) flipped the prior 'does not reproduce' conclusion: H22 (suspected T163 regression) WRONG; H24 CONFIRMED — the modal backdrop closed on any click whose common-ancestor was the backdrop with no guard the press STARTED there; a press-and-hold on 'save & mark answered' (timer-fired) advanced to a shorter question, the dialog shrank while still pressed, and the release over the backdrop dismissed it (react-modal #466 class; vacuous test coverage cf. D24/H14). Root-caused → defect-seeded G21 → fixed (T183 RED + T184 shared useBackdropDismiss on all 3 overlays) → D31 RESOLVED. Q103 answered, Q112 (traceability) withdrawn."
    title: "Investigate: batch-answer-modal-premature-close"
    status: done
  - id: M73
    path: ./archive/questions/M73.md
    summary: "D33 investigated → root-caused (H25 confirmed via headless-chromium ground truth: computeDagLayout left layer 0 empty for cyclic graphs, not CSS) → resolved by G24/T199 (e9bf762). Q113 answered (use headless chromium)."
    title: "Investigate: sm-diagram-alignment (blocked on env)"
    status: done
  - id: M40
    path: ./archive/questions/M40.md
    summary: "G11 (agent-ergonomic ledger MCP: snapshot + handoffs + sessionLogs + click-protection) closed done; coordination milestone archived."
    title: "Plan: agent-ergonomic ledger MCP (state-overview endpoint + better descriptions)"
    status: done
  - id: M51
    path: ./archive/questions/M51.md
    summary: G15 (explorer RW prober + pluggable parallel reviewers via cq.toml) closed done; coordination milestone archived.
    title: "Plan: explorer RW access + pluggable parallel reviewers (cq.toml)"
    status: done
  - id: M57
    path: ./archive/questions/M57.md
    summary: G17 (fix D30 link-prompts stale llm/ root) closed done; coordination milestone archived.
    title: "Plan: fix D30 (link-prompts stale `llm/` root → dangling symlinks)"
    status: done
  - id: M59
    path: ./archive/questions/M59.md
    summary: G18 (merge cq-config into ledger MCP + parallel planners) closed done; coordination milestone archived.
    title: "Plan: merge cq-config into ledger MCP + parallel planners"
    status: done
  - id: M65
    path: ./archive/questions/M65.md
    summary: G20 (cq.toml [webui] + cq CLI init/reset/erase) closed done; coordination milestone archived.
    title: "Plan: cq.toml [webui] + cq CLI (init/reset/erase)"
    status: done
  - id: M74
    path: ./archive/questions/M74.md
    summary: G23 (flow state-machine docs + Flows help tab) closed done; coordination milestone archived.
    title: "Plan: flow state-machine docs + Flows help tab"
    status: done
  - id: M80
    path: ./archive/questions/M80.md
    summary: G25 (retire legacy skills + clean cq references) closed done; coordination milestone archived.
    title: "Plan: retire legacy skills + clean cq references"
    status: done
  - id: M81
    path: ./archive/questions/M81.md
    summary: G26 (render session-log markdown in a popup) closed done; coordination milestone archived.
    title: "Plan: render session logs as markdown in a popup"
    status: done
  - id: M11
    path: ./archive/questions/M11.md
    summary: "Investigate D2 (mcp-fails-uninitialized-ledger) complete: D2 resolved (backup-and-reinit on schema divergence); hypothesis tree closed — H1/H2 wrong, H4 confirmed (BootstrapViolationError on schema divergence), H3 (environmental/version-skew direction) confirmed by H4 + the D2 fix; Q37 answered. All items terminal."
    title: "Investigate: mcp-fails-uninitialized-ledger"
    status: done
---

# questions

## M86

### Q125 — open

- createdAt: 2026-06-07T19:00:04.930Z
- updatedAt: 2026-06-07T19:00:04.930Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- question: "Which subagent mechanism should we adopt for Pi: (a) the third-party npm extension `nicobailon/pi-subagents`, (b) badlogic's own example subagent extension shipped in pi-mono's examples/extensions, or (c) a bespoke in-repo Pi extension (nix/pkg/pi-extensions/*.ts via pi.registerTool) purpose-built for the cq flow? Or do you want the plan to start with an evaluation/spike task that compares them and a follow-up to commit the choice?"
- context: "Pi has no native subagents (pi-context.md says so explicitly). The flow needs to dispatch explorers/reviewers/workers. nicobailon/pi-subagents is the closest off-the-shelf match: it already uses agent markdown files with YAML frontmatter (model/tools/skills), /chain + /parallel slash commands, and a 'children do not register the subagent tool' boundary that mirrors our own 'subagents-cannot-spawn-subagents' invariant. The tradeoff is third-party-dependency risk + frontmatter-shape mismatch vs. our existing `mergedAgents` definitions, versus the control (and maintenance cost) of a bespoke extension. This choice determines essentially the entire task breakdown."
- suggestions: ["Adopt nicobailon/pi-subagents (npm package), adapt our agent bundle to its frontmatter","Vendor/port badlogic's example subagent extension into nix/pkg/pi-extensions","Write a bespoke in-repo pi.registerTool extension driven by our existing mergedAgents","First task: spike/compare all three read-only, then a decision item picks one before implementation"]
- recommendation: Start with a short spike comparing nicobailon/pi-subagents against a bespoke extension, but bias toward the bespoke in-repo extension if its frontmatter/dispatch contract diverges from our mergedAgents shape — it keeps the cross-harness dispatch contract under our control and avoids a third-party dependency in the unattended worker path.
- ledgerRefs: ["goals:G28"]

### Q126 — open

- createdAt: 2026-06-07T19:00:14.387Z
- updatedAt: 2026-06-07T19:00:14.387Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- question: "How portable must the cq command prompts (plan/investigate/implement *:advance) be once Pi gains subagents? Should the prompts dispatch subagents through a single harness-agnostic abstraction (so the SAME prompt text works on Claude's Task tool, Codex multi_agent, and Pi), or is it acceptable for the prompts to branch on harness ('if Pi, call the pi-subagents tool; if Claude, use Task')?"
- context: The cq command prompts currently assume Claude Code's native `Task`-tool dispatch and encode rules like 'you never spawn subagents' / 'subagents cannot spawn subagents'. Codex already diverges (features.multi_agent). The portability target dictates whether this goal also requires editing the shared command prompts in nix/pkg/cq-assets, or only adds a Pi-side adapter that maps the existing dispatch convention onto Pi's mechanism. This is load-bearing for scope (touch shared prompts vs Pi-only).
- suggestions: ["Single harness-agnostic dispatch abstraction; minimize/avoid harness-specific branches in prompts","Pi-side adapter only: keep prompts as-is, the Pi mechanism interprets the existing dispatch convention","Explicit per-harness branches in the prompts are acceptable"]
- recommendation: Prefer a Pi-side adapter that interprets the EXISTING dispatch convention (the agent name + task the prompt already specifies), so the shared command prompts stay unchanged and Claude/Codex are unaffected; only fall back to prompt edits if the convention can't be expressed Pi-side.
- ledgerRefs: ["goals:G28"]

### Q127 — open

- createdAt: 2026-06-07T19:00:23.389Z
- updatedAt: 2026-06-07T19:00:23.389Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- question: Which model/provider should Pi subagents run under, and does each cq subagent role's `suggestedModel` tier (frontier/standard/fast) need to map to a concrete Pi provider+model? Pi's default is grok-build, but the cq agents carry Claude-oriented model hints.
- context: Under Claude Code each subagent inherits a Claude model; the cq agent definitions and task `suggestedModel` tiers assume that resolution. Pi can route to grok-build, openrouter, ollama-cloud, minimax, anthropic-OAuth, etc. (see programs.pi packages). A subagent extension typically lets an agent's frontmatter pin a model. We need to know whether Pi subagents should (a) all inherit the parent's active Pi model, (b) map our frontier/standard/fast tiers to specific Pi providers, or (c) be left to the chosen extension's defaults. This affects whether the plan must add a tier->Pi-model mapping.
- suggestions: ["Subagents inherit the parent Pi session's active model (simplest)","Map frontier/standard/fast tiers to specific Pi providers+models (e.g. frontier=grok-build or anthropic, fast=ollama/minimax)","Defer to the chosen extension's per-agent frontmatter defaults"]
- recommendation: Have subagents inherit the parent Pi model for the first iteration (least new config, matches how Claude subagents inherit), and defer a tier->provider mapping to a follow-up unless you already want cost/latency tiering on day one.
- ledgerRefs: ["goals:G28"]

### Q128 — open

- createdAt: 2026-06-07T19:00:32.369Z
- updatedAt: 2026-06-07T19:00:32.369Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- question: "What is the acceptance/verification bar for this goal — how do we prove Pi subagents 'work correctly, mirroring Claude Code'? Specifically, which cq flow(s) must run end-to-end under Pi as the success criterion (e.g. a full /cq:plan:advance round dispatching candidate planners, or /cq:investigate:advance dispatching read-only explorers, or /cq:implement:advance dispatching workers+reviewers), and on what target repo?"
- context: Per operationalism, 'works correctly under pi' needs a concrete, observable test. The cq flow uses subagents in distinct shapes per phase (read-only explorers in investigate, candidate planners + reviewers in plan, isolated-worktree workers + reviewers in implement). Knowing the minimum demonstrable flow (and whether it must run unattended in the yolo/bubblewrap sandbox) sets each task's `acceptance` field and bounds scope.
- suggestions: ["A single phase end-to-end under Pi is sufficient acceptance (name which)","All three phases (plan/investigate/implement) must dispatch subagents successfully under Pi","Just the dispatch primitive working (spawn a child, get a structured result back) is enough; full-flow validation is a follow-up"]
- recommendation: "Make the acceptance bar: one read-only explorer dispatch (investigate-style) AND one reviewer dispatch (plan-review-style) complete under Pi and return a parseable result, demonstrated on THIS repo in the normal (non-sandboxed) environment first; full unattended-sandbox + implement-worker validation as a follow-up goal."
- ledgerRefs: ["goals:G28"]

### Q129 — open

- createdAt: 2026-06-07T19:00:41.311Z
- updatedAt: 2026-06-07T19:00:41.311Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- question: If we adopt an npm-distributed extension (e.g. nicobailon/pi-subagents), is adding it to programs.pi.settings.packages (Pi's managed --legacy-peer-deps npm install on first run) acceptable, or must it be vendored/pinned into the Nix store like the codex-plugin-cc and pi-extensions are, for reproducibility on the unattended llm-worker hosts?
- context: The existing Pi packages (rpiv-web-tools, pi-anthropic-auth, pi-ollama-cloud, minimax, pi-xai) are installed from npm at first run, NOT pinned in Nix — but the comments note self-containedness constraints around Pi's loader/jiti alias map. A subagent extension that spawns child Pi sessions and reads agent markdown is more load-bearing for the flow than a provider shim, so reproducibility/pinning policy matters. This determines whether a packaging task (vendor + FOD hash, like pkg/pi-coding-agent) is in scope.
- suggestions: ["npm install via programs.pi.settings.packages is fine (matches existing providers)","Must be vendored/pinned in the Nix store for unattended-host reproducibility","Prefer a local extension (nix/pkg/pi-extensions/*.ts) precisely to avoid the npm-pinning question"]
- recommendation: If we go with a third-party extension, vendor+pin it in the Nix store (it is load-bearing for the flow on unattended hosts); if that vendoring cost is high, that is itself an argument for the bespoke local nix/pkg/pi-extensions approach from Q1.
- ledgerRefs: ["goals:G28"]
