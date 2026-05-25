# cq — Web UI for the Claude Agent SDK

> **Invocation.** Run this work under the [[vsm-loop]] discipline. Treat the
> body of this file as the metasystem brief (S5 → S4): your first action is
> to spawn a planning subagent (G2a), get an adversarial review (G2b),
> commit the accepted plan to `./tasks.md`, and then drive the ledger.
> Do **not** start writing code before the plan exists and is reviewed.
>
> Use [[resilient-ws-ui]] for the WebSocket layer (client *and* server),
> end-to-end. Every item on its Part 3 bringup checklist must be reflected
> in the plan and ticked off in the implementation.
>
> Use **codegraph** (the SQLite knowledge graph already available in this
> environment) to navigate the codebase you are building — call
> `codegraph_context`, `codegraph_trace`, `codegraph_callers` etc. before
> reaching for raw `grep`/`Read` loops. The index is sub-millisecond and
> always one second behind the file watcher.

---

## 1. Goal (one sentence)

Build **cq**, a TypeScript web application that lets the user drive the
Claude Agent SDK from a browser tab over WebSocket, replicating the
Claude CLI experience faithfully, with a second tab that surfaces the
full history of sub-agent invocations in human-readable form.

## 2. Why

The user runs this behind their own VPN and wants to use their Claude
agent from any device with a browser. The current CLI is terminal-only.
cq removes the terminal dependency without losing fidelity.

## 3. Hard constraints (non-negotiable)

- **Language**: TypeScript throughout. Strict mode. No `any` except at
  external-library boundaries with a justifying comment.
- **Runtime / package manager / bundler / test runner**: **Bun**. Use
  `bun:sqlite`, `Bun.serve` with WebSocket handler, `bun test`, and
  Bun's built-in bundler for the frontend. Node-shaped APIs only where
  Bun does not yet cover the surface.
- **Frontend framework**: **React** + TypeScript. Functional components,
  hooks, no class components. Pick one styling approach (CSS modules,
  vanilla-extract, or Tailwind) in the plan and stick to it.
- **Agent SDK**: `@anthropic-ai/claude-agent-sdk` (latest stable; check
  `npm view` at plan time). The server orchestrates the SDK; the
  browser never imports it.
- **Transport**: WebSocket *only* between browser and server. No HTTP
  endpoints for application data. Static assets (HTML/JS/CSS) may be
  served over HTTP from the same Bun process.
- **Authentication**: none. The server binds to the user's VPN
  interface (address configurable). Do **not** add token auth, CORS
  permissiveness, or login flows; they are out of scope and would
  imply a security posture the deployment does not need.
- **Single active session at a time.** A new chat replaces the current
  one (with confirmation if the current is mid-stream). The session
  pool size is exactly 1.
- **Working directory is fixed at server startup** via CLI flag
  (`--cwd <path>`, default: `process.cwd()`). The UI displays it
  read-only. No directory picker.
- **Host capabilities forwarded to the agent**:
  - **MCP servers** configured in the user's `~/.claude/` config are
    forwarded to each SDK query (so e.g. `codegraph` is available
    inside cq exactly as in CLI).
  - **Skills** from `~/.claude/skills/` are surfaced so slash commands
    like `/vsm-loop` work in cq the way they work in CLI.
  - Plugins and hooks are **out of scope** for v1.
- **Two tabs in the UI**, no more for v1: **Chat** and **History**.
- **No telemetry, no analytics, no remote logging.** Local log files
  only.

## 4. The Chat tab — what "replicate CLI experience" means

The browser must render every kind of event the Agent SDK can emit,
with first-class affordances for each. Treat this list as the
acceptance set; the plan's milestones must cover all of it.

### Input
- Multi-line text input. **Cmd/Ctrl+Enter** sends; **Shift+Enter** inserts
  a newline; **Esc** clears focus.
- Slash-command autocomplete: typing `/` opens a popover listing
  available slash commands (built-ins + skills + user skills) with
  fuzzy match.
- Paste-image support (clipboard images forwarded to the SDK as
  attachments). Drag-and-drop file attach.
- Stop / interrupt button (sends `AbortController.abort()` server-side
  and emits a cancellation event back).

### Streaming output
- Assistant text streams token-by-token (markdown reflowed
  incrementally — do not buffer until end-of-message).
- Full Markdown rendering: GFM tables, task lists, fenced code,
  blockquotes, footnotes, math (optional).
- Code blocks: syntax highlighting (Shiki recommended for Bun
  compatibility), copy-to-clipboard, language label.
- File-reference rendering: `path:line` strings become anchors that
  expand to show a few lines of context (read on demand from the
  fixed cwd).

### Tool calls (first-class UI)
Each tool call is a card with: tool name, collapsible parameter
preview (JSON-pretty), and a result region that fills when the tool
returns. Cards must distinguish:
- **Read / Write / Edit**: show a diff when Edit, content preview
  when Write, snippet when Read.
- **Bash**: show command, stdout, stderr, exit code; mark
  `run_in_background` distinctly.
- **Grep / Glob / find**: show pattern and match count, expandable
  to full hits.
- **WebFetch / WebSearch**: show URL/query and a snippet.
- **TaskCreate / TaskList / TaskUpdate**: render as a live to-do
  list pinned in the sidebar of the chat.
- **AskUserQuestion**: render as an interactive form with the actual
  radio/checkbox/preview UI; the user's answer is posted back over
  WebSocket and resolves the tool call.
- **EnterPlanMode / ExitPlanMode**: render plan content distinctly
  (banner + plan text); ExitPlanMode shows the approval choice if
  the SDK requests it.
- **Task / Agent (sub-agent invocation)**: render as a *nested* card
  showing the spawned agent's name, brief, model, and a live
  collapsible feed of its own stream. The sub-agent's transcript
  is fully captured (this is what powers the History tab).

### Thinking blocks
Extended-thinking content is collapsed behind a "Thinking…" disclosure
with a token count; expanded view shows the thinking content rendered
as markdown.

### Permission prompts (when not in YOLO)
When the SDK requests permission for a tool call, render the prompt
inline with Allow / Deny / Allow-once buttons; the choice is forwarded
back over WebSocket.

### Session header / sidebar
- Working directory (read-only).
- Model selector (Opus / Sonnet / Haiku family).
- Permission mode toggle (yolo / standard / plan / read-only).
- Live token + cost counters.
- Session id, started-at, duration.
- "New session" button (with confirm if mid-stream).
- "Resume from history" entry-point (opens a picker that lists prior
  sessions; selecting one loads the transcript and the SDK is
  re-instantiated with that session's resume id where possible).

### Slash commands
At minimum: `/help`, `/clear` (new session), `/cwd` (show cwd),
`/model`, `/cost`, plus dynamic enumeration of user/project skills.
Slash commands run server-side via the SDK; the UI only forwards them.

## 5. The History tab

### Data model
Persistent SQLite database (`bun:sqlite`). Two primary tables (planner
may refine):

- **session** — one row per top-level chat: id, started_at, ended_at,
  cwd, model, permission_mode, total_input_tokens,
  total_output_tokens, total_cost_usd, ended_reason (completed /
  interrupted / errored), title (first user message, truncated).
- **invocation** — one row per *sub-agent* invocation inside a
  session (Task / Agent tool calls): id, session_id, parent_invocation_id
  (sub-agents can nest), agent_name (e.g. `Explore`, `claude-code-guide`,
  `general-purpose`, or `main` for the top-level), model, started_at,
  ended_at, duration_ms, status, tool_call_count,
  input_tokens, output_tokens, cost_usd, prompt_excerpt (truncated).

Sub-agent invocations are captured via the Agent SDK's message-stream
events (`subagent_start` / `subagent_stop`, or the Task tool's
sub-stream — verify the exact mechanism during planning by reading
the SDK source under `node_modules/@anthropic-ai/claude-agent-sdk`).
Hooks are an acceptable fallback.

A separate table (or message log) stores the full ordered event
stream per invocation so the drill-down view can re-render the
transcript exactly. JSONL on disk keyed by invocation id is also
acceptable; the planner chooses.

### List view
A table (or virtualized list — there can be thousands of rows) with
columns: **When**, **Agent**, **Model**, **Duration**,
**Tool calls**, **Status**, **Cost**, **Parent session** (with hover
preview of the parent's first message). Sortable, filterable
(by agent name, model, status, date range, parent session). A
search box does full-text search over prompt excerpts.

### Detail view (on row click)
Same rendering pipeline as the Chat tab — the goal is that a row
click takes you to a read-only transcript indistinguishable from a
live chat, scrolled to the relevant invocation. Includes:
- Header: agent name, parent session id, model, started/ended,
  duration, tokens, cost, working directory.
- Full transcript with the same markdown / tool-card / sub-agent-nest
  rendering as Chat.
- Timing strip: a horizontal time-axis showing where each tool call
  sat in the invocation's wall-clock duration.
- "Open parent session" navigation (since sub-agents nest).

### Export
"Copy as Markdown" and "Download as JSON" buttons on the detail view.

### Retention
No automatic deletion in v1. Add a "Delete invocation" / "Delete
session" action with a confirmation dialog.

## 6. WebSocket layer — apply [[resilient-ws-ui]] verbatim

Both the **server** (`Bun.serve` websocket handler) and the **client**
(`new WebSocket(...)` wrapper) must implement the full bringup
checklist in [[resilient-ws-ui]] Part 3. In particular:

- **Reliability**: nonce-correlated heartbeat both ways; 4-state
  machine (`NEW/ALIVE/STALE/DEAD`); overlapping-connection failover
  during `STALE` grace; full-jitter backoff with cap and terminal
  state; close-code classification; time-jump detector; Page Lifecycle
  wiring (`visibilitychange`, `freeze`/`resume`, `pagehide`/`pageshow`,
  `online`/`offline`); deferred reconnect while hidden;
  `setImmediate`-deferred server termination; destroyed-flag re-entry
  guard.
- **Indicator**: one compact widget in a stable location, derived
  (not stored) state, two non-color channels, countdown ring, ≈10 Hz
  throttled rAF + event-push, expanded tooltip with pool + RTT windows
  + loss% + backoff state + last close reason, `document.title` state
  mirror, bounded event log, never-lie labelling.

The skill's reference implementation is at
`https://github.com/pshirshov/ws-reconnect-demo` — read it, port the
patterns, do not copy uncritically. Adapt the protocol layer to cq's
message envelopes.

### Wire protocol shape (sketch — planner finalizes)

Every frame is a JSON envelope validated by Zod schemas shared between
client and server. Top-level discriminator on `type`. Examples:

```
client → server
  hb.ping        { nonce, clientTs }
  chat.start     { model, permissionMode }
  chat.input     { text, attachments?, replyToInvocationId? }
  chat.interrupt {}
  chat.permission_reply { invocationId, decision }
  chat.question_reply { invocationId, answers }
  history.list   { filter, sort, page, pageSize }
  history.get    { sessionId | invocationId, replay? }

server → client
  hb.pong        { nonce, clientTs, serverTs }
  chat.event     { sessionId, invocationId?, ...sdkEvent }
  chat.usage     { sessionId, tokens, costUsd }
  chat.done      { sessionId, reason }
  chat.error     { sessionId, code, message }
  history.list_result   { ... }
  history.get_result    { ... }
  history.update        { invocationId, patch }   // live updates while chat runs
```

Use sequence numbers per session so a reconnect can resume mid-stream
without dropping events (if the SDK supports it; otherwise the client
re-fetches via `history.get`).

## 7. Quality bar

- **Repository layout**: monorepo with shared types. Suggested:
  `packages/shared` (Zod schemas, protocol types), `packages/server`
  (Bun + SDK + WebSocket), `packages/web` (React app). One root
  `package.json` with Bun workspaces. The planner may flatten this
  if it has a reason.
- **Strict TypeScript** everywhere. `noUncheckedIndexedAccess: true`.
  `exactOptionalPropertyTypes: true`.
- **Schema validation** at every WebSocket boundary (Zod). Reject
  malformed frames with a close code in the 1007/1008 range.
- **Tests** (Bun test):
  - Unit tests for the protocol layer (Zod schemas round-trip).
  - Unit tests for the connection state machine (drive it through
    NEW→ALIVE→STALE→DEAD transitions; pong recovery; time-jump).
  - Unit tests for the history persistence layer (insert, query,
    filter, paginate).
  - One end-to-end test that boots the server, opens a real
    WebSocket, runs a tiny SDK query against a stub model
    (mock the Anthropic API at the HTTP level), and asserts that
    the chat events round-trip and that the invocation lands in
    SQLite.
- **No silent error swallowing.** Validate at boundaries; assert
  internally; surface failures in the UI's connection indicator and
  in a bounded toast log.
- **Logging**: structured (JSON lines) to a file under
  `./var/log/cq-YYYYMMDD.log`, with levels. Quiet at info, verbose at
  debug.
- **Graceful shutdown**: SIGTERM/SIGINT drain in-flight SDK queries
  (abort + flush) and close WebSocket sockets with a `1012 Service
  Restart` code so clients schedule a fast reconnect.
- **Reproducible startup**: a single `bun run start --cwd <dir>
  [--host <addr>] [--port <n>]` command brings the whole thing up;
  `bun run dev` does the same with HMR for the React app.

## 8. Suggested milestone outline (planner refines)

This is *suggestion only* — the planner subagent (G2a) breaks it down
properly. Listed so the adversarial reviewer has something concrete
to attack.

- **M0 — Bring-up.** Repo skeleton, Bun workspaces, TypeScript
  configs, lint/format, Zod, shared protocol package, one passing
  smoke test, README with run instructions.
- **M1 — WebSocket spine.** Server with `Bun.serve` WebSocket
  handler, client wrapper, full [[resilient-ws-ui]] reliability +
  indicator implementation. End-to-end test exercises freeze, IP
  change (simulated), and reconnect.
- **M2 — Agent SDK integration (Chat MVP).** Server bridges
  WebSocket ↔ SDK; one-shot user message produces streamed
  assistant output. Markdown rendering, code blocks, basic tool
  cards (Read/Write/Edit/Bash). New session, interrupt, model
  selector.
- **M3 — Chat full fidelity.** Sub-agent nested cards;
  AskUserQuestion interactive UI; permission prompts; plan mode;
  thinking blocks; slash-command autocomplete; attachments; usage
  counters; resume-from-history.
- **M4 — Persistence + History tab.** SQLite schema, write path
  during live sessions, list view with filter/sort/search, detail
  view sharing Chat's renderer, timing strip, export.
- **M5 — Polish & harden.** Graceful shutdown, structured logs,
  error toasts, accessibility pass, end-to-end test suite, README,
  one screenshot per tab.

Each milestone must end with: green tests, clean type check, a
committed `./tasks.md` archive, and a working build.

## 9. References the planner must read before G2a

- `@anthropic-ai/claude-agent-sdk` source under `node_modules/` once
  installed. Specifically: the message types, the hooks interface,
  the abort/cancel semantics, and how Task/sub-agent invocations
  surface in the stream.
- [[resilient-ws-ui]] full SKILL.md.
- The reference implementation at
  `https://github.com/pshirshov/ws-reconnect-demo`.
- Bun docs for `Bun.serve` (WebSocket handler shape) and `bun:sqlite`.
- This file (the brief).

## 10. Algedonic carve-outs

Escalate to the user (across the metasystem boundary, per the
[[vsm-loop]] criteria) only on:

- A genuine ambiguity in this brief that the planner cannot resolve
  with a stated reading. Batch via [[question-batch]] if more than
  one.
- A discovered conflict between this brief and a non-negotiable in
  `~/.claude/CLAUDE.md` (e.g. you find you must add auth — you must
  not; escalate instead).
- A finding that the Agent SDK lacks a capability needed for an
  acceptance item (e.g. sub-agent events are genuinely unavailable
  through the public API). Provide alternatives and a recommendation.

Everything else — stack choice within the constraints above, schema
shape, file layout, milestone resequencing, mid-cycle research, mid-
cycle replan — stays inside the loop.

## 11. Stop condition

This brief is discharged when:

- All five milestones are `[x]` in `./tasks.md` and migrated to
  `./docs/archive/tasks-Mx.md`.
- `bun test` passes; type check is clean.
- `bun run start --cwd <some-real-dir>` launches the server; opening
  the browser to the indicated URL renders the Chat tab, starts a
  session, runs a sample prompt (e.g. "list files in cwd"),
  streams the response with tool cards, and the resulting
  invocation appears in the History tab with a working drill-down.
- The session log under `./docs/logs/` records the final metrics
  line per the [[vsm-loop]] dashboard format.

Begin with G1 — read this brief, run codegraph status if useful, then
spawn the planning subagent.
