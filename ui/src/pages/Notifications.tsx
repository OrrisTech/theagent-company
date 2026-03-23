import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  XCircle,
  Info,
  ShieldAlert,
  GitPullRequest,
  Workflow,
  DollarSign,
  UserPlus,
  MessageSquare,
  X,
} from "lucide-react";
import { notificationApi } from "@/api/collaboration";
import { useCompany } from "@/context/CompanyContext";
import { useToast } from "@/context/ToastContext";
import { queryKeys } from "@/lib/queryKeys";
import { Button } from "@/components/ui/button";
import type { Notification, NotificationType, NotificationPriority } from "@theagentcompany/shared";

/** Map notification type to an icon component. */
function notificationIcon(type: NotificationType) {
  switch (type) {
    case "approval_needed": return <CheckCheck className="h-4 w-4 text-blue-500" />;
    case "workflow_failed": return <XCircle className="h-4 w-4 text-red-500" />;
    case "budget_warning": return <DollarSign className="h-4 w-4 text-amber-500" />;
    case "escalation": return <ShieldAlert className="h-4 w-4 text-orange-500" />;
    case "peer_review": return <GitPullRequest className="h-4 w-4 text-purple-500" />;
    case "onboarding": return <UserPlus className="h-4 w-4 text-green-500" />;
    case "feedback": return <MessageSquare className="h-4 w-4 text-cyan-500" />;
    case "info": return <Info className="h-4 w-4 text-muted-foreground" />;
    default: return <Bell className="h-4 w-4 text-muted-foreground" />;
  }
}

/** Map priority to a color class. */
function priorityBadge(priority: NotificationPriority) {
  const colors: Record<NotificationPriority, string> = {
    urgent: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
    medium: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    low: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  };
  return colors[priority] ?? colors.medium;
}

const FILTER_TABS: { key: string; labelKey: string }[] = [
  { key: "all", labelKey: "pages.notifications.all" },
  { key: "unread", labelKey: "pages.notifications.unread" },
  { key: "approval_needed", labelKey: "pages.notifications.approvals" },
  { key: "escalation", labelKey: "pages.notifications.escalations" },
  { key: "workflow_failed", labelKey: "pages.notifications.workflowFailures" },
  { key: "budget_warning", labelKey: "pages.notifications.budgetWarnings" },
];

export function Notifications() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("all");

  const isTypeFilter = !["all", "unread"].includes(activeFilter);
  const unreadOnly = activeFilter === "unread";

  const { data: items = [], isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.collaboration.notifications(selectedCompanyId ?? "", unreadOnly),
    queryFn: () =>
      notificationApi.list(selectedCompanyId ?? undefined, {
        unreadOnly: unreadOnly || undefined,
        type: isTypeFilter ? activeFilter : undefined,
        limit: 100,
      }),
    enabled: !!selectedCompanyId,
    retry: 1,
  });

  const { data: counts } = useQuery({
    queryKey: queryKeys.collaboration.notificationCounts(selectedCompanyId ?? ""),
    queryFn: () => notificationApi.counts(selectedCompanyId ?? undefined),
    retry: 1,
    enabled: !!selectedCompanyId,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notification-counts"] });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllRead(selectedCompanyId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notification-counts"] });
      pushToast({ title: t("pages.notifications.allMarkedRead") });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: (id: string) => notificationApi.dismiss(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notifications"] });
      queryClient.invalidateQueries({ queryKey: ["collaboration", "notification-counts"] });
    },
    onError: () => {
      pushToast({ title: t("common.unexpectedError"), tone: "error" });
    },
  });

  // Filter notifications based on active tab
  const filteredItems = isTypeFilter
    ? items.filter((n: Notification) => n.type === activeFilter)
    : items;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-xl font-semibold">{t("pages.notifications.title")}</h1>
          {(counts?.unread ?? 0) > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {counts!.unread}
            </span>
          )}
        </div>
        {(counts?.unread ?? 0) > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <CheckCheck className="mr-1.5 h-4 w-4" />
            {t("pages.notifications.markAllRead")}
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1 overflow-x-auto border-b border-border pb-1">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.key}
            className={`whitespace-nowrap rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeFilter === tab.key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveFilter(tab.key)}
          >
            {t(tab.labelKey)}
          </button>
        ))}
      </div>

      {/* Notification list */}
      {isLoading ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : error ? (
        <div className="py-10 text-center">
          <AlertTriangle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">{t("common.errorLoadingData")}</p>
          <button onClick={() => refetch()} className="mt-2 text-sm text-primary underline">{t("common.retry")}</button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="py-10 text-center">
          <Bell className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{t("pages.notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {filteredItems.map((notif: Notification) => (
            <div
              key={notif.id}
              className={`group flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors ${
                notif.read
                  ? "border-transparent bg-transparent"
                  : "border-primary/10 bg-primary/5"
              } hover:bg-muted/50`}
            >
              <div className="mt-0.5 flex-shrink-0">{notificationIcon(notif.type)}</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{notif.title}</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${priorityBadge(notif.priority)}`}>
                    {t(`pages.notifications.priority.${notif.priority}`)}
                  </span>
                </div>
                {notif.body && (
                  <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{notif.body}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {new Date(notif.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                {!notif.read && (
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title={t("pages.notifications.markRead")}
                    onClick={() => markReadMutation.mutate(notif.id)}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  title={t("pages.notifications.dismiss")}
                  onClick={() => dismissMutation.mutate(notif.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
