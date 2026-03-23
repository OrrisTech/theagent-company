# Decision Log — Phase 4: OpenClaw Configuration + Unified Team Member Model (2026-03-20)

## Summary

Phase 4 implements two major feature sets:
1. **OpenClaw Configuration Management UI** — Four settings pages (Models, Channels, Skills, Cron) that read from and write back to `~/.openclaw/openclaw.json`, replacing placeholder pages with fully functional CRUD interfaces.
2. **Unified Team Member Model** — Extends the TAC `agents` DB table with `soul`, `identity_meta`, and `engine_type` fields, adds a 4-tab Team Member edit view (Identity, Organization, Capabilities, Engine) within the Agent Detail page, and enhances the Agents list to show engine labels.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | architecture | Config CRUD reads/writes directly to `~/.openclaw/openclaw.json` | OpenClaw config lives on disk, not in DB. The service abstracts the JSON file behind typed read/write methods. | Yes |
| 2 | security | API keys in model config are masked on read, preserved on write | Prevents leaking secrets to the frontend. When writing back, masked keys are replaced with the original from the existing config file. | N/A |
| 3 | architecture | Skills discovered from filesystem, enabled/disabled state in JSON | Skills are directories on disk (with SKILL.md), but the enabled/disabled toggle is stored in `openclaw.json.skills[]`. This separates discovery from configuration. | Yes |
| 4 | design | Cron next-run computed server-side using existing `parseCron` service | Reuses the cron parser from Phase 3's heartbeat system. Next run is computed on every read. | Yes |
| 5 | design | Cron validation happens on create/update, rejects invalid expressions | Uses `validateCron()` which returns a human-readable error message on invalid syntax. | N/A |
| 6 | schema | Added 3 new columns to `agents` table: `soul`, `identity_meta`, `engine_type` | These map directly to the PRD's 4-layer team member model. `soul` = personality (SOUL.md), `identity_meta` = extra identity JSON, `engine_type` = how storage is handled. | Yes |
| 7 | schema | `engine_type` defaults to "process" | Existing agents don't have an engine type, defaulting to "process" (the TAC-native adapter) preserves backward compatibility. | Yes |
| 8 | design | Team Member view added as a tab in AgentDetail, not a separate page | The existing AgentDetail page has extensive operational features (runs, budget, configuration). Adding "Team Member" as a new tab preserves all existing functionality while providing the unified 4-layer editing experience. | Yes |
| 9 | design | Team Member sub-tabs use in-page navigation (no URL routing) | The 4 sub-tabs (Identity, Organization, Capabilities, Engine) use React state, not URL-based routing. This keeps the URL structure simple and avoids creating a second routing layer. | Yes |
| 10 | design | Capabilities tab links to Skills/Channels/Cron settings pages | Rather than duplicating the skills/channels/cron UIs inline, the Capabilities tab provides navigation links. This follows the PRD's separation of concerns. | Yes |
| 11 | types | Added `AGENT_ENGINE_TYPES` constant and extended Zod schemas | Engine types are validated at the API boundary via `z.enum(AGENT_ENGINE_TYPES)`. The constant is exported from shared for use across server and UI. | Yes |
| 12 | types | 7 new OpenClaw types + 3 TeamMember types in shared package | `OpenClawModelConfig`, `OpenClawChannelConfig`, `OpenClawSkillEntry`, `OpenClawCronTask`, `OpenClawFullConfig`, `TeamMemberEngineType`, `TeamMemberIdentityMeta`, `TeamMember` | Yes |
| 13 | i18n | Added 6 new i18n sections: models, channels, skills, cron, teamMember | Each settings page and the team member view gets its own translation section. ~150 new strings per locale. | Yes |
| 14 | testing | 10 config service tests, 3 Phase 4 i18n tests | Service tests cover model CRUD (including key masking), channel parsing, skill discovery, cron CRUD (including validation rejection). i18n tests verify all Phase 4 sections exist in both locales with matching keys. | N/A |
| 15 | design | Engine label in agents list shows "engine · adapter" format | E.g., "OpenClaw · Process" or just "Claude" when engine and adapter overlap. Gives users a quick visual indicator of how each team member operates. | Yes |
| 16 | assumption | Config endpoints are platform-level (no company scope) | Models, channels, skills, and cron are stored in `~/.openclaw/openclaw.json` which is shared across all companies. This matches Phase 3's pattern for documents and health endpoints. | Yes |

## Files Created

### New files
- `packages/db/src/migrations/0039_add_team_member_fields.sql` — Migration for soul, identity_meta, engine_type columns
- `server/src/__tests__/openclaw-config.test.ts` — 10 service tests for Phase 4 config CRUD

### Modified files
- `packages/shared/src/types/openclaw.ts` — Added 7 config types + 3 team member types
- `packages/shared/src/types/index.ts` — Exported new types
- `packages/shared/src/types/agent.ts` — Added soul, identityMeta, engineType to Agent interface
- `packages/shared/src/constants.ts` — Added `AGENT_ENGINE_TYPES` constant
- `packages/shared/src/validators/agent.ts` — Added soul, identityMeta, engineType to create/update schemas
- `packages/shared/src/index.ts` — Re-exported new types and constants
- `packages/db/src/schema/agents.ts` — Added 3 new columns
- `packages/db/src/migrations/meta/_journal.json` — Registered migration 0039
- `server/src/services/openclaw.ts` — Added 11 config CRUD methods + 3 helper functions
- `server/src/routes/openclaw.ts` — Added 10 new API endpoints
- `ui/src/api/openclaw.ts` — Added 8 new API client methods
- `ui/src/lib/queryKeys.ts` — Added 4 new query keys
- `ui/src/i18n/en.json` — Added models, channels, skills, cron, teamMember sections (~150 strings)
- `ui/src/i18n/zh.json` — Added matching Chinese translations (~150 strings)
- `ui/src/i18n/i18n.test.ts` — Added 3 Phase 4 i18n verification tests
- `ui/src/pages/settings/ModelsSettings.tsx` — Replaced placeholder with full CRUD UI
- `ui/src/pages/settings/ChannelsSettings.tsx` — Replaced placeholder with full CRUD UI
- `ui/src/pages/settings/SkillsSettings.tsx` — Replaced placeholder with skill discovery + enable/disable
- `ui/src/pages/settings/CronSettings.tsx` — Replaced placeholder with cron task CRUD + next-run display
- `ui/src/pages/AgentDetail.tsx` — Added "Team Member" tab with 4-layer edit view
- `ui/src/pages/Agents.tsx` — Enhanced list with engine labels

## Verification

- `pnpm typecheck` — zero errors (all packages)
- `pnpm build` — builds successfully (all 20 packages)
- `pnpm test:run` — 93 test files passed, 507 tests passed (16 new tests)
