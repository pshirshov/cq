/**
 * TaskListSidebar.tsx — pinned panel showing the live task list.
 *
 * Renders a fixed-position panel on the right side of the viewport (below the
 * Indicator dot). Each task is a card keyed by its id so React performs
 * in-place updates as status transitions — no card unmounting on state change.
 *
 * Tasks with status 'deleted' are hidden via CSS (display:none) rather than
 * unmounted, keeping DOM nodes stable for isSameNode assertions in tests.
 *
 * The panel is always visible when the Map is non-empty. Callers may choose to
 * conditionally render this component when tasks.size > 0 if they prefer to
 * hide the panel entirely when there are no tasks.
 */

import { createElement } from "react";
import type { TaskState } from "./computeTasks";
import styles from "../styles/TaskListSidebar.module.css";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TaskListSidebarProps {
  tasks: Map<string, TaskState>;
}

// ---------------------------------------------------------------------------
// Badge helper
// ---------------------------------------------------------------------------

function badgeClass(status: TaskState["status"]): string {
  switch (status) {
    case "in_progress": return styles.badgeInProgress ?? "";
    case "completed":   return styles.badgeCompleted ?? "";
    case "deleted":     return styles.badgeDeleted ?? "";
    default:            return styles.badgePending ?? "";
  }
}

function badgeLabel(status: TaskState["status"]): string {
  switch (status) {
    case "in_progress": return "in_progress";
    case "completed":   return "completed";
    case "deleted":     return "deleted";
    default:            return "pending";
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TaskListSidebar({ tasks }: TaskListSidebarProps): React.ReactElement {
  const cards = Array.from(tasks.values()).map((task) =>
    createElement(
      "div",
      {
        key: task.id,
        className: `${styles.card ?? ""} ${task.status === "deleted" ? (styles.cardDeleted ?? "") : ""}`.trim(),
        "data-testid": `task-card-${task.id}`,
        "data-task-status": task.status,
      },
      createElement(
        "span",
        {
          className: `${styles.badge ?? ""} ${badgeClass(task.status)}`.trim(),
          "data-testid": `task-badge-${task.id}`,
        },
        badgeLabel(task.status),
      ),
      createElement(
        "span",
        { className: styles.content ?? "", "data-testid": `task-content-${task.id}` },
        task.content,
      ),
    ),
  );

  return createElement(
    "div",
    { className: styles.panel ?? "", "data-testid": "task-list-sidebar" },
    ...cards,
  );
}
