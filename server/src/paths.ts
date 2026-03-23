import fs from "node:fs";
import path from "node:path";
import { resolveDefaultConfigPath } from "./home-paths.js";

const TAC_CONFIG_BASENAME = "config.json";
const TAC_ENV_FILENAME = ".env";

function findConfigFileFromAncestors(startDir: string): string | null {
  const absoluteStartDir = path.resolve(startDir);
  let currentDir = absoluteStartDir;

  while (true) {
    // Check .tac first, then legacy .paperclip
    const tacCandidate = path.resolve(currentDir, ".tac", TAC_CONFIG_BASENAME);
    if (fs.existsSync(tacCandidate)) {
      return tacCandidate;
    }
    const legacyCandidate = path.resolve(currentDir, ".paperclip", TAC_CONFIG_BASENAME);
    if (fs.existsSync(legacyCandidate)) {
      console.warn("[deprecation] .paperclip/ config directory is deprecated, migrate to .tac/");
      return legacyCandidate;
    }

    const nextDir = path.resolve(currentDir, "..");
    if (nextDir === currentDir) break;
    currentDir = nextDir;
  }

  return null;
}

export function resolveTacConfigPath(overridePath?: string): string {
  if (overridePath) return path.resolve(overridePath);
  if (process.env.TAC_CONFIG) return path.resolve(process.env.TAC_CONFIG);
  return findConfigFileFromAncestors(process.cwd()) ?? resolveDefaultConfigPath();
}

export function resolveTacEnvPath(overrideConfigPath?: string): string {
  return path.resolve(path.dirname(resolveTacConfigPath(overrideConfigPath)), TAC_ENV_FILENAME);
}
