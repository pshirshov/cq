import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

// cq subagent-dispatch extension (T224).
//
// Registers ONE tool, `dispatch_agent`, that the cq shared prompts already
// speak to: "dispatch/launch the named subagent <agent> with <task>". The tool
// reads the named agent's markdown from the projected cq-agents directory
// (T222: $CQ_AGENTS_DIR, default $HOME/.pi/agent/cq-agents), parses its
// frontmatter, and runs the agent as an ISOLATED child pi turn whose toolset is
// filtered to the agent's allowed set — and which can NOT itself re-dispatch.
//
// Mechanism (Route A, per the T221 go/no-go spike
// docs/drafts/20260607-2022-T221-pi-childsession-spike.md): spawn a fresh
//   pi -p --mode json --no-session [--provider P --model M]
//      --exclude-tools <denylist incl. DISPATCH_TOOL_NAME>
//      --append-system-prompt <agent body file> "<task>"
// subprocess and parse its stdout `message_end` JSON stream; the final
// assistant text part is returned to the caller (the `getFinalOutput` pattern
// from the upstream subagent example).
//
// Subagents-cannot-spawn-subagents is guarded by the `--exclude-tools` denylist
// below, which ALWAYS contains DISPATCH_TOOL_NAME: the child is a plain
// `pi -p` process that is NOT launched with `--extension
// cq-subagent-dispatch.ts`, and even if the dispatch extension is discovered
// via settings, its tool is filtered out of the child by the denylist — so the
// child can never re-dispatch. (We do NOT pass `--no-extensions`, because the
// provider-registering package extensions — e.g. pi-xai's grok-build — must
// still load for the child's model to resolve.)
//
// CHILD MODEL (scope boundary with T225): the child defaults to the PARENT
// session's currently-active model (ctx.model). This task does NOT resolve
// tiered/per-agent models — it only knows WHERE cq.toml lives (see
// resolveCqConfigPath) as a documented seam for T225.

const DISPATCH_TOOL_NAME = "dispatch_agent";

// T222: the directory the cq agent markdowns are projected to. Pinned on
// piWrapped in nix/hm/dev-llm.nix; default mirrors that wiring.
const AGENTS_DIR_ENV = "CQ_AGENTS_DIR";
const DEFAULT_AGENTS_DIR = path.join(os.homedir(), ".pi", "agent", "cq-agents");

// K46: where cq.toml lives. T224 only computes this path (a seam for T225's
// tier resolution); it does NOT read or parse the file here.
const CQ_CONFIG_ENV = "CQ_CONFIG";
const CQ_PROJECT_ROOT_ENV = "CQ_PROJECT_ROOT";
const CQ_CONFIG_FILENAME = "cq.toml";

// Cap on the child's returned text, mirroring the upstream subagent example's
// per-task output discipline.
const OUTPUT_CAP_BYTES = 64 * 1024;

interface AgentDefinition {
  name: string;
  description: string;
  /** pi tool names the child is NOT allowed to use (denylist for --exclude-tools). */
  disallowedTools: string[];
  /** The markdown body, injected as the child's appended system prompt. */
  systemPrompt: string;
  filePath: string;
}

interface DispatchDetails {
  agent: string;
  agentFile: string | null;
  /** Echoes the requested isolation mode (stubbed seam, deferred per Q128). */
  isolation: "worktree" | null;
  model: string | null;
  provider: string | null;
  exitCode: number;
  excludedTools: string[];
  cqConfigPath: string;
  stderr: string;
}

const DispatchParams = Type.Object({
  agent: Type.String({ description: "Name of the cq agent to dispatch (matches the agent markdown filename / frontmatter name)." }),
  task: Type.String({ description: "The task to delegate to the agent — becomes the child turn's prompt." }),
  isolation: Type.Optional(
    Type.Literal("worktree", {
      description: 'Optional isolation mode. Only "worktree" is recognized; it is a stubbed seam (deferred per Q128) and does not yet change behavior.',
    }),
  ),
});

type DispatchArgs = {
  agent: string;
  task: string;
  isolation?: "worktree";
};

/** Resolve the cq-agents directory (T222 wiring). */
function resolveAgentsDir(): string {
  const fromEnv = process.env[AGENTS_DIR_ENV];
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_AGENTS_DIR;
}

/**
 * Resolve the cq.toml path per K46: $CQ_CONFIG, else $CQ_PROJECT_ROOT/cq.toml,
 * else <cwd>/cq.toml. Computed only — not read here (tier resolution is T225).
 */
function resolveCqConfigPath(cwd: string): string {
  const explicit = process.env[CQ_CONFIG_ENV];
  if (explicit && explicit.length > 0) return explicit;
  const projectRoot = process.env[CQ_PROJECT_ROOT_ENV];
  if (projectRoot && projectRoot.length > 0) return path.join(projectRoot, CQ_CONFIG_FILENAME);
  return path.join(cwd, CQ_CONFIG_FILENAME);
}

/** Read + parse the named agent markdown from the cq-agents directory. */
// Lenient line-based frontmatter parser for the cq agent markdowns.
//
// We deliberately do NOT use pi's exported `parseFrontmatter` (a strict YAML
// `parse`): the cq agent frontmatter carries long, unquoted `description:`
// values that contain colons, which strict YAML rejects with
// "Nested mappings are not allowed in compact mappings". The cq frontmatter is
// a flat set of single-line `key: value` scalars (name/description/
// disallowedTools/isolation), so splitting each line on its FIRST colon parses
// every cq agent robustly without quoting the source (cq-assets is read-only).
function parseFlatFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  // Tolerate trailing whitespace on the `---` delimiter lines (and a missing
  // trailing newline after the closing delimiter) so a slightly off-spec
  // markdown variant doesn't silently yield an empty frontmatter (which would
  // drop the agent's disallowedTools and weaken the child's tool filtering).
  const open = normalized.match(/^---[ \t]*\n/);
  if (!open) return { frontmatter: {}, body: normalized.trim() };
  const rest = normalized.slice(open[0].length);
  const close = rest.match(/\n[ \t]*---[ \t]*(?:\n|$)/);
  if (!close || close.index === undefined) return { frontmatter: {}, body: normalized.trim() };
  const block = rest.slice(0, close.index);
  const body = rest.slice(close.index + close[0].length).trim();
  const frontmatter: Record<string, string> = {};
  for (const rawLine of block.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    frontmatter[key] = line.slice(colon + 1).trim();
  }
  return { frontmatter, body };
}

function loadAgent(agentsDir: string, agentName: string): AgentDefinition | null {
  // Path-traversal guard: `agentName` is caller-controlled (an LLM tool arg), so
  // it must be a bare filename — no path separators, no "..", no leading dot —
  // before it is joined into a filesystem path. Otherwise a name like
  // "../../secret" would let readFileSync escape agentsDir and surface arbitrary
  // *.md content as the child's system prompt.
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(agentName) || agentName.includes("..")) {
    return null;
  }
  const filePath = path.join(agentsDir, `${agentName}.md`);
  // Defense in depth: the resolved file must live directly inside agentsDir.
  if (path.dirname(path.resolve(filePath)) !== path.resolve(agentsDir)) {
    return null;
  }
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
  const { frontmatter, body } = parseFlatFrontmatter(content);
  const disallowedTools = (frontmatter.disallowedTools ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    name: frontmatter.name ?? agentName,
    description: frontmatter.description ?? "",
    disallowedTools,
    systemPrompt: body,
    filePath,
  };
}

// The cq/Claude tool names that appear in agent frontmatter `disallowedTools`
// do not all map 1:1 to pi's built-in tool names. Map the ones that do; pi
// silently ignores unknown names in an --exclude-tools denylist, so passing the
// originals through is harmless, but mapping the common ones keeps the denylist
// meaningful. `Agent` (Claude's dispatch tool) maps to this extension's
// dispatch tool name so the child can never re-dispatch.
const CQ_TO_PI_TOOL: Record<string, string> = {
  Agent: DISPATCH_TOOL_NAME,
  Bash: "bash",
  Edit: "edit",
  MultiEdit: "edit",
  Write: "write",
  Read: "read",
  Grep: "grep",
  Glob: "find",
  NotebookEdit: "edit",
};

/**
 * Build the child's --exclude-tools denylist from the agent's disallowedTools,
 * always including DISPATCH_TOOL_NAME so the child cannot re-dispatch.
 */
function buildExcludeTools(disallowedTools: string[]): string[] {
  const excluded = new Set<string>([DISPATCH_TOOL_NAME]);
  for (const cqName of disallowedTools) {
    excluded.add(CQ_TO_PI_TOOL[cqName] ?? cqName);
  }
  return [...excluded];
}

function writePromptToTempFile(agentName: string, prompt: string): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cq-dispatch-"));
  // If the write fails after the dir was created, clean it up here — otherwise
  // the caller's try/finally (which it enters only AFTER this returns) never
  // runs and the temp dir leaks.
  try {
    const safeName = agentName.replace(/[^\w.-]+/g, "_");
    const filePath = path.join(dir, `system-${safeName}.md`);
    fs.writeFileSync(filePath, prompt, { encoding: "utf-8", mode: 0o600 });
    return { dir, filePath };
  } catch (err) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore cleanup failure */
    }
    throw err;
  }
}

// Resolve how to re-invoke pi for the child process. Mirrors the upstream
// subagent example: prefer the current script under the real runtime, else fall
// back to the `pi` binary on PATH.
function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

interface AssistantPart {
  type: string;
  text?: string;
}
interface ChildMessage {
  role?: string;
  content?: AssistantPart[];
}

/** Walk back to the last assistant message and join ALL its text parts. */
function getFinalOutput(messages: ChildMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg && msg.role === "assistant" && Array.isArray(msg.content)) {
      const texts = msg.content
        .filter((part): part is AssistantPart & { text: string } => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text);
      if (texts.length > 0) return texts.join("\n");
    }
  }
  return "";
}

function capOutput(output: string): string {
  if (Buffer.byteLength(output, "utf8") <= OUTPUT_CAP_BYTES) return output;
  let truncated = output.slice(0, OUTPUT_CAP_BYTES);
  while (Buffer.byteLength(truncated, "utf8") > OUTPUT_CAP_BYTES) truncated = truncated.slice(0, -1);
  return `${truncated}\n\n[Output truncated to ${OUTPUT_CAP_BYTES} bytes.]`;
}

// Build a text tool-result. Errors are surfaced in the text content and in
// `details.exitCode` (the AgentToolResult type carries no `isError` field).
function textResult(text: string, details: DispatchDetails): AgentToolResult<DispatchDetails> {
  return { content: [{ type: "text", text }], details };
}

export default function cqSubagentDispatch(pi: ExtensionAPI): void {
  pi.registerTool<typeof DispatchParams, DispatchDetails>({
    name: DISPATCH_TOOL_NAME,
    label: "Dispatch cq agent",
    description: [
      "Dispatch a named cq subagent with a task, running it as an isolated child pi turn",
      "with a filtered toolset. The child cannot itself re-dispatch. Returns the child's",
      "final output as text. Args: { agent, task, isolation? }.",
    ].join(" "),
    parameters: DispatchParams,

    async execute(_toolCallId, params, signal, _onUpdate, ctx): Promise<AgentToolResult<DispatchDetails>> {
      const args = params as DispatchArgs;
      const agentsDir = resolveAgentsDir();
      const cqConfigPath = resolveCqConfigPath(ctx.cwd);

      const baseDetails: DispatchDetails = {
        agent: args.agent,
        agentFile: null,
        // Echo the requested isolation mode. Worktree isolation is a deferred
        // seam (Q128 — explorer/reviewer dispatches need no worktree); recording
        // it keeps the {agent,task,isolation?} convention shape observable for
        // the follow-up that implements it, rather than silently ignoring it.
        isolation: args.isolation ?? null,
        model: null,
        provider: null,
        exitCode: 0,
        excludedTools: [],
        cqConfigPath,
        stderr: "",
      };

      const agent = loadAgent(agentsDir, args.agent);
      if (!agent) {
        return textResult(
          `Unknown cq agent: "${args.agent}". Looked in ${agentsDir} (set ${AGENTS_DIR_ENV} to override).`,
          { ...baseDetails, exitCode: 1 },
        );
      }

      const excludeTools = buildExcludeTools(agent.disallowedTools);
      // Parent's currently-active model is the child default (T224 scope; T225
      // adds tier resolution). provider+id come from ctx.model when available.
      const model = ctx.model?.id ?? null;
      const provider = ctx.model?.provider ?? null;

      // The child is a plain `pi -p` process launched WITHOUT
      // `--extension cq-subagent-dispatch.ts`. We do NOT pass `--no-extensions`
      // because the provider-registering package extensions (e.g. pi-xai's
      // grok-build) must still load for the child's model to resolve. The
      // re-dispatch guard is the `--exclude-tools` denylist below, which always
      // contains DISPATCH_TOOL_NAME — so even if the dispatch extension is
      // discovered via settings, its tool is filtered out of the child.
      const childArgs: string[] = ["--mode", "json", "-p", "--no-session"];
      if (provider) childArgs.push("--provider", provider);
      if (model) childArgs.push("--model", model);
      if (excludeTools.length > 0) childArgs.push("--exclude-tools", excludeTools.join(","));

      const tmp = writePromptToTempFile(agent.name, agent.systemPrompt);
      childArgs.push("--append-system-prompt", tmp.filePath);
      childArgs.push(args.task);

      const details: DispatchDetails = {
        ...baseDetails,
        agentFile: agent.filePath,
        model,
        provider,
        excludedTools: excludeTools,
      };

      const messages: ChildMessage[] = [];
      let stderr = "";

      try {
        const exitCode = await new Promise<number>((resolve) => {
          const invocation = getPiInvocation(childArgs);
          const proc = spawn(invocation.command, invocation.args, {
            cwd: ctx.cwd,
            shell: false,
            stdio: ["ignore", "pipe", "pipe"],
          });
          let buffer = "";

          const processLine = (line: string): void => {
            if (!line.trim()) return;
            let event: { type?: string; message?: ChildMessage };
            try {
              event = JSON.parse(line) as { type?: string; message?: ChildMessage };
            } catch {
              return;
            }
            if ((event.type === "message_end" || event.type === "tool_result_end") && event.message) {
              messages.push(event.message);
            }
          };

          proc.stdout.on("data", (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) processLine(line);
          });
          proc.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
          proc.on("close", (code) => {
            if (buffer.trim()) processLine(buffer);
            resolve(code ?? 0);
          });
          proc.on("error", () => resolve(1));

          if (signal) {
            const killProc = (): void => {
              proc.kill("SIGTERM");
              setTimeout(() => {
                if (!proc.killed) proc.kill("SIGKILL");
              }, 5000);
            };
            if (signal.aborted) killProc();
            else signal.addEventListener("abort", killProc, { once: true });
          }
        });

        details.exitCode = exitCode;
        details.stderr = stderr;

        const finalText = getFinalOutput(messages);
        if (exitCode !== 0 && !finalText) {
          return textResult(
            `Agent "${agent.name}" exited with code ${exitCode}.\n${stderr || "(no output)"}`,
            details,
          );
        }
        return textResult(capOutput(finalText || "(no output)"), details);
      } finally {
        try {
          fs.rmSync(tmp.dir, { recursive: true, force: true });
        } catch {
          /* ignore cleanup failure */
        }
      }
    },
  });
}
