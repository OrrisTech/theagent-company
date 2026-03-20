import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  agents,
  approvals,
  companies,
  costEvents,
  issues,
  workflows,
  workflowRuns,
  workflowStepRuns,
} from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
      };
    },

    /**
     * Workflow-centric dashboard stats for the Overview page.
     * Returns active workflows, recent completions, pending approvals,
     * and quick stats (today's runs, success rate, avg duration, total cost).
     */
    workflowOverview: async (companyId: string) => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      // Active workflow runs (running or paused)
      const activeRuns = await db
        .select({
          id: workflowRuns.id,
          workflowId: workflowRuns.workflowId,
          status: workflowRuns.status,
          startedAt: workflowRuns.startedAt,
          totalCostCents: workflowRuns.totalCostCents,
          totalDurationMs: workflowRuns.totalDurationMs,
          trigger: workflowRuns.trigger,
          workflowName: workflows.name,
        })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(
          and(
            eq(workflowRuns.companyId, companyId),
            sql`${workflowRuns.status} in ('running', 'paused', 'pending')`,
          ),
        )
        .orderBy(desc(workflowRuns.startedAt))
        .limit(10);

      // Get step progress for active runs
      const activeRunsWithProgress = await Promise.all(
        activeRuns.map(async (run) => {
          const stepCounts = await db
            .select({
              status: workflowStepRuns.status,
              count: sql<number>`count(*)`,
            })
            .from(workflowStepRuns)
            .where(eq(workflowStepRuns.workflowRunId, run.id))
            .groupBy(workflowStepRuns.status);

          const total = stepCounts.reduce((sum, r) => sum + Number(r.count), 0);
          const completed = stepCounts
            .filter((r) => r.status === "succeeded" || r.status === "skipped")
            .reduce((sum, r) => sum + Number(r.count), 0);

          return { ...run, stepsTotal: total, stepsCompleted: completed };
        }),
      );

      // Recent completions (last 5)
      const recentCompletions = await db
        .select({
          id: workflowRuns.id,
          workflowId: workflowRuns.workflowId,
          status: workflowRuns.status,
          startedAt: workflowRuns.startedAt,
          finishedAt: workflowRuns.finishedAt,
          totalCostCents: workflowRuns.totalCostCents,
          totalDurationMs: workflowRuns.totalDurationMs,
          workflowName: workflows.name,
        })
        .from(workflowRuns)
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(
          and(
            eq(workflowRuns.companyId, companyId),
            sql`${workflowRuns.status} in ('succeeded', 'failed', 'cancelled')`,
          ),
        )
        .orderBy(desc(workflowRuns.finishedAt))
        .limit(5);

      // Pending approval steps
      const pendingApprovalSteps = await db
        .select({
          stepRunId: workflowStepRuns.id,
          runId: workflowStepRuns.workflowRunId,
          stepIndex: workflowStepRuns.stepIndex,
          createdAt: workflowStepRuns.createdAt,
          workflowName: workflows.name,
        })
        .from(workflowStepRuns)
        .innerJoin(workflowRuns, eq(workflowStepRuns.workflowRunId, workflowRuns.id))
        .innerJoin(workflows, eq(workflowRuns.workflowId, workflows.id))
        .where(
          and(
            eq(workflowRuns.companyId, companyId),
            eq(workflowStepRuns.status, "waiting_approval"),
          ),
        )
        .orderBy(desc(workflowStepRuns.createdAt))
        .limit(10);

      // Quick stats: today
      const todayRunStats = await db
        .select({
          total: sql<number>`count(*)`,
          succeeded: sql<number>`count(*) filter (where ${workflowRuns.status} = 'succeeded')`,
          failed: sql<number>`count(*) filter (where ${workflowRuns.status} = 'failed')`,
          totalCost: sql<number>`coalesce(sum(${workflowRuns.totalCostCents}), 0)`,
          avgDuration: sql<number>`coalesce(avg(${workflowRuns.totalDurationMs}), 0)`,
        })
        .from(workflowRuns)
        .where(
          and(
            eq(workflowRuns.companyId, companyId),
            gte(workflowRuns.createdAt, todayStart),
          ),
        )
        .then((rows) => rows[0]!);

      const totalToday = Number(todayRunStats.total);
      const succeededToday = Number(todayRunStats.succeeded);
      const successRate = totalToday > 0 ? Math.round((succeededToday / totalToday) * 100) : 0;

      return {
        activeRuns: activeRunsWithProgress,
        recentCompletions,
        pendingApprovalSteps,
        quickStats: {
          workflowsToday: totalToday,
          successRate,
          avgDurationMs: Math.round(Number(todayRunStats.avgDuration)),
          totalCostCents: Number(todayRunStats.totalCost),
        },
      };
    },
  };
}
