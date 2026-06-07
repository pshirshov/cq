---
ledger: handoffs
counters:
  milestone: 0
  item: 20
archives:
  - id: M79
    path: ./archive/handoffs/M79.md
    summary: "Investigate D34 (top-bar progress 38/39) complete: root cause confirmed (H26 — denominator itemCount counts the terminal `withdrawn` question while numerator counts answered-only), file-and-deferred to G27, fix landed (T207-T209) and D34 resolved. HO15 handoff recorded."
    title: "Investigate: topbar-progress-undercount"
    status: done
  - id: M40
    path: ./archive/handoffs/M40.md
    summary: "G11 (agent-ergonomic ledger MCP: snapshot + handoffs + sessionLogs + click-protection) closed done; coordination milestone archived."
    title: "Plan: agent-ergonomic ledger MCP (state-overview endpoint + better descriptions)"
    status: done
  - id: M51
    path: ./archive/handoffs/M51.md
    summary: G15 (explorer RW prober + pluggable parallel reviewers via cq.toml) closed done; coordination milestone archived.
    title: "Plan: explorer RW access + pluggable parallel reviewers (cq.toml)"
    status: done
  - id: M59
    path: ./archive/handoffs/M59.md
    summary: G18 (merge cq-config into ledger MCP + parallel planners) closed done; coordination milestone archived.
    title: "Plan: merge cq-config into ledger MCP + parallel planners"
    status: done
  - id: M65
    path: ./archive/handoffs/M65.md
    summary: G20 (cq.toml [webui] + cq CLI init/reset/erase) closed done; coordination milestone archived.
    title: "Plan: cq.toml [webui] + cq CLI (init/reset/erase)"
    status: done
  - id: M70
    path: ./archive/handoffs/M70.md
    summary: "G22 (sidebar reorder + help-size + SVG align + cq: renames) closed done; coordination milestone archived."
    title: "Plan: sidebar reorder + help-size + SVG align + cq: command renames"
    status: done
  - id: M74
    path: ./archive/handoffs/M74.md
    summary: G23 (flow state-machine docs + Flows help tab) closed done; coordination milestone archived.
    title: "Plan: flow state-machine docs + Flows help tab"
    status: done
  - id: M80
    path: ./archive/handoffs/M80.md
    summary: G25 (retire legacy skills + clean cq references) closed done; coordination milestone archived.
    title: "Plan: retire legacy skills + clean cq references"
    status: done
  - id: M81
    path: ./archive/handoffs/M81.md
    summary: G26 (render session-log markdown in a popup) closed done; coordination milestone archived.
    title: "Plan: render session logs as markdown in a popup"
    status: done
---

# handoffs

## M-AMBIENT

### HO18 — drained

- createdAt: 2026-06-07T01:12:27.398Z
- updatedAt: 2026-06-07T01:12:27.398Z
- author: "opus-4.8[1m]"
- session: 059ff637-d28c-4785-8125-9c0d73ddf7a0
- summary: "DRAINED. This /cq:advance run folded in the user's answers (Q117-Q124) and drove three goals + one defect from intake to landed code. INVESTIGATE: completed D34's file-and-defer (seeded defect-seeded goal G27 from the confirmed H26 root cause; the prior /cq:investigate run had marked D34 root-caused but omitted the seed). PLAN: advanced G27 (defect-seeded), G25 (retire 5 legacy skills), G26 (session-log markdown popup) to `planned` via the planner<->reviewer loop (G25 took one revise round, R248->R249; G26/G27 one round each). IMPLEMENT: built and merged all 14 tasks T207-T220 across work milestones M83 (G27/D34 fix: progressTotal denominator), M84 (G25: archived 5 skills to docs/legacy-skills/, de-registered via readDir, repointed refs, nix build green), M85 (G26: modal overlay CSS + LogModal->Markdown + read_log 4MiB cap + tests). All per-task reviews go-ahead. D34 RESOLVED (T207-T209). Archived M79 (D34 investigate), M83, M84, M85. Final predicate gate: P-investigate=FALSE (no non-terminal defects), P-plan=FALSE (no clarifying/planning goal), P-implement=FALSE (no non-terminal tasks), open-question gate clear. Nothing actionable remains. OPERATIONAL NOTE: a background process kept committing divergent 'pi ollama'/'pi config' commits and the Agent worktrees repeatedly branched from a stale commit (4891fa0); merge-back was reconciled via cherry-pick onto main each time and the integrated tree verified green (bun run check 1019/0; nix build .#llm-skills green). NEXT (user action, optional): goals G25, G26, G27 are `planned` with all work milestones archived and all tasks done/merged — ready for you to CLOSE in the TUI/web (set to done); G23 + G24 from prior runs are also building/ready to close. Goals never auto-close. Once closed, the next /cq:advance sweep archives their coordination milestones (M80/M81/M82 etc.). Also still open from before: M11 carries a dangling non-terminal hypothesis H3 (D34-unrelated; investigate-flow's to adjudicate)."
- flow: advance
- ledgerRefs: ["goals:G25","goals:G26","goals:G27","defects:D34"]
- sessionLogs: ["docs/logs/20260606-232140-a89c2213af28373de.md","docs/logs/20260606-235430-a48f559038353f730.md","docs/logs/20260606-235703-aa9bf7ba7fd4842b4.md","docs/logs/20260606-235758-a360792708a13fba4.md","docs/logs/20260606-233304-ab05488ed82cc7cad.md","docs/logs/20260607-000134-ab5f1116794648297.md","docs/logs/20260607-000447-a69e06dc96c2189ab.md","docs/logs/20260607-000637-aeb3128d2c2ae4474.md","docs/logs/20260607-000840-a743847f150e34c0a.md","docs/logs/20260607-000936-a5f137261337c70fc.md","docs/logs/20260606-233747-adda28120a7df8d0b.md","docs/logs/20260607-001319-a46779525c26687ff.md","docs/logs/20260607-001602-a437cb1196df33565.md","docs/logs/20260607-001655-a162a1c387e284ac0.md"]

## M86

### HO19 — answers-required

- createdAt: 2026-06-07T19:01:25.013Z
- updatedAt: 2026-06-07T19:01:25.013Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- summary: "ANSWERS-REQUIRED. /cq:plan bootstrapped goal G28 (\"Enable subagent support in the pi agent harness for the cq flow\") under coordination milestone M86. The planner grounded read-only in the harness wiring (nix/hm/dev-llm.nix, pi-context.md) and filed the first clarifying batch Q125-Q129, all linked to goals:G28. Goal left in `clarifying`/awaiting-answers. Key finding: Pi consumes the cq `commands`/`skills` bundles but NOT the `agents` bundle, and its prompt explicitly disclaims native subagents, so cq subagent-dispatch steps have no Pi runtime mechanism today. Three candidate approaches (npm nicobailon/pi-subagents; badlogic example extension; bespoke in-repo nix/pkg/pi-extensions registerTool). NEXT (user): answer Q125-Q129 in the TUI/web (set each `answered` with a non-empty answer), then run /cq:plan:advance G28."
- flow: plan
- ledgerRefs: ["goals:G28"]
- blockingQuestions: ["Q125","Q126","Q127","Q128","Q129"]
- sessionLogs: ["docs/logs/20260607-190101-adc3647f6e76fc771.md"]

### HO20 — answers-required

- createdAt: 2026-06-07T19:20:50.843Z
- updatedAt: 2026-06-07T19:20:50.843Z
- author: "opus-4.8[1m]"
- session: 994b02a0-7e3f-40df-81ed-b12b9ce6b13e
- summary: "BLOCKED-ON-QUESTIONS. /cq:advance ran one cycle on the only actionable item, goal G28 (\"Enable subagent support in the pi agent harness for the cq flow\"). PLAN stage: the user had answered the first batch Q125-Q129, but Q125 (the load-bearing mechanism choice) was a COUNTER-QUESTION (\"give me pros/cons + how hard is a custom extension + downsides\"), so the goal stayed in its clarification sub-state and no plan could be emitted (configured multi-planner panel not run — clarification, not plan-emission, was the state). A single-planner pass grounded read-only in the real Pi extension surface (dev-llm.nix programs.pi wiring, the two extant nix/pkg/pi-extensions/*.ts, pi-context.md, mergedAgents frontmatter, the per-harness dispatch convention, and cq.toml) and filed Q130 answering the counter-question with a grounded 3-way comparison (nicobailon/pi-subagents npm vs badlogic example vs bespoke in-repo pi.registerTool extension) and a justified recommendation for the bespoke extension. Decisions captured from the answered batch: Q126 = shared cq prompts must stay UNCHANGED across harnesses (Pi mechanism interprets the existing named-agent+task dispatch convention); Q127 = orchestrator names which agent to run + fast/standard/frontier tier->provider mapping lives in cq.toml (needs a new [tiers] table); Q128 = acceptance is one explorer dispatch + one reviewer dispatch returning parseable results on THIS repo non-sandboxed first (sandbox+implement-worker is a follow-up); Q129 = no Nix-vendoring needed for a third-party ext, user biased to custom because a custom extension is also needed later for deterministic orchestration-session logic. INVESTIGATE/IMPLEMENT stages: skipped (no defects; no tasks). Open unknown to de-risk in the eventual first task: confirm Pi's ExtensionAPI can spawn a filtered-tool child session and capture its result. Final gate: P-investigate=FALSE, P-plan=FALSE (G28 blocked on open Q130), P-implement=FALSE, open-Q-gate=Q130 blocks G28. NEXT (user): answer Q130 in the TUI/web (lock the mechanism), then re-run /cq:advance (or /cq:plan:advance G28) to emit the task DAG."
- flow: advance
- ledgerRefs: ["goals:G28"]
- blockingQuestions: ["Q130"]
- sessionLogs: ["docs/logs/20260607-191636-acf7f53795bc6b6aa.md"]
