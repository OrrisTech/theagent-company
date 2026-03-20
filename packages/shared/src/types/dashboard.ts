import type { WorkflowRunStatus, WorkflowRunTrigger } from "../constants.js";

/** Active workflow run with step progress info, returned by the dashboard API. */
export interface WorkflowDashboardActiveRun {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  trigger: WorkflowRunTrigger;
  startedAt: Date | null;
  totalCostCents: number | null;
  totalDurationMs: number | null;
  stepsTotal: number;
  stepsCompleted: number;
}

/** Recent workflow completion, returned by the dashboard API. */
export interface WorkflowDashboardCompletion {
  id: string;
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  startedAt: Date | null;
  finishedAt: Date | null;
  totalCostCents: number | null;
  totalDurationMs: number | null;
}

/** Pending approval step, returned by the dashboard API. */
export interface WorkflowDashboardApproval {
  stepRunId: string;
  runId: string;
  stepIndex: number;
  workflowName: string;
  createdAt: Date;
}

/** Workflow-centric dashboard overview response. */
export interface WorkflowDashboardOverview {
  activeRuns: WorkflowDashboardActiveRun[];
  recentCompletions: WorkflowDashboardCompletion[];
  pendingApprovalSteps: WorkflowDashboardApproval[];
  quickStats: {
    workflowsToday: number;
    successRate: number;
    avgDurationMs: number;
    totalCostCents: number;
  };
}

export interface DashboardSummary {
  companyId: string;
  agents: {
    active: number;
    running: number;
    paused: number;
    error: number;
  };
  tasks: {
    open: number;
    inProgress: number;
    blocked: number;
    done: number;
  };
  costs: {
    monthSpendCents: number;
    monthBudgetCents: number;
    monthUtilizationPercent: number;
  };
  pendingApprovals: number;
  budgets: {
    activeIncidents: number;
    pendingApprovals: number;
    pausedAgents: number;
    pausedProjects: number;
  };
}
