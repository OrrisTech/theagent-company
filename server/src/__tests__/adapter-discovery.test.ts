import { afterEach, describe, expect, it } from "vitest";
import { getAvailableAdapters, listServerAdapters } from "../adapters/index.js";

// Adapter types that should be marked localOnly
const LOCAL_ONLY_TYPES = new Set([
  "claude_local",
  "codex_local",
  "cursor",
  "gemini_local",
  "opencode_local",
  "pi_local",
  "hermes_local",
]);

// Adapter types that should NOT be localOnly (cloud-compatible)
const CLOUD_COMPATIBLE_TYPES = new Set([
  "anthropic_api",
  "openai_api",
  "openclaw_gateway",
  "process",
  "http",
]);

describe("adapter localOnly flag", () => {
  it("local CLI adapters are marked localOnly: true", () => {
    const adapters = listServerAdapters();
    for (const adapter of adapters) {
      if (LOCAL_ONLY_TYPES.has(adapter.type)) {
        expect(adapter.localOnly, `${adapter.type} should be localOnly`).toBe(true);
      }
    }
  });

  it("cloud-compatible adapters are NOT marked localOnly", () => {
    const adapters = listServerAdapters();
    for (const adapter of adapters) {
      if (CLOUD_COMPATIBLE_TYPES.has(adapter.type)) {
        expect(adapter.localOnly, `${adapter.type} should not be localOnly`).toBeFalsy();
      }
    }
  });
});

describe("getAvailableAdapters", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns all adapters in local mode", () => {
    delete process.env.TAC_CLOUD_MODE;
    delete process.env.TAC_DEPLOYMENT_MODE;
    const available = getAvailableAdapters();
    const all = listServerAdapters();
    expect(available.length).toBe(all.length);
  });

  it("filters out localOnly adapters in cloud mode", () => {
    process.env.TAC_CLOUD_MODE = "true";
    const available = getAvailableAdapters();
    const localOnlyInResult = available.filter((a) => LOCAL_ONLY_TYPES.has(a.type));
    expect(localOnlyInResult).toHaveLength(0);
  });

  it("keeps cloud-compatible adapters in cloud mode", () => {
    process.env.TAC_CLOUD_MODE = "true";
    const available = getAvailableAdapters();
    const cloudTypes = available.map((a) => a.type);
    for (const type of CLOUD_COMPATIBLE_TYPES) {
      expect(cloudTypes, `${type} should be available in cloud mode`).toContain(type);
    }
  });

  it("all registered adapters are still in the full registry regardless of mode", () => {
    process.env.TAC_CLOUD_MODE = "true";
    const all = listServerAdapters();
    const types = all.map((a) => a.type);
    for (const type of [...LOCAL_ONLY_TYPES, ...CLOUD_COMPATIBLE_TYPES]) {
      expect(types, `${type} should remain in full registry`).toContain(type);
    }
  });
});
