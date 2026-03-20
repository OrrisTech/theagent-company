import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
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
  PenLine,
  SkipForward,
  DollarSign,
  Timer,
  User,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { workflowApi } from "../api/workflows";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import type { WorkflowStepRunStatus, WorkflowRunStatus } from "@paperclipai/shared";

// ---- Formatters ----

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "\u2014";
  try { return new Date(date).toLocaleString(); } catch { return "\u2014"; }
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatCost(cents: number | null | undefined): string {
  if (cents == null) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

// ---- Status helpers ----

/** Background color ring for step card based on status. */
function stepCardBorder(status: WorkflowStepRunStatus | "pending"): string {
  switch (status) {
    case "succeeded": return "border-green-300 dark:border-green-700";
    case "failed": return "border-red-300 dark:border-red-700";
    case "running": return "border-blue-300 dark:border-blue-600 shadow-blue-100 dark:shadow-blue-900/30 shadow-sm";
    case "waiting_approval": return "border-amber-300 dark:border-amber-700";
    case "skipped": return "border-muted";
    case "cancelled": return "border-muted";
    default: return "border-border";
  }
}

/** Status icon for step cards. */
function StepStatusIcon({ status }: { status: WorkflowStepRunStatus | "pending" }) {
  switch (status) {
    case "succeeded": return <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />;
    case "failed": return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
    case "running": return <Loader2 className="h-5 w-5 text-blue-500 animate-spin shrink-0" />;
    case "waiting_approval": return <Pause className="h-5 w-5 text-amber-500 shrink-0" />;
    case "skipped": return <SkipForward className="h-5 w-5 text-muted-foreground shrink-0" />;
    case "cancelled": return <Square className="h-5 w-5 text-muted-foreground shrink-0" />;
    default: return <Clock className="h-5 w-5 text-muted-foreground shrink-0" />;
  }
}

/** Status label text. */
function stepStatusLabel(status: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    succeeded: t("pages.workflows.succeeded"),
    failed: t("pages.workflows.failed"),
    running: t("pages.workflows.running"),
    waiting_approval: t("pages.workflows.waitingApproval"),
    skipped: t("pages.workflows.skipped"),
    cancelled: t("pages.workflows.cancelled"),
    pending: t("pages.workflows.pending"),
  };
  return map[status] ?? status;
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

// ---- Main component ----

export function WorkflowRunDetail() {
  const { t } = useTranslation();
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
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
      pushToast({ title: t("pages.workflows.cancel") });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (fromStep: number | undefined = undefined) =>
      workflowApi.resumeRun(runId!, fromStep !== undefined ? { fromStep } : undefined),
    onSuccess: () => {
      refetch();
      pushToast({ title: t("pages.workflows.resume") });
    },
  });

  const debugMutation = useMutation({
    mutationFn: (pauseAtStep: number | undefined = undefined) =>
      workflowApi.debugContinue(runId!, pauseAtStep),
    onSuccess: () => refetch(),
  });

  const approveMutation = useMutation({
    mutationFn: ({ stepRunId, decision }: { stepRunId: string; decision: "approved" | "rejected" }) =>
      workflowApi.approveStep(runId!, stepRunId, { decision }),
    onSuccess: () => {
      refetch();
      pushToast({ title: t("pages.workflows.approve") });
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
      <div className="p-6 text-center text-muted-foreground">
        {t("pages.workflows.runNotFound")}
      </div>
    );
  }

  const { run, stepRuns, steps } = data;

  // Calculate progress
  const totalSteps = steps.length;
  const completedSteps = stepRuns.filter(
    (sr) => sr.status === "succeeded" || sr.status === "skipped",
  ).length;
  const failedSteps = stepRuns.filter((sr) => sr.status === "failed").length;
  const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

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

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("pages.workflows.progressLabel", {
              completed: completedSteps,
              total: totalSteps,
            })}
          </span>
          <span className="font-medium">{progressPercent}%</span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              failedSteps > 0
                ? "bg-red-500"
                : run.status === "succeeded"
                  ? "bg-green-500"
                  : "bg-blue-500",
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Run summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Play className="h-3 w-3" />
            {t("pages.workflows.trigger")}
          </div>
          <div className="font-medium text-sm">
            {t(`pages.workflows.trigger${run.trigger.charAt(0).toUpperCase() + run.trigger.slice(1)}`)}
          </div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Timer className="h-3 w-3" />
            {t("pages.workflows.duration")}
          </div>
          <div className="font-medium text-sm">{formatDuration(run.totalDurationMs)}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <DollarSign className="h-3 w-3" />
            {t("pages.workflows.cost")}
          </div>
          <div className="font-medium text-sm">{formatCost(run.totalCostCents)}</div>
        </div>
        <div className="border rounded-lg p-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
            <Clock className="h-3 w-3" />
            {t("pages.workflows.startedAt")}
          </div>
          <div className="font-medium text-sm">{formatDate(run.startedAt)}</div>
        </div>
      </div>

      {run.error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
          {run.error}
        </div>
      )}

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

      {/* Step Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">{t("pages.workflows.steps")}</h2>

        {steps.map((step, index) => {
          const stepRun = stepRuns.find((sr) => sr.stepIndex === index);
          const isExpanded = expandedSteps.has(index);
          const status: WorkflowStepRunStatus | "pending" =
            (stepRun?.status as WorkflowStepRunStatus) ?? "pending";
          const roleLabel = (step as { roleLabel?: string | null }).roleLabel;

          return (
            <div
              key={step.id}
              className={cn(
                "border rounded-lg transition-colors",
                stepCardBorder(status),
              )}
            >
              {/* Step card header */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
                onClick={() => toggleStep(index)}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}

                <StepStatusIcon status={status} />

                {/* Step number + role label + name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {roleLabel ? (
                      <span className="inline-flex items-center gap-1 text-sm font-medium">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-primary">{roleLabel}</span>
                      </span>
                    ) : (
                      <span className="text-sm font-medium text-muted-foreground">
                        {t("pages.workflows.stepNumber", { n: index + 1 })}
                      </span>
                    )}
                    <span className="font-medium text-sm truncate">{step.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className="text-[10px] h-5">
                      {t(`pages.workflows.stepTypes.${step.type}`)}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {stepStatusLabel(status, t)}
                    </span>
                    {step.isCheckpoint && (
                      <Bookmark className="h-3 w-3 text-amber-500" />
                    )}
                  </div>
                </div>

                {/* Duration + Cost on the right */}
                <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                  <span className="flex items-center gap-1">
                    <Timer className="h-3 w-3" />
                    {formatDuration(stepRun?.durationMs)}
                  </span>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" />
                    {formatCost(stepRun?.costCents)}
                  </span>
                </div>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="border-t px-4 py-4 space-y-3 text-sm">
                  {/* Approval action buttons */}
                  {stepRun?.status === "waiting_approval" && (
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

                  {/* Error with retry/skip/manual-fill buttons */}
                  {stepRun?.error && (
                    <div className="space-y-2">
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-destructive">
                        {stepRun.error}
                      </div>
                      {run.status === "failed" && stepRun.status === "failed" && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              resumeMutation.mutate(stepRun.stepIndex);
                            }}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" />
                            {t("pages.workflows.retryFromStep")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              resumeMutation.mutate(stepRun.stepIndex + 1);
                            }}
                          >
                            <SkipForward className="h-3.5 w-3.5 mr-1" />
                            {t("pages.workflows.skipStep")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Open manual fill — for now resume with empty output
                              resumeMutation.mutate(stepRun.stepIndex + 1);
                            }}
                          >
                            <PenLine className="h-3.5 w-3.5 mr-1" />
                            {t("pages.workflows.manualFill")}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Input */}
                  {stepRun?.input != null && (
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
                  {stepRun?.output != null && (
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
                  {stepRun && (
                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground pt-1">
                      {stepRun.retryAttempt > 0 && (
                        <span>{t("pages.workflows.retryAttempt", { n: stepRun.retryAttempt })}</span>
                      )}
                      {stepRun.startedAt && (
                        <span>{t("pages.workflows.startedAt")}: {formatDate(stepRun.startedAt)}</span>
                      )}
                      {stepRun.finishedAt && (
                        <span>{t("pages.workflows.finishedAt")}: {formatDate(stepRun.finishedAt)}</span>
                      )}
                      {stepRun.approvedByUserId && (
                        <span>
                          {stepRun.approvalDecision === "approved"
                            ? t("pages.workflows.approvedBy")
                            : t("pages.workflows.rejectedBy")}: {stepRun.approvedByUserId}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Pending step — show nothing yet */}
                  {!stepRun && (
                    <p className="text-muted-foreground text-xs">
                      {t("pages.workflows.stepPending")}
                    </p>
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
