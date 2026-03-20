import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Link2,
  MessageSquare,
  GitBranch,
  ShieldCheck,
  ArrowUpRight,
  Users,
  Filter,
} from "lucide-react";
import type { Agent, OpenClawCollaborationEvent } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "../context/CompanyContext";
import { openclawApi } from "../api/openclaw";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { api } from "../api/client";

/** Icon for event type */
function EventIcon({ type }: { type: OpenClawCollaborationEvent["eventType"] }) {
  switch (type) {
    case "message":
      return <MessageSquare className="h-4 w-4 text-blue-500" />;
    case "delegation":
      return <GitBranch className="h-4 w-4 text-green-500" />;
    case "review":
      return <ShieldCheck className="h-4 w-4 text-violet-500" />;
    case "escalation":
      return <ArrowUpRight className="h-4 w-4 text-orange-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-muted-foreground" />;
  }
}

/** Color for event type badge */
function eventTypeColor(type: OpenClawCollaborationEvent["eventType"]): string {
  switch (type) {
    case "message":
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
    case "delegation":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    case "review":
      return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400";
    case "escalation":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function Collaboration() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [agentFilter, setAgentFilter] = useState<string | undefined>(undefined);

  // Fetch agents list for filter dropdown
  const { data: agentList } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => api.get<Agent[]>(`/companies/${selectedCompanyId}/agents`),
    enabled: !!selectedCompanyId,
  });

  // Fetch collaboration events
  const { data: events, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.openclaw.collaboration(selectedCompanyId ?? "", agentFilter),
    queryFn: () => openclawApi.collaboration(selectedCompanyId!, agentFilter, 100),
    enabled: !!selectedCompanyId,
    refetchInterval: 15_000,
  });

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        {t("common.selectCompany")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link2 className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("collaboration.title")}</h1>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t("collaboration.filterByAgent")}:</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setAgentFilter(undefined)}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
              !agentFilter
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            <Users className="h-3 w-3" />
            {t("collaboration.allAgents")}
          </button>
          {agentList?.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setAgentFilter(agent.id)}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                agentFilter === agent.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {agent.name}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            {t("collaboration.timeline")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p className="text-sm text-destructive">{t("common.errorLoadingData")}</p>
              <button onClick={() => refetch()} className="text-sm text-primary underline">{t("common.retry")}</button>
            </div>
          ) : !events?.length ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <Link2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  {t("collaboration.noEvents")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("collaboration.noEventsHint")}
                </p>
              </div>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

              <div className="space-y-4">
                {events.map((event, index) => (
                  <CollaborationEventRow key={event.id} event={event} isFirst={index === 0} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CollaborationEventRow({
  event,
  isFirst,
}: {
  event: OpenClawCollaborationEvent;
  isFirst: boolean;
}) {
  const { t } = useTranslation();
  const time = new Date(event.timestamp);

  return (
    <div className="relative flex gap-4 pl-10">
      {/* Timeline dot */}
      <div className="absolute left-3 top-2 flex h-4 w-4 items-center justify-center rounded-full border-2 border-background bg-card">
        <EventIcon type={event.eventType} />
      </div>

      <div className="flex-1 rounded-lg border bg-card p-3 space-y-2">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            eventTypeColor(event.eventType),
          )}>
            {t(`collaboration.eventTypes.${event.eventType}`)}
          </span>

          <span className="text-xs text-muted-foreground">
            {time.toLocaleString()}
          </span>
        </div>

        {/* From -> To */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium">{event.fromAgentName}</span>
          <span className="text-muted-foreground">&rarr;</span>
          <span className="font-medium">{event.toAgentName}</span>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground">{event.summary}</p>

        {/* Session info */}
        {(event.sessionId || event.parentSessionId) && (
          <div className="flex gap-3 text-xs text-muted-foreground">
            {event.sessionId && (
              <span>
                {t("collaboration.session")}: {event.sessionId.substring(0, 8)}...
              </span>
            )}
            {event.parentSessionId && (
              <span>
                {t("collaboration.parentSession")}: {event.parentSessionId.substring(0, 8)}...
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
