/**
 * Eval framework runner — orchestrates eval case execution and reporting.
 *
 * The eval framework distinguishes between two types of tests:
 *
 * 1. **Capability tests (pass@k)**: Measure whether the system CAN do something.
 *    Success = at least one pass in k attempts. Used for new feature validation.
 *
 * 2. **Regression tests (pass^k)**: Ensure the system still DOES something correctly.
 *    Success = ALL k attempts pass. Used for preventing regressions.
 *
 * Usage: `pnpm eval:run` — runs all eval cases via vitest.
 */

import type { EvalCaseResult, EvalRunSummary, EvalTestType } from "@theagentcompany/shared";

/**
 * Create an eval case definition that can be executed by the test runner.
 */
export function defineEvalCase(opts: {
  id: string;
  name: string;
  type: EvalTestType;
  /** The grading function. Returns { passed, score?, error? }. */
  grader: () => Promise<{ passed: boolean; score?: number; error?: string }>;
}): {
  id: string;
  name: string;
  type: EvalTestType;
  run: () => Promise<EvalCaseResult>;
} {
  return {
    id: opts.id,
    name: opts.name,
    type: opts.type,
    async run(): Promise<EvalCaseResult> {
      const start = Date.now();
      try {
        const result = await opts.grader();
        return {
          caseId: opts.id,
          name: opts.name,
          type: opts.type,
          passed: result.passed,
          score: result.score,
          error: result.error,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        return {
          caseId: opts.id,
          name: opts.name,
          type: opts.type,
          passed: false,
          score: 0,
          error: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        };
      }
    },
  };
}

/**
 * Summarize a set of eval case results into capability and regression pass rates.
 */
export function summarizeResults(results: EvalCaseResult[]): EvalRunSummary {
  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  const capabilityResults = results.filter((r) => r.type === "capability");
  const regressionResults = results.filter((r) => r.type === "regression");

  // pass@k: at least one pass = success (per case)
  const capabilityPassRate =
    capabilityResults.length > 0
      ? capabilityResults.filter((r) => r.passed).length / capabilityResults.length
      : 1;

  // pass^k: all must pass
  const regressionPassRate =
    regressionResults.length > 0
      ? regressionResults.every((r) => r.passed) ? 1 : 0
      : 1;

  return {
    totalCases: results.length,
    passed,
    failed,
    capabilityPassRate,
    regressionPassRate,
    results,
    totalDurationMs,
  };
}
