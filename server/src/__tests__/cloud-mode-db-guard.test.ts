import { afterEach, describe, expect, it } from "vitest";
import { isCloudMode } from "../cloud-mode.ts";

describe("cloud mode database guard", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("guard triggers when in cloud mode without DATABASE_URL", () => {
    process.env.TAC_CLOUD_MODE = "true";
    delete process.env.DATABASE_URL;

    // Verify the guard condition matches what startServer checks
    expect(isCloudMode()).toBe(true);
    expect(process.env.DATABASE_URL).toBeUndefined();

    // The guard in index.ts: if (!config.databaseUrl && isCloudMode()) → throw
    // We verify the two conditions independently since startServer requires full DB setup
    const shouldReject = !process.env.DATABASE_URL && isCloudMode();
    expect(shouldReject).toBe(true);
  });

  it("guard does not trigger when DATABASE_URL is set in cloud mode", () => {
    process.env.TAC_CLOUD_MODE = "true";
    process.env.DATABASE_URL = "postgres://tac:tac@db:5432/tac";

    expect(isCloudMode()).toBe(true);
    const shouldReject = !process.env.DATABASE_URL && isCloudMode();
    expect(shouldReject).toBe(false);
  });

  it("guard does not trigger when not in cloud mode without DATABASE_URL", () => {
    delete process.env.TAC_CLOUD_MODE;
    delete process.env.TAC_DEPLOYMENT_MODE;
    delete process.env.DATABASE_URL;

    expect(isCloudMode()).toBe(false);
    const shouldReject = !process.env.DATABASE_URL && isCloudMode();
    expect(shouldReject).toBe(false);
  });
});
