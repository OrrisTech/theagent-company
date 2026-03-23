/**
 * Eval case: Workflow Execution — verifies the workflow engine correctly
 * resolves template references, handles step sequencing, and applies
 * context compression when outputs exceed budget.
 */
import { describe, it, expect } from "vitest";
import { defineEvalCase, summarizeResults } from "../runner.js";
import {
  compressStepOutput,
  checkContextBudgetOverflow,
  evictLowPriorityOutputs,
  DEFAULT_CONTEXT_BUDGET,
} from "../../../server/src/services/context-compression.js";
import type { ContextBudget, RetentionPriority } from "@theagentcompany/shared";

describe("Eval: Workflow Execution", () => {
  // --- Capability test: context compression correctly shrinks oversized output ---
  const compressCase = defineEvalCase({
    id: "workflow-compress-large-output",
    name: "Context compression reduces oversized step output",
    type: "capability",
    async grader() {
      const largeOutput = "x".repeat(50_000);
      const result = compressStepOutput(largeOutput, "medium");

      const passed =
        result.wasCompressed &&
        result.compressedSize < result.originalSize &&
        result.compressedSize <= DEFAULT_CONTEXT_BUDGET.maxStepOutputChars * 1.1; // 10% tolerance

      return {
        passed,
        score: passed ? 1 : result.compressedSize / result.originalSize,
        error: passed ? undefined : `Compressed to ${result.compressedSize}, expected < ${DEFAULT_CONTEXT_BUDGET.maxStepOutputChars}`,
      };
    },
  });

  it("compresses oversized output (capability)", async () => {
    const result = await compressCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Regression test: small outputs pass through without compression ---
  const passthroughCase = defineEvalCase({
    id: "workflow-passthrough-small-output",
    name: "Small outputs pass through without compression",
    type: "regression",
    async grader() {
      const smallOutput = { decision: "approved", details: "All checks passed" };
      const result = compressStepOutput(smallOutput, "medium");

      return {
        passed: !result.wasCompressed && result.summary === JSON.stringify(smallOutput),
        score: result.wasCompressed ? 0 : 1,
      };
    },
  });

  it("passes through small output (regression)", async () => {
    const result = await passthroughCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Capability test: critical priority gets higher budget ---
  const priorityCase = defineEvalCase({
    id: "workflow-critical-priority-budget",
    name: "Critical retention priority gets 4x budget",
    type: "capability",
    async grader() {
      // Output that's 2x the default step budget
      const mediumExceedOutput = "y".repeat(DEFAULT_CONTEXT_BUDGET.maxStepOutputChars * 2);

      const mediumResult = compressStepOutput(mediumExceedOutput, "medium");
      const criticalResult = compressStepOutput(mediumExceedOutput, "critical");

      // Medium should compress (2x > 1x budget), critical should NOT (2x < 4x budget)
      const passed = mediumResult.wasCompressed && !criticalResult.wasCompressed;
      return {
        passed,
        score: passed ? 1 : 0,
        error: passed ? undefined : `medium.compressed=${mediumResult.wasCompressed}, critical.compressed=${criticalResult.wasCompressed}`,
      };
    },
  });

  it("critical priority gets higher budget (capability)", async () => {
    const result = await priorityCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Regression test: budget overflow detection ---
  const overflowCase = defineEvalCase({
    id: "workflow-budget-overflow-detection",
    name: "Budget overflow detection works correctly",
    type: "regression",
    async grader() {
      const budget: ContextBudget = {
        maxTotalChars: 100,
        maxStepOutputChars: 50,
        defaultRetentionPriority: "medium",
      };

      const outputs = new Map<number, string>();
      outputs.set(0, "a".repeat(60));
      outputs.set(1, "b".repeat(60));

      const check = checkContextBudgetOverflow(outputs, budget);
      return {
        passed: check.overBudget && check.totalChars === 120 && check.excessChars === 20,
        score: check.overBudget ? 1 : 0,
      };
    },
  });

  it("detects budget overflow (regression)", async () => {
    const result = await overflowCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Summary test ---
  it("summarizes all workflow eval results", async () => {
    const results = await Promise.all([
      compressCase.run(),
      passthroughCase.run(),
      priorityCase.run(),
      overflowCase.run(),
    ]);

    const summary = summarizeResults(results);
    expect(summary.totalCases).toBe(4);
    expect(summary.passed).toBe(4);
    expect(summary.regressionPassRate).toBe(1);
    expect(summary.capabilityPassRate).toBe(1);
  });
});
