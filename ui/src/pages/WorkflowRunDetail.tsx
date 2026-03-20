import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Pause,
  Clock,
  Play,
  Square,
  RotateCcw,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronRight,
  Bookmark,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { workflowApi } from "../api/workflows";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import type { WorkflowStepRunStatus, WorkflowRunStatus } from "@paperclipai/shared";

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try { return new Date(date).toLocaleString(); } catch { return "—"; }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toFixed(2)}`;
}

/** Icon for step run status. */
function StepStatusIcon({ status }: { status: WorkflowStepRunStatus }) {
  switch (status) {
    case "succeeded": return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
    case "failed": return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
    case "running": return <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />;
    case "waiting_approval": return <Pause className="h-5 w-5 text-amber-500 shrink-0" />;
    case "skipped": return <Clock className="h-5 w-5 text-muted-foreground shrink-0" />;
    case "cancelled": return <Square className="h-5 w-5 text-muted-foreground shrink-0" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground shrink-0" />;
  }
}

/** Badge for overall run status. */
function RunStatusBadge({ status, t }: { status: WorkflowRunStatus; t: (k: string) => string }) {
  const colors: Record<string, string> = {
    succeeded: "bg-green-600",
    failed: "bg-destructive",
    running: "bg-blue-600",
    paused: "bg-yellow-500",
    cancelled: "bg-muted-foreground",
    pending: "bg-muted text-foreground",
  };
  return (
    <Badge className={`${colors[status] ?? colors.pending} text-white`}>
      {t(`pages.workflows.${status}`)}
    </Badge>
  );
}

export function WorkflowRunDetail() {
  const { t } = useTranslation();
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryKeys.workflows.runDetail(runId ?? ""),
    queryFn: () => workflowApi.getRun(runId!),
    enabled: !!runId,
    refetchInterval: (query) => {
      // Auto-refresh while run is active
      const status = query.state.data?.run?.status;
      return status === "running" || status === "paused" || status === "pending" ? 2000 : false;
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => workflowApi.cancelRun(runId!),
    onSuccess: () => {
      refetch();
      pushToast({ title: "Run cancelled" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (fromStep: number | undefined = undefined) => workflowApi.resumeRun(runId!, fromStep !== undefined ? { fromStep } : undefined),
    onSuccess: () => {
      refetch();
      pushToast({ title: "Run resumed" });
    },
  });

  const debugMutation = useMutation({
    mutationFn: (pauseAtStep: number | undefined = undefined) => workflowApi.debugContinue(runId!, pauseAtStep),
    onSuccess: () => refetch(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ stepRunId, decision }: { stepRunId: string; decision: "approved" | "rejected" }) =>
      workflowApi.approveStep(runId!, stepRunId, { decision }),
    onSuccess: () => {
      refetch();
      pushToast({ title: "Decision recorded" });
    },
  });

  function toggleStep(index: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 text-center text-muted-foreground">Run not found</div>
    );
  }

  const { run, stepRuns, steps } = data;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`/workflows/${run.workflowId}`)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">{t("pages.workflows.runDetail")}</h1>
        <RunStatusBadge status={run.status} t={t} />
        {run.debugMode && (
          <Badge variant="outline" className="text-amber-600 border-amber-600">
            {t("pages.workflows.debugMode")}
          </Badge>
        )}
      </div>

      {/* Run summary */}
      <div className="border rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">{t("pages.workflows.trigger")}</span>
            <div className="font-medium mt-0.5">
              {t(`pages.workflows.trigger${run.trigger.charAt(0).toUpperCase() + run.trigger.slice(1)}`)}
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">{t("pages.workflows.duration")}</span>
            <div className="font-medium mt-0.5">{formatDuration(run.totalDurationMs)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">{t("pages.workflows.cost")}</span>
            <div className="font-medium mt-0.5">{formatCost(run.totalCostCents)}</div>
          </div>
          <div>
            <span className="text-muted-foreground">Started</span>
            <div className="font-medium mt-0.5">{formatDate(run.startedAt)}</div>
          </div>
        </div>

        {run.error && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
            {run.error}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {(run.status === "running" || run.status === "paused") && (
          <Button variant="destructive" size="sm" onClick={() => cancelMutation.mutate()}>
            <Square className="h-4 w-4 mr-1" />
            {t("pages.workflows.cancel")}
          </Button>
        )}
        {run.status === "failed" && (
          <Button variant="outline" size="sm" onClick={() => resumeMutation.mutate(undefined)}>
            <RotateCcw className="h-4 w-4 mr-1" />
            {t("pages.workflows.resumeFromCheckpoint")}
          </Button>
        )}
        {run.status === "paused" && run.debugMode && (
          <Button size="sm" onClick={() => debugMutation.mutate(undefined)}>
            <Play className="h-4 w-4 mr-1" />
            {t("pages.workflows.continueDebug")}
          </Button>
        )}
      </div>

      {/* Step-by-step execution timeline */}
      <div className="space-y-1">
        <h2 className="text-lg font-semibold mb-3">{t("pages.workflows.steps")}</h2>

        {steps.map((step, index) => {
          const stepRun = stepRuns.find((sr) => sr.stepIndex === index);
          const isExpanded = expandedSteps.has(index);
          const status = stepRun?.status ?? "pending";

          return (
            <div key={step.id} className="border rounded-lg">
              {/* Step row */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleStep(index)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <StepStatusIcon status={status as WorkflowStepRunStatus} />
                <div className="flex-1 min-w-0">
                  <span className="font-medium">
                    {index + 1}. {step.name}
                  </span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {t(`pages.workflows.stepTypes.${step.type}`)}
                  </Badge>
                  {step.isCheckpoint && (
                    <Bookmark className="inline h-3.5 w-3.5 ml-1.5 text-amber-500" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatDuration(stepRun?.durationMs)}</span>
                  <span>{formatCost(stepRun?.costCents)}</span>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && stepRun && (
                <div className="border-t px-4 py-4 space-y-3 text-sm">
                  {/* Approval action buttons */}
                  {stepRun.status === "waiting_approval" && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded">
                      <span className="text-amber-700 dark:text-amber-300 font-medium flex-1">
                        {t("pages.workflows.waitingApproval")}
                      </span>
                      <Button
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={(e) => {
                          e.stopPropagation();
                          approveMutation.mutate({ stepRunId: stepRun.id, decision: "approved" });
                        }}
                      >
                        <ThumbsUp className="h-4 w-4 mr-1" />
                        {t("pages.workflows.approve")}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          approveMutation.mutate({ stepRunId: stepRun.id, decision: "rejected" });
                        }}
                      >
                        <ThumbsDown className="h-4 w-4 mr-1" />
                        {t("pages.workflows.reject")}
                      </Button>
                    </div>
                  )}

                  {/* Error */}
                  {stepRun.error && (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
                      {stepRun.error}
                    </div>
                  )}

                  {/* Input */}
                  {stepRun.input != null && (
                    <div>
                      <h4 className="font-medium mb-1">{t("pages.workflows.input")}</h4>
                      <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48 font-mono">
                        {typeof stepRun.input === "string"
                          ? stepRun.input
                          : JSON.stringify(stepRun.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Output */}
                  {stepRun.output != null && (
                    <div>
                      <h4 className="font-medium mb-1">{t("pages.workflows.output")}</h4>
                      <pre className="p-3 bg-muted rounded text-xs overflow-auto max-h-48 font-mono">
                        {typeof stepRun.output === "string"
                          ? stepRun.output
                          : JSON.stringify(stepRun.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Metadata row */}
                  <div className="flex items-center gap-6 text-muted-foreground">
                    {stepRun.retryAttempt > 0 && (
                      <span>Retry #{stepRun.retryAttempt}</span>
                    )}
                    {stepRun.startedAt && <span>Started: {formatDate(stepRun.startedAt)}</span>}
                    {stepRun.finishedAt && <span>Finished: {formatDate(stepRun.finishedAt)}</span>}
                    {stepRun.approvedByUserId && (
                      <span>
                        {stepRun.approvalDecision === "approved" ? "Approved" : "Rejected"} by {stepRun.approvedByUserId}
                      </span>
                    )}
                  </div>

                  {/* Resume from this step if run failed */}
                  {run.status === "failed" && stepRun.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        resumeMutation.mutate(stepRun.stepIndex);
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-1" />
                      {t("pages.workflows.retryFromStep")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
