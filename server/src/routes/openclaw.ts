import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { openclawService } from "../services/openclaw.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";

/**
 * OpenClaw observability + configuration API routes.
 *
 * -- Observability (Phase 3) --
 * GET  /openclaw/health              — gateway health check
 * GET  /openclaw/config              — read openclaw.json
 * GET  /openclaw/agents              — runtime agent status
 * GET  /companies/:companyId/openclaw/usage       — usage data
 * GET  /companies/:companyId/openclaw/overview     — dashboard overview
 * GET  /companies/:companyId/openclaw/memory/:agentId — memory for an agent
 * GET  /companies/:companyId/openclaw/collaboration — collaboration events
 * GET  /openclaw/documents           — list workspace documents
 * GET  /openclaw/documents/content   — read document content
 * PUT  /openclaw/documents/content   — write document content
 *
 * -- Configuration (Phase 4) --
 * GET  /openclaw/models              — list model configs
 * PUT  /openclaw/models              — update model configs
 * GET  /openclaw/channels            — list channel configs
 * PUT  /openclaw/channels            — update channel configs
 * GET  /openclaw/skills              — list skills
 * PATCH /openclaw/skills/:id         — enable/disable a skill
 * GET  /openclaw/cron                — list cron tasks
 * POST /openclaw/cron                — create a cron task
 * PUT  /openclaw/cron/:id            — update a cron task
 * DELETE /openclaw/cron/:id          — delete a cron task
 */
export function openclawRoutes(db: Db) {
  const router = Router();
  const svc = openclawService(db);

  // --- Platform-level endpoints (no company scope) ---

  router.get("/openclaw/health", async (_req, res) => {
    const health = await svc.health();
    res.json(health);
  });

  router.get("/openclaw/config", async (_req, res) => {
    const config = await svc.config();
    res.json(config);
  });

  router.get("/openclaw/agents", async (_req, res) => {
    const agentStatuses = await svc.agents();
    res.json(agentStatuses);
  });

  router.get("/openclaw/documents", async (_req, res) => {
    const docs = await svc.documents();
    res.json(docs);
  });

  router.get("/openclaw/documents/content", async (req, res) => {
    const relativePath = req.query.path as string | undefined;
    if (!relativePath) {
      throw badRequest("'path' query parameter is required");
    }
    const doc = await svc.documentContent(relativePath);
    if (!doc) {
      res.status(404).json({ error: "Document not found" });
      return;
    }
    res.json(doc);
  });

  router.put("/openclaw/documents/content", async (req, res) => {
    const { path: relativePath, content } = req.body as {
      path?: string;
      content?: string;
    };

    if (!relativePath || typeof content !== "string") {
      throw badRequest("'path' and 'content' are required");
    }

    const doc = await svc.documentWrite(relativePath, content);
    if (!doc) {
      res.status(404).json({ error: "Document not found or path not writable" });
      return;
    }
    res.json(doc);
  });

  // --- Company-scoped endpoints ---

  router.get("/companies/:companyId/openclaw/usage", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const usage = await svc.usage(companyId);
    res.json(usage);
  });

  router.get("/companies/:companyId/openclaw/overview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const overview = await svc.overview(companyId);
    res.json(overview);
  });

  router.get("/companies/:companyId/openclaw/memory/:agentId", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const agentId = req.params.agentId as string;
    const memory = await svc.memory(agentId);
    res.json(memory);
  });

  router.get("/companies/:companyId/openclaw/collaboration", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const agentId = req.query.agentId as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const events = await svc.collaboration(companyId, { agentId, limit });
    res.json(events);
  });

  // --- Phase 4: Configuration management endpoints ---

  // Models
  router.get("/openclaw/models", async (_req, res) => {
    const models = await svc.models();
    res.json(models);
  });

  router.put("/openclaw/models", async (req, res) => {
    const models = req.body as unknown[];
    if (!Array.isArray(models)) {
      throw badRequest("Request body must be an array of model configurations");
    }
    const updated = await svc.updateModels(models as Parameters<typeof svc.updateModels>[0]);
    res.json(updated);
  });

  // Channels
  router.get("/openclaw/channels", async (_req, res) => {
    const channels = await svc.channels();
    res.json(channels);
  });

  router.put("/openclaw/channels", async (req, res) => {
    const channels = req.body as unknown[];
    if (!Array.isArray(channels)) {
      throw badRequest("Request body must be an array of channel configurations");
    }
    const updated = await svc.updateChannels(channels as Parameters<typeof svc.updateChannels>[0]);
    res.json(updated);
  });

  // Skills
  router.get("/openclaw/skills", async (_req, res) => {
    const skills = await svc.skills();
    res.json(skills);
  });

  router.patch("/openclaw/skills/:id", async (req, res) => {
    const skillId = req.params.id as string;
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== "boolean") {
      throw badRequest("'enabled' boolean field is required");
    }
    await svc.updateSkillEnabled(skillId, enabled);
    res.json({ id: skillId, enabled });
  });

  // Cron tasks
  router.get("/openclaw/cron", async (_req, res) => {
    const tasks = await svc.cronTasks();
    res.json(tasks);
  });

  router.post("/openclaw/cron", async (req, res) => {
    const { name, expression, command, agentId, agentName, enabled } = req.body as {
      name?: string;
      expression?: string;
      command?: string;
      agentId?: string;
      agentName?: string;
      enabled?: boolean;
    };
    if (!name || !expression || !command) {
      throw badRequest("'name', 'expression', and 'command' are required");
    }
    try {
      const task = await svc.createCronTask({
        name,
        expression,
        command,
        agentId,
        agentName,
        enabled: enabled ?? true,
      });
      res.status(201).json(task);
    } catch (err) {
      throw badRequest((err as Error).message);
    }
  });

  router.put("/openclaw/cron/:id", async (req, res) => {
    const id = req.params.id as string;
    try {
      const updated = await svc.updateCronTask(id, req.body as Record<string, unknown>);
      if (!updated) {
        res.status(404).json({ error: "Cron task not found" });
        return;
      }
      res.json(updated);
    } catch (err) {
      throw badRequest((err as Error).message);
    }
  });

  router.delete("/openclaw/cron/:id", async (req, res) => {
    const id = req.params.id as string;
    const deleted = await svc.deleteCronTask(id);
    if (!deleted) {
      res.status(404).json({ error: "Cron task not found" });
      return;
    }
    res.json({ success: true });
  });

  return router;
}
