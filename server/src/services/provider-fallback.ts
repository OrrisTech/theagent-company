import type {
  ProviderEntry,
  ProviderFallbackConfig,
  ProviderCallResult,
  ProviderSwitchEvent,
} from "@theagentcompany/shared";
import {
  PROVIDER_FALLBACK_RETRYABLE_CODES,
  PROVIDER_FALLBACK_MAX_RETRIES,
} from "@theagentcompany/shared";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "provider-fallback" });

/**
 * Error thrown by provider calls that includes the HTTP status code.
 */
export class ProviderError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.name = "ProviderError";
  }
}

/**
 * Execute a model call with automatic provider fallback.
 *
 * The caller provides:
 * - A fallback config with an ordered list of providers
 * - An executor function that takes a ProviderEntry and returns a result
 *
 * On retryable errors (429, 503, timeout), the system automatically
 * switches to the next provider in the list.
 *
 * @param config - Fallback configuration with ordered provider list
 * @param executor - Async function that calls the provider
 * @param onSwitch - Optional callback invoked on each provider switch
 * @returns The result from the first successful provider
 */
export async function callWithFallback<T>(
  config: ProviderFallbackConfig,
  executor: (provider: ProviderEntry) => Promise<T>,
  onSwitch?: (event: ProviderSwitchEvent) => void,
): Promise<ProviderCallResult<T>> {
  const retryableCodes = new Set(
    config.retryableStatusCodes ?? [...PROVIDER_FALLBACK_RETRYABLE_CODES],
  );
  const maxRetries = config.maxRetries ?? PROVIDER_FALLBACK_MAX_RETRIES;

  let fallbackCount = 0;
  let lastError: string | undefined;
  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries && attempt < config.providers.length; attempt++) {
    const provider = config.providers[attempt]!;

    log.debug(
      { provider: provider.provider, model: provider.model, attempt },
      "Attempting provider call",
    );

    try {
      const callStart = Date.now();
      const data = await executeWithTimeout(
        () => executor(provider),
        provider.timeoutMs ?? 30_000,
      );

      return {
        data,
        success: true,
        provider: provider.provider,
        model: provider.model,
        fallbackCount,
        durationMs: Date.now() - startTime,
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const statusCode = err instanceof ProviderError ? err.statusCode : 0;
      const isTimeout = errorMessage.includes("timeout") || errorMessage.includes("TIMEOUT");
      const isRetryable = retryableCodes.has(statusCode) || isTimeout;

      log.warn(
        { provider: provider.provider, statusCode, isRetryable, error: errorMessage },
        "Provider call failed",
      );

      lastError = errorMessage;

      if (isRetryable && attempt + 1 < config.providers.length) {
        const nextProvider = config.providers[attempt + 1]!;
        fallbackCount++;

        const switchEvent: ProviderSwitchEvent = {
          timestamp: new Date().toISOString(),
          fromProvider: provider.provider,
          toProvider: nextProvider.provider,
          reason: isTimeout ? "timeout" : `HTTP ${statusCode}`,
          statusCode: statusCode || undefined,
        };

        log.info(
          { from: provider.provider, to: nextProvider.provider, reason: switchEvent.reason },
          "Switching to fallback provider",
        );

        onSwitch?.(switchEvent);
        continue;
      }

      // Non-retryable error or exhausted all providers
      return {
        success: false,
        provider: provider.provider,
        model: provider.model,
        fallbackCount,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }

  // Should not reach here, but safety net
  return {
    success: false,
    provider: config.providers[0]?.provider ?? "unknown",
    model: config.providers[0]?.model ?? "unknown",
    fallbackCount,
    error: lastError ?? "All providers exhausted",
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute an async function with a timeout.
 * Throws a ProviderError with status 0 if the timeout is reached.
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new ProviderError(`Provider call timeout after ${timeoutMs}ms`, 0));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
