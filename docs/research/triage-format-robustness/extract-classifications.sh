#!/usr/bin/env bash
# Extracts the cq-classification YAML block for each (model, prompt) pair
# from the two bench-output files.
set -uo pipefail

extract() {
  awk '/<!--cq-classification/,/-->/' | sed -n '/<!--cq-classification/,/-->/p' | head -12
}

# Format-compliance per model (already known from prior runs):
# qwen3.6:27b   6/6
# qwen3.6:latest 6/6
# gpt-oss:20b   5/6
# gpt-5.1 (codex) 6/6
# claude-opus-4-8   6/6 (raw stream)
# claude-sonnet-4-6 6/6 (raw stream)
# claude-haiku-4-5  6/6 (raw stream)

# Pull individual classification blocks for the three most discriminating prompts.
PROMPTS_SHORT=("what time is it" "refactor the entire persistence" "race condition in CodexBridge")

echo "## Side-by-side classifications"
echo

for sp in "${PROMPTS_SHORT[@]}"; do
  echo "### Prompt: «$sp»"
  echo
  for src in debug/triage-bench-output.txt debug/triage-claude-rerun-output.txt; do
    awk -v sp="$sp" '
      /^MODEL:/ { model = $0; sub(/^MODEL:[ \t]*/,"",model) }
      /^--- PROMPT:/ {
        active = (index($0, sp) > 0) ? 1 : 0
        if (active) print "**" model "**"
      }
      active && /<!--cq-classification/,/-->/ { print $0 }
    ' "$src"
    echo
  done
done
