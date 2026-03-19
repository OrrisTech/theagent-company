import { readFile, readdir, stat, access } from "node:fs/promises";
import { join, relative, basename, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { and, eq, gte, desc, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, costEvents, issues, activityLog } from "@paperclipai/db";
import type {
  OpenClawHealth,
  OpenClawConfig,
  OpenClawAgentConfig,
  OpenClawAgentStatus,
  OpenClawUsage,
  OpenClawAgentMemory,
  OpenClawMemoryFile,
  OpenClawDocument,
  OpenClawDocumentContent,
  OpenClawCollaborationEvent,
  OpenClawOverview,
  OpenClawRiskAlert,
  OpenClawTeamMemberStatus,
  OpenClawModelConfig,
  OpenClawChannelConfig,
  OpenClawSkillEntry,
  OpenClawCronTask,
} from "@paperclipai/shared";
import { validateCron, nextCronTickFromExpression } from "./cron.js";

// Default path for OpenClaw config
const OPENCLAW_CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");

// ---- Internal helpers ----

/** Safely read a file, returning null if it doesn't exist or is unreadable */
async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

/** Safely stat a file, returning null if it doesn't exist */
async function safeStat(path: string) {
  try {
    return await stat(path);
  } catch {
    return null;
  }
}

/** Check if a path exists and is accessible */
async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Write the openclaw.json config file back to disk */
async function writeConfig(data: Record<string, unknown>): Promise<void> {
  const { writeFile, mkdir } = await import("node:fs/promises");
  const dir = join(homedir(), ".openclaw");
  await mkdir(dir, { recursive: true });
  await writeFile(OPENCLAW_CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
}

/** Read the raw JSON config, returning {} if missing */
async function readRawConfig(): Promise<Record<string, unknown>> {
  const content = await safeReadFile(OPENCLAW_CONFIG_PATH);
  if (!content) return {};
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/** Mask an API key for safe display: show first 4 and last 4 chars */
function maskApiKey(key: string): string {
  if (key.length <= 12) return "****";
  return `${key.slice(0, 4)}${"*".repeat(key.length - 8)}${key.slice(-4)}`;
}

/** Recursively list markdown files in a directory */
async function listMarkdownFiles(dir: string, baseDir: string): Promise<Array<{
  filename: string;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: string;
}>> {
  const results: Array<{
    filename: string;
    relativePath: string;
    absolutePath: string;
    sizeBytes: number;
    modifiedAt: string;
  }> = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      // Skip hidden directories and node_modules
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;

      if (entry.isDirectory()) {
        const nested = await listMarkdownFiles(fullPath, baseDir);
        results.push(...nested);
      } else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
        const s = await safeStat(fullPath);
        if (s) {
          results.push({
            filename: entry.name,
            relativePath: relative(baseDir, fullPath),
            absolutePath: fullPath,
            sizeBytes: s.size,
            modifiedAt: s.mtime.toISOString(),
          });
        }
      }
    }
  } catch {
    // Directory doesn't exist or is unreadable — return empty
  }
  return results;
}

/** Parse the openclaw.json config file */
async function parseConfig(): Promise<{
  raw: Record<string, unknown> | null;
  workspace: string | null;
  gatewayUrl: string | null;
  gatewayPort: number;
  agents: OpenClawAgentConfig[];
}> {
  const content = await safeReadFile(OPENCLAW_CONFIG_PATH);
  if (!content) {
    return { raw: null, workspace: null, gatewayUrl: null, gatewayPort: 0, agents: [] };
  }

  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const workspace = typeof parsed.workspace === "string" ? parsed.workspace : null;

    // Parse gateway config
    const gw = parsed.gateway as Record<string, unknown> | undefined;
    const gatewayUrl = typeof gw?.url === "string" ? gw.url : null;
    const gatewayPort = typeof gw?.port === "number" ? gw.port : 0;

    // Parse agents array
    const rawAgents = Array.isArray(parsed.agents) ? parsed.agents : [];
    const agentConfigs: OpenClawAgentConfig[] = rawAgents.map((a: Record<string, unknown>, i: number) => ({
      id: typeof a.id === "string" ? a.id : `agent-${i}`,
      name: typeof a.name === "string" ? a.name : `Agent ${i}`,
      model: typeof a.model === "string" ? a.model : null,
      provider: typeof a.provider === "string" ? a.provider : null,
      status: (a.status === "active" || a.status === "paused") ? a.status : "unknown" as const,
    }));

    return { raw: parsed, workspace, gatewayUrl, gatewayPort, agents: agentConfigs };
  } catch {
    return { raw: null, workspace: null, gatewayUrl: null, gatewayPort: 0, agents: [] };
  }
}

/** Try to reach the gateway health endpoint */
async function checkGateway(url: string | null): Promise<"connected" | "disconnected" | "unknown"> {
  if (!url) return "unknown";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${url}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok ? "connected" : "disconnected";
  } catch {
    return "disconnected";
  }
}

// ---- Public service ----

export function openclawService(db: Db) {
  return {

    /** Check gateway health and config availability */
    health: async (): Promise<OpenClawHealth> => {
      const config = await parseConfig();
      const gatewayUrl = config.gatewayUrl
        ? `${config.gatewayUrl}${config.gatewayPort ? `:${config.gatewayPort}` : ""}`
        : null;

      const gatewayStatus = await checkGateway(gatewayUrl);

      return {
        gatewayStatus,
        gatewayUrl,
        configFound: config.raw !== null,
        workspacePath: config.workspace,
        checkedAt: new Date().toISOString(),
      };
    },

    /** Read the openclaw.json configuration */
    config: async (): Promise<OpenClawConfig> => {
      const config = await parseConfig();
      return {
        workspace: config.workspace,
        gateway: config.gatewayUrl
          ? { url: config.gatewayUrl, port: config.gatewayPort }
          : null,
        agents: config.agents,
      };
    },

    /** Get runtime status for all OpenClaw agents */
    agents: async (): Promise<OpenClawAgentStatus[]> => {
      const config = await parseConfig();
      return config.agents.map((a) => ({
        ...a,
        currentTask: null,
        lastActiveAt: null,
      }));
    },

    /** Get usage data merged from Paperclip cost_events */
    usage: async (companyId: string): Promise<OpenClawUsage> => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      // Aggregate tokens and cost from cost_events for this month
      const [totals] = await db
        .select({
          totalTokens: sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.outputTokens}), 0)::int`,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, monthStart),
        ));

      // By model
      const byModelRows = await db
        .select({
          model: costEvents.model,
          provider: costEvents.provider,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, monthStart),
        ))
        .groupBy(costEvents.model, costEvents.provider);

      // By agent
      const byAgentRows = await db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, monthStart),
        ))
        .groupBy(costEvents.agentId, agents.name);

      return {
        totalTokens: Number(totals?.totalTokens ?? 0),
        totalCostCents: Number(totals?.totalCostCents ?? 0),
        byModel: byModelRows.map((r) => ({
          model: r.model,
          provider: r.provider,
          inputTokens: Number(r.inputTokens),
          outputTokens: Number(r.outputTokens),
          costCents: Number(r.costCents),
        })),
        byAgent: byAgentRows.map((r) => ({
          agentId: r.agentId,
          agentName: r.agentName ?? "Unknown",
          inputTokens: Number(r.inputTokens),
          outputTokens: Number(r.outputTokens),
          costCents: Number(r.costCents),
        })),
      };
    },

    /** Get memory files for a specific agent */
    memory: async (agentId: string): Promise<OpenClawAgentMemory> => {
      // Look up agent to get name and check if it's an openclaw agent
      const agentRow = await db
        .select({ name: agents.name, adapterType: agents.adapterType })
        .from(agents)
        .where(eq(agents.id, agentId))
        .then((rows) => rows[0] ?? null);

      const agentName = agentRow?.name ?? "Unknown";
      const config = await parseConfig();
      const workspace = config.workspace;

      if (!workspace) {
        return {
          agentId,
          agentName,
          memoryIndexExists: false,
          memoryIndexContent: null,
          dailyNotes: [],
          memoryEntries: [],
          totalSizeBytes: 0,
          health: "missing",
        };
      }

      // Look for the agent's memory directory
      // Convention: workspace/.claude/projects/*/memory/ or workspace/memory/
      const memoryPaths = [
        join(workspace, "memory"),
        join(workspace, ".claude", "memory"),
      ];

      let memoryDir: string | null = null;
      for (const p of memoryPaths) {
        if (await pathExists(p)) {
          memoryDir = p;
          break;
        }
      }

      // Check for MEMORY.md in workspace root
      const memoryIndexPath = join(workspace, "MEMORY.md");
      const memoryContent = await safeReadFile(memoryIndexPath);
      const memoryIndexExists = memoryContent !== null;

      const dailyNotes: OpenClawMemoryFile[] = [];
      const memoryEntries: OpenClawMemoryFile[] = [];
      let totalSizeBytes = 0;

      if (memoryDir) {
        const files = await listMarkdownFiles(memoryDir, workspace);
        for (const f of files) {
          const entry: OpenClawMemoryFile = {
            filename: f.filename,
            relativePath: f.relativePath,
            sizeBytes: f.sizeBytes,
            modifiedAt: f.modifiedAt,
            type: f.filename.match(/^\d{4}-\d{2}-\d{2}/) ? "daily_note" : "memory_entry",
          };
          if (entry.type === "daily_note") {
            dailyNotes.push(entry);
          } else {
            memoryEntries.push(entry);
          }
          totalSizeBytes += f.sizeBytes;
        }
      }

      if (memoryContent) {
        const indexStat = await safeStat(memoryIndexPath);
        totalSizeBytes += indexStat?.size ?? 0;
      }

      const health = memoryIndexExists ? "healthy" : (memoryDir ? "degraded" : "missing");

      return {
        agentId,
        agentName,
        memoryIndexExists,
        memoryIndexContent: memoryContent,
        dailyNotes: dailyNotes.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
        memoryEntries: memoryEntries.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)),
        totalSizeBytes,
        health,
      };
    },

    /** List workspace documents */
    documents: async (): Promise<OpenClawDocument[]> => {
      const config = await parseConfig();
      if (!config.workspace) return [];

      const files = await listMarkdownFiles(config.workspace, config.workspace);
      return files.map((f) => {
        // Infer category from first path segment
        const parts = f.relativePath.split("/");
        const category = parts.length > 1 ? parts[0] : null;

        return {
          id: randomUUID(),
          filename: f.filename,
          relativePath: f.relativePath,
          sizeBytes: f.sizeBytes,
          modifiedAt: f.modifiedAt,
          category,
          preview: null, // Populated on demand to keep listing fast
        };
      }).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    },

    /** Read a specific document's content */
    documentContent: async (relativePath: string): Promise<OpenClawDocumentContent | null> => {
      const config = await parseConfig();
      if (!config.workspace) return null;

      // Prevent path traversal
      const normalized = relative(config.workspace, join(config.workspace, relativePath));
      if (normalized.startsWith("..")) return null;

      const fullPath = join(config.workspace, normalized);
      const content = await safeReadFile(fullPath);
      if (content === null) return null;

      const s = await safeStat(fullPath);
      return {
        relativePath: normalized,
        content,
        sizeBytes: s?.size ?? 0,
        modifiedAt: s?.mtime.toISOString() ?? new Date().toISOString(),
      };
    },

    /** Write content to a document */
    documentWrite: async (relativePath: string, content: string): Promise<OpenClawDocumentContent | null> => {
      const config = await parseConfig();
      if (!config.workspace) return null;

      // Prevent path traversal
      const normalized = relative(config.workspace, join(config.workspace, relativePath));
      if (normalized.startsWith("..")) return null;

      const fullPath = join(config.workspace, normalized);

      // Only allow writing to existing files (no arbitrary file creation)
      if (!(await pathExists(fullPath))) return null;

      const { writeFile } = await import("node:fs/promises");
      await writeFile(fullPath, content, "utf-8");

      const s = await safeStat(fullPath);
      return {
        relativePath: normalized,
        content,
        sizeBytes: s?.size ?? 0,
        modifiedAt: s?.mtime.toISOString() ?? new Date().toISOString(),
      };
    },

    /** Get collaboration events from Paperclip's activity log */
    collaboration: async (companyId: string, options?: {
      agentId?: string;
      limit?: number;
    }): Promise<OpenClawCollaborationEvent[]> => {
      const limit = options?.limit ?? 50;

      // Query activity log for agent-to-agent interactions
      const conditions = [
        eq(activityLog.companyId, companyId),
        eq(activityLog.actorType, "agent"),
      ];
      if (options?.agentId) {
        conditions.push(eq(activityLog.agentId, options.agentId));
      }

      const rows = await db
        .select()
        .from(activityLog)
        .where(and(...conditions))
        .orderBy(desc(activityLog.createdAt))
        .limit(limit);

      // Fetch agent names for enrichment
      const agentIds = new Set<string>();
      for (const row of rows) {
        if (row.actorId) agentIds.add(row.actorId);
        if (row.agentId) agentIds.add(row.agentId);
      }

      const agentNames = new Map<string, string>();
      if (agentIds.size > 0) {
        const agentRows = await db
          .select({ id: agents.id, name: agents.name })
          .from(agents)
          .where(eq(agents.companyId, companyId));
        for (const a of agentRows) {
          agentNames.set(a.id, a.name);
        }
      }

      return rows.map((row) => {
        // Determine event type from action string
        let eventType: "message" | "delegation" | "review" | "escalation" = "message";
        if (row.action.includes("assign") || row.action.includes("delegat")) eventType = "delegation";
        if (row.action.includes("review") || row.action.includes("approv")) eventType = "review";
        if (row.action.includes("escalat")) eventType = "escalation";

        const details = row.details as Record<string, unknown> | null;

        return {
          id: row.id,
          timestamp: row.createdAt.toISOString(),
          fromAgentId: row.actorId,
          fromAgentName: agentNames.get(row.actorId) ?? row.actorId,
          toAgentId: row.agentId ?? row.entityId,
          toAgentName: agentNames.get(row.agentId ?? row.entityId) ?? "System",
          eventType,
          summary: row.action,
          parentSessionId: typeof details?.parentSessionId === "string" ? details.parentSessionId : null,
          sessionId: row.runId,
        };
      });
    },

    /** Build the overview dashboard data */
    overview: async (companyId: string): Promise<OpenClawOverview> => {
      // Gateway health
      const health = await openclawService(db).health();

      // Agent counts from DB
      const agentRows = await db
        .select({
          id: agents.id,
          name: agents.name,
          role: agents.role,
          title: agents.title,
          icon: agents.icon,
          status: agents.status,
          budgetMonthlyCents: agents.budgetMonthlyCents,
          spentMonthlyCents: agents.spentMonthlyCents,
          lastHeartbeatAt: agents.lastHeartbeatAt,
        })
        .from(agents)
        .where(eq(agents.companyId, companyId));

      const activeAgents = agentRows.filter((a) =>
        a.status === "active" || a.status === "idle" || a.status === "running"
      ).length;

      // Pending approvals
      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      // Today's stats
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const [todayCosts] = await db
        .select({
          totalTokens: sql<number>`coalesce(sum(${costEvents.inputTokens} + ${costEvents.outputTokens}), 0)::int`,
          totalCostCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(
          eq(costEvents.companyId, companyId),
          gte(costEvents.occurredAt, todayStart),
        ));

      const completedToday = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .where(and(
          eq(issues.companyId, companyId),
          eq(issues.status, "done"),
          gte(issues.updatedAt, todayStart),
        ))
        .then((rows) => Number(rows[0]?.count ?? 0));

      // Risk alerts
      const riskAlerts: OpenClawRiskAlert[] = [];

      // Check gateway health
      if (health.gatewayStatus === "disconnected") {
        riskAlerts.push({
          id: "gateway-down",
          type: "gateway_down",
          severity: "high",
          message: "OpenClaw Gateway is unreachable",
          entityId: null,
          entityName: null,
          timestamp: new Date().toISOString(),
        });
      }

      // Check for budget warnings (agents over 80% budget)
      for (const agent of agentRows) {
        if (agent.budgetMonthlyCents > 0) {
          const utilization = agent.spentMonthlyCents / agent.budgetMonthlyCents;
          if (utilization >= 0.9) {
            riskAlerts.push({
              id: `budget-${agent.id}`,
              type: "budget_warning",
              severity: utilization >= 1.0 ? "critical" : "high",
              message: `${agent.name} has used ${Math.round(utilization * 100)}% of budget`,
              entityId: agent.id,
              entityName: agent.name,
              timestamp: new Date().toISOString(),
            });
          }
        }
      }

      // Check for stalled agents (no heartbeat in 30 min for active agents)
      const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
      for (const agent of agentRows) {
        if (
          (agent.status === "running") &&
          agent.lastHeartbeatAt &&
          new Date(agent.lastHeartbeatAt) < thirtyMinAgo
        ) {
          riskAlerts.push({
            id: `stalled-${agent.id}`,
            type: "stalled_agent",
            severity: "medium",
            message: `${agent.name} has not reported activity for 30+ minutes`,
            entityId: agent.id,
            entityName: agent.name,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Get current task for each agent from most recent activity
      const agentTaskMap = new Map<string, string>();
      for (const agent of agentRows) {
        const recentActivity = await db
          .select({ action: activityLog.action, details: activityLog.details })
          .from(activityLog)
          .where(and(
            eq(activityLog.companyId, companyId),
            eq(activityLog.agentId, agent.id),
          ))
          .orderBy(desc(activityLog.createdAt))
          .limit(1)
          .then((rows) => rows[0] ?? null);

        if (recentActivity) {
          const details = recentActivity.details as Record<string, unknown> | null;
          const taskName = typeof details?.issueName === "string"
            ? details.issueName
            : recentActivity.action;
          agentTaskMap.set(agent.id, taskName);
        }
      }

      // Team status
      const teamStatus: OpenClawTeamMemberStatus[] = agentRows.map((a) => ({
        agentId: a.id,
        name: a.name,
        role: a.role,
        title: a.title,
        icon: a.icon,
        status: a.status,
        currentTask: agentTaskMap.get(a.id) ?? null,
        budgetUsedCents: a.spentMonthlyCents,
        budgetTotalCents: a.budgetMonthlyCents,
      }));

      return {
        health,
        activeAgents,
        totalAgents: agentRows.length,
        pendingApprovals,
        todayStats: {
          completedTasks: completedToday,
          totalTokens: Number(todayCosts?.totalTokens ?? 0),
          totalCostCents: Number(todayCosts?.totalCostCents ?? 0),
        },
        riskAlerts: riskAlerts.sort((a, b) => {
          const sevOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          return (sevOrder[a.severity] ?? 4) - (sevOrder[b.severity] ?? 4);
        }),
        teamStatus,
      };
    },

    // ---- Phase 4: Configuration management methods ----

    /** List AI model configurations from openclaw.json */
    models: async (): Promise<OpenClawModelConfig[]> => {
      const raw = await readRawConfig();
      const rawModels = Array.isArray(raw.models) ? raw.models : [];
      return (rawModels as Record<string, unknown>[]).map((m, i) => ({
        id: typeof m.id === "string" ? m.id : `model-${i}`,
        provider: typeof m.provider === "string" ? m.provider : "unknown",
        model: typeof m.model === "string" ? m.model : "unknown",
        apiKey: typeof m.apiKey === "string" ? maskApiKey(m.apiKey) : undefined,
        baseUrl: typeof m.baseUrl === "string" ? m.baseUrl : undefined,
        maxTokens: typeof m.maxTokens === "number" ? m.maxTokens : undefined,
        temperature: typeof m.temperature === "number" ? m.temperature : undefined,
        isDefault: typeof m.isDefault === "boolean" ? m.isDefault : false,
        enabled: typeof m.enabled === "boolean" ? m.enabled : true,
      }));
    },

    /** Update the models array in openclaw.json */
    updateModels: async (models: OpenClawModelConfig[]): Promise<OpenClawModelConfig[]> => {
      const raw = await readRawConfig();
      // Preserve existing API keys for entries where the key is masked
      const existingModels = Array.isArray(raw.models) ? (raw.models as Record<string, unknown>[]) : [];
      const existingKeyMap = new Map<string, string>();
      for (const m of existingModels) {
        if (typeof m.id === "string" && typeof m.apiKey === "string") {
          existingKeyMap.set(m.id, m.apiKey);
        }
      }

      const updatedModels = models.map((m) => {
        const apiKey = m.apiKey && m.apiKey.includes("*")
          ? existingKeyMap.get(m.id) ?? ""
          : m.apiKey;
        return { ...m, apiKey };
      });

      raw.models = updatedModels;
      await writeConfig(raw);

      // Return with masked keys
      return updatedModels.map((m) => ({
        ...m,
        apiKey: m.apiKey ? maskApiKey(m.apiKey) : undefined,
      }));
    },

    /** List communication channel configurations from openclaw.json */
    channels: async (): Promise<OpenClawChannelConfig[]> => {
      const raw = await readRawConfig();
      const rawChannels = Array.isArray(raw.channels) ? raw.channels : [];
      return (rawChannels as Record<string, unknown>[]).map((c, i) => ({
        id: typeof c.id === "string" ? c.id : `channel-${i}`,
        type: (typeof c.type === "string" ? c.type : "custom") as OpenClawChannelConfig["type"],
        name: typeof c.name === "string" ? c.name : `Channel ${i}`,
        enabled: typeof c.enabled === "boolean" ? c.enabled : true,
        config: typeof c.config === "object" && c.config !== null
          ? c.config as Record<string, unknown>
          : {},
      }));
    },

    /** Update the channels array in openclaw.json */
    updateChannels: async (channels: OpenClawChannelConfig[]): Promise<OpenClawChannelConfig[]> => {
      const raw = await readRawConfig();
      raw.channels = channels;
      await writeConfig(raw);
      return channels;
    },

    /** Discover skills from the OpenClaw workspace skills directories */
    skills: async (): Promise<OpenClawSkillEntry[]> => {
      const config = await parseConfig();
      const raw = await readRawConfig();

      // Enabled/disabled state stored in openclaw.json
      const rawSkills = Array.isArray(raw.skills) ? (raw.skills as Record<string, unknown>[]) : [];
      const enabledMap = new Map<string, boolean>();
      for (const s of rawSkills) {
        if (typeof s.id === "string") {
          enabledMap.set(s.id, typeof s.enabled === "boolean" ? s.enabled : true);
        }
      }

      const skills: OpenClawSkillEntry[] = [];
      if (!config.workspace) return skills;

      // Scan standard skill directories
      const skillDirs = [
        join(config.workspace, "skills"),
        join(config.workspace, ".claude", "skills"),
      ];

      for (const skillsRoot of skillDirs) {
        if (!(await pathExists(skillsRoot))) continue;

        try {
          const entries = await readdir(skillsRoot, { withFileTypes: true });
          for (const entry of entries) {
            if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

            const skillDir = join(skillsRoot, entry.name);
            const skillMdPath = join(skillDir, "SKILL.md");
            const skillMd = await safeReadFile(skillMdPath);

            // Try to extract description from SKILL.md frontmatter or first line
            let description = "";
            if (skillMd) {
              const descMatch = skillMd.match(/^description:\s*(.+)$/m);
              if (descMatch) {
                description = descMatch[1].trim();
              } else {
                // Use first non-heading, non-empty line
                const lines = skillMd.split("\n").filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("---"));
                description = lines[0]?.trim() ?? "";
              }
            }

            const id = entry.name;
            skills.push({
              id,
              name: entry.name,
              description,
              path: skillDir,
              enabled: enabledMap.get(id) ?? true,
              skillMdContent: skillMd ?? undefined,
            });
          }
        } catch {
          // Directory unreadable — skip
        }
      }

      return skills.sort((a, b) => a.name.localeCompare(b.name));
    },

    /** Enable or disable a skill by updating openclaw.json */
    updateSkillEnabled: async (skillId: string, enabled: boolean): Promise<void> => {
      const raw = await readRawConfig();
      const rawSkills = Array.isArray(raw.skills) ? (raw.skills as Record<string, unknown>[]) : [];

      const existing = rawSkills.find((s) => s.id === skillId);
      if (existing) {
        existing.enabled = enabled;
      } else {
        rawSkills.push({ id: skillId, enabled });
      }

      raw.skills = rawSkills;
      await writeConfig(raw);
    },

    /** List cron tasks from openclaw.json with computed next-run times */
    cronTasks: async (): Promise<OpenClawCronTask[]> => {
      const raw = await readRawConfig();
      const rawCron = Array.isArray(raw.cron) ? raw.cron : [];
      const now = new Date();

      return (rawCron as Record<string, unknown>[]).map((c, i) => {
        const expression = typeof c.expression === "string" ? c.expression : "* * * * *";
        let nextRunAt: string | undefined;
        try {
          const next = nextCronTickFromExpression(expression, now);
          nextRunAt = next?.toISOString();
        } catch {
          // Invalid expression — skip next run calculation
        }

        return {
          id: typeof c.id === "string" ? c.id : `cron-${i}`,
          name: typeof c.name === "string" ? c.name : `Task ${i}`,
          expression,
          command: typeof c.command === "string" ? c.command : "",
          agentId: typeof c.agentId === "string" ? c.agentId : undefined,
          agentName: typeof c.agentName === "string" ? c.agentName : undefined,
          enabled: typeof c.enabled === "boolean" ? c.enabled : true,
          lastRunAt: typeof c.lastRunAt === "string" ? c.lastRunAt : undefined,
          nextRunAt,
          lastRunStatus: (c.lastRunStatus === "success" || c.lastRunStatus === "failure" || c.lastRunStatus === "running")
            ? c.lastRunStatus
            : null,
        };
      });
    },

    /** Create a new cron task in openclaw.json */
    createCronTask: async (task: Omit<OpenClawCronTask, "id" | "nextRunAt" | "lastRunAt" | "lastRunStatus">): Promise<OpenClawCronTask> => {
      // Validate cron expression
      const cronError = validateCron(task.expression);
      if (cronError) {
        throw new Error(`Invalid cron expression: ${cronError}`);
      }

      const raw = await readRawConfig();
      const rawCron = Array.isArray(raw.cron) ? (raw.cron as Record<string, unknown>[]) : [];

      const id = `cron-${randomUUID().slice(0, 8)}`;
      let nextRunAt: string | undefined;
      try {
        const next = nextCronTickFromExpression(task.expression, new Date());
        nextRunAt = next?.toISOString();
      } catch {
        // noop
      }

      const newTask: OpenClawCronTask = {
        id,
        name: task.name,
        expression: task.expression,
        command: task.command,
        agentId: task.agentId,
        agentName: task.agentName,
        enabled: task.enabled,
        nextRunAt,
        lastRunStatus: null,
      };

      rawCron.push(newTask as unknown as Record<string, unknown>);
      raw.cron = rawCron;
      await writeConfig(raw);

      return newTask;
    },

    /** Update an existing cron task in openclaw.json */
    updateCronTask: async (id: string, updates: Partial<OpenClawCronTask>): Promise<OpenClawCronTask | null> => {
      if (updates.expression) {
        const cronError = validateCron(updates.expression);
        if (cronError) {
          throw new Error(`Invalid cron expression: ${cronError}`);
        }
      }

      const raw = await readRawConfig();
      const rawCron = Array.isArray(raw.cron) ? (raw.cron as Record<string, unknown>[]) : [];
      const idx = rawCron.findIndex((c) => c.id === id);
      if (idx === -1) return null;

      const existing = rawCron[idx] as Record<string, unknown>;
      Object.assign(existing, updates);

      // Recompute next run if expression changed
      const expression = typeof existing.expression === "string" ? existing.expression : "* * * * *";
      try {
        const next = nextCronTickFromExpression(expression, new Date());
        existing.nextRunAt = next?.toISOString();
      } catch {
        // noop
      }

      raw.cron = rawCron;
      await writeConfig(raw);

      return {
        id,
        name: typeof existing.name === "string" ? existing.name : "",
        expression,
        command: typeof existing.command === "string" ? existing.command : "",
        agentId: typeof existing.agentId === "string" ? existing.agentId : undefined,
        agentName: typeof existing.agentName === "string" ? existing.agentName : undefined,
        enabled: typeof existing.enabled === "boolean" ? existing.enabled : true,
        lastRunAt: typeof existing.lastRunAt === "string" ? existing.lastRunAt : undefined,
        nextRunAt: typeof existing.nextRunAt === "string" ? existing.nextRunAt : undefined,
        lastRunStatus: (existing.lastRunStatus === "success" || existing.lastRunStatus === "failure" || existing.lastRunStatus === "running")
          ? existing.lastRunStatus as "success" | "failure" | "running"
          : null,
      };
    },

    /** Delete a cron task from openclaw.json */
    deleteCronTask: async (id: string): Promise<boolean> => {
      const raw = await readRawConfig();
      const rawCron = Array.isArray(raw.cron) ? (raw.cron as Record<string, unknown>[]) : [];
      const idx = rawCron.findIndex((c) => c.id === id);
      if (idx === -1) return false;

      rawCron.splice(idx, 1);
      raw.cron = rawCron;
      await writeConfig(raw);
      return true;
    },
  };
}
