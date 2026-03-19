// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

// Hoist mock service
const mockOpenclawService = vi.hoisted(() => ({
  health: vi.fn(),
  config: vi.fn(),
  agents: vi.fn(),
  usage: vi.fn(),
  overview: vi.fn(),
  memory: vi.fn(),
  documents: vi.fn(),
  documentContent: vi.fn(),
  documentWrite: vi.fn(),
  collaboration: vi.fn(),
}));

vi.mock("../services/openclaw.js", () => ({
  openclawService: () => mockOpenclawService,
}));

vi.mock("./authz.js", () => ({
  assertCompanyAccess: vi.fn(),
  assertBoard: vi.fn(),
  getActorInfo: vi.fn(() => ({
    actorType: "user",
    actorId: "board-user",
    agentId: null,
  })),
}));

vi.mock("../errors.js", () => ({
  badRequest: (msg: string) => {
    const err = new Error(msg) as any;
    err.status = 400;
    return err;
  },
  forbidden: (msg: string) => {
    const err = new Error(msg) as any;
    err.status = 403;
    return err;
  },
  notFound: (msg: string) => {
    const err = new Error(msg) as any;
    err.status = 404;
    return err;
  },
  unauthorized: () => {
    const err = new Error("Unauthorized") as any;
    err.status = 401;
    return err;
  },
}));

import express from "express";
import request from "supertest";
import { openclawRoutes } from "../routes/openclaw.js";

function createApp() {
  const app = express();
  app.use(express.json());
  // Stub auth middleware
  app.use((req: any, _res: any, next: any) => {
    req.actor = { type: "board", userId: "board-user", source: "local_implicit" };
    next();
  });
  app.use("/api", openclawRoutes({} as any));
  // Simple error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status ?? 500).json({ error: err.message });
  });
  return app;
}

describe("OpenClaw routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/openclaw/health", () => {
    it("returns health data", async () => {
      mockOpenclawService.health.mockResolvedValue({
        gatewayStatus: "connected",
        gatewayUrl: "http://localhost:3100",
        configFound: true,
        workspacePath: "/tmp/workspace",
        checkedAt: "2026-03-20T00:00:00.000Z",
      });

      const app = createApp();
      const res = await request(app).get("/api/openclaw/health");

      expect(res.status).toBe(200);
      expect(res.body.gatewayStatus).toBe("connected");
      expect(res.body.configFound).toBe(true);
    });
  });

  describe("GET /api/openclaw/config", () => {
    it("returns config data", async () => {
      mockOpenclawService.config.mockResolvedValue({
        workspace: "/tmp/workspace",
        gateway: { url: "http://localhost", port: 3100 },
        agents: [{ id: "a1", name: "Bot", model: null, provider: null, status: "active" }],
      });

      const app = createApp();
      const res = await request(app).get("/api/openclaw/config");

      expect(res.status).toBe(200);
      expect(res.body.workspace).toBe("/tmp/workspace");
      expect(res.body.agents).toHaveLength(1);
    });
  });

  describe("GET /api/openclaw/agents", () => {
    it("returns agent statuses", async () => {
      mockOpenclawService.agents.mockResolvedValue([
        { id: "a1", name: "Bot", status: "active", currentTask: null, lastActiveAt: null },
      ]);

      const app = createApp();
      const res = await request(app).get("/api/openclaw/agents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe("Bot");
    });
  });

  describe("GET /api/openclaw/documents", () => {
    it("returns document list", async () => {
      mockOpenclawService.documents.mockResolvedValue([
        { id: "d1", filename: "test.md", relativePath: "test.md", sizeBytes: 100, modifiedAt: "2026-03-20T00:00:00Z", category: null, preview: null },
      ]);

      const app = createApp();
      const res = await request(app).get("/api/openclaw/documents");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].filename).toBe("test.md");
    });
  });

  describe("GET /api/openclaw/documents/content", () => {
    it("returns 400 without path parameter", async () => {
      const app = createApp();
      const res = await request(app).get("/api/openclaw/documents/content");

      expect(res.status).toBe(400);
    });

    it("returns document content", async () => {
      mockOpenclawService.documentContent.mockResolvedValue({
        relativePath: "test.md",
        content: "# Hello",
        sizeBytes: 7,
        modifiedAt: "2026-03-20T00:00:00Z",
      });

      const app = createApp();
      const res = await request(app).get("/api/openclaw/documents/content?path=test.md");

      expect(res.status).toBe(200);
      expect(res.body.content).toBe("# Hello");
    });

    it("returns 404 for missing document", async () => {
      mockOpenclawService.documentContent.mockResolvedValue(null);

      const app = createApp();
      const res = await request(app).get("/api/openclaw/documents/content?path=missing.md");

      expect(res.status).toBe(404);
    });
  });

  describe("PUT /api/openclaw/documents/content", () => {
    it("returns 400 without required fields", async () => {
      const app = createApp();
      const res = await request(app).put("/api/openclaw/documents/content").send({});

      expect(res.status).toBe(400);
    });

    it("saves document content", async () => {
      mockOpenclawService.documentWrite.mockResolvedValue({
        relativePath: "test.md",
        content: "# Updated",
        sizeBytes: 9,
        modifiedAt: "2026-03-20T00:00:00Z",
      });

      const app = createApp();
      const res = await request(app)
        .put("/api/openclaw/documents/content")
        .send({ path: "test.md", content: "# Updated" });

      expect(res.status).toBe(200);
      expect(res.body.content).toBe("# Updated");
    });
  });

  describe("GET /api/companies/:companyId/openclaw/usage", () => {
    it("returns usage data", async () => {
      mockOpenclawService.usage.mockResolvedValue({
        totalTokens: 10000,
        totalCostCents: 500,
        byModel: [],
        byAgent: [],
      });

      const app = createApp();
      const res = await request(app).get("/api/companies/comp-1/openclaw/usage");

      expect(res.status).toBe(200);
      expect(res.body.totalTokens).toBe(10000);
      expect(res.body.totalCostCents).toBe(500);
    });
  });

  describe("GET /api/companies/:companyId/openclaw/overview", () => {
    it("returns overview data", async () => {
      mockOpenclawService.overview.mockResolvedValue({
        health: { gatewayStatus: "connected", configFound: true },
        activeAgents: 3,
        totalAgents: 5,
        pendingApprovals: 2,
        todayStats: { completedTasks: 10, totalTokens: 50000, totalCostCents: 150 },
        riskAlerts: [],
        teamStatus: [],
      });

      const app = createApp();
      const res = await request(app).get("/api/companies/comp-1/openclaw/overview");

      expect(res.status).toBe(200);
      expect(res.body.activeAgents).toBe(3);
      expect(res.body.pendingApprovals).toBe(2);
    });
  });

  describe("GET /api/companies/:companyId/openclaw/memory/:agentId", () => {
    it("returns memory data for agent", async () => {
      mockOpenclawService.memory.mockResolvedValue({
        agentId: "a1",
        agentName: "Bot",
        memoryIndexExists: true,
        memoryIndexContent: "# Memory\n- entry 1",
        dailyNotes: [],
        memoryEntries: [],
        totalSizeBytes: 24,
        health: "healthy",
      });

      const app = createApp();
      const res = await request(app).get("/api/companies/comp-1/openclaw/memory/a1");

      expect(res.status).toBe(200);
      expect(res.body.agentName).toBe("Bot");
      expect(res.body.health).toBe("healthy");
    });
  });

  describe("GET /api/companies/:companyId/openclaw/collaboration", () => {
    it("returns collaboration events", async () => {
      mockOpenclawService.collaboration.mockResolvedValue([
        {
          id: "e1",
          timestamp: "2026-03-20T00:00:00Z",
          fromAgentId: "a1",
          fromAgentName: "Bot A",
          toAgentId: "a2",
          toAgentName: "Bot B",
          eventType: "message",
          summary: "task.assigned",
          parentSessionId: null,
          sessionId: null,
        },
      ]);

      const app = createApp();
      const res = await request(app).get("/api/companies/comp-1/openclaw/collaboration");

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].fromAgentName).toBe("Bot A");
    });

    it("passes agentId filter", async () => {
      mockOpenclawService.collaboration.mockResolvedValue([]);

      const app = createApp();
      await request(app).get("/api/companies/comp-1/openclaw/collaboration?agentId=a1&limit=25");

      expect(mockOpenclawService.collaboration).toHaveBeenCalledWith("comp-1", {
        agentId: "a1",
        limit: 25,
      });
    });
  });
});
