import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Workflow,
  Plus,
  Play,
  Trash2,
  Copy,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  Loader2,
  Pause,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { workflowApi } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import type { WorkflowSummary, WorkflowRunStatus, WorkflowStatus } from "@theagentcompany/shared";

/** Map workflow status to a badge variant for visual distinction. */
function statusBadge(status: WorkflowStatus, t: (key: string) => string) {
  switch (status) {
    case "active":
      return <Badge variant="default" className="bg-green-600">{t("pages.workflows.active")}</Badge>;
    case "draft":
      return <Badge variant="secondary">{t("pages.workflows.draft")}</Badge>;
    case "archived":
      return <Badge variant="outline">{t("pages.workflows.archived")}</Badge>;
  }
}

/** Small icon for the last run status. */
function RunStatusIcon({ status }: { status: WorkflowRunStatus | null }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case "paused":
      return <Pause className="h-4 w-4 text-yellow-500" />;
    case "cancelled":
      return <XCircle className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return "—";
  }
}

export function Workflows() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const { selectedCompanyId } = useCompany();

  const { data: workflows, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.workflows.list,
    queryFn: () => workflowApi.list(selectedCompanyId ?? undefined),
    enabled: !!selectedCompanyId,
    retry: 1,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => workflowApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list });
      pushToast({ title: t("pages.workflows.deleted") });
    },
    onError: () => {
      pushToast({ title: t("pages.workflows.deleteFailed"), tone: "error" });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: (id: string) => workflowApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list });
      pushToast({ title: t("pages.workflows.duplicated") });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => workflowApi.triggerRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list });
      pushToast({ title: t("pages.workflows.runStarted") });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  function handleCreate() {
    // Navigate to the editor with "new" as the ID — editor handles creation
    navigate("/workflows/new");
  }

  function handleDelete(id: string) {
    if (window.confirm(t("pages.workflows.confirmDelete"))) {
      deleteMutation.mutate(id);
    }
    setMenuOpen(null);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Workflow className="h-6 w-6" />
            {t("pages.workflows.title")}
          </h1>
          <p className="text-muted-foreground mt-1">{t("pages.workflows.description")}</p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          {t("pages.workflows.createWorkflow")}
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error state */}
      {!isLoading && error && (
        <div className="border rounded-lg p-12 text-center">
          <XCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <p className="text-sm text-muted-foreground">{t("common.errorLoadingData")}</p>
          <Button variant="outline" className="mt-4" onClick={() => refetch()}>
            {t("common.retry")}
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && (!workflows || workflows.length === 0) && (
        <div className="border rounded-lg p-12 text-center">
          <Workflow className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">{t("pages.workflows.noWorkflows")}</h3>
          <p className="text-muted-foreground mt-2">{t("pages.workflows.noWorkflowsHint")}</p>
          <Button className="mt-4" onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t("pages.workflows.createWorkflow")}
          </Button>
        </div>
      )}

      {/* Workflow list */}
      {workflows && workflows.length > 0 && (
        <div className="border rounded-lg divide-y overflow-x-auto">
          {/* Table header */}
          <div className="min-w-[640px] grid grid-cols-[1fr_100px_80px_140px_80px_60px] gap-4 px-4 py-3 text-sm font-medium text-muted-foreground bg-muted/50">
            <div>{t("pages.workflows.workflowName")}</div>
            <div>{t("pages.workflows.status")}</div>
            <div>{t("pages.workflows.steps")}</div>
            <div>{t("pages.workflows.lastRun")}</div>
            <div>{t("pages.workflows.totalRuns")}</div>
            <div />
          </div>

          {workflows.map((wf: WorkflowSummary) => (
            <div
              key={wf.id}
              className="min-w-[640px] grid grid-cols-[1fr_100px_80px_140px_80px_60px] gap-4 px-4 py-3 items-center hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => navigate(`/workflows/${wf.id}`)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/workflows/${wf.id}`)}
            >
              {/* Name + description */}
              <div className="min-w-0">
                <div className="font-medium truncate">{wf.name}</div>
                {wf.description && (
                  <div className="text-sm text-muted-foreground truncate">{wf.description}</div>
                )}
              </div>

              {/* Status badge */}
              <div>{statusBadge(wf.status, t)}</div>

              {/* Step count */}
              <div className="text-sm">{wf.stepCount}</div>

              {/* Last run */}
              <div className="flex items-center gap-1.5 text-sm">
                <RunStatusIcon status={wf.lastRunStatus} />
                <span className="truncate">{formatDate(wf.lastRunAt)}</span>
              </div>

              {/* Total runs */}
              <div className="text-sm">{wf.totalRuns}</div>

              {/* Actions menu */}
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setMenuOpen(menuOpen === wf.id ? null : wf.id)}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
                {menuOpen === wf.id && (
                  <div className="absolute right-0 top-8 z-10 w-48 bg-popover border rounded-md shadow-md py-1">
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => {
                        runMutation.mutate(wf.id);
                        setMenuOpen(null);
                      }}
                    >
                      <Play className="h-4 w-4" />
                      {t("pages.workflows.runWorkflow")}
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      onClick={() => {
                        duplicateMutation.mutate(wf.id);
                        setMenuOpen(null);
                      }}
                    >
                      <Copy className="h-4 w-4" />
                      {t("pages.workflows.duplicateWorkflow")}
                    </button>
                    <button
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                      onClick={() => handleDelete(wf.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      {t("pages.workflows.deleteWorkflow")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
