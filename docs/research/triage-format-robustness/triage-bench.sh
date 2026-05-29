#!/usr/bin/env bash
set -uo pipefail
SYS='You are an assistant. Before any text reply, EMIT a classification block in this EXACT format (HTML-comment delimiters):

<!--cq-classification
kind: question|feature-request|bug-report
openEnded: true|false
complexity: trivial|small|medium|large
suggestedModel: brain|hands|ganglia
needsPlanning: true|false
needsClarification: true|false
needsHuman: true|false
rationale: <one short sentence>
-->

Then write your normal reply. The reply MUST come AFTER the closing --> marker. Do not nest comments. Do not include extra text inside the block.'

declare -a PROMPTS=(
  "what time is it?"
  "fix the resume button bug where it shows up on subagent rows"
  "add dark mode to the chat UI"
  "refactor the entire persistence layer to support PostgreSQL alongside SQLite"
  "i think there is a race condition in CodexBridge during session shutdown"
  "explain how MCP tool routing works in cq"
)

run_ollama() {
  local model="$1"; local prompt="$2"
  curl -s --max-time 240 "$OLLAMA_HOST/api/chat" \
    -H 'Content-Type: application/json' \
    -d "$(jq -nc --arg m "$model" --arg s "$SYS" --arg u "$prompt" \
      '{model:$m, messages:[{role:"system",content:$s},{role:"user",content:$u}], stream:false, think:false, options:{temperature:0.1, num_predict:2048}}')" \
    | jq -r '.message.content // .error // "<<no-content>>"'
}

run_claude() {
  local model="$1"; local prompt="$2"
  timeout 180 claude -p --model "$model" --system-prompt "$SYS" "$prompt" 2>&1
}

run_codex() {
  local model="$1"; local prompt="$2"
  # codex exec doesn't have a system-prompt flag; prepend system to user.
  local full="SYSTEM PROMPT:
$SYS

USER PROMPT:
$prompt"
  timeout 180 codex exec --skip-git-repo-check -c "model=\"$model\"" "$full" 2>&1
}

score() {
  local out="$1"
  local has_open=0 has_close=0 fields=0 enum_ok=0
  echo "$out" | grep -q '<!--cq-classification' && has_open=1
  echo "$out" | grep -q '\-->' && has_close=1
  for f in kind openEnded complexity suggestedModel needsPlanning needsClarification needsHuman rationale; do
    echo "$out" | grep -qE "^${f}:" && fields=$((fields+1))
  done
  echo "$out" | grep -qE '^kind: (question|feature-request|bug-report)' && enum_ok=$((enum_ok+1))
  echo "$out" | grep -qE '^complexity: (trivial|small|medium|large)' && enum_ok=$((enum_ok+1))
  echo "$out" | grep -qE '^suggestedModel: (brain|hands|ganglia)' && enum_ok=$((enum_ok+1))
  echo "OPEN=$has_open CLOSE=$has_close FIELDS=$fields/8 ENUMS_OK=$enum_ok/3"
}

run_one() {
  local kind="$1"; local model="$2"
  echo "================================================================"
  echo "MODEL: $model  (via $kind)"
  echo "================================================================"
  for p in "${PROMPTS[@]}"; do
    echo
    echo "--- PROMPT: $p"
    case "$kind" in
      ollama)  out=$(run_ollama "$model" "$p") ;;
      claude)  out=$(run_claude "$model" "$p") ;;
      codex)   out=$(run_codex "$model" "$p") ;;
    esac
    echo "--- RESPONSE (first 18 lines):"
    echo "$out" | head -18
    echo "--- SCORE:"
    score "$out"
  done
}

run_one ollama "qwen3.6:27b"
run_one ollama "qwen3.6:latest"
run_one ollama "gpt-oss:20b"
run_one claude "claude-opus-4-8"
run_one claude "claude-sonnet-4-6"
run_one claude "claude-haiku-4-5"
run_one codex  "gpt-5.1"
