import { afterEach, describe, expect, it } from "vitest";
import { isCloudMode, isRuntimeServicesEnabled } from "../cloud-mode.ts";

describe("isCloudMode", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns false when no cloud env vars are set", () => {
    delete process.env.TAC_CLOUD_MODE;
    delete process.env.TAC_DEPLOYMENT_MODE;
    expect(isCloudMode()).toBe(false);
  });

  it("returns true when TAC_CLOUD_MODE=true", () => {
    process.env.TAC_CLOUD_MODE = "true";
    expect(isCloudMode()).toBe(true);
  });

  it("returns false when TAC_CLOUD_MODE=false", () => {
    process.env.TAC_CLOUD_MODE = "false";
    delete process.env.TAC_DEPLOYMENT_MODE;
    expect(isCloudMode()).toBe(false);
  });

  it("returns true when TAC_DEPLOYMENT_MODE=cloud", () => {
    process.env.TAC_DEPLOYMENT_MODE = "cloud";
    expect(isCloudMode()).toBe(true);
  });

  it("returns false when TAC_DEPLOYMENT_MODE=local_trusted", () => {
    process.env.TAC_DEPLOYMENT_MODE = "local_trusted";
    delete process.env.TAC_CLOUD_MODE;
    expect(isCloudMode()).toBe(false);
  });
});

describe("isRuntimeServicesEnabled", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns true when not in cloud mode and no explicit flag", () => {
    delete process.env.TAC_CLOUD_MODE;
    delete process.env.TAC_DEPLOYMENT_MODE;
    delete process.env.TAC_RUNTIME_SERVICES_ENABLED;
    expect(isRuntimeServicesEnabled()).toBe(true);
  });

  it("returns false in cloud mode when no explicit flag", () => {
    process.env.TAC_CLOUD_MODE = "true";
    delete process.env.TAC_RUNTIME_SERVICES_ENABLED;
    expect(isRuntimeServicesEnabled()).toBe(false);
  });

  it("explicit true overrides cloud mode", () => {
    process.env.TAC_CLOUD_MODE = "true";
    process.env.TAC_RUNTIME_SERVICES_ENABLED = "true";
    expect(isRuntimeServicesEnabled()).toBe(true);
  });

  it("explicit false overrides local mode", () => {
    delete process.env.TAC_CLOUD_MODE;
    delete process.env.TAC_DEPLOYMENT_MODE;
    process.env.TAC_RUNTIME_SERVICES_ENABLED = "false";
    expect(isRuntimeServicesEnabled()).toBe(false);
  });
});
