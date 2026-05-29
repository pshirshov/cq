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

Then write your normal reply. The reply MUST come AFTER the closing --> marker. Do not nest comments. Do not include extra text inside the block. Do not call any tools.'

declare -a PROMPTS=(
  "what time is it?"
  "fix the resume button bug where it shows up on subagent rows"
  "add dark mode to the chat UI"
  "refactor the entire persistence layer to support PostgreSQL alongside SQLite"
  "i think there is a race condition in CodexBridge during session shutdown"
  "explain how MCP tool routing works in cq"
)

run_claude_raw() {
  local model="$1"; local prompt="$2"
  timeout 180 claude -p --model "$model" --output-format stream-json --verbose --max-turns 1 --system-prompt "$SYS" "$prompt" 2>/dev/null \
    | jq -r 'select(.type=="assistant") | .message.content[]?.text // empty'
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

for model in claude-opus-4-8 claude-sonnet-4-6 claude-haiku-4-5; do
  echo "================================================================"
  echo "MODEL: $model  (raw stream)"
  echo "================================================================"
  for p in "${PROMPTS[@]}"; do
    echo
    echo "--- PROMPT: $p"
    out=$(run_claude_raw "$model" "$p")
    echo "--- RESPONSE (first 15 lines):"
    echo "$out" | head -15
    echo "--- SCORE:"
    score "$out"
  done
done
