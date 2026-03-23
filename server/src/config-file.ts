import fs from "node:fs";
import { tacConfigSchema, type TacConfig } from "@theagentcompany/shared";
import { resolveTacConfigPath } from "./paths.js";

export function readConfigFile(): TacConfig | null {
  const configPath = resolveTacConfigPath();

  if (!fs.existsSync(configPath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    return tacConfigSchema.parse(raw);
  } catch {
    return null;
  }
}
