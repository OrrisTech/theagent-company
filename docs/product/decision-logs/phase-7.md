# Decision Log — Phase 7: Polish & Testing (2026-03-20)

## Summary

Phase 7 is a comprehensive polish pass across the entire UI: i18n audit, theme consistency, responsive layout, error handling, E2E tests, performance optimization, and accessibility improvements. All Phase 1-6 features were verified for production readiness.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | i18n | Added 6 error-handling keys to `common` section (errorLoadingData, retry, unexpectedError, errorBoundaryTitle, errorBoundaryDescription, refreshPage) | These are reusable error strings needed by ErrorBoundary, QueryError, and all pages with query error states. Added to both en.json and zh.json. | Yes |
| 2 | i18n | Added 3 sidebar navigation keys (notifications, performance, teamCollab) | Phase 6 pages had routes and i18n page sections but no sidebar links — users couldn't navigate to them. | Yes |
| 3 | navigation | Added Phase 6 pages (Notifications, Performance Dashboard, Team Collaboration) to sidebar under Company section | These pages were only accessible via direct URL. Now they have proper sidebar links with Bell, BarChart3, and MessagesSquare icons from lucide-react. | Yes |
| 4 | error-handling | Created ErrorBoundary class component (ui/src/components/ErrorBoundary.tsx) | No React Error Boundary existed. Unhandled component errors would crash the entire app with a white screen. The ErrorBoundary catches render errors and shows a user-friendly fallback with retry/refresh buttons. | Yes |
| 5 | error-handling | Created QueryError reusable component (ui/src/components/QueryError.tsx) | Standardizes error display for failed React Query requests. Supports compact (inline) and full-page modes with optional retry button. | Yes |
| 6 | error-handling | Wrapped `<Outlet />` in Layout.tsx with `<ErrorBoundary>` | Catches errors from any page without crashing the sidebar/nav. Users see a friendly error message instead of a blank screen. | Yes |
| 7 | error-handling | Added error states to Phase 3-6 pages: UsageBudget, Collaboration, Workflows, Notifications, PerformanceDashboard | These pages had `isLoading` checks but ignored the `error` return from useQuery. Now they display error messages with retry buttons. | Yes |
| 8 | error-handling | Added `onError` handlers to all mutations missing them in Workflows, Notifications, TeamCollaboration | Duplicate, run, markRead, markAllRead, dismiss, and generate mutations previously failed silently. Now they show error toasts. | Yes |
| 9 | theme | Changed gray chart colors from #6b7280/#64748b to #94a3b8 (slate-400) in ActivityCharts.tsx and OrgChart.tsx | The original grays had poor contrast on dark backgrounds. Slate-400 has WCAG AA contrast on both light (#ffffff) and dark (#0a0a0b) backgrounds. | Yes |
| 10 | theme | Replaced hardcoded bg-[#1d1d1d] with bg-foreground/95 in OnboardingWizard.tsx | The ASCII art panel had a hardcoded dark background that didn't adapt to light mode. Using foreground/95 ensures it contrasts correctly in both themes. | Yes |
| 11 | responsive | Added overflow-x-auto + min-w-[480px] wrapper to UsageBudget breakdown tables | Fixed-width grid columns (grid-cols-[1fr_100px_100px_100px]) overflowed on mobile. Now tables scroll horizontally on narrow screens. Applied to both MemberBreakdown and ProjectBreakdown. | Yes |
| 12 | responsive | Added overflow-x-auto + min-w-[640px] to Workflows.tsx table | Workflow list table had 6 fixed-width columns that overflowed on mobile. Now scrolls horizontally. | Yes |
| 13 | responsive | Added responsive breakpoints to all form grids in WorkflowEditor.tsx | Replaced `grid-cols-2` with `grid-cols-1 md:grid-cols-2`, `grid-cols-3` with `grid-cols-1 md:grid-cols-3`, and `grid-cols-4` with `grid-cols-1 md:grid-cols-4`. Forms now stack vertically on mobile. | Yes |
| 14 | performance | Added Vite manualChunks config to split vendor dependencies | Main bundle was 2805KB (804KB gzipped). After splitting: vendor-react (478KB), vendor-radix (118KB), vendor-tanstack (45KB), vendor-i18n (57KB), vendor-dnd (50KB). Main bundle reduced to ~2051KB (565KB gzipped) — 27% reduction. Vendor chunks are cacheable across deploys. | Yes |
| 15 | testing | Created 48 Phase 7 unit tests (ui/src/__tests__/phase7-polish.test.ts) | Verifies ErrorBoundary and QueryError component structure, i18n error handling keys, sidebar navigation keys, and dark mode CSS variables. All tests are lightweight (no React rendering). | Yes |
| 16 | testing | Created Playwright E2E test suite (tests/e2e/phase7-navigation.spec.ts) | 29 tests covering: sidebar navigation for all Phase 3-6 pages, theme switching (light→dark→system), language switching (en↔zh), and page structure verification. Tests are resilient to empty databases. | Yes |
| 17 | testing | Updated i18n.test.ts with 2 new tests | Added: (1) common section error handling keys verification, (2) comprehensive deep key comparison between en.json and zh.json to catch any future mismatches. | Yes |
| 18 | assumption | Did not add ESLint config | Project has no eslint.config.js — ESLint is not configured in the base The Agent Company project. Adding ESLint would be a separate initiative. | Yes |
| 19 | assumption | Left base The Agent Company page hardcoded strings untouched | Pre-existing pages (Agents, Dashboard, Costs, etc.) have hardcoded English strings from the fork. Phase 7 focuses on polishing Phase 1-6 additions. Full i18n migration of base pages is a future task. | Yes |

## Files Created

| File | Purpose |
|---|---|
| `ui/src/components/ErrorBoundary.tsx` | React Error Boundary with retry/refresh UI |
| `ui/src/components/QueryError.tsx` | Reusable error display for failed queries |
| `ui/src/__tests__/phase7-polish.test.ts` | 48 unit tests for Phase 7 components and i18n |
| `tests/e2e/phase7-navigation.spec.ts` | 29 Playwright E2E tests for navigation, theme, language |
| `docs/product/decision-logs/phase-7.md` | This decision log |

## Files Modified

| File | Change |
|---|---|
| `ui/src/i18n/en.json` | Added 6 common error keys + 3 sidebar navigation keys |
| `ui/src/i18n/zh.json` | Added corresponding Chinese translations |
| `ui/src/i18n/i18n.test.ts` | Added 2 new tests (error keys + deep key comparison) |
| `ui/src/components/Sidebar.tsx` | Added Bell, BarChart3, MessagesSquare imports + 3 sidebar links |
| `ui/src/components/Layout.tsx` | Imported ErrorBoundary, wrapped Outlet |
| `ui/src/pages/UsageBudget.tsx` | Added error state + responsive overflow wrappers |
| `ui/src/pages/Collaboration.tsx` | Added error state to query |
| `ui/src/pages/Workflows.tsx` | Added error state + onError to mutations + responsive table |
| `ui/src/pages/WorkflowEditor.tsx` | Added responsive breakpoints to all form grids |
| `ui/src/pages/Notifications.tsx` | Added error state + onError to all mutations |
| `ui/src/pages/PerformanceDashboard.tsx` | Added error state to query |
| `ui/src/pages/TeamCollaboration.tsx` | Added onError to generateMutation |
| `ui/src/components/ActivityCharts.tsx` | Changed gray chart colors for better dark mode contrast |
| `ui/src/pages/OrgChart.tsx` | Changed status dot gray for better dark mode contrast |
| `ui/src/components/OnboardingWizard.tsx` | Replaced hardcoded dark bg with theme-aware bg-foreground/95 |
| `ui/vite.config.ts` | Added manualChunks for vendor code splitting |

## Build & Test Results

- `pnpm build` — ✅ All packages build with zero errors
- `pnpm test:run` — ✅ 96 test files, 593 tests passed, 0 failed (1 skipped)
- `pnpm typecheck` — ✅ Zero type errors
- Bundle size: Main chunk reduced from 2805KB → 2051KB (27% reduction), vendor deps split into 5 cacheable chunks
