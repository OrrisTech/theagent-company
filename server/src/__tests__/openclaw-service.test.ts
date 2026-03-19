// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock fs/promises to avoid real file system access
const mockReadFile = vi.fn();
const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockAccess = vi.fn();
const mockWriteFile = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

// Mock fetch for gateway health check
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock drizzle-orm
vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => args,
  eq: vi.fn((a: unknown, b: unknown) => ({ op: "eq", a, b })),
  gte: vi.fn((a: unknown, b: unknown) => ({ op: "gte", a, b })),
  desc: vi.fn((a: unknown) => ({ op: "desc", a })),
  sql: vi.fn(),
}));

// Mock @paperclipai/db
vi.mock("@paperclipai/db", () => ({
  agents: {
    id: "agents.id",
    name: "agents.name",
    companyId: "agents.company_id",
    role: "agents.role",
    title: "agents.title",
    icon: "agents.icon",
    status: "agents.status",
    adapterType: "agents.adapter_type",
    budgetMonthlyCents: "agents.budget_monthly_cents",
    spentMonthlyCents: "agents.spent_monthly_cents",
    lastHeartbeatAt: "agents.last_heartbeat_at",
  },
  approvals: {
    companyId: "approvals.company_id",
    status: "approvals.status",
  },
  costEvents: {
    companyId: "cost_events.company_id",
    agentId: "cost_events.agent_id",
    model: "cost_events.model",
    provider: "cost_events.provider",
    inputTokens: "cost_events.input_tokens",
    outputTokens: "cost_events.output_tokens",
    costCents: "cost_events.cost_cents",
    occurredAt: "cost_events.occurred_at",
  },
  issues: {
    companyId: "issues.company_id",
    status: "issues.status",
    updatedAt: "issues.updated_at",
  },
  activityLog: {
    companyId: "activity_log.company_id",
    actorType: "activity_log.actor_type",
    actorId: "activity_log.actor_id",
    agentId: "activity_log.agent_id",
    action: "activity_log.action",
    entityId: "activity_log.entity_id",
    details: "activity_log.details",
    createdAt: "activity_log.created_at",
    runId: "activity_log.run_id",
    id: "activity_log.id",
  },
}));

const CONFIG_PATH = join(homedir(), ".openclaw", "openclaw.json");

describe("OpenClaw service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("config parsing", () => {
    it("returns empty config when openclaw.json doesn't exist", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      // Dynamically import to get fresh module with mocks
      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const config = await svc.config();

      expect(config.workspace).toBeNull();
      expect(config.gateway).toBeNull();
      expect(config.agents).toEqual([]);
    });

    it("parses valid openclaw.json correctly", async () => {
      const mockConfig = {
        workspace: "/home/user/workspace",
        gateway: { url: "http://localhost", port: 3100 },
        agents: [
          { id: "agent-1", name: "Agent One", model: "claude-opus-4", provider: "anthropic", status: "active" },
          { id: "agent-2", name: "Agent Two", model: null, provider: null, status: "paused" },
        ],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const config = await svc.config();

      expect(config.workspace).toBe("/home/user/workspace");
      expect(config.gateway).toEqual({ url: "http://localhost", port: 3100 });
      expect(config.agents).toHaveLength(2);
      expect(config.agents[0].name).toBe("Agent One");
      expect(config.agents[0].status).toBe("active");
      expect(config.agents[1].status).toBe("paused");
    });

    it("handles malformed JSON gracefully", async () => {
      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve("{ invalid json }}}");
        return Promise.reject(new Error("ENOENT"));
      });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const config = await svc.config();

      expect(config.workspace).toBeNull();
      expect(config.agents).toEqual([]);
    });
  });

  describe("health check", () => {
    it("returns 'unknown' when no config exists", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const health = await svc.health();

      expect(health.gatewayStatus).toBe("unknown");
      expect(health.configFound).toBe(false);
      expect(health.checkedAt).toBeTruthy();
    });

    it("returns 'connected' when gateway responds OK", async () => {
      const mockConfig = {
        workspace: "/tmp/workspace",
        gateway: { url: "http://localhost", port: 3100 },
        agents: [],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      mockFetch.mockResolvedValue({ ok: true });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const health = await svc.health();

      expect(health.gatewayStatus).toBe("connected");
      expect(health.configFound).toBe(true);
    });

    it("returns 'disconnected' when gateway fails", async () => {
      const mockConfig = {
        workspace: "/tmp/workspace",
        gateway: { url: "http://localhost", port: 3100 },
        agents: [],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const health = await svc.health();

      expect(health.gatewayStatus).toBe("disconnected");
    });
  });

  describe("agents", () => {
    it("returns agents from config", async () => {
      const mockConfig = {
        workspace: "/tmp/workspace",
        agents: [
          { id: "a1", name: "Bot", model: "claude-opus-4", provider: "anthropic", status: "active" },
        ],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const agentStatuses = await svc.agents();

      expect(agentStatuses).toHaveLength(1);
      expect(agentStatuses[0].name).toBe("Bot");
      expect(agentStatuses[0].currentTask).toBeNull();
    });
  });

  describe("path traversal prevention", () => {
    it("rejects paths that traverse above workspace", async () => {
      const mockConfig = {
        workspace: "/home/user/workspace",
        agents: [],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);

      const result = await svc.documentContent("../../etc/passwd");
      expect(result).toBeNull();
    });

    it("rejects write to traversal paths", async () => {
      const mockConfig = {
        workspace: "/home/user/workspace",
        agents: [],
      };

      mockReadFile.mockImplementation((path: string) => {
        if (path === CONFIG_PATH) return Promise.resolve(JSON.stringify(mockConfig));
        return Promise.reject(new Error("ENOENT"));
      });

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);

      const result = await svc.documentWrite("../../../etc/passwd", "hacked");
      expect(result).toBeNull();
    });
  });

  describe("documents listing", () => {
    it("returns empty list when no workspace configured", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));

      const { openclawService } = await import("../services/openclaw.js");
      const svc = openclawService({} as any);
      const docs = await svc.documents();

      expect(docs).toEqual([]);
    });
  });
});
