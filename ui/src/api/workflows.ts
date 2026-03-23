import type {
  WorkflowSummary,
  Workflow,
  WorkflowVersion,
  WorkflowStep,
  WorkflowRun,
  WorkflowStepRun,
  WorkflowTemplate,
  CreateWorkflowInput,
  UpdateWorkflowInput,
  TriggerWorkflowInput,
  ApproveStepInput,
  ResumeWorkflowInput,
} from "@theagentcompany/shared";
import { api } from "./client";

/** Response shape for getWorkflow — includes versions and steps. */
export interface WorkflowDetail {
  workflow: Workflow;
  latestVersion: WorkflowVersion | null;
  steps: WorkflowStep[];
  versions: WorkflowVersion[];
}

/** Response shape for getRun — includes step definitions and step runs. */
export interface WorkflowRunDetail {
  run: WorkflowRun;
  stepRuns: WorkflowStepRun[];
  steps: WorkflowStep[];
}

/** Response shape for create/update — workflow + version info. */
export interface WorkflowMutationResult {
  workflow: Workflow;
  version?: WorkflowVersion;
  newVersion?: WorkflowVersion;
}

/** API client for workflow operations. */
export const workflowApi = {
  // Workflow CRUD
  list: (companyId?: string) =>
    api.get<WorkflowSummary[]>(`/workflows${companyId ? `?companyId=${companyId}` : ""}`),
  get: (id: string) => api.get<WorkflowDetail>(`/workflows/${id}`),
  create: (input: CreateWorkflowInput, companyId?: string) =>
    api.post<WorkflowMutationResult>(`/workflows${companyId ? `?companyId=${companyId}` : ""}`, input),
  update: (id: string, input: UpdateWorkflowInput, companyId?: string) =>
    api.put<WorkflowMutationResult>(`/workflows/${id}${companyId ? `?companyId=${companyId}` : ""}`, input),
  delete: (id: string) => api.delete<{ ok: boolean }>(`/workflows/${id}`),
  duplicate: (id: string) =>
    api.post<WorkflowMutationResult>(`/workflows/${id}/duplicate`, {}),

  // Version management
  listVersions: (workflowId: string) =>
    api.get<WorkflowVersion[]>(`/workflows/${workflowId}/versions`),
  getVersionSteps: (workflowId: string, versionId: string) =>
    api.get<WorkflowStep[]>(`/workflows/${workflowId}/versions/${versionId}/steps`),

  // Execution
  triggerRun: (workflowId: string, input?: TriggerWorkflowInput) =>
    api.post<WorkflowRun>(`/workflows/${workflowId}/run`, input ?? {}),
  listRuns: (workflowId: string) =>
    api.get<WorkflowRun[]>(`/workflows/${workflowId}/runs`),
  getRun: (runId: string) =>
    api.get<WorkflowRunDetail>(`/workflows/runs/${runId}`),
  cancelRun: (runId: string) =>
    api.post<{ ok: boolean }>(`/workflows/runs/${runId}/cancel`, {}),
  resumeRun: (runId: string, input?: ResumeWorkflowInput) =>
    api.post<{ ok: boolean }>(`/workflows/runs/${runId}/resume`, input ?? {}),
  debugContinue: (runId: string, pauseAtStep?: number) =>
    api.post<WorkflowRun>(`/workflows/runs/${runId}/debug`, { pauseAtStep }),

  // Approval
  approveStep: (runId: string, stepRunId: string, input: ApproveStepInput) =>
    api.post<{ ok: boolean }>(
      `/workflows/runs/${runId}/steps/${stepRunId}/approve`,
      input,
    ),

  // Templates
  listTemplates: () => api.get<WorkflowTemplate[]>("/workflow-templates"),
  importTemplate: (templateId: string) =>
    api.post<WorkflowMutationResult>(`/workflow-templates/${templateId}/import`, {}),
};
