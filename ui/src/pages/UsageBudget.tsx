import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Coins,
  DollarSign,
  BarChart3,
  Users,
  FolderOpen,
  Cpu,
  AlertTriangle,
} from "lucide-react";
import type { OpenClawUsage, CostByProject } from "@paperclipai/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCompany } from "../context/CompanyContext";
import { openclawApi } from "../api/openclaw";
import { costsApi } from "../api/costs";
import { queryKeys } from "../lib/queryKeys";
import { cn, formatCents, formatTokens } from "../lib/utils";

export function UsageBudget() {
  const { t } = useTranslation();
  const { selectedCompanyId, selectedCompany } = useCompany();
  const [activeTab, setActiveTab] = useState("member");

  // OpenClaw usage data (aggregated from cost_events)
  const { data: usage, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.usage(selectedCompanyId ?? ""),
    queryFn: () => openclawApi.usage(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  // Per-project breakdown from existing costs API
  const { data: projectCosts } = useQuery({
    queryKey: ["costs-by-project", selectedCompanyId],
    queryFn: () => costsApi.byProject(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        {t("common.selectCompany")}
      </div>
    );
  }

  if (isLoading) {
    return <UsageSkeleton />;
  }

  const budgetCents = selectedCompany?.budgetMonthlyCents ?? 0;
  const spendCents = usage?.totalCostCents ?? 0;
  const utilization = budgetCents > 0 ? Math.round((spendCents / budgetCents) * 100) : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <DollarSign className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("usage.title")}</h1>
      </div>

      {/* Top summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label={t("usage.monthlySpend")}
          value={formatCents(spendCents)}
          icon={Coins}
        />
        <SummaryCard
          label={t("usage.monthlyBudget")}
          value={budgetCents > 0 ? formatCents(budgetCents) : "\u2014"}
          icon={DollarSign}
        />
        <SummaryCard
          label={t("usage.utilization")}
          value={budgetCents > 0 ? `${utilization}%` : "\u2014"}
          icon={BarChart3}
          alert={utilization >= 90}
        />
        <SummaryCard
          label={t("usage.totalTokens")}
          value={formatTokens(usage?.totalTokens ?? 0)}
          icon={Cpu}
        />
      </div>

      {/* Budget utilization bar */}
      {budgetCents > 0 && (
        <Card className="rounded-lg">
          <CardContent className="pt-0">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">
                {formatCents(spendCents)} / {formatCents(budgetCents)}
              </span>
              <span className={cn(
                "font-medium",
                utilization >= 100 ? "text-red-500" : utilization >= 80 ? "text-yellow-500" : "text-green-500",
              )}>
                {utilization}% {t("usage.ofBudget")}
              </span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  utilization >= 100
                    ? "bg-red-500"
                    : utilization >= 80
                      ? "bg-yellow-500"
                      : "bg-green-500",
                )}
                style={{ width: `${Math.min(100, utilization)}%` }}
              />
            </div>
            {utilization >= 90 && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-500">
                <AlertTriangle className="h-3.5 w-3.5" />
                {t("usage.budgetAlert")}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Breakdown tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="member" className="gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {t("usage.perMember")}
          </TabsTrigger>
          <TabsTrigger value="project" className="gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            {t("usage.perProject")}
          </TabsTrigger>
          <TabsTrigger value="model" className="gap-1.5">
            <Cpu className="h-3.5 w-3.5" />
            {t("usage.perModel")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="member">
          <MemberBreakdown usage={usage} />
        </TabsContent>
        <TabsContent value="project">
          <ProjectBreakdown projects={projectCosts ?? []} />
        </TabsContent>
        <TabsContent value="model">
          <ModelBreakdown usage={usage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Sub-components ----

function SummaryCard({
  label,
  value,
  icon: Icon,
  alert,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  alert?: boolean;
}) {
  return (
    <Card className={cn("rounded-lg", alert && "border-orange-300 dark:border-orange-700")}>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <div className="mt-1 text-2xl font-bold">{value}</div>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground/30" />
        </div>
      </CardContent>
    </Card>
  );
}

function MemberBreakdown({ usage }: { usage: OpenClawUsage | undefined }) {
  const { t } = useTranslation();

  if (!usage?.byAgent.length) {
    return <EmptyBreakdown message={t("usage.noCostData")} />;
  }

  const sorted = [...usage.byAgent].sort((a, b) => b.costCents - a.costCents);
  const maxCost = sorted[0]?.costCents ?? 1;

  return (
    <Card className="rounded-lg">
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <span>{t("usage.member")}</span>
            <span className="text-right">{t("usage.cost")}</span>
            <span className="text-right">{t("usage.inputTokens")}</span>
            <span className="text-right">{t("usage.outputTokens")}</span>
          </div>
          {sorted.map((agent) => {
            const percent = maxCost > 0 ? (agent.costCents / maxCost) * 100 : 0;
            return (
              <div key={agent.agentId} className="space-y-1">
                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-sm">
                  <span className="font-medium truncate">{agent.agentName}</span>
                  <span className="text-right font-mono">{formatCents(agent.costCents)}</span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(agent.inputTokens)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(agent.outputTokens)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectBreakdown({ projects }: { projects: CostByProject[] }) {
  const { t } = useTranslation();

  if (!projects.length) {
    return <EmptyBreakdown message={t("usage.noCostData")} />;
  }

  const sorted = [...projects].sort((a, b) => b.costCents - a.costCents);
  const maxCost = sorted[0]?.costCents ?? 1;

  return (
    <Card className="rounded-lg">
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <span>{t("usage.project")}</span>
            <span className="text-right">{t("usage.cost")}</span>
            <span className="text-right">{t("usage.inputTokens")}</span>
            <span className="text-right">{t("usage.outputTokens")}</span>
          </div>
          {sorted.map((proj) => {
            const percent = maxCost > 0 ? (proj.costCents / maxCost) * 100 : 0;
            return (
              <div key={proj.projectId ?? "unassigned"} className="space-y-1">
                <div className="grid grid-cols-[1fr_100px_100px_100px] gap-2 text-sm">
                  <span className="font-medium truncate">
                    {proj.projectName ?? t("documents.uncategorized")}
                  </span>
                  <span className="text-right font-mono">{formatCents(proj.costCents)}</span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(proj.inputTokens)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(proj.outputTokens)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-blue-500/60 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ModelBreakdown({ usage }: { usage: OpenClawUsage | undefined }) {
  const { t } = useTranslation();

  if (!usage?.byModel.length) {
    return <EmptyBreakdown message={t("usage.noCostData")} />;
  }

  const sorted = [...usage.byModel].sort((a, b) => b.costCents - a.costCents);
  const maxCost = sorted[0]?.costCents ?? 1;

  return (
    <Card className="rounded-lg">
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-2 text-xs font-medium text-muted-foreground border-b pb-2">
            <span>{t("usage.model")}</span>
            <span>{t("usage.provider")}</span>
            <span className="text-right">{t("usage.cost")}</span>
            <span className="text-right">{t("usage.inputTokens")}</span>
            <span className="text-right">{t("usage.outputTokens")}</span>
          </div>
          {sorted.map((model) => {
            const percent = maxCost > 0 ? (model.costCents / maxCost) * 100 : 0;
            return (
              <div key={`${model.provider}-${model.model}`} className="space-y-1">
                <div className="grid grid-cols-[1fr_80px_100px_100px_100px] gap-2 text-sm">
                  <span className="font-medium truncate font-mono text-xs">{model.model}</span>
                  <span className="text-muted-foreground text-xs">{model.provider}</span>
                  <span className="text-right font-mono">{formatCents(model.costCents)}</span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(model.inputTokens)}
                  </span>
                  <span className="text-right font-mono text-muted-foreground">
                    {formatTokens(model.outputTokens)}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-violet-500/60 transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyBreakdown({ message }: { message: string }) {
  return (
    <Card className="rounded-lg">
      <CardContent className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}

function UsageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="h-8 w-48 animate-pulse rounded bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
        ))}
      </div>
      <div className="h-12 animate-pulse rounded-lg border bg-muted" />
      <div className="h-64 animate-pulse rounded-lg border bg-muted" />
    </div>
  );
}
