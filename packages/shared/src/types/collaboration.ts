import type {
  MessageStatus,
  DailyReportStatus,
  PeerReviewStatus,
  PeerReviewDecision,
  EscalationTriggerType,
  EscalationStatus,
  NotificationType,
  NotificationPriority,
  NotificationChannel,
  FeedbackCategory,
  FeedbackStatus,
  OnboardingStatus,
  OnboardingStepStatus,
} from "../constants.js";

// ---------------------------------------------------------------------------
// 1. Agent-to-Agent Messaging
// ---------------------------------------------------------------------------

export interface TeamMessage {
  id: string;
  companyId: string;
  fromAgentId: string;
  toAgentId: string;
  parentId: string | null;
  issueId: string | null;
  content: string;
  status: MessageStatus;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  readAt: string | null;
  /** Denormalized fields for display */
  fromAgentName?: string;
  toAgentName?: string;
}

export interface SendMessageInput {
  toAgentId: string;
  content: string;
  parentId?: string;
  issueId?: string;
  metadata?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// 2. Daily Reports / Standups
// ---------------------------------------------------------------------------

export interface DailyReport {
  id: string;
  companyId: string;
  agentId: string;
  reportDate: string;
  completedTasks: string[];
  inProgressTasks: string[];
  blockers: string[];
  plannedTasks: string[];
  summary: string | null;
  status: DailyReportStatus;
  totalCostCents: number | null;
  tasksCompletedCount: number;
  createdAt: string;
  updatedAt: string;
  /** Denormalized for display */
  agentName?: string;
}

export interface GenerateDailyReportInput {
  agentId?: string;
  reportDate?: string;
}

// ---------------------------------------------------------------------------
// 3. Peer Review
// ---------------------------------------------------------------------------

export interface PeerReview {
  id: string;
  companyId: string;
  issueId: string;
  authorAgentId: string;
  reviewerAgentId: string;
  status: PeerReviewStatus;
  decision: PeerReviewDecision | null;
  comment: string | null;
  contentSnapshot: string | null;
  revision: number;
  requestedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  /** Denormalized for display */
  authorAgentName?: string;
  reviewerAgentName?: string;
  issueTitle?: string;
}

export interface CreatePeerReviewInput {
  issueId: string;
  authorAgentId: string;
  reviewerAgentId: string;
  contentSnapshot?: string;
}

export interface SubmitPeerReviewInput {
  decision: PeerReviewDecision;
  comment?: string;
}

// ---------------------------------------------------------------------------
// 4. Escalation Protocol
// ---------------------------------------------------------------------------

export interface EscalationRule {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  triggerType: EscalationTriggerType;
  triggerConfig: Record<string, unknown>;
  targetAgentId: string | null;
  escalateToHuman: boolean;
  enabled: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
  /** Denormalized */
  targetAgentName?: string;
}

export interface CreateEscalationRuleInput {
  name: string;
  description?: string;
  triggerType: EscalationTriggerType;
  triggerConfig: Record<string, unknown>;
  targetAgentId?: string;
  escalateToHuman?: boolean;
  priority?: number;
}

export interface UpdateEscalationRuleInput {
  name?: string;
  description?: string;
  triggerType?: EscalationTriggerType;
  triggerConfig?: Record<string, unknown>;
  targetAgentId?: string | null;
  escalateToHuman?: boolean;
  enabled?: boolean;
  priority?: number;
}

export interface EscalationEvent {
  id: string;
  companyId: string;
  ruleId: string | null;
  sourceAgentId: string;
  targetAgentId: string | null;
  issueId: string | null;
  triggerType: EscalationTriggerType;
  status: EscalationStatus;
  reason: string;
  resolution: string | null;
  resolvedByUserId: string | null;
  createdAt: string;
  resolvedAt: string | null;
  /** Denormalized */
  sourceAgentName?: string;
  targetAgentName?: string;
  ruleName?: string;
}

export interface ResolveEscalationInput {
  status: "resolved" | "dismissed";
  resolution: string;
}

// ---------------------------------------------------------------------------
// 5. Notification Center
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  companyId: string;
  userId: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string | null;
  refType: string | null;
  refId: string | null;
  channels: NotificationChannel[];
  read: boolean;
  dismissed: boolean;
  actionUrl: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface CreateNotificationInput {
  userId?: string;
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  body?: string;
  refType?: string;
  refId?: string;
  channels?: NotificationChannel[];
  actionUrl?: string;
}

export interface NotificationCounts {
  total: number;
  unread: number;
  byType: Record<NotificationType, number>;
}

// ---------------------------------------------------------------------------
// 6. Performance Dashboard
// ---------------------------------------------------------------------------

export interface PerformanceSnapshot {
  id: string;
  companyId: string;
  agentId: string | null;
  periodDate: string;
  tasksAssigned: number;
  tasksCompleted: number;
  workflowRuns: number;
  workflowSuccesses: number;
  avgResponseTimeMs: number | null;
  totalCostCents: number;
  peerReviewsSubmitted: number;
  peerReviewsPassed: number;
  humanEdits: number;
  totalOutputs: number;
  createdAt: string;
}

export interface PerformanceSummary {
  /** Overall company metrics for the period. */
  company: PerformanceSnapshot | null;
  /** Per-agent metrics for the period. */
  agents: (PerformanceSnapshot & { agentName?: string })[];
  /** Computed rates */
  taskCompletionRate: number;
  workflowSuccessRate: number;
  peerReviewPassRate: number;
  humanEditRate: number;
  avgCostPerTask: number;
}

// ---------------------------------------------------------------------------
// 7. Onboarding
// ---------------------------------------------------------------------------

export interface OnboardingStepRecord {
  name: string;
  status: OnboardingStepStatus;
  detail?: string;
  completedAt?: string;
}

export interface OnboardingFlow {
  id: string;
  companyId: string;
  agentId: string;
  status: OnboardingStatus;
  steps: OnboardingStepRecord[];
  testTaskIssueId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Denormalized */
  agentName?: string;
}

export interface StartOnboardingInput {
  agentId: string;
}

// ---------------------------------------------------------------------------
// 8. Feedback Loop
// ---------------------------------------------------------------------------

export interface FeedbackEntry {
  id: string;
  companyId: string;
  agentId: string;
  issueId: string | null;
  userId: string;
  category: FeedbackCategory;
  feedback: string;
  suggestedUpdate: Record<string, unknown> | null;
  status: FeedbackStatus;
  applied: boolean;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Denormalized */
  agentName?: string;
}

export interface CreateFeedbackInput {
  agentId: string;
  issueId?: string;
  category?: FeedbackCategory;
  feedback: string;
}

export interface ApplyFeedbackInput {
  accepted: boolean;
}
