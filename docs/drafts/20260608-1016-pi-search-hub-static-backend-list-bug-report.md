# Bug report (upstream `ronnieops/pi-search-hub`): `web_search` advertises all 12 backends regardless of which are configured

**Repo:** https://github.com/ronnieops/pi-search-hub
**Package:** `pi-search-hub` (npm), version 2.1.0
**File:** `extensions/search-hub.ts` (the `web_search` `registerTool` call)

## Summary

`web_search` registers a **static** backend list in two places — the tool
`description` string and the `backend` parameter enum — listing all 12 backends
(`duckduckgo, jina, marginalia, serper, tavily, exa, brave, langsearch,
firecrawl, websearchapi, perplexity, searxng`) unconditionally. The actual set
of *usable* backends is whatever is enabled in `search.json` (plus the
`SEARCH_*_API_KEY` env-fallback), which is typically a small subset.

Consequences:

1. The model cannot tell, from the tool definition, which backends are
   configured. Asked "what backends are enabled?", it can only repeat the full
   static list and add "I don't know which are actually configured."
2. The `backend` enum offers all 12 as valid values, so the model will sometimes
   request a backend that is not configured (e.g. `backend: "tavily"` with no
   Tavily key). That call then fails at `runBackend`, wasting a turn — instead
   of the schema constraining the choice to configured backends up front.

## Affected code

`extensions/search-hub.ts`, inside the `pi.registerTool({ name: "web_search", … })` call:

```ts
description:
  "Search the web using one of several backend search engines. " +
  "Supports DuckDuckGo (free, no key), " +
  "Marginalia Search (free, shared public key), Serper, Tavily, Exa, Brave, " +
  "LangSearch, Firecrawl, WebSearchAPI, Perplexity Sonar, and SearXNG (most need API keys). " +
  … // <-- hardcoded list, independent of config
parameters: Type.Object({
  …
  backend: Type.Optional(
    StringEnum(["duckduckgo", "jina", "marginalia", "serper", "tavily", "exa",
      "brave", "langsearch", "firecrawl", "websearchapi", "perplexity", "searxng", "auto"] as const, {
      description: "Backend to use. 'auto' picks the best configured backend (default)",
    }),   // <-- enum is the full static set, independent of config
  ),
  …
}),
```

The extension already computes the configured set: `config.ts`'s `refreshConfig`
builds `activeBackendsList = Object.entries(config.backends).filter(enabled)…`
and exports `getActiveBackends()`. The tool definition simply does not use it.

## Steps to reproduce

1. Configure only a subset in `~/.pi/agent/extensions/search.json`, e.g.:
   ```json
   { "backends": { "searxng": { "enabled": true, "instanceUrl": "…" },
                   "duckduckgo": { "enabled": true } } }
   ```
2. Start pi and inspect the `web_search` tool definition the model receives
   (or ask the model "which web_search backends are enabled?").

## Expected behavior

The `description` and the `backend` enum reflect only the configured/active
backends (the output of `getActiveBackends()`), plus `auto`. The model can read
the configured set directly and cannot select an unconfigured backend.

## Actual behavior

Both list all 12 backends regardless of `search.json`. The model cannot
determine the configured set and may select an unconfigured backend (which then
fails).

## Proposed fix

Build the tool's `description` and `backend` enum from the active set at
registration:

- Compute `const active = getActiveBackends()` (after an initial
  `refreshConfig`) and render the `description` + `StringEnum([...active,
  "auto"])` from it.
- Because the active set can change when `search.json` is edited mid-session (or
  per-project via `.pi/search.json`), prefer refreshing the tool definition when
  the config changes — e.g. re-register / update `web_search` on `session_start`
  (and/or when `refreshConfig` detects a change), rather than only once at load.
- Keep `auto` always present; when only `duckduckgo` is active (the no-key
  fallback), the enum reduces to `["duckduckgo", "auto"]`.

A defined `backend` value that is not in the active set could also be rejected
early in `execute` with a clear "backend X is not configured; enabled: …"
message, but the schema-level fix is the primary one.

## Workaround in use

Until fixed upstream, we rewrite the `web_search` tool definition in each
outgoing provider request (a pi `before_provider_request` extension), trimming
the `description` and `backend` enum to the active set resolved by re-reading
`search.json` the same way `loadConfig` does. This is a client-side patch over
the symptom; the registration-time fix above is the correct solution.
