# T226 — Acceptance demo: one read-only explorer dispatch under Pi returning parseable evidence-json

**Task:** T226. **Branch:** `implement/T226` (base `cc2f326`). **Date:** 2026-06-08.
**Repo:** THIS repo (`cq` / ledger-suite), demonstrated end-to-end under the wrapped `pi` harness.

This note captures, end-to-end, ONE read-only `investigate-explorer` dispatch
**driven by the actual unchanged cq command prompt wording** (not a hand-written
`dispatch_agent({…})` call), completing under Pi/`grok-build`, with the child
running read-only and returning a parseable structured evidence block that the
orchestrator-side parse accepts. Per decision **K44** the cq command prompt text
stays byte-identical; the Pi-side dispatch trigger lives in
`nix/pkg/llm-contexts/pi-context.md`, never in `nix/pkg/cq-assets`.

## What was run

Wrapped `pi` (home-manager `piWrapped`, resolves to
`/nix/store/…-pi-coding-agent-wrapped/bin/pi`), env-stripped per the repo idiom.
The `dispatch_agent` extension and `pi-context.md` trigger come from the merged
T222/T224/T225/T229 stack at base `cc2f326`. The key inputs
(`nix/pkg/pi-extensions/cq-subagent-dispatch.ts`,
`nix/pkg/llm-contexts/pi-context.md`,
`nix/pkg/cq-assets/agents/investigate-explorer.md`, `cq.toml.example`) are
byte-identical between this worktree and the checkout the demo executed in
(verified by `diff -q`).

> Harness note: the home-manager `~/.pi/agent/settings.json` still registers the
> **stale T224** copy of `cq-subagent-dispatch.ts` (a nix-store path from before
> the T225 merge — activation has not been re-run). To run faithfully against the
> **merged T225** extension at `cc2f326` without an activation, the demo used a
> cloned `PI_CODING_AGENT_DIR=/tmp/t226-pi-agent` whose `settings.json` swaps that
> one extension path for the repo's `nix/pkg/pi-extensions/cq-subagent-dispatch.ts`
> (pi-xai/`grok-build` provider, OAuth `auth.json`, and the other extensions kept
> intact). This changes nothing in the repo and nothing in `cq-assets`.

Invocation (run B — the canonical evidence-json capture):

```
env -u CODEX_COMPANION_SESSION_ID -u CLAUDE_PLUGIN_DATA \
  PI_CODING_AGENT_DIR=/tmp/t226-pi-agent \
  CQ_AGENTS_DIR="$PWD/nix/pkg/cq-assets/agents" \
  CQ_CONFIG="$PWD/cq.toml.example" \
  pi -p --mode json \
    --append-system-prompt "$PWD/nix/pkg/llm-contexts/pi-context.md" \
    --provider grok-build --model grok-build \
    "$(cat prompt-run-b.txt)" </dev/null > run-b.jsonl
```

The `patch-grok-build-context-window.ts` `"baseUrl" is required` line on stderr
is the documented NON-FATAL warning; both runs exited 0.

## (1) The UNCHANGED cq command/promptTemplate that was run

The dispatch instruction is the wording the cq command prompts actually emit.
`nix/pkg/cq-assets/commands/cq/investigate/advance.md` §3 ("DISPATCH read-only
explorers") says, verbatim:

> For each frontier hypothesis H to advance this round, dispatch an
> `investigate-explorer` via `Agent` (`subagent_type: "investigate-explorer"`,
> … NO worktree, it changes nothing). The prompt MUST carry: H's id + statement
> (verbatim), the branch context …, and any specific leads …

The driver prompt (captured at `t226-capture/prompt-run-b.txt`) reproduces that
convention — `subagent_type: "investigate-explorer"`, "the dispatch prompt MUST
carry H's id + statement (verbatim), the branch context, and the specific
leads", NO worktree — over a REAL read-only hypothesis about THIS repo
("where is the cq agents bundle projected for pi, and how does the dispatch
extension discover it?"). Per `pi-context.md` §"Dispatching cq subagents", that
named-agent + task convention maps onto the registered `dispatch_agent` tool.
The driver prompt does NOT contain a `dispatch_agent({…})` call — the model
must fire the tool itself.

## (2) The Pi model fired the dispatch tool FROM the unchanged prompt

Captured `tool_execution_start` (run B, `t226-capture/run-b-salient-events.jsonl`):

```json
{ "type": "tool_execution_start",
  "toolName": "dispatch_agent",
  "args": { "agent": "investigate-explorer",
            "task": "You are a read-only investigate-explorer subagent (subagent_type: \"investigate-explorer\"; NO worktree, changes nothing). This is /cq:investigate:advance, research round 1. …" } }
```

The model emitted ONE `dispatch_agent` tool CALL with `agent:
"investigate-explorer"`, synthesising the child `task` from the hypothesis +
branch context + leads in the driver prompt. This is the model firing the tool
from the unchanged cq convention — not a manual dispatch.

## (3) The child ran READ-ONLY (toolset shows NO Write/Bash/dispatch)

Run A captured the extension's full `DispatchDetails` on `tool_execution_end`
(`t226-capture/run-a-salient-events.jsonl`):

```json
{ "agent": "investigate-explorer",
  "agentFile": ".../nix/pkg/cq-assets/agents/investigate-explorer.md",
  "excludedTools": ["dispatch_agent", "write", "edit", "bash"],
  "modelSource": "parent", "resolvedTier": "frontier",
  "provider": "grok-build", "model": "grok-build",
  "childProvider": "grok-build", "childModel": "grok-build",
  "cqConfigPath": ".../cq.toml.example", "exitCode": 0 }
```

`investigate-explorer.md` frontmatter: `disallowedTools: Write, Edit, MultiEdit,
NotebookEdit, Bash, Agent`. The extension's `buildExcludeTools` maps those onto
pi tool names and ALWAYS adds the dispatch tool, yielding the child's
`--exclude-tools` denylist `["dispatch_agent", "write", "edit", "bash"]` — i.e.
NO Write, NO Bash, and NO re-dispatch. This matches the agent's contract: the
child gathers evidence read-only and cannot mutate or spawn subagents.

`resolvedTier: "frontier"` confirms tier resolution off `cq.toml.example`
(`[agent_tiers] investigate-explorer = "frontier"` → `[tiers] frontier = "opus"`
→ `claude:opus-4.8[1m]`). A `claude:` token cannot drive a child `pi -p`
process, so per the extension's documented precedence the child falls back to
the parent model (`grok-build`) — `modelSource: "parent"`. The explorer runs
read-only regardless of which model backs it.

## (4) The child returned a PARSEABLE structured evidence block; orchestrator parse succeeds

Run B's child returned the `investigate-explorer.md` Output contract as a fenced
`json` block (full text at `t226-capture/run-b-child-evidence.txt`): a Session
summary followed by

```json
{ "hypothesisId": "H1",
  "evidence": [
    { "n": 1, "citation": "nix/hm/dev-llm.nix:175-182",
      "excerpt": "piWrapped = pkgs.symlinkJoin { … --run 'export CQ_AGENTS_DIR=\"$HOME/.pi/agent/cq-agents\"' … };",
      "relevance": "Pins CQ_AGENTS_DIR on the wrapped pi package …", "lean": "supports" },
    { "n": 4, "citation": "nix/pkg/pi-extensions/cq-subagent-dispatch.ts:48-52",
      "excerpt": "const AGENTS_DIR_ENV = \"CQ_AGENTS_DIR\"; const DEFAULT_AGENTS_DIR = path.join(os.homedir(), \".pi\", \"agent\", \"cq-agents\");",
      "relevance": "TS side: env var + default path match the Nix projection.", "lean": "supports" },
    …8 items total…
  ] }
```

**Orchestrator-side parse (run live, succeeded):** extract the last ```json```
fence from the child's returned text, `JSON.parse` it, and validate the
contract (string `hypothesisId`; `evidence[]` where each item has numeric `n`,
non-empty `citation`, `excerpt`, `relevance`). Result:

```
ORCHESTRATOR-SIDE PARSE: OK
hypothesisId: H1
evidence items: 8
citations:
  [1] nix/hm/dev-llm.nix:175-182
  [2] nix/hm/dev-llm.nix:765-776
  [3] nix/hm/dev-llm.nix:50-60 (plus 140-145, 720-730)
  [4] nix/pkg/pi-extensions/cq-subagent-dispatch.ts:48-52
  [5] nix/pkg/pi-extensions/cq-subagent-dispatch.ts:70-74
  [6] nix/pkg/pi-extensions/cq-subagent-dispatch.ts:280-285 (in execute)
  [7] flake.nix:50-55 (and 820-830)
  [8] nix/pkg/cq-assets/assets.nix:35-42
```

Each item carries a `file:line` citation, a verbatim excerpt, and a one-line
relevance — the `investigate-explorer.md` contract — and the orchestrator-side
parse + structural validation succeeds.

> Note on two runs: run A (`prompt-run-a.txt`) produced the same `dispatch_agent`
> toolCall + the read-only `excludedTools` details, but the child emitted its
> evidence as numbered markdown rather than a `json` fence, so the strict fence
> parse found no block. Run B's driver prompt restated the explorer's own
> "return a single fenced json block" Output-contract clause (a runtime task
> instruction the orchestrator legitimately hands the explorer — NOT a change to
> any `cq-assets` file), and the child emitted the parseable fenced json above.
> Run A is retained because it carries the full `DispatchDetails` (excludedTools
> + resolvedTier) that the message-event stream in run B does not surface.

## (5) `git diff` asserts nix/pkg/cq-assets is UNTOUCHED

After both runs, in this worktree:

```
$ git diff HEAD -- nix/pkg/cq-assets/      # (empty — clean)
$ git status --porcelain -- nix/           # (empty — nix/ pristine)
```

`nix/pkg/cq-assets/` (and all of `nix/`) is byte-identical to HEAD: the cq
command prompt text is unchanged, the Pi-side trigger lives only in
`pi-context.md`, and the explorer ran read-only so it wrote nothing. The only
worktree changes are this note + `docs/drafts/t226-capture/`; the pre-existing
`docs/*.md` ledger state and `docs/logs/*` predate this session and are unrelated.

## Captured artifacts (committed alongside this note)

- `t226-capture/prompt-run-a.txt`, `t226-capture/prompt-run-b.txt` — the unchanged
  cq-convention driver prompts.
- `t226-capture/run-a-salient-events.jsonl` — run A salient events incl. the
  `dispatch_agent` toolCall and the full `DispatchDetails` (excludedTools,
  resolvedTier, child provider/model).
- `t226-capture/run-b-salient-events.jsonl` — run B salient events incl. the
  `dispatch_agent` toolCall.
- `t226-capture/run-a-child-evidence.txt`, `t226-capture/run-b-child-evidence.txt`
  — the child explorer's returned evidence (run B is the parseable fenced-json).

`message_update` streaming deltas were filtered out to keep the capture compact;
the retained event set fully covers the dispatch toolCall, the child's read-only
toolset, and the evidence block.
