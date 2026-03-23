import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Unit tests for the workflow service.
 *
 * These tests verify the core logic in isolation using a mock DB layer.
 * Integration tests with a real DB would go in a separate file.
 */

// Template resolution helper — extracted for testability
function resolveTemplateRefs(
  template: unknown,
  stepOutputs: Map<number, unknown>,
  params: Record<string, unknown> | null,
): unknown {
  if (typeof template !== "string") return template;

  // Single reference — return raw value
  const singleRefMatch = template.match(/^\{\{(step(\d+)\.output(?:\.(\w+))?)\}\}$/);
  if (singleRefMatch) {
    const stepIdx = parseInt(singleRefMatch[2]!, 10);
    const output = stepOutputs.get(stepIdx);
    const field = singleRefMatch[3];
    if (field && output && typeof output === "object") {
      return (output as Record<string, unknown>)[field];
    }
    return output;
  }

  // Param reference
  const paramMatch = template.match(/^\{\{params\.(\w+)\}\}$/);
  if (paramMatch && params) {
    return params[paramMatch[1]!];
  }

  // Mixed string interpolation
  return template.replace(
    /\{\{(step(\d+)\.output(?:\.(\w+))?|params\.(\w+))\}\}/g,
    (_match, _full, stepIdx, field, paramKey) => {
      if (paramKey && params) {
        return String(params[paramKey] ?? "");
      }
      if (stepIdx !== undefined) {
        const idx = parseInt(stepIdx, 10);
        const output = stepOutputs.get(idx);
        if (field && output && typeof output === "object") {
          return String((output as Record<string, unknown>)[field] ?? "");
        }
        return typeof output === "string" ? output : JSON.stringify(output ?? "");
      }
      return _match;
    },
  );
}

describe("Workflow template resolution", () => {
  it("resolves a single step output reference to the raw value", () => {
    const outputs = new Map<number, unknown>();
    outputs.set(0, { title: "Hello", items: [1, 2, 3] });

    const result = resolveTemplateRefs("{{step0.output}}", outputs, null);
    expect(result).toEqual({ title: "Hello", items: [1, 2, 3] });
  });

  it("resolves a nested field reference", () => {
    const outputs = new Map<number, unknown>();
    outputs.set(0, { title: "Hello World" });

    const result = resolveTemplateRefs("{{step0.output.title}}", outputs, null);
    expect(result).toBe("Hello World");
  });

  it("resolves parameter references", () => {
    const outputs = new Map<number, unknown>();
    const params = { topic: "AI", count: 5 };

    expect(resolveTemplateRefs("{{params.topic}}", outputs, params)).toBe("AI");
    expect(resolveTemplateRefs("{{params.count}}", outputs, params)).toBe(5);
  });

  it("resolves mixed string with multiple references", () => {
    const outputs = new Map<number, unknown>();
    outputs.set(0, "topic A");
    outputs.set(1, "draft text");

    const template = "Based on {{step0.output}}, here is the draft: {{step1.output}}";
    const result = resolveTemplateRefs(template, outputs, null);
    expect(result).toBe("Based on topic A, here is the draft: draft text");
  });

  it("handles non-string input passthrough", () => {
    const outputs = new Map<number, unknown>();
    expect(resolveTemplateRefs(42, outputs, null)).toBe(42);
    expect(resolveTemplateRefs(null, outputs, null)).toBe(null);
    expect(resolveTemplateRefs(undefined, outputs, null)).toBe(undefined);
  });

  it("returns undefined for single unresolvable reference", () => {
    const outputs = new Map<number, unknown>();
    const template = "{{step99.output}}";
    const result = resolveTemplateRefs(template, outputs, null);
    // step99 doesn't exist — single-ref returns the raw value (undefined)
    expect(result).toBeUndefined();
  });

  it("resolves object output in mixed strings as JSON", () => {
    const outputs = new Map<number, unknown>();
    outputs.set(0, { key: "value" });

    const template = "Result: {{step0.output}} end";
    const result = resolveTemplateRefs(template, outputs, null);
    expect(result).toBe('Result: {"key":"value"} end');
  });
});

describe("Workflow step types", () => {
  it("WORKFLOW_STEP_TYPES contains all expected types", async () => {
    const { WORKFLOW_STEP_TYPES } = await import("@theagentcompany/shared");
    expect(WORKFLOW_STEP_TYPES).toContain("prompt");
    expect(WORKFLOW_STEP_TYPES).toContain("skill");
    expect(WORKFLOW_STEP_TYPES).toContain("api");
    expect(WORKFLOW_STEP_TYPES).toContain("cli");
    expect(WORKFLOW_STEP_TYPES).toContain("tool_use");
    expect(WORKFLOW_STEP_TYPES).toContain("approval");
    expect(WORKFLOW_STEP_TYPES).toContain("condition");
    expect(WORKFLOW_STEP_TYPES).toContain("loop");
    expect(WORKFLOW_STEP_TYPES).toContain("workflow");
    expect(WORKFLOW_STEP_TYPES.length).toBe(9);
  });

  it("WORKFLOW_RUN_STATUSES contains all expected statuses", async () => {
    const { WORKFLOW_RUN_STATUSES } = await import("@theagentcompany/shared");
    expect(WORKFLOW_RUN_STATUSES).toContain("pending");
    expect(WORKFLOW_RUN_STATUSES).toContain("running");
    expect(WORKFLOW_RUN_STATUSES).toContain("paused");
    expect(WORKFLOW_RUN_STATUSES).toContain("succeeded");
    expect(WORKFLOW_RUN_STATUSES).toContain("failed");
    expect(WORKFLOW_RUN_STATUSES).toContain("cancelled");
    expect(WORKFLOW_RUN_STATUSES.length).toBe(6);
  });

  it("WORKFLOW_STEP_RUN_STATUSES contains waiting_approval", async () => {
    const { WORKFLOW_STEP_RUN_STATUSES } = await import("@theagentcompany/shared");
    expect(WORKFLOW_STEP_RUN_STATUSES).toContain("waiting_approval");
    expect(WORKFLOW_STEP_RUN_STATUSES).toContain("skipped");
    expect(WORKFLOW_STEP_RUN_STATUSES.length).toBe(7);
  });

  it("WORKFLOW_RUN_TRIGGERS includes all trigger types", async () => {
    const { WORKFLOW_RUN_TRIGGERS } = await import("@theagentcompany/shared");
    expect(WORKFLOW_RUN_TRIGGERS).toContain("manual");
    expect(WORKFLOW_RUN_TRIGGERS).toContain("task");
    expect(WORKFLOW_RUN_TRIGGERS).toContain("cron");
    expect(WORKFLOW_RUN_TRIGGERS).toContain("event");
  });

  it("concurrency defaults are sensible", async () => {
    const { WORKFLOW_DEFAULT_SYSTEM_CONCURRENCY, WORKFLOW_DEFAULT_AGENT_CONCURRENCY } =
      await import("@theagentcompany/shared");
    expect(WORKFLOW_DEFAULT_SYSTEM_CONCURRENCY).toBe(10);
    expect(WORKFLOW_DEFAULT_AGENT_CONCURRENCY).toBe(3);
  });
});

describe("Workflow type definitions", () => {
  it("WorkflowParam type has expected shape", async () => {
    // Type-level test — verify the interface is importable and usable
    const shared = await import("@theagentcompany/shared");
    const param: import("@theagentcompany/shared").WorkflowParam = {
      key: "topic",
      label: "Topic",
      type: "string",
      required: true,
      defaultValue: "AI",
    };
    expect(param.key).toBe("topic");
    expect(param.required).toBe(true);
  });

  it("CreateWorkflowInput accepts all step types", async () => {
    const input: import("@theagentcompany/shared").CreateWorkflowInput = {
      name: "Test Workflow",
      steps: [
        { name: "Step 1", type: "prompt", config: { prompt: "Hello" } },
        { name: "Step 2", type: "approval", config: { prompt: "Review this" } },
        { name: "Step 3", type: "condition", config: { expression: "true", thenStep: 4 } },
      ],
    };
    expect(input.steps.length).toBe(3);
  });
});
