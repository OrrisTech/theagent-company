# The Agent Company — Claude Code Instructions

## Compact Summary

AI agent management platform. Monorepo: Express + React 19 + Drizzle + Vitest + pnpm.
See `rules/` for TypeScript, React, and testing conventions.
Product docs: `docs/product/PRD.md`, `docs/product/integration-plan.md`

## Build & Verify Commands

```bash
pnpm build          # Full build
pnpm test:run       # All tests
npx eslint .        # Lint
npx tsc --noEmit    # Type check
```

## Definition of Done (MANDATORY)

A feature is "complete" ONLY when ALL pass:
- [ ] Fully implemented — no mocks, stubs, placeholders, or TODOs
- [ ] `eslint` — zero errors
- [ ] `tsc --noEmit` — zero errors
- [ ] `pnpm build` — zero errors
- [ ] Unit tests (happy + edge), integration tests, E2E test
- [ ] `pnpm test:run` exits 0
- [ ] i18n: `en` + `zh` keys for all UI strings
- [ ] Error states handled, responsive (desktop + tablet), no console errors

❌ "API works but no tests" = NOT DONE
❌ "Tests pass but TypeScript errors" = NOT DONE
✅ Implemented + tested + typed + linted + builds + handles errors + i18n = DONE

## Autonomy & Decision-Making

- Solve everything autonomously. Ask the user only as last resort.
- For long tasks, use Ralph loop: implement → test → fix → repeat.
- When asking: mark recommended option with ⭐, proceed if no response.

## Decision Log (MANDATORY)

Every implementation session: log decisions, config changes, assumptions.
Report at session end as a table: `| # | Type | Decision | Reasoning | Reversible? |`

## Skill Writing

Follow `docs/product/skill-writing-guide.md`:
- Skills are folders; description = trigger condition; progressive disclosure via filesystem.

## Conventions

- Drizzle ORM for all DB ops
- Routes: `server/src/routes/` | Services: `server/src/services/`
- Pages: `ui/src/pages/` | Shared types: `packages/shared/`
- Follow Paperclip code style
