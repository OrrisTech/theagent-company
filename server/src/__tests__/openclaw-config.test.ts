// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

// Mock fs/promises
const mockReadFile = vi.fn();
const mockReaddir = vi.fn();
const mockStat = vi.fn();
const mockAccess = vi.fn();
const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  access: (...args: unknown[]) => mockAccess(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

// Mock fetch
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
  approvals: { companyId: "approvals.company_id", status: "approvals.status" },
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
  issues: { companyId: "issues.company_id", status: "issues.status", updatedAt: "issues.updated_at" },
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

// Mock cron validation
vi.mock("../services/cron.js", () => ({
  validateCron: (expr: string) => {
    if (expr === "invalid") return "Invalid cron expression";
    return null;
  },
  nextCronTickFromExpression: (expr: string) => {
    if (expr === "invalid") throw new Error("Invalid");
    return new Date("2026-04-01T00:00:00Z");
  },
}));

// Create a mock DB
const mockDb = {
  select: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  groupBy: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  leftJoin: vi.fn().mockReturnThis(),
  then: vi.fn().mockResolvedValue([{ totalTokens: 0, totalCostCents: 0 }]),
};

const configPath = join(homedir(), ".openclaw", "openclaw.json");

// Import the service after mocks
const { openclawService } = await import("../services/openclaw.js");

describe("OpenClaw Config Service — Phase 4", () => {
  const svc = openclawService(mockDb as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("models()", () => {
    it("returns empty array when no config file exists", async () => {
      mockReadFile.mockResolvedValue(null);
      // safeReadFile catches errors
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      const result = await svc.models();
      expect(result).toEqual([]);
    });

    it("parses model configs from openclaw.json", async () => {
      const config = {
        models: [
          {
            id: "m1",
            provider: "anthropic",
            model: "claude-opus-4",
            apiKey: "sk-ant-secret-key-12345678",
            enabled: true,
            isDefault: true,
          },
          {
            id: "m2",
            provider: "openai",
            model: "gpt-4o",
            enabled: false,
          },
        ],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(config));

      const result = await svc.models();
      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe("anthropic");
      expect(result[0].model).toBe("claude-opus-4");
      expect(result[0].isDefault).toBe(true);
      // API key should be masked
      expect(result[0].apiKey).not.toBe("sk-ant-secret-key-12345678");
      expect(result[0].apiKey).toContain("****");
      expect(result[1].enabled).toBe(false);
    });
  });

  describe("updateModels()", () => {
    it("writes models to config and preserves masked API keys", async () => {
      const existingConfig = {
        workspace: "/workspace",
        models: [
          { id: "m1", provider: "anthropic", model: "claude-opus-4", apiKey: "sk-real-key", enabled: true },
        ],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(existingConfig));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await svc.updateModels([
        { id: "m1", provider: "anthropic", model: "claude-opus-4", apiKey: "sk-r****key", enabled: true },
      ]);

      // Should have called writeFile
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
      // Should preserve the original API key since the submitted one was masked
      expect(writtenContent.models[0].apiKey).toBe("sk-real-key");
      // Returned result should still be masked
      expect(result[0].apiKey).toContain("****");
    });
  });

  describe("channels()", () => {
    it("returns empty array when no channels in config", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      const result = await svc.channels();
      expect(result).toEqual([]);
    });

    it("parses channel configs", async () => {
      const config = {
        channels: [
          { id: "c1", type: "telegram", name: "Bot", enabled: true, config: { token: "abc" } },
        ],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(config));
      const result = await svc.channels();
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("telegram");
      expect(result[0].name).toBe("Bot");
      expect(result[0].config).toEqual({ token: "abc" });
    });
  });

  describe("skills()", () => {
    it("returns empty array when no workspace configured", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      const result = await svc.skills();
      expect(result).toEqual([]);
    });

    it("discovers skills from workspace/skills directory", async () => {
      mockReadFile.mockImplementation(async (path: string) => {
        if (path === configPath) {
          return JSON.stringify({ workspace: "/workspace" });
        }
        if (path.includes("SKILL.md")) {
          return "---\ndescription: A test skill\n---\n# Test Skill";
        }
        return null;
      });
      mockAccess.mockImplementation(async (path: string) => {
        if (path === "/workspace/skills") return;
        throw new Error("ENOENT");
      });
      mockReaddir.mockImplementation(async (dir: string) => {
        if (dir === "/workspace/skills") {
          return [
            { name: "web-search", isDirectory: () => true, isFile: () => false },
            { name: ".hidden", isDirectory: () => true, isFile: () => false },
          ];
        }
        return [];
      });

      const result = await svc.skills();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("web-search");
      expect(result[0].description).toBe("A test skill");
      expect(result[0].skillMdContent).toContain("# Test Skill");
    });
  });

  describe("cronTasks()", () => {
    it("returns empty array when no cron config", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({}));
      const result = await svc.cronTasks();
      expect(result).toEqual([]);
    });

    it("parses cron tasks and computes next run time", async () => {
      const config = {
        cron: [
          { id: "t1", name: "Daily Job", expression: "0 9 * * *", command: "run daily", enabled: true },
        ],
      };
      mockReadFile.mockResolvedValue(JSON.stringify(config));
      const result = await svc.cronTasks();
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Daily Job");
      expect(result[0].expression).toBe("0 9 * * *");
      // nextRunAt should be computed
      expect(result[0].nextRunAt).toBeDefined();
    });
  });

  describe("createCronTask()", () => {
    it("creates a new cron task and writes to config", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ cron: [] }));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await svc.createCronTask({
        name: "Test",
        expression: "0 * * * *",
        command: "echo hello",
        enabled: true,
      });

      expect(result.name).toBe("Test");
      expect(result.expression).toBe("0 * * * *");
      expect(result.id).toMatch(/^cron-/);
      expect(mockWriteFile).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid cron expressions", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ cron: [] }));
      await expect(
        svc.createCronTask({
          name: "Bad",
          expression: "invalid",
          command: "echo",
          enabled: true,
        }),
      ).rejects.toThrow("Invalid cron expression");
    });
  });

  describe("deleteCronTask()", () => {
    it("deletes a task by ID", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({
        cron: [{ id: "t1", name: "Job", expression: "0 * * * *", command: "x" }],
      }));
      mockMkdir.mockResolvedValue(undefined);
      mockWriteFile.mockResolvedValue(undefined);

      const result = await svc.deleteCronTask("t1");
      expect(result).toBe(true);

      const writtenContent = JSON.parse(mockWriteFile.mock.calls[0][1]);
      expect(writtenContent.cron).toHaveLength(0);
    });

    it("returns false when task not found", async () => {
      mockReadFile.mockResolvedValue(JSON.stringify({ cron: [] }));
      const result = await svc.deleteCronTask("nonexistent");
      expect(result).toBe(false);
    });
  });
});
