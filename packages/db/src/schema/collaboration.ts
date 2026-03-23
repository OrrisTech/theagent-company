import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { agents } from "./agents.js";
import { issues } from "./issues.js";
import type {
  MessageStatus,
  DailyReportStatus,
  PeerReviewStatus,
  PeerReviewDecision,
  EscalationStatus,
  EscalationTriggerType,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  FeedbackCategory,
  FeedbackStatus,
  OnboardingStatus,
  OnboardingStepStatus,
} from "@theagentcompany/shared";

// ---------------------------------------------------------------------------
// 1. Agent-to-Agent Messaging
// ---------------------------------------------------------------------------

/**
 * `team_messages` — direct messages between team members (agents).
 *
 * Supports persistent, auditable agent-to-agent communication that goes
 * beyond simple task delegation. Messages can be threaded via parentId.
 */
export const teamMessages = pgTable(
  "team_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The agent sending the message. */
    fromAgentId: uuid("from_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** The agent receiving the message. */
    toAgentId: uuid("to_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** Optional parent message ID for threading. */
    parentId: uuid("parent_id"),
    /** Optional related issue/task for context. */
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    /** Message content (supports markdown). */
    content: text("content").notNull(),
    /** Delivery status: sent, delivered, read. */
    status: text("status").$type<MessageStatus>().notNull().default("sent"),
    /** Optional structured metadata (attachments, context, etc.). */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("team_messages_company_idx").on(table.companyId),
    fromIdx: index("team_messages_from_idx").on(table.fromAgentId),
    toIdx: index("team_messages_to_idx").on(table.toAgentId),
    parentIdx: index("team_messages_parent_idx").on(table.parentId),
    issueIdx: index("team_messages_issue_idx").on(table.issueId),
  }),
);

// ---------------------------------------------------------------------------
// 2. Daily Reports / Standups
// ---------------------------------------------------------------------------

/**
 * `daily_reports` — auto-generated daily work summaries per agent.
 *
 * Each report aggregates completed tasks, in-progress work, blockers,
 * and next-day plans for a specific team member on a given date.
 */
export const dailyReports = pgTable(
  "daily_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The agent this report is about. */
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** The date this report covers (YYYY-MM-DD stored as text for simplicity). */
    reportDate: text("report_date").notNull(),
    /** Tasks completed during this period. */
    completedTasks: jsonb("completed_tasks").$type<string[]>().notNull().default([]),
    /** Tasks currently in progress. */
    inProgressTasks: jsonb("in_progress_tasks").$type<string[]>().notNull().default([]),
    /** Blockers or issues encountered. */
    blockers: jsonb("blockers").$type<string[]>().notNull().default([]),
    /** Planned tasks for the next day. */
    plannedTasks: jsonb("planned_tasks").$type<string[]>().notNull().default([]),
    /** Free-form summary text (can be LLM-generated). */
    summary: text("summary"),
    /** Report generation status. */
    status: text("status").$type<DailyReportStatus>().notNull().default("pending"),
    /** Total cost of tasks completed (cents). */
    totalCostCents: integer("total_cost_cents"),
    /** Total tasks completed count. */
    tasksCompletedCount: integer("tasks_completed_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("daily_reports_company_idx").on(table.companyId),
    agentIdx: index("daily_reports_agent_idx").on(table.agentId),
    dateIdx: index("daily_reports_date_idx").on(table.reportDate),
    agentDateIdx: index("daily_reports_agent_date_idx").on(table.agentId, table.reportDate),
  }),
);

// ---------------------------------------------------------------------------
// 3. Peer Review
// ---------------------------------------------------------------------------

/**
 * `peer_reviews` — review records for agent work products.
 *
 * When member A finishes work, it can be routed to member B for review.
 * Review comments auto-feedback to the original author. Approval advances
 * the work to the next stage.
 */
export const peerReviews = pgTable(
  "peer_reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The issue/task whose output is being reviewed. */
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    /** The agent whose work is being reviewed (author). */
    authorAgentId: uuid("author_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** The agent performing the review (reviewer). */
    reviewerAgentId: uuid("reviewer_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** Overall review status: pending, in_review, approved, rejected, revision_requested. */
    status: text("status").$type<PeerReviewStatus>().notNull().default("pending"),
    /** Reviewer's decision. */
    decision: text("decision").$type<PeerReviewDecision>(),
    /** Reviewer's comment / feedback. */
    comment: text("comment"),
    /** Content/output being reviewed (snapshot). */
    contentSnapshot: text("content_snapshot"),
    /** Revision number (incremented when author revises and resubmits). */
    revision: integer("revision").notNull().default(1),
    /** Human user who requested this review (optional). */
    requestedByUserId: text("requested_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("peer_reviews_company_idx").on(table.companyId),
    issueIdx: index("peer_reviews_issue_idx").on(table.issueId),
    authorIdx: index("peer_reviews_author_idx").on(table.authorAgentId),
    reviewerIdx: index("peer_reviews_reviewer_idx").on(table.reviewerAgentId),
    statusIdx: index("peer_reviews_status_idx").on(table.status),
  }),
);

// ---------------------------------------------------------------------------
// 4. Escalation Protocol
// ---------------------------------------------------------------------------

/**
 * `escalation_rules` — configurable rules for when to escalate.
 *
 * Each rule defines a trigger condition and the escalation target
 * (manager agent or human board member).
 */
export const escalationRules = pgTable(
  "escalation_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Human-readable name for the rule. */
    name: text("name").notNull(),
    /** Description of when this rule triggers. */
    description: text("description"),
    /** Trigger type: budget_exceeded, retries_failed, sensitive_op, agent_uncertain. */
    triggerType: text("trigger_type").$type<EscalationTriggerType>().notNull(),
    /** Trigger configuration (threshold values, patterns, etc.). */
    triggerConfig: jsonb("trigger_config").$type<Record<string, unknown>>().notNull(),
    /** Target agent to escalate to (null = escalate to human board). */
    targetAgentId: uuid("target_agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** Whether to escalate to a human user instead of an agent. */
    escalateToHuman: boolean("escalate_to_human").notNull().default(false),
    /** Whether this rule is currently enabled. */
    enabled: boolean("enabled").notNull().default(true),
    /** Priority order (lower = checked first). */
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("escalation_rules_company_idx").on(table.companyId),
    triggerIdx: index("escalation_rules_trigger_idx").on(table.triggerType),
  }),
);

/**
 * `escalation_events` — log of actual escalations that have occurred.
 */
export const escalationEvents = pgTable(
  "escalation_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The rule that triggered this escalation. */
    ruleId: uuid("rule_id").references(() => escalationRules.id, { onDelete: "set null" }),
    /** The agent that triggered the escalation. */
    sourceAgentId: uuid("source_agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** The agent the issue was escalated to (null if escalated to human). */
    targetAgentId: uuid("target_agent_id").references(() => agents.id, { onDelete: "set null" }),
    /** Related issue, if applicable. */
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    /** What triggered the escalation. */
    triggerType: text("trigger_type").$type<EscalationTriggerType>().notNull(),
    /** Escalation status: open, acknowledged, resolved, dismissed. */
    status: text("status").$type<EscalationStatus>().notNull().default("open"),
    /** Reason / context for the escalation. */
    reason: text("reason").notNull(),
    /** Resolution notes (filled when resolved). */
    resolution: text("resolution"),
    /** User who resolved this escalation (if human-resolved). */
    resolvedByUserId: text("resolved_by_user_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("escalation_events_company_idx").on(table.companyId),
    sourceIdx: index("escalation_events_source_idx").on(table.sourceAgentId),
    statusIdx: index("escalation_events_status_idx").on(table.status),
    ruleIdx: index("escalation_events_rule_idx").on(table.ruleId),
  }),
);

// ---------------------------------------------------------------------------
// 5. Notification Center
// ---------------------------------------------------------------------------

/**
 * `notifications` — unified notification inbox for humans.
 *
 * Aggregates approvals needed, workflow failures, budget warnings,
 * escalations, and other actionable items.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Target user ID who should see this notification. Null = broadcast to all company members. */
    userId: text("user_id"),
    /** Notification type: approval_needed, workflow_failed, budget_warning, escalation, peer_review, info. */
    type: text("type").$type<NotificationType>().notNull(),
    /** Priority: low, medium, high, urgent. */
    priority: text("priority").$type<NotificationPriority>().notNull().default("medium"),
    /** Notification title (short). */
    title: text("title").notNull(),
    /** Notification body (longer description). */
    body: text("body"),
    /** Reference entity type (e.g., "issue", "workflow_run", "escalation", "peer_review"). */
    refType: text("ref_type"),
    /** Reference entity ID for deep-linking. */
    refId: text("ref_id"),
    /** Which channels this was sent to. */
    channels: jsonb("channels").$type<NotificationChannel[]>().notNull().default(["web"]),
    /** Whether the notification has been read. */
    read: boolean("read").notNull().default(false),
    /** Whether the notification has been dismissed / acted upon. */
    dismissed: boolean("dismissed").notNull().default(false),
    /** Optional action URL for deep-linking. */
    actionUrl: text("action_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    companyIdx: index("notifications_company_idx").on(table.companyId),
    userIdx: index("notifications_user_idx").on(table.userId),
    typeIdx: index("notifications_type_idx").on(table.type),
    readIdx: index("notifications_read_idx").on(table.read),
    priorityIdx: index("notifications_priority_idx").on(table.priority),
  }),
);

// ---------------------------------------------------------------------------
// 6. Performance Metrics (aggregated snapshots)
// ---------------------------------------------------------------------------

/**
 * `performance_snapshots` — periodic performance metric snapshots per agent.
 *
 * Captures task completion rate, workflow success rate, average response time,
 * cost efficiency, peer review pass rate, and human edit rate.
 * Stored per agent per period (daily granularity).
 */
export const performanceSnapshots = pgTable(
  "performance_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** Agent this snapshot is about. Null = company-wide aggregate. */
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "cascade" }),
    /** The period this snapshot covers (YYYY-MM-DD). */
    periodDate: text("period_date").notNull(),
    /** Tasks assigned during this period. */
    tasksAssigned: integer("tasks_assigned").notNull().default(0),
    /** Tasks completed during this period. */
    tasksCompleted: integer("tasks_completed").notNull().default(0),
    /** Workflow runs executed. */
    workflowRuns: integer("workflow_runs").notNull().default(0),
    /** Workflow runs that succeeded. */
    workflowSuccesses: integer("workflow_successes").notNull().default(0),
    /** Average response time in milliseconds (from assignment to start). */
    avgResponseTimeMs: integer("avg_response_time_ms"),
    /** Total cost in cents for this period. */
    totalCostCents: integer("total_cost_cents").notNull().default(0),
    /** Peer reviews submitted for review. */
    peerReviewsSubmitted: integer("peer_reviews_submitted").notNull().default(0),
    /** Peer reviews that passed on first attempt. */
    peerReviewsPassed: integer("peer_reviews_passed").notNull().default(0),
    /** Number of times a human edited agent output. */
    humanEdits: integer("human_edits").notNull().default(0),
    /** Total outputs produced (for human edit rate calculation). */
    totalOutputs: integer("total_outputs").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("perf_snapshots_company_idx").on(table.companyId),
    agentIdx: index("perf_snapshots_agent_idx").on(table.agentId),
    periodIdx: index("perf_snapshots_period_idx").on(table.periodDate),
    agentPeriodIdx: index("perf_snapshots_agent_period_idx").on(table.agentId, table.periodDate),
  }),
);

// ---------------------------------------------------------------------------
// 7. Onboarding
// ---------------------------------------------------------------------------

/**
 * `onboarding_flows` — tracks onboarding progress for new team members.
 *
 * When a new agent is created, an onboarding flow is automatically started.
 * It walks the agent through receiving company context, reading SOPs,
 * learning about teammates, and running a test task.
 */
export const onboardingFlows = pgTable(
  "onboarding_flows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The newly created agent being onboarded. */
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** Overall onboarding status. */
    status: text("status").$type<OnboardingStatus>().notNull().default("pending"),
    /** Individual step results (JSON array of step objects). */
    steps: jsonb("steps").$type<OnboardingStepRecord[]>().notNull().default([]),
    /** Optional test task issue that was created for onboarding. */
    testTaskIssueId: uuid("test_task_issue_id").references(() => issues.id, { onDelete: "set null" }),
    /** Timestamp when onboarding started. */
    startedAt: timestamp("started_at", { withTimezone: true }),
    /** Timestamp when onboarding completed. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("onboarding_flows_company_idx").on(table.companyId),
    agentIdx: index("onboarding_flows_agent_idx").on(table.agentId),
    statusIdx: index("onboarding_flows_status_idx").on(table.status),
  }),
);

/** Schema for onboarding step records stored as JSONB. */
export interface OnboardingStepRecord {
  name: string;
  status: OnboardingStepStatus;
  detail?: string;
  completedAt?: string;
}

// ---------------------------------------------------------------------------
// 8. Feedback Loop
// ---------------------------------------------------------------------------

/**
 * `feedback_entries` — human feedback on agent output.
 *
 * When a human reviews agent work and provides feedback, the system
 * records it here and can suggest updates to soul, capabilities,
 * or workflow prompts.
 */
export const feedbackEntries = pgTable(
  "feedback_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    /** The agent whose output is being evaluated. */
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    /** Related issue, if applicable. */
    issueId: uuid("issue_id").references(() => issues.id, { onDelete: "set null" }),
    /** User who provided the feedback. */
    userId: text("user_id").notNull(),
    /** Feedback category: soul, capabilities, workflow, general. */
    category: text("category").$type<FeedbackCategory>().notNull().default("general"),
    /** The actual feedback text from the human. */
    feedback: text("feedback").notNull(),
    /** System-suggested update based on the feedback (JSON). */
    suggestedUpdate: jsonb("suggested_update").$type<Record<string, unknown>>(),
    /** Feedback status: pending, suggestion_generated, accepted, rejected, applied. */
    status: text("status").$type<FeedbackStatus>().notNull().default("pending"),
    /** Whether the suggested update was applied. */
    applied: boolean("applied").notNull().default(false),
    /** When the update was applied. */
    appliedAt: timestamp("applied_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyIdx: index("feedback_entries_company_idx").on(table.companyId),
    agentIdx: index("feedback_entries_agent_idx").on(table.agentId),
    statusIdx: index("feedback_entries_status_idx").on(table.status),
    categoryIdx: index("feedback_entries_category_idx").on(table.category),
    userIdx: index("feedback_entries_user_idx").on(table.userId),
  }),
);
