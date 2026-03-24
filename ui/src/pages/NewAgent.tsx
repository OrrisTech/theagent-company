import { useState, useEffect, useMemo } from "react";
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
import { Shield, User, ChevronDown, ChevronRight, ArrowLeft, Search, Plus } from "lucide-react";
import { cn, agentUrl } from "../lib/utils";
import { roleLabels } from "../components/agent-config-primitives";
import { AgentConfigForm, type CreateConfigValues } from "../components/AgentConfigForm";
import { defaultCreateValues } from "../components/agent-config-defaults";
import { getUIAdapter } from "../adapters";
import { AgentIcon, getAgentIcon } from "../components/AgentIconPicker";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@theagentcompany/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@theagentcompany/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@theagentcompany/adapter-gemini-local";
import { useTranslation } from "react-i18next";
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  type RoleTemplate,
  type RoleTemplateCategory,
} from "../data/role-templates";

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

/* ── Step 1: Role Template Selection Grid ── */
function RoleSelectionStep({
  onSelect,
  onCustom,
}: {
  onSelect: (template: RoleTemplate) => void;
  onCustom: () => void;
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState("");
  const isZh = i18n.language.startsWith("zh");

  // Filter templates by search query across name, nameZh, and capabilities
  const filtered = useMemo(() => {
    if (!search.trim()) return null; // null = show all by category
    const q = search.toLowerCase();
    return ROLE_TEMPLATES.filter(
      (tpl) =>
        tpl.name.toLowerCase().includes(q) ||
        tpl.nameZh.includes(q) ||
        tpl.capabilities.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
          placeholder={t("roleTemplates.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
      </div>

      {/* Filtered results */}
      {filtered !== null ? (
        <div className="space-y-2">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("roleTemplates.noResults")}
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filtered.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                template={tpl}
                isZh={isZh}
                onClick={() => onSelect(tpl)}
              />
            ))}
          </div>
        </div>
      ) : (
        /* Category groups */
        <div className="space-y-5">
          {ROLE_TEMPLATE_CATEGORIES.map((cat) => {
            const templates = getTemplatesByCategory(cat.id);
            if (templates.length === 0) return null;
            return (
              <div key={cat.id}>
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  {t(cat.labelKey)}
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {templates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      template={tpl}
                      isZh={isZh}
                      onClick={() => onSelect(tpl)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Custom option */}
      <button
        className="flex items-center gap-2 w-full rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground hover:bg-accent/30 hover:text-foreground transition-colors"
        onClick={onCustom}
      >
        <Plus className="h-4 w-4" />
        {t("roleTemplates.customBlankSlate")}
      </button>
    </div>
  );
}

/* Single template card in the grid */
function TemplateCard({
  template,
  isZh,
  onClick,
}: {
  template: RoleTemplate;
  isZh: boolean;
  onClick: () => void;
}) {
  const Icon = getAgentIcon(template.icon);
  return (
    <button
      className="flex flex-col items-center gap-1.5 rounded-md border border-border p-3 text-center hover:bg-accent/40 hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <Icon className="h-5 w-5 text-muted-foreground" />
      <span className="text-sm font-medium leading-tight">
        {isZh ? template.nameZh : template.name}
      </span>
    </button>
  );
}

/* ── Main Component ── */
export function NewAgent() {
  const { t } = useTranslation();
  const { selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const presetAdapterType = searchParams.get("adapterType");

  // Step state: "select" = choose role, "customize" = four-layer form
  const [step, setStep] = useState<"select" | "customize">("select");
  const [selectedTemplate, setSelectedTemplate] = useState<RoleTemplate | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("general");
  const [soul, setSoul] = useState("");
  const [capabilities, setCapabilities] = useState("");
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

  // Auto-select CEO template when this is the first agent
  useEffect(() => {
    if (isFirstAgent && step === "select") {
      const ceoTemplate = ROLE_TEMPLATES.find((tpl) => tpl.id === "ceo");
      if (ceoTemplate) {
        applyTemplate(ceoTemplate);
      }
    }
  }, [isFirstAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  // Handle preset adapter type from query string
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
    // If adapter type is preset via URL, skip to customize step directly
    if (step === "select" && !isFirstAgent) {
      setStep("customize");
    }
  }, [presetAdapterType]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Apply a role template to pre-fill all form fields.
   */
  function applyTemplate(template: RoleTemplate) {
    setSelectedTemplate(template);
    setName(template.name);
    setTitle(template.name);
    setRole(template.role);
    setSoul(template.soul);
    setCapabilities(template.capabilities);

    // Apply recommended engine if the current one differs
    if (template.recommendedEngine) {
      const engineValues = createValuesForAdapterType(template.recommendedEngine);
      if (template.recommendedModel) {
        engineValues.model = template.recommendedModel;
      }
      setConfigValues(engineValues);
    }

    // Try to auto-select manager by typicalReportsTo hint
    if (template.typicalReportsTo && agents?.length) {
      const hint = template.typicalReportsTo.toLowerCase();
      const match = agents.find(
        (a) =>
          a.role === hint ||
          a.title?.toLowerCase() === hint ||
          a.name.toLowerCase() === hint,
      );
      if (match) setReportsTo(match.id);
    }

    setStep("customize");
  }

  function handleSelectCustom() {
    setSelectedTemplate(null);
    setName("");
    setTitle("");
    setRole("general");
    setSoul("");
    setCapabilities("");
    setStep("customize");
  }

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
      ...(soul.trim() ? { soul: soul.trim() } : {}),
      ...(capabilities.trim() ? { capabilities: capabilities.trim() } : {}),
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
          {step === "select"
            ? t("roleTemplates.chooseRoleDescription")
            : t("newAgent.advancedAgentConfiguration")}
        </p>
      </div>

      {/* ── Step 1: Role Selection ── */}
      {step === "select" && !isFirstAgent && (
        <RoleSelectionStep
          onSelect={applyTemplate}
          onCustom={handleSelectCustom}
        />
      )}

      {/* ── Step 2: Four-Layer Customize Form ── */}
      {step === "customize" && (
        <>
          {/* Back button (only when not first agent and not preset) */}
          {!isFirstAgent && !presetAdapterType && (
            <button
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setStep("select")}
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t("roleTemplates.backToRoles")}
            </button>
          )}

          <div className="border border-border">
            {/* ── Identity ── */}
            <Section title={t("teamMember.tabs.identity")}>
              <div className="space-y-3">
                {/* Name */}
                <input
                  className="w-full text-lg font-semibold bg-transparent outline-none placeholder:text-muted-foreground/50"
                  placeholder={t("agentConfigForm.agentName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
                {/* Soul / Personality */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("teamMember.identity.soul")}
                  </label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 min-h-[80px]"
                    placeholder={t("teamMember.identity.soulPlaceholder")}
                    value={soul}
                    onChange={(e) => setSoul(e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* ── Organization ── */}
            <Section title={t("teamMember.tabs.organization")}>
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

            {/* ── Capabilities ── */}
            <Section title={t("teamMember.tabs.capabilities")}>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">
                    {t("teamMember.capabilities.jobDescription")}
                  </label>
                  <textarea
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 min-h-[60px]"
                    placeholder={t("teamMember.capabilities.jobDescriptionPlaceholder")}
                    value={capabilities}
                    onChange={(e) => setCapabilities(e.target.value)}
                  />
                </div>
              </div>
            </Section>

            {/* ── Engine ── */}
            <Section title={t("teamMember.tabs.engine")} defaultOpen={!selectedTemplate}>
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
        </>
      )}
    </div>
  );
}
