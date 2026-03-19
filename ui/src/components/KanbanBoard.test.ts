import { describe, expect, it } from "vitest";
import {
  DEFAULT_KANBAN_COLUMNS,
  KANBAN_COLUMN_I18N_KEYS,
  groupIssuesByColumn,
  resolveDropTargetStatus,
} from "../lib/kanban";
import type { IssueStatus } from "@paperclipai/shared";

/**
 * Integration tests for the kanban board drag-and-drop status change flow.
 *
 * These tests simulate the full sequence:
 * 1. Issues are grouped into columns
 * 2. A card is dragged to a new column
 * 3. The target status is resolved
 * 4. The issue's status is updated
 * 5. Re-grouping reflects the change
 *
 * We test the logic layer directly since dnd-kit's DOM interactions
 * require a full browser environment. The component wires these
 * functions together — if the logic is correct, the UI works.
 */

interface MockIssue {
  id: string;
  status: IssueStatus;
  title: string;
  priority: string;
}

function makeIssue(id: string, status: IssueStatus): MockIssue {
  return { id, status, title: `Issue ${id}`, priority: "medium" };
}

describe("Kanban drag-and-drop integration", () => {
  const columns = DEFAULT_KANBAN_COLUMNS;

  it("moving an issue from backlog to in_progress updates status correctly", () => {
    // Setup: issues in various states
    const issues: MockIssue[] = [
      makeIssue("1", "backlog"),
      makeIssue("2", "todo"),
      makeIssue("3", "in_progress"),
    ];

    // Step 1: Group by column
    const grouped = groupIssuesByColumn(issues, columns);
    expect(grouped["todo"].map((i) => i.id)).toEqual(["1", "2"]);
    expect(grouped["in_progress"].map((i) => i.id)).toEqual(["3"]);

    // Step 2: Simulate drag — issue "1" (backlog) dropped on "in_progress" column
    const issueStatusMap = new Map(issues.map((i) => [i.id, i.status]));
    const targetStatus = resolveDropTargetStatus(
      "in_progress",
      columns,
      (id) => issueStatusMap.get(id),
    );
    expect(targetStatus).toBe("in_progress");

    // Step 3: Apply the status change
    const draggedIssue = issues.find((i) => i.id === "1")!;
    expect(targetStatus).not.toBe(draggedIssue.status); // Status actually changed
    draggedIssue.status = targetStatus!;

    // Step 4: Re-group — issue "1" should now be in "in_progress" column
    const regrouped = groupIssuesByColumn(issues, columns);
    expect(regrouped["todo"].map((i) => i.id)).toEqual(["2"]);
    expect(regrouped["in_progress"].map((i) => i.id)).toEqual(["1", "3"]);
  });

  it("moving an issue from in_progress to done", () => {
    const issues: MockIssue[] = [
      makeIssue("a", "in_progress"),
      makeIssue("b", "done"),
    ];

    const issueStatusMap = new Map(issues.map((i) => [i.id, i.status]));
    const targetStatus = resolveDropTargetStatus(
      "done",
      columns,
      (id) => issueStatusMap.get(id),
    );
    expect(targetStatus).toBe("done");

    // Apply
    issues[0].status = targetStatus!;
    const regrouped = groupIssuesByColumn(issues, columns);
    expect(regrouped["in_progress"]).toEqual([]);
    expect(regrouped["done"].map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("dropping a card onto another card in a different column resolves correctly", () => {
    const issues: MockIssue[] = [
      makeIssue("src", "todo"),
      makeIssue("target-card", "in_review"),
    ];

    const issueStatusMap = new Map(issues.map((i) => [i.id, i.status]));

    // Drop "src" onto "target-card" which is in the in_review column
    const targetStatus = resolveDropTargetStatus(
      "target-card",
      columns,
      (id) => issueStatusMap.get(id),
    );

    // Should resolve to in_review's defaultStatus
    expect(targetStatus).toBe("in_review");

    // Apply and verify
    issues[0].status = targetStatus!;
    const regrouped = groupIssuesByColumn(issues, columns);
    expect(regrouped["todo"]).toEqual([]);
    expect(regrouped["in_review"].map((i) => i.id)).toEqual(["src", "target-card"]);
  });

  it("dropping a card on the same column does not change status", () => {
    const issues: MockIssue[] = [
      makeIssue("1", "todo"),
      makeIssue("2", "todo"),
    ];

    const issueStatusMap = new Map(issues.map((i) => [i.id, i.status]));
    const targetStatus = resolveDropTargetStatus(
      "todo",
      columns,
      (id) => issueStatusMap.get(id),
    );

    // The resolved status should be "todo", same as the issue's current status
    // The KanbanBoard component skips the update when targetStatus === issue.status
    expect(targetStatus).toBe("todo");
    expect(issues[0].status).toBe("todo");
    // No change needed — the component's `if (targetStatus !== issue.status)` guard handles this
  });

  it("moving from blocked back to in_progress", () => {
    const issues: MockIssue[] = [makeIssue("blocked-1", "blocked")];

    const issueStatusMap = new Map(issues.map((i) => [i.id, i.status]));
    const targetStatus = resolveDropTargetStatus(
      "in_progress",
      columns,
      (id) => issueStatusMap.get(id),
    );
    expect(targetStatus).toBe("in_progress");

    issues[0].status = targetStatus!;
    const regrouped = groupIssuesByColumn(issues, columns);
    expect(regrouped["blocked"]).toEqual([]);
    expect(regrouped["in_progress"].map((i) => i.id)).toEqual(["blocked-1"]);
  });

  it("complete workflow: issue flows through all four main stages", () => {
    const issue = makeIssue("flow-1", "backlog");
    const issues = [issue];
    const statusLookup = () => issue.status;

    // backlog -> todo column (stays as todo)
    let target = resolveDropTargetStatus("todo", columns, statusLookup);
    expect(target).toBe("todo");
    issue.status = target!;

    // todo -> in_progress
    target = resolveDropTargetStatus("in_progress", columns, statusLookup);
    expect(target).toBe("in_progress");
    issue.status = target!;

    // in_progress -> in_review
    target = resolveDropTargetStatus("in_review", columns, statusLookup);
    expect(target).toBe("in_review");
    issue.status = target!;

    // in_review -> done
    target = resolveDropTargetStatus("done", columns, statusLookup);
    expect(target).toBe("done");
    issue.status = target!;

    // Final grouping check
    const grouped = groupIssuesByColumn(issues, columns);
    expect(grouped["done"].map((i) => i.id)).toEqual(["flow-1"]);
    expect(grouped["todo"]).toEqual([]);
    expect(grouped["in_progress"]).toEqual([]);
    expect(grouped["in_review"]).toEqual([]);
  });
});

describe("Kanban column configuration", () => {
  it("all default columns have an i18n key mapping", () => {
    for (const col of DEFAULT_KANBAN_COLUMNS) {
      expect(KANBAN_COLUMN_I18N_KEYS[col.id]).toBeDefined();
    }
  });

  it("column ids are unique", () => {
    const ids = DEFAULT_KANBAN_COLUMNS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("no status appears in multiple columns", () => {
    const seen = new Set<string>();
    for (const col of DEFAULT_KANBAN_COLUMNS) {
      for (const status of col.statuses) {
        expect(seen.has(status)).toBe(false);
        seen.add(status);
      }
    }
  });
});
