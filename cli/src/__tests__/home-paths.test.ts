import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  describeLocalInstancePaths,
  expandHomePrefix,
  resolveTacHomeDir,
  resolveTacInstanceId,
} from "../config/home.js";

const ORIGINAL_ENV = { ...process.env };

describe("home path resolution", () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("defaults to ~/.tac and default instance", () => {
    delete process.env.TAC_HOME;
    delete process.env.TAC_INSTANCE_ID;
    // Ensure no legacy fallback by pretending neither dir exists
    vi.spyOn(fs, "existsSync").mockReturnValue(false);

    const paths = describeLocalInstancePaths();
    expect(paths.homeDir).toBe(path.resolve(os.homedir(), ".tac"));
    expect(paths.instanceId).toBe("default");
    expect(paths.configPath).toBe(path.resolve(os.homedir(), ".tac", "instances", "default", "config.json"));
  });

  it("falls back to ~/.paperclip when ~/.tac does not exist but ~/.paperclip does", () => {
    delete process.env.TAC_HOME;
    const tacDir = path.resolve(os.homedir(), ".tac");
    const legacyDir = path.resolve(os.homedir(), ".paperclip");
    vi.spyOn(fs, "existsSync").mockImplementation((p) => {
      if (String(p) === tacDir) return false;
      if (String(p) === legacyDir) return true;
      return false;
    });

    expect(resolveTacHomeDir()).toBe(legacyDir);
  });

  it("supports TAC_HOME and explicit instance ids", () => {
    process.env.TAC_HOME = "~/tac-home";

    const home = resolveTacHomeDir();
    expect(home).toBe(path.resolve(os.homedir(), "tac-home"));
    expect(resolveTacInstanceId("dev_1")).toBe("dev_1");
  });

  it("rejects invalid instance ids", () => {
    expect(() => resolveTacInstanceId("bad/id")).toThrow(/Invalid instance id/);
  });

  it("expands ~ prefixes", () => {
    expect(expandHomePrefix("~")).toBe(os.homedir());
    expect(expandHomePrefix("~/x/y")).toBe(path.resolve(os.homedir(), "x/y"));
  });
});
