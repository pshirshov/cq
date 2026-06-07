# Bug report (upstream `luxus/pi-xai`): grok-build models hardcode a stale 128k `contextWindow`, should be 256k

**Repo:** https://github.com/luxus/pi-xai
**Package:** `pi-xai` (npm), version 0.8.5
**File:** `xai-provider.ts`

## Summary

All three models registered by `registerXaiProvider` declare
`contextWindow: 131072` (128k — the old Grok 4/4.1 figure). The Grok Build
"Coding Plan" model (`grok-build`) actually exposes **256k**. Pi's own bundled
model table agrees: `grok-build-0.1 → 256000`. The stale constant makes Pi
report context usage as `%/131k` and trigger auto-compaction at roughly half
the real budget, silently under-using the available context.

## Affected code

`xai-provider.ts`, inside `registerXaiProvider`:

```ts
models: [
  {
    id: "grok-build",
    name: "Grok Build (Coding Plan)",
    reasoning: false,
    input: ["text", "image"],
    cost: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite: 3.75 },
    contextWindow: 131072,   // <-- stale; grok-build exposes 256k
    maxTokens: 32768,
  },
  { id: "grok-4.3",        /* ... */ contextWindow: 131072, /* ... */ },
  { id: "grok-4.3-latest", /* ... */ contextWindow: 131072, /* ... */ },
]
```

## Evidence

- Pi's bundled model metadata (`@earendil-works/pi-ai` generated model table)
  lists `grok-build-0.1` with `contextWindow: 256000`.
- xAI's Grok Build / Coding Plan documents a 256k context window for the coding
  model; `131072` (128k) is the prior Grok 4.x figure.
- Observed behavior: Pi's status line reads `…/131k` and the session
  auto-compacts well before 256k of context is consumed.

## Expected behavior

`grok-build` should declare `contextWindow: 256000` so Pi's context accounting
and auto-compaction threshold match the model's real budget. (The `grok-4.3`
entries should carry whatever xAI currently documents for those models.)

## Why a downstream fix is not possible today

- `settings.modelOverrides` (which *can* set `contextWindow`) applies only to
  **built-in** provider models — per Pi's `models.md`:
  *"modelOverrides are applied to built-in provider models."* `grok-build` is
  registered at runtime by this extension, so it is out of scope.
- A `before_provider_request` extension hook cannot help: `contextWindow` is
  registry metadata that drives the usage display and the compaction threshold,
  not a field carried in the request payload.

So consumers currently have to vendor/patch this file to correct the constant.

## Suggested fix (either)

1. **Minimal:** bump `grok-build` to `contextWindow: 256000` (and re-confirm the
   `grok-4.3*` figures against xAI's current docs).
2. **Preferred (prevents future forks):** read each model's `contextWindow` from
   an optional settings/env override (e.g. `resolveXaiConfig()` → per-model
   `contextWindow`), falling back to the built-in constant. That lets downstream
   users correct individual figures without forking the extension source.

## Repro

1. `pi install npm:pi-xai`, `/login grok-build`, select `grok-build`.
2. Observe the status line denominator reads `131k`.
3. Drive a long session; note auto-compaction fires near ~128k, not ~256k.

Happy to send a PR for option 1 if useful — the change is a single constant.
