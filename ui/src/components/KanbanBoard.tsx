import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@/lib/router";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { StatusIcon } from "./StatusIcon";
import { PriorityIcon } from "./PriorityIcon";
import { Identity } from "./Identity";
import {
  DEFAULT_KANBAN_COLUMNS,
  KANBAN_COLUMN_I18N_KEYS,
  groupIssuesByColumn,
  resolveDropTargetStatus,
  type KanbanColumnDef,
} from "@/lib/kanban";
import type { Issue } from "@theagentcompany/shared";

interface Agent {
  id: string;
  name: string;
}

interface KanbanBoardProps {
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
  /** Custom column definitions. Falls back to DEFAULT_KANBAN_COLUMNS. */
  columns?: KanbanColumnDef[];
  onUpdateIssue: (id: string, data: Record<string, unknown>) => void;
}

/* ── Droppable Column ── */

function KanbanColumn({
  columnDef,
  label,
  issues,
  agents,
  liveIssueIds,
}: {
  columnDef: KanbanColumnDef;
  label: string;
  issues: Issue[];
  agents?: Agent[];
  liveIssueIds?: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: columnDef.id });

  return (
    <div
      className="flex flex-col min-w-[260px] w-[260px] shrink-0 h-full"
      role="region"
      aria-label={label}
    >
      <div className="flex items-center gap-2 px-2 py-2 mb-1">
        <StatusIcon status={columnDef.defaultStatus} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="text-xs text-muted-foreground/60 ml-auto tabular-nums">
          {issues.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[120px] rounded-md p-1 space-y-1 transition-colors overflow-y-auto ${
          isOver ? "bg-accent/40" : "bg-muted/20"
        }`}
      >
        <SortableContext
          items={issues.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {issues.map((issue) => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              agents={agents}
              isLive={liveIssueIds?.has(issue.id)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}

/* ── Draggable Card ── */

function KanbanCard({
  issue,
  agents,
  isLive,
  isOverlay,
}: {
  issue: Issue;
  agents?: Agent[];
  isLive?: boolean;
  isOverlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: issue.id, data: { issue } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  const labels = issue.labels ?? [];

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-md border bg-card p-2.5 cursor-grab active:cursor-grabbing transition-shadow ${
        isDragging && !isOverlay ? "opacity-30" : ""
      } ${isOverlay ? "shadow-lg ring-1 ring-primary/20" : "hover:shadow-sm"}`}
      role="listitem"
      aria-label={issue.title}
    >
      <Link
        to={`/issues/${issue.identifier ?? issue.id}`}
        className="block no-underline text-inherit"
        onClick={(e) => {
          // Prevent navigation during drag
          if (isDragging) e.preventDefault();
        }}
      >
        <div className="flex items-start gap-1.5 mb-1.5">
          <span className="text-xs text-muted-foreground font-mono shrink-0">
            {issue.identifier ?? issue.id.slice(0, 8)}
          </span>
          {isLive && (
            <span className="relative flex h-2 w-2 shrink-0 mt-0.5">
              <span className="animate-pulse absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
          )}
        </div>
        <p className="text-sm leading-snug line-clamp-2 mb-2">{issue.title}</p>

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {labels.slice(0, 3).map((label) => (
              <span
                key={label.id}
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none"
                style={{
                  borderColor: label.color,
                  color: label.color,
                  backgroundColor: `${label.color}1f`,
                }}
              >
                {label.name}
              </span>
            ))}
            {labels.length > 3 && (
              <span className="text-[10px] text-muted-foreground self-center">
                +{labels.length - 3}
              </span>
            )}
          </div>
        )}

        {/* Bottom row: priority + assignee */}
        <div className="flex items-center gap-2">
          <PriorityIcon priority={issue.priority} />
          {issue.assigneeAgentId && (() => {
            const name = agentName(issue.assigneeAgentId);
            return name ? (
              <Identity name={name} size="xs" />
            ) : (
              <span className="text-xs text-muted-foreground font-mono">
                {issue.assigneeAgentId.slice(0, 8)}
              </span>
            );
          })()}
        </div>
      </Link>
    </div>
  );
}

/* ── Main Board ── */

export function KanbanBoard({
  issues,
  agents,
  liveIssueIds,
  columns = DEFAULT_KANBAN_COLUMNS,
  onUpdateIssue,
}: KanbanBoardProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const columnIssues = useMemo(
    () => groupIssuesByColumn(issues, columns),
    [issues, columns],
  );

  const activeIssue = useMemo(
    () => (activeId ? issues.find((i) => i.id === activeId) : null),
    [activeId, issues],
  );

  // Build a fast lookup for card id -> status
  const issueStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const issue of issues) {
      map.set(issue.id, issue.status);
    }
    return map;
  }, [issues]);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const issueId = active.id as string;
    const issue = issues.find((i) => i.id === issueId);
    if (!issue) return;

    const targetStatus = resolveDropTargetStatus(
      over.id as string,
      columns,
      (id) => issueStatusMap.get(id),
    );

    if (targetStatus && targetStatus !== issue.status) {
      onUpdateIssue(issueId, { status: targetStatus });
    }
  }

  function handleDragOver(_event: DragOverEvent) {
    // Visual feedback is handled via isOver in KanbanColumn
  }

  // Resolve column labels via i18n, falling back to a title-cased id
  function columnLabel(col: KanbanColumnDef): string {
    const i18nKey = KANBAN_COLUMN_I18N_KEYS[col.id];
    if (i18nKey) {
      const translated = t(i18nKey);
      // i18next returns the key itself when missing — fall back to default label
      if (translated !== i18nKey) return translated;
    }
    return col.id.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 h-full">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            columnDef={col}
            label={columnLabel(col)}
            issues={columnIssues[col.id] ?? []}
            agents={agents}
            liveIssueIds={liveIssueIds}
          />
        ))}
      </div>
      <DragOverlay>
        {activeIssue ? (
          <KanbanCard issue={activeIssue} agents={agents} isOverlay />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
