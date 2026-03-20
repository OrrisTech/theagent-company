import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type {
  UntrustedSource,
  UntrustedContent,
  SensitiveOperation,
  SecurityAuditEntry,
} from "@paperclipai/shared";
import { SENSITIVE_OPERATIONS } from "@paperclipai/shared";
import { logger } from "../middleware/logger.js";

const log = logger.child({ module: "source-sink-security" });

const SENSITIVE_OPS_SET: ReadonlySet<string> = new Set(SENSITIVE_OPERATIONS);

// ---------------------------------------------------------------------------
// Untrusted content wrapping
// ---------------------------------------------------------------------------

/**
 * Wrap external data with source provenance metadata.
 * All data entering the agent context from external sources MUST pass through
 * this function so that downstream processing can identify untrusted content.
 */
export function wrapUntrustedContent(
  source: UntrustedSource,
  content: string,
): UntrustedContent {
  return {
    __untrusted: true,
    source,
    content,
    receivedAt: new Date().toISOString(),
  };
}

/**
 * Check whether a value is wrapped untrusted content.
 */
export function isUntrustedContent(value: unknown): value is UntrustedContent {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).__untrusted === true &&
    typeof (value as Record<string, unknown>).source === "string" &&
    typeof (value as Record<string, unknown>).content === "string"
  );
}

/**
 * Escape untrusted content to prevent prompt injection.
 * Wraps the content in clear delimiters so the LLM can distinguish
 * user/system instructions from external data.
 */
export function escapeForPrompt(wrapped: UntrustedContent): string {
  return [
    `<external_data source="${wrapped.source}" received="${wrapped.receivedAt}">`,
    wrapped.content,
    `</external_data>`,
  ].join("\n");
}

/**
 * Extract the raw content from an untrusted wrapper.
 * Use only when you explicitly want to process the raw data
 * (e.g., for storage or display, not for prompt injection).
 */
export function unwrapContent(wrapped: UntrustedContent): string {
  return wrapped.content;
}

// ---------------------------------------------------------------------------
// Sensitive operation confirmation
// ---------------------------------------------------------------------------

/**
 * Check whether an action requires explicit human confirmation.
 */
export function requiresConfirmation(action: string): boolean {
  return SENSITIVE_OPS_SET.has(action);
}

// ---------------------------------------------------------------------------
// Append-only JSONL audit log
// ---------------------------------------------------------------------------

/** Directory where security audit logs are stored. */
let _auditLogDir: string | null = null;

/**
 * Configure the directory for security audit logs.
 * Must be called once at startup before any audit writes.
 */
export function configureAuditLogDir(dir: string): void {
  _auditLogDir = dir;
}

/**
 * Write a security audit entry as an append-only JSONL line.
 * Each line is a self-contained JSON object for easy parsing.
 */
export async function writeAuditEntry(entry: Omit<SecurityAuditEntry, "id" | "timestamp">): Promise<SecurityAuditEntry> {
  const fullEntry: SecurityAuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  const logDir = _auditLogDir ?? path.join(process.cwd(), "data", "audit");

  try {
    await mkdir(logDir, { recursive: true });

    // File name includes the date for daily rotation
    const date = fullEntry.timestamp.slice(0, 10); // YYYY-MM-DD
    const filePath = path.join(logDir, `security-audit-${date}.jsonl`);

    await appendFile(filePath, JSON.stringify(fullEntry) + "\n", "utf-8");

    log.debug({ entryId: fullEntry.id, action: fullEntry.action }, "Audit entry written");
  } catch (err) {
    // Audit logging must not crash the application
    log.error({ err, entry: fullEntry }, "Failed to write audit entry");
  }

  return fullEntry;
}

/**
 * Convenience: wrap external data AND write an audit entry in one call.
 * Use this at the boundary where external data enters the system.
 */
export async function ingestExternalData(
  source: UntrustedSource,
  content: string,
  companyId: string,
  actorId: string,
  actorType: "agent" | "user" | "system" = "system",
): Promise<UntrustedContent> {
  const wrapped = wrapUntrustedContent(source, content);

  await writeAuditEntry({
    companyId,
    actorId,
    actorType,
    action: "external_data_ingested",
    source,
    details: {
      contentLength: content.length,
      source,
    },
  });

  return wrapped;
}
