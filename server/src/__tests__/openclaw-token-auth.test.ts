import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import {
  extractOpenClawToken,
  validateOpenClawToken,
  loadOpenClawTokenConfig,
  type OpenClawTokenConfig,
} from "../auth/openclaw-token.js";

// ── extractOpenClawToken ───────────────────────────────────────────────────────

describe("extractOpenClawToken", () => {
  it("extracts token from X-OpenClaw-Token header", () => {
    const req = { headers: { "x-openclaw-token": "tok_abc123" }, query: {} };
    expect(extractOpenClawToken(req)).toBe("tok_abc123");
  });

  it("extracts token from header array", () => {
    const req = { headers: { "x-openclaw-token": ["tok_first", "tok_second"] }, query: {} };
    expect(extractOpenClawToken(req)).toBe("tok_first");
  });

  it("extracts token from openclaw_token query param", () => {
    const req = { headers: {}, query: { openclaw_token: "tok_query" } };
    expect(extractOpenClawToken(req)).toBe("tok_query");
  });

  it("prefers header over query param", () => {
    const req = {
      headers: { "x-openclaw-token": "tok_header" },
      query: { openclaw_token: "tok_query" },
    };
    expect(extractOpenClawToken(req)).toBe("tok_header");
  });

  it("returns null when no token present", () => {
    const req = { headers: {}, query: {} };
    expect(extractOpenClawToken(req)).toBeNull();
  });

  it("returns null for empty header string", () => {
    const req = { headers: { "x-openclaw-token": "" }, query: {} };
    expect(extractOpenClawToken(req)).toBeNull();
  });

  it("returns null for empty query string", () => {
    const req = { headers: {}, query: { openclaw_token: "" } };
    expect(extractOpenClawToken(req)).toBeNull();
  });
});

// ── validateOpenClawToken ──────────────────────────────────────────────────────

describe("validateOpenClawToken", () => {
  const enabledConfig: OpenClawTokenConfig = {
    gatewayUrl: "https://gateway.openclaw.test",
    enabled: true,
  };

  const disabledConfig: OpenClawTokenConfig = {
    gatewayUrl: "https://gateway.openclaw.test",
    enabled: false,
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns invalid when disabled", async () => {
    const result = await validateOpenClawToken("tok_abc", disabledConfig);
    expect(result).toEqual({ valid: false });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns invalid when gateway URL is empty", async () => {
    const result = await validateOpenClawToken("tok_abc", { gatewayUrl: "", enabled: true });
    expect(result).toEqual({ valid: false });
  });

  it("calls gateway /api/auth/validate with correct payload", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true, userId: "oc_user_1", userName: "Alice", email: "alice@test.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const result = await validateOpenClawToken("tok_abc123", enabledConfig);

    expect(fetch).toHaveBeenCalledWith(
      "https://gateway.openclaw.test/api/auth/validate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "tok_abc123" }),
      }),
    );

    expect(result).toEqual({
      valid: true,
      userId: "oc_user_1",
      userName: "Alice",
      email: "alice@test.com",
    });
  });

  it("strips trailing slash from gateway URL", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true, userId: "u1" }), { status: 200 }),
    );

    const config: OpenClawTokenConfig = { gatewayUrl: "https://gateway.test///", enabled: true };
    await validateOpenClawToken("tok", config);

    expect(fetch).toHaveBeenCalledWith(
      "https://gateway.test/api/auth/validate",
      expect.anything(),
    );
  });

  it("returns invalid on gateway non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("Unauthorized", { status: 401 }),
    );

    const result = await validateOpenClawToken("tok_bad", enabledConfig);
    expect(result).toEqual({ valid: false });
  });

  it("returns invalid on network error", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));

    const result = await validateOpenClawToken("tok_fail", enabledConfig);
    expect(result).toEqual({ valid: false });
  });

  it("returns invalid on malformed JSON response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("not json", { status: 200 }),
    );

    const result = await validateOpenClawToken("tok_broken", enabledConfig);
    expect(result).toEqual({ valid: false });
  });

  it("returns invalid when gateway says valid: false", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: false }), { status: 200 }),
    );

    const result = await validateOpenClawToken("tok_expired", enabledConfig);
    expect(result).toEqual({ valid: false });
  });

  it("returns invalid when userId is missing from response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true }), { status: 200 }),
    );

    const result = await validateOpenClawToken("tok_no_user", enabledConfig);
    expect(result).toEqual({ valid: false });
  });

  it("handles optional userName and email gracefully", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true, userId: "u1" }), { status: 200 }),
    );

    const result = await validateOpenClawToken("tok_minimal", enabledConfig);
    expect(result).toEqual({
      valid: true,
      userId: "u1",
      userName: undefined,
      email: undefined,
    });
  });
});

// ── loadOpenClawTokenConfig ────────────────────────────────────────────────────

describe("loadOpenClawTokenConfig", () => {
  const originalGatewayUrl = process.env.TAC_OPENCLAW_GATEWAY_URL;
  const originalEnabled = process.env.TAC_OPENCLAW_AUTH_ENABLED;

  afterEach(() => {
    if (originalGatewayUrl === undefined) delete process.env.TAC_OPENCLAW_GATEWAY_URL;
    else process.env.TAC_OPENCLAW_GATEWAY_URL = originalGatewayUrl;
    if (originalEnabled === undefined) delete process.env.TAC_OPENCLAW_AUTH_ENABLED;
    else process.env.TAC_OPENCLAW_AUTH_ENABLED = originalEnabled;
  });

  it("returns disabled config when env vars are not set", () => {
    delete process.env.TAC_OPENCLAW_GATEWAY_URL;
    delete process.env.TAC_OPENCLAW_AUTH_ENABLED;
    const config = loadOpenClawTokenConfig();
    expect(config.enabled).toBe(false);
    expect(config.gatewayUrl).toBe("");
  });

  it("reads config from env vars", () => {
    process.env.TAC_OPENCLAW_GATEWAY_URL = "https://my-gateway.example.com";
    process.env.TAC_OPENCLAW_AUTH_ENABLED = "true";
    const config = loadOpenClawTokenConfig();
    expect(config.enabled).toBe(true);
    expect(config.gatewayUrl).toBe("https://my-gateway.example.com");
  });

  it("enabled is false for non-'true' values", () => {
    process.env.TAC_OPENCLAW_AUTH_ENABLED = "false";
    expect(loadOpenClawTokenConfig().enabled).toBe(false);

    process.env.TAC_OPENCLAW_AUTH_ENABLED = "1";
    expect(loadOpenClawTokenConfig().enabled).toBe(false);
  });
});

// ── Middleware integration (OpenClaw token in actor resolution) ─────────────────

describe("actorMiddleware with OpenClaw token", () => {
  // We test the middleware integration by importing actorMiddleware and wiring
  // it up with a mock OpenClaw token flow. Since resolveOrCreateTacUser hits
  // the DB, we test that path via the unit tests above and mock the full flow
  // here at the HTTP level.

  it("sets actor from OpenClaw token when present in header", async () => {
    // This is an integration-style test verifying the express middleware
    // extracts the token and attempts validation. We mock fetch globally.
    vi.stubGlobal("fetch", vi.fn());

    // Simulate gateway accepting the token
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: true, userId: "oc_42", userName: "Bob", email: "bob@test.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    // We need to dynamically import actorMiddleware after mocking fetch
    const { actorMiddleware } = await import("../middleware/auth.js");

    const app = express();
    app.use(express.json());

    // Create a minimal mock db that supports the resolveOrCreateTacUser queries
    const mockDb = createMockDb();

    app.use(
      actorMiddleware(mockDb as any, {
        deploymentMode: "authenticated",
        openclawTokenConfig: { gatewayUrl: "https://gw.test", enabled: true },
      }),
    );

    app.get("/test", (req, res) => {
      res.json({ actor: req.actor });
    });

    const res = await request(app)
      .get("/test")
      .set("X-OpenClaw-Token", "tok_valid");

    expect(res.status).toBe(200);
    expect(res.body.actor.type).toBe("board");
    expect(res.body.actor.userId).toBe("openclaw:oc_42");
    expect(res.body.actor.source).toBe("openclaw_token");

    vi.restoreAllMocks();
  });

  it("falls through to default actor when OpenClaw token is invalid", async () => {
    vi.stubGlobal("fetch", vi.fn());

    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ valid: false }), { status: 200 }),
    );

    const { actorMiddleware } = await import("../middleware/auth.js");

    const app = express();
    app.use(express.json());
    app.use(
      actorMiddleware({} as any, {
        deploymentMode: "authenticated",
        openclawTokenConfig: { gatewayUrl: "https://gw.test", enabled: true },
      }),
    );
    app.get("/test", (req, res) => {
      res.json({ actor: req.actor });
    });

    const res = await request(app)
      .get("/test")
      .set("X-OpenClaw-Token", "tok_expired");

    expect(res.status).toBe(200);
    expect(res.body.actor.type).toBe("none");
    expect(res.body.actor.source).toBe("none");

    vi.restoreAllMocks();
  });

  it("skips OpenClaw auth when config is disabled", async () => {
    vi.stubGlobal("fetch", vi.fn());

    const { actorMiddleware } = await import("../middleware/auth.js");

    const app = express();
    app.use(express.json());
    app.use(
      actorMiddleware({} as any, {
        deploymentMode: "authenticated",
        openclawTokenConfig: { gatewayUrl: "https://gw.test", enabled: false },
      }),
    );
    app.get("/test", (req, res) => {
      res.json({ actor: req.actor });
    });

    const res = await request(app)
      .get("/test")
      .set("X-OpenClaw-Token", "tok_should_not_be_checked");

    expect(res.status).toBe(200);
    expect(res.body.actor.type).toBe("none");
    expect(fetch).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });
});

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Create a minimal mock Drizzle DB that supports the queries used by
 * resolveOrCreateTacUser. Simulates an empty DB (user does not exist yet,
 * one active company).
 */
function createMockDb() {
  const mockCompanyId = "c1-test-company";
  const selectChain = (returnRows: unknown[]) => ({
    from: () => ({
      where: () => Promise.resolve(returnRows),
    }),
  });

  let selectCallCount = 0;
  return {
    select: (_columns?: unknown) => {
      selectCallCount++;
      // 1st select: check if user exists → empty (not found)
      if (selectCallCount === 1) return selectChain([]);
      // 2nd select: get active companies → one company
      if (selectCallCount === 2) return selectChain([{ id: mockCompanyId }]);
      // 3rd select: get memberships → newly created membership
      return selectChain([{ companyId: mockCompanyId }]);
    },
    insert: (_table: unknown) => ({
      values: (_vals: unknown) => Promise.resolve(),
    }),
  };
}
