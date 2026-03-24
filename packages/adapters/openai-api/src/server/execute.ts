import type {
  AdapterExecutionContext,
  AdapterExecutionResult,
  UsageSummary,
} from "@theagentcompany/adapter-utils";
import {
  asString,
  asNumber,
  parseObject,
  renderTemplate,
  joinPromptSections,
} from "@theagentcompany/adapter-utils/server-utils";

// ---------------------------------------------------------------------------
// Pricing per million tokens (USD) — published OpenAI rates
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "gpt-4.1": { inputPerMTok: 2, outputPerMTok: 8 },
  "gpt-4.1-mini": { inputPerMTok: 0.40, outputPerMTok: 1.60 },
  "gpt-4.1-nano": { inputPerMTok: 0.10, outputPerMTok: 0.40 },
  "o3": { inputPerMTok: 2, outputPerMTok: 8 },
  "o4-mini": { inputPerMTok: 1.10, outputPerMTok: 4.40 },
};

// Reasoning models use max_completion_tokens instead of max_tokens
const REASONING_MODELS = new Set(["o3", "o4-mini"]);

/** Calculate cost in USD from token counts and model pricing. */
export function calculateCostUsd(
  model: string,
  usage: UsageSummary,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  return inputCost + outputCost;
}

// ---------------------------------------------------------------------------
// SSE stream parsing types (OpenAI format)
// ---------------------------------------------------------------------------

interface OpenAIDelta {
  role?: string;
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

interface OpenAIChoice {
  index: number;
  delta: OpenAIDelta;
  finish_reason: string | null;
}

interface OpenAIChunk {
  id: string;
  object: string;
  model: string;
  choices: OpenAIChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Parsed result structure
// ---------------------------------------------------------------------------

export interface ParsedSSEResult {
  text: string;
  model: string;
  usage: UsageSummary;
  stopReason: string | null;
  toolCalls: Array<{ id: string; name: string; arguments: unknown }>;
  errorMessage: string | null;
}

/**
 * Parse a complete SSE response body into a structured result.
 * Used for testing; the streaming path processes events incrementally.
 */
export function parseSSEResponse(body: string): ParsedSSEResult {
  const result: ParsedSSEResult = {
    text: "",
    model: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: null,
    toolCalls: [],
    errorMessage: null,
  };

  // Track tool_calls assembly by index
  const toolCallMap = new Map<number, { id: string; name: string; args: string }>();

  const lines = body.split("\n");

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice(6).trim();

    // OpenAI signals end of stream with [DONE]
    if (data === "[DONE]") break;

    try {
      const chunk = JSON.parse(data) as OpenAIChunk;
      processChunk(chunk, result, toolCallMap);
    } catch {
      // Skip malformed JSON lines
    }
  }

  // Finalize tool calls
  for (const [, tc] of toolCallMap) {
    let parsedArgs: unknown = {};
    try {
      parsedArgs = JSON.parse(tc.args);
    } catch {
      parsedArgs = tc.args;
    }
    result.toolCalls.push({ id: tc.id, name: tc.name, arguments: parsedArgs });
  }

  return result;
}

function processChunk(
  chunk: OpenAIChunk,
  result: ParsedSSEResult,
  toolCallMap: Map<number, { id: string; name: string; args: string }>,
): void {
  if (!result.model && chunk.model) {
    result.model = chunk.model;
  }

  // Extract usage from the final chunk (OpenAI includes it in the last chunk when stream_options.include_usage is set)
  if (chunk.usage) {
    result.usage.inputTokens = chunk.usage.prompt_tokens;
    result.usage.outputTokens = chunk.usage.completion_tokens;
  }

  for (const choice of chunk.choices) {
    const delta = choice.delta;

    // Accumulate text content
    if (delta.content) {
      result.text += delta.content;
    }

    // Accumulate tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const existing = toolCallMap.get(tc.index);
        if (!existing) {
          toolCallMap.set(tc.index, {
            id: tc.id ?? "",
            name: tc.function?.name ?? "",
            args: tc.function?.arguments ?? "",
          });
        } else {
          if (tc.function?.arguments) {
            existing.args += tc.function.arguments;
          }
        }
      }
    }

    // Capture finish reason
    if (choice.finish_reason) {
      result.stopReason = choice.finish_reason;
    }
  }
}

// ---------------------------------------------------------------------------
// Streaming SSE reader — processes the response body incrementally
// ---------------------------------------------------------------------------

async function readSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onLog: (stream: "stdout" | "stderr", chunk: string) => Promise<void>,
): Promise<ParsedSSEResult> {
  const decoder = new TextDecoder();
  const result: ParsedSSEResult = {
    text: "",
    model: "",
    usage: { inputTokens: 0, outputTokens: 0 },
    stopReason: null,
    toolCalls: [],
    errorMessage: null,
  };
  const toolCallMap = new Map<number, { id: string; name: string; args: string }>();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split("\n");
    // Keep the last potentially incomplete line in the buffer
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();

      if (data === "[DONE]") continue;

      try {
        const chunk = JSON.parse(data) as OpenAIChunk;

        // Stream text deltas to the log output for real-time display
        for (const choice of chunk.choices) {
          if (choice.delta.content) {
            await onLog("stdout", choice.delta.content);
          }
        }

        processChunk(chunk, result, toolCallMap);
      } catch {
        // Skip malformed event data
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    const line = buffer.trim();
    if (line.startsWith("data: ")) {
      const data = line.slice(6).trim();
      if (data !== "[DONE]") {
        try {
          const chunk = JSON.parse(data) as OpenAIChunk;
          for (const choice of chunk.choices) {
            if (choice.delta.content) {
              await onLog("stdout", choice.delta.content);
            }
          }
          processChunk(chunk, result, toolCallMap);
        } catch {
          // Skip malformed data
        }
      }
    }
  }

  // Finalize tool calls
  for (const [, tc] of toolCallMap) {
    let parsedArgs: unknown = {};
    try {
      parsedArgs = JSON.parse(tc.args);
    } catch {
      parsedArgs = tc.args;
    }
    result.toolCalls.push({ id: tc.id, name: tc.name, arguments: parsedArgs });
  }

  return result;
}

// ---------------------------------------------------------------------------
// Error classification helpers
// ---------------------------------------------------------------------------

function classifyHttpError(status: number, body: string): { errorMessage: string; errorCode: string } {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string; type?: string } };
    detail = parsed.error?.message ?? "";
  } catch {
    detail = body.slice(0, 200);
  }

  switch (status) {
    case 401:
      return {
        errorMessage: `Authentication failed: ${detail || "invalid API key"}`,
        errorCode: "openai_auth_error",
      };
    case 429:
      return {
        errorMessage: `Rate limited: ${detail || "too many requests"}`,
        errorCode: "openai_rate_limit",
      };
    case 500:
    case 502:
    case 503:
      return {
        errorMessage: `OpenAI API server error (${status}): ${detail || "service temporarily unavailable"}`,
        errorCode: "openai_server_error",
      };
    default:
      return {
        errorMessage: `OpenAI API error (${status}): ${detail || "unknown error"}`,
        errorCode: "openai_api_error",
      };
  }
}

// ---------------------------------------------------------------------------
// Build OpenAI API request body
// ---------------------------------------------------------------------------

interface OpenAIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenAIRequestBody {
  model: string;
  stream: boolean;
  stream_options: { include_usage: boolean };
  messages: OpenAIMessage[];
  max_tokens?: number;
  max_completion_tokens?: number;
  temperature?: number;
  tools?: Array<{
    type: "function";
    function: { name: string; description?: string; parameters?: unknown };
  }>;
}

function buildRequestBody(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
  prompt: string,
): OpenAIRequestBody {
  const model = asString(config.model, "gpt-4.1");
  const maxTokens = asNumber(config.maxTokens, 4096);
  const temperature = config.temperature != null ? asNumber(config.temperature, -1) : -1;
  const isReasoningModel = REASONING_MODELS.has(model);

  // Build system prompt from context parts
  const soulText = asString(context.soulText, "");
  const systemPromptFromContext = asString(context.systemPrompt, "");
  const systemPromptFromConfig = asString(config.systemPrompt, "");
  const skillText = asString(context.skillText, "");
  const systemPrompt = joinPromptSections([soulText, systemPromptFromConfig || systemPromptFromContext, skillText]);

  // Build messages array — OpenAI uses a system message in the messages array
  const messages: OpenAIMessage[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Include conversation history if provided
  const conversationHistory = context.conversationHistory;
  if (Array.isArray(conversationHistory)) {
    for (const msg of conversationHistory) {
      if (typeof msg === "object" && msg !== null && !Array.isArray(msg)) {
        const record = msg as Record<string, unknown>;
        const role = asString(record.role, "");
        const content = asString(record.content, "");
        if ((role === "user" || role === "assistant") && content) {
          messages.push({ role, content });
        }
      }
    }
  }

  // Add the current prompt as the final user message
  messages.push({ role: "user", content: prompt });

  const body: OpenAIRequestBody = {
    model,
    stream: true,
    stream_options: { include_usage: true },
    messages,
  };

  // Reasoning models use max_completion_tokens; regular models use max_tokens
  if (isReasoningModel) {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
  }

  // Reasoning models don't support temperature
  if (temperature >= 0 && !isReasoningModel) {
    body.temperature = temperature;
  }

  // Pass through tool definitions if provided (convert to OpenAI format)
  const tools = context.tools;
  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools.map((tool) => {
      const t = tool as Record<string, unknown>;
      return {
        type: "function" as const,
        function: {
          name: asString(t.name, ""),
          description: asString(t.description, ""),
          parameters: t.parameters ?? t.input_schema,
        },
      };
    });
  }

  return body;
}

// ---------------------------------------------------------------------------
// Main execute function
// ---------------------------------------------------------------------------

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;
  const configObj = parseObject(config);

  // Resolve API key — adapter config takes precedence, then env var
  const envConfig = parseObject(configObj.env);
  const apiKey =
    asString(configObj.apiKey, "") ||
    asString(envConfig.OPENAI_API_KEY as string, "") ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No API key configured. Set apiKey in adapter config or OPENAI_API_KEY environment variable.",
      errorCode: "openai_no_api_key",
    };
  }

  const model = asString(configObj.model, "gpt-4.1");
  const timeoutSec = asNumber(configObj.timeoutSec, 300);

  // Build prompt from template and context
  const promptTemplate = asString(
    configObj.promptTemplate,
    "You are agent {{agent.id}} ({{agent.name}}). Continue your The Agent Company work.",
  );
  const templateData = {
    agentId: agent.id,
    companyId: agent.companyId,
    runId,
    company: { id: agent.companyId },
    agent,
    run: { id: runId, source: "on_demand" },
    context,
  };
  const renderedPrompt = renderTemplate(promptTemplate, templateData);
  const contextPrompt = asString(context.prompt, "");
  const prompt = joinPromptSections([renderedPrompt, contextPrompt]);

  // Build request body
  const requestBody = buildRequestBody(configObj, context, prompt);

  if (onMeta) {
    await onMeta({
      adapterType: "openai_api",
      command: "fetch",
      prompt,
      context,
    });
  }

  await onLog("stderr", `[tac] Calling OpenAI API: model=${model}, maxTokens=${requestBody.max_tokens ?? requestBody.max_completion_tokens}\n`);

  // Make the API request with streaming
  const controller = new AbortController();
  const timeout = timeoutSec > 0
    ? setTimeout(() => controller.abort(), timeoutSec * 1000)
    : null;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      const { errorMessage, errorCode } = classifyHttpError(response.status, errorBody);
      await onLog("stderr", `[tac] ${errorMessage}\n`);
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage,
        errorCode,
        provider: "openai",
        model,
        billingType: "api",
      };
    }

    if (!response.body) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "No response body received from OpenAI API",
        errorCode: "openai_empty_response",
        provider: "openai",
        model,
        billingType: "api",
      };
    }

    // Stream and parse the SSE response
    const reader = response.body.getReader();
    const parsed = await readSSEStream(reader, onLog);

    if (parsed.errorMessage) {
      await onLog("stderr", `[tac] Stream error: ${parsed.errorMessage}\n`);
    }

    const usage: UsageSummary = parsed.usage;
    const costUsd = calculateCostUsd(parsed.model || model, usage);

    // Build result JSON including tool calls if present
    const resultJson: Record<string, unknown> = {};
    if (parsed.toolCalls.length > 0) {
      resultJson.toolCalls = parsed.toolCalls;
    }
    resultJson.stopReason = parsed.stopReason;

    return {
      exitCode: parsed.errorMessage ? 1 : 0,
      signal: null,
      timedOut: false,
      errorMessage: parsed.errorMessage,
      usage,
      provider: "openai",
      biller: "openai",
      model: parsed.model || model,
      billingType: "api",
      costUsd,
      resultJson,
      summary: parsed.text,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      await onLog("stderr", `[tac] Request timed out after ${timeoutSec}s\n`);
      return {
        exitCode: null,
        signal: null,
        timedOut: true,
        errorMessage: `Request timed out after ${timeoutSec}s`,
        errorCode: "timeout",
        provider: "openai",
        model,
        billingType: "api",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    await onLog("stderr", `[tac] Fetch error: ${message}\n`);
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: `Failed to call OpenAI API: ${message}`,
      errorCode: "openai_fetch_error",
      provider: "openai",
      model,
      billingType: "api",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
