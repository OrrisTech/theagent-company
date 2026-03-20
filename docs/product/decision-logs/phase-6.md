# Decision Log — Phase 6: Team Collaboration Enhancement (2026-03-20)

## Summary

Phase 6 implements 8 major features to enhance team collaboration: agent-to-agent messaging, auto daily reports/standups, peer review mechanism, escalation protocol, notification center, performance dashboard, onboarding flow, and feedback loop.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | schema | Created 9 tables in a single schema file `collaboration.ts`: `team_messages`, `daily_reports`, `peer_reviews`, `escalation_rules`, `escalation_events`, `notifications`, `performance_snapshots`, `onboarding_flows`, `feedback_entries` | Grouping all Phase 6 tables in one file keeps them cohesive and easy to find. Each table has company_id FK for multi-tenant isolation. | Yes |
| 2 | schema | Used JSONB for flexible fields: `metadata` (messages), `trigger_config` (escalation), `steps` (onboarding), `suggested_update` (feedback), `channels` (notifications) | These fields have variable structure that would require separate tables otherwise. TypeScript types enforce shape at the app layer. | Yes |
| 3 | schema | `daily_reports.report_date` is text (YYYY-MM-DD) not a date type | Simplifies querying and avoids timezone issues. Same pattern used in `performance_snapshots.period_date`. | Yes |
| 4 | schema | `team_messages.parent_id` is a nullable UUID (self-referential) without FK constraint | Avoids circular FK issues. Application-level validation ensures parent exists when threading. | Yes |
| 5 | design | Single service file `collaboration.ts` covers all 8 features | Each feature is a clearly separated section within the service. Avoids creating 8 tiny files with repetitive patterns. Service factory pattern matches existing codebase convention. | Yes |
| 6 | design | Single route file `collaboration.ts` with all endpoints under `/collaboration/*` prefix | Clean URL structure. All Phase 6 endpoints share the same prefix for easy identification. Matches the PRD section 3.7 grouping. | Yes |
| 7 | design | Daily report generation aggregates from `issues` table directly | Real data integration — queries completed/in-progress/blocked issues for the agent. Future enhancement can add LLM summarization. | Yes |
| 8 | design | Escalation protocol uses a two-table design: `escalation_rules` (configuration) + `escalation_events` (instances) | Rules are configurable templates, events are actual escalation occurrences. This separation allows rules to be edited without affecting historical events. | Yes |
| 9 | design | Notifications use `userId = null` for broadcast notifications | A notification with no target user is visible to all company members. The query uses `OR(userId = :user, userId IS NULL)` to fetch both targeted and broadcast notifications. | Yes |
| 10 | design | Performance snapshots are pre-aggregated per-agent per-day | Avoids expensive real-time aggregation queries. A background job (future) will compute daily snapshots. Company-wide aggregates use `agentId = null`. | Yes |
| 11 | design | Onboarding flow uses JSONB array of step records | 4 default steps: receive_company_context, read_team_sops, meet_teammates, run_test_task. Steps are tracked inline rather than in a separate table to keep the schema simple. | Yes |
| 12 | design | Feedback loop stores `suggested_update` as JSONB | The system can auto-generate suggestions (future LLM integration) about what to change in the agent's soul, capabilities, or workflow. Human confirms before applying. | Yes |
| 13 | frontend | Three new pages: `Notifications`, `PerformanceDashboard`, `TeamCollaboration` | Notifications gets its own page (high-frequency use). Performance gets its own page (data-heavy dashboard). TeamCollaboration uses tab navigation to combine messaging, daily reports, peer reviews, escalations, onboarding, and feedback. | Yes |
| 14 | frontend | TeamCollaboration page uses client-side tab switching instead of separate routes | Keeps navigation simple and avoids route bloat. Data is fetched on tab activation via React Query. | Yes |
| 15 | i18n | Added ~60 i18n keys for Phase 6 across en.json and zh.json | All user-facing strings are translated. New keys added to the existing `pages` section with proper nesting. | Yes |
| 16 | setup | Manual SQL migration `0041_add_collaboration_tables.sql` | Consistent with Phase 5 approach. No running DB for drizzle-kit introspection. SQL matches Drizzle schema exactly. | Yes |
| 17 | setup | No new npm dependencies added | All functionality built using existing stack: Express, Drizzle ORM, React Query, Radix UI, lucide-react, i18next. | N/A |
| 18 | test | 15 constant validation tests + 8 type shape tests + 1 notification counts test | Verifies all new constants are correctly defined with expected values and lengths. Type tests ensure shared types are importable and match expected interfaces. | Yes |

## Files Created

| File | Purpose |
|---|---|
| `packages/db/src/schema/collaboration.ts` | Drizzle ORM schema for 9 collaboration tables |
| `packages/db/src/migrations/0041_add_collaboration_tables.sql` | SQL migration for all Phase 6 tables |
| `packages/shared/src/types/collaboration.ts` | Shared TypeScript types for all 8 features |
| `server/src/services/collaboration.ts` | Collaboration service: messaging, reports, reviews, escalation, notifications, performance, onboarding, feedback |
| `server/src/routes/collaboration.ts` | Express routes: 30+ endpoints under `/collaboration/*` |
| `ui/src/api/collaboration.ts` | Frontend API client for all collaboration endpoints |
| `ui/src/pages/Notifications.tsx` | Notification center page with filtering, read/dismiss actions |
| `ui/src/pages/PerformanceDashboard.tsx` | Performance dashboard with rate cards, metrics, and agent breakdown table |
| `ui/src/pages/TeamCollaboration.tsx` | Tabbed page for messaging, daily reports, peer reviews, escalations, onboarding, feedback |
| `server/src/__tests__/collaboration.test.ts` | Unit tests for constants and type definitions |

## Files Modified

| File | Change |
|---|---|
| `packages/shared/src/constants.ts` | Added 13 Phase 6 constant arrays and types (MESSAGE_STATUSES through ONBOARDING_STEP_STATUSES) |
| `packages/shared/src/types/index.ts` | Export all collaboration types |
| `packages/shared/src/index.ts` | Export collaboration constants and types |
| `packages/db/src/schema/index.ts` | Export 9 collaboration tables + OnboardingStepRecord type |
| `packages/db/src/migrations/meta/_journal.json` | Added migration 0041 entry |
| `server/src/services/index.ts` | Export collaborationService |
| `server/src/routes/index.ts` | Export collaborationRoutes |
| `server/src/app.ts` | Import and mount collaborationRoutes on API router |
| `ui/src/App.tsx` | Add routes for Notifications, PerformanceDashboard, TeamCollaboration pages |
| `ui/src/lib/queryKeys.ts` | Add collaboration query keys (12 key functions) |
| `ui/src/i18n/en.json` | Add ~60 Phase 6 i18n keys (notifications, performance, teamCollab sections) |
| `ui/src/i18n/zh.json` | Add ~60 Phase 6 i18n keys (Chinese translations) |
| `ui/src/i18n/i18n.test.ts` | Add new page keys to required pages list |

## Build & Test Results

- `pnpm build` — ✅ All packages build with zero errors
- `pnpm test:run` — ✅ 95 test files, 543 tests passed, 0 failed
- TypeScript `tsc --noEmit` — ✅ Zero type errors (verified via build)
