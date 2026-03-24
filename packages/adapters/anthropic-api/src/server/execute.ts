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
// Pricing per million tokens (USD) — published Anthropic rates
// ---------------------------------------------------------------------------

const MODEL_PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  "claude-sonnet-4-20250514": { inputPerMTok: 3, outputPerMTok: 15 },
  "claude-opus-4-20250514": { inputPerMTok: 15, outputPerMTok: 75 },
  "claude-3-5-haiku-20241022": { inputPerMTok: 0.80, outputPerMTok: 4 },
};

/** Calculate cost in USD from token counts and model pricing. */
export function calculateCostUsd(
  model: string,
  usage: UsageSummary,
): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;
  // Cached input tokens are billed at 10% of the input price
  const nonCachedInput = usage.inputTokens - (usage.cachedInputTokens ?? 0);
  const cachedInput = usage.cachedInputTokens ?? 0;
  const inputCost = (nonCachedInput / 1_000_000) * pricing.inputPerMTok;
  const cachedCost = (cachedInput / 1_000_000) * pricing.inputPerMTok * 0.1;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  return inputCost + cachedCost + outputCost;
}

// ---------------------------------------------------------------------------
// SSE stream parsing types
// ---------------------------------------------------------------------------

interface MessageStartEvent {
  type: "message_start";
  message: {
    id: string;
    model: string;
    usage: {
      input_tokens: number;
      output_tokens: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
}

interface ContentBlockStartEvent {
  type: "content_block_start";
  index: number;
  content_block: {
    type: "text" | "tool_use";
    text?: string;
    id?: string;
    name?: string;
    input?: unknown;
  };
}

interface ContentBlockDeltaEvent {
  type: "content_block_delta";
  index: number;
  delta: {
    type: "text_delta" | "input_json_delta";
    text?: string;
    partial_json?: string;
  };
}

interface MessageDeltaEvent {
  type: "message_delta";
  delta: {
    stop_reason: string | null;
    stop_sequence: string | null;
  };
  usage: {
    output_tokens: number;
  };
}

type SSEEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | { type: "content_block_stop"; index: number }
  | MessageDeltaEvent
  | { type: "message_stop" }
  | { type: "ping" }
  | { type: "error"; error: { type: string; message: string } };

// ---------------------------------------------------------------------------
// SSE line parser — processes raw SSE text into structured events
// ---------------------------------------------------------------------------

export interface ParsedSSEResult {
  text: string;
  model: string;
  usage: UsageSummary;
  stopReason: string | null;
  toolUseBlocks: Array<{ id: string; name: string; input: unknown }>;
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
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    stopReason: null,
    toolUseBlocks: [],
    errorMessage: null,
  };

  // Track content blocks for tool_use assembly
  const contentBlocks = new Map<number, { type: string; id?: string; name?: string; inputJson: string }>();

  const lines = body.split("\n");
  let currentEventData = "";

  for (const line of lines) {
    if (line.startsWith("event: ")) {
      // Reset data accumulator for new event
      currentEventData = "";
      continue;
    }
    if (line.startsWith("data: ")) {
      currentEventData += line.slice(6);
      continue;
    }
    if (line.trim() === "" && currentEventData) {
      // End of event — parse accumulated data
      try {
        const event = JSON.parse(currentEventData) as SSEEvent;
        processEvent(event, result, contentBlocks);
      } catch {
        // Skip malformed JSON lines
      }
      currentEventData = "";
    }
  }

  // Process any remaining data
  if (currentEventData) {
    try {
      const event = JSON.parse(currentEventData) as SSEEvent;
      processEvent(event, result, contentBlocks);
    } catch {
      // Skip malformed JSON
    }
  }

  return result;
}

function processEvent(
  event: SSEEvent,
  result: ParsedSSEResult,
  contentBlocks: Map<number, { type: string; id?: string; name?: string; inputJson: string }>,
): void {
  switch (event.type) {
    case "message_start":
      result.model = event.message.model;
      result.usage.inputTokens = event.message.usage.input_tokens;
      result.usage.outputTokens = event.message.usage.output_tokens;
      result.usage.cachedInputTokens = event.message.usage.cache_read_input_tokens ?? 0;
      break;

    case "content_block_start":
      if (event.content_block.type === "tool_use") {
        contentBlocks.set(event.index, {
          type: "tool_use",
          id: event.content_block.id,
          name: event.content_block.name,
          inputJson: "",
        });
      } else {
        contentBlocks.set(event.index, { type: "text", inputJson: "" });
        if (event.content_block.text) {
          result.text += event.content_block.text;
        }
      }
      break;

    case "content_block_delta":
      if (event.delta.type === "text_delta" && event.delta.text) {
        result.text += event.delta.text;
      } else if (event.delta.type === "input_json_delta" && event.delta.partial_json) {
        const block = contentBlocks.get(event.index);
        if (block) {
          block.inputJson += event.delta.partial_json;
        }
      }
      break;

    case "content_block_stop": {
      const block = contentBlocks.get(event.index);
      if (block?.type === "tool_use" && block.id && block.name) {
        let parsedInput: unknown = {};
        try {
          parsedInput = JSON.parse(block.inputJson);
        } catch {
          parsedInput = block.inputJson;
        }
        result.toolUseBlocks.push({ id: block.id, name: block.name, input: parsedInput });
      }
      break;
    }

    case "message_delta":
      result.stopReason = event.delta.stop_reason;
      result.usage.outputTokens = event.usage.output_tokens;
      break;

    case "error":
      result.errorMessage = event.error.message;
      break;

    default:
      break;
  }
}

// ---------------------------------------------------------------------------
// Build Anthropic API request body
// ---------------------------------------------------------------------------

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
}

interface AnthropicRequestBody {
  model: string;
  max_tokens: number;
  stream: boolean;
  messages: AnthropicMessage[];
  system?: string;
  temperature?: number;
  tools?: unknown[];
}

function buildRequestBody(
  config: Record<string, unknown>,
  context: Record<string, unknown>,
  prompt: string,
): AnthropicRequestBody {
  const model = asString(config.model, "claude-sonnet-4-20250514");
  const maxTokens = asNumber(config.maxTokens, 4096);
  const temperature = config.temperature != null ? asNumber(config.temperature, -1) : -1;

  // Build system prompt from context parts
  const soulText = asString(context.soulText, "");
  const systemPromptFromContext = asString(context.systemPrompt, "");
  const systemPromptFromConfig = asString(config.systemPrompt, "");
  const skillText = asString(context.skillText, "");
  const systemPrompt = joinPromptSections([soulText, systemPromptFromConfig || systemPromptFromContext, skillText]);

  // Build messages array
  const messages: AnthropicMessage[] = [];

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

  const body: AnthropicRequestBody = {
    model,
    max_tokens: maxTokens,
    stream: true,
    messages,
  };

  if (systemPrompt) {
    body.system = systemPrompt;
  }

  if (temperature >= 0) {
    body.temperature = temperature;
  }

  // Pass through tool definitions if provided
  const tools = context.tools;
  if (Array.isArray(tools) && tools.length > 0) {
    body.tools = tools;
  }

  return body;
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
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
    stopReason: null,
    toolUseBlocks: [],
    errorMessage: null,
  };
  const contentBlocks = new Map<number, { type: string; id?: string; name?: string; inputJson: string }>();

  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete SSE events (separated by double newlines)
    const parts = buffer.split("\n\n");
    // Keep the last incomplete part in the buffer
    buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;

      let eventData = "";
      for (const line of part.split("\n")) {
        if (line.startsWith("data: ")) {
          eventData += line.slice(6);
        }
      }

      if (!eventData) continue;

      try {
        const event = JSON.parse(eventData) as SSEEvent;

        // Stream text deltas to the log output for real-time display
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
          await onLog("stdout", event.delta.text);
        }

        processEvent(event, result, contentBlocks);
      } catch {
        // Skip malformed event data
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    let eventData = "";
    for (const line of buffer.split("\n")) {
      if (line.startsWith("data: ")) {
        eventData += line.slice(6);
      }
    }
    if (eventData) {
      try {
        const event = JSON.parse(eventData) as SSEEvent;
        if (event.type === "content_block_delta" && event.delta.type === "text_delta" && event.delta.text) {
          await onLog("stdout", event.delta.text);
        }
        processEvent(event, result, contentBlocks);
      } catch {
        // Skip malformed data
      }
    }
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
        errorCode: "anthropic_auth_error",
      };
    case 429:
      return {
        errorMessage: `Rate limited: ${detail || "too many requests"}`,
        errorCode: "anthropic_rate_limit",
      };
    case 529:
      return {
        errorMessage: `Anthropic API overloaded: ${detail || "service temporarily unavailable"}`,
        errorCode: "anthropic_overloaded",
      };
    default:
      return {
        errorMessage: `Anthropic API error (${status}): ${detail || "unknown error"}`,
        errorCode: "anthropic_api_error",
      };
  }
}

// ---------------------------------------------------------------------------
// Main execute function
// ---------------------------------------------------------------------------

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { runId, agent, config, context, onLog, onMeta } = ctx;
  const configObj = parseObject(config);

  // Resolve API key — adapter config takes precedence, then env var
  const envConfig = parseObject(configObj.env);
  const apiKey =
    asString(configObj.apiKey, "") ||
    asString(envConfig.ANTHROPIC_API_KEY as string, "") ||
    process.env.ANTHROPIC_API_KEY ||
    "";

  if (!apiKey) {
    return {
      exitCode: 1,
      signal: null,
      timedOut: false,
      errorMessage: "No API key configured. Set apiKey in adapter config or ANTHROPIC_API_KEY environment variable.",
      errorCode: "anthropic_no_api_key",
    };
  }

  const model = asString(configObj.model, "claude-sonnet-4-20250514");
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
      adapterType: "anthropic_api",
      command: "fetch",
      prompt,
      context,
    });
  }

  await onLog("stderr", `[tac] Calling Anthropic API: model=${model}, maxTokens=${requestBody.max_tokens}\n`);

  // Make the API request with streaming
  const controller = new AbortController();
  const timeout = timeoutSec > 0
    ? setTimeout(() => controller.abort(), timeoutSec * 1000)
    : null;

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
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
        provider: "anthropic",
        model,
        billingType: "api",
      };
    }

    if (!response.body) {
      return {
        exitCode: 1,
        signal: null,
        timedOut: false,
        errorMessage: "No response body received from Anthropic API",
        errorCode: "anthropic_empty_response",
        provider: "anthropic",
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

    // Build result JSON including tool_use blocks if present
    const resultJson: Record<string, unknown> = {};
    if (parsed.toolUseBlocks.length > 0) {
      resultJson.toolUseBlocks = parsed.toolUseBlocks;
    }
    resultJson.stopReason = parsed.stopReason;

    return {
      exitCode: parsed.errorMessage ? 1 : 0,
      signal: null,
      timedOut: false,
      errorMessage: parsed.errorMessage,
      usage,
      provider: "anthropic",
      biller: "anthropic",
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
        provider: "anthropic",
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
      errorMessage: `Failed to call Anthropic API: ${message}`,
      errorCode: "anthropic_fetch_error",
      provider: "anthropic",
      model,
      billingType: "api",
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
