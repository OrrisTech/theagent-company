import { readFileSync, existsSync } from "node:fs";

/**
 * Detect whether the server is running in cloud/Docker deployment mode.
 * Cloud mode is activated by any of:
 *   - TAC_CLOUD_MODE=true
 *   - TAC_DEPLOYMENT_MODE=cloud
 *   - Running inside a Docker container (/.dockerenv or /proc/1/cgroup contains "docker")
 */
export function isCloudMode(): boolean {
  return (
    process.env.TAC_CLOUD_MODE === "true" ||
    process.env.TAC_DEPLOYMENT_MODE === "cloud" ||
    isRunningInDocker()
  );
}

/**
 * Check if the current process is running inside a Docker container
 * by looking for /.dockerenv or "docker" in /proc/1/cgroup.
 */
function isRunningInDocker(): boolean {
  try {
    if (existsSync("/.dockerenv")) return true;
    const cgroup = readFileSync("/proc/1/cgroup", "utf-8");
    return cgroup.includes("docker");
  } catch {
    return false;
  }
}

/**
 * Check whether local runtime services (process spawning) are enabled.
 * Defaults to true in local mode, false in cloud mode.
 * Can be overridden explicitly via TAC_RUNTIME_SERVICES_ENABLED.
 */
export function isRuntimeServicesEnabled(): boolean {
  const explicit = process.env.TAC_RUNTIME_SERVICES_ENABLED;
  if (explicit !== undefined) {
    return explicit === "true";
  }
  return !isCloudMode();
}
