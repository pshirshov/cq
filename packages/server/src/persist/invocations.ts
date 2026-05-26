import type { Database, Statement } from "bun:sqlite";
import type { InvocationRow } from "@cq/shared";

// ---------------------------------------------------------------------------
// Column mapping helpers (camelCase ↔ snake_case)
// ---------------------------------------------------------------------------

interface InvocationSqlRow {
  id: string;
  session_id: string;
  parent_invocation_id: string | null;
  agent_name: string;
  agent_id: string | null;
  task_id: string | null;
  tool_use_id: string | null;
  model: string;
  started_at: number;
  ended_at: number | null;
  duration_ms: number | null;
  status: "running" | "completed" | "failed" | "stopped";
  tool_call_count: number;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  prompt_excerpt: string;
  event_log_path: string;
}

function toRow(r: InvocationSqlRow): InvocationRow {
  return {
    id: r.id,
    sessionId: r.session_id,
    parentInvocationId: r.parent_invocation_id,
    agentName: r.agent_name,
    agentId: r.agent_id,
    taskId: r.task_id,
    toolUseId: r.tool_use_id,
    model: r.model,
    startedAt: r.started_at,
    endedAt: r.ended_at,
    durationMs: r.duration_ms,
    status: r.status,
    toolCallCount: r.tool_call_count,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.cost_usd,
    promptExcerpt: r.prompt_excerpt,
    eventLogPath: r.event_log_path,
  };
}

// ---------------------------------------------------------------------------
// InvocationStore
// ---------------------------------------------------------------------------

export class InvocationStore {
  private readonly stmtInsert: Statement;
  private readonly stmtGet: Statement<InvocationSqlRow, [string]>;
  private readonly stmtListForSession: Statement<InvocationSqlRow, [string]>;

  constructor(private readonly db: Database) {
    this.stmtInsert = db.prepare(`
      INSERT INTO invocation
        (id, session_id, parent_invocation_id, agent_name, agent_id,
         task_id, tool_use_id, model, started_at, ended_at, duration_ms,
         status, tool_call_count, input_tokens, output_tokens, cost_usd,
         prompt_excerpt, event_log_path)
      VALUES
        ($id, $session_id, $parent_invocation_id, $agent_name, $agent_id,
         $task_id, $tool_use_id, $model, $started_at, $ended_at, $duration_ms,
         $status, $tool_call_count, $input_tokens, $output_tokens, $cost_usd,
         $prompt_excerpt, $event_log_path)
    `);

    this.stmtGet = db.prepare<InvocationSqlRow, [string]>(
      "SELECT * FROM invocation WHERE id = ?"
    );

    this.stmtListForSession = db.prepare<InvocationSqlRow, [string]>(
      "SELECT * FROM invocation WHERE session_id = ? ORDER BY started_at ASC"
    );
  }

  insert(row: InvocationRow): void {
    this.stmtInsert.run({
      $id: row.id,
      $session_id: row.sessionId,
      $parent_invocation_id: row.parentInvocationId,
      $agent_name: row.agentName,
      $agent_id: row.agentId,
      $task_id: row.taskId,
      $tool_use_id: row.toolUseId,
      $model: row.model,
      $started_at: row.startedAt,
      $ended_at: row.endedAt,
      $duration_ms: row.durationMs,
      $status: row.status,
      $tool_call_count: row.toolCallCount,
      $input_tokens: row.inputTokens,
      $output_tokens: row.outputTokens,
      $cost_usd: row.costUsd,
      $prompt_excerpt: row.promptExcerpt,
      $event_log_path: row.eventLogPath,
    });
  }

  update(id: string, patch: Partial<InvocationRow>): void {
    const sets: string[] = [];
    const params: Record<string, unknown> = { $id: id };

    if (patch.sessionId !== undefined) { sets.push("session_id = $session_id"); params.$session_id = patch.sessionId; }
    if (patch.parentInvocationId !== undefined) { sets.push("parent_invocation_id = $parent_invocation_id"); params.$parent_invocation_id = patch.parentInvocationId; }
    if (patch.agentName !== undefined) { sets.push("agent_name = $agent_name"); params.$agent_name = patch.agentName; }
    if (patch.agentId !== undefined) { sets.push("agent_id = $agent_id"); params.$agent_id = patch.agentId; }
    if (patch.taskId !== undefined) { sets.push("task_id = $task_id"); params.$task_id = patch.taskId; }
    if (patch.toolUseId !== undefined) { sets.push("tool_use_id = $tool_use_id"); params.$tool_use_id = patch.toolUseId; }
    if (patch.model !== undefined) { sets.push("model = $model"); params.$model = patch.model; }
    if (patch.startedAt !== undefined) { sets.push("started_at = $started_at"); params.$started_at = patch.startedAt; }
    if (patch.endedAt !== undefined) { sets.push("ended_at = $ended_at"); params.$ended_at = patch.endedAt; }
    if (patch.durationMs !== undefined) { sets.push("duration_ms = $duration_ms"); params.$duration_ms = patch.durationMs; }
    if (patch.status !== undefined) { sets.push("status = $status"); params.$status = patch.status; }
    if (patch.toolCallCount !== undefined) { sets.push("tool_call_count = $tool_call_count"); params.$tool_call_count = patch.toolCallCount; }
    if (patch.inputTokens !== undefined) { sets.push("input_tokens = $input_tokens"); params.$input_tokens = patch.inputTokens; }
    if (patch.outputTokens !== undefined) { sets.push("output_tokens = $output_tokens"); params.$output_tokens = patch.outputTokens; }
    if (patch.costUsd !== undefined) { sets.push("cost_usd = $cost_usd"); params.$cost_usd = patch.costUsd; }
    if (patch.promptExcerpt !== undefined) { sets.push("prompt_excerpt = $prompt_excerpt"); params.$prompt_excerpt = patch.promptExcerpt; }
    if (patch.eventLogPath !== undefined) { sets.push("event_log_path = $event_log_path"); params.$event_log_path = patch.eventLogPath; }

    if (sets.length === 0) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.db.run(`UPDATE invocation SET ${sets.join(", ")} WHERE id = $id`, params as any);
  }

  get(id: string): InvocationRow | undefined {
    const r = this.stmtGet.get(id);
    return r ? toRow(r) : undefined;
  }

  listForSession(sessionId: string): InvocationRow[] {
    return this.stmtListForSession.all(sessionId).map(toRow);
  }

  delete(id: string): void {
    this.db.run("DELETE FROM invocation WHERE id = ?", [id]);
  }

  searchFts(query: string, limit: number): InvocationRow[] {
    // Wrap the user query in double-quotes so FTS5 treats it as a phrase,
    // avoiding tokenisation of special characters (hyphens, etc.).
    const safeQuery = `"${query.replace(/"/g, '""')}"`;
    const rows = this.db
      .query<InvocationSqlRow, [string, number]>(`
        SELECT i.*
        FROM invocation i
        JOIN invocation_fts fts ON fts.rowid = i.rowid
        WHERE invocation_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `)
      .all(safeQuery, limit);
    return rows.map(toRow);
  }
}
