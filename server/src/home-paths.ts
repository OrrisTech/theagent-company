import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { envWithFallback } from "@theagentcompany/shared";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const PATH_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;
const FRIENDLY_PATH_SEGMENT_RE = /[^a-zA-Z0-9._-]+/g;

function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function resolveTacHomeDir(): string {
  const envHome = envWithFallback("TAC_HOME", "PAPERCLIP_HOME")?.trim();
  if (envHome) return path.resolve(expandHomePrefix(envHome));
  // Default to ~/.tac; fall back to legacy ~/.paperclip if it exists
  const tacDir = path.resolve(os.homedir(), ".tac");
  const legacyDir = path.resolve(os.homedir(), ".paperclip");
  if (!fs.existsSync(tacDir) && fs.existsSync(legacyDir)) {
    console.warn("[deprecation] ~/.paperclip is deprecated, migrate to ~/.tac");
    return legacyDir;
  }
  return tacDir;
}

export function resolveTacInstanceId(): string {
  const raw = process.env.TAC_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(`Invalid TAC_INSTANCE_ID '${raw}'.`);
  }
  return raw;
}

export function resolveTacInstanceRoot(): string {
  return path.resolve(resolveTacHomeDir(), "instances", resolveTacInstanceId());
}

export function resolveDefaultConfigPath(): string {
  return path.resolve(resolveTacInstanceRoot(), "config.json");
}

export function resolveDefaultEmbeddedPostgresDir(): string {
  return path.resolve(resolveTacInstanceRoot(), "db");
}

export function resolveDefaultLogsDir(): string {
  return path.resolve(resolveTacInstanceRoot(), "logs");
}

export function resolveDefaultSecretsKeyFilePath(): string {
  return path.resolve(resolveTacInstanceRoot(), "secrets", "master.key");
}

export function resolveDefaultStorageDir(): string {
  return path.resolve(resolveTacInstanceRoot(), "data", "storage");
}

export function resolveDefaultBackupDir(): string {
  return path.resolve(resolveTacInstanceRoot(), "data", "backups");
}

export function resolveDefaultAgentWorkspaceDir(agentId: string): string {
  const trimmed = agentId.trim();
  if (!PATH_SEGMENT_RE.test(trimmed)) {
    throw new Error(`Invalid agent id for workspace path '${agentId}'.`);
  }
  return path.resolve(resolveTacInstanceRoot(), "workspaces", trimmed);
}

function sanitizeFriendlyPathSegment(value: string | null | undefined, fallback = "_default"): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return fallback;
  const sanitized = trimmed
    .replace(FRIENDLY_PATH_SEGMENT_RE, "-")
    .replace(/^-+|-+$/g, "");
  return sanitized || fallback;
}

export function resolveManagedProjectWorkspaceDir(input: {
  companyId: string;
  projectId: string;
  repoName?: string | null;
}): string {
  const companyId = input.companyId.trim();
  const projectId = input.projectId.trim();
  if (!companyId || !projectId) {
    throw new Error("Managed project workspace path requires companyId and projectId.");
  }
  return path.resolve(
    resolveTacInstanceRoot(),
    "projects",
    sanitizeFriendlyPathSegment(companyId, "company"),
    sanitizeFriendlyPathSegment(projectId, "project"),
    sanitizeFriendlyPathSegment(input.repoName, "_default"),
  );
}

export function resolveHomeAwarePath(value: string): string {
  return path.resolve(expandHomePrefix(value));
}
