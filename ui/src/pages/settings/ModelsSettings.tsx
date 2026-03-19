import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bot, Plus, Trash2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { openclawApi } from "../../api/openclaw";
import { useToast } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import type { OpenClawModelConfig } from "@paperclipai/shared";

// Empty model template for adding new entries
function emptyModel(): OpenClawModelConfig {
  return {
    id: `model-${Date.now()}`,
    provider: "",
    model: "",
    apiKey: "",
    baseUrl: "",
    maxTokens: undefined,
    temperature: undefined,
    isDefault: false,
    enabled: true,
  };
}

export function ModelsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: models, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.models,
    queryFn: () => openclawApi.models(),
  });

  const [form, setForm] = useState<OpenClawModelConfig[] | null>(null);
  const current = form ?? models ?? [];

  const mutation = useMutation({
    mutationFn: (data: OpenClawModelConfig[]) => openclawApi.updateModels(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.openclaw.models, updated);
      setForm(null);
      pushToast({ title: t("models.saved") });
    },
    onError: () => {
      pushToast({ title: t("models.saveFailed"), tone: "error" });
    },
  });

  function updateModel(index: number, field: keyof OpenClawModelConfig, value: unknown) {
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    setForm(updated);
  }

  function addModel() {
    setForm([...current, emptyModel()]);
  }

  function removeModel(index: number) {
    const updated = current.filter((_, i) => i !== index);
    setForm(updated);
  }

  function setDefault(index: number) {
    const updated = current.map((m, i) => ({ ...m, isDefault: i === index }));
    setForm(updated);
  }

  function handleSave() {
    mutation.mutate(current);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl py-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("models.title")}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("models.description")}</p>
          </div>
          <Button size="sm" onClick={addModel}>
            <Plus className="mr-1 h-4 w-4" />
            {t("models.addModel")}
          </Button>
        </div>

        {/* Model list */}
        {current.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Bot className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t("models.noModels")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("models.noModelsHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {current.map((model, index) => (
              <div
                key={model.id}
                className="rounded-lg border border-border bg-card p-5 space-y-4"
              >
                {/* Model header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {model.provider || t("models.providerPlaceholder")}
                      {model.model ? ` / ${model.model}` : ""}
                    </span>
                    {model.isDefault && (
                      <Badge variant="default" className="text-xs">
                        <Star className="mr-1 h-3 w-3" />
                        {t("models.isDefault")}
                      </Badge>
                    )}
                    <Badge variant={model.enabled ? "default" : "secondary"} className="text-xs">
                      {model.enabled ? t("models.enabled") : t("models.disabled")}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {!model.isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDefault(index)}
                        title={t("models.isDefault")}
                      >
                        <Star className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeModel(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Model fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.provider")}
                    </label>
                    <input
                      type="text"
                      value={model.provider}
                      onChange={(e) => updateModel(index, "provider", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder={t("models.providerPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.model")}
                    </label>
                    <input
                      type="text"
                      value={model.model}
                      onChange={(e) => updateModel(index, "model", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder={t("models.modelPlaceholder")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.apiKey")}
                    </label>
                    <input
                      type="password"
                      value={model.apiKey ?? ""}
                      onChange={(e) => updateModel(index, "apiKey", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.baseUrl")}
                    </label>
                    <input
                      type="url"
                      value={model.baseUrl ?? ""}
                      onChange={(e) => updateModel(index, "baseUrl", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder="https://api.example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.maxTokens")}
                    </label>
                    <input
                      type="number"
                      value={model.maxTokens ?? ""}
                      onChange={(e) => updateModel(index, "maxTokens", e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder="4096"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("models.temperature")}
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="2"
                      value={model.temperature ?? ""}
                      onChange={(e) => updateModel(index, "temperature", e.target.value ? Number(e.target.value) : undefined)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder="0.7"
                    />
                  </div>
                </div>

                {/* Enable toggle */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={model.enabled}
                      onChange={(e) => updateModel(index, "enabled", e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {t("models.enabled")}
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Save button */}
        {form !== null && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setForm(null)}>
              {t("common.cancel")}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={mutation.isPending}>
              {mutation.isPending ? t("common.saving") : t("models.saveChanges")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
