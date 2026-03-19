import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Puzzle, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { openclawApi } from "../../api/openclaw";
import { useToast } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import type { OpenClawSkillEntry } from "@paperclipai/shared";

export function SkillsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  const { data: skills, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.skills,
    queryFn: () => openclawApi.skills(),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      openclawApi.updateSkillEnabled(id, enabled),
    onSuccess: (_data, { id, enabled }) => {
      // Optimistic update
      queryClient.setQueryData<OpenClawSkillEntry[]>(
        queryKeys.openclaw.skills,
        (old) => old?.map((s) => (s.id === id ? { ...s, enabled } : s)) ?? [],
      );
    },
    onError: () => {
      pushToast({ title: t("skills.toggleFailed"), tone: "error" });
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.skills });
    },
  });

  function toggleSkill(skill: OpenClawSkillEntry) {
    toggleMutation.mutate({ id: skill.id, enabled: !skill.enabled });
  }

  function toggleExpand(id: string) {
    setExpandedSkill((prev) => (prev === id ? null : id));
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const skillList = skills ?? [];

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold">{t("skills.title")}</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{t("skills.description")}</p>
        </div>

        {/* Skills list */}
        {skillList.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Puzzle className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t("skills.noSkills")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("skills.noSkillsHint")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {skillList.map((skill) => {
              const isExpanded = expandedSkill === skill.id;
              return (
                <div
                  key={skill.id}
                  className="rounded-lg border border-border bg-card overflow-hidden"
                >
                  {/* Skill row */}
                  <div className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <button
                        onClick={() => toggleExpand(skill.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                        aria-label={t("skills.viewSkillMd")}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{skill.name}</span>
                          <Badge variant={skill.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                            {skill.enabled ? t("skills.enabled") : t("skills.disabled")}
                          </Badge>
                        </div>
                        {skill.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button
                      variant={skill.enabled ? "outline" : "default"}
                      size="sm"
                      onClick={() => toggleSkill(skill)}
                      disabled={toggleMutation.isPending}
                    >
                      {skill.enabled ? t("skills.disableSkill") : t("skills.enableSkill")}
                    </Button>
                  </div>

                  {/* Expanded content — SKILL.md */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/30 p-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                        <FolderOpen className="h-3 w-3" />
                        <span className="font-mono">{skill.path}</span>
                      </div>
                      {skill.skillMdContent ? (
                        <pre className="whitespace-pre-wrap text-xs font-mono bg-background rounded-md border border-border p-3 max-h-96 overflow-auto">
                          {skill.skillMdContent}
                        </pre>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">
                          {t("skills.noSkillMd")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
