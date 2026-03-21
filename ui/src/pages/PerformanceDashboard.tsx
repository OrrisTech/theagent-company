import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  TrendingUp,
  CheckCircle2,
  Clock,
  DollarSign,
  GitPullRequest,
  Edit3,
  Users,
} from "lucide-react";
import { performanceApi } from "@/api/collaboration";
import { useCompany } from "@/context/CompanyContext";
import { queryKeys } from "@/lib/queryKeys";
import type { PerformanceSummary, PerformanceSnapshot } from "@paperclipai/shared";

/** Render a percentage as a styled number with color coding. */
function RateCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  const pct = (value * 100).toFixed(1);
  const color = value >= 0.8 ? "text-green-600 dark:text-green-400"
    : value >= 0.5 ? "text-amber-600 dark:text-amber-400"
    : "text-red-600 dark:text-red-400";

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className={`mt-2 text-2xl font-bold tabular-nums ${color}`}>{pct}%</div>
    </div>
  );
}

/** Render a numeric metric card. */
function MetricCard({ label, value, unit, icon }: { label: string; value: string | number; unit?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

export function PerformanceDashboard() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [dateRange] = useState<{ from?: string; to?: string }>({});

  const { data: summary, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.collaboration.performance(selectedCompanyId ?? "", dateRange.from, dateRange.to),
    queryFn: () => performanceApi.summary(selectedCompanyId ?? undefined, dateRange),
    retry: 1,
    enabled: !!selectedCompanyId,
  });

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("pages.performance.title")}</h1>
      </div>

      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : error ? (
        <div className="py-10 text-center">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("common.errorLoadingData")}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-primary underline">{t("common.retry")}</button>
        </div>
      ) : !summary ? (
        <div className="py-10 text-center">
          <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("pages.performance.noData")}</p>
        </div>
      ) : (
        <>
          {/* Rate cards */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <RateCard
              label={t("pages.performance.taskCompletionRate")}
              value={summary.taskCompletionRate}
              icon={<CheckCircle2 className="h-4 w-4" />}
            />
            <RateCard
              label={t("pages.performance.workflowSuccessRate")}
              value={summary.workflowSuccessRate}
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <RateCard
              label={t("pages.performance.peerReviewPassRate")}
              value={summary.peerReviewPassRate}
              icon={<GitPullRequest className="h-4 w-4" />}
            />
            <RateCard
              label={t("pages.performance.humanEditRate")}
              value={summary.humanEditRate}
              icon={<Edit3 className="h-4 w-4" />}
            />
          </div>

          {/* Summary metrics */}
          <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard
              label={t("pages.performance.avgCostPerTask")}
              value={`$${(summary.avgCostPerTask / 100).toFixed(2)}`}
              icon={<DollarSign className="h-4 w-4" />}
            />
            <MetricCard
              label={t("pages.performance.totalAgents")}
              value={summary.agents.length}
              icon={<Users className="h-4 w-4" />}
            />
            <MetricCard
              label={t("pages.performance.avgResponseTime")}
              value={
                summary.company?.avgResponseTimeMs
                  ? `${(summary.company.avgResponseTimeMs / 1000).toFixed(1)}`
                  : "—"
              }
              unit={summary.company?.avgResponseTimeMs ? "s" : undefined}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {/* Per-agent table */}
          <div className="rounded-lg border border-border">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">{t("pages.performance.agentBreakdown")}</h2>
            </div>
            {summary.agents.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("pages.performance.noAgentData")}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <th className="px-4 py-2">{t("pages.performance.agent")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.completed")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.assigned")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.rate")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.wfSuccess")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.reviewPass")}</th>
                      <th className="px-4 py-2 text-right">{t("pages.performance.cost")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.agents.map((agent: PerformanceSnapshot & { agentName?: string }) => {
                      const completionRate = agent.tasksAssigned > 0
                        ? (agent.tasksCompleted / agent.tasksAssigned * 100).toFixed(0)
                        : "—";
                      const wfRate = agent.workflowRuns > 0
                        ? (agent.workflowSuccesses / agent.workflowRuns * 100).toFixed(0)
                        : "—";
                      const prRate = agent.peerReviewsSubmitted > 0
                        ? (agent.peerReviewsPassed / agent.peerReviewsSubmitted * 100).toFixed(0)
                        : "—";

                      return (
                        <tr key={agent.id} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium">{agent.agentName ?? agent.agentId ?? "Company"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{agent.tasksCompleted}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{agent.tasksAssigned}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{completionRate}{completionRate !== "—" ? "%" : ""}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{wfRate}{wfRate !== "—" ? "%" : ""}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">{prRate}{prRate !== "—" ? "%" : ""}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums">${(agent.totalCostCents / 100).toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
