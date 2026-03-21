import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Radio, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { openclawApi } from "../../api/openclaw";
import { useToast } from "../../context/ToastContext";
import { queryKeys } from "../../lib/queryKeys";
import type { OpenClawChannelConfig } from "@paperclipai/shared";

const CHANNEL_TYPES: OpenClawChannelConfig["type"][] = [
  "telegram", "slack", "discord", "wechat", "feishu", "email", "custom",
];

function emptyChannel(): OpenClawChannelConfig {
  return {
    id: `channel-${Date.now()}`,
    type: "custom",
    name: "",
    enabled: true,
    config: {},
  };
}

export function ChannelsSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { pushToast } = useToast();

  const { data: channels, isLoading } = useQuery({
    queryKey: queryKeys.openclaw.channels,
    queryFn: () => openclawApi.channels(),
    retry: 1,
  });

  const [form, setForm] = useState<OpenClawChannelConfig[] | null>(null);
  const current = form ?? channels ?? [];

  const mutation = useMutation({
    mutationFn: (data: OpenClawChannelConfig[]) => openclawApi.updateChannels(data),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.openclaw.channels, updated);
      setForm(null);
      pushToast({ title: t("channels.saved") });
    },
    onError: () => {
      pushToast({ title: t("channels.saveFailed"), tone: "error" });
    },
  });

  function updateChannel(index: number, field: keyof OpenClawChannelConfig, value: unknown) {
    const updated = [...current];
    updated[index] = { ...updated[index], [field]: value };
    setForm(updated);
  }

  function addChannel() {
    setForm([...current, emptyChannel()]);
  }

  function removeChannel(index: number) {
    const updated = current.filter((_, i) => i !== index);
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
              <Radio className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-xl font-semibold">{t("channels.title")}</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{t("channels.description")}</p>
          </div>
          <Button size="sm" onClick={addChannel}>
            <Plus className="mr-1 h-4 w-4" />
            {t("channels.addChannel")}
          </Button>
        </div>

        {/* Channel list */}
        {current.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <Radio className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t("channels.noChannels")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t("channels.noChannelsHint")}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {current.map((channel, index) => (
              <div
                key={channel.id}
                className="rounded-lg border border-border bg-card p-5 space-y-4"
              >
                {/* Channel header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {channel.name || t("channels.channelName")}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {t(`channels.types.${channel.type}`)}
                    </Badge>
                    <Badge variant={channel.enabled ? "default" : "secondary"} className="text-xs">
                      {channel.enabled ? t("channels.enabled") : t("channels.disabled")}
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeChannel(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Channel fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("channels.channelName")}
                    </label>
                    <input
                      type="text"
                      value={channel.name}
                      onChange={(e) => updateChannel(index, "name", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      placeholder="My Channel"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground">
                      {t("channels.channelType")}
                    </label>
                    <select
                      value={channel.type}
                      onChange={(e) => updateChannel(index, "type", e.target.value)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      {CHANNEL_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {t(`channels.types.${type}`)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Channel-specific config as JSON */}
                <div>
                  <label className="block text-xs font-medium text-muted-foreground">
                    {t("channels.config")} (JSON)
                  </label>
                  <textarea
                    value={JSON.stringify(channel.config, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        updateChannel(index, "config", parsed);
                      } catch {
                        // Allow typing invalid JSON while editing
                      }
                    }}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono min-h-[80px]"
                    placeholder='{ "botToken": "...", "chatId": "..." }'
                  />
                </div>

                {/* Enable toggle */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={(e) => updateChannel(index, "enabled", e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    {t("channels.enabled")}
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
              {mutation.isPending ? t("common.saving") : t("channels.saveChanges")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
