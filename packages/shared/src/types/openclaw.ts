// OpenClaw observability types — data structures for gateway health,
// agent status, memory, documents, collaboration, and usage tracking.

/** Gateway health check result */
export interface OpenClawHealth {
  gatewayStatus: "connected" | "disconnected" | "unknown";
  gatewayUrl: string | null;
  configFound: boolean;
  workspacePath: string | null;
  /** ISO timestamp of the health check */
  checkedAt: string;
}

/** Parsed openclaw.json configuration (safe subset exposed to UI) */
export interface OpenClawConfig {
  workspace: string | null;
  gateway: { url: string; port: number } | null;
  agents: OpenClawAgentConfig[];
}

/** Single agent entry from openclaw.json */
export interface OpenClawAgentConfig {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
  status: "active" | "paused" | "unknown";
}

/** Runtime agent status enriched with live data */
export interface OpenClawAgentStatus {
  id: string;
  name: string;
  model: string | null;
  provider: string | null;
  status: "active" | "paused" | "unknown";
  currentTask: string | null;
  lastActiveAt: string | null;
}

/** Usage data aggregated from OpenClaw workspace */
export interface OpenClawUsage {
  totalTokens: number;
  totalCostCents: number;
  /** Per-model token breakdown */
  byModel: OpenClawModelUsage[];
  /** Per-agent usage breakdown */
  byAgent: OpenClawAgentUsage[];
}

export interface OpenClawModelUsage {
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

export interface OpenClawAgentUsage {
  agentId: string;
  agentName: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
}

/** Memory file metadata for an agent */
export interface OpenClawMemoryFile {
  filename: string;
  /** Relative path from agent workspace root */
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  type: "memory_index" | "daily_note" | "memory_entry";
}

/** Full memory status for an agent */
export interface OpenClawAgentMemory {
  agentId: string;
  agentName: string;
  memoryIndexExists: boolean;
  memoryIndexContent: string | null;
  dailyNotes: OpenClawMemoryFile[];
  memoryEntries: OpenClawMemoryFile[];
  totalSizeBytes: number;
  health: "healthy" | "degraded" | "missing";
}

/** Document entry in the workspace */
export interface OpenClawDocument {
  id: string;
  filename: string;
  relativePath: string;
  sizeBytes: number;
  modifiedAt: string;
  /** Category inferred from path (e.g., project name or agent name) */
  category: string | null;
  /** First 200 chars of content as preview */
  preview: string | null;
}

/** Full document content for viewing/editing */
export interface OpenClawDocumentContent {
  relativePath: string;
  content: string;
  sizeBytes: number;
  modifiedAt: string;
}

/** Collaboration event between agents */
export interface OpenClawCollaborationEvent {
  id: string;
  timestamp: string;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string;
  toAgentName: string;
  eventType: "message" | "delegation" | "review" | "escalation";
  summary: string;
  /** Parent session ID for tracking session hierarchies */
  parentSessionId: string | null;
  sessionId: string | null;
}

/** Overview dashboard data combining The Agent Company + OpenClaw state */
export interface OpenClawOverview {
  health: OpenClawHealth;
  activeAgents: number;
  totalAgents: number;
  pendingApprovals: number;
  todayStats: {
    completedTasks: number;
    totalTokens: number;
    totalCostCents: number;
  };
  riskAlerts: OpenClawRiskAlert[];
  teamStatus: OpenClawTeamMemberStatus[];
}

export interface OpenClawRiskAlert {
  id: string;
  type: "budget_warning" | "stalled_agent" | "failed_workflow" | "gateway_down";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  entityId: string | null;
  entityName: string | null;
  timestamp: string;
}

export interface OpenClawTeamMemberStatus {
  agentId: string;
  name: string;
  role: string;
  title: string | null;
  icon: string | null;
  status: string;
  currentTask: string | null;
  budgetUsedCents: number;
  budgetTotalCents: number;
}

// ---- Phase 4: Configuration management types ----

/** AI model configuration entry from openclaw.json */
export interface OpenClawModelConfig {
  id: string;
  provider: string;
  model: string;
  /** API key — masked when read, plain when written */
  apiKey?: string;
  baseUrl?: string;
  maxTokens?: number;
  temperature?: number;
  isDefault?: boolean;
  enabled: boolean;
}

/** Communication channel configuration from openclaw.json */
export interface OpenClawChannelConfig {
  id: string;
  type: "telegram" | "slack" | "discord" | "wechat" | "feishu" | "email" | "custom";
  name: string;
  enabled: boolean;
  /** Channel-specific config (bot token, webhook URL, etc.) */
  config: Record<string, unknown>;
}

/** Skill entry discovered from OpenClaw skills directories */
export interface OpenClawSkillEntry {
  id: string;
  name: string;
  description: string;
  /** Filesystem path to the skill directory */
  path: string;
  enabled: boolean;
  /** Content of SKILL.md if present */
  skillMdContent?: string;
}

/** Cron task entry from openclaw.json */
export interface OpenClawCronTask {
  id: string;
  name: string;
  /** Standard 5-field cron expression */
  expression: string;
  /** Command or workflow to execute */
  command: string;
  /** Agent assigned to run this task */
  agentId?: string;
  agentName?: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastRunStatus?: "success" | "failure" | "running" | null;
}

/** Full config response combining all openclaw.json sections */
export interface OpenClawFullConfig {
  workspace: string | null;
  gateway: { url: string; port: number } | null;
  agents: OpenClawAgentConfig[];
  models: OpenClawModelConfig[];
  channels: OpenClawChannelConfig[];
  skills: OpenClawSkillEntry[];
  cron: OpenClawCronTask[];
}

// ---- Phase 4: Unified Team Member types ----

/** Engine type determines how identity/memory/capabilities are stored */
export type TeamMemberEngineType = "openclaw" | "claude_local" | "codex_local" | "http" | "process";

/** Identity metadata stored as JSONB in agents table */
export interface TeamMemberIdentityMeta {
  /** Source of avatar image */
  avatarSource?: string;
  /** Custom metadata fields */
  [key: string]: unknown;
}

/** Unified team member representation combining all four layers */
export interface TeamMember {
  id: string;
  companyId: string;
  // Identity layer
  name: string;
  soul: string | null;
  icon: string | null;
  identityMeta: TeamMemberIdentityMeta | null;
  // Organization layer
  role: string;
  title: string | null;
  reportsTo: string | null;
  status: string;
  budgetMonthlyCents: number;
  spentMonthlyCents: number;
  permissions: Record<string, unknown>;
  // Capabilities layer
  capabilities: string | null;
  // Engine layer
  engineType: TeamMemberEngineType;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig: Record<string, unknown>;
  // Timestamps
  lastHeartbeatAt: string | null;
  createdAt: string;
  updatedAt: string;
}
