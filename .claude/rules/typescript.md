# TypeScript Conventions

- Strict mode enabled; no `any` without justification
- Use Drizzle ORM for all DB operations — no raw SQL
- Shared types go in `packages/shared/`
- API routes: `server/src/routes/`
- Services: `server/src/services/`
- Prefer existing libraries over custom implementations
- Prioritize by: GitHub stars > weekly downloads > last commit recency
- Only build custom when: (a) no suitable package exists, (b) unmaintained, or (c) integration cost > build cost
