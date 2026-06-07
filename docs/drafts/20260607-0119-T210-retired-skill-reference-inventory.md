# T210: Retired Skill Reference Inventory

**Task:** T210 — Inventory the complete reference surface for the five retired skill names  
**Date:** 2026-06-07  
**Scope:** Full `nix/` tree + `docs/` for completeness  
**Retired skills:** `research-loop`, `vsm-loop`, `vsm-node`, `question-batch`, `review-loop`  

## Methodology

All hits produced by:
```
grep -rn -E 'research-loop|vsm-loop|vsm-node|question-batch|review-loop' nix/
grep -rn -E 'research-loop|vsm-loop|vsm-node|question-batch|review-loop' docs/
```

Classification separates:
1. **The five retired skills' own internal files** — archived by T211, not scrubbed in place
2. **Surviving cq-asset files** (commands/, agents/) — scrub targets for T213/T214
3. **Other surviving skills** (non-retired) — none found
4. **Other nix/ locations** (llm-contexts/, hm/, flake.nix) — none found

---

## Section 1: Five Skills' Own Internal References (T211 scope — archive, do NOT scrub in place)

These files belong to the five retired skill directories. They will be archived by T211 and then removed by T213. The inter-skill wikilinks here are T211's concern (repoint to peer archive files or annotate as retired).

### 1.1 `nix/pkg/llm-skills/skills/research-loop/`

| File | Line | Text (form) | Reference type |
|------|------|-------------|----------------|
| `nix/pkg/llm-skills/skills/research-loop/meta.yaml` | 1 | `name: research-loop` | `name:` key (skill self-identification) |
| `nix/pkg/llm-skills/skills/research-loop/content.md` | 265 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/research-loop/content.md` | 336 | `[[vsm-loop]]` | wikilink to peer retired skill |

### 1.2 `nix/pkg/llm-skills/skills/vsm-loop/`

| File | Line | Text (form) | Reference type |
|------|------|-------------|----------------|
| `nix/pkg/llm-skills/skills/vsm-loop/meta.yaml` | 1 | `name: vsm-loop` | `name:` key (skill self-identification) |
| `nix/pkg/llm-skills/skills/vsm-loop/meta.yaml` | 8 | `vsm-node contract` (bare name) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/meta.yaml` | 8 | `review-loop for` (bare name) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/meta.yaml` | 9 | `research-loop for` (bare name) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/meta.yaml` | 13 | `review-loop or research-loop` (bare names) | bare name references to peer retired skills |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 11 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 12 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 13 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 16 | `vsm-loop` (bare, section heading) | self-reference (heading) |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 27 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 32 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 33 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 34 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 74 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 75 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 76 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 78 | `vsm-loop` (bare), `[[vsm-node]]` | self-ref + wikilink to peer |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 183 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 281 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 326 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 424 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 540 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 579 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 580 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 581 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 584 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 646 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 654 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 675 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 734 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 758 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 770 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 784 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 827 | `[[question-batch]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 873 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 876 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 879 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 911 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 939 | `[[review-loop]]` and `[[research-loop]]` (section heading) | wikilinks to peer retired skills |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 941 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 944 | `[[review-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 948 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 949 | `[[research-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 953 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 956 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 960 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 962 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 965 | `[[vsm-node]]` (section heading) | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 967 | `vsm-node` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 975 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 986 | `vsm-node` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 987 | `[[review-loop]]` and `[[research-loop]]` | wikilinks to peer retired skills |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1000 | `vsm-loop` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1001 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1013 | `[[vsm-node]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1033 | `[[review-loop]]` and `[[vsm-node]]` | wikilinks to peer retired skills |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1102 | `vsm-loop` (bare, section heading) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1108 | `vsm-node` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-loop/content.md` | 1166 | `research-loop` (bare, in path comment) | bare name reference to peer retired skill |

### 1.3 `nix/pkg/llm-skills/skills/vsm-node/`

| File | Line | Text (form) | Reference type |
|------|------|-------------|----------------|
| `nix/pkg/llm-skills/skills/vsm-node/meta.yaml` | 1 | `name: vsm-node` | `name:` key (skill self-identification) |
| `nix/pkg/llm-skills/skills/vsm-node/meta.yaml` | 3 | `vsm-loop` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/meta.yaml` | 8 | `vsm-node` (bare) | self-reference (TRIGGER text) |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 3 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 9 | `vsm-node` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 11 | `[[vsm-node]]` | wikilink (self-reference) |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 12 | `vsm-loop` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 69 | `[[review-loop]]` and `[[research-loop]]` | wikilinks to peer retired skills |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 72 | `sub-vsm-node` (bare) | bare name self-reference compound |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 76 | `sub-vsm-node` (bare) | bare name self-reference compound |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 88 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 110 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 126 | `vsm-loop` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 153 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 280 | `vsm-node` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 285 | `vsm-node` (bare) | self-reference |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 300 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 329 | `sub-vsm-node` (bare) | bare name self-reference compound |
| `nix/pkg/llm-skills/skills/vsm-node/content.md` | 338 | `[[vsm-loop]]` | wikilink to peer retired skill |

### 1.4 `nix/pkg/llm-skills/skills/question-batch/`

| File | Line | Text (form) | Reference type |
|------|------|-------------|----------------|
| `nix/pkg/llm-skills/skills/question-batch/meta.yaml` | 1 | `name: question-batch` | `name:` key (skill self-identification) |

*(question-batch/content.md has no cross-references to other retired skills — not shown in grep output.)*

### 1.5 `nix/pkg/llm-skills/skills/review-loop/`

| File | Line | Text (form) | Reference type |
|------|------|-------------|----------------|
| `nix/pkg/llm-skills/skills/review-loop/meta.yaml` | 1 | `name: review-loop` | `name:` key (skill self-identification) |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 14 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 267 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 268 | `vsm-loop` (bare) | bare name reference to peer retired skill |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 322 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 356 | `[[vsm-loop]]` | wikilink to peer retired skill |
| `nix/pkg/llm-skills/skills/review-loop/content.md` | 421 | `[[vsm-loop]]` | wikilink to peer retired skill |

---

## Section 2: Surviving cq-asset Files (T214 scrub scope)

These files survive after the skill retirement; their references to retired skill names must be either repointed to the cq successor or deleted outright.

### Repoint map (per Q118 decision)

| Retired name | cq successor | Action |
|---|---|---|
| `research-loop` | `/cq:investigate` (and `:advance`) flow | Repoint |
| `question-batch` | questions-ledger clarification path | Repoint |
| `vsm-loop` | `/cq:advance` + plan/implement/review flow | Repoint or delete |
| `vsm-node` | `/cq:advance` + plan/implement/review flow | Repoint or delete |
| `review-loop` | `/cq:advance` + plan/implement/review flow | Repoint or delete |

### 2.1 `nix/pkg/cq-assets/commands/cq/investigate/advance.md`

| File | Line | Form | Context | Repoint target or delete |
|------|------|------|---------|--------------------------|
| `nix/pkg/cq-assets/commands/cq/investigate/advance.md` | 21 | `research-loop` (bare) | `(the research-loop E-item convention)` in a parenthetical note about the `[correct]/[incorrect]` prefix convention inherited from the research-loop architecture | **Repoint**: replace the parenthetical attribution with `/cq:investigate` convention (or delete the attribution parenthetical — the convention itself is not changing, just its provenance label); e.g. change to `(the investigate-flow E-item convention)` |

### 2.2 `nix/pkg/cq-assets/agents/investigate-explorer.md`

| File | Line | Form | Context | Repoint target or delete |
|------|------|------|---------|--------------------------|
| `nix/pkg/cq-assets/agents/investigate-explorer.md` | 15 | `research-loop` (bare) | Inside a `>` block-quote comment: `This is the read-only role of the research-loop architecture (decision K8, Q24/Q27)` | **Repoint**: replace `research-loop architecture` with `/cq:investigate architecture` (same decision K8 reference is still valid) |
| `nix/pkg/cq-assets/agents/investigate-explorer.md` | 60 | `research-loop` (bare) | `[correct]/[incorrect] prefix (the research-loop E-item convention)` in output instructions | **Repoint**: same as advance.md L21 — retitle convention attribution to `investigate-flow` or delete the parenthetical |

### 2.3 `nix/pkg/cq-assets/agents/investigate-prober.md`

| File | Line | Form | Context | Repoint target or delete |
|------|------|------|---------|--------------------------|
| `nix/pkg/cq-assets/agents/investigate-prober.md` | 17 | `research-loop` (bare) | Inside `>` block-quote comment: `This is the read+execute role of the research-loop architecture (decision K8, Q24/Q27/Q89)` | **Repoint**: replace `research-loop architecture` with `/cq:investigate architecture` |
| `nix/pkg/cq-assets/agents/investigate-prober.md` | 95 | `research-loop` (bare) | `[correct]/[incorrect] prefix (the research-loop E-item convention)` | **Repoint**: same retitling as above |

---

## Section 3: Other nix/ Locations

### 3.1 `nix/pkg/llm-contexts/` — **zero hits**

No files in `nix/pkg/llm-contexts/` reference any of the five retired skill names.

### 3.2 `nix/hm/` — **zero hits**

No files in `nix/hm/` reference any of the five retired skill names.

### 3.3 `flake.nix` — **zero hits**

`flake.nix` contains no references to any of the five retired skill names.

### 3.4 Surviving skills (`nix/pkg/llm-skills/skills/` — non-retired) — **zero hits**

The seven surviving skill directories (`baboon`, `constructive-test-taxonomy`, `dual-tests`, `environment`, `izumi`, `resilient-ws-ui`, `tass`) contain no references to any of the five retired skill names.

---

## Section 4: docs/ References (for completeness — not nix/ scrub scope)

The following `docs/` files reference the retired skill names. These are ledger/log/planning files — they are read-only historical records and are NOT scrub targets (per task scope: scrub is confined to `nix/`).

Key files with mentions (not exhaustive detail, provided for completeness):

- `docs/tasks.md` — task descriptions for T210, T211, T213, T214, T215 reference the five names as the subject of those tasks
- `docs/milestones.md` — M84 coordination milestone description
- `docs/goals.md` — G25 goal title and description
- `docs/decisions.md` — K40 decision record
- `docs/questions.md` — Q117-Q120 answers
- `docs/handoffs.md` — session handoff summaries
- `docs/logs/` — session log files
- `docs/archive/` — archived milestone/task records

None of these are scrub targets; they document the retirement work itself.

---

## Summary: T214/T215 Scrub Checklist

Files in `nix/` that T214 must scrub (all outside the five retired skills' own dirs):

| # | File | Lines | Action |
|---|------|-------|--------|
| 1 | `nix/pkg/cq-assets/commands/cq/investigate/advance.md` | 21 | Repoint `research-loop E-item convention` → `investigate-flow convention` |
| 2 | `nix/pkg/cq-assets/agents/investigate-explorer.md` | 15, 60 | Repoint `research-loop architecture` → `/cq:investigate architecture`; retitle convention attribution |
| 3 | `nix/pkg/cq-assets/agents/investigate-prober.md` | 17, 95 | Same as investigate-explorer.md |

Total: **3 files, 5 line-level edits** in surviving cq-assets outside the five retired skill directories.

The five retired skill directories (`nix/pkg/llm-skills/skills/{research-loop,vsm-loop,vsm-node,question-batch,review-loop}/`) are the bodies being archived by T211 and removed by T213; their internal cross-references are T211's concern, not T214's.

---

## Raw grep Evidence

### `grep -rn -E 'research-loop|vsm-loop|vsm-node|question-batch|review-loop' nix/`

```
nix/pkg/llm-skills/skills/vsm-node/meta.yaml:1:name: vsm-node
nix/pkg/llm-skills/skills/vsm-node/meta.yaml:3:  Recursive viability contract for subagents operating inside a vsm-loop
nix/pkg/llm-skills/skills/vsm-node/meta.yaml:8:  when: a subagent brief names vsm-node as the recursion contract; or
nix/pkg/llm-skills/skills/vsm-loop/meta.yaml:1:name: vsm-loop
nix/pkg/llm-skills/skills/vsm-loop/meta.yaml:8:  recursive viability via the vsm-node contract. Composes review-loop for
nix/pkg/llm-skills/skills/vsm-loop/meta.yaml:9:  build-style cycles and research-loop for investigation cycles. TRIGGER
nix/pkg/llm-skills/skills/vsm-loop/meta.yaml:13:  a single review-loop or research-loop invocation will not bound it.
nix/pkg/llm-skills/skills/research-loop/content.md:265:    compact metrics line when the investigation ran under [[vsm-loop]]
nix/pkg/llm-skills/skills/research-loop/content.md:336:final result. When [[vsm-loop]] invokes this loop, these metrics feed
nix/pkg/llm-skills/skills/vsm-node/content.md:3:A short contract that any subagent in a [[vsm-loop]] hierarchy
nix/pkg/llm-skills/skills/vsm-node/content.md:9:Apply this contract when your brief names you as a vsm-node —
nix/pkg/llm-skills/skills/vsm-node/content.md:11:per the [[vsm-node]] contract"* or *"you are operating at level
nix/pkg/llm-skills/skills/vsm-node/content.md:12:N+1 under vsm-loop."* If your brief does **not** name vsm-node,
nix/pkg/llm-skills/skills/vsm-node/content.md:69:  cycle): delegate to [[review-loop]] or [[research-loop]] inside
nix/pkg/llm-skills/skills/vsm-node/content.md:72:  plan and audit): spawn a sub-vsm-node, **only if** your brief
nix/pkg/llm-skills/skills/vsm-node/content.md:76:overhead. A sub-vsm-node makes sense only when **all three** hold:
nix/pkg/llm-skills/skills/vsm-node/content.md:88:Use the briefing discipline from [[vsm-loop]] § *Subagent
nix/pkg/llm-skills/skills/vsm-node/content.md:110:[[vsm-loop]] § *Parallelism and S2 anti-oscillation*.
nix/pkg/llm-skills/skills/vsm-node/content.md:126:"saw an opportunity." Inside vsm-loop, this corrupts S3's plan
nix/pkg/llm-skills/skills/vsm-node/content.md:153:[[vsm-loop]] § *Stop conditions* for the parent-side rationale
nix/pkg/llm-skills/skills/vsm-node/content.md:280:failure mode of agentic systems. Each level of vsm-node beneath
nix/pkg/llm-skills/skills/vsm-node/content.md:285:spawn another vsm-node. If your brief implies that you would need
nix/pkg/llm-skills/skills/vsm-node/content.md:300:ran the [[vsm-loop]] planner whose output this branch traces back
nix/pkg/llm-skills/skills/vsm-node/content.md:329:a sub-vsm-node. Even if all three conditions hold, depth ≥ 3 is
nix/pkg/llm-skills/skills/vsm-node/content.md:338:  [[vsm-loop]]'s convention.
nix/pkg/llm-skills/skills/review-loop/meta.yaml:1:name: review-loop
nix/pkg/llm-skills/skills/question-batch/meta.yaml:1:name: question-batch
nix/pkg/llm-skills/skills/research-loop/meta.yaml:1:name: research-loop
nix/pkg/llm-skills/skills/review-loop/content.md:14:  leaf-authority principle in [[vsm-loop]] § *S1's local environment loop*:
nix/pkg/llm-skills/skills/review-loop/content.md:267:unannounced). When [[vsm-loop]] wraps this loop, the orchestrator's
nix/pkg/llm-skills/skills/review-loop/content.md:268:spot-check in vsm-loop I3 is the actual S3\* channel layered on
nix/pkg/llm-skills/skills/review-loop/content.md:322:   under [[vsm-loop]] or when any metric threshold fired:
nix/pkg/llm-skills/skills/review-loop/content.md:356:and session log. When [[vsm-loop]] invokes this loop, these metrics feed
nix/pkg/llm-skills/skills/review-loop/content.md:421:[[vsm-loop]] § *Parallelism and S2 anti-oscillation* — that
nix/pkg/cq-assets/agents/investigate-prober.md:17:> This is the read+execute role of the research-loop architecture (decision **K8**,
nix/pkg/cq-assets/agents/investigate-prober.md:95:`[correct]`/`[incorrect]` prefix (the research-loop E-item convention), and
nix/pkg/llm-skills/skills/vsm-loop/content.md:11:compose [[review-loop]] for build–fix–review cycles and
nix/pkg/llm-skills/skills/vsm-loop/content.md:12:[[research-loop]] for investigation cycles. Sub-tasks substantial
nix/pkg/llm-skills/skills/vsm-loop/content.md:13:enough to be viable systems of their own follow the [[vsm-node]]
nix/pkg/llm-skills/skills/vsm-loop/content.md:16:## When to invoke vsm-loop
nix/pkg/llm-skills/skills/vsm-loop/content.md:27:   own planning and audit, per [[vsm-node]].
nix/pkg/llm-skills/skills/vsm-loop/content.md:32:If only one or two hold, prefer [[review-loop]] alone (build-style
nix/pkg/llm-skills/skills/vsm-loop/content.md:33:work) or [[research-loop]] alone (investigation). The meta-overhead
nix/pkg/llm-skills/skills/vsm-loop/content.md:34:of vsm-loop is paid back by reduced rework on genuinely large
nix/pkg/llm-skills/skills/vsm-loop/content.md:74:| **S4** | Plans, researches, models | Planning subagents; [[research-loop]] invocations; design-deliberation subagents. |
nix/pkg/llm-skills/skills/vsm-loop/content.md:75:| **S3** | Allocates work here-and-now; regular oversight | Main session as orchestrator: dispatches subagents, maintains ledgers, decides parallelism, sequences cycles. Includes the structured per-cycle review channel ([[review-loop]] I2) — that is S3 oversight via the S2 ledger/diff channel, *not* S3\*. |
nix/pkg/llm-skills/skills/vsm-loop/content.md:76:| **S3\*** | Sporadic, direct audit of S1 that bypasses S2 | Orchestrator's spot-checks during vsm-loop I3: open the diff or research artefact, verify one or two claims against source, confirm the cycle's report matches reality. Sporadic by design — exhaustive audit collapses back into S3. |
nix/pkg/llm-skills/skills/vsm-loop/content.md:78:| **S1** | The actual work | Execution subagents (code, tests, edits). For substantial S1 tasks, the subagent runs its own vsm-loop per [[vsm-node]]. |
nix/pkg/llm-skills/skills/vsm-loop/content.md:183:vsm-loop is durable authority for the whole goal, not for one
nix/pkg/llm-skills/skills/vsm-loop/content.md:281:  what the parent will inspect on return, and the [[vsm-node]]
nix/pkg/llm-skills/skills/vsm-loop/content.md:326:  orchestrator routes to S4 (a [[research-loop]] sub-cycle or a
nix/pkg/llm-skills/skills/vsm-loop/content.md:424:     a [[research-loop]] question.
nix/pkg/llm-skills/skills/vsm-loop/content.md:540:and bypass per [[vsm-node]] § *Recursion-depth bound*.
nix/pkg/llm-skills/skills/vsm-loop/content.md:579:orchestrators at any layer. The main session running [[review-loop]]
nix/pkg/llm-skills/skills/vsm-loop/content.md:580:or vsm-loop is an orchestrator, not a leaf, even when the
nix/pkg/llm-skills/skills/vsm-loop/content.md:581:orchestrator itself is the S1 of a parent vsm-loop. Orchestrators
nix/pkg/llm-skills/skills/vsm-loop/content.md:584:rule in [[review-loop]] is the orchestrator-side counterpart of
nix/pkg/llm-skills/skills/vsm-loop/content.md:646:restricted bypass in [[vsm-node]]'s *Bypass authority* subsection:
nix/pkg/llm-skills/skills/vsm-loop/content.md:654:See [[vsm-node]] § *Bypass authority* for the full criteria; the
nix/pkg/llm-skills/skills/vsm-loop/content.md:675:     could close. If it is, spawn a [[research-loop]] sub-cycle
nix/pkg/llm-skills/skills/vsm-loop/content.md:734:[[review-loop]]'s `tasks.md` (Milestones, current PR breakdown,
nix/pkg/llm-skills/skills/vsm-loop/content.md:758:Schema identical to [[review-loop]]'s `defects.md` (`PR-NN-DMM`
nix/pkg/llm-skills/skills/vsm-loop/content.md:770:role as in [[review-loop]].
nix/pkg/llm-skills/skills/vsm-loop/content.md:784:Two nested loops, like [[review-loop]], but at a higher level of
nix/pkg/llm-skills/skills/vsm-loop/content.md:827:the ambiguities via [[question-batch]].
nix/pkg/llm-skills/skills/vsm-loop/content.md:873:  delegate to [[review-loop]]'s inner cycle as the primitive.
nix/pkg/llm-skills/skills/vsm-loop/content.md:876:  delegate to [[research-loop]]. The output is an evidence-backed
nix/pkg/llm-skills/skills/vsm-loop/content.md:879:  spawn a recursive [[vsm-node]] subagent with its own brief,
nix/pkg/llm-skills/skills/vsm-loop/content.md:911:[[research-loop]] sub-cycle for that question, fold its findings
nix/pkg/llm-skills/skills/vsm-loop/content.md:939:## Composing with `[[review-loop]]` and `[[research-loop]]`
nix/pkg/llm-skills/skills/vsm-loop/content.md:941:vsm-loop is the **outer** discipline. The two existing loops are
nix/pkg/llm-skills/skills/vsm-loop/content.md:944:- **[[review-loop]]** is the canonical build-style I1 primitive.
nix/pkg/llm-skills/skills/vsm-loop/content.md:948:  schema is compatible with vsm-loop's active ledger.
nix/pkg/llm-skills/skills/vsm-loop/content.md:949:- **[[research-loop]]** is the canonical research-style I1
nix/pkg/llm-skills/skills/vsm-loop/content.md:953:  vsm-loop's active ledger; reference it from the relevant
nix/pkg/llm-skills/skills/vsm-loop/content.md:956:When you invoke one of these from vsm-loop:
nix/pkg/llm-skills/skills/vsm-loop/content.md:960:- vsm-loop archives the sub-skill's artefacts and rolls up the
nix/pkg/llm-skills/skills/vsm-loop/content.md:962:- The sub-skill's stop conditions are the sub-skill's; vsm-loop's
nix/pkg/llm-skills/skills/vsm-loop/content.md:965:## Recursive viability: when to spawn a `[[vsm-node]]`
nix/pkg/llm-skills/skills/vsm-loop/content.md:967:Spawn a recursive vsm-node when the S1 task itself is large
nix/pkg/llm-skills/skills/vsm-loop/content.md:975:- Runs its own outer/inner cycles using vsm-loop discipline.
nix/pkg/llm-skills/skills/vsm-loop/content.md:986:Do **not** spawn a recursive vsm-node for tasks that fit cleanly
nix/pkg/llm-skills/skills/vsm-loop/content.md:987:into [[review-loop]] or [[research-loop]]. The recursion overhead
nix/pkg/llm-skills/skills/vsm-loop/content.md:1000:   is the main vsm-loop orchestrator." For recursive nodes, also
nix/pkg/llm-skills/skills/vsm-loop/content.md:1001:   the [[vsm-node]] reference.
nix/pkg/llm-skills/skills/vsm-loop/content.md:1013:   own subagents (per [[vsm-node]]) and under what conditions.
nix/pkg/llm-skills/skills/vsm-loop/content.md:1033:[[review-loop]] and [[vsm-node]] reference it for runtime-specific
nix/pkg/llm-skills/skills/vsm-loop/content.md:1102:### vsm-loop-specific S2 rules
nix/pkg/llm-skills/skills/vsm-loop/content.md:1108:- **Recursive vsm-node subagents get their own ledger
nix/pkg/llm-skills/skills/vsm-loop/content.md:1166:- `./docs/research/research-<name>.md` — research-loop ledgers
nix/pkg/cq-assets/agents/investigate-explorer.md:15:> This is the read-only role of the research-loop architecture (decision **K8**,
nix/pkg/cq-assets/agents/investigate-explorer.md:60:with a `[correct]`/`[incorrect]` prefix (the research-loop E-item convention), and
nix/pkg/cq-assets/commands/cq/investigate/advance.md:21:  each prefixed `[correct]`/`[incorrect]` (the research-loop E-item convention);
```
