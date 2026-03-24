import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { Db } from "@theagentcompany/db";
import { authUsers, companyMemberships, companies } from "@theagentcompany/db";
import { logger } from "../middleware/logger.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface OpenClawTokenConfig {
  /** OpenClaw gateway URL (e.g. "https://gateway.openclaw.dev") */
  gatewayUrl: string;
  /** Whether this auth strategy is active */
  enabled: boolean;
}

/** Result of validating an OpenClaw token against the gateway. */
export interface OpenClawTokenValidationResult {
  valid: boolean;
  userId?: string;
  userName?: string;
  email?: string;
}

/** TAC-side user info resolved after OpenClaw auth (including auto-creation). */
export interface OpenClawResolvedUser {
  userId: string;
  companyIds: string[];
  isInstanceAdmin: boolean;
}

// ── Configuration ──────────────────────────────────────────────────────────────

/** Read OpenClaw token auth config from environment variables. */
export function loadOpenClawTokenConfig(): OpenClawTokenConfig {
  return {
    gatewayUrl: process.env.TAC_OPENCLAW_GATEWAY_URL ?? "",
    enabled: process.env.TAC_OPENCLAW_AUTH_ENABLED === "true",
  };
}

// ── Token Extraction ───────────────────────────────────────────────────────────

/**
 * Extract OpenClaw token from the request.
 * Checks `X-OpenClaw-Token` header first, then `openclaw_token` query param.
 */
export function extractOpenClawToken(req: {
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, unknown>;
}): string | null {
  const headerVal = req.headers["x-openclaw-token"];
  if (typeof headerVal === "string" && headerVal.length > 0) return headerVal;
  if (Array.isArray(headerVal) && headerVal.length > 0 && headerVal[0].length > 0) return headerVal[0];

  const queryVal = req.query.openclaw_token;
  if (typeof queryVal === "string" && queryVal.length > 0) return queryVal;

  return null;
}

// ── Token Validation ───────────────────────────────────────────────────────────

/**
 * Validate an OpenClaw token by calling the gateway's /api/auth/validate endpoint.
 * Returns user info if the token is valid, otherwise { valid: false }.
 */
export async function validateOpenClawToken(
  token: string,
  config: OpenClawTokenConfig,
): Promise<OpenClawTokenValidationResult> {
  if (!config.enabled || !config.gatewayUrl) {
    return { valid: false };
  }

  const url = `${config.gatewayUrl.replace(/\/+$/, "")}/api/auth/validate`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err) {
    logger.warn({ err, url }, "OpenClaw gateway token validation request failed");
    return { valid: false };
  }

  if (!response.ok) {
    logger.warn(
      { status: response.status, url },
      "OpenClaw gateway returned non-OK status during token validation",
    );
    return { valid: false };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { valid: false };
  }

  if (!body || typeof body !== "object") return { valid: false };
  const data = body as Record<string, unknown>;

  if (data.valid !== true || typeof data.userId !== "string") {
    return { valid: false };
  }

  return {
    valid: true,
    userId: data.userId as string,
    userName: typeof data.userName === "string" ? data.userName : undefined,
    email: typeof data.email === "string" ? data.email : undefined,
  };
}

// ── User Auto-Creation ─────────────────────────────────────────────────────────

/**
 * Map an OpenClaw user to a TAC user. If the user does not exist in TAC, create
 * them automatically and grant them membership in all active companies.
 */
export async function resolveOrCreateTacUser(
  db: Db,
  openclawUser: { userId: string; userName?: string; email?: string },
): Promise<OpenClawResolvedUser> {
  // Derive a stable TAC user id from the OpenClaw user id
  const tacUserId = `openclaw:${openclawUser.userId}`;
  const email = openclawUser.email ?? `${openclawUser.userId}@openclaw.local`;
  const name = openclawUser.userName ?? `OpenClaw User ${openclawUser.userId.slice(0, 8)}`;

  // Check if user already exists
  const existing = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.id, tacUserId))
    .then((rows) => rows[0] ?? null);

  const now = new Date();

  if (!existing) {
    // Create the TAC user
    await db.insert(authUsers).values({
      id: tacUserId,
      name,
      email,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
    });

    // Grant membership in all active companies
    const activeCompanies = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.status, "active"));

    if (activeCompanies.length > 0) {
      await db.insert(companyMemberships).values(
        activeCompanies.map((c) => ({
          id: randomUUID(),
          companyId: c.id,
          principalType: "user" as const,
          principalId: tacUserId,
          status: "active" as const,
          createdAt: now,
          updatedAt: now,
        })),
      );
    }

    logger.info(
      { tacUserId, openclawUserId: openclawUser.userId, companiesGranted: activeCompanies.length },
      "Auto-created TAC user from OpenClaw auth",
    );
  }

  // Resolve company memberships and admin status
  const memberships = await db
    .select({ companyId: companyMemberships.companyId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, tacUserId),
        eq(companyMemberships.status, "active"),
      ),
    );

  return {
    userId: tacUserId,
    companyIds: memberships.map((row) => row.companyId),
    // OpenClaw plugin users are not instance admins by default
    isInstanceAdmin: false,
  };
}
