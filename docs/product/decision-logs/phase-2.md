# Decision Log — Phase 2: Kanban Board (2026-03-20)

## Summary

Phase 2 adds a Kanban board view to the project page. Issues can be dragged between columns to change their status. The board maps issue statuses to meaningful columns per the PRD, with i18n support for English and Chinese.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | architecture | Created `ui/src/lib/kanban.ts` as a pure-logic module separate from UI | Keeps kanban logic (column definitions, grouping, drop resolution) testable without React/DOM dependencies. The KanbanBoard component imports and wires these functions. | Yes |
| 2 | design | Default columns: To Do (backlog+todo), In Progress, Review, Done, Blocked, Cancelled | PRD specifies 4 main columns. Added Blocked and Cancelled so issues in those states remain visible and can be dragged back to active columns. | Yes |
| 3 | design | `backlog` and `todo` statuses merge into one "To Do" column | PRD section 2.3: "To Do (backlog/todo)". Dropping into the column assigns `todo` as the defaultStatus (more intentional than `backlog`). | Yes |
| 4 | architecture | `KanbanColumnDef` type with `id`, `statuses[]`, `defaultStatus` | Supports custom column configurations. Users can pass their own column definitions via the `columns` prop, enabling future "custom columns" feature without refactoring. | Yes |
| 5 | architecture | Board is a separate tab, not replacing the list/board toggle in IssuesList | The existing IssuesList board toggle shows all 7 statuses as raw columns — useful for power users. The new Board tab provides the PRD-specified grouped view. Both coexist. | Yes |
| 6 | routing | Added `/projects/:projectId/board` route | Follows the existing pattern for project tabs: `/overview`, `/issues`, `/configuration`, `/budget`. Tab state cached to localStorage. | Yes |
| 7 | ui | KanbanCard now shows labels (up to 3 with +N overflow) | PRD section 2.3: "Kanban cards should show: assignee, priority, labels, title". Existing KanbanBoard only had priority and assignee. | Yes |
| 8 | a11y | Added `KeyboardSensor` to dnd-kit sensors | Enables keyboard-driven drag-and-drop for accessibility. Added `role="region"` on columns and `role="listitem"` on cards. | Yes |
| 9 | i18n | All kanban strings use `kanban.*` namespace in i18n JSON | Column names, tab labels, and helper text all have en/zh translations. Column label resolution falls back to title-cased id when i18n key is missing. | Yes |
| 10 | i18n | Project tab labels now use i18n (`kanban.tabs.*`) | Previously hardcoded English strings ("Issues", "Overview", etc.). Now all five tabs are translated. | Yes |
| 11 | testing | Unit tests in `kanban.test.ts`, integration tests in `KanbanBoard.test.ts` | Unit tests cover column definitions, grouping, and drop resolution. Integration tests simulate full drag-and-drop workflows (multi-step status flows). | Yes |
| 12 | assumption | Reused existing `ProjectIssuesList` data fetching pattern for `ProjectKanbanBoard` | Same queries (issues, agents, liveRuns), same mutation. Keeps API calls consistent. Could be extracted to a shared hook later if needed. | Yes |

## Files Created

### New files
- `ui/src/lib/kanban.ts` — Pure kanban logic: column definitions, grouping, drop resolution
- `ui/src/lib/kanban.test.ts` — Unit tests for kanban logic (14 tests)
- `ui/src/components/KanbanBoard.test.ts` — Integration tests for drag-and-drop flows (11 tests)

### Modified files
- `ui/src/components/KanbanBoard.tsx` — Enhanced: column mapping via `KanbanColumnDef`, labels display, i18n, keyboard sensor, custom columns prop
- `ui/src/pages/ProjectDetail.tsx` — Added Board tab, `ProjectKanbanBoard` component, i18n for tab labels
- `ui/src/App.tsx` — Added `/projects/:projectId/board` route (both prefixed and unprefixed)
- `ui/src/i18n/en.json` — Added `kanban` section with tabs, columns, empty, dragHint
- `ui/src/i18n/zh.json` — Added `kanban` section with Chinese translations

## Verification

- `pnpm typecheck` — zero errors
- `pnpm test:run` — 90 test files passed, 466 tests passed
- `pnpm build` — builds successfully
