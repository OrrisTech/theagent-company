import type { DashboardSummary, WorkflowDashboardOverview } from "@theagentcompany/shared";
import { api } from "./client";

export const dashboardApi = {
  summary: (companyId: string) => api.get<DashboardSummary>(`/companies/${companyId}/dashboard`),
  workflowOverview: (companyId: string) =>
    api.get<WorkflowDashboardOverview>(`/companies/${companyId}/dashboard/workflow-overview`),
};
