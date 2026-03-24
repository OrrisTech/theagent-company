import { afterEach, describe, expect, it } from "vitest";
import { ensureRuntimeServicesForRun, type RealizedExecutionWorkspace } from "../services/workspace-runtime.ts";

function buildWorkspace(cwd: string): RealizedExecutionWorkspace {
  return {
    baseCwd: cwd,
    source: "project_primary",
    projectId: "project-1",
    workspaceId: "workspace-1",
    repoUrl: null,
    repoRef: "HEAD",
    strategy: "project_primary",
    cwd,
    branchName: null,
    worktreePath: null,
    warnings: [],
    created: false,
  };
}

describe("runtime services degradation in cloud mode", () => {
  const savedEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("returns empty array when runtime services are disabled", async () => {
    process.env.TAC_CLOUD_MODE = "true";
    delete process.env.TAC_RUNTIME_SERVICES_ENABLED;

    const refs = await ensureRuntimeServicesForRun({
      runId: "test-run-1",
      agent: { id: "agent-1", name: "Test Agent", companyId: "company-1" },
      issue: null,
      workspace: buildWorkspace("/tmp/test"),
      config: {
        workspaceRuntime: {
          services: [
            { name: "dev-server", command: "npm run dev", port: 3000 },
          ],
        },
      },
      adapterEnv: {},
    });

    expect(refs).toEqual([]);
  });

  it("returns empty array when explicitly disabled in local mode", async () => {
    delete process.env.TAC_CLOUD_MODE;
    process.env.TAC_RUNTIME_SERVICES_ENABLED = "false";

    const refs = await ensureRuntimeServicesForRun({
      runId: "test-run-2",
      agent: { id: "agent-2", name: "Test Agent", companyId: "company-1" },
      issue: null,
      workspace: buildWorkspace("/tmp/test"),
      config: {
        workspaceRuntime: {
          services: [
            { name: "dev-server", command: "npm run dev", port: 3000 },
          ],
        },
      },
      adapterEnv: {},
    });

    expect(refs).toEqual([]);
  });
});
