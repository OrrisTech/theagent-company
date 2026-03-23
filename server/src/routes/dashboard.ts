import { Router } from "express";
import type { Db } from "@theagentcompany/db";
import { dashboardService } from "../services/dashboard.js";
import { assertCompanyAccess } from "./authz.js";

export function dashboardRoutes(db: Db) {
  const router = Router();
  const svc = dashboardService(db);

  router.get("/companies/:companyId/dashboard", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const summary = await svc.summary(companyId);
    res.json(summary);
  });

  router.get("/companies/:companyId/dashboard/workflow-overview", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const overview = await svc.workflowOverview(companyId);
    res.json(overview);
  });

  return router;
}
