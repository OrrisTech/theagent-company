import { describe, it, expect } from "vitest";

/**
 * Unit tests for Phase 6 — Team Collaboration Enhancement.
 *
 * These tests verify the shared constants and type definitions are correct
 * and importable. Integration tests with a real DB would go in a separate file.
 */

describe("Phase 6 — Collaboration constants", () => {
  it("MESSAGE_STATUSES contains all expected statuses", async () => {
    const { MESSAGE_STATUSES } = await import("@theagentcompany/shared");
    expect(MESSAGE_STATUSES).toContain("sent");
    expect(MESSAGE_STATUSES).toContain("delivered");
    expect(MESSAGE_STATUSES).toContain("read");
    expect(MESSAGE_STATUSES.length).toBe(3);
  });

  it("DAILY_REPORT_STATUSES contains all expected statuses", async () => {
    const { DAILY_REPORT_STATUSES } = await import("@theagentcompany/shared");
    expect(DAILY_REPORT_STATUSES).toContain("pending");
    expect(DAILY_REPORT_STATUSES).toContain("generating");
    expect(DAILY_REPORT_STATUSES).toContain("generated");
    expect(DAILY_REPORT_STATUSES).toContain("failed");
    expect(DAILY_REPORT_STATUSES.length).toBe(4);
  });

  it("PEER_REVIEW_STATUSES contains all expected statuses", async () => {
    const { PEER_REVIEW_STATUSES } = await import("@theagentcompany/shared");
    expect(PEER_REVIEW_STATUSES).toContain("pending");
    expect(PEER_REVIEW_STATUSES).toContain("in_review");
    expect(PEER_REVIEW_STATUSES).toContain("approved");
    expect(PEER_REVIEW_STATUSES).toContain("rejected");
    expect(PEER_REVIEW_STATUSES).toContain("revision_requested");
    expect(PEER_REVIEW_STATUSES.length).toBe(5);
  });

  it("PEER_REVIEW_DECISIONS includes all decision types", async () => {
    const { PEER_REVIEW_DECISIONS } = await import("@theagentcompany/shared");
    expect(PEER_REVIEW_DECISIONS).toContain("approved");
    expect(PEER_REVIEW_DECISIONS).toContain("rejected");
    expect(PEER_REVIEW_DECISIONS).toContain("revision_requested");
    expect(PEER_REVIEW_DECISIONS.length).toBe(3);
  });

  it("ESCALATION_TRIGGER_TYPES contains all expected types", async () => {
    const { ESCALATION_TRIGGER_TYPES } = await import("@theagentcompany/shared");
    expect(ESCALATION_TRIGGER_TYPES).toContain("budget_exceeded");
    expect(ESCALATION_TRIGGER_TYPES).toContain("retries_failed");
    expect(ESCALATION_TRIGGER_TYPES).toContain("sensitive_operation");
    expect(ESCALATION_TRIGGER_TYPES).toContain("agent_uncertain");
    expect(ESCALATION_TRIGGER_TYPES).toContain("custom");
    expect(ESCALATION_TRIGGER_TYPES.length).toBe(5);
  });

  it("ESCALATION_STATUSES contains all expected statuses", async () => {
    const { ESCALATION_STATUSES } = await import("@theagentcompany/shared");
    expect(ESCALATION_STATUSES).toContain("open");
    expect(ESCALATION_STATUSES).toContain("acknowledged");
    expect(ESCALATION_STATUSES).toContain("resolved");
    expect(ESCALATION_STATUSES).toContain("dismissed");
    expect(ESCALATION_STATUSES.length).toBe(4);
  });

  it("NOTIFICATION_TYPES contains all expected types", async () => {
    const { NOTIFICATION_TYPES } = await import("@theagentcompany/shared");
    expect(NOTIFICATION_TYPES).toContain("approval_needed");
    expect(NOTIFICATION_TYPES).toContain("workflow_failed");
    expect(NOTIFICATION_TYPES).toContain("budget_warning");
    expect(NOTIFICATION_TYPES).toContain("escalation");
    expect(NOTIFICATION_TYPES).toContain("peer_review");
    expect(NOTIFICATION_TYPES).toContain("onboarding");
    expect(NOTIFICATION_TYPES).toContain("feedback");
    expect(NOTIFICATION_TYPES).toContain("info");
    expect(NOTIFICATION_TYPES.length).toBe(8);
  });

  it("NOTIFICATION_PRIORITIES contains all expected priorities", async () => {
    const { NOTIFICATION_PRIORITIES } = await import("@theagentcompany/shared");
    expect(NOTIFICATION_PRIORITIES).toContain("low");
    expect(NOTIFICATION_PRIORITIES).toContain("medium");
    expect(NOTIFICATION_PRIORITIES).toContain("high");
    expect(NOTIFICATION_PRIORITIES).toContain("urgent");
    expect(NOTIFICATION_PRIORITIES.length).toBe(4);
  });

  it("NOTIFICATION_CHANNELS contains web and other channels", async () => {
    const { NOTIFICATION_CHANNELS } = await import("@theagentcompany/shared");
    expect(NOTIFICATION_CHANNELS).toContain("web");
    expect(NOTIFICATION_CHANNELS).toContain("email");
    expect(NOTIFICATION_CHANNELS).toContain("telegram");
    expect(NOTIFICATION_CHANNELS).toContain("slack");
    expect(NOTIFICATION_CHANNELS.length).toBe(4);
  });

  it("FEEDBACK_CATEGORIES contains all expected categories", async () => {
    const { FEEDBACK_CATEGORIES } = await import("@theagentcompany/shared");
    expect(FEEDBACK_CATEGORIES).toContain("soul");
    expect(FEEDBACK_CATEGORIES).toContain("capabilities");
    expect(FEEDBACK_CATEGORIES).toContain("workflow");
    expect(FEEDBACK_CATEGORIES).toContain("general");
    expect(FEEDBACK_CATEGORIES.length).toBe(4);
  });

  it("FEEDBACK_STATUSES contains all expected statuses", async () => {
    const { FEEDBACK_STATUSES } = await import("@theagentcompany/shared");
    expect(FEEDBACK_STATUSES).toContain("pending");
    expect(FEEDBACK_STATUSES).toContain("suggestion_generated");
    expect(FEEDBACK_STATUSES).toContain("accepted");
    expect(FEEDBACK_STATUSES).toContain("rejected");
    expect(FEEDBACK_STATUSES).toContain("applied");
    expect(FEEDBACK_STATUSES.length).toBe(5);
  });

  it("ONBOARDING_STATUSES contains all expected statuses", async () => {
    const { ONBOARDING_STATUSES } = await import("@theagentcompany/shared");
    expect(ONBOARDING_STATUSES).toContain("pending");
    expect(ONBOARDING_STATUSES).toContain("in_progress");
    expect(ONBOARDING_STATUSES).toContain("completed");
    expect(ONBOARDING_STATUSES).toContain("failed");
    expect(ONBOARDING_STATUSES.length).toBe(4);
  });

  it("ONBOARDING_STEP_STATUSES contains all expected statuses", async () => {
    const { ONBOARDING_STEP_STATUSES } = await import("@theagentcompany/shared");
    expect(ONBOARDING_STEP_STATUSES).toContain("pending");
    expect(ONBOARDING_STEP_STATUSES).toContain("running");
    expect(ONBOARDING_STEP_STATUSES).toContain("completed");
    expect(ONBOARDING_STEP_STATUSES).toContain("skipped");
    expect(ONBOARDING_STEP_STATUSES).toContain("failed");
    expect(ONBOARDING_STEP_STATUSES.length).toBe(5);
  });
});

describe("Phase 6 — Collaboration type definitions", () => {
  it("TeamMessage type has expected shape", async () => {
    const msg: import("@theagentcompany/shared").TeamMessage = {
      id: "uuid-1",
      companyId: "company-1",
      fromAgentId: "agent-1",
      toAgentId: "agent-2",
      parentId: null,
      issueId: null,
      content: "Hello, can you review this?",
      status: "sent",
      metadata: null,
      createdAt: "2026-03-20T00:00:00Z",
      readAt: null,
    };
    expect(msg.content).toBe("Hello, can you review this?");
    expect(msg.status).toBe("sent");
  });

  it("DailyReport type has expected shape", async () => {
    const report: import("@theagentcompany/shared").DailyReport = {
      id: "uuid-1",
      companyId: "company-1",
      agentId: "agent-1",
      reportDate: "2026-03-20",
      completedTasks: ["Task A", "Task B"],
      inProgressTasks: ["Task C"],
      blockers: [],
      plannedTasks: ["Task D"],
      summary: "Good day, completed 2 tasks",
      status: "generated",
      totalCostCents: 150,
      tasksCompletedCount: 2,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-03-20T00:00:00Z",
    };
    expect(report.completedTasks.length).toBe(2);
    expect(report.tasksCompletedCount).toBe(2);
  });

  it("PeerReview type has expected shape", async () => {
    const review: import("@theagentcompany/shared").PeerReview = {
      id: "uuid-1",
      companyId: "company-1",
      issueId: "issue-1",
      authorAgentId: "agent-1",
      reviewerAgentId: "agent-2",
      status: "pending",
      decision: null,
      comment: null,
      contentSnapshot: "Some output to review",
      revision: 1,
      requestedByUserId: null,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-03-20T00:00:00Z",
      completedAt: null,
    };
    expect(review.status).toBe("pending");
    expect(review.revision).toBe(1);
  });

  it("EscalationRule type has expected shape", async () => {
    const rule: import("@theagentcompany/shared").EscalationRule = {
      id: "uuid-1",
      companyId: "company-1",
      name: "Budget exceeded rule",
      description: "Escalate when budget is exceeded by 20%",
      triggerType: "budget_exceeded",
      triggerConfig: { threshold: 0.2 },
      targetAgentId: null,
      escalateToHuman: true,
      enabled: true,
      priority: 0,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-03-20T00:00:00Z",
    };
    expect(rule.triggerType).toBe("budget_exceeded");
    expect(rule.escalateToHuman).toBe(true);
  });

  it("Notification type has expected shape", async () => {
    const notif: import("@theagentcompany/shared").Notification = {
      id: "uuid-1",
      companyId: "company-1",
      userId: "user-1",
      type: "escalation",
      priority: "high",
      title: "Budget exceeded for Agent X",
      body: "Agent X has exceeded their monthly budget by 30%.",
      refType: "escalation",
      refId: "esc-1",
      channels: ["web", "email"],
      read: false,
      dismissed: false,
      actionUrl: "/escalations/esc-1",
      createdAt: "2026-03-20T00:00:00Z",
      readAt: null,
    };
    expect(notif.type).toBe("escalation");
    expect(notif.priority).toBe("high");
    expect(notif.channels).toContain("web");
  });

  it("OnboardingFlow type has expected shape", async () => {
    const flow: import("@theagentcompany/shared").OnboardingFlow = {
      id: "uuid-1",
      companyId: "company-1",
      agentId: "agent-1",
      status: "in_progress",
      steps: [
        { name: "receive_company_context", status: "completed", completedAt: "2026-03-20T00:00:00Z" },
        { name: "read_team_sops", status: "running" },
        { name: "meet_teammates", status: "pending" },
        { name: "run_test_task", status: "pending" },
      ],
      testTaskIssueId: null,
      startedAt: "2026-03-20T00:00:00Z",
      completedAt: null,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-03-20T00:00:00Z",
    };
    expect(flow.steps.length).toBe(4);
    expect(flow.steps[0]!.status).toBe("completed");
    expect(flow.status).toBe("in_progress");
  });

  it("FeedbackEntry type has expected shape", async () => {
    const entry: import("@theagentcompany/shared").FeedbackEntry = {
      id: "uuid-1",
      companyId: "company-1",
      agentId: "agent-1",
      issueId: "issue-1",
      userId: "user-1",
      category: "soul",
      feedback: "The tone is too formal, needs to be more casual.",
      suggestedUpdate: { field: "soul", oldValue: "Formal tone", newValue: "Casual, friendly tone" },
      status: "suggestion_generated",
      applied: false,
      appliedAt: null,
      createdAt: "2026-03-20T00:00:00Z",
      updatedAt: "2026-03-20T00:00:00Z",
    };
    expect(entry.category).toBe("soul");
    expect(entry.suggestedUpdate).toBeTruthy();
  });

  it("PerformanceSummary type has expected computed rates", async () => {
    const summary: import("@theagentcompany/shared").PerformanceSummary = {
      company: null,
      agents: [],
      taskCompletionRate: 0.85,
      workflowSuccessRate: 0.92,
      peerReviewPassRate: 0.78,
      humanEditRate: 0.12,
      avgCostPerTask: 250,
    };
    expect(summary.taskCompletionRate).toBe(0.85);
    expect(summary.humanEditRate).toBe(0.12);
  });
});

describe("Phase 6 — NotificationCounts type", () => {
  it("has expected shape", async () => {
    const counts: import("@theagentcompany/shared").NotificationCounts = {
      total: 42,
      unread: 10,
      byType: {
        approval_needed: 3,
        workflow_failed: 2,
        budget_warning: 1,
        escalation: 2,
        peer_review: 1,
        onboarding: 0,
        feedback: 1,
        info: 0,
      },
    };
    expect(counts.total).toBe(42);
    expect(counts.unread).toBe(10);
    expect(counts.byType.escalation).toBe(2);
  });
});
