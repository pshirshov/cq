/**
 * mcp.ts — MCP server configuration utilities for the SDK bridge.
 *
 * PR-19 planned to validate that the bundled Claude Code CLI subprocess
 * inherits `~/.claude/mcp_servers.json` automatically when `HOME` is set.
 * However, the native Claude Code binary (`@anthropic-ai/claude-agent-sdk-linux-x64`)
 * is not installed in this environment, so the real subprocess path is
 * unavailable in tests (PR-20-D01).
 *
 * Fallback contract (closed PR-19-D01 via this module):
 *   1. Read `~/.claude/mcp_servers.json` (HOME-relative).
 *   2. Parse as `{ mcpServers: Record<string, McpServerConfig> }` or
 *      `Record<string, McpServerConfig>` (both shapes accepted).
 *   3. Return the parsed map; callers merge it into `Options.mcpServers`
 *      before calling `query()`, so the SDK's `--mcp-config` flag carries it.
 *
 * This is the designated fallback path per defects.md PR-19-D01 and plan § 5.5.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";

/**
 * Minimal stdio MCP server config shape (from SDK's McpStdioServerConfig).
 * Kept deliberately narrow — only the fields we parse and forward.
 */
export type McpServerConfig = {
  type?: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
};

/**
 * Load MCP server configurations from `~/.claude/mcp_servers.json`.
 *
 * Returns an empty object if the file does not exist or is unparseable.
 * Errors other than ENOENT are logged to stderr and treated as empty.
 *
 * @param home - Defaults to `process.env.HOME ?? os.homedir()`.
 */
export async function loadMcpServers(
  home?: string,
): Promise<Record<string, McpServerConfig>> {
  const homeDir = home ?? process.env["HOME"] ?? "";
  if (!homeDir) return {};

  const filePath = path.join(homeDir, ".claude", "mcp_servers.json");
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if (isEnoent(err)) return {};
    // Non-ENOENT read error: log and treat as empty rather than crashing.
    process.stderr.write(
      `[mcp] warning: could not read ${filePath}: ${String(err)}\n`,
    );
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    process.stderr.write(`[mcp] warning: could not parse ${filePath} as JSON\n`);
    return {};
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }

  // Accept both `{ mcpServers: {...} }` and `{ "server-name": {...} }` shapes.
  const obj = parsed as Record<string, unknown>;
  if ("mcpServers" in obj && typeof obj["mcpServers"] === "object" && obj["mcpServers"] !== null) {
    return obj["mcpServers"] as Record<string, McpServerConfig>;
  }

  // Top-level map shape.
  return filterMcpEntries(obj);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isEnoent(err: unknown): boolean {
  return (
    err instanceof Error &&
    "code" in err &&
    (err as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/**
 * Filter a raw object map to only include valid-looking McpServerConfig entries
 * (objects with a `command` string field). Non-conforming entries are silently
 * dropped.
 */
function filterMcpEntries(
  obj: Record<string, unknown>,
): Record<string, McpServerConfig> {
  const result: Record<string, McpServerConfig> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>)["command"] === "string"
    ) {
      result[key] = value as McpServerConfig;
    }
  }
  return result;
}
