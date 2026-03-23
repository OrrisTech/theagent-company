# Testing Requirements

- Framework: Vitest
- All new functions/modules need unit tests (happy path + edge cases)
- API routes need integration tests
- User-facing features need at least one E2E test
- Existing tests must pass after changes: `pnpm test:run` exits 0
- Performance tests where applicable (DB queries, API endpoints, rendering)
