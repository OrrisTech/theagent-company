import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Brain,
  CheckCircle2,
  AlertCircle,
  XCircle,
  FileText,
  Calendar,
  HardDrive,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import type { Agent, OpenClawAgentMemory, OpenClawMemoryFile } from "@paperclipai/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCompany } from "../context/CompanyContext";
import { openclawApi } from "../api/openclaw";
import { queryKeys } from "../lib/queryKeys";
import { cn } from "../lib/utils";
import { api } from "../api/client";

/** Format bytes to human-readable size */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function HealthBadge({ health }: { health: OpenClawAgentMemory["health"] }) {
  const { t } = useTranslation();
  const config: Record<string, { icon: typeof CheckCircle2; color: string }> = {
    healthy: { icon: CheckCircle2, color: "text-green-500" },
    degraded: { icon: AlertCircle, color: "text-yellow-500" },
    missing: { icon: XCircle, color: "text-red-500" },
  };
  const { icon: Icon, color } = config[health] ?? config.missing;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", color)}>
      <Icon className="h-3.5 w-3.5" />
      {t(`memory.${health}`)}
    </span>
  );
}

export function Memory() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Fetch agents list
  const { data: agentList } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId ?? ""),
    queryFn: () => api.get<Agent[]>(`/companies/${selectedCompanyId}/agents`),
    enabled: !!selectedCompanyId,
  });

  // Fetch memory for selected agent
  const { data: memory, isLoading: memoryLoading } = useQuery({
    queryKey: queryKeys.openclaw.memory(selectedCompanyId ?? "", selectedAgentId ?? ""),
    queryFn: () => openclawApi.memory(selectedCompanyId!, selectedAgentId!),
    enabled: !!selectedCompanyId && !!selectedAgentId,
  });

  if (!selectedCompanyId) {
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        {t("common.selectCompany")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Brain className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold">{t("memory.title")}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* Agent list sidebar */}
        <div className="space-y-2">
          {agentList?.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                selectedAgentId === agent.id
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted",
              )}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                {agent.icon ?? agent.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate text-sm font-medium">{agent.name}</div>
                <div className="truncate text-xs text-muted-foreground">{agent.title ?? agent.role}</div>
              </div>
            </button>
          ))}

          {(!agentList || agentList.length === 0) && (
            <p className="p-3 text-sm text-muted-foreground">{t("overview.noTeamMembers")}</p>
          )}
        </div>

        {/* Memory content */}
        <div>
          {!selectedAgentId && (
            <Card className="rounded-lg">
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center">
                  <Brain className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">{t("memory.selectMember")}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {selectedAgentId && memoryLoading && (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg border bg-muted" />
              ))}
            </div>
          )}

          {selectedAgentId && memory && (
            <MemoryDetail memory={memory} />
          )}
        </div>
      </div>
    </div>
  );
}

function MemoryDetail({ memory }: { memory: OpenClawAgentMemory }) {
  const { t } = useTranslation();
  const [showIndex, setShowIndex] = useState(true);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {/* Health + summary bar */}
      <Card className="rounded-lg">
        <CardContent className="pt-0">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t("memory.health")}:</span>
              <HealthBadge health={memory.health} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <HardDrive className="h-3.5 w-3.5" />
              {t("memory.totalSize")}: {formatBytes(memory.totalSizeBytes)}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              {memory.dailyNotes.length} {t("memory.dailyNotes").toLowerCase()}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              {memory.memoryEntries.length} {t("memory.memoryEntries").toLowerCase()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* MEMORY.md content */}
      <Card className="rounded-lg">
        <CardHeader>
          <button
            onClick={() => setShowIndex(!showIndex)}
            className="flex items-center gap-2 text-base font-semibold"
          >
            {showIndex ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            {t("memory.memoryIndex")}
          </button>
        </CardHeader>
        {showIndex && (
          <CardContent>
            {memory.memoryIndexContent ? (
              <pre className="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs font-mono whitespace-pre-wrap">
                {memory.memoryIndexContent}
              </pre>
            ) : (
              <p className="text-sm text-muted-foreground">{t("memory.noMemoryIndex")}</p>
            )}
          </CardContent>
        )}
      </Card>

      {/* Daily notes */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-4 w-4" />
            {t("memory.dailyNotes")} ({memory.dailyNotes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memory.dailyNotes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("memory.noDailyNotes")}</p>
          ) : (
            <FileList
              files={memory.dailyNotes}
              expandedFile={expandedFile}
              onToggle={setExpandedFile}
            />
          )}
        </CardContent>
      </Card>

      {/* Memory entries */}
      <Card className="rounded-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {t("memory.memoryEntries")} ({memory.memoryEntries.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {memory.memoryEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("memory.noMemoryEntries")}</p>
          ) : (
            <FileList
              files={memory.memoryEntries}
              expandedFile={expandedFile}
              onToggle={setExpandedFile}
            />
          )}
        </CardContent>
      </Card>

      {/* Missing workspace notice */}
      {memory.health === "missing" && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/50 p-4 text-center">
          <p className="text-sm font-medium text-muted-foreground">{t("memory.noWorkspace")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("memory.noWorkspaceHint")}</p>
        </div>
      )}
    </div>
  );
}

function FileList({
  files,
  expandedFile,
  onToggle,
}: {
  files: OpenClawMemoryFile[];
  expandedFile: string | null;
  onToggle: (path: string | null) => void;
}) {
  const { t } = useTranslation();

  // Fetch file content when expanded
  const { data: fileContent } = useQuery({
    queryKey: queryKeys.openclaw.documentContent(expandedFile ?? ""),
    queryFn: () => openclawApi.documentContent(expandedFile!),
    enabled: !!expandedFile,
  });

  return (
    <div className="space-y-1">
      {files.map((file) => (
        <div key={file.relativePath}>
          <button
            onClick={() => onToggle(expandedFile === file.relativePath ? null : file.relativePath)}
            className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted transition-colors"
          >
            {expandedFile === file.relativePath ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-sm">{file.filename}</span>
            <span className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(file.modifiedAt).toLocaleDateString()}
            </span>
          </button>
          {expandedFile === file.relativePath && (
            <div className="ml-9 mt-1 mb-2">
              {fileContent ? (
                <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs font-mono whitespace-pre-wrap">
                  {fileContent.content}
                </pre>
              ) : (
                <div className="h-16 animate-pulse rounded-md bg-muted" />
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
