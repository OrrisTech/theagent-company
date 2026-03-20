import { and, asc, desc, eq, sql, count, isNull, gte, lte, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  teamMessages,
  dailyReports,
  peerReviews,
  escalationRules,
  escalationEvents,
  notifications,
  performanceSnapshots,
  onboardingFlows,
  feedbackEntries,
  agents,
  issues,
} from "@paperclipai/db";
import type {
  SendMessageInput,
  CreatePeerReviewInput,
  SubmitPeerReviewInput,
  CreateEscalationRuleInput,
  UpdateEscalationRuleInput,
  ResolveEscalationInput,
  CreateNotificationInput,
  CreateFeedbackInput,
  ApplyFeedbackInput,
  NotificationType,
} from "@paperclipai/shared";
import type { OnboardingStepRecord } from "@paperclipai/db";
import { notFound, badRequest } from "../errors.js";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "collaboration-service" });

/**
 * Collaboration service — handles all Phase 6 Team Collaboration features.
 *
 * Covers: messaging, daily reports, peer reviews, escalation protocol,
 * notification center, performance metrics, onboarding, and feedback loop.
 */
export function collaborationService(db: Db) {
  // =========================================================================
  // 1. Agent-to-Agent Messaging
  // =========================================================================

  /** List messages for a conversation between two agents (or all messages for an agent). */
  async function listMessages(
    companyId: string,
    opts: { agentId?: string; withAgentId?: string; issueId?: string; limit?: number; offset?: number },
  ) {
    const conditions = [eq(teamMessages.companyId, companyId)];

    if (opts.agentId && opts.withAgentId) {
      // Conversation between two specific agents
      conditions.push(
        or(
          and(eq(teamMessages.fromAgentId, opts.agentId), eq(teamMessages.toAgentId, opts.withAgentId))!,
          and(eq(teamMessages.fromAgentId, opts.withAgentId), eq(teamMessages.toAgentId, opts.agentId))!,
        )!,
      );
    } else if (opts.agentId) {
      // All messages involving an agent
      conditions.push(
        or(eq(teamMessages.fromAgentId, opts.agentId), eq(teamMessages.toAgentId, opts.agentId))!,
      );
    }

    if (opts.issueId) {
      conditions.push(eq(teamMessages.issueId, opts.issueId));
    }

    const rows = await db
      .select({
        id: teamMessages.id,
        companyId: teamMessages.companyId,
        fromAgentId: teamMessages.fromAgentId,
        toAgentId: teamMessages.toAgentId,
        parentId: teamMessages.parentId,
        issueId: teamMessages.issueId,
        content: teamMessages.content,
        status: teamMessages.status,
        metadata: teamMessages.metadata,
        createdAt: teamMessages.createdAt,
        readAt: teamMessages.readAt,
        fromAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${teamMessages.fromAgentId})`,
        toAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${teamMessages.toAgentId})`,
      })
      .from(teamMessages)
      .where(and(...conditions))
      .orderBy(desc(teamMessages.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);

    return rows;
  }

  /** Send a message from one agent to another. */
  async function sendMessage(companyId: string, fromAgentId: string, input: SendMessageInput) {
    if (!input.toAgentId || !input.content) {
      throw badRequest("toAgentId and content are required");
    }

    const [msg] = await db
      .insert(teamMessages)
      .values({
        companyId,
        fromAgentId,
        toAgentId: input.toAgentId,
        parentId: input.parentId ?? null,
        issueId: input.issueId ?? null,
        content: input.content,
        metadata: input.metadata ?? null,
      })
      .returning();

    log.info({ messageId: msg!.id, from: fromAgentId, to: input.toAgentId }, "Message sent");
    return msg!;
  }

  /** Mark a message as read. */
  async function markMessageRead(messageId: string) {
    const [updated] = await db
      .update(teamMessages)
      .set({ status: "read", readAt: new Date() })
      .where(eq(teamMessages.id, messageId))
      .returning();
    if (!updated) throw notFound("Message not found");
    return updated;
  }

  // =========================================================================
  // 2. Daily Reports / Standups
  // =========================================================================

  /** List daily reports for a company, optionally filtered by agent and date range. */
  async function listDailyReports(
    companyId: string,
    opts: { agentId?: string; from?: string; to?: string; limit?: number },
  ) {
    const conditions = [eq(dailyReports.companyId, companyId)];
    if (opts.agentId) conditions.push(eq(dailyReports.agentId, opts.agentId));
    if (opts.from) conditions.push(gte(dailyReports.reportDate, opts.from));
    if (opts.to) conditions.push(lte(dailyReports.reportDate, opts.to));

    return db
      .select({
        id: dailyReports.id,
        companyId: dailyReports.companyId,
        agentId: dailyReports.agentId,
        reportDate: dailyReports.reportDate,
        completedTasks: dailyReports.completedTasks,
        inProgressTasks: dailyReports.inProgressTasks,
        blockers: dailyReports.blockers,
        plannedTasks: dailyReports.plannedTasks,
        summary: dailyReports.summary,
        status: dailyReports.status,
        totalCostCents: dailyReports.totalCostCents,
        tasksCompletedCount: dailyReports.tasksCompletedCount,
        createdAt: dailyReports.createdAt,
        updatedAt: dailyReports.updatedAt,
        agentName: sql<string>`(SELECT name FROM agents WHERE id = ${dailyReports.agentId})`,
      })
      .from(dailyReports)
      .where(and(...conditions))
      .orderBy(desc(dailyReports.reportDate))
      .limit(opts.limit ?? 30);
  }

  /** Generate (or return existing) daily report for a given agent and date. */
  async function generateDailyReport(companyId: string, agentId: string, reportDate: string) {
    // Check if report already exists for this agent+date
    const existing = await db
      .select()
      .from(dailyReports)
      .where(and(eq(dailyReports.companyId, companyId), eq(dailyReports.agentId, agentId), eq(dailyReports.reportDate, reportDate)))
      .limit(1);

    if (existing.length > 0) return existing[0]!;

    // Aggregate data from issues table for this agent on this date
    const completedIssues = await db
      .select({ title: issues.title })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.assigneeAgentId, agentId),
          eq(issues.status, "done"),
        ),
      )
      .limit(20);

    const inProgressIssues = await db
      .select({ title: issues.title })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.assigneeAgentId, agentId),
          eq(issues.status, "in_progress"),
        ),
      )
      .limit(20);

    const blockedIssues = await db
      .select({ title: issues.title })
      .from(issues)
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.assigneeAgentId, agentId),
          eq(issues.status, "blocked"),
        ),
      )
      .limit(10);

    const [report] = await db
      .insert(dailyReports)
      .values({
        companyId,
        agentId,
        reportDate,
        completedTasks: completedIssues.map((i) => i.title ?? "Untitled task"),
        inProgressTasks: inProgressIssues.map((i) => i.title ?? "Untitled task"),
        blockers: blockedIssues.map((i) => i.title ?? "Untitled task"),
        plannedTasks: [],
        status: "generated",
        tasksCompletedCount: completedIssues.length,
      })
      .returning();

    log.info({ reportId: report!.id, agentId, reportDate }, "Daily report generated");
    return report!;
  }

  /** Generate daily reports for all active agents in a company. */
  async function generateAllDailyReports(companyId: string, reportDate: string) {
    const activeAgents = await db
      .select({ id: agents.id })
      .from(agents)
      .where(and(eq(agents.companyId, companyId), eq(agents.status, "active")));

    const reports = [];
    for (const agent of activeAgents) {
      const report = await generateDailyReport(companyId, agent.id, reportDate);
      reports.push(report);
    }
    return reports;
  }

  // =========================================================================
  // 3. Peer Review
  // =========================================================================

  /** List peer reviews for a company with optional filters. */
  async function listPeerReviews(
    companyId: string,
    opts: { issueId?: string; authorAgentId?: string; reviewerAgentId?: string; status?: string; limit?: number },
  ) {
    const conditions = [eq(peerReviews.companyId, companyId)];
    if (opts.issueId) conditions.push(eq(peerReviews.issueId, opts.issueId));
    if (opts.authorAgentId) conditions.push(eq(peerReviews.authorAgentId, opts.authorAgentId));
    if (opts.reviewerAgentId) conditions.push(eq(peerReviews.reviewerAgentId, opts.reviewerAgentId));
    if (opts.status) conditions.push(eq(peerReviews.status, opts.status as never));

    return db
      .select({
        id: peerReviews.id,
        companyId: peerReviews.companyId,
        issueId: peerReviews.issueId,
        authorAgentId: peerReviews.authorAgentId,
        reviewerAgentId: peerReviews.reviewerAgentId,
        status: peerReviews.status,
        decision: peerReviews.decision,
        comment: peerReviews.comment,
        contentSnapshot: peerReviews.contentSnapshot,
        revision: peerReviews.revision,
        requestedByUserId: peerReviews.requestedByUserId,
        createdAt: peerReviews.createdAt,
        updatedAt: peerReviews.updatedAt,
        completedAt: peerReviews.completedAt,
        authorAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${peerReviews.authorAgentId})`,
        reviewerAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${peerReviews.reviewerAgentId})`,
        issueTitle: sql<string>`(SELECT title FROM issues WHERE id = ${peerReviews.issueId})`,
      })
      .from(peerReviews)
      .where(and(...conditions))
      .orderBy(desc(peerReviews.createdAt))
      .limit(opts.limit ?? 50);
  }

  /** Create a new peer review request. */
  async function createPeerReview(companyId: string, input: CreatePeerReviewInput, userId?: string) {
    if (!input.issueId || !input.authorAgentId || !input.reviewerAgentId) {
      throw badRequest("issueId, authorAgentId, and reviewerAgentId are required");
    }

    const [review] = await db
      .insert(peerReviews)
      .values({
        companyId,
        issueId: input.issueId,
        authorAgentId: input.authorAgentId,
        reviewerAgentId: input.reviewerAgentId,
        contentSnapshot: input.contentSnapshot ?? null,
        requestedByUserId: userId ?? null,
      })
      .returning();

    log.info({ reviewId: review!.id, issue: input.issueId }, "Peer review created");
    return review!;
  }

  /** Submit a review decision (approve, reject, or request revision). */
  async function submitPeerReview(reviewId: string, input: SubmitPeerReviewInput) {
    if (!input.decision) throw badRequest("decision is required");

    const newStatus = input.decision === "approved" ? "approved" as const
      : input.decision === "rejected" ? "rejected" as const
      : "revision_requested" as const;

    const [updated] = await db
      .update(peerReviews)
      .set({
        status: newStatus,
        decision: input.decision,
        comment: input.comment ?? null,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(peerReviews.id, reviewId))
      .returning();

    if (!updated) throw notFound("Peer review not found");
    log.info({ reviewId, decision: input.decision }, "Peer review submitted");
    return updated;
  }

  // =========================================================================
  // 4. Escalation Protocol
  // =========================================================================

  /** List escalation rules for a company. */
  async function listEscalationRules(companyId: string) {
    return db
      .select({
        id: escalationRules.id,
        companyId: escalationRules.companyId,
        name: escalationRules.name,
        description: escalationRules.description,
        triggerType: escalationRules.triggerType,
        triggerConfig: escalationRules.triggerConfig,
        targetAgentId: escalationRules.targetAgentId,
        escalateToHuman: escalationRules.escalateToHuman,
        enabled: escalationRules.enabled,
        priority: escalationRules.priority,
        createdAt: escalationRules.createdAt,
        updatedAt: escalationRules.updatedAt,
        targetAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${escalationRules.targetAgentId})`,
      })
      .from(escalationRules)
      .where(eq(escalationRules.companyId, companyId))
      .orderBy(asc(escalationRules.priority));
  }

  /** Create a new escalation rule. */
  async function createEscalationRule(companyId: string, input: CreateEscalationRuleInput) {
    if (!input.name || !input.triggerType || !input.triggerConfig) {
      throw badRequest("name, triggerType, and triggerConfig are required");
    }

    const [rule] = await db
      .insert(escalationRules)
      .values({
        companyId,
        name: input.name,
        description: input.description ?? null,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig,
        targetAgentId: input.targetAgentId ?? null,
        escalateToHuman: input.escalateToHuman ?? false,
        priority: input.priority ?? 0,
      })
      .returning();

    return rule!;
  }

  /** Update an escalation rule. */
  async function updateEscalationRule(ruleId: string, input: UpdateEscalationRuleInput) {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.description !== undefined) updates.description = input.description;
    if (input.triggerType !== undefined) updates.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) updates.triggerConfig = input.triggerConfig;
    if (input.targetAgentId !== undefined) updates.targetAgentId = input.targetAgentId;
    if (input.escalateToHuman !== undefined) updates.escalateToHuman = input.escalateToHuman;
    if (input.enabled !== undefined) updates.enabled = input.enabled;
    if (input.priority !== undefined) updates.priority = input.priority;

    const [updated] = await db
      .update(escalationRules)
      .set(updates)
      .where(eq(escalationRules.id, ruleId))
      .returning();

    if (!updated) throw notFound("Escalation rule not found");
    return updated;
  }

  /** Delete an escalation rule. */
  async function deleteEscalationRule(ruleId: string) {
    const [deleted] = await db
      .delete(escalationRules)
      .where(eq(escalationRules.id, ruleId))
      .returning();
    if (!deleted) throw notFound("Escalation rule not found");
    return { ok: true };
  }

  /** List escalation events for a company. */
  async function listEscalationEvents(
    companyId: string,
    opts: { status?: string; sourceAgentId?: string; limit?: number },
  ) {
    const conditions = [eq(escalationEvents.companyId, companyId)];
    if (opts.status) conditions.push(eq(escalationEvents.status, opts.status as never));
    if (opts.sourceAgentId) conditions.push(eq(escalationEvents.sourceAgentId, opts.sourceAgentId));

    return db
      .select({
        id: escalationEvents.id,
        companyId: escalationEvents.companyId,
        ruleId: escalationEvents.ruleId,
        sourceAgentId: escalationEvents.sourceAgentId,
        targetAgentId: escalationEvents.targetAgentId,
        issueId: escalationEvents.issueId,
        triggerType: escalationEvents.triggerType,
        status: escalationEvents.status,
        reason: escalationEvents.reason,
        resolution: escalationEvents.resolution,
        resolvedByUserId: escalationEvents.resolvedByUserId,
        createdAt: escalationEvents.createdAt,
        resolvedAt: escalationEvents.resolvedAt,
        sourceAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${escalationEvents.sourceAgentId})`,
        targetAgentName: sql<string>`(SELECT name FROM agents WHERE id = ${escalationEvents.targetAgentId})`,
        ruleName: sql<string>`(SELECT name FROM escalation_rules WHERE id = ${escalationEvents.ruleId})`,
      })
      .from(escalationEvents)
      .where(and(...conditions))
      .orderBy(desc(escalationEvents.createdAt))
      .limit(opts.limit ?? 50);
  }

  /** Create an escalation event (triggered by the system when a rule matches). */
  async function createEscalationEvent(
    companyId: string,
    input: { ruleId?: string; sourceAgentId: string; targetAgentId?: string; issueId?: string; triggerType: string; reason: string },
  ) {
    const [event] = await db
      .insert(escalationEvents)
      .values({
        companyId,
        ruleId: input.ruleId ?? null,
        sourceAgentId: input.sourceAgentId,
        targetAgentId: input.targetAgentId ?? null,
        issueId: input.issueId ?? null,
        triggerType: input.triggerType as never,
        reason: input.reason,
      })
      .returning();

    log.warn({ eventId: event!.id, source: input.sourceAgentId, trigger: input.triggerType }, "Escalation created");
    return event!;
  }

  /** Resolve or dismiss an escalation event. */
  async function resolveEscalation(eventId: string, input: ResolveEscalationInput, userId?: string) {
    const [updated] = await db
      .update(escalationEvents)
      .set({
        status: input.status,
        resolution: input.resolution,
        resolvedByUserId: userId ?? null,
        resolvedAt: new Date(),
      })
      .where(eq(escalationEvents.id, eventId))
      .returning();

    if (!updated) throw notFound("Escalation event not found");
    return updated;
  }

  // =========================================================================
  // 5. Notification Center
  // =========================================================================

  /** List notifications for a user within a company. */
  async function listNotifications(
    companyId: string,
    opts: { userId?: string; unreadOnly?: boolean; type?: string; limit?: number; offset?: number },
  ) {
    const conditions = [eq(notifications.companyId, companyId)];
    if (opts.userId) {
      // Show notifications targeted at this user OR broadcast (null userId)
      conditions.push(or(eq(notifications.userId, opts.userId), isNull(notifications.userId))!);
    }
    if (opts.unreadOnly) conditions.push(eq(notifications.read, false));
    if (opts.type) conditions.push(eq(notifications.type, opts.type as NotificationType));

    return db
      .select()
      .from(notifications)
      .where(and(...conditions))
      .orderBy(desc(notifications.createdAt))
      .limit(opts.limit ?? 50)
      .offset(opts.offset ?? 0);
  }

  /** Get notification counts for a user. */
  async function getNotificationCounts(companyId: string, userId?: string) {
    const conditions = [eq(notifications.companyId, companyId)];
    if (userId) {
      conditions.push(or(eq(notifications.userId, userId), isNull(notifications.userId))!);
    }

    const [totalRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions));

    const [unreadRow] = await db
      .select({ count: count() })
      .from(notifications)
      .where(and(...conditions, eq(notifications.read, false)));

    // Get counts by type
    const typeCounts = await db
      .select({ type: notifications.type, count: count() })
      .from(notifications)
      .where(and(...conditions, eq(notifications.read, false)))
      .groupBy(notifications.type);

    const byType: Record<string, number> = {};
    for (const row of typeCounts) {
      byType[row.type] = row.count;
    }

    return {
      total: totalRow?.count ?? 0,
      unread: unreadRow?.count ?? 0,
      byType: byType as Record<NotificationType, number>,
    };
  }

  /** Create a notification. */
  async function createNotification(companyId: string, input: CreateNotificationInput) {
    if (!input.title || !input.type) {
      throw badRequest("title and type are required");
    }

    const [notif] = await db
      .insert(notifications)
      .values({
        companyId,
        userId: input.userId ?? null,
        type: input.type,
        priority: input.priority ?? "medium",
        title: input.title,
        body: input.body ?? null,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
        channels: input.channels ?? ["web"],
        actionUrl: input.actionUrl ?? null,
      })
      .returning();

    return notif!;
  }

  /** Mark a notification as read. */
  async function markNotificationRead(notificationId: string) {
    const [updated] = await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(eq(notifications.id, notificationId))
      .returning();
    if (!updated) throw notFound("Notification not found");
    return updated;
  }

  /** Mark all notifications as read for a user in a company. */
  async function markAllNotificationsRead(companyId: string, userId: string) {
    await db
      .update(notifications)
      .set({ read: true, readAt: new Date() })
      .where(
        and(
          eq(notifications.companyId, companyId),
          or(eq(notifications.userId, userId), isNull(notifications.userId))!,
          eq(notifications.read, false),
        ),
      );
    return { ok: true };
  }

  /** Dismiss a notification. */
  async function dismissNotification(notificationId: string) {
    const [updated] = await db
      .update(notifications)
      .set({ dismissed: true, read: true, readAt: new Date() })
      .where(eq(notifications.id, notificationId))
      .returning();
    if (!updated) throw notFound("Notification not found");
    return updated;
  }

  // =========================================================================
  // 6. Performance Dashboard
  // =========================================================================

  /** Get performance summary for a company over a date range. */
  async function getPerformanceSummary(
    companyId: string,
    opts: { from?: string; to?: string },
  ) {
    const conditions = [eq(performanceSnapshots.companyId, companyId)];
    if (opts.from) conditions.push(gte(performanceSnapshots.periodDate, opts.from));
    if (opts.to) conditions.push(lte(performanceSnapshots.periodDate, opts.to));

    // Company-wide aggregate (agentId is null)
    const [companyRow] = await db
      .select()
      .from(performanceSnapshots)
      .where(and(...conditions, isNull(performanceSnapshots.agentId)))
      .orderBy(desc(performanceSnapshots.periodDate))
      .limit(1);

    // Per-agent snapshots
    const agentRows = await db
      .select({
        id: performanceSnapshots.id,
        companyId: performanceSnapshots.companyId,
        agentId: performanceSnapshots.agentId,
        periodDate: performanceSnapshots.periodDate,
        tasksAssigned: performanceSnapshots.tasksAssigned,
        tasksCompleted: performanceSnapshots.tasksCompleted,
        workflowRuns: performanceSnapshots.workflowRuns,
        workflowSuccesses: performanceSnapshots.workflowSuccesses,
        avgResponseTimeMs: performanceSnapshots.avgResponseTimeMs,
        totalCostCents: performanceSnapshots.totalCostCents,
        peerReviewsSubmitted: performanceSnapshots.peerReviewsSubmitted,
        peerReviewsPassed: performanceSnapshots.peerReviewsPassed,
        humanEdits: performanceSnapshots.humanEdits,
        totalOutputs: performanceSnapshots.totalOutputs,
        createdAt: performanceSnapshots.createdAt,
        agentName: sql<string>`(SELECT name FROM agents WHERE id = ${performanceSnapshots.agentId})`,
      })
      .from(performanceSnapshots)
      .where(and(...conditions, sql`${performanceSnapshots.agentId} IS NOT NULL`))
      .orderBy(desc(performanceSnapshots.periodDate));

    // Compute rates from the aggregated data
    const totals = {
      assigned: 0,
      completed: 0,
      wfRuns: 0,
      wfSuccess: 0,
      prSubmitted: 0,
      prPassed: 0,
      humanEdits: 0,
      outputs: 0,
      cost: 0,
    };

    for (const row of agentRows) {
      totals.assigned += row.tasksAssigned;
      totals.completed += row.tasksCompleted;
      totals.wfRuns += row.workflowRuns;
      totals.wfSuccess += row.workflowSuccesses;
      totals.prSubmitted += row.peerReviewsSubmitted;
      totals.prPassed += row.peerReviewsPassed;
      totals.humanEdits += row.humanEdits;
      totals.outputs += row.totalOutputs;
      totals.cost += row.totalCostCents;
    }

    return {
      company: companyRow ?? null,
      agents: agentRows,
      taskCompletionRate: totals.assigned > 0 ? totals.completed / totals.assigned : 0,
      workflowSuccessRate: totals.wfRuns > 0 ? totals.wfSuccess / totals.wfRuns : 0,
      peerReviewPassRate: totals.prSubmitted > 0 ? totals.prPassed / totals.prSubmitted : 0,
      humanEditRate: totals.outputs > 0 ? totals.humanEdits / totals.outputs : 0,
      avgCostPerTask: totals.completed > 0 ? totals.cost / totals.completed : 0,
    };
  }

  /** List performance snapshot history (for charts). */
  async function listPerformanceSnapshots(
    companyId: string,
    opts: { agentId?: string; from?: string; to?: string; limit?: number },
  ) {
    const conditions = [eq(performanceSnapshots.companyId, companyId)];
    if (opts.agentId) {
      conditions.push(eq(performanceSnapshots.agentId, opts.agentId));
    } else {
      conditions.push(isNull(performanceSnapshots.agentId));
    }
    if (opts.from) conditions.push(gte(performanceSnapshots.periodDate, opts.from));
    if (opts.to) conditions.push(lte(performanceSnapshots.periodDate, opts.to));

    return db
      .select()
      .from(performanceSnapshots)
      .where(and(...conditions))
      .orderBy(asc(performanceSnapshots.periodDate))
      .limit(opts.limit ?? 90);
  }

  // =========================================================================
  // 7. Onboarding
  // =========================================================================

  /** Get or create an onboarding flow for an agent. */
  async function getOnboardingFlow(companyId: string, agentId: string) {
    const [existing] = await db
      .select({
        id: onboardingFlows.id,
        companyId: onboardingFlows.companyId,
        agentId: onboardingFlows.agentId,
        status: onboardingFlows.status,
        steps: onboardingFlows.steps,
        testTaskIssueId: onboardingFlows.testTaskIssueId,
        startedAt: onboardingFlows.startedAt,
        completedAt: onboardingFlows.completedAt,
        createdAt: onboardingFlows.createdAt,
        updatedAt: onboardingFlows.updatedAt,
        agentName: sql<string>`(SELECT name FROM agents WHERE id = ${onboardingFlows.agentId})`,
      })
      .from(onboardingFlows)
      .where(and(eq(onboardingFlows.companyId, companyId), eq(onboardingFlows.agentId, agentId)))
      .limit(1);

    return existing ?? null;
  }

  /** Start the onboarding flow for a new agent. */
  async function startOnboarding(companyId: string, agentId: string) {
    // Define onboarding steps
    const defaultSteps: OnboardingStepRecord[] = [
      { name: "receive_company_context", status: "pending" },
      { name: "read_team_sops", status: "pending" },
      { name: "meet_teammates", status: "pending" },
      { name: "run_test_task", status: "pending" },
    ];

    const [flow] = await db
      .insert(onboardingFlows)
      .values({
        companyId,
        agentId,
        status: "in_progress",
        steps: defaultSteps,
        startedAt: new Date(),
      })
      .returning();

    log.info({ flowId: flow!.id, agentId }, "Onboarding started");
    return flow!;
  }

  /** Update a specific onboarding step's status. */
  async function updateOnboardingStep(
    flowId: string,
    stepName: string,
    stepStatus: string,
    detail?: string,
  ) {
    const [flow] = await db
      .select()
      .from(onboardingFlows)
      .where(eq(onboardingFlows.id, flowId));

    if (!flow) throw notFound("Onboarding flow not found");

    const steps = (flow.steps as OnboardingStepRecord[]).map((s) => {
      if (s.name === stepName) {
        return {
          ...s,
          status: stepStatus as OnboardingStepRecord["status"],
          detail,
          completedAt: stepStatus === "completed" ? new Date().toISOString() : undefined,
        };
      }
      return s;
    });

    // Check if all steps are completed
    const allCompleted = steps.every((s) => s.status === "completed" || s.status === "skipped");
    const anyFailed = steps.some((s) => s.status === "failed");

    const [updated] = await db
      .update(onboardingFlows)
      .set({
        steps,
        status: allCompleted ? "completed" : anyFailed ? "failed" : "in_progress",
        completedAt: allCompleted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(onboardingFlows.id, flowId))
      .returning();

    return updated!;
  }

  /** List all onboarding flows for a company. */
  async function listOnboardingFlows(companyId: string) {
    return db
      .select({
        id: onboardingFlows.id,
        companyId: onboardingFlows.companyId,
        agentId: onboardingFlows.agentId,
        status: onboardingFlows.status,
        steps: onboardingFlows.steps,
        testTaskIssueId: onboardingFlows.testTaskIssueId,
        startedAt: onboardingFlows.startedAt,
        completedAt: onboardingFlows.completedAt,
        createdAt: onboardingFlows.createdAt,
        updatedAt: onboardingFlows.updatedAt,
        agentName: sql<string>`(SELECT name FROM agents WHERE id = ${onboardingFlows.agentId})`,
      })
      .from(onboardingFlows)
      .where(eq(onboardingFlows.companyId, companyId))
      .orderBy(desc(onboardingFlows.createdAt));
  }

  // =========================================================================
  // 8. Feedback Loop
  // =========================================================================

  /** List feedback entries for a company. */
  async function listFeedback(
    companyId: string,
    opts: { agentId?: string; category?: string; status?: string; limit?: number },
  ) {
    const conditions = [eq(feedbackEntries.companyId, companyId)];
    if (opts.agentId) conditions.push(eq(feedbackEntries.agentId, opts.agentId));
    if (opts.category) conditions.push(eq(feedbackEntries.category, opts.category as never));
    if (opts.status) conditions.push(eq(feedbackEntries.status, opts.status as never));

    return db
      .select({
        id: feedbackEntries.id,
        companyId: feedbackEntries.companyId,
        agentId: feedbackEntries.agentId,
        issueId: feedbackEntries.issueId,
        userId: feedbackEntries.userId,
        category: feedbackEntries.category,
        feedback: feedbackEntries.feedback,
        suggestedUpdate: feedbackEntries.suggestedUpdate,
        status: feedbackEntries.status,
        applied: feedbackEntries.applied,
        appliedAt: feedbackEntries.appliedAt,
        createdAt: feedbackEntries.createdAt,
        updatedAt: feedbackEntries.updatedAt,
        agentName: sql<string>`(SELECT name FROM agents WHERE id = ${feedbackEntries.agentId})`,
      })
      .from(feedbackEntries)
      .where(and(...conditions))
      .orderBy(desc(feedbackEntries.createdAt))
      .limit(opts.limit ?? 50);
  }

  /** Create a new feedback entry. */
  async function createFeedback(companyId: string, userId: string, input: CreateFeedbackInput) {
    if (!input.agentId || !input.feedback) {
      throw badRequest("agentId and feedback are required");
    }

    const [entry] = await db
      .insert(feedbackEntries)
      .values({
        companyId,
        agentId: input.agentId,
        issueId: input.issueId ?? null,
        userId,
        category: input.category ?? "general",
        feedback: input.feedback,
      })
      .returning();

    log.info({ feedbackId: entry!.id, agentId: input.agentId }, "Feedback created");
    return entry!;
  }

  /** Apply or reject a feedback suggestion. */
  async function applyFeedback(feedbackId: string, input: ApplyFeedbackInput) {
    const newStatus = input.accepted ? "applied" as const : "rejected" as const;

    const [updated] = await db
      .update(feedbackEntries)
      .set({
        status: newStatus,
        applied: input.accepted,
        appliedAt: input.accepted ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(feedbackEntries.id, feedbackId))
      .returning();

    if (!updated) throw notFound("Feedback entry not found");
    return updated;
  }

  // =========================================================================
  // Return public API
  // =========================================================================

  return {
    // Messaging
    listMessages,
    sendMessage,
    markMessageRead,
    // Daily Reports
    listDailyReports,
    generateDailyReport,
    generateAllDailyReports,
    // Peer Reviews
    listPeerReviews,
    createPeerReview,
    submitPeerReview,
    // Escalation
    listEscalationRules,
    createEscalationRule,
    updateEscalationRule,
    deleteEscalationRule,
    listEscalationEvents,
    createEscalationEvent,
    resolveEscalation,
    // Notifications
    listNotifications,
    getNotificationCounts,
    createNotification,
    markNotificationRead,
    markAllNotificationsRead,
    dismissNotification,
    // Performance
    getPerformanceSummary,
    listPerformanceSnapshots,
    // Onboarding
    getOnboardingFlow,
    startOnboarding,
    updateOnboardingStep,
    listOnboardingFlows,
    // Feedback
    listFeedback,
    createFeedback,
    applyFeedback,
  };
}
