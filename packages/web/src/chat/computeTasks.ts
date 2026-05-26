/**
 * computeTasks.ts — pure function that derives the live task list from chat events.
 *
 * Iterates all ChatEvent frames and looks for tool_use blocks inside
 * SDKAssistantMessage frames with tool names:
 *   - TaskCreate  : adds a new task (or re-creates if id seen again)
 *   - TaskList    : bulk-creates / updates; each item in the list is merged in
 *   - TaskUpdate  : merges status / content changes for an existing task
 *
 * Tasks are keyed by their `id` field. A task with `status: 'deleted'` is
 * retained in the Map (with status='deleted') so callers can suppress it in
 * rendering; this keeps React keys stable (no card unmounting).
 *
 * Returns a new Map on every call — this is a pure function safe for useMemo.
 */

import type { ChatEvent } from "@cq/shared";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface TaskState {
  id: string;
  content: string;
  status: TaskStatus;
}

// ---------------------------------------------------------------------------
// Helper: normalise status string
// ---------------------------------------------------------------------------

function normaliseStatus(raw: unknown): TaskStatus {
  if (raw === "in_progress" || raw === "completed" || raw === "deleted") return raw;
  return "pending";
}

// ---------------------------------------------------------------------------
// Helper: merge one raw task object into the Map
// ---------------------------------------------------------------------------

function mergeTask(map: Map<string, TaskState>, raw: Record<string, unknown>): void {
  const id = typeof raw["id"] === "string" ? raw["id"] : null;
  if (id === null || id === "") return;

  const existing = map.get(id);
  const content =
    typeof raw["content"] === "string"
      ? raw["content"]
      : (existing?.content ?? "");
  const status = raw["status"] !== undefined ? normaliseStatus(raw["status"]) : (existing?.status ?? "pending");

  map.set(id, { id, content, status });
}

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/**
 * Derive the live task Map from an ordered array of ChatEvent frames.
 * Keys are task ids; values are the latest merged TaskState.
 */
export function computeTasks(chatEvents: ChatEvent[]): Map<string, TaskState> {
  const tasks = new Map<string, TaskState>();

  for (const evt of chatEvents) {
    const sdkEvent = evt.sdkEvent as Record<string, unknown>;
    if (sdkEvent["type"] !== "assistant") continue;

    const message = sdkEvent["message"] as Record<string, unknown> | undefined;
    const content = Array.isArray(message?.["content"]) ? (message!["content"] as unknown[]) : [];

    for (const block of content) {
      if (block === null || typeof block !== "object") continue;
      const b = block as Record<string, unknown>;
      if (b["type"] !== "tool_use") continue;
      if (typeof b["name"] !== "string") continue;
      const toolName = b["name"] as string;
      const input = (b["input"] !== null && typeof b["input"] === "object")
        ? (b["input"] as Record<string, unknown>)
        : null;
      if (input === null) continue;

      if (toolName === "TaskCreate" || toolName === "TaskUpdate") {
        mergeTask(tasks, input);
      } else if (toolName === "TaskList") {
        // TaskList carries an array of task objects under `tasks` key.
        const list = Array.isArray(input["tasks"]) ? (input["tasks"] as unknown[]) : [];
        for (const item of list) {
          if (item !== null && typeof item === "object") {
            mergeTask(tasks, item as Record<string, unknown>);
          }
        }
      }
    }
  }

  return tasks;
}
