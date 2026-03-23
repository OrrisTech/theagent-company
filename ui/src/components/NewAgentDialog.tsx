import { useState, type ComponentType } from "react";
import { useNavigate } from "@/lib/router";
import { useDialog } from "../context/DialogContext";
import { useCompany } from "../context/CompanyContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { agentsApi } from "../api/agents";
import { queryKeys } from "../lib/queryKeys";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChevronDown,
  Code,
  Gem,
  MousePointer2,
  Sparkles,
  Terminal,
} from "lucide-react";
import { cn, agentUrl } from "@/lib/utils";
import { OpenCodeLogoIcon } from "./OpenCodeLogoIcon";
import { useTranslation } from "react-i18next";
import { getUIAdapter } from "../adapters";
import { defaultCreateValues } from "./agent-config-defaults";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { DEFAULT_CURSOR_LOCAL_MODEL } from "@paperclipai/adapter-cursor-local";
import { DEFAULT_GEMINI_LOCAL_MODEL } from "@paperclipai/adapter-gemini-local";

type AdapterType =
  | "claude_local"
  | "codex_local"
  | "gemini_local"
  | "opencode_local"
  | "pi_local"
  | "cursor";

const ENGINE_OPTIONS: Array<{
  value: AdapterType;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { value: "claude_local", label: "Claude Code", icon: Sparkles },
  { value: "codex_local", label: "Codex", icon: Code },
  { value: "gemini_local", label: "Gemini CLI", icon: Gem },
  { value: "opencode_local", label: "OpenCode", icon: OpenCodeLogoIcon },
  { value: "pi_local", label: "Pi", icon: Terminal },
  { value: "cursor", label: "Cursor", icon: MousePointer2 },
];

const ROLE_SUGGESTIONS = [
  "CEO",
  "Engineer",
  "PM",
  "Designer",
  "Marketer",
  "Support",
];

export function NewAgentDialog() {
  const { t } = useTranslation();
  const { newAgentOpen, closeNewAgent } = useDialog();
  const { selectedCompanyId } = useCompany();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [engine, setEngine] = useState<AdapterType>("claude_local");
  const [engineOpen, setEngineOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const selectedEngine = ENGINE_OPTIONS.find((e) => e.value === engine)!;

  const hireMember = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      agentsApi.hire(selectedCompanyId!, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.list(selectedCompanyId!) });
      queryClient.invalidateQueries({ queryKey: queryKeys.approvals.list(selectedCompanyId!) });
      resetAndClose();
      navigate(agentUrl(result.agent));
    },
    onError: (error) => {
      setFormError(error instanceof Error ? error.message : t("newAgent.failedToCreateAgent"));
    },
  });

  function resetAndClose() {
    setName("");
    setRole("");
    setEngine("claude_local");
    setFormError(null);
    closeNewAgent();
  }

  function buildAdapterConfig(adapterType: AdapterType) {
    const adapter = getUIAdapter(adapterType);
    const values = { ...defaultCreateValues, adapterType };
    if (adapterType === "codex_local") {
      values.model = DEFAULT_CODEX_LOCAL_MODEL;
      values.dangerouslyBypassSandbox = DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX;
    } else if (adapterType === "gemini_local") {
      values.model = DEFAULT_GEMINI_LOCAL_MODEL;
    } else if (adapterType === "cursor") {
      values.model = DEFAULT_CURSOR_LOCAL_MODEL;
    }
    return adapter.buildAdapterConfig(values);
  }

  function handleHire() {
    if (!selectedCompanyId || !name.trim()) return;
    setFormError(null);

    const roleLower = role.trim().toLowerCase();
    const agentRole = roleLower === "ceo" ? "ceo" : "general";

    hireMember.mutate({
      name: name.trim(),
      role: agentRole,
      ...(role.trim() ? { title: role.trim() } : {}),
      adapterType: engine,
      adapterConfig: buildAdapterConfig(engine),
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 1800,
          wakeOnDemand: true,
          cooldownSec: 10,
          maxConcurrentRuns: 1,
        },
      },
      budgetMonthlyCents: 0,
    });
  }

  function handleAdvanced() {
    resetAndClose();
    navigate(`/agents/new?adapterType=${encodeURIComponent(engine)}`);
  }

  return (
    <Dialog
      open={newAgentOpen}
      onOpenChange={(open) => {
        if (!open) resetAndClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="sm:max-w-md p-0 gap-0 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
          <span className="text-sm text-muted-foreground">{t("newAgentDialog.addANewAgent")}</span>
          <Button
            variant="ghost"
            size="icon-xs"
            className="text-muted-foreground"
            onClick={resetAndClose}
          >
            <span className="text-lg leading-none">&times;</span>
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Name</label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              placeholder="e.g. Alice, Bob, Founding Engineer"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) handleHire();
              }}
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Role</label>
            <input
              className="w-full rounded-md border border-border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              placeholder="e.g. Engineer, PM, Designer"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            />
            <div className="flex flex-wrap gap-1">
              {ROLE_SUGGESTIONS.map((r) => (
                <button
                  key={r}
                  className={cn(
                    "px-2 py-0.5 text-[11px] rounded-full border border-border transition-colors",
                    role === r
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50"
                  )}
                  onClick={() => setRole(r)}
                  type="button"
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Engine */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Engine</label>
            <Popover open={engineOpen} onOpenChange={setEngineOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between w-full rounded-md border border-border px-3 py-2 text-sm hover:bg-accent/50 transition-colors">
                  <span className="flex items-center gap-2">
                    <selectedEngine.icon className="h-4 w-4" />
                    {selectedEngine.label}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-1" align="start">
                {ENGINE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={cn(
                      "flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-accent/50 transition-colors",
                      engine === opt.value && "bg-accent"
                    )}
                    onClick={() => {
                      setEngine(opt.value);
                      setEngineOpen(false);
                    }}
                  >
                    <opt.icon className="h-4 w-4" />
                    {opt.label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          </div>

          {formError && (
            <p className="text-xs text-destructive">{formError}</p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            <button
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
              onClick={handleAdvanced}
              type="button"
            >
              Advanced setup →
            </button>
            <Button
              size="sm"
              disabled={!name.trim() || hireMember.isPending}
              onClick={handleHire}
            >
              {hireMember.isPending ? t("newAgent.creatingAgent") : "Hire"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
