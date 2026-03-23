/**
 * Backward-compatible environment variable reader.
 * Checks the new TAC_ prefixed key first, then falls back to the deprecated
 * PAPERCLIP_ prefixed key with a console warning so operators can migrate.
 */
export function envWithFallback(newKey: string, oldKey: string): string | undefined {
  const env = process.env;
  const newVal = env[newKey];
  if (newVal !== undefined) return newVal;
  const oldVal = env[oldKey];
  if (oldVal !== undefined) {
    console.warn(`[deprecation] ${oldKey} is deprecated, use ${newKey} instead`);
    return oldVal;
  }
  return undefined;
}
