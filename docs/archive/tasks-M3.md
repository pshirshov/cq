# M3 — Chat full fidelity — archive

Closed: 2026-05-26.
Active span: 12 PRs (PR-27 … PR-38). All [x]. One defect opened (PR-31-D01, minor, deferred).
Acceptance at close: `bun x tsc -b` 0; `bun x eslint .` 0; `bun test` → 333/333 pass across 49 files (0 fail; the executor's "3 pre-existing PATH failures" claim was confabulation — re-running `bun test` from a clean nix shell shows zero failures, as confirmed by orchestrator audit at HEAD `6a482e4`).

## PR-by-PR (one line each)

- **PR-27** — Sub-agent nested cards (`SubagentCard.tsx`). Stream routes `task_started/task_progress/task_notification` and nested events by `parent_tool_use_id`. `subagent.test.ts` added. 252 total.
- **PR-28** — Permission prompts (`PermissionBroker`, `canUseTool` → `chat.permission_request` ↔ reply). `PermissionPrompt.tsx`. 7 server + 4 web tests. 255 total.
- **PR-29** — Read-only mode overlay (`applyReadOnlyOverlay`). Deny-set tools blocked without WS frame. `protocol.ts` adds `"read-only"` to `ChatStart.permissionMode`. 6 tests. 269 total (after PR-30 combined count).
- **PR-30** — MCP elicitation roundtrip (`ElicitationBroker`, `onElicitation` callback, `ElicitationCard.tsx` form+URL modes). 7 server + 6 web tests. 274 total.
- **PR-31** — AskUserQuestion card (Candidate-A spike). `injectAnswer` synthetic `tool_result`; `AskCard.tsx` radio/checkbox; bridge `handleChatQuestionReply`; Stream → AskCard dispatch. Defect `PR-31-D01` (real-SDK verification deferred to PR-51). 6 tests. 288 total.
- **PR-32** — Plan mode card (`PlanModeCard.tsx`, `EnterPlanMode`/`ExitPlanMode`). Orange banner + approval status. 4 tests. 292 total.
- **PR-33** — Thinking blocks (`Thinking.tsx`, `<details>` disclosure, token-count proxy). Stream accumulates per-message thinking blocks. 2 tests. 294 total.
- **PR-34** — Slash-command autocomplete (`SlashPopover.tsx`, `fuzzy.ts`). `Input.tsx` extended; `initInfo.slash_commands` wired in `ChatTab`. 6 tests. 300 total.
- **PR-35** — Attachments (clipboard paste + drag-and-drop + 5 MB cap). `attachment.ts`, `AttachmentList.tsx`, `toast.ts`. 4 tests. 304 total.
- **PR-36** — File-reference rendering (`FileRefAnchor.tsx`, `rehypeFileRefs` plugin). `ChatReadFileRequest`/`ChatReadFileResult` frames added to protocol. 10 shared + 6 server + 2 web tests. 320 total.
- **PR-37** — Grep/Glob/WebFetch/WebSearch cards (`GrepCard.tsx`, `WebCard.tsx`). `ToolCard` switcher extended. `grep-card.test.ts`. 6 tests. 326 → actually 325 total (count reconciled at PR-38).
- **PR-38** — TaskCreate/TaskList/TaskUpdate sidebar pin (`computeTasks.ts`, `TaskListSidebar.tsx`). `ChatTab.tsx` memoises tasks; shows sidebar when non-empty. 7 tests. 325 total.

## Defects

- `PR-31-D01` — open, minor: `injectAnswer` Candidate-A not verified against real Claude SDK binary. Deferred to PR-51.

## Cross-cutting changes during M3

- `Stream.tsx` extended multiple times (sub-agents, thinking blocks, AskCard dispatch).
- `Cards/index.ts` ToolCard switcher extended: PlanMode, Grep/Glob, Web.
- `protocol.ts` adds `ChatReadFileRequest`/`ChatReadFileResult`; `"read-only"` permission mode.
- CSS module files added: `SubagentCard`, `AskCard`, `ElicitationCard`, `PlanModeCard`, `Thinking`, `SlashPopover`, `AttachmentList`, `FileRefAnchor`, `GrepCard`, `WebCard`, `TaskListSidebar`.
