# The Agent Company — Claude Code Instructions

## Project

This is The Agent Company (theagent.company) — an AI agent management platform for business teams.
Forked from [Paperclip](https://github.com/paperclipai/paperclip), integrating features from Vibe-Kanban, OpenClaw Control Center, and ClawX.

Product docs: `docs/product/PRD.md`, `docs/product/integration-plan.md`, `docs/product/skill-writing-guide.md`

## Definition of Done (MANDATORY)

When reporting a feature as "complete", it MUST meet ALL of the following criteria.
**No exceptions. No shortcuts.**

### Code Quality
- [ ] Feature is **fully implemented** — no mocks, stubs, placeholders, or TODO comments in shipped code
- [ ] Code passes **lint check** (ESLint) with zero errors
- [ ] Code passes **type check** (TypeScript `tsc --noEmit`) with zero errors
- [ ] Code **builds successfully** (`pnpm build`) with zero errors

### Testing
- [ ] **Unit tests** — all new functions/modules have unit tests covering happy path + edge cases
- [ ] **Integration tests** — API routes and service interactions are tested end-to-end
- [ ] **E2E tests** — user-facing features have at least one end-to-end test verifying the full flow
- [ ] **Regression tests** — existing tests still pass after changes
- [ ] **Performance tests** — where applicable (DB queries, API endpoints, rendering), performance is verified acceptable
- [ ] All tests pass: `pnpm test:run` exits 0

### Production Readiness
- [ ] Feature works with **real data**, not just test fixtures
- [ ] Error states are handled gracefully (network errors, invalid input, timeouts)
- [ ] UI is responsive and works on desktop + tablet viewports
- [ ] i18n strings are added for both `en` and `zh` locales (when UI is involved)
- [ ] No console errors or warnings in browser dev tools
- [ ] Feature is accessible (keyboard navigation, screen reader basics)

### "Complete" means COMPLETE
- ❌ "I created the component but it doesn't fetch real data yet" — NOT DONE
- ❌ "The API is working but I haven't written tests" — NOT DONE
- ❌ "Tests pass but there are TypeScript errors" — NOT DONE
- ❌ "It works but the error handling is TODO" — NOT DONE
- ✅ "Feature is implemented, tested, typed, linted, builds clean, handles errors, works with real data, and a real user could use it right now" — DONE

## Autonomy & Decision-Making

### Do It Yourself
- **Solve everything you can autonomously.** You have CLI, plugins, MCP tools, and permissions — use them.
- Only ask the user for manual setup/config as an absolute last resort.
- If a task requires shell commands, file edits, API calls, git operations — just do it.
- For long-running tasks with clear expected output, use a Ralph loop (implement → test → fix → repeat until passing).

### When You Must Ask the User
- **Mark your recommended option** clearly (e.g., "⭐ Recommended: Option A")
- If the user doesn't respond within a reasonable time, **choose the recommended option and proceed**
- Always explain why you chose what you chose

### Decision Log (MANDATORY)
For every session that involves implementation work, maintain a decision log.
Record every:
- **Key decision** — what you chose and why (e.g., "Used drizzle migration instead of raw SQL because...")
- **Configuration change** — what config was modified, old value → new value
- **Setup action** — what was installed, created, or wired up
- **Assumption made** — when you proceeded without user input

At the end of each implementation session, **report the decision log to the user** so they can:
- Review what was done
- Audit the reasoning
- Roll back if needed

Format:
```
## Decision Log — [date/phase]

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | config | Set i18n default locale to "en" | Most common, zh added as secondary | Yes |
| 2 | setup | Installed i18next@25.x | Latest stable, compatible with React 19 | Yes |
| 3 | assumption | Used CSS variables for theming | Matches Paperclip's Tailwind setup | Yes |
```

## Code Philosophy

### Don't Reinvent the Wheel
- **Always prefer existing, well-maintained open-source libraries** over writing custom implementations
- Before writing any non-trivial utility, search for established packages (npm, GitHub) that solve the problem
- Prioritize by: **GitHub stars > weekly downloads > last commit recency** (as of current date: 2026-03)
- Check installed skills — if a skill already does what you need, use it
- Follow **current best practices** for the ecosystem (React 19, Node 22, Tailwind v4, etc.)
- When multiple options exist, prefer what the base project (Paperclip) already uses
- Only build custom when: (a) no suitable package exists, (b) the package is unmaintained, or (c) the integration cost exceeds the build cost

Examples:
- ✅ Use `i18next` for i18n (established, 7k+ stars)
- ✅ Use `dnd-kit` for drag & drop (already in Paperclip)
- ✅ Use `zustand` or `@tanstack/react-query` for state (already in ecosystem)
- ❌ Don't write a custom drag-and-drop system
- ❌ Don't write a custom i18n framework
- ❌ Don't write a custom date formatting library when `date-fns` or `dayjs` exists

## Tech Stack

- Backend: Node.js (Express), PostgreSQL (embedded or external), Drizzle ORM
- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query
- Testing: Vitest
- Package manager: pnpm (workspace monorepo)
- i18n: i18next + react-i18next (en + zh)

## Conventions

- Follow existing Paperclip code style and patterns
- Use Drizzle ORM for all DB operations
- API routes go in `server/src/routes/`
- Services go in `server/src/services/`
- React pages go in `ui/src/pages/`
- Shared types go in `packages/shared/`

## Skill Writing

When creating workflow templates or skills, follow `docs/product/skill-writing-guide.md`:
- Skills are folders, not just markdown files
- Description field is a trigger condition for the model, not a summary
- Use progressive disclosure via file system
- Build a Gotchas section from real failure points
- Avoid railroading — give goals and constraints, not rigid steps
