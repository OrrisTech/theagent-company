# Decision Log — Phase 3: OpenClaw Observability (2026-03-20)

## Summary

Phase 3 implements the OpenClaw observability layer: a data collection service that reads from the local filesystem (`~/.openclaw/openclaw.json` and workspace files), combined with The Agent Company's existing `cost_events` and `activity_log` data. Five placeholder pages are replaced with fully functional dashboards: Overview, Usage & Budget, Memory Management, Documents Workbench, and Collaboration Visualization.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | architecture | Created `openclawService` as a filesystem + DB hybrid service | OpenClaw config and workspace files live on disk (`~/.openclaw/`), while cost/activity data lives in The Agent Company's PostgreSQL. The service abstracts both sources behind a single API. | Yes |
| 2 | architecture | OpenClaw routes split into platform-level and company-scoped | Platform-level endpoints (health, config, documents) don't require a company context since they read from the shared filesystem. Company-scoped endpoints (usage, overview, collaboration) query per-company DB data. | Yes |
| 3 | security | Path traversal prevention in document read/write | `relative()` + `startsWith("..")` check ensures documents can only be accessed within the configured workspace directory. Prevents `../../etc/passwd` style attacks. | N/A |
| 4 | security | Document writes limited to existing files only | `documentWrite` refuses to create new files — only updates existing ones. Prevents arbitrary file creation on the server filesystem. | Yes |
| 5 | design | Gateway health check with 3s timeout | Uses `AbortController` with a 3-second timeout to avoid blocking the health endpoint if the gateway is unreachable. Returns "disconnected" on timeout/error, "unknown" if no gateway URL configured. | Yes |
| 6 | design | Overview dashboard auto-refreshes every 30s | Gateway health and team status are dynamic — 30s polling provides reasonable freshness without excessive load. Collaboration events poll at 15s for more real-time feel. | Yes |
| 7 | design | Risk alerts computed server-side, not stored | Budget warnings (>90% utilization), stalled agents (no heartbeat for 30min), and gateway down status are computed on each request. No new DB tables needed — uses existing `agents` and `costEvents` data. | Yes |
| 8 | design | Usage & Budget merges The Agent Company cost_events with OpenClaw usage | Instead of creating a separate usage tracking system, the `usage` endpoint queries the existing `cost_events` table with monthly aggregation. This ensures a single source of truth for all cost data. | Yes |
| 9 | design | Memory page uses agent list from DB + filesystem MEMORY.md | Memory files are read from the OpenClaw workspace. The agent list comes from TAC's `agents` table. Memory health is inferred: "healthy" = MEMORY.md exists, "degraded" = memory dir exists but no index, "missing" = neither. | Yes |
| 10 | design | Documents page groups by first path segment as "category" | Rather than introducing a separate categorization system, the first directory in the relative path serves as the category (e.g., `docs/` → category "docs"). Simple and requires no additional metadata. | Yes |
| 11 | design | Collaboration events derived from `activity_log` | Instead of creating a new `collaboration_events` table, we query the existing `activity_log` for agent-type actors and infer event types from action strings (assign→delegation, review→review, etc.). | Yes |
| 12 | types | Created 16 OpenClaw types in `packages/shared/src/types/openclaw.ts` | Central type definitions ensure type safety across server service, routes, API client, and UI pages. All types exported from the shared package root. | Yes |
| 13 | i18n | Added 5 new top-level i18n sections: overview, usage, memory, documents, collaboration | Phase 1 only had `pages.*.title/description`. Phase 3 pages need many more strings, so each gets its own section at the top level (matching sidebar/theme/branding pattern). | Yes |
| 14 | testing | Service tests mock filesystem + fetch, route tests mock service | Service tests verify config parsing, health checks, path traversal prevention, and graceful error handling. Route tests verify HTTP status codes, request/response contracts, and filter parameter passing. | N/A |
| 15 | assumption | Used `~/.openclaw/openclaw.json` as the config path | This is the conventional OpenClaw config location. Not configurable via env var in v1 — can be added later if needed. | Yes |
| 16 | assumption | Memory files use date-prefix convention for daily notes | Files matching `/^\d{4}-\d{2}-\d{2}/` are classified as "daily_note", others as "memory_entry". Follows the OpenClaw/Claude Code memory convention. | Yes |

## Files Created

### New files
- `packages/shared/src/types/openclaw.ts` — 16 OpenClaw type definitions
- `server/src/services/openclaw.ts` — OpenClaw data collection service (filesystem + DB)
- `server/src/routes/openclaw.ts` — 10 API endpoints for OpenClaw data
- `ui/src/api/openclaw.ts` — Frontend API client for OpenClaw endpoints
- `server/src/__tests__/openclaw-service.test.ts` — 10 service tests
- `server/src/__tests__/openclaw-routes.test.ts` — 14 route tests

### Modified files
- `packages/shared/src/types/index.ts` — Added OpenClaw type exports
- `packages/shared/src/index.ts` — Added OpenClaw types to root exports
- `server/src/services/index.ts` — Exported `openclawService`
- `server/src/routes/index.ts` — Exported `openclawRoutes`
- `server/src/app.ts` — Registered OpenClaw routes
- `ui/src/lib/queryKeys.ts` — Added `openclaw.*` query keys
- `ui/src/i18n/en.json` — Added 5 new sections with ~80 strings
- `ui/src/i18n/zh.json` — Added 5 matching Chinese sections
- `ui/src/i18n/i18n.test.ts` — Extended to verify Phase 3 i18n coverage
- `ui/src/pages/Overview.tsx` — Replaced placeholder with full dashboard
- `ui/src/pages/UsageBudget.tsx` — Replaced placeholder with usage/budget page
- `ui/src/pages/Memory.tsx` — Replaced placeholder with memory management
- `ui/src/pages/Documents.tsx` — Replaced placeholder with document workbench
- `ui/src/pages/Collaboration.tsx` — Replaced placeholder with collaboration timeline

## Verification

- `pnpm typecheck` — zero errors (all packages)
- `pnpm build` — builds successfully
- `pnpm test:run` — 92 test files passed, 491 tests passed
