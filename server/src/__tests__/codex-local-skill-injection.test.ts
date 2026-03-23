import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureCodexSkillsInjected } from "@theagentcompany/adapter-codex-local/server";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createTacRepoSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "server"), { recursive: true });
  await fs.mkdir(path.join(root, "packages", "adapter-utils"), { recursive: true });
  await fs.mkdir(path.join(root, "skills", skillName), { recursive: true });
  await fs.writeFile(path.join(root, "pnpm-workspace.yaml"), "packages:\n  - packages/*\n", "utf8");
  await fs.writeFile(path.join(root, "package.json"), '{"name":"tac"}\n', "utf8");
  await fs.writeFile(
    path.join(root, "skills", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

async function createCustomSkill(root: string, skillName: string) {
  await fs.mkdir(path.join(root, "custom", skillName), { recursive: true });
  await fs.writeFile(
    path.join(root, "custom", skillName, "SKILL.md"),
    `---\nname: ${skillName}\n---\n`,
    "utf8",
  );
}

describe("codex local adapter skill injection", () => {
  const cleanupDirs = new Set<string>();

  afterEach(async () => {
    await Promise.all(Array.from(cleanupDirs).map((dir) => fs.rm(dir, { recursive: true, force: true })));
    cleanupDirs.clear();
  });

  it("repairs a Codex The Agent Company skill symlink that still points at another live checkout", async () => {
    const currentRepo = await makeTempDir("tac-codex-current-");
    const oldRepo = await makeTempDir("tac-codex-old-");
    const skillsHome = await makeTempDir("tac-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(oldRepo);
    cleanupDirs.add(skillsHome);

    await createTacRepoSkill(currentRepo, "tac");
    await createTacRepoSkill(oldRepo, "tac");
    await fs.symlink(path.join(oldRepo, "skills", "tac"), path.join(skillsHome, "tac"));

    const logs: Array<{ stream: "stdout" | "stderr"; chunk: string }> = [];
    await ensureCodexSkillsInjected(
      async (stream, chunk) => {
        logs.push({ stream, chunk });
      },
      {
        skillsHome,
        skillsEntries: [{ name: "tac", source: path.join(currentRepo, "skills", "tac") }],
      },
    );

    expect(await fs.realpath(path.join(skillsHome, "tac"))).toBe(
      await fs.realpath(path.join(currentRepo, "skills", "tac")),
    );
    expect(logs).toContainEqual(
      expect.objectContaining({
        stream: "stdout",
        chunk: expect.stringContaining('Repaired Codex skill "tac"'),
      }),
    );
  });

  it("preserves a custom Codex skill symlink outside The Agent Company repo checkouts", async () => {
    const currentRepo = await makeTempDir("tac-codex-current-");
    const customRoot = await makeTempDir("tac-codex-custom-");
    const skillsHome = await makeTempDir("tac-codex-home-");
    cleanupDirs.add(currentRepo);
    cleanupDirs.add(customRoot);
    cleanupDirs.add(skillsHome);

    await createTacRepoSkill(currentRepo, "tac");
    await createCustomSkill(customRoot, "tac");
    await fs.symlink(path.join(customRoot, "custom", "tac"), path.join(skillsHome, "tac"));

    await ensureCodexSkillsInjected(async () => {}, {
      skillsHome,
      skillsEntries: [{ name: "tac", source: path.join(currentRepo, "skills", "tac") }],
    });

    expect(await fs.realpath(path.join(skillsHome, "tac"))).toBe(
      await fs.realpath(path.join(customRoot, "custom", "tac")),
    );
  });
});
