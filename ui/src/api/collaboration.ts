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
} from "@theagentcompany/shared";
import { api } from "./client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build query string from params, always including companyId when provided. */
function qs(
  companyId: string | undefined,
  extra?: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  if (companyId) params.set("companyId", companyId);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== "") params.set(k, String(v));
    }
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

// ---------------------------------------------------------------------------
// 1. Messaging
// ---------------------------------------------------------------------------

export const messagingApi = {
  list: (companyId?: string, opts?: { agentId?: string; withAgentId?: string; issueId?: string; limit?: number; offset?: number }) =>
    api.get<TeamMessage[]>(`/collaboration/messages${qs(companyId, opts)}`),
  send: (fromAgentId: string, input: SendMessageInput, companyId?: string) =>
    api.post<TeamMessage>(`/collaboration/messages${qs(companyId)}`, { ...input, fromAgentId }),
  markRead: (id: string) => api.patch<TeamMessage>(`/collaboration/messages/${id}/read`, {}),
};

// ---------------------------------------------------------------------------
// 2. Daily Reports
// ---------------------------------------------------------------------------

export const dailyReportApi = {
  list: (companyId?: string, opts?: { agentId?: string; from?: string; to?: string; limit?: number }) =>
    api.get<DailyReport[]>(`/collaboration/daily-reports${qs(companyId, opts)}`),
  generate: (input?: { agentId?: string; reportDate?: string }, companyId?: string) =>
    api.post<DailyReport | DailyReport[]>(`/collaboration/daily-reports/generate${qs(companyId)}`, input ?? {}),
};

// ---------------------------------------------------------------------------
// 3. Peer Reviews
// ---------------------------------------------------------------------------

export const peerReviewApi = {
  list: (companyId?: string, opts?: { issueId?: string; authorAgentId?: string; reviewerAgentId?: string; status?: string; limit?: number }) =>
    api.get<PeerReview[]>(`/collaboration/peer-reviews${qs(companyId, opts)}`),
  create: (input: CreatePeerReviewInput, companyId?: string) =>
    api.post<PeerReview>(`/collaboration/peer-reviews${qs(companyId)}`, input),
  submit: (id: string, input: SubmitPeerReviewInput) =>
    api.post<PeerReview>(`/collaboration/peer-reviews/${id}/submit`, input),
};

// ---------------------------------------------------------------------------
// 4. Escalation
// ---------------------------------------------------------------------------

export const escalationApi = {
  listRules: (companyId?: string) =>
    api.get<EscalationRule[]>(`/collaboration/escalation-rules${qs(companyId)}`),
  createRule: (input: CreateEscalationRuleInput, companyId?: string) =>
    api.post<EscalationRule>(`/collaboration/escalation-rules${qs(companyId)}`, input),
  updateRule: (id: string, input: UpdateEscalationRuleInput) =>
    api.put<EscalationRule>(`/collaboration/escalation-rules/${id}`, input),
  deleteRule: (id: string) =>
    api.delete<{ ok: boolean }>(`/collaboration/escalation-rules/${id}`),

  listEvents: (companyId?: string, opts?: { status?: string; sourceAgentId?: string; limit?: number }) =>
    api.get<EscalationEvent[]>(`/collaboration/escalations${qs(companyId, opts)}`),
  resolve: (id: string, input: ResolveEscalationInput) =>
    api.post<EscalationEvent>(`/collaboration/escalations/${id}/resolve`, input),
};

// ---------------------------------------------------------------------------
// 5. Notifications
// ---------------------------------------------------------------------------

export const notificationApi = {
  list: (companyId?: string, opts?: { unreadOnly?: boolean; type?: string; limit?: number; offset?: number }) =>
    api.get<Notification[]>(`/collaboration/notifications${qs(companyId, opts)}`),
  counts: (companyId?: string) =>
    api.get<NotificationCounts>(`/collaboration/notifications/counts${qs(companyId)}`),
  create: (input: CreateNotificationInput, companyId?: string) =>
    api.post<Notification>(`/collaboration/notifications${qs(companyId)}`, input),
  markRead: (id: string) => api.patch<Notification>(`/collaboration/notifications/${id}/read`, {}),
  markAllRead: (companyId?: string) =>
    api.post<{ ok: boolean }>(`/collaboration/notifications/read-all${qs(companyId)}`, {}),
  dismiss: (id: string) => api.patch<Notification>(`/collaboration/notifications/${id}/dismiss`, {}),
};

// ---------------------------------------------------------------------------
// 6. Performance
// ---------------------------------------------------------------------------

export const performanceApi = {
  summary: (companyId?: string, opts?: { from?: string; to?: string }) =>
    api.get<PerformanceSummary>(`/collaboration/performance${qs(companyId, opts)}`),
  snapshots: (companyId?: string, opts?: { agentId?: string; from?: string; to?: string; limit?: number }) =>
    api.get<PerformanceSnapshot[]>(`/collaboration/performance/snapshots${qs(companyId, opts)}`),
};

// ---------------------------------------------------------------------------
// 7. Onboarding
// ---------------------------------------------------------------------------

export const onboardingApi = {
  list: (companyId?: string) =>
    api.get<OnboardingFlow[]>(`/collaboration/onboarding${qs(companyId)}`),
  get: (agentId: string, companyId?: string) =>
    api.get<OnboardingFlow | null>(`/collaboration/onboarding/${agentId}${qs(companyId)}`),
  start: (input: StartOnboardingInput, companyId?: string) =>
    api.post<OnboardingFlow>(`/collaboration/onboarding${qs(companyId)}`, input),
  updateStep: (flowId: string, stepName: string, status: string, detail?: string) =>
    api.patch<OnboardingFlow>(`/collaboration/onboarding/${flowId}/steps/${stepName}`, { status, detail }),
};

// ---------------------------------------------------------------------------
// 8. Feedback
// ---------------------------------------------------------------------------

export const feedbackApi = {
  list: (companyId?: string, opts?: { agentId?: string; category?: string; status?: string; limit?: number }) =>
    api.get<FeedbackEntry[]>(`/collaboration/feedback${qs(companyId, opts)}`),
  create: (input: CreateFeedbackInput, companyId?: string) =>
    api.post<FeedbackEntry>(`/collaboration/feedback${qs(companyId)}`, input),
  apply: (id: string, input: ApplyFeedbackInput) =>
    api.post<FeedbackEntry>(`/collaboration/feedback/${id}/apply`, input),
};
