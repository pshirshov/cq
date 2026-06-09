/**
 * CQ_TOML_TEMPLATE — a fully-commented cq.toml starter template (T331).
 *
 * This is a hand-authored TOML literal (cq-config has only a parser, no
 * serialiser) that, once re-parsed by @cq/config `parseConfig`, is
 * schema-valid and resolves cleanly through `resolveReviewers` /
 * `resolvePlanners`.
 *
 * Active set: three canonical Claude aliases — opus (frontier),
 * sonnet (standard), haiku (fast).  Every other pi-available model
 * (grok-build, minimax, ollama-cloud tokens) is present but COMMENTED OUT
 * so users can opt in by uncommenting.
 *
 * Token grammar (T237 + T286 effort suffix):
 *   claude:<model>[:<effort>]         — e.g. claude:opus-4.8[1m]
 *   pi:<provider>/<model>[:<effort>]  — e.g. pi:grok-build/grok-build
 * Bare pi tokens (no provider qualifier) are CONFIG ERRORs.
 *
 * Reference: Q184 (active set), D36 (pi provider routing), T286 (effort suffix).
 */

export const CQ_TOML_TEMPLATE: string = `\
# cq.toml — configuration for the cq review orchestrator
#
# This file documents the schema for configuring reviewers and planners in
# the cq review flows.  Absence of cq.toml means only the native Claude
# reviewer is used (feature off).
#
# Schema:
#   [aliases]        — table mapping alias names to reviewer tokens
#   reviewers = [...] — top-level array of alias names to activate as reviewers
#   planners  = [...] — top-level array of alias names to activate as planners
#   [tiers]          — CLASSIFIER: maps each token (or alias) to a tier class
#   [agent_tiers]    — maps agent-name -> tier name (default: "standard")
#
# Token grammar (T237 + T286):
#   claude tokens: claude:<model>[:<effort>]
#     e.g. claude:opus-4.8[1m], claude:sonnet-4.6, claude:haiku-4.5
#     EFFORT SUFFIX (optional): low | medium | high | xhigh | max
#   pi tokens: pi:<provider>/<model>[:<effort>]
#     e.g. pi:grok-build/grok-build, pi:ollama-cloud/minimax-m3
#     EFFORT SUFFIX (optional): off | minimal | low | medium | high | xhigh
#   A bare pi token (missing the provider/ qualifier) is a CONFIG ERROR.
#
# Tier classes: fast | standard | frontier

# reviewers — List of ALIAS NAMES (keys from [aliases] below) to activate as
# reviewers.  Each alias is resolved through [aliases] to its token at runtime.
# The reviewers will be invoked in plan-flow and implement-flow review steps.
reviewers = ["opus", "sonnet", "haiku"]

# planners — List of ALIAS NAMES to activate as planners.  Planners MIRROR
# reviewers: same alias-name list shape, resolved through the SAME shared
# [aliases] table below.
planners = ["opus", "sonnet", "haiku"]

# [aliases] — Define reviewer/planner instances as tokens.
#
# Active Claude aliases (uncomment pi aliases below to add additional models):
[aliases]
  # ── Active: canonical Claude trio ────────────────────────────────────────
  opus   = "claude:opus-4.8[1m]"   # most capable / frontier tier
  sonnet = "claude:sonnet-4.6"     # balanced / standard tier
  haiku  = "claude:haiku-4.5"      # fastest / cheapest (fast tier)

  # ── Inactive pi aliases (uncomment to activate) ──────────────────────────
  # These require the relevant pi provider to be configured and accessible.
  # After uncommenting an alias here, also add its name to reviewers/planners
  # above and add a [tiers] entry for it below.
  #
  # codex      = "pi:grok-build/grok-build"
  # grok       = "pi:grok-build/grok-build"
  # grok-xhigh = "pi:grok-build/grok-build:xhigh"
  # minimax    = "pi:ollama-cloud/minimax-m3"

  # ── Inactive Claude aliases with explicit effort suffix ───────────────────
  # opus-high = "claude:opus-4.8[1m]:high"

# [tiers] — CLASSIFIER: maps each concrete token (or alias) to its dispatch
# tier class.  THIS IS NOT A DISPATCH TABLE — it tells cq what tier a given
# token belongs to; the active planner/reviewer candidate list is built from
# [aliases] + reviewers/planners, and a suggestedModel tier selects among
# those listed tokens whose class matches (tie-break: candidate order).
#
# Each KEY must be a valid ReviewerToken (alias name from [aliases], or a full
# token in the grammar: claude:<model> | pi:<provider>/<model>).
# Each VALUE is the tier class: fast | standard | frontier.
#
# A token not listed here is unclassified; resolving an unclassified token
# throws CqConfigError.  Both alias keys and full token keys are accepted.
[tiers]
  # Active Claude trio — classified by capability:
  opus   = "frontier"   # alias key — resolves to claude:opus-4.8[1m]
  sonnet = "standard"   # alias key — resolves to claude:sonnet-4.6
  haiku  = "fast"       # alias key — resolves to claude:haiku-4.5

  # Inactive pi entries (uncomment the matching alias above first):
  # "pi:grok-build/grok-build"      = "standard"
  # grok-xhigh                       = "frontier"   # alias key with effort suffix
  # minimax                          = "fast"        # alias key
  #
  # Inactive Claude with effort suffix:
  # "claude:opus-4.8[1m]:high"      = "frontier"

# [agent_tiers] — Map each named cq agent to its dispatch tier.
# An agent with NO entry here falls back to the "standard" tier.
# The tier name here selects, from the active reviewers/planners candidate
# list, the first token whose class (as classified in [tiers] above) matches
# the tier.  Valid tier values: "fast", "standard", "frontier".
[agent_tiers]
  investigate-explorer    = "frontier"
  investigate-prober      = "standard"
  plan-advance            = "frontier"
  plan-reviewer           = "frontier"
  implement-worker        = "standard"
  implement-reviewer      = "frontier"
  implement-conflict-resolver = "standard"
`;
