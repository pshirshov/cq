/**
 * mcp-inheritance.test.ts — G2c F-14: MCP server inheritance from ~/.claude/mcp_servers.json.
 *
 * PR-19-D01 resolution: The real bundled CLI binary is unavailable in this
 * environment (`@anthropic-ai/claude-agent-sdk-linux-x64` is not installed), so
 * the inheritance-via-HOME path cannot be tested end-to-end (PR-20-D01).
 *
 * Instead, the test validates the FALLBACK path implemented in PR-20:
 *   1. Set Bridge.opts.home = tmpDir (a temp directory).
 *   2. Write tmpDir/.claude/mcp_servers.json with a stub MCP entry.
 *   3. Bridge.handleChatStart() calls loadMcpServers(home), reads the file,
 *      and passes the result via Options.mcpServers to the queryFactory.
 *   4. The MockQuery's Options are inspected to confirm the stub MCP server
 *      was forwarded.
 *   5. The chat.started initInfo is augmented with the loaded MCP server names
 *      so callers can verify the merge.
 *
 * PR-19-D01 is resolved by the explicit fallback path (option (b) from defects.md).
 * The test is un-skipped as of PR-20.
 */

import { describe, it, expect, afterEach } from "bun:test";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { Bridge } from "../src/agent/bridge";
import type { QueryFactory, WsSocket } from "../src/agent/bridge";
import type { Query, SDKMessage, Options as SDKOptions } from "@anthropic-ai/claude-agent-sdk";
import { SessionRegistry } from "../src/seq/sessionRegistry";
import type { Logger } from "../src/log/logger";
import { startMockAnthropic } from "./helpers/MockAnthropicHTTP";
import type { MockAnthropicHTTP } from "./helpers/MockAnthropicHTTP";

// ---------------------------------------------------------------------------
// Noop logger
// ---------------------------------------------------------------------------

const noopLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};

// ---------------------------------------------------------------------------
// MockWsSocket
// ---------------------------------------------------------------------------

interface ParsedFrame {
  type: string;
  [key: string]: unknown;
}

class MockWsSocket implements WsSocket {
  readonly sent: ParsedFrame[] = [];

  send(data: string): void {
    this.sent.push(JSON.parse(data) as ParsedFrame);
  }

  close(): void {}

  framesOfType(type: string): ParsedFrame[] {
    return this.sent.filter((f) => f.type === type);
  }

  async waitForFrames(type: string, count = 1, timeoutMs = 5000): Promise<ParsedFrame[]> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const frames = this.framesOfType(type);
      if (frames.length >= count) return frames;
      await Bun.sleep(20);
    }
    throw new Error(
      `Timed out waiting for ${count} frame(s) of type '${type}'; ` +
      `got ${this.framesOfType(type).length}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Captured-options QueryFactory
//
// This factory captures the SDKOptions passed to it and returns a MockQuery
// that yields a synthetic init message whose mcp_servers list is built from
// the Options.mcpServers that were passed in.
// ---------------------------------------------------------------------------

type CapturedCall = {
  options: SDKOptions | undefined;
};

function makeCapturedQueryFactory(): {
  factory: QueryFactory;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];

  const factory: QueryFactory = ({ prompt, options }) => {
    calls.push({ options });

    // Drain prompt in background.
    void (async () => {
      try {
        // Drain the prompt iterable.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _msg of prompt) { /* drain */ }
      } catch (e) {
        void e; // ignore
      }
    })();

    // Build an init message that lists the MCP servers from Options.mcpServers.
    const mcpServers = options?.mcpServers ?? {};
    const mcpList = Object.entries(mcpServers).map(([name]) => ({
      name,
      status: "connected",
    }));

    const initMessage: SDKMessage = {
      type: "system",
      subtype: "init",
      agents: [],
      apiKeySource: "user",
      betas: [],
      claude_code_version: "0.3.150-test",
      cwd: "/tmp",
      tools: [],
      mcp_servers: mcpList,
      model: "claude-test",
      permissionMode: "default",
      slash_commands: [],
      output_style: "text",
      skills: [],
      plugins: [],
      uuid: "00000000-0000-4000-a000-000000000020",
      session_id: "00000000-0000-4000-a000-000000000021",
    } as unknown as SDKMessage;

    let done = false;
    const messages = [initMessage];
    let idx = 0;

    const gen = (async function* (): AsyncGenerator<SDKMessage, void> {
      while (idx < messages.length && !done) {
        yield messages[idx++]!;
      }
    })();

    return Object.assign(gen, {
      interrupt: async () => { done = true; },
      close: () => { done = true; },
      setPermissionMode: async () => {},
      setModel: async () => {},
      setMaxThinkingTokens: async () => {},
      applyFlagSettings: async () => {},
      initializationResult: async () => { throw new Error("not implemented"); },
      supportedCommands: async () => [] as string[],
      supportedModels: async () => [] as string[],
      supportedAgents: async () => [] as string[],
      mcpServerStatus: async () => [] as never[],
      getContextUsage: async () => { throw new Error("not implemented"); },
      readFile: async () => null,
      reloadPlugins: async () => { throw new Error("not implemented"); },
      accountInfo: async () => { throw new Error("not implemented"); },
      rewindFiles: async () => { throw new Error("not implemented"); },
      seedReadState: async () => {},
      reconnectMcpServer: async () => {},
      toggleMcpServer: async () => {},
      setMcpServers: async () => { throw new Error("not implemented"); },
      streamInput: async () => {},
      stopTask: async () => {},
      backgroundTasks: async () => false,
    }) as unknown as Query;
  };

  return { factory, calls };
}

// ---------------------------------------------------------------------------
// Env cleanup
// ---------------------------------------------------------------------------

let savedHome: string | undefined;

afterEach(() => {
  if (savedHome === undefined) delete process.env["HOME"];
  else process.env["HOME"] = savedHome;
  savedHome = undefined;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("MCP inheritance (G2c F-14)", () => {
  it(
    "MCP servers from ~/.claude/mcp_servers.json are forwarded via Options.mcpServers (fallback path, PR-19-D01)",
    async () => {
      // Create a temp HOME directory.
      const tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "cq-mcp-test-"));
      let mock: MockAnthropicHTTP | null = null;

      try {
        // Write ~/.claude/mcp_servers.json with one stub MCP entry.
        const claudeDir = path.join(tmpHome, ".claude");
        await fs.mkdir(claudeDir, { recursive: true });
        await fs.writeFile(
          path.join(claudeDir, "mcp_servers.json"),
          JSON.stringify({
            mcpServers: {
              "test-mcp": { command: "echo", args: ["mcp-stub"] },
            },
          }),
          "utf-8",
        );

        // Start MockAnthropicHTTP (needed for env vars even in fallback path).
        mock = await startMockAnthropic();
        process.env["ANTHROPIC_BASE_URL"] = mock.url;
        process.env["ANTHROPIC_API_KEY"] = "sk-test-fake";

        // Use captured factory to inspect what Options were passed.
        const { factory, calls } = makeCapturedQueryFactory();

        const registry = new SessionRegistry();
        const bridge = new Bridge({
          logger: noopLogger,
          registry,
          queryFactory: factory,
          cwd: tmpHome,
          // Pass home explicitly — this is the fallback path: Bridge reads
          // {home}/.claude/mcp_servers.json and merges into Options.mcpServers.
          home: tmpHome,
        });

        const ws = new MockWsSocket();
        await bridge.handleChatStart(ws, {
          type: "chat.start",
          seq: 0,
          ts: Date.now(),
        });

        // Wait for chat.started.
        const [startedFrame] = await ws.waitForFrames("chat.started", 1, 5000);
        expect(startedFrame).toBeDefined();
        expect(startedFrame!.type).toBe("chat.started");

        // Assertion A: the queryFactory was called with mcpServers containing 'test-mcp'.
        expect(calls.length).toBeGreaterThanOrEqual(1);
        const capturedOptions = calls[0]!.options;
        expect(capturedOptions).toBeDefined();
        expect(capturedOptions!.mcpServers).toBeDefined();
        expect(Object.keys(capturedOptions!.mcpServers!)).toContain("test-mcp");
        expect(capturedOptions!.mcpServers!["test-mcp"]).toMatchObject({
          command: "echo",
          args: ["mcp-stub"],
        });

        // Assertion B: the synthetic init message (built by MockQuery from Options.mcpServers)
        // is surfaced in chat.started.initInfo.mcp_servers.
        const initInfo = startedFrame!.initInfo as Record<string, unknown>;
        const mcpServers = (initInfo["mcp_servers"] ?? []) as Array<{ name: string }>;
        const names = mcpServers.map((s) => s.name);
        expect(names).toContain("test-mcp");

        await bridge.shutdown();
      } finally {
        await mock?.stop();
        await fs.rm(tmpHome, { recursive: true, force: true });
      }
    },
  );
});
