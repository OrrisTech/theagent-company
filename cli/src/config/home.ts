import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { envWithFallback } from "@theagentcompany/shared";

const DEFAULT_INSTANCE_ID = "default";
const INSTANCE_ID_RE = /^[a-zA-Z0-9_-]+$/;

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

export function resolveTacInstanceId(override?: string): string {
  const raw = override?.trim() || process.env.TAC_INSTANCE_ID?.trim() || DEFAULT_INSTANCE_ID;
  if (!INSTANCE_ID_RE.test(raw)) {
    throw new Error(
      `Invalid instance id '${raw}'. Allowed characters: letters, numbers, '_' and '-'.`,
    );
  }
  return raw;
}

export function resolveTacInstanceRoot(instanceId?: string): string {
  const id = resolveTacInstanceId(instanceId);
  return path.resolve(resolveTacHomeDir(), "instances", id);
}

export function resolveDefaultConfigPath(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "config.json");
}

export function resolveDefaultContextPath(): string {
  return path.resolve(resolveTacHomeDir(), "context.json");
}

export function resolveDefaultEmbeddedPostgresDir(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "db");
}

export function resolveDefaultLogsDir(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "logs");
}

export function resolveDefaultSecretsKeyFilePath(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "secrets", "master.key");
}

export function resolveDefaultStorageDir(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "data", "storage");
}

export function resolveDefaultBackupDir(instanceId?: string): string {
  return path.resolve(resolveTacInstanceRoot(instanceId), "data", "backups");
}

export function expandHomePrefix(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.resolve(os.homedir(), value.slice(2));
  return value;
}

export function describeLocalInstancePaths(instanceId?: string) {
  const resolvedInstanceId = resolveTacInstanceId(instanceId);
  const instanceRoot = resolveTacInstanceRoot(resolvedInstanceId);
  return {
    homeDir: resolveTacHomeDir(),
    instanceId: resolvedInstanceId,
    instanceRoot,
    configPath: resolveDefaultConfigPath(resolvedInstanceId),
    embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(resolvedInstanceId),
    backupDir: resolveDefaultBackupDir(resolvedInstanceId),
    logDir: resolveDefaultLogsDir(resolvedInstanceId),
    secretsKeyFilePath: resolveDefaultSecretsKeyFilePath(resolvedInstanceId),
    storageDir: resolveDefaultStorageDir(resolvedInstanceId),
  };
}
