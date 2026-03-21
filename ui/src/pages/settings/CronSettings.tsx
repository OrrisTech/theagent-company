import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Plus, Trash2, Pencil, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { openclawApi } from "../../api/openclaw";
import { useToast } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import type { OpenClawCronTask } from "@paperclipai/shared";

interface CronFormData {
  name: string;
  expression: string;
  command: string;
  agentId?: string;
  agentName?: string;
  enabled: boolean;
}

const EMPTY_FORM: CronFormData = {
  name: "",
  expression: "",
  command: "",
  enabled: true,
};

function StatusIcon({ status }: { status: string | null | undefined }) {
  switch (status) {
    case "success":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failure":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "running":
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    default:
      return null;
  }
}

function formatDate(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function CronSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CronFormData>(EMPTY_FORM);

  const { data: tasks, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.cronTasks,
    queryFn: () => openclawApi.cronTasks(),
    retry: 1,
  });

  const createMutation = useMutation({
    mutationFn: (data: CronFormData) => openclawApi.createCronTask(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.cronTasks });
      setShowCreate(false);
      setForm(EMPTY_FORM);
      pushToast({ title: t("cron.saved") });
    },
    onError: () => {
      pushToast({ title: t("cron.saveFailed"), tone: "error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<OpenClawCronTask> }) =>
      openclawApi.updateCronTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.cronTasks });
      setEditingId(null);
      setForm(EMPTY_FORM);
      pushToast({ title: t("cron.saved") });
    },
    onError: () => {
      pushToast({ title: t("cron.saveFailed"), tone: "error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => openclawApi.deleteCronTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.openclaw.cronTasks });
      pushToast({ title: t("cron.deleted") });
    },
    onError: () => {
      pushToast({ title: t("cron.deleteFailed"), tone: "error" });
    },
  });

  function startEdit(task: OpenClawCronTask) {
    setEditingId(task.id);
    setForm({
      name: task.name,
      expression: task.expression,
      command: task.command,
      agentId: task.agentId,
      agentName: task.agentName,
      enabled: task.enabled,
    });
    setShowCreate(false);
  }

  function handleCreate() {
    setShowCreate(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  function handleCancel() {
    setEditingId(null);
    setShowCreate(false);
    setForm(EMPTY_FORM);
  }

  function handleDelete(id: string) {
    if (window.confirm(t("cron.confirmDelete"))) {
      deleteMutation.mutate(id);
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  const taskList = tasks ?? [];
  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("cron.title")}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("cron.description")}</p>
          </div>
          <Button size="sm" onClick={handleCreate}>
            <Plus className="mr-1 h-4 w-4" />
            {t("cron.addTask")}
          </Button>
        </div>

        {/* Create / Edit form */}
        {(showCreate || editingId) && (
          <div className="rounded-lg border border-border bg-card p-5 space-y-4">
            <h3 className="text-sm font-medium">
              {editingId ? t("cron.editTask") : t("cron.addTask")}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("cron.taskName")}
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  placeholder="Daily content creation"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">
                  {t("cron.expression")}
                </label>
                <input
                  type="text"
                  value={form.expression}
                  onChange={(e) => setForm({ ...form, expression: e.target.value })}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                  placeholder="0 9 * * *"
                />
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("cron.expressionHint")}
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground">
                {t("cron.command")}
              </label>
              <input
                type="text"
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                placeholder="workflow run daily-content"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-input"
                />
                {t("cron.enabled")}
              </label>
            </div>
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                {t("common.cancel")}
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !form.name || !form.expression || !form.command}
              >
                {isSaving ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </div>
        )}

        {/* Task list */}
        {taskList.length === 0 && !showCreate ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Clock className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t("cron.noTasks")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("cron.noTasksHint")}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {taskList.map((task) => (
              <div
                key={task.id}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <StatusIcon status={task.lastRunStatus} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{task.name}</span>
                        <Badge variant={task.enabled ? "default" : "secondary"} className="text-xs shrink-0">
                          {task.enabled ? t("cron.enabled") : t("cron.disabled")}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono">{task.expression}</span>
                        <span>·</span>
                        <span className="font-mono truncate">{task.command}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(task)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(task.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Execution details */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div>
                    <span className="font-medium">{t("cron.nextRun")}:</span>{" "}
                    {formatDate(task.nextRunAt)}
                  </div>
                  <div>
                    <span className="font-medium">{t("cron.lastRun")}:</span>{" "}
                    {formatDate(task.lastRunAt)}
                  </div>
                  <div>
                    <span className="font-medium">{t("cron.lastStatus")}:</span>{" "}
                    {task.lastRunStatus ? t(`cron.status.${task.lastRunStatus}`) : "—"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
