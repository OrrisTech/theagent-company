import * as p from "@clack/prompts";
import path from "node:path";
import { execFile as execFileCb } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import pc from "picocolors";
import {
  AUTH_BASE_URL_MODES,
  DEPLOYMENT_EXPOSURES,
  DEPLOYMENT_MODES,
  SECRET_PROVIDERS,
  STORAGE_PROVIDERS,
  type AuthBaseUrlMode,
  type DeploymentExposure,
  type DeploymentMode,
  type SecretProvider,
  type StorageProvider,
} from "@theagentcompany/shared";
import { configExists, readConfig, resolveConfigPath, writeConfig } from "../config/store.js";
import type { TacConfig } from "../config/schema.js";
import {
  ensureAgentJwtSecret,
  resolveAgentJwtEnvFile,
  mergeTacEnvEntries,
  resolveTacEnvFile,
} from "../config/env.js";
import { ensureLocalSecretsKeyFile } from "../config/secrets-key.js";
import { promptDatabase } from "../prompts/database.js";
import { promptLlm } from "../prompts/llm.js";
import { promptLogging } from "../prompts/logging.js";
import { defaultSecretsConfig } from "../prompts/secrets.js";
import { defaultStorageConfig, promptStorage } from "../prompts/storage.js";
import { promptServer } from "../prompts/server.js";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveDefaultBackupDir,
  resolveDefaultEmbeddedPostgresDir,
  resolveDefaultLogsDir,
  resolveTacInstanceId,
} from "../config/home.js";
import { bootstrapCeoInvite } from "./auth-bootstrap-ceo.js";
import { printTacCliBanner } from "../utils/banner.js";

const execFile = promisify(execFileCb);

/* ── Types ────────────────────────────────────────────────────────────── */

type EngineMode = "local_cli" | "api_keys" | "openclaw_gateway";
type SetupMode = "quickstart" | "advanced";

type OnboardOptions = {
  config?: string;
  run?: boolean;
  yes?: boolean;
  invokedByRun?: boolean;
};

type OnboardDefaults = Pick<TacConfig, "database" | "logging" | "server" | "auth" | "storage" | "secrets">;

/* ── CLI detection ────────────────────────────────────────────────────── */

const DETECTABLE_CLIS = ["claude", "codex", "opencode", "pi"] as const;
type DetectableCli = (typeof DETECTABLE_CLIS)[number];

interface CliInfo {
  path: string;
  version: string | null;
}

/** Try to get the version string from a CLI binary. */
async function getCliVersion(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFile(cmd, ["--version"], { timeout: 5_000 });
    // Extract version-like pattern from output (e.g. "v1.0.17" or "1.0.17")
    const match = stdout.match(/v?(\d+\.\d+\.\d+(?:-[a-z0-9.]+)?)/i);
    return match ? `v${match[1].replace(/^v/i, "")}` : stdout.trim().split("\n")[0] || null;
  } catch {
    return null;
  }
}

/**
 * Detect locally installed CLI tools that can serve as agent engines.
 * Returns a map of CLI name → { path, version }.
 */
async function detectLocalCLIs(): Promise<Map<DetectableCli, CliInfo>> {
  const results = new Map<DetectableCli, CliInfo>();
  await Promise.all(
    DETECTABLE_CLIS.map(async (cmd) => {
      try {
        const { stdout } = await execFile("which", [cmd], { timeout: 3_000 });
        const binPath = stdout.trim();
        if (binPath) {
          const version = await getCliVersion(binPath);
          results.set(cmd, { path: binPath, version });
        }
      } catch {
        // CLI not found — skip
      }
    }),
  );
  return results;
}

/** Pretty-print CLI detection results. */
function printDetectionResults(detected: Map<DetectableCli, CliInfo>): void {
  p.log.step("Checking local environment...");
  for (const cmd of DETECTABLE_CLIS) {
    const info = detected.get(cmd);
    if (info) {
      const ver = info.version ? ` (${info.version})` : "";
      p.log.message(`${pc.green("✓")} ${pc.bold(cmd)} — found${ver}`);
    } else {
      p.log.message(`${pc.dim("✗")} ${pc.dim(cmd)} — not found (optional)`);
    }
  }
}

/* ── Env helpers ──────────────────────────────────────────────────────── */

const ONBOARD_ENV_KEYS = [
  "TAC_PUBLIC_URL",
  "DATABASE_URL",
  "TAC_DB_BACKUP_ENABLED",
  "TAC_DB_BACKUP_INTERVAL_MINUTES",
  "TAC_DB_BACKUP_RETENTION_DAYS",
  "TAC_DB_BACKUP_DIR",
  "TAC_DEPLOYMENT_MODE",
  "TAC_DEPLOYMENT_EXPOSURE",
  "HOST",
  "PORT",
  "SERVE_UI",
  "TAC_ALLOWED_HOSTNAMES",
  "TAC_AUTH_BASE_URL_MODE",
  "TAC_AUTH_PUBLIC_BASE_URL",
  "BETTER_AUTH_URL",
  "BETTER_AUTH_BASE_URL",
  "TAC_STORAGE_PROVIDER",
  "TAC_STORAGE_LOCAL_DIR",
  "TAC_STORAGE_S3_BUCKET",
  "TAC_STORAGE_S3_REGION",
  "TAC_STORAGE_S3_ENDPOINT",
  "TAC_STORAGE_S3_PREFIX",
  "TAC_STORAGE_S3_FORCE_PATH_STYLE",
  "TAC_SECRETS_PROVIDER",
  "TAC_SECRETS_STRICT_MODE",
  "TAC_SECRETS_MASTER_KEY_FILE",
] as const;

function parseBooleanFromEnv(rawValue: string | undefined): boolean | null {
  if (rawValue === undefined) return null;
  const lower = rawValue.trim().toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  return null;
}

function parseNumberFromEnv(rawValue: string | undefined): number | null {
  if (!rawValue) return null;
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function parseEnumFromEnv<T extends string>(rawValue: string | undefined, allowedValues: readonly T[]): T | null {
  if (!rawValue) return null;
  return allowedValues.includes(rawValue as T) ? (rawValue as T) : null;
}

function resolvePathFromEnv(rawValue: string | undefined): string | null {
  if (!rawValue || rawValue.trim().length === 0) return null;
  return path.resolve(expandHomePrefix(rawValue.trim()));
}

/**
 * Auto-generate BETTER_AUTH_SECRET if not already set in env or .env file.
 * Uses the same .env file as the JWT secret.
 */
function ensureBetterAuthSecret(configPath?: string): { secret: string; created: boolean } {
  const existing = process.env.BETTER_AUTH_SECRET?.trim();
  if (existing) return { secret: existing, created: false };

  const envFilePath = resolveTacEnvFile(configPath);
  const secret = randomBytes(32).toString("hex");
  mergeTacEnvEntries({ BETTER_AUTH_SECRET: secret }, envFilePath);
  process.env.BETTER_AUTH_SECRET = secret;
  return { secret, created: true };
}

/* ── Infrastructure defaults from env ────────────────────────────────── */

function quickstartDefaultsFromEnv(): {
  defaults: OnboardDefaults;
  usedEnvKeys: string[];
  ignoredEnvKeys: Array<{ key: string; reason: string }>;
} {
  const instanceId = resolveTacInstanceId();
  const defaultStorage = defaultStorageConfig();
  const defaultSecrets = defaultSecretsConfig();
  const databaseUrl = process.env.DATABASE_URL?.trim() || undefined;
  const publicUrl =
    process.env.TAC_PUBLIC_URL?.trim() ||
    process.env.TAC_AUTH_PUBLIC_BASE_URL?.trim() ||
    process.env.BETTER_AUTH_URL?.trim() ||
    process.env.BETTER_AUTH_BASE_URL?.trim() ||
    undefined;
  const deploymentMode =
    parseEnumFromEnv<DeploymentMode>(process.env.TAC_DEPLOYMENT_MODE, DEPLOYMENT_MODES) ?? "local_trusted";
  const deploymentExposureFromEnv = parseEnumFromEnv<DeploymentExposure>(
    process.env.TAC_DEPLOYMENT_EXPOSURE,
    DEPLOYMENT_EXPOSURES,
  );
  const deploymentExposure =
    deploymentMode === "local_trusted" ? "private" : (deploymentExposureFromEnv ?? "private");
  const authPublicBaseUrl = publicUrl;
  const authBaseUrlModeFromEnv = parseEnumFromEnv<AuthBaseUrlMode>(
    process.env.TAC_AUTH_BASE_URL_MODE,
    AUTH_BASE_URL_MODES,
  );
  const authBaseUrlMode = authBaseUrlModeFromEnv ?? (authPublicBaseUrl ? "explicit" : "auto");
  const allowedHostnamesFromEnv = process.env.TAC_ALLOWED_HOSTNAMES
    ? process.env.TAC_ALLOWED_HOSTNAMES
      .split(",")
      .map((value) => value.trim().toLowerCase())
      .filter((value) => value.length > 0)
    : [];
  const hostnameFromPublicUrl = publicUrl
    ? (() => {
      try {
        return new URL(publicUrl).hostname.trim().toLowerCase();
      } catch {
        return null;
      }
    })()
    : null;
  const storageProvider =
    parseEnumFromEnv<StorageProvider>(process.env.TAC_STORAGE_PROVIDER, STORAGE_PROVIDERS) ??
    defaultStorage.provider;
  const secretsProvider =
    parseEnumFromEnv<SecretProvider>(process.env.TAC_SECRETS_PROVIDER, SECRET_PROVIDERS) ??
    defaultSecrets.provider;
  const databaseBackupEnabled = parseBooleanFromEnv(process.env.TAC_DB_BACKUP_ENABLED) ?? true;
  const databaseBackupIntervalMinutes = Math.max(
    1,
    parseNumberFromEnv(process.env.TAC_DB_BACKUP_INTERVAL_MINUTES) ?? 60,
  );
  const databaseBackupRetentionDays = Math.max(
    1,
    parseNumberFromEnv(process.env.TAC_DB_BACKUP_RETENTION_DAYS) ?? 30,
  );
  const defaults: OnboardDefaults = {
    database: {
      mode: databaseUrl ? "postgres" : "embedded-postgres",
      ...(databaseUrl ? { connectionString: databaseUrl } : {}),
      embeddedPostgresDataDir: resolveDefaultEmbeddedPostgresDir(instanceId),
      embeddedPostgresPort: 54329,
      backup: {
        enabled: databaseBackupEnabled,
        intervalMinutes: databaseBackupIntervalMinutes,
        retentionDays: databaseBackupRetentionDays,
        dir: resolvePathFromEnv(process.env.TAC_DB_BACKUP_DIR) ?? resolveDefaultBackupDir(instanceId),
      },
    },
    logging: {
      mode: "file",
      logDir: resolveDefaultLogsDir(instanceId),
    },
    server: {
      deploymentMode,
      exposure: deploymentExposure,
      host: process.env.HOST ?? "127.0.0.1",
      port: Number(process.env.PORT) || 3100,
      allowedHostnames: Array.from(new Set([...allowedHostnamesFromEnv, ...(hostnameFromPublicUrl ? [hostnameFromPublicUrl] : [])])),
      serveUi: parseBooleanFromEnv(process.env.SERVE_UI) ?? true,
    },
    auth: {
      baseUrlMode: authBaseUrlMode,
      disableSignUp: false,
      ...(authPublicBaseUrl ? { publicBaseUrl: authPublicBaseUrl } : {}),
    },
    storage: {
      provider: storageProvider,
      localDisk: {
        baseDir:
          resolvePathFromEnv(process.env.TAC_STORAGE_LOCAL_DIR) ?? defaultStorage.localDisk.baseDir,
      },
      s3: {
        bucket: process.env.TAC_STORAGE_S3_BUCKET ?? defaultStorage.s3.bucket,
        region: process.env.TAC_STORAGE_S3_REGION ?? defaultStorage.s3.region,
        endpoint: process.env.TAC_STORAGE_S3_ENDPOINT ?? defaultStorage.s3.endpoint,
        prefix: process.env.TAC_STORAGE_S3_PREFIX ?? defaultStorage.s3.prefix,
        forcePathStyle:
          parseBooleanFromEnv(process.env.TAC_STORAGE_S3_FORCE_PATH_STYLE) ??
          defaultStorage.s3.forcePathStyle,
      },
    },
    secrets: {
      provider: secretsProvider,
      strictMode: parseBooleanFromEnv(process.env.TAC_SECRETS_STRICT_MODE) ?? defaultSecrets.strictMode,
      localEncrypted: {
        keyFilePath:
          resolvePathFromEnv(process.env.TAC_SECRETS_MASTER_KEY_FILE) ??
          defaultSecrets.localEncrypted.keyFilePath,
      },
    },
  };
  const ignoredEnvKeys: Array<{ key: string; reason: string }> = [];
  if (deploymentMode === "local_trusted" && process.env.TAC_DEPLOYMENT_EXPOSURE !== undefined) {
    ignoredEnvKeys.push({
      key: "TAC_DEPLOYMENT_EXPOSURE",
      reason: "Ignored because deployment mode local_trusted always forces private exposure",
    });
  }

  const ignoredKeySet = new Set(ignoredEnvKeys.map((entry) => entry.key));
  const usedEnvKeys = ONBOARD_ENV_KEYS.filter(
    (key) => process.env[key] !== undefined && !ignoredKeySet.has(key),
  );
  return { defaults, usedEnvKeys, ignoredEnvKeys };
}

function canCreateBootstrapInviteImmediately(config: Pick<TacConfig, "database" | "server">): boolean {
  return config.server.deploymentMode === "authenticated" && config.database.mode !== "embedded-postgres";
}

/* ── Engine-specific prompts ─────────────────────────────────────────── */

/**
 * Local CLI mode: detect installed CLIs, display results.
 * No extra config is required — agents are created later in the UI.
 */
async function handleLocalCliMode(): Promise<void> {
  const s = p.spinner();
  s.start("Detecting local CLIs...");
  const detected = await detectLocalCLIs();
  s.stop(`Found ${detected.size} CLI(s)`);
  printDetectionResults(detected);

  if (detected.size === 0) {
    p.log.warn(
      pc.yellow(
        "No agent CLIs found. Install at least one (claude, codex, opencode, or pi) to run agents locally.",
      ),
    );
  }
}

/**
 * API Keys mode: prompt for Anthropic and/or OpenAI API keys.
 * Keys are stored in the instance .env file for adapter use.
 */
async function handleApiKeysMode(configPath?: string): Promise<void> {
  const anthropicKey = await p.text({
    message: "Anthropic API key (ANTHROPIC_API_KEY)",
    placeholder: "sk-ant-... (leave empty to skip)",
    defaultValue: process.env.ANTHROPIC_API_KEY ?? "",
  });
  if (p.isCancel(anthropicKey)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const openaiKey = await p.text({
    message: "OpenAI API key (OPENAI_API_KEY)",
    placeholder: "sk-... (leave empty to skip)",
    defaultValue: process.env.OPENAI_API_KEY ?? "",
  });
  if (p.isCancel(openaiKey)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  // Store keys in the .env file
  const envFilePath = resolveTacEnvFile(configPath);
  const entries: Record<string, string> = {};
  if (typeof anthropicKey === "string" && anthropicKey.trim()) {
    entries.ANTHROPIC_API_KEY = anthropicKey.trim();
    process.env.ANTHROPIC_API_KEY = anthropicKey.trim();
  }
  if (typeof openaiKey === "string" && openaiKey.trim()) {
    entries.OPENAI_API_KEY = openaiKey.trim();
    process.env.OPENAI_API_KEY = openaiKey.trim();
  }

  if (Object.keys(entries).length > 0) {
    mergeTacEnvEntries(entries, envFilePath);
    p.log.success(`Saved API key(s) to ${pc.dim(envFilePath)}`);
  } else {
    p.log.warn(pc.yellow("No API keys provided. You can add them later in the .env file."));
  }

  // Validate keys if provided
  for (const [label, key, validateFn] of [
    ["Anthropic", entries.ANTHROPIC_API_KEY, validateAnthropicKey] as const,
    ["OpenAI", entries.OPENAI_API_KEY, validateOpenaiKey] as const,
  ]) {
    if (key) {
      const s = p.spinner();
      s.start(`Validating ${label} API key...`);
      const result = await validateFn(key);
      if (result === "valid") {
        s.stop(`${label} API key is valid`);
      } else if (result === "invalid") {
        s.stop(pc.yellow(`${label} API key appears invalid — you can update it later`));
      } else {
        s.stop(pc.yellow(`Could not validate ${label} API key — continuing anyway`));
      }
    }
  }
}

async function validateAnthropicKey(key: string): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (res.ok || res.status === 400) return "valid";
    if (res.status === 401) return "invalid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function validateOpenaiKey(key: string): Promise<"valid" | "invalid" | "unknown"> {
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return "valid";
    if (res.status === 401) return "invalid";
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * OpenClaw Gateway mode: prompt for the gateway URL.
 * Stored in .env for adapter use.
 */
async function handleOpenClawGatewayMode(configPath?: string): Promise<void> {
  const gatewayUrl = await p.text({
    message: "OpenClaw Gateway URL",
    placeholder: "https://gateway.openclaw.dev",
    validate: (value) => {
      if (!value.trim()) return "Gateway URL is required";
      try {
        new URL(value.trim());
      } catch {
        return "Must be a valid URL";
      }
    },
  });
  if (p.isCancel(gatewayUrl)) {
    p.cancel("Setup cancelled.");
    process.exit(0);
  }

  const envFilePath = resolveTacEnvFile(configPath);
  mergeTacEnvEntries({ OPENCLAW_GATEWAY_URL: (gatewayUrl as string).trim() }, envFilePath);
  process.env.OPENCLAW_GATEWAY_URL = (gatewayUrl as string).trim();
  p.log.success(`Saved gateway URL to ${pc.dim(envFilePath)}`);
}

/* ── Main onboard flow ───────────────────────────────────────────────── */

export async function onboard(opts: OnboardOptions): Promise<void> {
  printTacCliBanner();
  p.intro(pc.bgCyan(pc.black(" theagentcompany onboard ")));
  const configPath = resolveConfigPath(opts.config);
  const instance = describeLocalInstancePaths(resolveTacInstanceId());
  p.log.message(
    pc.dim(
      `Local home: ${instance.homeDir} | instance: ${instance.instanceId} | config: ${configPath}`,
    ),
  );

  if (configExists(opts.config)) {
    p.log.message(pc.dim(`${configPath} exists, updating config`));

    try {
      readConfig(opts.config);
    } catch (err) {
      p.log.message(
        pc.yellow(
          `Existing config appears invalid and will be updated.\n${err instanceof Error ? err.message : String(err)}`,
        ),
      );
    }
  }

  /* ── Step 1: Engine mode selection ───────────────────────────────── */

  let engineMode: EngineMode = "local_cli";
  if (opts.yes) {
    p.log.message(pc.dim("`--yes` enabled: using Local CLI defaults."));
  } else {
    const engineChoice = await p.select({
      message: "How do you want to run agents?",
      options: [
        {
          value: "local_cli" as const,
          label: "Local CLI",
          hint: "Auto-detect installed CLIs (claude, codex, opencode, pi)",
        },
        {
          value: "api_keys" as const,
          label: "API Keys",
          hint: "Use Anthropic and/or OpenAI API keys directly",
        },
        {
          value: "openclaw_gateway" as const,
          label: "OpenClaw Gateway",
          hint: "Connect to an OpenClaw Gateway instance",
        },
      ],
      initialValue: "local_cli",
    });
    if (p.isCancel(engineChoice)) {
      p.cancel("Setup cancelled.");
      return;
    }
    engineMode = engineChoice as EngineMode;
  }

  /* ── Step 2: Engine-specific setup ───────────────────────────────── */

  if (engineMode === "local_cli") {
    await handleLocalCliMode();
  } else if (engineMode === "api_keys") {
    await handleApiKeysMode(configPath);
  } else if (engineMode === "openclaw_gateway") {
    await handleOpenClawGatewayMode(configPath);
  }

  /* ── Step 3: Infrastructure setup ────────────────────────────────── */

  let setupMode: SetupMode = "quickstart";

  // For local CLI mode, default to quickstart. For other modes, still offer the choice.
  if (!opts.yes) {
    const customizeInfra = await p.confirm({
      message: "Customize infrastructure? (database, storage, server)",
      initialValue: false,
    });
    if (p.isCancel(customizeInfra)) {
      p.cancel("Setup cancelled.");
      return;
    }
    if (customizeInfra) {
      setupMode = "advanced";
    }
  }

  let llm: TacConfig["llm"] | undefined;
  const { defaults: derivedDefaults, usedEnvKeys, ignoredEnvKeys } = quickstartDefaultsFromEnv();
  let {
    database,
    logging,
    server,
    auth,
    storage,
    secrets,
  } = derivedDefaults;

  if (setupMode === "advanced") {
    p.log.step(pc.bold("Database"));
    database = await promptDatabase(database);

    if (database.mode === "postgres" && database.connectionString) {
      const s = p.spinner();
      s.start("Testing database connection...");
      try {
        const { createDb } = await import("@theagentcompany/db");
        const db = createDb(database.connectionString);
        await db.execute("SELECT 1");
        s.stop("Database connection successful");
      } catch {
        s.stop(pc.yellow("Could not connect to database — you can fix this later with `theagentcompany doctor`"));
      }
    }

    p.log.step(pc.bold("LLM Provider"));
    llm = await promptLlm();

    if (llm?.apiKey) {
      const s = p.spinner();
      s.start("Validating API key...");
      try {
        if (llm.provider === "claude") {
          const result = await validateAnthropicKey(llm.apiKey);
          if (result === "valid") s.stop("API key is valid");
          else if (result === "invalid") s.stop(pc.yellow("API key appears invalid — you can update it later"));
          else s.stop(pc.yellow("Could not validate API key — continuing anyway"));
        } else {
          const result = await validateOpenaiKey(llm.apiKey);
          if (result === "valid") s.stop("API key is valid");
          else if (result === "invalid") s.stop(pc.yellow("API key appears invalid — you can update it later"));
          else s.stop(pc.yellow("Could not validate API key — continuing anyway"));
        }
      } catch {
        s.stop(pc.yellow("Could not reach API — continuing anyway"));
      }
    }

    p.log.step(pc.bold("Logging"));
    logging = await promptLogging();

    p.log.step(pc.bold("Server"));
    ({ server, auth } = await promptServer({ currentServer: server, currentAuth: auth }));

    p.log.step(pc.bold("Storage"));
    storage = await promptStorage(storage);

    p.log.step(pc.bold("Secrets"));
    const secretsDefaults = defaultSecretsConfig();
    secrets = {
      provider: secrets.provider ?? secretsDefaults.provider,
      strictMode: secrets.strictMode ?? secretsDefaults.strictMode,
      localEncrypted: {
        keyFilePath: secrets.localEncrypted?.keyFilePath ?? secretsDefaults.localEncrypted.keyFilePath,
      },
    };
    p.log.message(
      pc.dim(
        `Using defaults: provider=${secrets.provider}, strictMode=${secrets.strictMode}, keyFile=${secrets.localEncrypted.keyFilePath}`,
      ),
    );
  } else {
    p.log.step(pc.bold("Infrastructure"));
    p.log.message(pc.dim("Using quickstart defaults (embedded database, file storage, local encrypted secrets)."));
    if (usedEnvKeys.length > 0) {
      p.log.message(pc.dim(`Environment-aware defaults active (${usedEnvKeys.length} env var(s) detected).`));
    }
    for (const ignored of ignoredEnvKeys) {
      p.log.message(pc.dim(`Ignored ${ignored.key}: ${ignored.reason}`));
    }
  }

  /* ── Step 4: Auth secrets ────────────────────────────────────────── */

  const jwtSecret = ensureAgentJwtSecret(configPath);
  const envFilePath = resolveAgentJwtEnvFile(configPath);
  if (jwtSecret.created) {
    p.log.success(`Created ${pc.cyan("TAC_AGENT_JWT_SECRET")} in ${pc.dim(envFilePath)}`);
  } else if (process.env.TAC_AGENT_JWT_SECRET?.trim()) {
    p.log.info(`Using existing ${pc.cyan("TAC_AGENT_JWT_SECRET")} from environment`);
  } else {
    p.log.info(`Using existing ${pc.cyan("TAC_AGENT_JWT_SECRET")} in ${pc.dim(envFilePath)}`);
  }

  const authSecret = ensureBetterAuthSecret(configPath);
  if (authSecret.created) {
    p.log.success(`Created ${pc.cyan("BETTER_AUTH_SECRET")} in ${pc.dim(envFilePath)}`);
  } else {
    p.log.info(`Using existing ${pc.cyan("BETTER_AUTH_SECRET")}`);
  }

  /* ── Step 5: Write config ────────────────────────────────────────── */

  const config: TacConfig = {
    $meta: {
      version: 1,
      updatedAt: new Date().toISOString(),
      source: "onboard",
    },
    ...(llm && { llm }),
    database,
    logging,
    server,
    auth,
    storage,
    secrets,
  };

  const keyResult = ensureLocalSecretsKeyFile(config, configPath);
  if (keyResult.status === "created") {
    p.log.success(`Created local secrets key file at ${pc.dim(keyResult.path)}`);
  } else if (keyResult.status === "existing") {
    p.log.message(pc.dim(`Using existing local secrets key file at ${keyResult.path}`));
  }

  writeConfig(config, opts.config);

  /* ── Step 6: Quickstart summary ──────────────────────────────────── */

  const engineModeLabel =
    engineMode === "local_cli" ? "Local CLI" : engineMode === "api_keys" ? "API Keys" : "OpenClaw Gateway";

  p.note(
    [
      `Engine mode: ${engineModeLabel}`,
      `Database: ${database.mode}`,
      llm ? `LLM: ${llm.provider}` : null,
      `Server: ${server.host}:${server.port}`,
      `Storage: ${storage.provider}`,
      `Secrets: ${secrets.provider}`,
    ]
      .filter(Boolean)
      .join("\n"),
    "Configuration saved",
  );

  p.note(
    [
      `Start: ${pc.cyan("theagentcompany run")}`,
      `Reconfigure: ${pc.cyan("theagentcompany configure")}`,
      `Diagnose: ${pc.cyan("theagentcompany doctor")}`,
    ].join("\n"),
    "Next steps",
  );

  if (canCreateBootstrapInviteImmediately({ database, server })) {
    p.log.step("Generating bootstrap CEO invite");
    await bootstrapCeoInvite({ config: configPath });
  }

  let shouldRunNow = opts.run === true || opts.yes === true;
  if (!shouldRunNow && !opts.invokedByRun && process.stdin.isTTY && process.stdout.isTTY) {
    const answer = await p.confirm({
      message: "Start The Agent Company now?",
      initialValue: true,
    });
    if (!p.isCancel(answer)) {
      shouldRunNow = answer;
    }
  }

  if (shouldRunNow && !opts.invokedByRun) {
    process.env.TAC_OPEN_ON_LISTEN = "true";
    const { runCommand } = await import("./run.js");
    await runCommand({ config: configPath, repair: true, yes: true });
    return;
  }

  if (server.deploymentMode === "authenticated" && database.mode === "embedded-postgres") {
    p.log.info(
      [
        "Bootstrap CEO invite will be created after the server starts.",
        `Next: ${pc.cyan("theagentcompany run")}`,
        `Then: ${pc.cyan("theagentcompany auth bootstrap-ceo")}`,
      ].join("\n"),
    );
  }

  p.outro("You're all set!");
}
