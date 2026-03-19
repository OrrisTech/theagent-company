import { describe, expect, it } from "vitest";
import {
  DEFAULT_KANBAN_COLUMNS,
  groupIssuesByColumn,
  resolveDropTargetStatus,
  KANBAN_COLUMN_I18N_KEYS,
  type KanbanColumnDef,
} from "./kanban";

// Minimal issue-like objects for testing
function makeIssue(id: string, status: string, extra?: Record<string, unknown>) {
  return { id, status, title: `Issue ${id}`, priority: "medium", ...extra };
}

describe("DEFAULT_KANBAN_COLUMNS", () => {
  it("contains the four PRD-required columns plus blocked and cancelled", () => {
    const ids = DEFAULT_KANBAN_COLUMNS.map((c) => c.id);
    expect(ids).toContain("todo");
    expect(ids).toContain("in_progress");
    expect(ids).toContain("in_review");
    expect(ids).toContain("done");
    expect(ids).toContain("blocked");
    expect(ids).toContain("cancelled");
  });

  it("maps both backlog and todo statuses to the todo column", () => {
    const todoCol = DEFAULT_KANBAN_COLUMNS.find((c) => c.id === "todo");
    expect(todoCol).toBeDefined();
    expect(todoCol!.statuses).toContain("backlog");
    expect(todoCol!.statuses).toContain("todo");
  });

  it("each column has a valid defaultStatus within its statuses", () => {
    for (const col of DEFAULT_KANBAN_COLUMNS) {
      expect(col.statuses).toContain(col.defaultStatus);
    }
  });

  it("covers all seven issue statuses exactly once", () => {
    const allStatuses = DEFAULT_KANBAN_COLUMNS.flatMap((c) => c.statuses);
    expect(allStatuses.sort()).toEqual(
      ["backlog", "blocked", "cancelled", "done", "in_progress", "in_review", "todo"].sort(),
    );
    // No duplicates
    expect(new Set(allStatuses).size).toBe(allStatuses.length);
  });
});

describe("groupIssuesByColumn", () => {
  const columns = DEFAULT_KANBAN_COLUMNS;

  it("groups issues into the correct columns", () => {
    const issues = [
      makeIssue("1", "backlog"),
      makeIssue("2", "todo"),
      makeIssue("3", "in_progress"),
      makeIssue("4", "in_review"),
      makeIssue("5", "done"),
      makeIssue("6", "blocked"),
      makeIssue("7", "cancelled"),
    ];

    const grouped = groupIssuesByColumn(issues, columns);

    // backlog and todo both land in the "todo" column
    expect(grouped["todo"].map((i) => i.id)).toEqual(["1", "2"]);
    expect(grouped["in_progress"].map((i) => i.id)).toEqual(["3"]);
    expect(grouped["in_review"].map((i) => i.id)).toEqual(["4"]);
    expect(grouped["done"].map((i) => i.id)).toEqual(["5"]);
    expect(grouped["blocked"].map((i) => i.id)).toEqual(["6"]);
    expect(grouped["cancelled"].map((i) => i.id)).toEqual(["7"]);
  });

  it("returns empty arrays for columns with no matching issues", () => {
    const issues = [makeIssue("1", "in_progress")];
    const grouped = groupIssuesByColumn(issues, columns);

    expect(grouped["todo"]).toEqual([]);
    expect(grouped["in_review"]).toEqual([]);
    expect(grouped["done"]).toEqual([]);
    expect(grouped["blocked"]).toEqual([]);
    expect(grouped["cancelled"]).toEqual([]);
    expect(grouped["in_progress"]).toHaveLength(1);
  });

  it("silently omits issues with unknown statuses", () => {
    const issues = [
      makeIssue("1", "in_progress"),
      makeIssue("2", "unknown_status"),
    ];
    const grouped = groupIssuesByColumn(issues, columns);

    const totalGrouped = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(totalGrouped).toBe(1);
  });

  it("handles an empty issue list", () => {
    const grouped = groupIssuesByColumn([], columns);

    for (const col of columns) {
      expect(grouped[col.id]).toEqual([]);
    }
  });

  it("works with custom column definitions", () => {
    const customColumns: KanbanColumnDef[] = [
      { id: "open", statuses: ["backlog", "todo", "in_progress"], defaultStatus: "todo" },
      { id: "closed", statuses: ["done", "cancelled"], defaultStatus: "done" },
    ];

    const issues = [
      makeIssue("1", "backlog"),
      makeIssue("2", "in_progress"),
      makeIssue("3", "done"),
      makeIssue("4", "cancelled"),
      makeIssue("5", "in_review"), // not in custom columns, should be omitted
    ];

    const grouped = groupIssuesByColumn(issues, customColumns);

    expect(grouped["open"].map((i) => i.id)).toEqual(["1", "2"]);
    expect(grouped["closed"].map((i) => i.id)).toEqual(["3", "4"]);
  });

  it("preserves insertion order of issues within a column", () => {
    const issues = [
      makeIssue("a", "todo"),
      makeIssue("b", "backlog"),
      makeIssue("c", "todo"),
    ];
    const grouped = groupIssuesByColumn(issues, columns);
    expect(grouped["todo"].map((i) => i.id)).toEqual(["a", "b", "c"]);
  });
});

describe("resolveDropTargetStatus", () => {
  const columns = DEFAULT_KANBAN_COLUMNS;
  const issueStatuses: Record<string, string> = {
    "issue-1": "backlog",
    "issue-2": "in_progress",
    "issue-3": "done",
    "issue-4": "in_review",
  };
  const findStatus = (id: string) => issueStatuses[id];

  it("returns the defaultStatus when dropping on a column id", () => {
    expect(resolveDropTargetStatus("todo", columns, findStatus)).toBe("todo");
    expect(resolveDropTargetStatus("in_progress", columns, findStatus)).toBe("in_progress");
    expect(resolveDropTargetStatus("in_review", columns, findStatus)).toBe("in_review");
    expect(resolveDropTargetStatus("done", columns, findStatus)).toBe("done");
    expect(resolveDropTargetStatus("blocked", columns, findStatus)).toBe("blocked");
    expect(resolveDropTargetStatus("cancelled", columns, findStatus)).toBe("cancelled");
  });

  it("returns the column's defaultStatus when dropping on a card in that column", () => {
    // issue-1 has status "backlog" which maps to "todo" column
    expect(resolveDropTargetStatus("issue-1", columns, findStatus)).toBe("todo");
    // issue-2 has status "in_progress"
    expect(resolveDropTargetStatus("issue-2", columns, findStatus)).toBe("in_progress");
    // issue-3 has status "done"
    expect(resolveDropTargetStatus("issue-3", columns, findStatus)).toBe("done");
  });

  it("returns null when the over id is not a column and not a known card", () => {
    expect(resolveDropTargetStatus("unknown-id", columns, findStatus)).toBeNull();
  });

  it("returns null when findIssueStatus returns undefined", () => {
    const emptyLookup = () => undefined;
    expect(resolveDropTargetStatus("some-card", columns, emptyLookup)).toBeNull();
  });

  it("handles dropping a backlog card onto the todo column — maps to 'todo'", () => {
    // This is the key status-merging behavior: backlog cards that get dropped
    // onto the "todo" column should receive "todo" as the new status
    expect(resolveDropTargetStatus("todo", columns, findStatus)).toBe("todo");
  });
});

describe("KANBAN_COLUMN_I18N_KEYS", () => {
  it("has a key for every default column", () => {
    for (const col of DEFAULT_KANBAN_COLUMNS) {
      expect(KANBAN_COLUMN_I18N_KEYS[col.id]).toBeDefined();
      expect(typeof KANBAN_COLUMN_I18N_KEYS[col.id]).toBe("string");
    }
  });

  it("all i18n key values follow the kanban.columns.* pattern", () => {
    for (const key of Object.values(KANBAN_COLUMN_I18N_KEYS)) {
      expect(key).toMatch(/^kanban\.columns\./);
    }
  });
});
