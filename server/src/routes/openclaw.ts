import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { openclawService } from "../services/openclaw.js";
import { assertCompanyAccess } from "./authz.js";
import { badRequest } from "../errors.js";

/**
 * OpenClaw observability API routes.
 *
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

  return router;
}
