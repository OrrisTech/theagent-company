export const type = "openai_api";
export const label = "OpenAI API";

export const models = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
  { id: "gpt-4.1-nano", label: "GPT-4.1 Nano" },
  { id: "o3", label: "o3" },
  { id: "o4-mini", label: "o4-mini" },
];

export const agentConfigurationDoc = `# openai_api agent configuration

Adapter: openai_api

Calls the OpenAI Chat Completions API directly via HTTPS. Designed for cloud
deployments where a local CLI is not installed.

Core fields:
- apiKey (string, optional): OpenAI API key. Falls back to process.env.OPENAI_API_KEY.
- model (string, optional): Model id (e.g. gpt-4.1). Defaults to gpt-4.1.
- maxTokens (number, optional): Maximum output tokens per response. Defaults to 4096.
- temperature (number, optional): Sampling temperature (0-2).
- systemPrompt (string, optional): Additional system prompt text prepended to the conversation.
- promptTemplate (string, optional): Run prompt template.
- timeoutSec (number, optional): Request timeout in seconds. Defaults to 300.

Notes:
- Uses native fetch() with SSE streaming — no external SDK dependency.
- Billing type is always "api".
- Cost is calculated from token usage at published OpenAI pricing.
- Reasoning models (o3, o4-mini) use max_completion_tokens instead of max_tokens.
`;
