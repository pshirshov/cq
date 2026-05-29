# Triage-format robustness across models — 2026-05-29

Empirical finding for the cq inline-classification design. Used to
inform the upcoming orchestrator subsystem (per-message triage feeding
sub-agent dispatch).

## Question

If we stop trying to enforce classification via a `mcp__cq__submit_classification`
MCP tool, and instead ask each replying agent to emit an HTML-comment
`<!--cq-classification … -->` block at the top of its first reply, how
reliably do the models we ship support produce a parseable block?

The question matters because the inline approach has two advantages over
the MCP path: (a) it works uniformly on both ClaudeBridge and CodexBridge
without needing the `cq-mcp` stdio binary to host a new tool, and (b) it
costs zero extra round-trips. Trade-off: schema enforcement is best-effort
(prompt-driven) rather than Zod-validated.

## Methodology

- **System prompt.** "Before any text reply, emit `<!--cq-classification …-->`
  with 8 fields (`kind`, `openEnded`, `complexity`, `suggestedModel`,
  `needsPlanning`, `needsClarification`, `needsHuman`, `rationale`).
  Reply after the closing marker."
- **6 representative prompts**: trivial question ("what time is it?");
  focused bug ("fix the resume button bug on subagent rows"); medium
  feature ("add dark mode"); large refactor ("refactor persistence to
  add PostgreSQL"); suspected race ("race condition in CodexBridge during
  session shutdown"); doc question ("explain how MCP tool routing works in
  cq").
- **Scoring** (format compliance, automated):
  - `OPEN`: `<!--cq-classification` present.
  - `CLOSE`: `-->` present.
  - `FIELDS`: count of named fields (out of 8) appearing at line-start.
  - `ENUMS_OK`: how many of `kind` / `complexity` / `suggestedModel`
    landed inside the allowed enum (out of 3).
- **7 models across 3 backends**:
  - Anthropic via `claude -p`: opus-4-8, sonnet-4-6, haiku-4-5.
  - OpenAI via `codex exec`: gpt-5.1 (xhigh reasoning).
  - Local Ollama: qwen3.6:27b (17 GB), qwen3.6:latest (36 B MoE, 23 GB),
    gpt-oss:20b (13 GB).
- **Caveat**: `claude -p` plain-print mode silently strips HTML
  comments. First Claude pass scored 1–2/6 entirely from this CLI
  formatter, not from model failure. Re-ran Claude with
  `--output-format stream-json --verbose --max-turns 1` and parsed
  `assistant.message.content[].text` directly. Production cq always
  reads the SDK stream, not the print output — so this is a research
  artifact, not a system issue. Worth flagging as a debugging-time
  footgun.

## Results — format compliance

| Model | Backend | Compliance | Notes |
|---|---|---|---|
| claude-opus-4-8 | claude-agent-sdk | **6/6** | one prompt missed one field (7/8); rest clean |
| claude-sonnet-4-6 | claude-agent-sdk | **6/6** | clean |
| claude-haiku-4-5 | claude-agent-sdk | **6/6** | clean; strongest rationale prose |
| qwen3.6:27b | ollama | **6/6** | requires `think:false` + `num_predict ≥ 2048`; otherwise the thinking channel fills the budget and answer tokens never arrive |
| qwen3.6:latest (36 B MoE) | ollama | **6/6** | same caveats; initially scored 0/6 from the same think-cutoff problem |
| gpt-oss:20b | ollama | **5/6** | ollama logs `error parsing tool call: raw='<!--cq-classification…'` on every call — the model output is fine, the harness misclassifies it as a malformed JSON tool call; 1 hard miss on "explain how MCP tool routing works" |
| gpt-5.1 | codex CLI | **6/6** | clean |

## Results — content quality (subjective)

Trends from inspecting actual classification text (full samples in
`debug/classifications-side-by-side.md` and the bench output files):

- **`suggestedModel` calibration**. For "what time is it?" (true answer:
  `ganglia`), only **Sonnet** picked `ganglia`. **Opus** picked `hands`.
  **Haiku, qwen-27b, qwen-36b, gpt-oss, gpt-5.1** all overshot to
  `brain`. Cheap-tier dispatch from the cheap-model classifier is the
  failure mode worth watching.
- **`needsClarification` calibration**. For "race condition in
  CodexBridge" (true answer: `true` — needs repro), **Haiku and qwen-27b
  and Sonnet** correctly flagged `true`. **Opus and qwen-36b** under-flagged.
- **Rationale prose**. **Haiku** produced the most actionable rationales
  by a clear margin (e.g. *"Suspected race condition requires
  reproduction steps, symptoms, and logs to confirm before
  investigation and fix."*). Opus was terser; qwen tended toward
  generic single-line summaries.
- **Field elision**. Only **Opus** dropped a single field (7/8 on one
  prompt) — a structural slip, not a content one.

## Implications for cq

1. **Inline-marker triage is viable on every model in scope.** No model
   in this set fundamentally refuses the format. The smallest local
   model (gpt-oss 20 B) hits 83 %; everything else is 100 %.
2. **Parse the raw stream.** `claude -p` plain-text mode strips
   HTML comments — the orchestrator design must consume
   `--output-format stream-json` (or the underlying SDK's structured
   events). Any future debugging tooling that grabs raw `claude -p`
   output for triage will silently see no classification.
3. **No MCP tool is needed for the orchestrator's classification
   intake.** Same agent that's replying can produce the structured
   block at zero round-trip cost. The Codex problem (cq-mcp can't host
   stateful tools that need WS-back-to-server) goes away — we don't
   need a tool at all.
4. **For a local fallback tier**, `qwen3.6:27b` is the cheapest reliable
   option. `qwen3.6:latest` (36 B MoE) is roughly 2× the cost for
   indistinguishable quality. `gpt-oss:20b` is fine if the per-call
   ollama log nuisance is acceptable. Tighter prompt phrasing
   ("respond with normal text, not a tool call") would likely suppress.
5. **For classification *quality*** (not just compliance), Sonnet was
   slightly better calibrated on `suggestedModel` and
   `needsClarification`; Haiku produced the best rationale text. Opus
   was the most cautious / over-budgeting. gpt-5.1 was solid but slow
   at `reasoning_effort: xhigh`.

## Production wiring (what falls out of this)

- **Bridges parse the model's raw text stream** for the `<!--cq-classification…-->`
  block on the first turn of each user message. Strip from user-facing
  text. Persist to the planned `classification` SQLite table
  (per the 2026-05-29 ledger-vs-database discussion).
- **No new MCP tool. No `cq-mcp` change. No `canUseTool` enforcement.**
- **Missing-block fallback**: log + skip dispatch. The system stays
  advisory; nothing breaks if a turn lacks classification.
- **Streaming-aware parsing**: the comment block streams in at the head
  of the reply. Buffer until the closing `-->` is seen, then forward
  everything after to the UI without latency penalty.

## Constraints worth knowing

- `qwen3.6` thinking channel + low `num_predict` is a footgun. Either
  set `think:false` in `/api/chat` opts or budget ≥2048 tokens.
- gpt-oss models trigger `ollama`'s tool-call parser when the assistant
  text *looks like* a function call (including HTML comments). The
  parser logs an error but does not corrupt the response — still worth
  pinning a prompt that says "do not call any tools" if we ever ship
  this in production.
- `claude -p` plain-text mode strips HTML comments. Cannot be used as
  a debugging substitute for the raw SDK stream when verifying
  classification.
- `codex exec` lacks a `--system-prompt` flag. Prepend the system
  prompt to the user message with a clear delimiter for one-shot
  parity. cq's `CodexBridge` already wires the system prompt via
  `ThreadOptions` (no parity work required for the production path).

## Artifacts

All under `docs/research/triage-format-robustness/`:

- `triage-bench.sh` — full bench harness (ollama + claude + codex).
- `triage-claude-rerun.sh` — Claude-only rerun with stream-json
  (corrects the `claude -p` HTML-stripping artifact).
- `triage-bench-output.txt` — original bench output (showing the
  Claude print-mode artifact).
- `triage-claude-rerun-output.txt` — corrected Claude output via
  stream-json + jq.
- `classifications-side-by-side.md` — per-prompt cross-model
  classification dump for the three most discriminating prompts.
- `extract-classifications.sh` — helper that produced the
  side-by-side.
