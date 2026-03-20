import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  LayoutDashboard,
  Loader2,
  Pause,
  Play,
  ShieldAlert,
  Timer,
  TrendingUp,
  Workflow,
  XCircle,
} from "lucide-react";
import type { OpenClawOverview, OpenClawRiskAlert } from "@paperclipai/shared";
import type { WorkflowDashboardOverview } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "../context/CompanyContext";
import { openclawApi } from "../api/openclaw";
import { dashboardApi } from "../api/dashboard";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatTokens } from "../lib/utils";

// ---- Helpers ----

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || ms === 0) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

function formatCostCents(cents: number | null | undefined): string {
  if (cents == null) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

// ---- Sub-components ----

function SeverityBadge({ severity }: { severity: OpenClawRiskAlert["severity"] }) {
  const { t } = useTranslation();
  const colors = {
    low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    critical: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", colors[severity])}>
      {t(`overview.severity.${severity}`)}
    </span>
  );
}

function RunStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "succeeded": return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    case "failed": return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    case "running": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin shrink-0" />;
    case "paused": return <Pause className="h-4 w-4 text-amber-500 shrink-0" />;
    case "cancelled": return <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

// ---- Main component ----

export function Overview() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();

  // Existing OpenClaw overview (health, risk alerts, team status)
  const { data: openclawData, isLoading: openclawLoading } = useQuery({
    queryKey: queryKeys.openclaw.overview(selectedCompanyId ?? ""),
    queryFn: () => openclawApi.overview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000,
  });

  // Workflow-centric dashboard data
  const { data: wfData, isLoading: wfLoading } = useQuery({
    queryKey: queryKeys.workflowOverview(selectedCompanyId ?? ""),
    queryFn: () => dashboardApi.workflowOverview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 10_000,
  });

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        {t("common.selectCompany")}
      </div>
    );
  }

  if (openclawLoading && wfLoading) {
    return <OverviewSkeleton />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("overview.title")}</h1>
      </div>

      {/* Quick stats — workflow-centric */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickStatCard
          title={t("overview.workflowsToday")}
          value={String(wfData?.quickStats.workflowsToday ?? 0)}
          icon={Workflow}
        />
        <QuickStatCard
          title={t("overview.successRate")}
          value={`${wfData?.quickStats.successRate ?? 0}%`}
          icon={TrendingUp}
          className={
            (wfData?.quickStats.successRate ?? 100) < 70
              ? "border-red-300 dark:border-red-700"
              : ""
          }
        />
        <QuickStatCard
          title={t("overview.avgDuration")}
          value={formatDuration(wfData?.quickStats.avgDurationMs)}
          icon={Timer}
        />
        <QuickStatCard
          title={t("overview.totalCostToday")}
          value={formatCostCents(wfData?.quickStats.totalCostCents)}
          icon={Coins}
        />
      </div>

      {/* Active Workflows section */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Play className="h-4 w-4" />
            {t("overview.activeWorkflows")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!wfData?.activeRuns.length ? (
            <p className="text-sm text-muted-foreground">{t("overview.noActiveWorkflows")}</p>
          ) : (
            <div className="space-y-3">
              {wfData.activeRuns.map((run) => {
                const progress = run.stepsTotal > 0
                  ? Math.round((run.stepsCompleted / run.stepsTotal) * 100)
                  : 0;
                return (
                  <div
                    key={run.id}
                    className="flex items-center gap-3 rounded-md border bg-card p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/workflows/runs/${run.id}`)}
                  >
                    <RunStatusIcon status={run.status} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{run.workflowName}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="h-1.5 flex-1 max-w-32 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-[11px] text-muted-foreground">
                          {run.stepsCompleted}/{run.stepsTotal}
                        </span>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">
                      {formatDuration(run.totalDurationMs)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent completions */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4" />
              {t("overview.recentCompletions")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!wfData?.recentCompletions.length ? (
              <p className="text-sm text-muted-foreground">{t("overview.noRecentCompletions")}</p>
            ) : (
              <div className="space-y-2">
                {wfData.recentCompletions.map((run) => (
                  <div
                    key={run.id}
                    className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/workflows/runs/${run.id}`)}
                  >
                    <RunStatusIcon status={run.status} />
                    <span className="text-sm truncate flex-1">{run.workflowName}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDuration(run.totalDurationMs)}
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatCostCents(run.totalCostCents)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending approvals */}
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Pause className="h-4 w-4" />
              {t("overview.pendingApprovals")}
              {wfData?.pendingApprovalSteps.length ? (
                <span className="ml-auto rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 text-xs font-medium">
                  {wfData.pendingApprovalSteps.length}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!wfData?.pendingApprovalSteps.length ? (
              <p className="text-sm text-muted-foreground">{t("overview.noPendingApprovals")}</p>
            ) : (
              <div className="space-y-2">
                {wfData.pendingApprovalSteps.map((step) => (
                  <div
                    key={step.stepRunId}
                    className="flex items-center gap-2 py-1.5 cursor-pointer hover:bg-muted/30 rounded px-2 -mx-2 transition-colors"
                    onClick={() => navigate(`/workflows/runs/${step.runId}`)}
                  >
                    <Pause className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-sm truncate flex-1">{step.workflowName}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {t("overview.step")} {step.stepIndex + 1}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk alerts — reworded for workflow context */}
      {openclawData && openclawData.riskAlerts.length > 0 && (
        <Card className="rounded-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              {t("overview.riskAlerts")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {openclawData.riskAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 rounded-md border bg-card p-3"
                >
                  <AlertIcon type={alert.type} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <SeverityBadge severity={alert.severity} />
                      {alert.entityName && (
                        <span className="text-sm font-medium">{alert.entityName}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* OpenClaw config notice */}
      {openclawData && !openclawData.health.configFound && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {t("overview.noOpenClawConfig")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("overview.noOpenClawConfigHint")}
          </p>
        </div>
      )}
    </div>
  );
}

// ---- Sub-components ----

function QuickStatCard({
  title,
  value,
  icon: Icon,
  className,
}: {
  title: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-lg", className)}>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <div className="mt-1 text-2xl font-bold">{value}</div>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      </CardContent>
    </Card>
  );
}

function AlertIcon({ type }: { type: OpenClawRiskAlert["type"] }) {
  switch (type) {
    case "budget_warning":
      return <Coins className="h-4 w-4 text-orange-500" />;
    case "stalled_agent":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "failed_workflow":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "gateway_down":
      return <Activity className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

function OverviewSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-48 animate-pulse rounded-lg border bg-muted" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-40 animate-pulse rounded-lg border bg-muted" />
        <div className="h-40 animate-pulse rounded-lg border bg-muted" />
      </div>
    </div>
  );
}
