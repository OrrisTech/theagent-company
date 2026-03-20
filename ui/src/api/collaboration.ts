import type {
  TeamMessage,
  SendMessageInput,
  DailyReport,
  PeerReview,
  CreatePeerReviewInput,
  SubmitPeerReviewInput,
  EscalationRule,
  CreateEscalationRuleInput,
  UpdateEscalationRuleInput,
  EscalationEvent,
  ResolveEscalationInput,
  Notification,
  NotificationCounts,
  CreateNotificationInput,
  PerformanceSummary,
  PerformanceSnapshot,
  OnboardingFlow,
  StartOnboardingInput,
  FeedbackEntry,
  CreateFeedbackInput,
  ApplyFeedbackInput,
} from "@paperclipai/shared";
import { api } from "./client";

// ---------------------------------------------------------------------------
// 1. Messaging
// ---------------------------------------------------------------------------

export const messagingApi = {
  list: (opts?: { agentId?: string; withAgentId?: string; issueId?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.withAgentId) params.set("withAgentId", opts.withAgentId);
    if (opts?.issueId) params.set("issueId", opts.issueId);
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return api.get<TeamMessage[]>(`/collaboration/messages${qs ? `?${qs}` : ""}`);
  },
  send: (fromAgentId: string, input: SendMessageInput) =>
    api.post<TeamMessage>("/collaboration/messages", { ...input, fromAgentId }),
  markRead: (id: string) => api.patch<TeamMessage>(`/collaboration/messages/${id}/read`, {}),
};

// ---------------------------------------------------------------------------
// 2. Daily Reports
// ---------------------------------------------------------------------------

export const dailyReportApi = {
  list: (opts?: { agentId?: string; from?: string; to?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<DailyReport[]>(`/collaboration/daily-reports${qs ? `?${qs}` : ""}`);
  },
  generate: (input?: { agentId?: string; reportDate?: string }) =>
    api.post<DailyReport | DailyReport[]>("/collaboration/daily-reports/generate", input ?? {}),
};

// ---------------------------------------------------------------------------
// 3. Peer Reviews
// ---------------------------------------------------------------------------

export const peerReviewApi = {
  list: (opts?: { issueId?: string; authorAgentId?: string; reviewerAgentId?: string; status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.issueId) params.set("issueId", opts.issueId);
    if (opts?.authorAgentId) params.set("authorAgentId", opts.authorAgentId);
    if (opts?.reviewerAgentId) params.set("reviewerAgentId", opts.reviewerAgentId);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<PeerReview[]>(`/collaboration/peer-reviews${qs ? `?${qs}` : ""}`);
  },
  create: (input: CreatePeerReviewInput) =>
    api.post<PeerReview>("/collaboration/peer-reviews", input),
  submit: (id: string, input: SubmitPeerReviewInput) =>
    api.post<PeerReview>(`/collaboration/peer-reviews/${id}/submit`, input),
};

// ---------------------------------------------------------------------------
// 4. Escalation
// ---------------------------------------------------------------------------

export const escalationApi = {
  listRules: () => api.get<EscalationRule[]>("/collaboration/escalation-rules"),
  createRule: (input: CreateEscalationRuleInput) =>
    api.post<EscalationRule>("/collaboration/escalation-rules", input),
  updateRule: (id: string, input: UpdateEscalationRuleInput) =>
    api.put<EscalationRule>(`/collaboration/escalation-rules/${id}`, input),
  deleteRule: (id: string) =>
    api.delete<{ ok: boolean }>(`/collaboration/escalation-rules/${id}`),

  listEvents: (opts?: { status?: string; sourceAgentId?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.status) params.set("status", opts.status);
    if (opts?.sourceAgentId) params.set("sourceAgentId", opts.sourceAgentId);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<EscalationEvent[]>(`/collaboration/escalations${qs ? `?${qs}` : ""}`);
  },
  resolve: (id: string, input: ResolveEscalationInput) =>
    api.post<EscalationEvent>(`/collaboration/escalations/${id}/resolve`, input),
};

// ---------------------------------------------------------------------------
// 5. Notifications
// ---------------------------------------------------------------------------

export const notificationApi = {
  list: (opts?: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number }) => {
    const params = new URLSearchParams();
    if (opts?.unreadOnly) params.set("unreadOnly", "true");
    if (opts?.type) params.set("type", opts.type);
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.offset) params.set("offset", String(opts.offset));
    const qs = params.toString();
    return api.get<Notification[]>(`/collaboration/notifications${qs ? `?${qs}` : ""}`);
  },
  counts: () => api.get<NotificationCounts>("/collaboration/notifications/counts"),
  create: (input: CreateNotificationInput) =>
    api.post<Notification>("/collaboration/notifications", input),
  markRead: (id: string) => api.patch<Notification>(`/collaboration/notifications/${id}/read`, {}),
  markAllRead: () => api.post<{ ok: boolean }>("/collaboration/notifications/read-all", {}),
  dismiss: (id: string) => api.patch<Notification>(`/collaboration/notifications/${id}/dismiss`, {}),
};

// ---------------------------------------------------------------------------
// 6. Performance
// ---------------------------------------------------------------------------

export const performanceApi = {
  summary: (opts?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    const qs = params.toString();
    return api.get<PerformanceSummary>(`/collaboration/performance${qs ? `?${qs}` : ""}`);
  },
  snapshots: (opts?: { agentId?: string; from?: string; to?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.from) params.set("from", opts.from);
    if (opts?.to) params.set("to", opts.to);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<PerformanceSnapshot[]>(`/collaboration/performance/snapshots${qs ? `?${qs}` : ""}`);
  },
};

// ---------------------------------------------------------------------------
// 7. Onboarding
// ---------------------------------------------------------------------------

export const onboardingApi = {
  list: () => api.get<OnboardingFlow[]>("/collaboration/onboarding"),
  get: (agentId: string) => api.get<OnboardingFlow | null>(`/collaboration/onboarding/${agentId}`),
  start: (input: StartOnboardingInput) =>
    api.post<OnboardingFlow>("/collaboration/onboarding", input),
  updateStep: (flowId: string, stepName: string, status: string, detail?: string) =>
    api.patch<OnboardingFlow>(`/collaboration/onboarding/${flowId}/steps/${stepName}`, { status, detail }),
};

// ---------------------------------------------------------------------------
// 8. Feedback
// ---------------------------------------------------------------------------

export const feedbackApi = {
  list: (opts?: { agentId?: string; category?: string; status?: string; limit?: number }) => {
    const params = new URLSearchParams();
    if (opts?.agentId) params.set("agentId", opts.agentId);
    if (opts?.category) params.set("category", opts.category);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.limit) params.set("limit", String(opts.limit));
    const qs = params.toString();
    return api.get<FeedbackEntry[]>(`/collaboration/feedback${qs ? `?${qs}` : ""}`);
  },
  create: (input: CreateFeedbackInput) =>
    api.post<FeedbackEntry>("/collaboration/feedback", input),
  apply: (id: string, input: ApplyFeedbackInput) =>
    api.post<FeedbackEntry>(`/collaboration/feedback/${id}/apply`, input),
};
