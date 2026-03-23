import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Puzzle,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Upload,
  Terminal,
  Search,
  Trash2,
  Download,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { openclawApi } from "../../api/openclaw";
import { useToast } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import type { OpenClawSkillEntry } from "@theagentcompany/shared";

export function SkillsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const [expandedSkill, setExpandedSkill] = useState<string | null>(null);

  // Dialog states
  const [uploadOpen, setUploadOpen] = useState(false);
  const [cliOpen, setCliOpen] = useState(false);
  const [browseOpen, setBrowseOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OpenClawSkillEntry | null>(null);
  const [cliOutput, setCliOutput] = useState<string | null>(null);

  // CLI input
  const [cliCommand, setCliCommand] = useState("");

  // Browse/search
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { id: string; name: string; description: string; installCommand?: string }[]
  >([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: skills, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.skills,
    queryFn: () => openclawApi.skills(),
    retry: 1,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      openclawApi.updateSkillEnabled(id, enabled),
    onSuccess: (_data, { id, enabled }) => {
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

  const uploadMutation = useMutation({
    mutationFn: (file: File) => openclawApi.uploadSkill(file),
    onSuccess: () => {
      pushToast({ title: t("skills.uploadSuccess"), tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.skills });
      setUploadOpen(false);
    },
    onError: () => {
      pushToast({ title: t("skills.uploadFailed"), tone: "error" });
    },
  });

  const cliMutation = useMutation({
    mutationFn: (command: string) => openclawApi.installSkillCli(command),
    onSuccess: (data) => {
      const output = [data.stdout, data.stderr].filter(Boolean).join("\n") || "(no output)";
      setCliOutput(output);
      if (data.exitCode === 0) {
        pushToast({ title: t("skills.installSuccess"), tone: "success" });
      } else {
        pushToast({ title: t("skills.installFailed"), tone: "error" });
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.skills });
    },
    onError: () => {
      pushToast({ title: t("skills.installFailed"), tone: "error" });
    },
  });

  const searchMutation = useMutation({
    mutationFn: (query: string) => openclawApi.searchSkills(query),
    onSuccess: (data) => {
      setSearchResults(data);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => openclawApi.deleteSkill(id),
    onSuccess: () => {
      pushToast({ title: t("skills.deleteSuccess"), tone: "success" });
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.skills });
      setDeleteTarget(null);
    },
    onError: () => {
      pushToast({ title: t("skills.deleteFailed"), tone: "error" });
      setDeleteTarget(null);
    },
  });

  function toggleSkill(skill: OpenClawSkillEntry) {
    toggleMutation.mutate({ id: skill.id, enabled: !skill.enabled });
  }

  function toggleExpand(id: string) {
    setExpandedSkill((prev) => (prev === id ? null : id));
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    // Reset input so same file can be selected again
    e.target.value = "";
  }

  function handleCliRun() {
    if (!cliCommand.trim()) return;
    setCliOutput(null);
    cliMutation.mutate(cliCommand.trim());
  }

  function handleSearch() {
    if (!searchQuery.trim()) return;
    searchMutation.mutate(searchQuery.trim());
  }

  function handleInstallFromMarketplace(installCommand: string) {
    setCliCommand(installCommand);
    setBrowseOpen(false);
    setCliOpen(true);
    setCliOutput(null);
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
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Puzzle className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("skills.title")}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("skills.description")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBrowseOpen(true)}>
              <Search className="h-4 w-4 mr-1.5" />
              {t("skills.browseSkills")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCliOpen(true)}>
              <Terminal className="h-4 w-4 mr-1.5" />
              {t("skills.installCli")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1.5" />
              {uploadMutation.isPending ? t("skills.uploading") : t("skills.uploadSkill")}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.tar.gz,.tgz"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
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
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(skill)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={skill.enabled ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleSkill(skill)}
                        disabled={toggleMutation.isPending}
                      >
                        {skill.enabled ? t("skills.disableSkill") : t("skills.enableSkill")}
                      </Button>
                    </div>
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

      {/* CLI Install Dialog */}
      <Dialog open={cliOpen} onOpenChange={setCliOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.installCli")}</DialogTitle>
            <DialogDescription>{t("skills.installCliDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={cliCommand}
                onChange={(e) => setCliCommand(e.target.value)}
                placeholder={t("skills.installCliPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCliRun();
                }}
                disabled={cliMutation.isPending}
              />
              <Button onClick={handleCliRun} disabled={cliMutation.isPending || !cliCommand.trim()}>
                {cliMutation.isPending ? t("skills.running") : t("skills.runCommand")}
              </Button>
            </div>
            {cliOutput && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">
                  {t("skills.commandOutput")}
                </p>
                <pre className="whitespace-pre-wrap text-xs font-mono bg-muted rounded-md border border-border p-3 max-h-64 overflow-auto">
                  {cliOutput}
                </pre>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCliOpen(false)}>
              {t("skills.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Browse/Search Dialog */}
      <Dialog open={browseOpen} onOpenChange={setBrowseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("skills.browseSkills")}</DialogTitle>
            <DialogDescription>{t("skills.browseSkillsDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("skills.searchPlaceholder")}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                disabled={searchMutation.isPending}
              />
              <Button onClick={handleSearch} disabled={searchMutation.isPending || !searchQuery.trim()}>
                {searchMutation.isPending ? t("skills.searching") : t("skills.search")}
              </Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-80 overflow-auto">
                {searchResults.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/30"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{result.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.description}</p>
                    </div>
                    {result.installCommand && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="shrink-0 ml-3"
                        onClick={() => handleInstallFromMarketplace(result.installCommand!)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {t("skills.install")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {searchMutation.isSuccess && searchResults.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("skills.noResults")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBrowseOpen(false)}>
              {t("skills.close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("skills.deleteSkill")}</DialogTitle>
            <DialogDescription>
              {deleteTarget && t("skills.deleteSkillConfirm", { name: deleteTarget.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("skills.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("common.loading") : t("skills.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
