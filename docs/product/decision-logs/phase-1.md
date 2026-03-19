# Decision Log — Phase 1: Foundation Setup (2026-03-20)

## Summary

Phase 1 establishes the foundational infrastructure for The Agent Company: i18n, theme switching, branding configuration, and the new sidebar navigation matching the PRD structure.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | setup | Installed `i18next`, `react-i18next`, `i18next-browser-languagedetector` | i18next is the PRD-specified i18n framework. Browser language detector enables automatic locale detection. | Yes |
| 2 | config | Set i18n default locale to `en` with `zh` as secondary | Matches PRD requirement. English is the most common default, Chinese added as the first localization. | Yes |
| 3 | config | Used `localStorage` key `paperclip.language` for language persistence | Follows the existing `paperclip.*` localStorage naming convention used by `paperclip.theme` and `paperclip.selectedCompanyId`. | Yes |
| 4 | architecture | Extended ThemeContext to support `system` mode (light/dark/system) | PRD section 4.7 specifies "Light Mode / Dark Mode / System Follow". Added `preference` (user choice) vs `theme` (resolved value) distinction to maintain backward compatibility. | Yes |
| 5 | architecture | Theme toggle cycles: light → dark → system → light | Maintains the existing `toggleTheme` API for backward compatibility while adding the new `setPreference` method for explicit control. | Yes |
| 6 | config | Used `localStorage` key `paperclip.theme` for theme persistence (unchanged) | Preserves backward compatibility with existing installations. Now stores "light", "dark", or "system". | Yes |
| 7 | schema | Created `branding_config` table as singleton pattern | Single row stores global branding (app name, logo, primary color, favicon). Simpler than per-company branding which isn't needed for v1. Migration seeds the default row. | Yes |
| 8 | schema | Migration file `0038_add_branding_config.sql` with manual journal entry | Drizzle-kit generate requires a running DB. Manual SQL + journal entry follows the same format as existing migrations. | Yes |
| 9 | api | Created `GET/PUT /api/branding` endpoints without auth guard | Branding is a global singleton config. In v1 (local_trusted mode), no auth required. When authenticated mode is added, the board mutation guard already applies to PUT requests. | Yes |
| 10 | api | Primary color validated as `#RRGGBB` hex format | Standard web color format. Prevents invalid CSS values from being stored. | Yes |
| 11 | navigation | Restructured sidebar to match PRD section 四 navigation spec | Replaced Paperclip's Dashboard/Work/Company sections with Overview + Projects + Team (Members/Org Chart) + Work (Workflows/Issues/Goals) + Company (Usage & Budget/Documents/Memory/Collaboration/Activity) + Settings (7 sub-pages). | Yes |
| 12 | navigation | Settings sub-pages as direct sidebar items (not nested dropdown) | Reduces click depth for frequently accessed settings. Each sub-page has its own route under `/settings/*`. | Yes |
| 13 | pages | Created 12 placeholder pages for not-yet-implemented features | Each shows a title, description, and "Coming Soon" badge. All strings are i18n-ready. Prevents 404s when navigating the new sidebar. | Yes |
| 14 | pages | Branding and Language settings are fully functional (not placeholders) | These are Phase 1 deliverables. Branding reads/writes to DB via API. Language switches i18next locale instantly. | N/A |
| 15 | components | Created `LanguageSwitcher` (compact button + full selector) | Compact button goes in sidebar footer (cycles languages), full selector for settings page (shows all options). | Yes |
| 16 | components | Created `ThemeSwitcherButton` (compact) + `ThemeSelector` (full) | Same pattern as LanguageSwitcher. Button replaces the old Moon/Sun toggle in Layout footer. | Yes |
| 17 | components | Created reusable `PlaceholderPage` component | Generic placeholder that takes i18n keys for title and description. Avoids duplicating the placeholder layout across 12 pages. | Yes |
| 18 | assumption | Kept existing routes (Dashboard, Issues, Goals, Costs, etc.) alongside new ones | No breaking changes to existing navigation. The `/dashboard` route still works. New sidebar points to `/dashboard` as the "Overview" item. | Yes |
| 19 | assumption | Used co-located test files (next to source) | Follows the existing project pattern (e.g., `inbox.test.ts` next to `inbox.ts`). | Yes |

## Files Created

### New files
- `ui/src/i18n/index.ts` — i18n configuration
- `ui/src/i18n/en.json` — English translations
- `ui/src/i18n/zh.json` — Chinese translations
- `ui/src/components/LanguageSwitcher.tsx` — Language switching components
- `ui/src/components/ThemeSwitcher.tsx` — Theme switching components
- `ui/src/components/PlaceholderPage.tsx` — Reusable placeholder page
- `ui/src/pages/Overview.tsx` — Overview placeholder
- `ui/src/pages/Workflows.tsx` — Workflows placeholder
- `ui/src/pages/UsageBudget.tsx` — Usage & Budget placeholder
- `ui/src/pages/Documents.tsx` — Documents placeholder
- `ui/src/pages/Memory.tsx` — Memory placeholder
- `ui/src/pages/Collaboration.tsx` — Collaboration placeholder
- `ui/src/pages/settings/ModelsSettings.tsx` — Models settings placeholder
- `ui/src/pages/settings/ChannelsSettings.tsx` — Channels settings placeholder
- `ui/src/pages/settings/SkillsSettings.tsx` — Skills settings placeholder
- `ui/src/pages/settings/CronSettings.tsx` — Cron settings placeholder
- `ui/src/pages/settings/SecuritySettings.tsx` — Security settings placeholder
- `ui/src/pages/settings/LanguageSettings.tsx` — Language settings (functional)
- `ui/src/pages/settings/BrandingSettings.tsx` — Branding settings (functional)
- `ui/src/api/branding.ts` — Branding API client
- `packages/db/src/schema/branding_config.ts` — Drizzle schema
- `packages/db/src/migrations/0038_add_branding_config.sql` — Migration
- `server/src/routes/branding.ts` — Branding API route
- `ui/src/i18n/i18n.test.ts` — i18n translation tests
- `ui/src/context/ThemeContext.test.ts` — Theme context tests
- `server/src/__tests__/branding-routes.test.ts` — Branding route tests

### Modified files
- `ui/package.json` — Added i18next dependencies
- `ui/src/main.tsx` — Added `import "./i18n"`
- `ui/src/context/ThemeContext.tsx` — Extended with system mode support
- `ui/src/components/Sidebar.tsx` — Restructured navigation per PRD
- `ui/src/components/Layout.tsx` — Replaced theme toggle with ThemeSwitcherButton + LanguageSwitcher
- `ui/src/App.tsx` — Added routes for all new pages
- `server/src/app.ts` — Registered branding routes
- `server/src/routes/index.ts` — Exported branding routes
- `packages/db/src/schema/index.ts` — Exported branding_config schema
- `packages/db/src/migrations/meta/_journal.json` — Added migration entry
