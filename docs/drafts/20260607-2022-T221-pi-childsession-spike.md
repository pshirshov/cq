# T221 — Go/No-Go Spike: Pi `ExtensionAPI` child-session primitive

**Date:** 2026-06-07
**Task:** T221 (read-only spike)
**Pi version:** 0.78.0
**Resolved package:** `/nix/store/6rqshyyhpv3pjgq465cz49sa7wdgxdi1-pi-coding-agent-0.78.0/lib/node_modules/pi-monorepo`
(resolved via `realpath "$(command -v pi)"` → wrapper → `.pi-wrapped` → store path; `pi-monorepo/package.json` `"name": "@earendil-works/pi-coding-agent"`, `"types": "./dist/index.d.ts"`).

## Verdict: **GO** — all five primitives are present in Pi 0.78.0.

There are **two distinct routes** to spawn a filtered child agent. The spike question
("can Pi's `ExtensionAPI` spawn an isolated child agent turn with a FILTERED toolset
and capture its final output") is answered **YES**, with an important nuance about
*which* surface provides it:

- **Route A (subprocess) — what badlogic's official `subagent` example actually does.**
  It does NOT use an in-process `ExtensionAPI` method. It `spawn`s a fresh `pi`
  subprocess with CLI flags (`--mode json -p --no-session --model … --tools …`) and
  parses the child's stdout JSON event stream. This is the *proven, shipped* mechanism.
- **Route B (in-process SDK) — `createAgentSession`.** The package re-exports a
  programmatic `createAgentSession({ model, tools, excludeTools, customTools })`
  that builds an isolated `AgentSession` in-process; `AgentSession.prompt()` runs a
  turn and `AgentSession.messages` captures output. This is reachable from an
  extension via `import { createAgentSession } from "@earendil-works/pi-coding-agent"`.

The `ExtensionAPI` object passed to an extension factory (the `pi` argument) does
**NOT itself** carry a `spawnChildSession`/`runSubagent` method. The child-session
capability is delivered either by subprocess (Route A) or by importing the SDK
function from the same package (Route B). Both are present and usable; hence GO.

---

## Evidence — five primitives, exact `file:line`

Paths below are relative to the resolved package root
`…/pi-coding-agent-0.78.0/lib/node_modules/pi-monorepo`.

### (1) `pi.registerTool`
- **Typings:** `dist/core/extensions/types.d.ts:816`
  `registerTool<TParams …>(tool: ToolDefinition<…>): void;` on `interface ExtensionAPI`.
  Tool shape: `interface ToolDefinition` at `dist/core/extensions/types.d.ts:328`,
  with `execute(...)` at `:354`.
- **Example (subagent):** `examples/extensions/subagent/index.ts:455`
  `pi.registerTool({ name: "subagent", … })` inside
  `export default function (pi: ExtensionAPI)` at `:454`.
- **Example (structured-output, simplest registerTool):**
  `examples/extensions/structured-output.ts:64` `pi.registerTool(structuredOutputTool);`
- **Note vs. existing extensions:** the two `nix/pkg/pi-extensions/*.ts` only prove
  `registerProvider` + `pi.on` (`patch-grok-build-context-window.ts:70-74`).
  `registerTool` is NOT exercised there; the citations above close that gap.

**CONFIRMED.**

### (2) Spawn a child session with its OWN context + a FILTERED toolset (child cannot see the dispatch tool)
- **Route A — subprocess (shipped example):**
  `examples/extensions/subagent/index.ts:329`
  `const proc = spawn(invocation.command, invocation.args, { cwd, shell:false, stdio:["ignore","pipe","pipe"] });`
  Each invocation is a *separate `pi` process* → its own isolated context window
  (README `subagent/README.md:7` "Each subagent runs in a separate `pi` process").
  Tool filtering is passed as `--tools` (see primitive 3). Because the child is a
  fresh `pi -p` process loaded from the agent definition's declared tool list, it
  does **not** inherit the parent's `subagent` tool unless that agent's frontmatter
  lists it — enforcing "subagents cannot spawn subagents" by tool allowlist.
- **Route B — in-process SDK (`createAgentSession`):**
  `dist/core/sdk.d.ts:108`
  `export declare function createAgentSession(options?: CreateAgentSessionOptions): Promise<CreateAgentSessionResult>;`
  re-exported from the package root at `dist/index.d.ts:16` (`… createAgentSession …`
  from `./core/sdk.ts`). Each call builds a distinct `AgentSession`
  (`CreateAgentSessionResult.session: AgentSession`, `dist/core/sdk.d.ts:61`) with its
  own `sessionManager`/context (`SessionManager.inMemory()` shown in the doc example
  `dist/core/sdk.d.ts:104`).

**CONFIRMED** (two independent mechanisms).

### (3) Filtered toolset (allowlist / denylist)
- **Route A — subprocess:** `examples/extensions/subagent/index.ts:290`
  `if (agent.tools && agent.tools.length > 0) args.push("--tools", agent.tools.join(","));`
  The per-agent tool list comes from the agent markdown frontmatter
  (`subagent/agents.ts:58-61`, `tools` parsed from comma-separated frontmatter).
- **Route B — in-process SDK:** `dist/core/sdk.d.ts:44`
  `tools?: string[];` ("When provided, only the listed tool names are enabled"),
  plus `excludeTools?: string[];` at `dist/core/sdk.d.ts:45` (denylist applied after
  `tools`), plus `noTools?: "all" | "builtin"` at `:36`. A denylist of `["subagent"]`
  (or simply omitting it from the allowlist) prevents the child from seeing the
  dispatch tool — i.e. enforces subagents-cannot-spawn-subagents in-process too.

**CONFIRMED.**

### (4) Pin the child's model / provider
- **Route A — subprocess:** `examples/extensions/subagent/index.ts:289`
  `if (agent.model) args.push("--model", agent.model);`
  Model id comes from agent frontmatter (`subagent/agents.ts:67`, `model: frontmatter.model`).
- **Route B — in-process SDK:** `dist/core/sdk.d.ts:21`
  `model?: Model<any>;` ("Model to use"), with `thinkingLevel?` at `:23` and
  `scopedModels?` at `:25`. (Resolve a concrete `Model` via `getModel('anthropic',
  'claude-opus-4-5')` as shown in the `createAgentSession` doc example at
  `dist/core/sdk.d.ts:82-85`.)

**CONFIRMED.**

### (5) Capture the child's final text / structured output
- **Route A — subprocess:** `examples/extensions/subagent/index.ts:345-365`
  parses the child's stdout `--mode json` stream; on `event.type === "message_end"`
  it pushes `event.message` into `currentResult.messages` (`:345-347`). Final text is
  extracted by `getFinalOutput(messages)` at `:164-174` (walks back to the last
  `assistant` message and returns its first `text` part). Structured details are
  carried in tool-result `details` (the example consumes the child's `--mode json`
  stdout stream end-to-end, per `examples/extensions/subagent/index.ts:345-365`).
- **Route B — in-process SDK:** run a turn with `AgentSession.prompt(text, options?)`
  (`dist/core/agent-session.d.ts:326`) and read the conversation via the
  `get messages(): AgentMessage[]` accessor (`dist/core/agent-session.d.ts:289`);
  the last assistant message's text is the final output. `AgentSession` and its
  `PromptOptions` are re-exported from the package root at `dist/index.d.ts:3`.
  For structured output specifically, the `structured-output.ts` example shows a
  terminating tool result with typed `details` (`examples/extensions/structured-output.ts:34-43`,
  `terminate: true`).

**CONFIRMED.**

---

## Cross-check against the existing repo extensions
`nix/pkg/pi-extensions/patch-grok-build-context-window.ts:1` and
`drop-client-web-search-for-grok.ts` import
`import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";` and use only
`pi.on(...)` + `pi.registerProvider(...)`. They confirm the import idiom and the
factory signature `export default function (pi: ExtensionAPI)` but do **not** prove
`registerTool` or any child-session path — exactly the gap T221 was asked to close.
The citations above close it: `registerTool` is at `types.d.ts:816` and is exercised
in `subagent/index.ts:455` and `structured-output.ts:64`.

## Implication for the mechanism lock (Q125 / Q130)
GO does **not** reopen Q125/Q130. All five primitives are present in 0.78.0. The one
design decision the implementer must make explicit is **Route A vs Route B**:

- **Route A (subprocess, `--mode json`)** is the *proven, upstream-blessed* path
  (it is literally the shipped `examples/extensions/subagent`), at the cost of process
  spawn overhead and stdout JSON parsing.
- **Route B (`createAgentSession`)** is lighter-weight (in-process, no JSON
  round-trip, direct `AgentSession.messages` capture) but is a broader SDK surface
  reached by importing the package — not a method on the `pi` `ExtensionAPI` object —
  so it carries more coupling to internal SDK shape and lifecycle.

Recommendation for the follow-on implementation task: prefer **Route A** to mirror
the upstream example (lowest risk, matches `subagent/index.ts` line-for-line), and
treat Route B as an optimization only if subprocess overhead proves material.

## Reproduction / how to re-verify
```
realpath "$(command -v pi)"                 # → …/pi-coding-agent-wrapped/bin/pi
# follow .pi-wrapped symlink → /nix/store/6rqshyyhpv3pjgq…-pi-coding-agent-0.78.0
P=/nix/store/6rqshyyhpv3pjgq465cz49sa7wdgxdi1-pi-coding-agent-0.78.0/lib/node_modules/pi-monorepo
sed -n '785,939p'  $P/dist/core/extensions/types.d.ts   # ExtensionAPI incl. registerTool:816
sed -n '11,108p'   $P/dist/core/sdk.d.ts                # CreateAgentSessionOptions + createAgentSession:108
sed -n '288,365p'  $P/examples/extensions/subagent/index.ts  # spawn:329, --model:289, --tools:290, capture:345
```
