# Plan-flow prompts — single source

These four Markdown files are the **single source of truth** for the plan-flow
slash commands and agents. Both Claude Code and Codex consume them through
symlinks; edit the files HERE, never a symlink.

| `prompts/` source         | Role                                                  |
|---------------------------|-------------------------------------------------------|
| `plan-start.md`           | slash command — start a goal, file first questions    |
| `plan-advance.md`         | slash command — thin planner↔reviewer loop            |
| `plan-advance-agent.md`   | subagent — the planner (one state step)               |
| `plan-reviewer.md`        | subagent — the adversarial reviewer                   |

## Symlink layout

- **Codex** (`.codex/prompts/*`) — these symlinks are **committed**, so a fresh
  clone works for Codex with no extra step.
- **Claude Code** (`.claude/*`) — `.claude/` is **gitignored**, so the symlinks
  are NOT committed. After cloning, run:

  ```sh
  bun run link-prompts
  ```

  This (re)creates, idempotently:

  | Claude link                          | → source                  |
  |--------------------------------------|---------------------------|
  | `.claude/commands/plan/start.md`     | `prompts/plan-start.md`   |
  | `.claude/commands/plan/advance.md`   | `prompts/plan-advance.md` |
  | `.claude/agents/plan-advance.md`     | `prompts/plan-advance-agent.md` |
  | `.claude/agents/plan-reviewer.md`    | `prompts/plan-reviewer.md` |

## No root `AGENTS.md` — deliberate

There is intentionally **no root `AGENTS.md`**. Codex resolves project docs
through `project_doc_fallback_filenames`, and a root `AGENTS.md` would shadow
`CLAUDE.md` for Codex. Keeping `CLAUDE.md` as the sole root project doc means
both tools read the same instructions.
