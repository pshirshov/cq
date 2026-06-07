# T215 G25 Final Gate Verification

**Date:** 2026-06-07  
**Task:** T215 — Verify: Nix build evaluates, skills de-registered, zero dangling references  
**Goal:** G25 — Retire legacy skills (research-loop, vsm-loop, vsm-node, question-batch, review-loop)  
**Branch:** implement/T215  
**Base commit:** 703fa91 (feat(cq-assets): repoint research-loop references to /cq:investigate (T213))

---

## Worktree Verification

The assigned worktree (`agent-acdf2bf2ce2f22088`) was on stale commit `4891fa0` and lacked the
T211-T214 changes. A fresh worktree was created per task instructions:

```
git worktree add /tmp/exchange/wt-T215 -b implement/T215 703fa91
```

Verified HEAD commit:
```
703fa91 feat(cq-assets): repoint research-loop references to /cq:investigate (T213)
```

---

## Check 1: BUILD

### 1a. Nix build

**Command:**
```
nix build .#llm-skills
```

**Output:**
```
warning: Git tree '/home/pavel/work/safe/flakes/cq' is dirty
```

**Exit code:** 0 (SUCCESS)

The `validate-skills.sh` checkPhase passed against the remaining 7 skills. The dirty-tree warning
is expected (the worktree for T215 exists as an untracked path in the working tree); the build
itself succeeded.

### 1b. bun run check

**Command (from `nix/pkg/cq-ledgers/`):**
```
bun install && bun run check
```

**Output (last lines):**
```
 1019 pass
 0 fail
 3305 expect() calls
Ran 1019 tests across 95 files. [69.56s]
```

**Exit code:** 0 (SUCCESS)

TypeScript type-check, ESLint, and full test suite all green.

---

## Check 2: DE-REGISTRATION

**Command:**
```
ls result/skills/
```

**Output:**
```
baboon
constructive-test-taxonomy
dual-tests
environment
izumi
resilient-ws-ui
tass
```

**Result:** PASS — Exactly 7 skills present. The five retired skills (research-loop, vsm-loop,
vsm-node, question-batch, review-loop) are absent from the built result.

---

## Check 3: ARCHIVE

**Command:**
```
ls docs/legacy-skills/
```

**Output:**
```
question-batch.md
README.md
research-loop.md
review-loop.md
vsm-loop.md
vsm-node.md
```

All five `.md` files exist. Meta headers (first 5 lines of each):

**research-loop.md:**
```yaml
---
name: research-loop
status: retired
retired: 2026-06-07
cq-successor: /cq:investigate (and /cq:investigate:advance)
---
```

**vsm-loop.md:**
```yaml
---
name: vsm-loop
status: retired
retired: 2026-06-07
cq-successor: /cq:advance + /cq:plan:advance + /cq:implement:advance + /cq:implement-review flow
---
```

**vsm-node.md:**
```yaml
---
name: vsm-node
status: retired
retired: 2026-06-07
cq-successor: /cq:advance + /cq:implement:advance (implement-flow worker contract)
---
```

**question-batch.md:**
```yaml
---
name: question-batch
status: retired
retired: 2026-06-07
cq-successor: questions-ledger clarification path (create a `questions` item via mcp__ledger__create_item in the `questions` ledger)
---
```

**review-loop.md:**
```yaml
---
name: review-loop
status: retired
retired: 2026-06-07
cq-successor: /cq:advance + /cq:implement:advance + /cq:implement-review flow
---
```

**Result:** PASS — All five archive files exist with YAML front-matter meta headers and bodies.

---

## Check 4: NO DANGLING REFS

**Command:**
```
grep -rn -E 'research-loop|vsm-loop|vsm-node|question-batch|review-loop' nix/
```

**Output:** (empty — no matches)

**Exit code:** 1 (grep exits 1 when no matches found — this is the correct success state)

**Result:** PASS — Zero hits in `nix/`. All surviving mentions of the five skill names are
confined to:
- `docs/legacy-skills/` — the archive files themselves (expected)
- `docs/` ledger files (`docs/milestones.md`, `docs/goals.md`, `docs/questions.md`,
  `docs/handoffs.md`, `docs/reviews.md`) — planning/history records (expected)
- `docs/drafts/20260607-0119-T210-retired-skill-reference-inventory.md` — the T210 inventory
  draft (expected, part of the docs/ history)

No references in `nix/` (source tree), confirming T212 and T213 successfully removed all
production references.

---

## Summary

| Check | Result | Exit Code |
|-------|--------|-----------|
| 1a. `nix build .#llm-skills` | PASS | 0 |
| 1b. `bun run check` (1019 tests) | PASS | 0 |
| 2. `result/skills/` has exactly 7 skills, no retired ones | PASS | — |
| 3. All 5 archive files exist with meta headers | PASS | — |
| 4. `grep -rn` over `nix/` returns zero hits | PASS | 1 (expected) |

**All four checks pass. G25 final gate: GREEN.**
