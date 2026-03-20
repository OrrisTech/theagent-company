# Decision Log — Phase 5: Workflow System (2026-03-20)

## Summary

Phase 5 implements the full Workflow System — reusable SOP definitions with a list-style step editor, sequential execution engine, approval/condition/loop control flow, debug mode, checkpoint + resume, concurrency control, and execution history.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | schema | Created 6 tables: `workflows`, `workflow_versions`, `workflow_steps`, `workflow_runs`, `workflow_step_runs`, `workflow_templates` | Matches PRD §2.2 design. Versions are immutable snapshots; steps belong to versions. Runs and step_runs track execution. | Yes |
| 2 | schema | Used JSONB for step `config`, `input_refs`, `params`, `steps_json` columns | Step configs vary by type (9 types). JSONB gives flexibility without schema-per-type tables. TypeScript union types enforce shape at the app layer. | Yes |
| 3 | schema | `workflow_runs.cron_task_id` is a text field, not a FK | Cron tasks live in the OpenClaw config file (not in our DB), so we store the external ID as text. | Yes |
| 4 | design | List-style step editor (not drag-and-drop canvas) | PRD explicitly specifies list-style to reduce learning curve. Each step is an expandable card with type-specific config fields. | Yes |
| 5 | design | Version management — every save creates a new version | Immutable versions enable rollback and auditing. Version number auto-increments per workflow. | Yes |
| 6 | design | Sequential execution with `Map<stepIndex, output>` for data passing | Template refs like `{{step0.output}}` are resolved against the output map. Single-ref returns raw value; mixed-string does interpolation. | Yes |
| 7 | design | Approval steps pause the run (status → "paused") and wait for explicit `POST .../approve` | No polling — frontend auto-refreshes via `refetchInterval` when run is active. Approval rejection fails the entire run. | Yes |
| 8 | design | Condition steps use a simple expression evaluator (truthy check) | Full JS eval would be a security risk. The evaluator resolves template refs then checks truthiness. More complex expressions can be added later. | Yes |
| 9 | design | Loop steps execute body steps inline within the main loop | Loop output is an array of the last body step's output per iteration. `maxIterations` safety limit defaults to 100. | Yes |
| 10 | design | Debug mode — sets `debugPauseAtStep` and pauses before that step | User calls `POST .../debug` to continue. Can optionally set the next pause point. | Yes |
| 11 | design | Checkpoint + resume — `lastCheckpointStep` tracks progress | Failed runs can resume from the last checkpoint. User can also inject output for a failed step and retry. | Yes |
| 12 | design | Concurrency control — system-level (default 10) and agent-level (default 3) | Checked before creating a run. Returns 409 Conflict if limits exceeded. Limits are configurable per-workflow via `maxConcurrency`. | Yes |
| 13 | setup | Manual SQL migration (`0040_add_workflow_tables.sql`) instead of drizzle-kit generate | No running DB available for drizzle-kit introspection. Manual SQL matches the Drizzle schema exactly. Journal entry added. | Yes |
| 14 | setup | No new npm dependencies added | All functionality built using existing stack: Express, Drizzle ORM, React Query, Radix UI, lucide-react, i18next. | N/A |
| 15 | design | Step execution is currently placeholder (records input/config as output) | Real execution requires integration with agent engine (LLM calls), skill system, and HTTP client. The framework is in place — each step type has a case in the switch. | Yes |
| 16 | i18n | Added ~90 workflow-specific keys to both `en.json` and `zh.json` | Covers all UI strings: step types, run statuses, config labels, actions, empty states, toasts. Nested objects for `stepTypes`, `promptConfig`, etc. | Yes |
| 17 | test | i18n test updated to handle nested translation objects | Changed `Record<string, Record<string, string>>` cast to `Record<string, Record<string, unknown>>` to support nested step type translations. | Yes |

## Files Created

| File | Purpose |
|---|---|
| `packages/shared/src/types/workflow.ts` | Workflow domain types and API input/output shapes |
| `packages/db/src/schema/workflows.ts` | Drizzle ORM schema for 6 workflow tables |
| `packages/db/src/migrations/0040_add_workflow_tables.sql` | SQL migration for workflow tables |
| `server/src/services/workflows.ts` | Workflow service: CRUD, execution engine, approval, debug, resume, concurrency |
| `server/src/routes/workflows.ts` | Express routes: 17 endpoints for workflow management |
| `ui/src/api/workflows.ts` | Frontend API client for all workflow endpoints |
| `ui/src/pages/Workflows.tsx` | Workflow list page with status, run stats, actions menu |
| `ui/src/pages/WorkflowEditor.tsx` | Workflow editor with list-style step editor, type-specific config, execution history |
| `ui/src/pages/WorkflowRunDetail.tsx` | Run detail view with step timeline, approval actions, resume, debug controls |
| `server/src/__tests__/workflows.test.ts` | Unit tests for template resolution, constants, types |

## Files Modified

| File | Change |
|---|---|
| `packages/shared/src/constants.ts` | Added workflow status/type/trigger constants |
| `packages/shared/src/types/index.ts` | Export workflow types |
| `packages/shared/src/index.ts` | Export workflow constants and types |
| `packages/db/src/schema/index.ts` | Export workflow tables |
| `packages/db/src/migrations/meta/_journal.json` | Added migration 0040 entry |
| `server/src/services/index.ts` | Export workflowService |
| `server/src/routes/index.ts` | Export workflowRoutes |
| `server/src/app.ts` | Mount workflow routes on API router |
| `ui/src/App.tsx` | Add WorkflowEditor and WorkflowRunDetail routes |
| `ui/src/lib/queryKeys.ts` | Add workflow query keys |
| `ui/src/i18n/en.json` | Add ~90 workflow i18n keys |
| `ui/src/i18n/zh.json` | Add ~90 workflow i18n keys (Chinese) |
| `ui/src/i18n/i18n.test.ts` | Fix type cast for nested translations |

## Build & Test Results

- `pnpm build` — ✅ All packages build with zero errors
- `pnpm test:run` — ✅ 94 test files, 521 tests passed, 0 failed
- TypeScript `tsc --noEmit` — ✅ Zero type errors (verified via build)
