import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "@/lib/router";
import { useCompany } from "../context/CompanyContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import { AGENT_ROLES } from "@theagentcompany/shared";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Shield, User, ChevronDown, ChevronRight } from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";
import { AgentConfigForm, type CreateConfigValues } from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { getUIAdapter } from "../adapters";
import { AgentIcon } from "../components/AgentIconPicker";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@theagentcompany/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@theagentcompany/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@theagentcompany/adapter-gemini-local";
import { useTranslation } from "react-i18next";

const SUPPORTED_ADVANCED_ADAPTER_TYPES = new Set<CreateConfigValues["adapterType"]>([
  "claude_local",
  "codex_local",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "cursor",
  "openclaw_gateway",
]);

function createValuesForAdapterType(
  adapterType: CreateConfigValues["adapterType"],
): CreateConfigValues {
  const { adapterType: _discard, ...defaults } = defaultCreateValues;
  const nextValues: CreateConfigValues = { ...defaults, adapterType };
  if (adapterType === "codex_local") {
    nextValues.model = DEFAULT_CODEX_LOCAL_MODEL;
    nextValues.dangerouslyBypassSandbox =
      DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
  } else if (adapterType === "gemini_local") {
    nextValues.model = DEFAULT_GEMINI_LOCAL_MODEL;
  } else if (adapterType === "cursor") {
    nextValues.model = DEFAULT_CURSOR_LOCAL_MODEL;
  } else if (adapterType === "opencode_local") {
    nextValues.model = "";
  }
  return nextValues;
}

/* Collapsible section wrapper */
function Section({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-accent/30 transition-colors"
        onClick={() => setOpen(!open)}
        type="button"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <div>
          <span className="text-sm font-medium">{title}</span>
          {subtitle && (
            <span className="text-xs text-muted-foreground ml-2">{subtitle}</span>
          )}
        </div>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export function NewAgent() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [reportsTo, setReportsTo] = useState("");
  const [configValues, setConfigValues] = useState<CreateConfigValues>(defaultCreateValues);
  const [roleOpen, setRoleOpen] = useState(false);
  const [reportsToOpen, setReportsToOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const {
    data: adapterModels,
    error: adapterModelsError,
    isLoading: adapterModelsLoading,
    isFetching: adapterModelsFetching,
  } = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.agents.adapterModels(selectedCompanyId, configValues.adapterType)
      : ["agents", "none", "adapter-models", configValues.adapterType],
    queryFn: () => agentsApi.adapterModels(selectedCompanyId!, configValues.adapterType),
    enabled: Boolean(selectedCompanyId),
  });

  const isFirstAgent = !agents || agents.length === 0;
  const effectiveRole = isFirstAgent ? "ceo" : role;

  useEffect(() => {
    setBreadcrumbs([
      { label: t("sidebar.agents"), href: "/agents" },
      { label: t("newAgent.title") },
    ]);
  }, [setBreadcrumbs]);

  useEffect(() => {
    if (isFirstAgent) {
      if (!name) setName("CEO");
      if (!title) setTitle("CEO");
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const requested = presetAdapterType;
    if (!requested) return;
    if (!SUPPORTED_ADVANCED_ADAPTER_TYPES.has(requested as CreateConfigValues["adapterType"])) {
      return;
    }
    setConfigValues((prev) => {
      if (prev.adapterType === requested) return prev;
      return createValuesForAdapterType(requested as CreateConfigValues["adapterType"]);
    });
  }, [presetAdapterType]);

  const createAgent = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : t("newAgent.failedToCreateAgent"));
    },
  });

  function buildAdapterConfig() {
    const adapter = getUIAdapter(configValues.adapterType);
    return adapter.buildAdapterConfig(configValues);
  }

  function handleSubmit() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);
    if (configValues.adapterType === "opencode_local") {
      const selectedModel = configValues.model.trim();
      if (!selectedModel) {
        setFormError("OpenCode requires an explicit model in provider/model format.");
        return;
      }
      if (adapterModelsError) {
        setFormError(
          adapterModelsError instanceof Error
            ? adapterModelsError.message
            : t("newAgent.failedToLoadOpenCodeModels"),
        );
        return;
      }
      if (adapterModelsLoading || adapterModelsFetching) {
        setFormError(t("newAgent.openCodeModelsStillLoading"));
        return;
      }
      const discovered = adapterModels ?? [];
      if (!discovered.some((entry) => entry.id === selectedModel)) {
        setFormError(
          discovered.length === 0
            ? t("newAgent.noOpenCodeModelsDiscovered")
            : `Configured OpenCode model is unavailable: ${selectedModel}`,
        );
        return;
      }
    }
    createAgent.mutate({
      name: name.trim(),
      role: effectiveRole,
      ...(title.trim() ? { title: title.trim() } : {}),
      ...(reportsTo ? { reportsTo } : {}),
      adapterType: configValues.adapterType,
      adapterConfig: buildAdapterConfig(),
      runtimeConfig: {
        heartbeat: {
          enabled: configValues.heartbeatEnabled,
          intervalSec: configValues.intervalSec,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      budgetMonthlyCents: 0,
    });
  }

  const currentReportsTo = (agents ?? []).find((a) => a.id === reportsTo);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">{t("newAgent.newAgent")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("newAgent.advancedAgentConfiguration")}
        </p>
      </div>

      <div className="border border-border">
        {/* ── Identity (身份) ── */}
        <Section title={t("teamMember.tabs.identity")} subtitle="身份">
          {/* Name */}
          <div className="space-y-3">
            <input
              className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
              placeholder={t("agentConfigForm.agentName")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
            {/* Description / personality placeholder */}
            <input
              className="w-full bg-transparent outline-none text-sm text-muted-foreground placeholder:text-muted-foreground/40"
              placeholder={t("agentConfigForm.describeWhatThisAgentCanDo")}
            />
          </div>
        </Section>

        {/* ── Organization (组织) ── */}
        <Section title={t("teamMember.tabs.organization")} subtitle="组织">
          <div className="space-y-3">
            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {t("teamMember.organization.title")}
              </label>
              <input
                className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40"
                placeholder={t("newAgent.titleEGVpOfEngineering")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {/* Role + Reports To */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Popover open={roleOpen} onOpenChange={setRoleOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                      isFirstAgent && "opacity-60 cursor-not-allowed"
                    )}
                    disabled={isFirstAgent}
                  >
                    <Shield className="h-3 w-3 text-muted-foreground" />
                    {roleLabels[effectiveRole] ?? effectiveRole}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-36 p-1" align="start">
                  {AGENT_ROLES.map((r) => (
                    <button
                      key={r}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                        r === role && "bg-accent"
                      )}
                      onClick={() => { setRole(r); setRoleOpen(false); }}
                    >
                      {roleLabels[r] ?? r}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>

              <Popover open={reportsToOpen} onOpenChange={setReportsToOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/50 transition-colors",
                      isFirstAgent && "opacity-60 cursor-not-allowed"
                    )}
                    disabled={isFirstAgent}
                  >
                    {currentReportsTo ? (
                      <>
                        <AgentIcon icon={currentReportsTo.icon} className="h-3 w-3 text-muted-foreground" />
                        {`Reports to ${currentReportsTo.name}`}
                      </>
                    ) : (
                      <>
                        <User className="h-3 w-3 text-muted-foreground" />
                        {isFirstAgent ? "Reports to: N/A (CEO)" : "Reports to..."}
                      </>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-1" align="start">
                  <button
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50",
                      !reportsTo && "bg-accent"
                    )}
                    onClick={() => { setReportsTo(""); setReportsToOpen(false); }}
                  >
                    {t("newAgent.noManager")}
                  </button>
                  {(agents ?? []).map((a) => (
                    <button
                      key={a.id}
                      className={cn(
                        "flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded hover:bg-accent/50 truncate",
                        a.id === reportsTo && "bg-accent"
                      )}
                      onClick={() => { setReportsTo(a.id); setReportsToOpen(false); }}
                    >
                      <AgentIcon icon={a.icon} className="shrink-0 h-3 w-3 text-muted-foreground" />
                      {a.name}
                      <span className="text-muted-foreground ml-auto">{roleLabels[a.role] ?? a.role}</span>
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </Section>

        {/* ── Engine (引擎) ── */}
        <Section title={t("teamMember.tabs.engine")} subtitle="引擎">
          <AgentConfigForm
            mode="create"
            values={configValues}
            onChange={(patch) => setConfigValues((prev) => ({ ...prev, ...patch }))}
            adapterModels={adapterModels}
          />
        </Section>

        {/* Footer */}
        <div className="border-t border-border px-4 py-3">
          {isFirstAgent && (
            <p className="text-xs text-muted-foreground mb-2">{t("newAgent.thisWillBeTheCeo")}</p>
          )}
          {formError && (
            <p className="text-xs text-destructive mb-2">{formError}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/agents")}>
              {t("common.cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createAgent.isPending}
              onClick={handleSubmit}
            >
              {createAgent.isPending ? t("newAgent.creatingAgent") : t("newAgent.createAgent")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
