import type { IssueStatus } from "@paperclipai/shared";

/**
 * A kanban column maps a display key to one or more issue statuses.
 * When an issue is dropped onto a column, it receives the column's `defaultStatus`.
 */
export interface KanbanColumnDef {
  /** Unique key used as the droppable ID and for i18n lookup */
  id: string;
  /** Issue statuses that belong to this column */
  statuses: IssueStatus[];
  /** The status to assign when an issue is dropped into this column */
  defaultStatus: IssueStatus;
}

/**
 * Default kanban columns per the PRD:
 * To Do (backlog + todo), In Progress, Review, Done.
 * Blocked and cancelled are shown as separate columns so issues
 * in those states remain visible and can be dragged out.
 */
export const DEFAULT_KANBAN_COLUMNS: KanbanColumnDef[] = [
  { id: "todo", statuses: ["backlog", "todo"], defaultStatus: "todo" },
  { id: "in_progress", statuses: ["in_progress"], defaultStatus: "in_progress" },
  { id: "in_review", statuses: ["in_review"], defaultStatus: "in_review" },
  { id: "done", statuses: ["done"], defaultStatus: "done" },
  { id: "blocked", statuses: ["blocked"], defaultStatus: "blocked" },
  { id: "cancelled", statuses: ["cancelled"], defaultStatus: "cancelled" },
];

/**
 * Groups issues into columns based on the column definitions.
 * Issues whose status doesn't match any column are silently omitted.
 */
export function groupIssuesByColumn<T extends { status: string }>(
  issues: T[],
  columns: KanbanColumnDef[],
): Record<string, T[]> {
  // Build a lookup: status -> columnId
  const statusToColumn: Record<string, string> = {};
  for (const col of columns) {
    for (const s of col.statuses) {
      statusToColumn[s] = col.id;
    }
  }

  // Initialize empty arrays for every column
  const grouped: Record<string, T[]> = {};
  for (const col of columns) {
    grouped[col.id] = [];
  }

  // Distribute issues into columns
  for (const issue of issues) {
    const colId = statusToColumn[issue.status];
    if (colId && grouped[colId]) {
      grouped[colId].push(issue);
    }
  }

  return grouped;
}

/**
 * When an issue is dropped on a target (column or card), resolve the
 * target status. Returns null if the target can't be identified.
 *
 * @param overId - The dnd-kit `over.id` value (column id or card id)
 * @param columns - The column definitions
 * @param findIssueStatus - A callback to look up a card's current status by its id
 */
export function resolveDropTargetStatus(
  overId: string,
  columns: KanbanColumnDef[],
  findIssueStatus: (id: string) => string | undefined,
): IssueStatus | null {
  // Check if the overId is a column id
  const column = columns.find((c) => c.id === overId);
  if (column) return column.defaultStatus;

  // It's a card — find which column the card's status maps to
  const cardStatus = findIssueStatus(overId);
  if (!cardStatus) return null;

  const cardColumn = columns.find((c) => c.statuses.includes(cardStatus as IssueStatus));
  if (cardColumn) return cardColumn.defaultStatus;

  return null;
}

/**
 * Column display labels for i18n.
 * Keys match the column `id` values used in DEFAULT_KANBAN_COLUMNS.
 */
export const KANBAN_COLUMN_I18N_KEYS: Record<string, string> = {
  todo: "kanban.columns.todo",
  in_progress: "kanban.columns.inProgress",
  in_review: "kanban.columns.review",
  done: "kanban.columns.done",
  blocked: "kanban.columns.blocked",
  cancelled: "kanban.columns.cancelled",
};
