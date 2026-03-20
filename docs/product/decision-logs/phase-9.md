# Decision Log — Phase 9: Workflow-First Repositioning (2026-03-21)

PRD v2.0 repositioned the product from "multi-agent orchestration" to "workflow-first with process visibility."
This phase aligns the codebase with that shift.

## Changes Summary

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | UI | Reordered sidebar: Overview → Workflows → Projects → Team → Company → Settings | PRD v2.0 §2.0: "Workflow is first citizen." Workflows now appear immediately after Overview, before Projects. | Yes |
| 2 | UI | Added "Advanced" badge next to Team section in sidebar | PRD v2.0 §2.1: Team Member is deprioritized; most users should use workflow role labels instead. Badge signals this is a power-user feature. | Yes |
| 3 | schema | Added `role_label TEXT` column to `workflow_steps` table | PRD v2.0 §2.0 role metaphor: steps can optionally show a human-readable role (e.g. "写手", "主编") instead of "Step N." | Yes (nullable column, no data migration needed) |
| 4 | schema | Added migration `0043_add_role_label.sql` + journal entry | Follows existing Drizzle migration pattern. | Yes |
| 5 | types | Added `roleLabel` to `WorkflowStep`, `CreateWorkflowStepInput`, `WorkflowTemplateStep` | Ensures full-stack type safety for the new field. | Yes |
| 6 | constants | Added `WORKFLOW_DEFAULT_ROLE_LABELS` map (prompt→助手, skill→专家, approval→审核员, api→执行器) | PRD v2.0 default role labels for common step types. Used as placeholder suggestions in the editor. | Yes |
| 7 | server | Updated `workflows.ts` service to persist `roleLabel` when creating/updating steps | Both step-insert paths now include the field. | Yes |
| 8 | UI | Updated WorkflowEditor: added Role Label input field in step config, shows role label in step header | Allows users to assign roles to steps during editing. | Yes |
| 9 | UI | Rewrote WorkflowRunDetail with L3 step cards: progress bar, role avatars, colored borders, retry/skip/manual-fill buttons | PRD v2.0 §2.0.1: "v1 implements L3 step cards." Each step is a visually rich card showing role, status, timing, cost. Failed steps expose retry/skip/manual-fill actions. | Yes |
| 10 | UI | Rewrote Overview dashboard to be workflow-centric | PRD v2.0 §3.1: Dashboard shows active workflows, recent completions, pending approvals, quick stats (workflows today, success rate, avg duration, total cost). Removed team-member-centric stat cards. Risk alerts preserved with workflow context. | Yes |
| 11 | server | Added `workflowOverview` method to `dashboardService` | Queries active runs with step progress, recent completions, pending approval steps, and today's quick stats. Uses SQL aggregates for efficiency. | Yes |
| 12 | server | Added `GET /companies/:companyId/dashboard/workflow-overview` route | Matches existing dashboard route pattern. Protected by `assertCompanyAccess`. | Yes |
| 13 | types | Added `WorkflowDashboardOverview` + related types to shared package | Typed response for the new dashboard endpoint — activeRuns, recentCompletions, pendingApprovalSteps, quickStats. | Yes |
| 14 | UI | Added `dashboardApi.workflowOverview()` + `queryKeys.workflowOverview()` | Frontend API client for the new endpoint. Polls every 10s. | Yes |
| 15 | i18n | Added ~25 new translation keys to en.json and zh.json | Covers: sidebar.advanced, overview.workflowsToday/successRate/avgDuration/etc., pages.workflows.roleLabel/progressLabel/stepNumber/skipStep/manualFill/etc. | Yes |
| 16 | assumption | Removed "Work" section from sidebar, moved Issues/Goals under SidebarProjects | PRD v2.0 nav priority puts workflows standalone and projects absorb issues/goals. | Yes |
| 17 | tests | Added `phase9-workflow-dashboard.test.ts` with 11 tests | Covers: default role labels, step input shape, dashboard overview type shape, i18n key completeness for both en and zh. | Yes |

## Files Changed

### Data Layer
- `packages/db/src/schema/workflows.ts` — Added `roleLabel` column
- `packages/db/src/migrations/0043_add_role_label.sql` — Migration
- `packages/db/src/migrations/meta/_journal.json` — Journal entry
- `packages/shared/src/constants.ts` — `WORKFLOW_DEFAULT_ROLE_LABELS`
- `packages/shared/src/types/workflow.ts` — `roleLabel` on WorkflowStep, CreateWorkflowStepInput, WorkflowTemplateStep
- `packages/shared/src/types/dashboard.ts` — `WorkflowDashboardOverview` and related types
- `packages/shared/src/types/index.ts` — Re-exports
- `packages/shared/src/index.ts` — Re-exports

### Server
- `server/src/services/workflows.ts` — Persist roleLabel in step creation
- `server/src/services/dashboard.ts` — `workflowOverview()` method
- `server/src/routes/dashboard.ts` — New route

### Frontend
- `ui/src/components/Sidebar.tsx` — Nav reorder + Advanced badge
- `ui/src/pages/Overview.tsx` — Workflow-centric dashboard
- `ui/src/pages/WorkflowEditor.tsx` — Role label field
- `ui/src/pages/WorkflowRunDetail.tsx` — L3 step cards with progress bar
- `ui/src/api/dashboard.ts` — `workflowOverview()` client
- `ui/src/lib/queryKeys.ts` — New query key
- `ui/src/i18n/en.json` — New translations
- `ui/src/i18n/zh.json` — New translations

### Tests
- `server/src/__tests__/phase9-workflow-dashboard.test.ts` — 11 tests
