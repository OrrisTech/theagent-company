import type { ContextBudget, CompressedOutput, RetentionPriority } from "@theagentcompany/shared";
import {
  CONTEXT_BUDGET_DEFAULT_TOTAL_CHARS,
  CONTEXT_BUDGET_DEFAULT_STEP_CHARS,
} from "@theagentcompany/shared";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "context-compression" });

/**
 * Default context budget used when no override is provided.
 * Total: ~100k chars, per-step: ~10k chars.
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudget = {
  maxTotalChars: CONTEXT_BUDGET_DEFAULT_TOTAL_CHARS,
  maxStepOutputChars: CONTEXT_BUDGET_DEFAULT_STEP_CHARS,
  defaultRetentionPriority: "medium",
};

/**
 * Multiplier applied to maxStepOutputChars based on retention priority.
 * Critical steps get 4x the budget, low priority gets 0.25x.
 */
const PRIORITY_MULTIPLIERS: Record<RetentionPriority, number> = {
  critical: 4.0,
  high: 2.0,
  medium: 1.0,
  low: 0.25,
};

/**
 * Compress a step output if it exceeds the allowed budget for its priority.
 *
 * Compression strategy:
 * 1. If output is within budget, pass through unchanged.
 * 2. If output is a JSON object, keep keys/structure but truncate large values.
 * 3. For strings, keep the first and last portions with a "[compressed]" marker.
 *
 * The approach prioritizes preserving:
 * - Architectural decisions and key conclusions
 * - Validation/status results
 * - Error messages
 * And discards:
 * - Raw tool output and verbose logs
 * - Large data payloads
 */
export function compressStepOutput(
  output: unknown,
  priority: RetentionPriority,
  budget: ContextBudget = DEFAULT_CONTEXT_BUDGET,
): CompressedOutput {
  const serialized = typeof output === "string" ? output : JSON.stringify(output, null, 0);
  const originalSize = serialized.length;

  const multiplier = PRIORITY_MULTIPLIERS[priority];
  const effectiveLimit = Math.floor(budget.maxStepOutputChars * multiplier);

  // Within budget — pass through
  if (originalSize <= effectiveLimit) {
    return {
      summary: serialized,
      wasCompressed: false,
      originalSize,
      compressedSize: originalSize,
    };
  }

  log.debug(
    { originalSize, effectiveLimit, priority },
    "Compressing step output that exceeds budget",
  );

  let summary: string;

  if (typeof output === "object" && output !== null && !Array.isArray(output)) {
    // JSON object: keep structure, truncate large leaf values
    summary = compressJsonObject(output as Record<string, unknown>, effectiveLimit);
  } else if (Array.isArray(output)) {
    // Array: keep first/last items, truncate middle
    summary = compressArray(output, effectiveLimit);
  } else {
    // String or primitive: keep head + tail
    summary = compressString(serialized, effectiveLimit);
  }

  return {
    summary,
    wasCompressed: true,
    originalSize,
    compressedSize: summary.length,
  };
}

/**
 * Determine whether the total accumulated context across all steps exceeds budget.
 * Returns the number of characters that need to be freed.
 */
export function checkContextBudgetOverflow(
  stepOutputs: Map<number, string>,
  budget: ContextBudget = DEFAULT_CONTEXT_BUDGET,
): { overBudget: boolean; excessChars: number; totalChars: number } {
  let totalChars = 0;
  for (const output of stepOutputs.values()) {
    totalChars += output.length;
  }

  const excessChars = Math.max(0, totalChars - budget.maxTotalChars);
  return {
    overBudget: excessChars > 0,
    excessChars,
    totalChars,
  };
}

/**
 * Evict low-priority step outputs when total context is over budget.
 * Returns a new map with compressed or removed outputs.
 */
export function evictLowPriorityOutputs(
  stepOutputs: Map<number, string>,
  stepPriorities: Map<number, RetentionPriority>,
  budget: ContextBudget = DEFAULT_CONTEXT_BUDGET,
): Map<number, string> {
  const result = new Map(stepOutputs);
  const { overBudget } = checkContextBudgetOverflow(result, budget);

  if (!overBudget) return result;

  // Sort steps by priority (low first) for eviction
  const orderedSteps = [...result.keys()].sort((a, b) => {
    const prioA = stepPriorities.get(a) ?? budget.defaultRetentionPriority;
    const prioB = stepPriorities.get(b) ?? budget.defaultRetentionPriority;
    const orderMap: Record<RetentionPriority, number> = {
      low: 0,
      medium: 1,
      high: 2,
      critical: 3,
    };
    return orderMap[prioA] - orderMap[prioB];
  });

  for (const stepIdx of orderedSteps) {
    const { overBudget: stillOver } = checkContextBudgetOverflow(result, budget);
    if (!stillOver) break;

    const current = result.get(stepIdx);
    if (!current) continue;

    const priority = stepPriorities.get(stepIdx) ?? budget.defaultRetentionPriority;

    // Don't evict critical outputs
    if (priority === "critical") continue;

    const compressed = compressStepOutput(current, priority, {
      ...budget,
      // Aggressive compression: reduce per-step budget to 1/4
      maxStepOutputChars: Math.floor(budget.maxStepOutputChars / 4),
    });

    result.set(stepIdx, compressed.summary);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal compression helpers
// ---------------------------------------------------------------------------

function compressString(str: string, limit: number): string {
  if (str.length <= limit) return str;

  // Keep 60% head, 30% tail, 10% for marker
  const markerSize = 60;
  const headSize = Math.floor((limit - markerSize) * 0.65);
  const tailSize = limit - markerSize - headSize;

  const head = str.slice(0, headSize);
  const tail = str.slice(-tailSize);
  const removed = str.length - headSize - tailSize;

  return `${head}\n\n[... ${removed} chars compressed ...]\n\n${tail}`;
}

function compressJsonObject(obj: Record<string, unknown>, limit: number): string {
  const entries = Object.entries(obj);
  const compressed: Record<string, unknown> = {};

  // Budget per key: distribute evenly then truncate oversized values
  const perKeyBudget = Math.floor(limit / Math.max(entries.length, 1));

  for (const [key, value] of entries) {
    const serialized = JSON.stringify(value);

    if (serialized.length <= perKeyBudget) {
      compressed[key] = value;
    } else if (typeof value === "string") {
      compressed[key] = compressString(value, perKeyBudget);
    } else if (Array.isArray(value)) {
      compressed[key] = `[Array(${value.length}) compressed]`;
    } else if (typeof value === "object" && value !== null) {
      compressed[key] = `{Object(${Object.keys(value).length} keys) compressed}`;
    } else {
      compressed[key] = value;
    }
  }

  const result = JSON.stringify(compressed);

  // Final safety: if still over limit, truncate the whole thing
  if (result.length > limit) {
    return compressString(result, limit);
  }

  return result;
}

function compressArray(arr: unknown[], limit: number): string {
  if (arr.length <= 3) {
    const result = JSON.stringify(arr);
    return result.length <= limit ? result : compressString(result, limit);
  }

  // Keep first 2 and last 1 items
  const kept = [arr[0], arr[1], `... ${arr.length - 3} items compressed ...`, arr[arr.length - 1]];
  const result = JSON.stringify(kept);

  return result.length <= limit ? result : compressString(result, limit);
}
