import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  Play,
  Loader2,
  History,
  Bug,
  Bookmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { workflowApi } from "../api/workflows";
import { useCompany } from "../context/CompanyContext";
import type { WorkflowDetail } from "../api/workflows";
import { useToast } from "../context/ToastContext";
import { queryKeys } from "../lib/queryKeys";
import type {
  CreateWorkflowStepInput,
  WorkflowStepType,
  WorkflowStatus,
  WorkflowRun,
} from "@paperclipai/shared";
import { WORKFLOW_STEP_TYPES } from "@paperclipai/shared";

/** Default config for each step type. */
function defaultConfig(type: WorkflowStepType): Record<string, unknown> {
  switch (type) {
    case "prompt": return { prompt: "" };
    case "skill": return { skillId: "" };
    case "api": return { method: "GET", url: "" };
    case "cli": return { command: "" };
    case "tool_use": return { toolId: "" };
    case "approval": return { prompt: "" };
    case "condition": return { expression: "", thenStep: 0 };
    case "loop": return { collection: "", bodyStartStep: 0, bodyEndStep: 0 };
    case "workflow": return { workflowId: "" };
  }
}

/** Editable step form state. */
interface StepFormData {
  name: string;
  type: WorkflowStepType;
  config: Record<string, unknown>;
  inputRefs: string;
  timeoutSeconds: string;
  retries: string;
  fallbackOutput: string;
  isCheckpoint: boolean;
  roleLabel: string;
}

function emptyStep(): StepFormData {
  return {
    name: "",
    type: "prompt",
    config: { prompt: "" },
    inputRefs: "",
    timeoutSeconds: "",
    retries: "",
    fallbackOutput: "",
    isCheckpoint: false,
    roleLabel: "",
  };
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try { return new Date(date).toLocaleString(); } catch { return "—"; }
}

export function WorkflowEditor() {
  const { t } = useTranslation();
  const { workflowId } = useParams<{ workflowId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();
  const { selectedCompanyId } = useCompany();

  const isNew = workflowId === "new";

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<WorkflowStatus>("draft");
  const [maxConcurrency, setMaxConcurrency] = useState("");
  const [steps, setSteps] = useState<StepFormData[]>([emptyStep()]);
  const [versionLabel, setVersionLabel] = useState("");
  const [expandedStep, setExpandedStep] = useState<number>(0);
  const [showRuns, setShowRuns] = useState(false);

  // Load existing workflow
  const { data: detail, isLoading } = useQuery({
    queryKey: queryKeys.workflows.detail(workflowId ?? ""),
    queryFn: () => workflowApi.get(workflowId!),
    enabled: !isNew && !!workflowId,
  });

  // Load run history
  const { data: runs } = useQuery({
    queryKey: queryKeys.workflows.runs(workflowId ?? ""),
    queryFn: () => workflowApi.listRuns(workflowId!),
    enabled: !isNew && !!workflowId && showRuns,
  });

  // Populate form from loaded data
  useEffect(() => {
    if (detail) {
      setName(detail.workflow.name);
      setDescription(detail.workflow.description ?? "");
      setStatus(detail.workflow.status);
      setMaxConcurrency(detail.workflow.maxConcurrency?.toString() ?? "");
      if (detail.steps.length > 0) {
        setSteps(detail.steps.map((s) => ({
          name: s.name,
          type: s.type,
          config: s.config as unknown as Record<string, unknown>,
          inputRefs: (s.inputRefs ?? []).join(", "),
          timeoutSeconds: s.timeoutSeconds?.toString() ?? "",
          retries: s.retries?.toString() ?? "",
          fallbackOutput: s.fallbackOutput ?? "",
          isCheckpoint: s.isCheckpoint,
          roleLabel: s.roleLabel ?? "",
        })));
      }
    }
  }, [detail]);

  // Save mutations
  const createMutation = useMutation({
    mutationFn: () => workflowApi.create({
      name,
      description: description || undefined,
      maxConcurrency: maxConcurrency ? parseInt(maxConcurrency) : undefined,
      steps: steps.map(stepToInput),
    }, selectedCompanyId ?? undefined),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list });
      pushToast({ title: t("pages.workflows.saved") });
      navigate(`/workflows/${result.workflow.id}`);
    },
    onError: () => pushToast({ title: t("pages.workflows.saveFailed"), tone: "error" }),
  });

  const updateMutation = useMutation({
    mutationFn: () => workflowApi.update(workflowId!, {
      name,
      description: description || undefined,
      status,
      maxConcurrency: maxConcurrency ? parseInt(maxConcurrency) : undefined,
      steps: steps.map(stepToInput),
      versionLabel: versionLabel || undefined,
    }, selectedCompanyId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.detail(workflowId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workflows.list });
      pushToast({ title: t("pages.workflows.saved") });
    },
    onError: () => pushToast({ title: t("pages.workflows.saveFailed"), tone: "error" }),
  });

  const runMutation = useMutation({
    mutationFn: (opts?: { debugMode?: boolean }) =>
      workflowApi.triggerRun(workflowId!, { debugMode: opts?.debugMode }),
    onSuccess: (run: WorkflowRun) => {
      pushToast({ title: t("pages.workflows.runStarted") });
      navigate(`/workflows/runs/${run.id}`);
    },
  });

  function stepToInput(s: StepFormData): CreateWorkflowStepInput {
    return {
      name: s.name,
      type: s.type,
      config: s.config as unknown as CreateWorkflowStepInput["config"],
      inputRefs: s.inputRefs ? s.inputRefs.split(",").map((r) => r.trim()).filter(Boolean) : undefined,
      timeoutSeconds: s.timeoutSeconds ? parseInt(s.timeoutSeconds) : undefined,
      retries: s.retries ? parseInt(s.retries) : undefined,
      fallbackOutput: s.fallbackOutput || undefined,
      isCheckpoint: s.isCheckpoint,
      roleLabel: s.roleLabel || undefined,
    };
  }

  function addStep() {
    setSteps([...steps, emptyStep()]);
    setExpandedStep(steps.length);
  }

  function removeStep(index: number) {
    setSteps(steps.filter((_, i) => i !== index));
    if (expandedStep >= steps.length - 1) setExpandedStep(Math.max(0, steps.length - 2));
  }

  function moveStep(index: number, direction: -1 | 1) {
    const newSteps = [...steps];
    const target = index + direction;
    if (target < 0 || target >= newSteps.length) return;
    [newSteps[index], newSteps[target]] = [newSteps[target]!, newSteps[index]!];
    setSteps(newSteps);
    setExpandedStep(target);
  }

  function updateStep(index: number, updates: Partial<StepFormData>) {
    setSteps(steps.map((s, i) => i === index ? { ...s, ...updates } : s));
  }

  function handleSave() {
    if (isNew) {
      createMutation.mutate();
    } else {
      updateMutation.mutate();
    }
  }

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/workflows")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-semibold">
          {isNew ? t("pages.workflows.createWorkflow") : t("pages.workflows.editWorkflow")}
        </h1>
        {!isNew && detail?.latestVersion && (
          <Badge variant="outline">v{detail.latestVersion.version}</Badge>
        )}
      </div>

      {/* Workflow metadata */}
      <div className="border rounded-lg p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.workflowName")}</label>
            <input
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("pages.workflows.workflowName")}
            />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.status")}</label>
            <select
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as WorkflowStatus)}
            >
              <option value="draft">{t("pages.workflows.draft")}</option>
              <option value="active">{t("pages.workflows.active")}</option>
              <option value="archived">{t("pages.workflows.archived")}</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">{t("pages.workflows.workflowDescription")}</label>
          <textarea
            className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.maxConcurrency")}</label>
            <input
              type="number"
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={maxConcurrency}
              onChange={(e) => setMaxConcurrency(e.target.value)}
              placeholder="10"
            />
          </div>
          {!isNew && (
            <div>
              <label className="text-sm font-medium">{t("pages.workflows.versionLabel")}</label>
              <input
                className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                value={versionLabel}
                onChange={(e) => setVersionLabel(e.target.value)}
                placeholder={`v${(detail?.latestVersion?.version ?? 0) + 1}`}
              />
            </div>
          )}
        </div>
      </div>

      {/* Steps editor */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("pages.workflows.steps")}</h2>
          <Button variant="outline" size="sm" onClick={addStep}>
            <Plus className="h-4 w-4 mr-1" />
            {t("pages.workflows.addStep")}
          </Button>
        </div>

        {steps.map((step, index) => (
          <div key={index} className="border rounded-lg">
            {/* Step header — always visible */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30"
              onClick={() => setExpandedStep(expandedStep === index ? -1 : index)}
            >
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-medium">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                {step.roleLabel ? (
                  <span className="font-medium">{step.roleLabel}: {step.name || `Step ${index + 1}`}</span>
                ) : (
                  <span className="font-medium">{step.name || `Step ${index + 1}`}</span>
                )}
                <Badge variant="outline" className="ml-2 text-xs">
                  {t(`pages.workflows.stepTypes.${step.type}`)}
                </Badge>
                {step.isCheckpoint && (
                  <Bookmark className="inline h-3.5 w-3.5 ml-1.5 text-amber-500" />
                )}
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => moveStep(index, -1)} disabled={index === 0}>
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                  onClick={() => moveStep(index, 1)} disabled={index === steps.length - 1}>
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeStep(index)} disabled={steps.length <= 1}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Step detail — expanded */}
            {expandedStep === index && (
              <div className="border-t px-4 py-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepName")}</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.name}
                      onChange={(e) => updateStep(index, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.roleLabel")}</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.roleLabel}
                      onChange={(e) => updateStep(index, { roleLabel: e.target.value })}
                      placeholder={t("pages.workflows.roleLabelPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepType")}</label>
                    <select
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.type}
                      onChange={(e) => {
                        const newType = e.target.value as WorkflowStepType;
                        updateStep(index, { type: newType, config: defaultConfig(newType) });
                      }}
                    >
                      {WORKFLOW_STEP_TYPES.map((st) => (
                        <option key={st} value={st}>
                          {t(`pages.workflows.stepTypes.${st}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Type-specific config fields */}
                <StepConfigEditor
                  type={step.type}
                  config={step.config}
                  onChange={(config) => updateStep(index, { config })}
                  t={t}
                />

                {/* Common step settings */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepTimeout")}</label>
                    <input
                      type="number"
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.timeoutSeconds}
                      onChange={(e) => updateStep(index, { timeoutSeconds: e.target.value })}
                      placeholder="300"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepRetries")}</label>
                    <input
                      type="number"
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.retries}
                      onChange={(e) => updateStep(index, { retries: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepFallback")}</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.fallbackOutput}
                      onChange={(e) => updateStep(index, { fallbackOutput: e.target.value })}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div>
                    <label className="text-sm font-medium">{t("pages.workflows.stepInputRefs")}</label>
                    <input
                      className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                      value={step.inputRefs}
                      onChange={(e) => updateStep(index, { inputRefs: e.target.value })}
                      placeholder="{{step0.output}}, {{step1.output}}"
                    />
                  </div>
                  <label className="flex items-center gap-2 mt-5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={step.isCheckpoint}
                      onChange={(e) => updateStep(index, { isCheckpoint: e.target.checked })}
                      className="rounded"
                    />
                    <span className="text-sm">{t("pages.workflows.stepCheckpoint")}</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-3 border-t pt-4">
        <Button onClick={handleSave} disabled={!name || createMutation.isPending || updateMutation.isPending}>
          {(createMutation.isPending || updateMutation.isPending) ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          {isNew ? t("common.create") : t("pages.workflows.saveAndCreateVersion")}
        </Button>

        {!isNew && (
          <>
            <Button variant="outline" onClick={() => runMutation.mutate({})}>
              <Play className="h-4 w-4 mr-2" />
              {t("pages.workflows.run")}
            </Button>
            <Button variant="outline" onClick={() => runMutation.mutate({ debugMode: true })}>
              <Bug className="h-4 w-4 mr-2" />
              {t("pages.workflows.debugMode")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowRuns(!showRuns)}
              className={showRuns ? "bg-muted" : ""}
            >
              <History className="h-4 w-4 mr-2" />
              {t("pages.workflows.executionHistory")}
            </Button>
          </>
        )}
      </div>

      {/* Execution history panel */}
      {showRuns && (
        <div className="border rounded-lg">
          <div className="px-4 py-3 border-b bg-muted/50">
            <h3 className="font-medium">{t("pages.workflows.executionHistory")}</h3>
          </div>
          {(!runs || runs.length === 0) ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {t("pages.workflows.noRuns")}
            </div>
          ) : (
            <div className="divide-y">
              {runs.map((run: WorkflowRun) => (
                <div
                  key={run.id}
                  className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 cursor-pointer"
                  onClick={() => navigate(`/workflows/runs/${run.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <RunStatusBadge status={run.status} t={t} />
                    <span className="text-sm">{t(`pages.workflows.trigger${run.trigger.charAt(0).toUpperCase() + run.trigger.slice(1)}`)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {run.totalDurationMs != null && (
                      <span>{(run.totalDurationMs / 1000).toFixed(1)}s</span>
                    )}
                    {run.totalCostCents != null && (
                      <span>${(run.totalCostCents / 100).toFixed(2)}</span>
                    )}
                    <span>{formatDate(run.startedAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Badge for a run status. */
function RunStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const variants: Record<string, string> = {
    succeeded: "bg-green-600 text-white",
    failed: "bg-destructive text-white",
    running: "bg-blue-600 text-white",
    paused: "bg-yellow-500 text-white",
    cancelled: "bg-muted-foreground text-white",
    pending: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${variants[status] ?? variants.pending}`}>
      {t(`pages.workflows.${status}`)}
    </span>
  );
}

/** Renders the type-specific configuration fields for a step. */
function StepConfigEditor({
  type,
  config,
  onChange,
  t,
}: {
  type: WorkflowStepType;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
  t: (key: string) => string;
}) {
  function set(key: string, value: unknown) {
    onChange({ ...config, [key]: value });
  }

  switch (type) {
    case "prompt":
      return (
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.promptConfig.prompt")}</label>
            <textarea
              className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              rows={4}
              value={(config.prompt as string) ?? ""}
              onChange={(e) => set("prompt", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">{t("pages.workflows.promptConfig.skillId")}</label>
              <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                value={(config.skillId as string) ?? ""}
                onChange={(e) => set("skillId", e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">{t("pages.workflows.promptConfig.model")}</label>
              <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                value={(config.model as string) ?? ""}
                onChange={(e) => set("model", e.target.value)} />
            </div>
          </div>
        </div>
      );

    case "skill":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.skillConfig.skillId")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.skillId as string) ?? ""}
              onChange={(e) => set("skillId", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.skillConfig.params")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              value={typeof config.params === "string" ? config.params : JSON.stringify(config.params ?? {})}
              onChange={(e) => { try { set("params", JSON.parse(e.target.value)); } catch { set("params", e.target.value); } }} />
          </div>
        </div>
      );

    case "api":
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="text-sm font-medium">{t("pages.workflows.apiConfig.method")}</label>
              <select className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
                value={(config.method as string) ?? "GET"}
                onChange={(e) => set("method", e.target.value)}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <label className="text-sm font-medium">{t("pages.workflows.apiConfig.url")}</label>
              <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
                value={(config.url as string) ?? ""}
                onChange={(e) => set("url", e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.apiConfig.body")}</label>
            <textarea className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              rows={3}
              value={(config.body as string) ?? ""}
              onChange={(e) => set("body", e.target.value)} />
          </div>
        </div>
      );

    case "cli":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.cliConfig.command")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              value={(config.command as string) ?? ""}
              onChange={(e) => set("command", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.cliConfig.cwd")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.cwd as string) ?? ""}
              onChange={(e) => set("cwd", e.target.value)} />
          </div>
        </div>
      );

    case "approval":
      return (
        <div>
          <label className="text-sm font-medium">{t("pages.workflows.approvalConfig.prompt")}</label>
          <textarea className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
            rows={3}
            value={(config.prompt as string) ?? ""}
            onChange={(e) => set("prompt", e.target.value)} />
        </div>
      );

    case "condition":
      return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.conditionConfig.expression")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              value={(config.expression as string) ?? ""}
              onChange={(e) => set("expression", e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.conditionConfig.thenStep")}</label>
            <input type="number" className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.thenStep as number) ?? 0}
              onChange={(e) => set("thenStep", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.conditionConfig.elseStep")}</label>
            <input type="number" className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.elseStep as number) ?? ""}
              onChange={(e) => set("elseStep", e.target.value ? parseInt(e.target.value) : undefined)} />
          </div>
        </div>
      );

    case "loop":
      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-sm font-medium">{t("pages.workflows.loopConfig.collection")}</label>
            <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm font-mono"
              value={(config.collection as string) ?? ""}
              onChange={(e) => set("collection", e.target.value)}
              placeholder="{{step0.output.items}}" />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.loopConfig.bodyStartStep")}</label>
            <input type="number" className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.bodyStartStep as number) ?? 0}
              onChange={(e) => set("bodyStartStep", parseInt(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-sm font-medium">{t("pages.workflows.loopConfig.bodyEndStep")}</label>
            <input type="number" className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
              value={(config.bodyEndStep as number) ?? 0}
              onChange={(e) => set("bodyEndStep", parseInt(e.target.value) || 0)} />
          </div>
        </div>
      );

    case "tool_use":
      return (
        <div>
          <label className="text-sm font-medium">{t("workflowEditor.toolId")}</label>
          <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={(config.toolId as string) ?? ""}
            onChange={(e) => set("toolId", e.target.value)} />
        </div>
      );

    case "workflow":
      return (
        <div>
          <label className="text-sm font-medium">{t("workflowEditor.workflowId")}</label>
          <input className="mt-1 w-full px-3 py-2 border rounded-md bg-background text-sm"
            value={(config.workflowId as string) ?? ""}
            onChange={(e) => set("workflowId", e.target.value)} />
        </div>
      );

    default:
      return null;
  }
}
