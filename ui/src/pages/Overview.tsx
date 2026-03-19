import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  LayoutDashboard,
  ShieldAlert,
  Users,
  Wifi,
  WifiOff,
  XCircle,
  Zap,
} from "lucide-react";
import type { OpenClawOverview, OpenClawRiskAlert } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "../context/CompanyContext";
import { openclawApi } from "../api/openclaw";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatTokens } from "../lib/utils";

// Map gateway status to icon and color
function GatewayBadge({ status }: { status: string }) {
  const { t } = useTranslation();

  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
        <Wifi className="h-3 w-3" />
        {t("overview.connected")}
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
        <WifiOff className="h-3 w-3" />
        {t("overview.disconnected")}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Activity className="h-3 w-3" />
      {t("overview.unknown")}
    </span>
  );
}

// Severity badge for risk alerts
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

// Alert type icon
function AlertIcon({ type }: { type: OpenClawRiskAlert["type"] }) {
  switch (type) {
    case "budget_warning":
      return <Coins className="h-4 w-4 text-orange-500" />;
    case "stalled_agent":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "failed_workflow":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "gateway_down":
      return <WifiOff className="h-4 w-4 text-red-500" />;
    default:
      return <AlertTriangle className="h-4 w-4 text-muted-foreground" />;
  }
}

export function Overview() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.openclaw.overview(selectedCompanyId ?? ""),
    queryFn: () => openclawApi.overview(selectedCompanyId!),
    enabled: !!selectedCompanyId,
    refetchInterval: 30_000, // Refresh every 30s
  });

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        {t("common.selectCompany")}
      </div>
    );
  }

  if (isLoading) {
    return <OverviewSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-destructive">
            {error?.message ?? t("common.error")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("overview.title")}</h1>
      </div>

      {/* Top stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Gateway status */}
        <StatCard
          title={t("overview.gateway")}
          value={<GatewayBadge status={data.health.gatewayStatus} />}
          icon={data.health.gatewayStatus === "connected" ? Wifi : WifiOff}
          className={data.health.gatewayStatus === "connected" ? "" : "border-destructive/30"}
        />

        {/* Active team members */}
        <StatCard
          title={t("overview.teamMembers")}
          value={`${data.activeAgents} / ${data.totalAgents}`}
          subtitle={t("overview.active")}
          icon={Users}
        />

        {/* Pending approvals */}
        <StatCard
          title={t("overview.pendingApprovals")}
          value={String(data.pendingApprovals)}
          subtitle={t("overview.awaitingReview")}
          icon={CheckCircle2}
          className={data.pendingApprovals > 0 ? "border-yellow-300 dark:border-yellow-700" : ""}
        />

        {/* Today cost */}
        <StatCard
          title={t("overview.costToday")}
          value={formatCents(data.todayStats.totalCostCents)}
          subtitle={`${formatTokens(data.todayStats.totalTokens)} tokens`}
          icon={Coins}
        />
      </div>

      {/* Today's stats row */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4" />
            {t("overview.todayStats")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <div className="text-2xl font-bold">{data.todayStats.completedTasks}</div>
              <div className="text-sm text-muted-foreground">{t("overview.completedTasks")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatTokens(data.todayStats.totalTokens)}</div>
              <div className="text-sm text-muted-foreground">{t("overview.tokensUsed")}</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCents(data.todayStats.totalCostCents)}</div>
              <div className="text-sm text-muted-foreground">{t("overview.costToday")}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Risk alerts */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" />
            {t("overview.riskAlerts")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.riskAlerts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("overview.noAlerts")}</p>
          ) : (
            <div className="space-y-3">
              {data.riskAlerts.map((alert) => (
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
          )}
        </CardContent>
      </Card>

      {/* Team status */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {t("overview.teamStatus")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.teamStatus.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("overview.noTeamMembers")}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.teamStatus.map((member) => (
                <TeamMemberCard key={member.agentId} member={member} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* OpenClaw config notice */}
      {!data.health.configFound && (
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

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  className,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
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
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      </CardContent>
    </Card>
  );
}

function TeamMemberCard({
  member,
}: {
  member: OpenClawOverview["teamStatus"][number];
}) {
  const { t } = useTranslation();

  const statusColors: Record<string, string> = {
    active: "bg-green-500",
    idle: "bg-green-500",
    running: "bg-blue-500",
    paused: "bg-yellow-500",
    error: "bg-red-500",
  };

  const budgetPercent =
    member.budgetTotalCents > 0
      ? Math.min(100, Math.round((member.budgetUsedCents / member.budgetTotalCents) * 100))
      : 0;

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Status indicator dot */}
        <span
          className={cn(
            "h-2.5 w-2.5 rounded-full",
            statusColors[member.status] ?? "bg-muted-foreground",
          )}
        />
        {/* Avatar or icon */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
          {member.icon ?? member.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="truncate text-sm font-medium">{member.name}</div>
          <div className="truncate text-xs text-muted-foreground">
            {member.title ?? member.role}
          </div>
        </div>
      </div>

      {/* Current task */}
      {member.currentTask && (
        <div className="text-xs text-muted-foreground truncate">
          <span className="font-medium">{t("overview.currentTask")}:</span>{" "}
          {member.currentTask}
        </div>
      )}

      {/* Budget progress */}
      {member.budgetTotalCents > 0 && (
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("overview.budget")}</span>
            <span>
              {formatCents(member.budgetUsedCents)} / {formatCents(member.budgetTotalCents)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                budgetPercent >= 90
                  ? "bg-red-500"
                  : budgetPercent >= 70
                    ? "bg-yellow-500"
                    : "bg-green-500",
              )}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
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
      <div className="h-32 animate-pulse rounded-lg border bg-muted" />
      <div className="h-48 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
