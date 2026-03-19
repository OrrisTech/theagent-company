import type {
  OpenClawHealth,
  OpenClawConfig,
  OpenClawAgentStatus,
  OpenClawUsage,
  OpenClawAgentMemory,
  OpenClawDocument,
  OpenClawDocumentContent,
  OpenClawCollaborationEvent,
  OpenClawOverview,
} from "@paperclipai/shared";
import { api } from "./client";

export const openclawApi = {
  // Platform-level (no company scope)
  health: () => api.get<OpenClawHealth>("/openclaw/health"),
  config: () => api.get<OpenClawConfig>("/openclaw/config"),
  agents: () => api.get<OpenClawAgentStatus[]>("/openclaw/agents"),
  documents: () => api.get<OpenClawDocument[]>("/openclaw/documents"),
  documentContent: (path: string) =>
    api.get<OpenClawDocumentContent>(`/openclaw/documents/content?path=${encodeURIComponent(path)}`),
  documentWrite: (path: string, content: string) =>
    api.put<OpenClawDocumentContent>("/openclaw/documents/content", { path, content }),

  // Company-scoped
  usage: (companyId: string) =>
    api.get<OpenClawUsage>(`/companies/${companyId}/openclaw/usage`),
  overview: (companyId: string) =>
    api.get<OpenClawOverview>(`/companies/${companyId}/openclaw/overview`),
  memory: (companyId: string, agentId: string) =>
    api.get<OpenClawAgentMemory>(`/companies/${companyId}/openclaw/memory/${agentId}`),
  collaboration: (companyId: string, agentId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (agentId) params.set("agentId", agentId);
    if (limit) params.set("limit", String(limit));
    const qs = params.toString();
    return api.get<OpenClawCollaborationEvent[]>(
      `/companies/${companyId}/openclaw/collaboration${qs ? `?${qs}` : ""}`,
    );
  },
};
