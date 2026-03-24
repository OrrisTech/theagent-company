import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { calculateCostUsd, parseSSEResponse } from "../server/execute.js";
import { execute } from "../server/index.js";
import type { AdapterExecutionContext } from "@theagentcompany/adapter-utils";

// ---------------------------------------------------------------------------
// Cost calculation tests
// ---------------------------------------------------------------------------

describe("calculateCostUsd", () => {
  it("calculates cost for claude-sonnet-4", () => {
    const cost = calculateCostUsd("claude-sonnet-4-20250514", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      cachedInputTokens: 0,
    });
    // $3/MTok in + $15/MTok out = $18
    expect(cost).toBeCloseTo(18, 2);
  });

  it("calculates cost for claude-opus-4", () => {
    const cost = calculateCostUsd("claude-opus-4-20250514", {
      inputTokens: 500_000,
      outputTokens: 100_000,
      cachedInputTokens: 0,
    });
    // (500k/1M * $15) + (100k/1M * $75) = $7.50 + $7.50 = $15
    expect(cost).toBeCloseTo(15, 2);
  });

  it("calculates cost for claude-3-5-haiku", () => {
    const cost = calculateCostUsd("claude-3-5-haiku-20241022", {
      inputTokens: 2_000_000,
      outputTokens: 500_000,
      cachedInputTokens: 0,
    });
    // (2M/1M * $0.80) + (500k/1M * $4) = $1.60 + $2.00 = $3.60
    expect(cost).toBeCloseTo(3.6, 2);
  });

  it("applies 10% rate for cached input tokens", () => {
    const cost = calculateCostUsd("claude-sonnet-4-20250514", {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cachedInputTokens: 800_000,
    });
    // Non-cached: 200k/1M * $3 = $0.60
    // Cached: 800k/1M * $3 * 0.1 = $0.24
    // Total: $0.84
    expect(cost).toBeCloseTo(0.84, 2);
  });

  it("returns 0 for unknown models", () => {
    const cost = calculateCostUsd("unknown-model", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    expect(cost).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// SSE response parsing tests
// ---------------------------------------------------------------------------

describe("parseSSEResponse", () => {
  it("parses a complete text response", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_123","model":"claude-sonnet-4-20250514","usage":{"input_tokens":100,"output_tokens":0}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":5}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.text).toBe("Hello world");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.stopReason).toBe("end_turn");
    expect(result.errorMessage).toBeNull();
  });

  it("parses tool_use blocks", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_456","model":"claude-sonnet-4-20250514","usage":{"input_tokens":50,"output_tokens":0}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01","name":"get_weather","input":{}}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\\"location\\":"}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"\\"San Francisco\\"}"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"tool_use","stop_sequence":null},"usage":{"output_tokens":30}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.toolUseBlocks).toHaveLength(1);
    expect(result.toolUseBlocks[0].name).toBe("get_weather");
    expect(result.toolUseBlocks[0].id).toBe("toolu_01");
    expect(result.toolUseBlocks[0].input).toEqual({ location: "San Francisco" });
    expect(result.stopReason).toBe("tool_use");
  });

  it("captures cached input tokens", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_789","model":"claude-sonnet-4-20250514","usage":{"input_tokens":500,"output_tokens":0,"cache_read_input_tokens":300}}}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":10}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.usage.inputTokens).toBe(500);
    expect(result.usage.cachedInputTokens).toBe(300);
    expect(result.usage.outputTokens).toBe(10);
  });

  it("captures error events", () => {
    const sse = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_err","model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
      '',
      'event: error',
      'data: {"type":"error","error":{"type":"overloaded_error","message":"Overloaded"}}',
      '',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.errorMessage).toBe("Overloaded");
  });

  it("handles empty/malformed input gracefully", () => {
    const result = parseSSEResponse("");
    expect(result.text).toBe("");
    expect(result.model).toBe("");
    expect(result.usage.inputTokens).toBe(0);
    expect(result.errorMessage).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Execute function tests (with mocked fetch)
// ---------------------------------------------------------------------------

describe("execute", () => {
  const originalFetch = globalThis.fetch;

  function makeCtx(overrides: Partial<AdapterExecutionContext> = {}): AdapterExecutionContext {
    return {
      runId: "test-run-001",
      agent: {
        id: "agent-001",
        companyId: "company-001",
        name: "Test Agent",
        adapterType: "anthropic_api",
        adapterConfig: {},
      },
      runtime: {
        sessionId: null,
        sessionParams: null,
        sessionDisplayId: null,
        taskKey: null,
      },
      config: {
        apiKey: "test-api-key",
        model: "claude-sonnet-4-20250514",
        ...overrides.config,
      },
      context: {
        prompt: "Hello, world!",
        ...overrides.context,
      },
      onLog: vi.fn(async () => {}),
      ...overrides,
    };
  }

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("builds correct API payload and returns result on success", async () => {
    const sseBody = [
      'event: message_start',
      'data: {"type":"message_start","message":{"id":"msg_test","model":"claude-sonnet-4-20250514","usage":{"input_tokens":50,"output_tokens":0}}}',
      '',
      'event: content_block_start',
      'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
      '',
      'event: content_block_delta',
      'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}',
      '',
      'event: content_block_stop',
      'data: {"type":"content_block_stop","index":0}',
      '',
      'event: message_delta',
      'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}',
      '',
      'event: message_stop',
      'data: {"type":"message_stop"}',
      '',
    ].join("\n");

    let capturedRequest: { url: string; init: RequestInit } | null = null;

    globalThis.fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      capturedRequest = { url: url as string, init: init! };
      return new Response(sseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    // Verify request was made correctly
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest!.url).toBe("https://api.anthropic.com/v1/messages");
    const headers = capturedRequest!.init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("test-api-key");
    expect(headers["anthropic-version"]).toBe("2023-06-01");

    const body = JSON.parse(capturedRequest!.init.body as string);
    expect(body.model).toBe("claude-sonnet-4-20250514");
    expect(body.stream).toBe(true);
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");

    // Verify result
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.summary).toBe("Hello!");
    expect(result.provider).toBe("anthropic");
    expect(result.billingType).toBe("api");
    expect(result.model).toBe("claude-sonnet-4-20250514");
    expect(result.usage?.inputTokens).toBe(50);
    expect(result.usage?.outputTokens).toBe(2);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("returns error for missing API key", async () => {
    const ctx = makeCtx({
      config: { model: "claude-sonnet-4-20250514" },
    });
    // Clear env var if set
    const origEnv = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("anthropic_no_api_key");
    expect(result.errorMessage).toContain("No API key");

    // Restore
    if (origEnv) process.env.ANTHROPIC_API_KEY = origEnv;
  });

  it("handles 401 auth error", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "authentication_error", message: "Invalid API key" } }),
        { status: 401 },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("anthropic_auth_error");
    expect(result.errorMessage).toContain("Authentication failed");
  });

  it("handles 429 rate limit", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "rate_limit_error", message: "Rate limit exceeded" } }),
        { status: 429 },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("anthropic_rate_limit");
    expect(result.errorMessage).toContain("Rate limited");
  });

  it("handles 529 overloaded", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "overloaded_error", message: "API is overloaded" } }),
        { status: 529 },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("anthropic_overloaded");
    expect(result.errorMessage).toContain("overloaded");
  });

  it("includes system prompt from context", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        [
          'event: message_start',
          'data: {"type":"message_start","message":{"id":"msg_sys","model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
          '',
          'event: message_delta',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}',
          '',
          'event: message_stop',
          'data: {"type":"message_stop"}',
          '',
        ].join("\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx({
      context: {
        prompt: "Do work",
        systemPrompt: "You are a helpful assistant.",
        soulText: "Be kind.",
      },
    });
    await execute(ctx);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.system).toContain("Be kind.");
    expect(capturedBody!.system).toContain("You are a helpful assistant.");
  });

  it("handles fetch network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network unreachable");
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("anthropic_fetch_error");
    expect(result.errorMessage).toContain("Network unreachable");
  });

  it("passes conversation history as messages", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        [
          'event: message_start',
          'data: {"type":"message_start","message":{"id":"msg_conv","model":"claude-sonnet-4-20250514","usage":{"input_tokens":10,"output_tokens":0}}}',
          '',
          'event: message_delta',
          'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":1}}',
          '',
          'event: message_stop',
          'data: {"type":"message_stop"}',
          '',
        ].join("\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx({
      context: {
        prompt: "Continue",
        conversationHistory: [
          { role: "user", content: "Hello" },
          { role: "assistant", content: "Hi there!" },
        ],
      },
    });
    await execute(ctx);

    expect(capturedBody).not.toBeNull();
    const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
    // History (2) + current prompt (1)
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
    expect(messages[2].role).toBe("user");
  });
});
