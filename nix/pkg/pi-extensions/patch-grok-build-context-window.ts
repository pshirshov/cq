import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

// pi-xai (npm) hardcodes `contextWindow: 131072` (128k, the stale Grok 4/4.1
// figure) for every grok-build model it registers. The Grok Build Coding Plan
// model actually exposes 256k — Pi's own bundled model table agrees
// (grok-build-0.1 -> 256000) — so the stale value makes Pi report `%/131k` and
// auto-compact at half the real budget. See the upstream bug report in
// docs/drafts/.
//
// We can't fix this from settings: `modelOverrides` (which can set
// contextWindow) only applies to BUILT-IN providers, and `grok-build` is
// registered at runtime by pi-xai. Instead of vendoring pi-xai's source to bump
// the constant, we re-register the provider's model list here with the correct
// figure. Per Pi's documented registerProvider merge semantics, an override
// that supplies only `models` REPLACES the model list and PRESERVES every other
// provider field — including pi-xai's dynamic OAuth token resolver, baseUrl,
// `api`, and `authHeader`. We restate the three model definitions exactly as
// pi-xai declares them (pi-xai@0.8.5), changing only `contextWindow`.
//
// Ordering: we re-register on `session_start`, which fires after all package
// extensions (pi-xai included) have loaded and their provider registrations
// have flushed — so our override lands last and is not clobbered. Per the docs,
// registerProvider called after the initial load phase takes effect immediately
// (no /reload needed) and the call is idempotent across session switches.

const PROVIDER_ID = "grok-build";

// Verified against Pi's bundled model table (grok-build-0.1 -> 256000) and
// xAI's Grok Build Coding Plan docs. Replaces pi-xai's stale 131072.
const GROK_BUILD_CONTEXT_WINDOW = 256000;

// pi-xai's per-model cost table (identical across the three models it ships).
const GROK_COST = { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 };
const GROK_MAX_TOKENS = 32768;
const GROK_INPUT = ["text", "image"];

// The exact model set pi-xai registers, with only contextWindow corrected. If a
// future pi-xai version changes its model list, update this table to match (and
// re-confirm the upstream bug is still unfixed).
const PATCHED_MODELS = [
  {
    id: "grok-build",
    name: "Grok Build (Coding Plan)",
    reasoning: false,
    input: GROK_INPUT,
    cost: GROK_COST,
    contextWindow: GROK_BUILD_CONTEXT_WINDOW,
    maxTokens: GROK_MAX_TOKENS,
  },
  {
    id: "grok-4.3",
    name: "Grok 4.3 (Build)",
    reasoning: true,
    input: GROK_INPUT,
    cost: GROK_COST,
    contextWindow: GROK_BUILD_CONTEXT_WINDOW,
    maxTokens: GROK_MAX_TOKENS,
  },
  {
    id: "grok-4.3-latest",
    name: "Grok 4.3 Latest (Build)",
    reasoning: true,
    input: GROK_INPUT,
    cost: GROK_COST,
    contextWindow: GROK_BUILD_CONTEXT_WINDOW,
    maxTokens: GROK_MAX_TOKENS,
  },
];

export default function patchGrokBuildContextWindow(pi: ExtensionAPI): void {
  pi.on("session_start", () => {
    // Models-only override: replaces the model list, preserves oauth/baseUrl/etc.
    pi.registerProvider(PROVIDER_ID, { models: PATCHED_MODELS } as never);
  });
}
