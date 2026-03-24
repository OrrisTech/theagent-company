import { describe, expect, it, vi, afterEach } from "vitest";
import { calculateCostUsd, parseSSEResponse } from "../server/execute.js";
import { execute } from "../server/index.js";
import type { AdapterExecutionContext } from "@theagentcompany/adapter-utils";

// ---------------------------------------------------------------------------
// Cost calculation tests
// ---------------------------------------------------------------------------

describe("calculateCostUsd", () => {
  it("calculates cost for gpt-4.1", () => {
    const cost = calculateCostUsd("gpt-4.1", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // $2/MTok in + $8/MTok out = $10
    expect(cost).toBeCloseTo(10, 2);
  });

  it("calculates cost for gpt-4.1-mini", () => {
    const cost = calculateCostUsd("gpt-4.1-mini", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // $0.40/MTok in + $1.60/MTok out = $2.00
    expect(cost).toBeCloseTo(2.0, 2);
  });

  it("calculates cost for gpt-4.1-nano", () => {
    const cost = calculateCostUsd("gpt-4.1-nano", {
      inputTokens: 10_000_000,
      outputTokens: 5_000_000,
    });
    // (10M/1M * $0.10) + (5M/1M * $0.40) = $1.00 + $2.00 = $3.00
    expect(cost).toBeCloseTo(3.0, 2);
  });

  it("calculates cost for o3", () => {
    const cost = calculateCostUsd("o3", {
      inputTokens: 500_000,
      outputTokens: 200_000,
    });
    // (500k/1M * $2) + (200k/1M * $8) = $1.00 + $1.60 = $2.60
    expect(cost).toBeCloseTo(2.6, 2);
  });

  it("calculates cost for o4-mini", () => {
    const cost = calculateCostUsd("o4-mini", {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    });
    // $1.10/MTok in + $4.40/MTok out = $5.50
    expect(cost).toBeCloseTo(5.5, 2);
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
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-123","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":100,"completion_tokens":5,"total_tokens":105}}',
      'data: [DONE]',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.text).toBe("Hello world");
    expect(result.model).toBe("gpt-4.1");
    expect(result.usage.inputTokens).toBe(100);
    expect(result.usage.outputTokens).toBe(5);
    expect(result.stopReason).toBe("stop");
    expect(result.errorMessage).toBeNull();
  });

  it("parses tool_calls", () => {
    const sse = [
      'data: {"id":"chatcmpl-456","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-456","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"location\\":"}}]},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-456","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"San Francisco\\"}"}}]},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-456","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":50,"completion_tokens":30,"total_tokens":80}}',
      'data: [DONE]',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe("get_weather");
    expect(result.toolCalls[0].id).toBe("call_abc");
    expect(result.toolCalls[0].arguments).toEqual({ location: "San Francisco" });
    expect(result.stopReason).toBe("tool_calls");
  });

  it("extracts usage from final chunk", () => {
    const sse = [
      'data: {"id":"chatcmpl-789","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-789","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":200,"completion_tokens":50,"total_tokens":250}}',
      'data: [DONE]',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.usage.inputTokens).toBe(200);
    expect(result.usage.outputTokens).toBe(50);
  });

  it("handles empty/malformed input gracefully", () => {
    const result = parseSSEResponse("");
    expect(result.text).toBe("");
    expect(result.model).toBe("");
    expect(result.usage.inputTokens).toBe(0);
    expect(result.errorMessage).toBeNull();
  });

  it("handles multiple tool_calls in parallel", () => {
    const sse = [
      'data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":null,"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"search","arguments":""}},{"index":1,"id":"call_2","type":"function","function":{"name":"calculate","arguments":""}}]},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\\"q\\":\\"test\\"}"}},{"index":1,"function":{"arguments":"{\\"x\\":42}"}}]},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-multi","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":20,"total_tokens":30}}',
      'data: [DONE]',
    ].join("\n");

    const result = parseSSEResponse(sse);
    expect(result.toolCalls).toHaveLength(2);
    expect(result.toolCalls[0].name).toBe("search");
    expect(result.toolCalls[0].arguments).toEqual({ q: "test" });
    expect(result.toolCalls[1].name).toBe("calculate");
    expect(result.toolCalls[1].arguments).toEqual({ x: 42 });
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
        adapterType: "openai_api",
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
        model: "gpt-4.1",
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
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{"content":"Hello!"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":50,"completion_tokens":2,"total_tokens":52}}',
      'data: [DONE]',
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
    expect(capturedRequest!.url).toBe("https://api.openai.com/v1/chat/completions");
    const headers = capturedRequest!.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-api-key");

    const body = JSON.parse(capturedRequest!.init.body as string);
    expect(body.model).toBe("gpt-4.1");
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.max_tokens).toBe(4096);
    expect(body.max_completion_tokens).toBeUndefined();
    expect(body.messages.at(-1).role).toBe("user");

    // Verify result
    expect(result.exitCode).toBe(0);
    expect(result.timedOut).toBe(false);
    expect(result.summary).toBe("Hello!");
    expect(result.provider).toBe("openai");
    expect(result.billingType).toBe("api");
    expect(result.model).toBe("gpt-4.1");
    expect(result.usage?.inputTokens).toBe(50);
    expect(result.usage?.outputTokens).toBe(2);
    expect(result.costUsd).toBeGreaterThan(0);
  });

  it("uses max_completion_tokens for reasoning models", async () => {
    const sseBody = [
      'data: {"id":"chatcmpl-o3","object":"chat.completion.chunk","model":"o3","choices":[{"index":0,"delta":{"content":"Done"},"finish_reason":null}]}',
      'data: {"id":"chatcmpl-o3","object":"chat.completion.chunk","model":"o3","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11}}',
      'data: [DONE]',
    ].join("\n");

    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(sseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;

    const ctx = makeCtx({ config: { apiKey: "test-key", model: "o3" } });
    const result = await execute(ctx);

    expect(capturedBody).not.toBeNull();
    expect(capturedBody!.max_completion_tokens).toBe(4096);
    expect(capturedBody!.max_tokens).toBeUndefined();
    // Reasoning models should not include temperature
    expect(capturedBody!.temperature).toBeUndefined();
    expect(result.exitCode).toBe(0);
    expect(result.model).toBe("o3");
  });

  it("uses max_completion_tokens for o4-mini", async () => {
    const sseBody = [
      'data: {"id":"chatcmpl-o4m","object":"chat.completion.chunk","model":"o4-mini","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":1,"total_tokens":6}}',
      'data: [DONE]',
    ].join("\n");

    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(sseBody, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }) as unknown as typeof fetch;

    const ctx = makeCtx({ config: { apiKey: "test-key", model: "o4-mini" } });
    await execute(ctx);

    expect(capturedBody!.max_completion_tokens).toBe(4096);
    expect(capturedBody!.max_tokens).toBeUndefined();
  });

  it("returns error for missing API key", async () => {
    const ctx = makeCtx({
      config: { model: "gpt-4.1" },
    });
    // Clear env var if set
    const origEnv = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("openai_no_api_key");
    expect(result.errorMessage).toContain("No API key");

    // Restore
    if (origEnv) process.env.OPENAI_API_KEY = origEnv;
  });

  it("handles 401 auth error", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "invalid_api_key", message: "Invalid API key" } }),
        { status: 401 },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("openai_auth_error");
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
    expect(result.errorCode).toBe("openai_rate_limit");
    expect(result.errorMessage).toContain("Rate limited");
  });

  it("handles 500 server error", async () => {
    globalThis.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { type: "server_error", message: "Internal server error" } }),
        { status: 500 },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("openai_server_error");
    expect(result.errorMessage).toContain("server error");
  });

  it("includes system prompt from context", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        [
          'data: {"id":"chatcmpl-sys","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11}}',
          'data: [DONE]',
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
    const messages = capturedBody!.messages as Array<{ role: string; content: string }>;
    // First message should be system
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toContain("Be kind.");
    expect(messages[0].content).toContain("You are a helpful assistant.");
  });

  it("handles fetch network error", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("Network unreachable");
    }) as unknown as typeof fetch;

    const ctx = makeCtx();
    const result = await execute(ctx);

    expect(result.exitCode).toBe(1);
    expect(result.errorCode).toBe("openai_fetch_error");
    expect(result.errorMessage).toContain("Network unreachable");
  });

  it("passes conversation history as messages", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        [
          'data: {"id":"chatcmpl-conv","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11}}',
          'data: [DONE]',
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
    // History (2) + current prompt (1) — no system message in this case
    expect(messages).toHaveLength(3);
    expect(messages[0]).toEqual({ role: "user", content: "Hello" });
    expect(messages[1]).toEqual({ role: "assistant", content: "Hi there!" });
    expect(messages[2].role).toBe("user");
  });

  it("passes tools in OpenAI function format", async () => {
    let capturedBody: Record<string, unknown> | null = null;

    globalThis.fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = JSON.parse(init?.body as string);
      return new Response(
        [
          'data: {"id":"chatcmpl-tools","object":"chat.completion.chunk","model":"gpt-4.1","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11}}',
          'data: [DONE]',
        ].join("\n"),
        { status: 200, headers: { "Content-Type": "text/event-stream" } },
      );
    }) as unknown as typeof fetch;

    const ctx = makeCtx({
      context: {
        prompt: "Use tools",
        tools: [
          { name: "get_weather", description: "Get weather", parameters: { type: "object", properties: { location: { type: "string" } } } },
        ],
      },
    });
    await execute(ctx);

    expect(capturedBody).not.toBeNull();
    const tools = capturedBody!.tools as Array<{ type: string; function: { name: string } }>;
    expect(tools).toHaveLength(1);
    expect(tools[0].type).toBe("function");
    expect(tools[0].function.name).toBe("get_weather");
  });
});
