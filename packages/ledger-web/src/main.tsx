/**
 * Browser entry point for ledger-web.
 *
 * Reads the default MCP server URL from `window.__LEDGER_MCP_URL__` (injected
 * by the static server) — overridable via a `?url=` query param or the in-UI
 * connection field — and renders <App> wired to the real HTTP MCP client.
 */

import { createRoot } from "react-dom/client";
import { createElement } from "react";
import { App } from "./App.js";
import { McpLedgerClient } from "./mcpClient.js";
import "./styles.css";

declare global {
  interface Window {
    __LEDGER_MCP_URL__?: string;
  }
}

const DEFAULT_URL = "http://127.0.0.1:7777/mcp";

function resolveInitialUrl(): string {
  const fromQuery = new URLSearchParams(window.location.search).get("url");
  if (fromQuery !== null && fromQuery.length > 0) return fromQuery;
  if (typeof window.__LEDGER_MCP_URL__ === "string" && window.__LEDGER_MCP_URL__.length > 0) {
    return window.__LEDGER_MCP_URL__;
  }
  return DEFAULT_URL;
}

const rootEl = document.getElementById("root");
if (rootEl !== null) {
  createRoot(rootEl).render(
    createElement(App, {
      connect: (url: string) => McpLedgerClient.connect(url),
      initialUrl: resolveInitialUrl(),
    }),
  );
}
