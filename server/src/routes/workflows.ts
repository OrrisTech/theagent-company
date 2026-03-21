import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { workflowService } from "../services/workflows.js";
import type {
  CreateWorkflowInput,
  UpdateWorkflowInput,
  TriggerWorkflowInput,
  ApproveStepInput,
  ResumeWorkflowInput,
  WorkflowRunTrigger,
} from "@paperclipai/shared";

/**
 * Workflow API routes.
 *
 * GET    /workflows                         — list workflows for the actor's company
 * POST   /workflows                         — create a new workflow
 * GET    /workflows/:id                     — get workflow with latest version & steps
 * PUT    /workflows/:id                     — update workflow (optionally creates new version)
 * DELETE /workflows/:id                     — delete a workflow
 * POST   /workflows/:id/duplicate           — duplicate a workflow
 * GET    /workflows/:id/versions            — list all versions
 * GET    /workflows/:id/versions/:vid/steps — get steps for a specific version
 * POST   /workflows/:id/run                 — trigger a workflow run
 * GET    /workflows/:id/runs                — list runs for a workflow
 * GET    /workflows/runs/:runId             — get run detail with step runs
 * POST   /workflows/runs/:runId/cancel      — cancel a running workflow
 * POST   /workflows/runs/:runId/resume      — resume a failed/paused run
 * POST   /workflows/runs/:runId/debug       — continue debug execution
 * POST   /workflows/runs/:runId/steps/:stepRunId/approve — approve/reject a step
 * GET    /workflow-templates                — list available templates
 * POST   /workflow-templates/:id/import     — import a template as a new workflow
 */
export function workflowRoutes(db: Db) {
  const router = Router();
  const svc = workflowService(db);

  // Helper to get company ID from the actor context or query param
  function getCompanyId(req: Request): string {
    // Prefer explicit query param (set by frontend), then actor context
    if (req.query.companyId && typeof req.query.companyId === "string") {
      return req.query.companyId;
    }
    const actor = (req as unknown as { actor: { companyId?: string; companyIds?: string[] } }).actor;
    // Agent keys have singular companyId; board sessions have companyIds array
    return actor?.companyId ?? actor?.companyIds?.[0] ?? "";
  }

  function getUserId(req: Request): string | undefined {
    const actor = (req as unknown as { actor: { userId?: string } }).actor;
    return actor?.userId;
  }

  // -----------------------------------------------------------------------
  // Workflow CRUD
  // -----------------------------------------------------------------------

  // GET /workflows — list all workflows for the company
  router.get("/workflows", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) {
      res.status(400).json({ error: "Company context required" });
      return;
    }
    const result = await svc.list(companyId);
    res.json(result);
  });

  // POST /workflows — create a new workflow
  router.post("/workflows", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) {
      res.status(400).json({ error: "Company context required" });
      return;
    }
    const input = req.body as CreateWorkflowInput;
    if (!input.name || !input.steps) {
      res.status(400).json({ error: "name and steps are required" });
      return;
    }
    const result = await svc.create(companyId, input, getUserId(req));
    res.status(201).json(result);
  });

  // GET /workflows/:id — get workflow with latest version and steps
  router.get("/workflows/:id", async (req, res) => {
    const result = await svc.getWithLatestVersion(req.params.id!);
    res.json(result);
  });

  // PUT /workflows/:id — update workflow metadata and/or create new version
  router.put("/workflows/:id", async (req, res) => {
    const input = req.body as UpdateWorkflowInput;
    const result = await svc.update(req.params.id!, input);
    res.json(result);
  });

  // DELETE /workflows/:id — delete a workflow
  router.delete("/workflows/:id", async (req, res) => {
    await svc.delete(req.params.id!);
    res.json({ ok: true });
  });

  // POST /workflows/:id/duplicate — duplicate a workflow
  router.post("/workflows/:id/duplicate", async (req, res) => {
    const companyId = getCompanyId(req);
    const result = await svc.duplicate(req.params.id!, companyId);
    res.status(201).json(result);
  });

  // -----------------------------------------------------------------------
  // Version management
  // -----------------------------------------------------------------------

  // GET /workflows/:id/versions — list all versions
  router.get("/workflows/:id/versions", async (req, res) => {
    const result = await svc.listVersions(req.params.id!);
    res.json(result);
  });

  // GET /workflows/:id/versions/:vid/steps — get steps for a specific version
  router.get("/workflows/:id/versions/:vid/steps", async (req, res) => {
    const result = await svc.getVersionSteps(req.params.vid!);
    res.json(result);
  });

  // -----------------------------------------------------------------------
  // Execution
  // -----------------------------------------------------------------------

  // POST /workflows/:id/run — trigger a workflow run
  router.post("/workflows/:id/run", async (req, res) => {
    const companyId = getCompanyId(req);
    const input = req.body as TriggerWorkflowInput | undefined;
    const run = await svc.triggerRun(req.params.id!, companyId, "manual", input);
    res.status(201).json(run);
  });

  // GET /workflows/:id/runs — list runs for a workflow
  router.get("/workflows/:id/runs", async (req, res) => {
    const result = await svc.listRuns(req.params.id!);
    res.json(result);
  });

  // GET /workflows/runs/:runId — get run detail with step runs
  router.get("/workflows/runs/:runId", async (req, res) => {
    const result = await svc.getRun(req.params.runId!);
    res.json(result);
  });

  // POST /workflows/runs/:runId/cancel — cancel a running workflow
  router.post("/workflows/runs/:runId/cancel", async (req, res) => {
    await svc.cancelRun(req.params.runId!);
    res.json({ ok: true });
  });

  // POST /workflows/runs/:runId/resume — resume a failed/paused run
  router.post("/workflows/runs/:runId/resume", async (req, res) => {
    const input = req.body as ResumeWorkflowInput | undefined;
    await svc.resumeRun(req.params.runId!, input);
    res.json({ ok: true });
  });

  // POST /workflows/runs/:runId/debug — continue debug execution
  router.post("/workflows/runs/:runId/debug", async (req, res) => {
    const { pauseAtStep } = req.body as { pauseAtStep?: number };
    const result = await svc.debugContinue(req.params.runId!, pauseAtStep);
    res.json(result);
  });

  // POST /workflows/runs/:runId/steps/:stepRunId/approve — approve/reject
  router.post("/workflows/runs/:runId/steps/:stepRunId/approve", async (req, res) => {
    const input = req.body as ApproveStepInput;
    if (!input.decision || !["approved", "rejected"].includes(input.decision)) {
      res.status(400).json({ error: "decision must be 'approved' or 'rejected'" });
      return;
    }
    const userId = getUserId(req) ?? "unknown";
    await svc.approveStep(req.params.runId!, req.params.stepRunId!, userId, input);
    res.json({ ok: true });
  });

  // -----------------------------------------------------------------------
  // Templates
  // -----------------------------------------------------------------------

  // GET /workflow-templates — list available templates
  router.get("/workflow-templates", async (_req, res) => {
    const result = await svc.listTemplates();
    res.json(result);
  });

  // POST /workflow-templates/:id/import — import a template
  router.post("/workflow-templates/:id/import", async (req, res) => {
    const companyId = getCompanyId(req);
    const result = await svc.importTemplate(req.params.id!, companyId, getUserId(req));
    res.status(201).json(result);
  });

  return router;
}
