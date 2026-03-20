import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { collaborationService } from "../services/collaboration.js";
import type {
  SendMessageInput,
  CreatePeerReviewInput,
  SubmitPeerReviewInput,
  CreateEscalationRuleInput,
  UpdateEscalationRuleInput,
  ResolveEscalationInput,
  CreateNotificationInput,
  CreateFeedbackInput,
  ApplyFeedbackInput,
  StartOnboardingInput,
} from "@paperclipai/shared";

/**
 * Team Collaboration API routes.
 *
 * Covers: agent messaging, daily reports, peer reviews, escalation,
 * notification center, performance dashboard, onboarding, and feedback.
 */
export function collaborationRoutes(db: Db) {
  const router = Router();
  const svc = collaborationService(db);

  // Helper to extract actor context from the request
  function getCompanyId(req: Express.Request): string {
    const actor = (req as unknown as { actor: { companyId?: string } }).actor;
    return actor?.companyId ?? "";
  }

  function getUserId(req: Express.Request): string | undefined {
    const actor = (req as unknown as { actor: { userId?: string } }).actor;
    return actor?.userId;
  }

  // =========================================================================
  // 1. Agent-to-Agent Messaging
  // =========================================================================

  // GET /collaboration/messages — list messages
  router.get("/collaboration/messages", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listMessages(companyId, {
      agentId: req.query.agentId as string | undefined,
      withAgentId: req.query.withAgentId as string | undefined,
      issueId: req.query.issueId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json(result);
  });

  // POST /collaboration/messages — send a message
  router.post("/collaboration/messages", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const input = req.body as SendMessageInput & { fromAgentId: string };
    if (!input.fromAgentId) { res.status(400).json({ error: "fromAgentId is required" }); return; }

    const result = await svc.sendMessage(companyId, input.fromAgentId, input);
    res.status(201).json(result);
  });

  // PATCH /collaboration/messages/:id/read — mark message as read
  router.patch("/collaboration/messages/:id/read", async (req, res) => {
    const result = await svc.markMessageRead(req.params.id!);
    res.json(result);
  });

  // =========================================================================
  // 2. Daily Reports
  // =========================================================================

  // GET /collaboration/daily-reports — list daily reports
  router.get("/collaboration/daily-reports", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listDailyReports(companyId, {
      agentId: req.query.agentId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json(result);
  });

  // POST /collaboration/daily-reports/generate — generate reports for all agents
  router.post("/collaboration/daily-reports/generate", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const { agentId, reportDate } = req.body as { agentId?: string; reportDate?: string };
    const date = reportDate ?? new Date().toISOString().slice(0, 10);

    if (agentId) {
      const result = await svc.generateDailyReport(companyId, agentId, date);
      res.status(201).json(result);
    } else {
      const result = await svc.generateAllDailyReports(companyId, date);
      res.status(201).json(result);
    }
  });

  // =========================================================================
  // 3. Peer Reviews
  // =========================================================================

  // GET /collaboration/peer-reviews — list peer reviews
  router.get("/collaboration/peer-reviews", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listPeerReviews(companyId, {
      issueId: req.query.issueId as string | undefined,
      authorAgentId: req.query.authorAgentId as string | undefined,
      reviewerAgentId: req.query.reviewerAgentId as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json(result);
  });

  // POST /collaboration/peer-reviews — create a peer review
  router.post("/collaboration/peer-reviews", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.createPeerReview(companyId, req.body as CreatePeerReviewInput, getUserId(req));
    res.status(201).json(result);
  });

  // POST /collaboration/peer-reviews/:id/submit — submit review decision
  router.post("/collaboration/peer-reviews/:id/submit", async (req, res) => {
    const result = await svc.submitPeerReview(req.params.id!, req.body as SubmitPeerReviewInput);
    res.json(result);
  });

  // =========================================================================
  // 4. Escalation Protocol
  // =========================================================================

  // GET /collaboration/escalation-rules — list rules
  router.get("/collaboration/escalation-rules", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.listEscalationRules(companyId);
    res.json(result);
  });

  // POST /collaboration/escalation-rules — create rule
  router.post("/collaboration/escalation-rules", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.createEscalationRule(companyId, req.body as CreateEscalationRuleInput);
    res.status(201).json(result);
  });

  // PUT /collaboration/escalation-rules/:id — update rule
  router.put("/collaboration/escalation-rules/:id", async (req, res) => {
    const result = await svc.updateEscalationRule(req.params.id!, req.body as UpdateEscalationRuleInput);
    res.json(result);
  });

  // DELETE /collaboration/escalation-rules/:id — delete rule
  router.delete("/collaboration/escalation-rules/:id", async (req, res) => {
    const result = await svc.deleteEscalationRule(req.params.id!);
    res.json(result);
  });

  // GET /collaboration/escalations — list escalation events
  router.get("/collaboration/escalations", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listEscalationEvents(companyId, {
      status: req.query.status as string | undefined,
      sourceAgentId: req.query.sourceAgentId as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json(result);
  });

  // POST /collaboration/escalations/:id/resolve — resolve an escalation
  router.post("/collaboration/escalations/:id/resolve", async (req, res) => {
    const result = await svc.resolveEscalation(req.params.id!, req.body as ResolveEscalationInput, getUserId(req));
    res.json(result);
  });

  // =========================================================================
  // 5. Notification Center
  // =========================================================================

  // GET /collaboration/notifications — list notifications
  router.get("/collaboration/notifications", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listNotifications(companyId, {
      userId: getUserId(req),
      unreadOnly: req.query.unreadOnly === "true",
      type: req.query.type as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
    });
    res.json(result);
  });

  // GET /collaboration/notifications/counts — get unread counts
  router.get("/collaboration/notifications/counts", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.getNotificationCounts(companyId, getUserId(req));
    res.json(result);
  });

  // POST /collaboration/notifications — create notification (internal / admin)
  router.post("/collaboration/notifications", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.createNotification(companyId, req.body as CreateNotificationInput);
    res.status(201).json(result);
  });

  // PATCH /collaboration/notifications/:id/read — mark as read
  router.patch("/collaboration/notifications/:id/read", async (req, res) => {
    const result = await svc.markNotificationRead(req.params.id!);
    res.json(result);
  });

  // POST /collaboration/notifications/read-all — mark all as read
  router.post("/collaboration/notifications/read-all", async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    if (!companyId || !userId) { res.status(400).json({ error: "Company and user context required" }); return; }
    const result = await svc.markAllNotificationsRead(companyId, userId);
    res.json(result);
  });

  // PATCH /collaboration/notifications/:id/dismiss — dismiss notification
  router.patch("/collaboration/notifications/:id/dismiss", async (req, res) => {
    const result = await svc.dismissNotification(req.params.id!);
    res.json(result);
  });

  // =========================================================================
  // 6. Performance Dashboard
  // =========================================================================

  // GET /collaboration/performance — get performance summary
  router.get("/collaboration/performance", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.getPerformanceSummary(companyId, {
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    });
    res.json(result);
  });

  // GET /collaboration/performance/snapshots — list performance history
  router.get("/collaboration/performance/snapshots", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listPerformanceSnapshots(companyId, {
      agentId: req.query.agentId as string | undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json(result);
  });

  // =========================================================================
  // 7. Onboarding
  // =========================================================================

  // GET /collaboration/onboarding — list all onboarding flows
  router.get("/collaboration/onboarding", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.listOnboardingFlows(companyId);
    res.json(result);
  });

  // GET /collaboration/onboarding/:agentId — get onboarding flow for an agent
  router.get("/collaboration/onboarding/:agentId", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const result = await svc.getOnboardingFlow(companyId, req.params.agentId!);
    res.json(result);
  });

  // POST /collaboration/onboarding — start onboarding for an agent
  router.post("/collaboration/onboarding", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }
    const { agentId } = req.body as StartOnboardingInput;
    if (!agentId) { res.status(400).json({ error: "agentId is required" }); return; }
    const result = await svc.startOnboarding(companyId, agentId);
    res.status(201).json(result);
  });

  // PATCH /collaboration/onboarding/:flowId/steps/:stepName — update step status
  router.patch("/collaboration/onboarding/:flowId/steps/:stepName", async (req, res) => {
    const { status, detail } = req.body as { status: string; detail?: string };
    if (!status) { res.status(400).json({ error: "status is required" }); return; }
    const result = await svc.updateOnboardingStep(req.params.flowId!, req.params.stepName!, status, detail);
    res.json(result);
  });

  // =========================================================================
  // 8. Feedback Loop
  // =========================================================================

  // GET /collaboration/feedback — list feedback entries
  router.get("/collaboration/feedback", async (req, res) => {
    const companyId = getCompanyId(req);
    if (!companyId) { res.status(400).json({ error: "Company context required" }); return; }

    const result = await svc.listFeedback(companyId, {
      agentId: req.query.agentId as string | undefined,
      category: req.query.category as string | undefined,
      status: req.query.status as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
    });
    res.json(result);
  });

  // POST /collaboration/feedback — create feedback
  router.post("/collaboration/feedback", async (req, res) => {
    const companyId = getCompanyId(req);
    const userId = getUserId(req);
    if (!companyId || !userId) { res.status(400).json({ error: "Company and user context required" }); return; }

    const result = await svc.createFeedback(companyId, userId, req.body as CreateFeedbackInput);
    res.status(201).json(result);
  });

  // POST /collaboration/feedback/:id/apply — accept or reject feedback suggestion
  router.post("/collaboration/feedback/:id/apply", async (req, res) => {
    const result = await svc.applyFeedback(req.params.id!, req.body as ApplyFeedbackInput);
    res.json(result);
  });

  return router;
}
