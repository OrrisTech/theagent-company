export const type = "anthropic_api";
export const label = "Anthropic API";

export const models = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-3-5-haiku-20241022", label: "Claude 3.5 Haiku" },
];

export const agentConfigurationDoc = `# anthropic_api agent configuration

Adapter: anthropic_api

Calls the Anthropic Messages API directly via HTTPS. Designed for cloud
deployments where the Claude CLI is not installed.

Core fields:
- apiKey (string, optional): Anthropic API key. Falls back to process.env.ANTHROPIC_API_KEY.
- model (string, optional): Model id (e.g. claude-sonnet-4-20250514). Defaults to claude-sonnet-4-20250514.
- maxTokens (number, optional): Maximum output tokens per response. Defaults to 4096.
- temperature (number, optional): Sampling temperature (0-1).
- systemPrompt (string, optional): Additional system prompt text prepended to the conversation.
- promptTemplate (string, optional): Run prompt template.
- timeoutSec (number, optional): Request timeout in seconds. Defaults to 300.

Notes:
- Uses native fetch() with SSE streaming — no external SDK dependency.
- Billing type is always "api".
- Cost is calculated from token usage at published Anthropic pricing.
`;
