import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { brandingApi, type BrandingConfig } from "../../api/branding";
import { useToast } from "../../context/ToastContext";

const DEFAULT_BRANDING: BrandingConfig = {
  appName: "The Agent Company",
  logoUrl: "",
  primaryColor: "#18181b",
  faviconUrl: "",
};

export function BrandingSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: branding, isLoading } = useQuery({
    queryKey: ["branding"],
    queryFn: () => brandingApi.get(),
  });

  const [form, setForm] = useState<BrandingConfig | null>(null);

  // Initialize form from fetched data
  const current = form ?? branding ?? DEFAULT_BRANDING;

  const mutation = useMutation({
    mutationFn: (data: BrandingConfig) => brandingApi.update(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(["branding"], updated);
      setForm(null);
      pushToast({ title: t("branding.saved") });
    },
    onError: () => {
      pushToast({ title: t("branding.saveFailed"), tone: "error" });
    },
  });

  function handleChange(field: keyof BrandingConfig, value: string) {
    setForm({ ...current, [field]: value });
  }

  function handleReset() {
    setForm(DEFAULT_BRANDING);
  }

  function handleSave() {
    mutation.mutate(current);
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl py-6 text-sm text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">{t("branding.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("branding.description")}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-6">
          {/* App Name */}
          <div>
            <label htmlFor="branding-appName" className="block text-sm font-medium">
              {t("branding.appName")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("branding.appNameDescription")}</p>
            <input
              id="branding-appName"
              type="text"
              value={current.appName}
              onChange={(e) => handleChange("appName", e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="The Agent Company"
            />
          </div>

          {/* Logo URL */}
          <div>
            <label htmlFor="branding-logo" className="block text-sm font-medium">
              {t("branding.logo")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("branding.logoDescription")}</p>
            <input
              id="branding-logo"
              type="url"
              value={current.logoUrl}
              onChange={(e) => handleChange("logoUrl", e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="https://example.com/logo.svg"
            />
          </div>

          {/* Primary Color */}
          <div>
            <label htmlFor="branding-color" className="block text-sm font-medium">
              {t("branding.primaryColor")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("branding.primaryColorDescription")}</p>
            <div className="mt-2 flex items-center gap-3">
              <input
                id="branding-color"
                type="color"
                value={current.primaryColor || "#18181b"}
                onChange={(e) => handleChange("primaryColor", e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-input"
              />
              <input
                type="text"
                value={current.primaryColor}
                onChange={(e) => handleChange("primaryColor", e.target.value)}
                className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder="#18181b"
                pattern="^#[0-9a-fA-F]{6}$"
              />
            </div>
          </div>

          {/* Favicon URL */}
          <div>
            <label htmlFor="branding-favicon" className="block text-sm font-medium">
              {t("branding.favicon")}
            </label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("branding.faviconDescription")}</p>
            <input
              id="branding-favicon"
              type="url"
              value={current.faviconUrl}
              onChange={(e) => handleChange("faviconUrl", e.target.value)}
              className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="https://example.com/favicon.ico"
            />
          </div>

          {/* Preview */}
          <div className="rounded-md border border-border p-4 bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground mb-2">{t("branding.preview")}</p>
            <div className="flex items-center gap-3">
              {current.logoUrl && (
                <img
                  src={current.logoUrl}
                  alt="Logo preview"
                  className="h-8 w-8 object-contain rounded"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              )}
              <div className="flex items-center gap-2">
                {current.primaryColor && (
                  <div
                    className="h-4 w-4 rounded-sm shrink-0"
                    style={{ backgroundColor: current.primaryColor }}
                  />
                )}
                <span className="text-sm font-bold">{current.appName || "The Agent Company"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={handleReset}>
            {t("branding.resetToDefaults")}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? t("common.saving") : t("branding.saveChanges")}
          </Button>
        </div>
      </div>
    </div>
  );
}
