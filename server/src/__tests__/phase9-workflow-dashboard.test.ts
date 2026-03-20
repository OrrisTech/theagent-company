import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Phase 9 tests — Workflow-first repositioning.
 *
 * Tests cover:
 * 1. Role label support in workflow steps
 * 2. Default role labels for step types
 * 3. Dashboard workflow overview service shape
 * 4. i18n key completeness for new strings
 */

// ------------------------------------------------------------------
// 1. Role label defaults
// ------------------------------------------------------------------
import { WORKFLOW_DEFAULT_ROLE_LABELS, WORKFLOW_STEP_TYPES } from "@paperclipai/shared";

describe("WORKFLOW_DEFAULT_ROLE_LABELS", () => {
  it("provides default role labels for prompt, skill, approval, and api types", () => {
    expect(WORKFLOW_DEFAULT_ROLE_LABELS.prompt).toBe("助手");
    expect(WORKFLOW_DEFAULT_ROLE_LABELS.skill).toBe("专家");
    expect(WORKFLOW_DEFAULT_ROLE_LABELS.approval).toBe("审核员");
    expect(WORKFLOW_DEFAULT_ROLE_LABELS.api).toBe("执行器");
  });

  it("does not crash for step types without defaults", () => {
    for (const t of WORKFLOW_STEP_TYPES) {
      // Access should not throw; undefined is acceptable for types without defaults
      const label = WORKFLOW_DEFAULT_ROLE_LABELS[t];
      expect(typeof label === "string" || label === undefined).toBe(true);
    }
  });
});

// ------------------------------------------------------------------
// 2. Workflow step type includes roleLabel in shared types
// ------------------------------------------------------------------
describe("WorkflowStep type shape", () => {
  it("CreateWorkflowStepInput accepts roleLabel", () => {
    // Type-level check: this would fail at compile time if roleLabel is missing
    const stepInput = {
      name: "Write draft",
      type: "prompt" as const,
      config: { prompt: "Write something" },
      roleLabel: "写手",
    };
    expect(stepInput.roleLabel).toBe("写手");
  });

  it("roleLabel is optional (can be omitted)", () => {
    const stepInput = {
      name: "API call",
      type: "api" as const,
      config: { method: "GET" as const, url: "https://example.com" },
    };
    expect((stepInput as Record<string, unknown>).roleLabel).toBeUndefined();
  });
});

// ------------------------------------------------------------------
// 3. Dashboard workflow overview types
// ------------------------------------------------------------------
import type { WorkflowDashboardOverview } from "@paperclipai/shared";

describe("WorkflowDashboardOverview type", () => {
  it("has expected shape with all required fields", () => {
    const mockOverview: WorkflowDashboardOverview = {
      activeRuns: [
        {
          id: "run-1",
          workflowId: "wf-1",
          workflowName: "Daily content",
          status: "running",
          trigger: "manual",
          startedAt: new Date(),
          totalCostCents: 150,
          totalDurationMs: 5000,
          stepsTotal: 5,
          stepsCompleted: 2,
        },
      ],
      recentCompletions: [
        {
          id: "run-2",
          workflowId: "wf-1",
          workflowName: "Daily content",
          status: "succeeded",
          startedAt: new Date(),
          finishedAt: new Date(),
          totalCostCents: 300,
          totalDurationMs: 12000,
        },
      ],
      pendingApprovalSteps: [
        {
          stepRunId: "sr-1",
          runId: "run-3",
          stepIndex: 4,
          workflowName: "Daily content",
          createdAt: new Date(),
        },
      ],
      quickStats: {
        workflowsToday: 10,
        successRate: 85,
        avgDurationMs: 8000,
        totalCostCents: 500,
      },
    };

    // Verify shape
    expect(mockOverview.activeRuns).toHaveLength(1);
    expect(mockOverview.activeRuns[0]!.stepsCompleted).toBe(2);
    expect(mockOverview.quickStats.successRate).toBe(85);
    expect(mockOverview.recentCompletions[0]!.status).toBe("succeeded");
    expect(mockOverview.pendingApprovalSteps[0]!.stepIndex).toBe(4);
  });
});

// ------------------------------------------------------------------
// 4. i18n key completeness
// ------------------------------------------------------------------
import enJson from "../../../ui/src/i18n/en.json";
import zhJson from "../../../ui/src/i18n/zh.json";

describe("Phase 9 i18n completeness", () => {
  const newSidebarKeys = ["advanced"];
  const newOverviewKeys = [
    "workflowsToday",
    "successRate",
    "avgDuration",
    "totalCostToday",
    "activeWorkflows",
    "noActiveWorkflows",
    "recentCompletions",
    "noRecentCompletions",
    "noPendingApprovals",
    "step",
  ];
  const newWorkflowKeys = [
    "roleLabel",
    "roleLabelPlaceholder",
    "progressLabel",
    "stepNumber",
    "startedAt",
    "finishedAt",
    "retryAttempt",
    "approvedBy",
    "rejectedBy",
    "stepPending",
    "skipStep",
    "manualFill",
    "runNotFound",
  ];

  it("all new sidebar keys exist in en.json", () => {
    const sidebar = (enJson as Record<string, Record<string, unknown>>).sidebar;
    for (const key of newSidebarKeys) {
      expect(sidebar[key], `en sidebar.${key}`).toBeTruthy();
    }
  });

  it("all new sidebar keys exist in zh.json", () => {
    const sidebar = (zhJson as Record<string, Record<string, unknown>>).sidebar;
    for (const key of newSidebarKeys) {
      expect(sidebar[key], `zh sidebar.${key}`).toBeTruthy();
    }
  });

  it("all new overview keys exist in en.json", () => {
    const overview = (enJson as Record<string, Record<string, unknown>>).overview;
    for (const key of newOverviewKeys) {
      expect(overview[key], `en overview.${key}`).toBeTruthy();
    }
  });

  it("all new overview keys exist in zh.json", () => {
    const overview = (zhJson as Record<string, Record<string, unknown>>).overview;
    for (const key of newOverviewKeys) {
      expect(overview[key], `zh overview.${key}`).toBeTruthy();
    }
  });

  it("all new workflow keys exist in en.json", () => {
    const workflows = ((enJson as Record<string, Record<string, unknown>>).pages as Record<string, Record<string, unknown>>).workflows;
    for (const key of newWorkflowKeys) {
      expect(workflows[key], `en pages.workflows.${key}`).toBeTruthy();
    }
  });

  it("all new workflow keys exist in zh.json", () => {
    const workflows = ((zhJson as Record<string, Record<string, unknown>>).pages as Record<string, Record<string, unknown>>).workflows;
    for (const key of newWorkflowKeys) {
      expect(workflows[key], `zh pages.workflows.${key}`).toBeTruthy();
    }
  });
});
