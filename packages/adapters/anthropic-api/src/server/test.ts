import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@theagentcompany/adapter-utils";
import { asString, parseObject } from "@theagentcompany/adapter-utils/server-utils";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_API_VERSION = "2023-06-01";

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
    asString(envConfig.ANTHROPIC_API_KEY as string, "") ||
    process.env.ANTHROPIC_API_KEY ||
    "";

  if (!apiKey) {
    checks.push({
      code: "anthropic_api_key_missing",
      level: "error",
      message: "No Anthropic API key found.",
      hint: "Set apiKey in adapter config or ANTHROPIC_API_KEY environment variable.",
    });
    return {
      adapterType: ctx.adapterType,
      status: summarizeStatus(checks),
      checks,
      testedAt: new Date().toISOString(),
    };
  }

  checks.push({
    code: "anthropic_api_key_present",
    level: "info",
    message: "Anthropic API key is configured.",
  });

  // Verify the key works with a minimal API call (1 token output)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
      },
      body: JSON.stringify({
        model: asString(config.model, "claude-3-5-haiku-20241022"),
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      checks.push({
        code: "anthropic_api_probe_passed",
        level: "info",
        message: "Anthropic API probe succeeded — key is valid.",
      });
    } else if (response.status === 401) {
      checks.push({
        code: "anthropic_api_probe_auth_failed",
        level: "error",
        message: "Anthropic API key is invalid (401 Unauthorized).",
        hint: "Check that your API key is correct and active at console.anthropic.com.",
      });
    } else if (response.status === 429) {
      // Rate-limited but key is valid
      checks.push({
        code: "anthropic_api_probe_rate_limited",
        level: "warn",
        message: "Anthropic API returned 429 (rate limited). Key appears valid but is currently rate-limited.",
        hint: "Wait a moment and retry, or check your usage limits at console.anthropic.com.",
      });
    } else {
      const body = await response.text().catch(() => "");
      checks.push({
        code: "anthropic_api_probe_error",
        level: "warn",
        message: `Anthropic API probe returned status ${response.status}.`,
        detail: body.slice(0, 200) || null,
      });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof DOMException && err.name === "AbortError") {
      checks.push({
        code: "anthropic_api_probe_timeout",
        level: "warn",
        message: "Anthropic API probe timed out after 15s.",
        hint: "Check network connectivity to api.anthropic.com.",
      });
    } else {
      checks.push({
        code: "anthropic_api_probe_network_error",
        level: "warn",
        message: `Anthropic API probe failed: ${message}`,
        hint: "Check network connectivity to api.anthropic.com.",
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
