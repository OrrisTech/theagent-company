import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execute } from "@theagentcompany/adapter-codex-local/server";

async function writeFakeCodexCommand(commandPath: string): Promise<void> {
  const script = `#!/usr/bin/env node
const fs = require("node:fs");

const capturePath = process.env.TAC_TEST_CAPTURE_PATH;
const payload = {
  argv: process.argv.slice(2),
  prompt: fs.readFileSync(0, "utf8"),
  codexHome: process.env.CODEX_HOME || null,
  tacEnvKeys: Object.keys(process.env)
    .filter((key) => key.startsWith("TAC_"))
    .sort(),
};
if (capturePath) {
  fs.writeFileSync(capturePath, JSON.stringify(payload), "utf8");
}
console.log(JSON.stringify({ type: "thread.started", thread_id: "codex-session-1" }));
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "hello" } }));
console.log(JSON.stringify({ type: "turn.completed", usage: { input_tokens: 1, cached_input_tokens: 0, output_tokens: 1 } }));
`;
  await fs.writeFile(commandPath, script, "utf8");
  await fs.chmod(commandPath, 0o755);
}

type CapturePayload = {
  argv: string[];
  prompt: string;
  codexHome: string | null;
  tacEnvKeys: string[];
};

type LogEntry = {
  stream: "stdout" | "stderr";
  chunk: string;
};

describe("codex execute", () => {
  it("uses a worktree-isolated CODEX_HOME while preserving shared auth and config", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tac-codex-execute-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const tacHome = path.join(root, "tac-home");
    const isolatedCodexHome = path.join(tacHome, "instances", "worktree-1", "codex-home");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await fs.writeFile(path.join(sharedCodexHome, "config.toml"), 'model = "codex-mini-latest"\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousTacHome = process.env.TAC_HOME;
    const previousTacInstanceId = process.env.TAC_INSTANCE_ID;
    const previousTacInWorktree = process.env.TAC_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.TAC_HOME = tacHome;
    process.env.TAC_INSTANCE_ID = "worktree-1";
    process.env.TAC_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const logs: LogEntry[] = [];
      const result = await execute({
        runId: "run-1",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            TAC_TEST_CAPTURE_PATH: capturePath,
          },
          promptTemplate: "Follow the TAC heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async (stream, chunk) => {
          logs.push({ stream, chunk });
        },
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.codexHome).toBe(isolatedCodexHome);
      expect(capture.argv).toEqual(expect.arrayContaining(["exec", "--json", "-"]));
      expect(capture.prompt).toContain("Follow the TAC heartbeat.");
      expect(capture.tacEnvKeys).toEqual(
        expect.arrayContaining([
          "TAC_AGENT_ID",
          "TAC_API_KEY",
          "TAC_API_URL",
          "TAC_COMPANY_ID",
          "TAC_RUN_ID",
        ]),
      );

      const isolatedAuth = path.join(isolatedCodexHome, "auth.json");
      const isolatedConfig = path.join(isolatedCodexHome, "config.toml");
      const isolatedSkill = path.join(isolatedCodexHome, "skills", "tac");

      expect((await fs.lstat(isolatedAuth)).isSymbolicLink()).toBe(true);
      expect(await fs.realpath(isolatedAuth)).toBe(await fs.realpath(path.join(sharedCodexHome, "auth.json")));
      expect((await fs.lstat(isolatedConfig)).isFile()).toBe(true);
      expect(await fs.readFile(isolatedConfig, "utf8")).toBe('model = "codex-mini-latest"\n');
      expect((await fs.lstat(isolatedSkill)).isSymbolicLink()).toBe(true);
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining("Using worktree-isolated Codex home"),
        }),
      );
      expect(logs).toContainEqual(
        expect.objectContaining({
          stream: "stdout",
          chunk: expect.stringContaining('Injected Codex skill "tac"'),
        }),
      );
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousTacHome === undefined) delete process.env.TAC_HOME;
      else process.env.TAC_HOME = previousTacHome;
      if (previousTacInstanceId === undefined) delete process.env.TAC_INSTANCE_ID;
      else process.env.TAC_INSTANCE_ID = previousTacInstanceId;
      if (previousTacInWorktree === undefined) delete process.env.TAC_IN_WORKTREE;
      else process.env.TAC_IN_WORKTREE = previousTacInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("respects an explicit CODEX_HOME config override even in worktree mode", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "tac-codex-execute-explicit-"));
    const workspace = path.join(root, "workspace");
    const commandPath = path.join(root, "codex");
    const capturePath = path.join(root, "capture.json");
    const sharedCodexHome = path.join(root, "shared-codex-home");
    const explicitCodexHome = path.join(root, "explicit-codex-home");
    const tacHome = path.join(root, "tac-home");
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(sharedCodexHome, { recursive: true });
    await fs.writeFile(path.join(sharedCodexHome, "auth.json"), '{"token":"shared"}\n', "utf8");
    await writeFakeCodexCommand(commandPath);

    const previousHome = process.env.HOME;
    const previousTacHome = process.env.TAC_HOME;
    const previousTacInstanceId = process.env.TAC_INSTANCE_ID;
    const previousTacInWorktree = process.env.TAC_IN_WORKTREE;
    const previousCodexHome = process.env.CODEX_HOME;
    process.env.HOME = root;
    process.env.TAC_HOME = tacHome;
    process.env.TAC_INSTANCE_ID = "worktree-1";
    process.env.TAC_IN_WORKTREE = "true";
    process.env.CODEX_HOME = sharedCodexHome;

    try {
      const result = await execute({
        runId: "run-2",
        agent: {
          id: "agent-1",
          companyId: "company-1",
          name: "Codex Coder",
          adapterType: "codex_local",
          adapterConfig: {},
        },
        runtime: {
          sessionId: null,
          sessionParams: null,
          sessionDisplayId: null,
          taskKey: null,
        },
        config: {
          command: commandPath,
          cwd: workspace,
          env: {
            TAC_TEST_CAPTURE_PATH: capturePath,
            CODEX_HOME: explicitCodexHome,
          },
          promptTemplate: "Follow the TAC heartbeat.",
        },
        context: {},
        authToken: "run-jwt-token",
        onLog: async () => {},
      });

      expect(result.exitCode).toBe(0);
      expect(result.errorMessage).toBeNull();

      const capture = JSON.parse(await fs.readFile(capturePath, "utf8")) as CapturePayload;
      expect(capture.codexHome).toBe(explicitCodexHome);
      await expect(fs.lstat(path.join(tacHome, "instances", "worktree-1", "codex-home"))).rejects.toThrow();
    } finally {
      if (previousHome === undefined) delete process.env.HOME;
      else process.env.HOME = previousHome;
      if (previousTacHome === undefined) delete process.env.TAC_HOME;
      else process.env.TAC_HOME = previousTacHome;
      if (previousTacInstanceId === undefined) delete process.env.TAC_INSTANCE_ID;
      else process.env.TAC_INSTANCE_ID = previousTacInstanceId;
      if (previousTacInWorktree === undefined) delete process.env.TAC_IN_WORKTREE;
      else process.env.TAC_IN_WORKTREE = previousTacInWorktree;
      if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
      else process.env.CODEX_HOME = previousCodexHome;
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
