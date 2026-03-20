# Decision Log — Phase 8: Agent Engineering Hardening (2026-03-20)

## Summary

Phase 8 hardens the agent engineering infrastructure based on gaps identified from "你不知道的 Agent：原理、架构与工程实践". All 8 sub-items implemented: CI pipeline, eval framework, context compression, soul layer injection, source-sink security, provider fallback, skills ACI format, and event stream tracing.

## Decisions

| # | Type | Decision | Reasoning | Reversible? |
|---|---|---|---|---|
| 1 | setup | Created `.github/workflows/ci.yml` with build → typecheck → test pipeline | DoD was only in docs — now enforced on every push and PR to master. Modeled after existing `pr-verify.yml` but simplified (no canary dry run). | Yes |
| 2 | setup | Created `tests/eval/` directory with vitest config, runner, and 3 seed eval files (17 cases) | Eval framework needed for measuring agent capabilities. Used vitest (already in project) rather than a custom runner. Separate from main tests via `pnpm eval:run`. | Yes |
| 3 | design | Eval runner distinguishes capability (pass@k) vs regression (pass^k) tests | Capability tests: any pass = success. Regression tests: all must pass. This matches the book's recommendation for different test philosophies. | Yes |
| 4 | schema | Added `retention_priority` text column to `workflow_steps` table | Needed per-step compression priority config. Text column with default "medium" — lightweight change, no migration complexity. | Yes |
| 5 | design | Context compression uses priority-weighted budget: critical=4x, high=2x, medium=1x, low=0.25x | Ensures architectural decisions (critical) survive compression while raw tool output (low) can be aggressively compressed. Default budget: 100k total, 10k per step. | Yes |
| 6 | design | Compression strategy: JSON objects preserve keys/structure, strings keep head+tail with marker | Head-heavy split (65% head, 30% tail) preserves the most important information (typically at the start). JSON key structure preservation maintains parseability. | Yes |
| 7 | design | Integrated context compression into workflow execution engine's main loop | After each step execution, output is compressed if over budget. Low-priority outputs are evicted when total context exceeds budget. Checkpoint stores full data (via DB), only inter-step transfer uses summaries. | Yes |
| 8 | design | Soul injection uses 3-layer model: Identity → Capabilities → Context | Matches PRD §2.1 Team Member architecture (身份层/能力层). Clear separation allows engine-specific formatting. | Yes |
| 9 | design | OpenClaw engine uses XML-style tags (`<identity>`, `<capabilities>`); other engines use markdown sections | XML tags provide unambiguous layer boundaries for OpenClaw's parser. Markdown is more natural for Claude/GPT-style models. Both formats are reversible. | Yes |
| 10 | design | SOUL.md bidirectional sync: `soulToMarkdown()` / `markdownToSoul()` round-trip preserving content | Enables openclaw engines to sync soul field ↔ SOUL.md file. Header stripped during parse, content preserved exactly. | Yes |
| 11 | design | `wrapUntrustedContent(source, content)` returns `{ __untrusted: true, source, content, receivedAt }` | Sentinel marker (`__untrusted: true`) enables runtime type-checking. Source provenance enables audit trail. All external data must pass through this function. | Yes |
| 12 | design | `escapeForPrompt()` wraps untrusted content in `<external_data>` XML tags | Clear delimiters tell the LLM to treat the content as external data, not instructions. Source and timestamp included in tag attributes for traceability. | Yes |
| 13 | design | Security audit log uses append-only JSONL with daily file rotation | JSONL format: one self-contained JSON object per line, easy to parse/stream. Daily rotation (`security-audit-YYYY-MM-DD.jsonl`) prevents unbounded file growth. | Yes |
| 14 | design | Provider fallback uses ordered list with automatic switching on 429/503/timeout | Caller passes `ProviderFallbackConfig` with ordered provider list. `callWithFallback()` is generic — works with any async executor function. Switch events recorded via callback. | Yes |
| 15 | design | Provider timeout uses Promise.race pattern, not AbortController | Simpler implementation, compatible with any async function. Timeout creates a ProviderError with status 0 for consistent handling. | Yes |
| 16 | design | Skill ACI parser supports both structured (section headers) and unstructured (heuristic) input | Structured parsing looks for "Use when" / "Don't use when" / "Output" headers. Heuristic fallback uses trigger word detection for legacy descriptions. | Yes |
| 17 | design | Event stream uses fan-out subscriber pattern + append-only JSONL + live events | Events are (1) written to JSONL file, (2) published as WebSocket live events, (3) fanned out to registered subscribers. This enables eval framework, activity log, and UI to all consume the same event stream independently. | Yes |
| 18 | setup | Added `"agent.trace"` to `LIVE_EVENT_TYPES` constant | New live event type for WebSocket subscribers to filter agent trace events. | Yes |
| 19 | i18n | Added ~40 Phase 8 i18n keys to both `en.json` and `zh.json` | Covers context compression, soul injection, source-sink security, provider fallback, skill ACI, and event stream UI strings. | Yes |
| 20 | setup | Added `pnpm eval:run` script pointing to `tests/eval/vitest.config.ts` | Separate vitest config for eval cases — doesn't interfere with main test suite. Eval cases use `.eval.ts` suffix convention. | Yes |
| 21 | assumption | No new npm dependencies added | All functionality built using existing stack: Node.js crypto, fs, path for audit/event JSONL; existing shared types system. | N/A |

## Files Created

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | CI pipeline: build → typecheck → test on push/PR |
| `tests/eval/vitest.config.ts` | Vitest config for eval framework |
| `tests/eval/runner.ts` | Eval runner: defineEvalCase, summarizeResults |
| `tests/eval/cases/workflow-execution.eval.ts` | Eval cases: context compression, budget overflow |
| `tests/eval/cases/soul-injection.eval.ts` | Eval cases: prompt building, SOUL.md round-trip |
| `tests/eval/cases/security-provider.eval.ts` | Eval cases: untrusted wrapping, prompt escaping, provider fallback |
| `server/src/services/context-compression.ts` | Context compression: compressStepOutput, budget checking, eviction |
| `server/src/services/soul-injection.ts` | Soul layer injection: buildSystemPrompt, SOUL.md sync |
| `server/src/services/source-sink-security.ts` | Source-sink: wrapUntrustedContent, escapeForPrompt, audit log |
| `server/src/services/provider-fallback.ts` | Provider fallback: callWithFallback, ProviderError |
| `server/src/services/event-stream.ts` | Event stream: emit events, subscriber pattern, JSONL writer |
| `server/src/services/skill-aci.ts` | Skill ACI: parseSkillACI, formatSkillACI |
| `packages/shared/src/types/agent-engineering.ts` | Shared TypeScript types for all Phase 8 features |
| `packages/db/src/migrations/0042_add_retention_priority.sql` | Migration: add retention_priority to workflow_steps |
| `server/src/__tests__/phase8-agent-engineering.test.ts` | Unit tests: 44 tests covering all Phase 8 services |
| `docs/product/decision-logs/phase-8.md` | This decision log |

## Files Modified

| File | Change |
|---|---|
| `package.json` | Added `eval:run` script |
| `packages/shared/src/constants.ts` | Added 8 Phase 8 constants (RETENTION_PRIORITIES, UNTRUSTED_SOURCES, SENSITIVE_OPERATIONS, AGENT_EVENT_TYPES, budget defaults, fallback defaults); added "agent.trace" to LIVE_EVENT_TYPES |
| `packages/shared/src/types/index.ts` | Export all Phase 8 types from agent-engineering.ts |
| `packages/shared/src/index.ts` | Export Phase 8 constants and types |
| `packages/shared/src/types/workflow.ts` | Added `retentionPriority` field to WorkflowStep, CreateWorkflowStepInput, WorkflowTemplateStep |
| `packages/db/src/schema/workflows.ts` | Added `retentionPriority` column to workflow_steps table |
| `packages/db/src/migrations/meta/_journal.json` | Added migration 0042 entry |
| `server/src/services/workflows.ts` | Integrated context compression into execution engine: compress step outputs, evict low-priority when over budget; handle retentionPriority in step creation |
| `server/src/services/index.ts` | Export all Phase 8 services |
| `ui/src/i18n/en.json` | Added ~40 agentEngineering i18n keys |
| `ui/src/i18n/zh.json` | Added ~40 agentEngineering i18n keys (Chinese) |

## Build & Test Results

- `pnpm build` — ✅ All packages build with zero errors
- `pnpm typecheck` — ✅ Zero type errors
- `pnpm test:run` — ✅ 97 test files, 637 tests passed, 0 failed (1 skipped)
- `pnpm eval:run` — ✅ 3 eval files, 17 eval cases passed
