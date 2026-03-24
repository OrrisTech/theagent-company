import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@theagentcompany/adapter-utils";
import { asString, parseObject } from "@theagentcompany/adapter-utils/server-utils";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const envConfig = parseObject(config.env);

  // Resolve API key — adapter config takes precedence, then env var
  const apiKey =
    asString(config.apiKey, "") ||
    asString(envConfig.OPENAI_API_KEY as string, "") ||
    process.env.OPENAI_API_KEY ||
    "";

  if (!apiKey) {
    checks.push({
      code: "openai_api_key_missing",
      level: "error",
      message: "No OpenAI API key found.",
      hint: "Set apiKey in adapter config or OPENAI_API_KEY environment variable.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "openai_api_key_present",
    level: "info",
    message: "OpenAI API key is configured.",
  });

  // Verify the key works with a minimal API call (1 token output)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: asString(config.model, "gpt-4.1-nano"),
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      checks.push({
        code: "openai_api_probe_passed",
        level: "info",
        message: "OpenAI API probe succeeded — key is valid.",
      });
    } else if (response.status === 401) {
      checks.push({
        code: "openai_api_probe_auth_failed",
        level: "error",
        message: "OpenAI API key is invalid (401 Unauthorized).",
        hint: "Check that your API key is correct and active at platform.openai.com.",
      });
    } else if (response.status === 429) {
      // Rate-limited but key is valid
      checks.push({
        code: "openai_api_probe_rate_limited",
        level: "warn",
        message: "OpenAI API returned 429 (rate limited). Key appears valid but is currently rate-limited.",
        hint: "Wait a moment and retry, or check your usage limits at platform.openai.com.",
      });
    } else {
      const body = await response.text().catch(() => "");
      checks.push({
        code: "openai_api_probe_error",
        level: "warn",
        message: `OpenAI API probe returned status ${response.status}.`,
        detail: body.slice(0, 200) || null,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      checks.push({
        code: "openai_api_probe_timeout",
        level: "warn",
        message: "OpenAI API probe timed out after 15s.",
        hint: "Check network connectivity to api.openai.com.",
      });
    } else {
      checks.push({
        code: "openai_api_probe_network_error",
        level: "warn",
        message: `OpenAI API probe failed: ${message}`,
        hint: "Check network connectivity to api.openai.com.",
      });
    }
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}
