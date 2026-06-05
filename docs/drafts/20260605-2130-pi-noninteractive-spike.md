# SPIKE T169 — `pi` non-interactive invocation contract

**Goal G15. Date: 2026-06-05. Sandbox: cq dev shell (`pi` on PATH).**

De-risking spike (Q90) run BEFORE any reconciliation work depends on the
pi-shellout mechanism. Question: can `pi` be driven non-interactively to emit a
parseable result for (a) grok-build and (b) gpt-5.5 via openai-codex, with clean
(escape-free) stdout, and is auth already present?

## TL;DR — FINDING: YES, pi is non-interactively drivable for both providers

- `pi --print` / `pi -p` is the non-interactive mode ("process prompt and exit").
- Both target providers are **already authenticated** (OAuth tokens present in
  `~/.pi/agent/auth.json`): `grok-build` and `openai-codex`. No login step needed.
- **Text mode stdout is byte-clean** — exactly the model's reply text plus a
  trailing `\n`, **no ANSI/TUI escape codes**. The fixed JSON object was
  extracted directly with `jq` (no escape-stripping required).
- Provider+model are selected per-invocation on the CLI, either as two flags
  (`--provider P --model M`) or a single combined flag (`--model P/M`).
- Reproducible: re-running the documented command yields the same parseable JSON.

## Environment facts

- `pi` resolves to `/etc/profiles/per-user/pavel/bin/pi`, version **0.78.0**.
- Config home is `~/.pi/agent/` (NOT `~/.config/pi`). `settings.json` there is a
  symlink to the home-manager store output; it sets
  `defaultProvider = "grok-build"`, `defaultModel = "grok-build"`.
- `~/.pi/agent/auth.json` (mode 0600) holds OAuth entries for three providers:
  `openai-codex`, `github-copilot`, `grok-build` — each with `access`/`refresh`/
  `expires`. So both spike targets are pre-authenticated; no `/login` needed.
- `pi --list-models` confirms the exact model IDs:
  - `grok-build` provider → model `grok-build` (context 256K).
  - `openai-codex` provider → model `gpt-5.5` (context 272K).

## Relevant `pi --help` flags

```
--print, -p          Non-interactive mode: process prompt and exit
--provider <name>    Provider name (default: google; here overridden to grok-build via settings)
--model <pattern>    Model pattern or ID (supports "provider/id" and ":<thinking>")
--mode <mode>        Output mode: text (default), json, or rpc
--no-tools, -nt      Disable all tools (built-in and extension)
--no-session         Don't save session (ephemeral)
--api-key <key>      API key (defaults to env vars / stored auth)
```

## Provider+model selection (two equivalent forms)

1. Separate flags: `--provider grok-build --model grok-build`
2. Combined:       `--model grok-build/grok-build`  (the `provider/id` form;
   no `--provider` needed). Verified the combined form for openai-codex too.

Omitting both flags uses the settings defaults → resolves to
`grok-build/grok-build` (confirmed via the JSON-mode `message_start` event,
which reports `provider:"grok-build", model:"grok-build"`).

## (a) grok-build — EXACT command line (text mode, recommended)

```sh
pi -p --no-tools --no-session \
   --provider grok-build --model grok-build \
   'Reply with ONLY this JSON on one line, no markdown, no code fence: {"ok":true,"n":42}'
```

Raw stdout (od -c shows no escapes):

```
{   "   o   k   "   :   t   r   u   e   ,   "   n   "   :   4   2   }  \n
```

i.e. exactly:

```
{"ok":true,"n":42}
```

`jq -c .` on that stdout parses cleanly → `{"ok":true,"n":42}` (PARSE_OK).

## (b) gpt-5.5 / openai-codex — EXACT command line (text mode, recommended)

```sh
pi -p --no-tools --no-session \
   --provider openai-codex --model gpt-5.5 \
   'Reply with ONLY this JSON on one line, no markdown, no code fence: {"ok":true,"n":42}'
```

Raw stdout is byte-identical-shape to grok's: `{"ok":true,"n":42}\n`, no escapes,
`jq -c .` parses cleanly. The combined selector `--model openai-codex/gpt-5.5`
works identically (verified; `message_start` reported
`provider:"openai-codex", model:"gpt-5.5", api:"openai-codex-responses"`).

## Output mode notes — text vs json

- **`--mode text` (default): RECOMMENDED for a tiny-JSON shellout.** stdout is
  only the assistant's final reply text + trailing `\n`. No banner, no prompt
  echo, no ANSI. Pipe straight into `jq`. Both providers confirmed clean.
- **`--mode json`: a JSONL *event stream*, NOT a single JSON object.** Each line
  is one event: `session`, `agent_start`, `turn_start`, `message_start`,
  `message_update` (many — streaming deltas), `message_end`, `turn_end`,
  `agent_end`. The model's final answer lives in the assistant `message_end`
  event under `.message.content[]` as a part with `type:"text"`. (Thinking
  appears as `type:"thinking"` parts and must be filtered out.)

  Extraction recipe for json mode (the assistant text, last turn):

  ```sh
  pi -p --mode json --no-tools --no-session --provider grok-build --model grok-build \
     'Reply with ONLY this JSON on one line: {"ok":true,"n":42}' \
  | jq -r 'select(.type=="message_end" and .message.role=="assistant")
           | .message.content[] | select(.type=="text") | .text'
  ```

  Output: `{"ok":true,"n":42}` → re-pipe to `jq -c .` → PARSE_OK.

  Use json mode only if the caller needs structured metadata (provider/model,
  token usage, cost, stopReason — all present in the events). For pure
  "extract a fixed JSON object", text mode is simpler and equally clean.

## Escape-stripping needed?

**None.** In both providers and both modes the relevant text payload contains no
ANSI/TUI escape sequences. (`pi` suppresses the TUI under `-p`.) `od -c`
confirmed text-mode stdout is just the JSON literal + `\n`. No `sed`/`ansi`
filter required before `jq`.

## Reproducibility

Re-ran the grok-build text-mode command a second time → identical
`{"ok":true,"n":42}` parseable by `jq`. (Content is model-determined, so a
fixed-JSON prompt that pins the literal answer is what makes it deterministic;
the *mechanism* — clean capturable stdout — is stable across runs.)

## Recommended shellout contract for reconciliation work

- Invocation: `pi -p --no-tools --no-session --provider <P> --model <M> '<prompt>'`
  - grok-build: `<P>=grok-build <M>=grok-build`
  - gpt-5.5:    `<P>=openai-codex <M>=gpt-5.5`
- Capture stdout; in text mode pipe directly to `jq` / JSON parse. No escape strip.
- Always pass `--no-session` (ephemeral, no session file litter) and `--no-tools`
  (the reconciliation prompt should not let the model touch the FS/bash).
- Pin the prompt to demand a bare one-line JSON object (no code fence) for the
  cleanest parse; defensively, still tolerate a fenced block if a model adds one.
- Auth: already established (OAuth in `~/.pi/agent/auth.json`); no per-call key.

## Caveats / open risks for downstream work

- Model output is non-deterministic in general; only the prompt-pinned literal
  made the object fixed. Reconciliation prompts must constrain output format
  tightly and validate/parse defensively.
- OAuth tokens in `auth.json` carry an `expires`; a long-lived automation may hit
  token refresh. pi refreshes transparently when online, but an offline/expired
  state would fail the call — surface that as an error, don't silently fall back.
- `--mode text` gave a bare object here; if a model ever wraps JSON in prose or a
  fence, prefer extracting the last `{...}` / fenced block rather than assuming
  the whole stdout is JSON.
