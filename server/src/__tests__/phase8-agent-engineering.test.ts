/**
 * Phase 8 — Agent Engineering Hardening
 * Unit tests for all Phase 8 services: context compression, soul injection,
 * source-sink security, provider fallback, skill ACI, and event stream.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  RETENTION_PRIORITIES,
  UNTRUSTED_SOURCES,
  SENSITIVE_OPERATIONS,
  AGENT_EVENT_TYPES,
  CONTEXT_BUDGET_DEFAULT_TOTAL_CHARS,
  CONTEXT_BUDGET_DEFAULT_STEP_CHARS,
  PROVIDER_FALLBACK_RETRYABLE_CODES,
  PROVIDER_FALLBACK_MAX_RETRIES,
} from "@paperclipai/shared";
import type {
  ContextBudget,
  RetentionPriority,
  ProviderFallbackConfig,
  SkillACI,
  EvalCaseResult,
} from "@paperclipai/shared";

// ---------------------------------------------------------------------------
// Constants validation
// ---------------------------------------------------------------------------

describe("Phase 8 Constants", () => {
  it("RETENTION_PRIORITIES contains expected values", () => {
    expect(RETENTION_PRIORITIES).toEqual(["critical", "high", "medium", "low"]);
    expect(RETENTION_PRIORITIES).toHaveLength(4);
  });

  it("UNTRUSTED_SOURCES contains expected values", () => {
    expect(UNTRUSTED_SOURCES).toContain("web_fetch");
    expect(UNTRUSTED_SOURCES).toContain("email");
    expect(UNTRUSTED_SOURCES).toContain("webhook");
    expect(UNTRUSTED_SOURCES).toContain("user_input");
    expect(UNTRUSTED_SOURCES).toContain("api_response");
    expect(UNTRUSTED_SOURCES).toContain("file_upload");
    expect(UNTRUSTED_SOURCES).toHaveLength(6);
  });

  it("SENSITIVE_OPERATIONS contains expected values", () => {
    expect(SENSITIVE_OPERATIONS).toContain("external_api_call");
    expect(SENSITIVE_OPERATIONS).toContain("send_message");
    expect(SENSITIVE_OPERATIONS).toContain("delete_resource");
    expect(SENSITIVE_OPERATIONS).toHaveLength(6);
  });

  it("AGENT_EVENT_TYPES contains expected values", () => {
    expect(AGENT_EVENT_TYPES).toContain("tool_start");
    expect(AGENT_EVENT_TYPES).toContain("tool_end");
    expect(AGENT_EVENT_TYPES).toContain("turn_end");
    expect(AGENT_EVENT_TYPES).toContain("step_start");
    expect(AGENT_EVENT_TYPES).toContain("step_end");
    expect(AGENT_EVENT_TYPES).toContain("error");
    expect(AGENT_EVENT_TYPES).toContain("provider_switch");
    expect(AGENT_EVENT_TYPES).toContain("context_compressed");
    expect(AGENT_EVENT_TYPES).toHaveLength(9);
  });

  it("CONTEXT_BUDGET_DEFAULT_TOTAL_CHARS is 100_000", () => {
    expect(CONTEXT_BUDGET_DEFAULT_TOTAL_CHARS).toBe(100_000);
  });

  it("CONTEXT_BUDGET_DEFAULT_STEP_CHARS is 10_000", () => {
    expect(CONTEXT_BUDGET_DEFAULT_STEP_CHARS).toBe(10_000);
  });

  it("PROVIDER_FALLBACK_RETRYABLE_CODES contains 429 and 503", () => {
    expect([...PROVIDER_FALLBACK_RETRYABLE_CODES]).toContain(429);
    expect([...PROVIDER_FALLBACK_RETRYABLE_CODES]).toContain(503);
  });

  it("PROVIDER_FALLBACK_MAX_RETRIES is 3", () => {
    expect(PROVIDER_FALLBACK_MAX_RETRIES).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Type shape validation
// ---------------------------------------------------------------------------

describe("Phase 8 Type Shapes", () => {
  it("ContextBudget has correct shape", () => {
    const budget: ContextBudget = {
      maxTotalChars: 100_000,
      maxStepOutputChars: 10_000,
      defaultRetentionPriority: "medium",
    };
    expect(budget.maxTotalChars).toBe(100_000);
    expect(budget.maxStepOutputChars).toBe(10_000);
    expect(budget.defaultRetentionPriority).toBe("medium");
  });

  it("RetentionPriority accepts all valid values", () => {
    const priorities: RetentionPriority[] = ["critical", "high", "medium", "low"];
    expect(priorities).toHaveLength(4);
  });

  it("ProviderFallbackConfig has correct shape", () => {
    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "anthropic", model: "claude-opus-4" },
        { provider: "openai", model: "gpt-4o", timeoutMs: 30_000 },
      ],
      retryableStatusCodes: [429, 503],
      maxRetries: 3,
    };
    expect(config.providers).toHaveLength(2);
    expect(config.providers[0]!.provider).toBe("anthropic");
    expect(config.providers[1]!.timeoutMs).toBe(30_000);
  });

  it("SkillACI has correct shape", () => {
    const aci: SkillACI = {
      name: "Research",
      useWhen: ["Need to gather information from the web"],
      dontUseWhen: ["Information is already available locally"],
      outputFormat: "Structured markdown report",
      examples: ["Find latest pricing for competitor X"],
    };
    expect(aci.useWhen).toHaveLength(1);
    expect(aci.dontUseWhen).toHaveLength(1);
    expect(aci.outputFormat).toBe("Structured markdown report");
  });

  it("EvalCaseResult has correct shape", () => {
    const result: EvalCaseResult = {
      caseId: "test-1",
      name: "Test case",
      type: "regression",
      passed: true,
      score: 1.0,
      durationMs: 42,
    };
    expect(result.passed).toBe(true);
    expect(result.type).toBe("regression");
  });
});

// ---------------------------------------------------------------------------
// Context Compression
// ---------------------------------------------------------------------------

describe("Context Compression Service", () => {
  it("small output passes through unchanged", async () => {
    const { compressStepOutput } = await import("../services/context-compression.js");
    const output = { status: "ok", message: "All good" };
    const result = compressStepOutput(output, "medium");

    expect(result.wasCompressed).toBe(false);
    expect(result.summary).toBe(JSON.stringify(output));
    expect(result.originalSize).toBe(result.compressedSize);
  });

  it("large string gets compressed with head/tail preservation", async () => {
    const { compressStepOutput } = await import("../services/context-compression.js");
    const largeString = "a".repeat(20_000);
    const result = compressStepOutput(largeString, "medium");

    expect(result.wasCompressed).toBe(true);
    expect(result.compressedSize).toBeLessThan(result.originalSize);
    expect(result.summary).toContain("compressed");
  });

  it("critical priority gets 4x budget multiplier", async () => {
    const { compressStepOutput, DEFAULT_CONTEXT_BUDGET } = await import("../services/context-compression.js");
    // 3x the default step budget — exceeds 1x (medium) but within 4x (critical)
    const output = "x".repeat(DEFAULT_CONTEXT_BUDGET.maxStepOutputChars * 3);

    const mediumResult = compressStepOutput(output, "medium");
    const criticalResult = compressStepOutput(output, "critical");

    // medium: 3x > 1x budget -> compressed
    expect(mediumResult.wasCompressed).toBe(true);
    // critical: 3x < 4x budget -> NOT compressed
    expect(criticalResult.wasCompressed).toBe(false);
  });

  it("low priority gets 0.25x budget multiplier", async () => {
    const { compressStepOutput, DEFAULT_CONTEXT_BUDGET } = await import("../services/context-compression.js");
    // 0.5x the default — should pass for medium but compress for low (0.25x)
    const output = "x".repeat(Math.floor(DEFAULT_CONTEXT_BUDGET.maxStepOutputChars * 0.5));

    const mediumResult = compressStepOutput(output, "medium");
    const lowResult = compressStepOutput(output, "low");

    expect(mediumResult.wasCompressed).toBe(false); // 0.5x < 1x budget
    expect(lowResult.wasCompressed).toBe(true); // 0.5x > 0.25x budget
  });

  it("budget overflow detection works", async () => {
    const { checkContextBudgetOverflow } = await import("../services/context-compression.js");

    const budget: ContextBudget = {
      maxTotalChars: 100,
      maxStepOutputChars: 50,
      defaultRetentionPriority: "medium",
    };

    const outputs = new Map<number, string>();
    outputs.set(0, "a".repeat(60));
    outputs.set(1, "b".repeat(60));

    const result = checkContextBudgetOverflow(outputs, budget);
    expect(result.overBudget).toBe(true);
    expect(result.totalChars).toBe(120);
    expect(result.excessChars).toBe(20);
  });

  it("eviction removes low-priority outputs first", async () => {
    const { evictLowPriorityOutputs } = await import("../services/context-compression.js");

    // Use large enough budget so compression markers fit within limits
    const budget: ContextBudget = {
      maxTotalChars: 5_000,
      maxStepOutputChars: 2_000,
      defaultRetentionPriority: "medium",
    };

    const outputs = new Map<number, string>();
    outputs.set(0, "a".repeat(4_000)); // low priority — will be compressed
    outputs.set(1, "b".repeat(4_000)); // critical — should be untouched

    const priorities = new Map<number, RetentionPriority>();
    priorities.set(0, "low");
    priorities.set(1, "critical");

    const result = evictLowPriorityOutputs(outputs, priorities, budget);

    // Low-priority output should be compressed (smaller than original 4000)
    expect(result.get(0)!.length).toBeLessThan(4_000);
    // Critical output should be untouched
    expect(result.get(1)).toBe("b".repeat(4_000));
  });

  it("JSON objects get compressed with structure preservation", async () => {
    const { compressStepOutput } = await import("../services/context-compression.js");
    const output = {
      decision: "approved",
      longReport: "x".repeat(20_000),
      shortNote: "all good",
    };

    const result = compressStepOutput(output, "medium");
    expect(result.wasCompressed).toBe(true);

    // The compressed output should still be parseable (or at least contain key names)
    expect(result.summary).toContain("decision");
  });
});

// ---------------------------------------------------------------------------
// Soul Injection
// ---------------------------------------------------------------------------

describe("Soul Injection Service", () => {
  it("builds prompt with identity and capabilities layers", async () => {
    const { buildSystemPrompt } = await import("../services/soul-injection.js");

    const result = buildSystemPrompt({
      name: "来财",
      soul: "Direct and humorous",
      jobDescription: "Run the company",
      engineType: "claude_local",
      skills: ["research", "writing"],
    });

    expect(result.systemPrompt).toContain("You are 来财");
    expect(result.systemPrompt).toContain("Direct and humorous");
    expect(result.systemPrompt).toContain("Run the company");
    expect(result.systemPrompt).toContain("research");
    expect(result.layers.identity).toContain("来财");
    expect(result.layers.capabilities).toContain("Run the company");
  });

  it("openclaw engine uses XML tags", async () => {
    const { buildSystemPrompt } = await import("../services/soul-injection.js");

    const result = buildSystemPrompt({
      name: "Agent",
      soul: "Helpful",
      jobDescription: "Work",
      engineType: "openclaw",
    });

    expect(result.systemPrompt).toContain("<identity>");
    expect(result.systemPrompt).toContain("</identity>");
    expect(result.systemPrompt).toContain("<capabilities>");
    expect(result.systemPrompt).toContain("</capabilities>");
  });

  it("claude_local engine does NOT use XML tags", async () => {
    const { buildSystemPrompt } = await import("../services/soul-injection.js");

    const result = buildSystemPrompt({
      name: "Agent",
      soul: "Helpful",
      jobDescription: "Work",
      engineType: "claude_local",
    });

    expect(result.systemPrompt).not.toContain("<identity>");
  });

  it("handles null soul gracefully", async () => {
    const { buildSystemPrompt } = await import("../services/soul-injection.js");

    const result = buildSystemPrompt({
      name: "Agent",
      soul: null,
      jobDescription: "Work",
      engineType: "process",
    });

    expect(result.systemPrompt).toContain("You are Agent");
    expect(result.systemPrompt).not.toContain("Personality");
  });

  it("SOUL.md round-trip preserves content", async () => {
    const { soulToMarkdown, markdownToSoul } = await import("../services/soul-injection.js");

    const soul = "Direct, no-nonsense.\nAlways actionable.";
    const md = soulToMarkdown("Test", soul);
    const recovered = markdownToSoul(md);
    expect(recovered).toBe(soul);
  });

  it("empty SOUL.md returns empty string", async () => {
    const { soulToMarkdown, markdownToSoul } = await import("../services/soul-injection.js");

    const md = soulToMarkdown("Test", null);
    const recovered = markdownToSoul(md);
    expect(recovered).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Source-Sink Security
// ---------------------------------------------------------------------------

describe("Source-Sink Security Service", () => {
  it("wrapUntrustedContent creates proper wrapper", async () => {
    const { wrapUntrustedContent, isUntrustedContent } = await import("../services/source-sink-security.js");

    const wrapped = wrapUntrustedContent("webhook", "some payload");
    expect(wrapped.__untrusted).toBe(true);
    expect(wrapped.source).toBe("webhook");
    expect(wrapped.content).toBe("some payload");
    expect(wrapped.receivedAt).toBeTruthy();
    expect(isUntrustedContent(wrapped)).toBe(true);
  });

  it("isUntrustedContent rejects non-wrapped values", async () => {
    const { isUntrustedContent } = await import("../services/source-sink-security.js");

    expect(isUntrustedContent("string")).toBe(false);
    expect(isUntrustedContent(null)).toBe(false);
    expect(isUntrustedContent({ foo: "bar" })).toBe(false);
    expect(isUntrustedContent({ __untrusted: false })).toBe(false);
  });

  it("escapeForPrompt wraps in XML tags", async () => {
    const { wrapUntrustedContent, escapeForPrompt } = await import("../services/source-sink-security.js");

    const wrapped = wrapUntrustedContent("email", "test content");
    const escaped = escapeForPrompt(wrapped);

    expect(escaped).toContain('<external_data source="email"');
    expect(escaped).toContain("test content");
    expect(escaped).toContain("</external_data>");
  });

  it("requiresConfirmation identifies sensitive operations", async () => {
    const { requiresConfirmation } = await import("../services/source-sink-security.js");

    expect(requiresConfirmation("external_api_call")).toBe(true);
    expect(requiresConfirmation("send_message")).toBe(true);
    expect(requiresConfirmation("delete_resource")).toBe(true);
    expect(requiresConfirmation("read_data")).toBe(false);
    expect(requiresConfirmation("log_stuff")).toBe(false);
  });

  it("unwrapContent extracts raw content", async () => {
    const { wrapUntrustedContent, unwrapContent } = await import("../services/source-sink-security.js");

    const wrapped = wrapUntrustedContent("api_response", "raw data");
    expect(unwrapContent(wrapped)).toBe("raw data");
  });
});

// ---------------------------------------------------------------------------
// Provider Fallback
// ---------------------------------------------------------------------------

describe("Provider Fallback Service", () => {
  it("returns result from first successful provider", async () => {
    const { callWithFallback } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "anthropic", model: "claude-opus-4" },
        { provider: "openai", model: "gpt-4o" },
      ],
    };

    const result = await callWithFallback<string>(config, async () => "success");
    expect(result.success).toBe(true);
    expect(result.data).toBe("success");
    expect(result.provider).toBe("anthropic");
    expect(result.fallbackCount).toBe(0);
  });

  it("falls back to next provider on 503", async () => {
    const { callWithFallback, ProviderError } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "provider-a", model: "model-a" },
        { provider: "provider-b", model: "model-b" },
      ],
    };

    let callIdx = 0;
    const result = await callWithFallback<string>(config, async (entry) => {
      callIdx++;
      if (entry.provider === "provider-a") throw new ProviderError("Unavailable", 503);
      return "from-b";
    });

    expect(result.success).toBe(true);
    expect(result.data).toBe("from-b");
    expect(result.provider).toBe("provider-b");
    expect(result.fallbackCount).toBe(1);
  });

  it("falls back on 429 rate limit", async () => {
    const { callWithFallback, ProviderError } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "a", model: "m-a" },
        { provider: "b", model: "m-b" },
      ],
    };

    const result = await callWithFallback<string>(config, async (entry) => {
      if (entry.provider === "a") throw new ProviderError("Rate limited", 429);
      return "ok";
    });

    expect(result.success).toBe(true);
    expect(result.fallbackCount).toBe(1);
  });

  it("does not fallback on non-retryable error (400)", async () => {
    const { callWithFallback, ProviderError } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "a", model: "m-a" },
        { provider: "b", model: "m-b" },
      ],
    };

    const result = await callWithFallback<string>(config, async () => {
      throw new ProviderError("Bad request", 400);
    });

    expect(result.success).toBe(false);
    expect(result.fallbackCount).toBe(0);
    expect(result.error).toContain("Bad request");
  });

  it("records switch events via callback", async () => {
    const { callWithFallback, ProviderError } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [
        { provider: "a", model: "m-a" },
        { provider: "b", model: "m-b" },
      ],
    };

    const switches: Array<{ from: string; to: string }> = [];
    await callWithFallback<string>(
      config,
      async (entry) => {
        if (entry.provider === "a") throw new ProviderError("Unavailable", 503);
        return "ok";
      },
      (event) => switches.push({ from: event.fromProvider, to: event.toProvider }),
    );

    expect(switches).toHaveLength(1);
    expect(switches[0]!.from).toBe("a");
    expect(switches[0]!.to).toBe("b");
  });

  it("reports duration in result", async () => {
    const { callWithFallback } = await import("../services/provider-fallback.js");

    const config: ProviderFallbackConfig = {
      providers: [{ provider: "a", model: "m" }],
    };

    const result = await callWithFallback<string>(config, async () => "ok");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Skill ACI
// ---------------------------------------------------------------------------

describe("Skill ACI Service", () => {
  it("parses structured ACI description", async () => {
    const { parseSkillACI } = await import("../services/skill-aci.js");

    const desc = `Use when:
- User asks to research a topic
- Need to gather external information

Don't use when:
- Information is available in memory
- Task is purely computational

Output format:
Structured markdown report with sources

Examples:
- "Research competitor pricing for Q1"`;

    const aci = parseSkillACI("Research", desc);
    expect(aci.name).toBe("Research");
    expect(aci.useWhen).toHaveLength(2);
    expect(aci.useWhen[0]).toContain("research a topic");
    expect(aci.dontUseWhen).toHaveLength(2);
    expect(aci.outputFormat).toContain("markdown report");
    expect(aci.examples).toHaveLength(1);
  });

  it("extracts from unstructured description", async () => {
    const { parseSkillACI } = await import("../services/skill-aci.js");

    const desc = "Use this skill when you need to write blog posts. It produces long-form content. Do not use for code generation.";
    const aci = parseSkillACI("Writer", desc);

    expect(aci.name).toBe("Writer");
    expect(aci.useWhen.length).toBeGreaterThan(0);
    expect(aci.dontUseWhen.length).toBeGreaterThan(0);
  });

  it("formatSkillACI produces readable output", async () => {
    const { formatSkillACI } = await import("../services/skill-aci.js");

    const aci: SkillACI = {
      name: "Test",
      useWhen: ["Condition A", "Condition B"],
      dontUseWhen: ["Exclusion X"],
      outputFormat: "JSON",
    };

    const formatted = formatSkillACI(aci);
    expect(formatted).toContain("**Use when:**");
    expect(formatted).toContain("- Condition A");
    expect(formatted).toContain("**Don't use when:**");
    expect(formatted).toContain("- Exclusion X");
    expect(formatted).toContain("**Output format:** JSON");
  });

  it("handles empty description gracefully", async () => {
    const { parseSkillACI } = await import("../services/skill-aci.js");

    const aci = parseSkillACI("Empty", "Simple skill with no special formatting.");
    expect(aci.name).toBe("Empty");
    expect(aci.useWhen.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Event Stream (unit tests for event type and subscriber pattern)
// ---------------------------------------------------------------------------

describe("Event Stream Service", () => {
  it("emitEvent creates event with ID and timestamp", async () => {
    const { emitEvent } = await import("../services/event-stream.js");

    const event = await emitEvent({
      type: "tool_start",
      companyId: "test-company",
      agentId: "test-agent",
      toolName: "web_search",
    });

    expect(event.id).toBeTruthy();
    expect(event.timestamp).toBeTruthy();
    expect(event.type).toBe("tool_start");
    expect(event.companyId).toBe("test-company");
    expect(event.agentId).toBe("test-agent");
    expect(event.toolName).toBe("web_search");
  });

  it("subscribers receive emitted events", async () => {
    const { emitEvent, subscribeToEvents } = await import("../services/event-stream.js");

    const received: unknown[] = [];
    const unsub = subscribeToEvents((event) => {
      received.push(event);
    });

    await emitEvent({
      type: "turn_end",
      companyId: "c1",
      agentId: "a1",
      durationMs: 500,
    });

    expect(received).toHaveLength(1);
    expect((received[0] as { type: string }).type).toBe("turn_end");

    unsub();

    await emitEvent({
      type: "step_start",
      companyId: "c1",
      agentId: "a1",
    });

    // After unsub, should not receive more
    expect(received).toHaveLength(1);
  });

  it("convenience emitters create correct event types", async () => {
    const { emitToolStart, emitToolEnd, emitTurnEnd, emitStepStart, emitStepEnd } = await import("../services/event-stream.js");

    const toolStart = await emitToolStart("c", "a", "browser");
    expect(toolStart.type).toBe("tool_start");
    expect(toolStart.toolName).toBe("browser");

    const toolEnd = await emitToolEnd("c", "a", "browser", 100);
    expect(toolEnd.type).toBe("tool_end");
    expect(toolEnd.durationMs).toBe(100);

    const turnEnd = await emitTurnEnd("c", "a", 200);
    expect(turnEnd.type).toBe("turn_end");

    const stepStart = await emitStepStart("c", "a", "run-1", 0);
    expect(stepStart.type).toBe("step_start");
    expect(stepStart.stepIndex).toBe(0);

    const stepEnd = await emitStepEnd("c", "a", "run-1", 0, 300);
    expect(stepEnd.type).toBe("step_end");
    expect(stepEnd.durationMs).toBe(300);
  });
});
