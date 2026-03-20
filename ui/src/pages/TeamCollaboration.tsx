import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  MessagesSquare,
  FileBarChart,
  GitPullRequest,
  ShieldAlert,
  UserPlus,
  MessageCircle,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Send,
} from "lucide-react";
import {
  messagingApi,
  dailyReportApi,
  peerReviewApi,
  escalationApi,
  onboardingApi,
  feedbackApi,
} from "@/api/collaboration";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import type {
  TeamMessage,
  DailyReport,
  PeerReview,
  EscalationEvent,
  OnboardingFlow,
  FeedbackEntry,
  PeerReviewStatus,
  EscalationStatus,
  OnboardingStatus,
  FeedbackStatus,
} from "@paperclipai/shared";

// Tab type definition
type TabKey = "messages" | "daily-reports" | "peer-reviews" | "escalations" | "onboarding" | "feedback";

const TABS: { key: TabKey; icon: React.ReactNode; labelKey: string }[] = [
  { key: "messages", icon: <MessagesSquare className="h-4 w-4" />, labelKey: "pages.teamCollab.messages" },
  { key: "daily-reports", icon: <FileBarChart className="h-4 w-4" />, labelKey: "pages.teamCollab.dailyReports" },
  { key: "peer-reviews", icon: <GitPullRequest className="h-4 w-4" />, labelKey: "pages.teamCollab.peerReviews" },
  { key: "escalations", icon: <ShieldAlert className="h-4 w-4" />, labelKey: "pages.teamCollab.escalations" },
  { key: "onboarding", icon: <UserPlus className="h-4 w-4" />, labelKey: "pages.teamCollab.onboarding" },
  { key: "feedback", icon: <MessageCircle className="h-4 w-4" />, labelKey: "pages.teamCollab.feedback" },
];

/** Status badge component. */
function StatusBadge({ status, type }: { status: string; type: "review" | "escalation" | "onboarding" | "feedback" }) {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    in_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    revision_requested: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    open: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    acknowledged: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    resolved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    dismissed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
    in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    applied: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    suggestion_generated: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  };
  const color = colorMap[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ========================= Messages Tab =========================

function MessagesPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { data: messages = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.messages(companyId),
    queryFn: () => messagingApi.list({ limit: 50 }),
    enabled: !!companyId,
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (messages.length === 0) {
    return (
      <div className="py-10 text-center">
        <MessagesSquare className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noMessages")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {messages.map((msg: TeamMessage) => (
        <div key={msg.id} className="flex gap-3 rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/30">
          <Send className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium">{msg.fromAgentName ?? "Agent"}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{msg.toAgentName ?? "Agent"}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {new Date(msg.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{msg.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================= Daily Reports Tab =========================

function DailyReportsPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.dailyReports(companyId),
    queryFn: () => dailyReportApi.list({ limit: 30 }),
    enabled: !!companyId,
  });

  const generateMutation = useMutation({
    mutationFn: () => dailyReportApi.generate(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "daily-reports"] });
      pushToast({ title: t("pages.teamCollab.reportsGenerated") });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
          <FileBarChart className="mr-1.5 h-4 w-4" />
          {t("pages.teamCollab.generateReports")}
        </Button>
      </div>

      {isLoading ? (
        <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>
      ) : reports.length === 0 ? (
        <div className="py-10 text-center">
          <FileBarChart className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noReports")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report: DailyReport) => (
            <div key={report.id} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{report.agentName ?? "Agent"}</span>
                  <span className="text-xs text-muted-foreground">{report.reportDate}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {report.tasksCompletedCount} {t("pages.teamCollab.tasksCompleted")}
                </span>
              </div>
              {report.summary && (
                <p className="mt-2 text-sm text-muted-foreground">{report.summary}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {report.completedTasks.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-green-600 dark:text-green-400">
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                      {t("pages.teamCollab.completed")}
                    </p>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {report.completedTasks.slice(0, 5).map((task, i) => (
                        <li key={i} className="truncate">• {task}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.inProgressTasks.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {t("pages.teamCollab.inProgress")}
                    </p>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {report.inProgressTasks.slice(0, 5).map((task, i) => (
                        <li key={i} className="truncate">• {task}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {report.blockers.length > 0 && (
                  <div>
                    <p className="mb-1 text-xs font-medium text-red-600 dark:text-red-400">
                      <AlertTriangle className="mr-1 inline h-3 w-3" />
                      {t("pages.teamCollab.blockers")}
                    </p>
                    <ul className="space-y-0.5 text-xs text-muted-foreground">
                      {report.blockers.slice(0, 5).map((b, i) => (
                        <li key={i} className="truncate">• {b}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ========================= Peer Reviews Tab =========================

function PeerReviewsPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.peerReviews(companyId),
    queryFn: () => peerReviewApi.list({ limit: 50 }),
    enabled: !!companyId,
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (reviews.length === 0) {
    return (
      <div className="py-10 text-center">
        <GitPullRequest className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noReviews")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {reviews.map((review: PeerReview) => (
        <div key={review.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/30">
          <GitPullRequest className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">{review.issueTitle ?? "Task"}</span>
              <StatusBadge status={review.status} type="review" />
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {t("pages.teamCollab.author")}: {review.authorAgentName ?? "—"} →{" "}
              {t("pages.teamCollab.reviewer")}: {review.reviewerAgentName ?? "—"}
              {review.comment && <span className="ml-2 italic">"{review.comment}"</span>}
            </div>
          </div>
          <span className="text-xs text-muted-foreground">{new Date(review.createdAt).toLocaleDateString()}</span>
        </div>
      ))}
    </div>
  );
}

// ========================= Escalations Tab =========================

function EscalationsPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: events = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.escalationEvents(companyId),
    queryFn: () => escalationApi.listEvents({ limit: 50 }),
    enabled: !!companyId,
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, resolution }: { id: string; resolution: string }) =>
      escalationApi.resolve(id, { status: "resolved", resolution }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "escalations"] });
      pushToast({ title: t("pages.teamCollab.escalationResolved") });
    },
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (events.length === 0) {
    return (
      <div className="py-10 text-center">
        <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noEscalations")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {events.map((event: EscalationEvent) => (
        <div key={event.id} className="rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/30">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium">{event.reason}</span>
            <StatusBadge status={event.status} type="escalation" />
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(event.createdAt).toLocaleString()}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {t("pages.teamCollab.from")}: {event.sourceAgentName ?? "—"}
            {event.targetAgentName && ` → ${event.targetAgentName}`}
            {" · "}
            {t("pages.teamCollab.trigger")}: {event.triggerType.replace(/_/g, " ")}
          </div>
          {event.status === "open" && (
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveMutation.mutate({ id: event.id, resolution: "Resolved via dashboard" })}
                disabled={resolveMutation.isPending}
              >
                {t("pages.teamCollab.resolve")}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ========================= Onboarding Tab =========================

function OnboardingPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const { data: flows = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.onboarding(companyId),
    queryFn: () => onboardingApi.list(),
    enabled: !!companyId,
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (flows.length === 0) {
    return (
      <div className="py-10 text-center">
        <UserPlus className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noOnboarding")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {flows.map((flow: OnboardingFlow) => (
        <div key={flow.id} className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-medium">{flow.agentName ?? "Agent"}</span>
              <StatusBadge status={flow.status} type="onboarding" />
            </div>
            <span className="text-xs text-muted-foreground">
              {flow.startedAt ? new Date(flow.startedAt).toLocaleDateString() : "—"}
            </span>
          </div>
          <div className="mt-3 flex gap-2">
            {flow.steps.map((step, i) => {
              const stepColor = step.status === "completed" ? "bg-green-500"
                : step.status === "running" ? "bg-blue-500"
                : step.status === "failed" ? "bg-red-500"
                : "bg-gray-300 dark:bg-gray-600";
              return (
                <div key={i} className="flex-1">
                  <div className={`h-1.5 rounded-full ${stepColor}`} />
                  <p className="mt-1 text-[10px] text-muted-foreground truncate">
                    {step.name.replace(/_/g, " ")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ========================= Feedback Tab =========================

function FeedbackPanel({ companyId }: { companyId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.collaboration.feedback(companyId),
    queryFn: () => feedbackApi.list({ limit: 50 }),
    enabled: !!companyId,
  });

  const applyMutation = useMutation({
    mutationFn: ({ id, accepted }: { id: string; accepted: boolean }) =>
      feedbackApi.apply(id, { accepted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "feedback"] });
      pushToast({ title: t("pages.teamCollab.feedbackApplied") });
    },
  });

  if (isLoading) return <div className="py-6 text-center text-sm text-muted-foreground">{t("common.loading")}</div>;
  if (entries.length === 0) {
    return (
      <div className="py-10 text-center">
        <MessageCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t("pages.teamCollab.noFeedback")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry: FeedbackEntry) => (
        <div key={entry.id} className="rounded-lg border border-border/50 px-4 py-3 hover:bg-muted/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{entry.agentName ?? "Agent"}</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {entry.category}
            </span>
            <StatusBadge status={entry.status} type="feedback" />
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{entry.feedback}</p>
          {entry.status === "pending" || entry.status === "suggestion_generated" ? (
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => applyMutation.mutate({ id: entry.id, accepted: true })}
                disabled={applyMutation.isPending}
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t("pages.teamCollab.accept")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => applyMutation.mutate({ id: entry.id, accepted: false })}
                disabled={applyMutation.isPending}
              >
                <XCircle className="mr-1 h-3 w-3" />
                {t("pages.teamCollab.reject")}
              </Button>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ========================= Main Component =========================

export function TeamCollaboration() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [activeTab, setActiveTab] = useState<TabKey>("messages");

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <MessagesSquare className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-xl font-semibold">{t("pages.teamCollab.title")}</h1>
      </div>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.icon}
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {selectedCompanyId && (
        <>
          {activeTab === "messages" && <MessagesPanel companyId={selectedCompanyId} />}
          {activeTab === "daily-reports" && <DailyReportsPanel companyId={selectedCompanyId} />}
          {activeTab === "peer-reviews" && <PeerReviewsPanel companyId={selectedCompanyId} />}
          {activeTab === "escalations" && <EscalationsPanel companyId={selectedCompanyId} />}
          {activeTab === "onboarding" && <OnboardingPanel companyId={selectedCompanyId} />}
          {activeTab === "feedback" && <FeedbackPanel companyId={selectedCompanyId} />}
        </>
      )}
    </div>
  );
}
