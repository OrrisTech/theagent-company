/**
 * Eval case: Soul Layer Injection — verifies the system prompt builder
 * correctly injects Team Member soul into Identity layer, jobDescription
 * into Capabilities layer, and uses engine-specific formatting.
 */
import { describe, it, expect } from "vitest";
import { defineEvalCase, summarizeResults } from "../runner.js";
import {
  buildSystemPrompt,
  soulToMarkdown,
  markdownToSoul,
} from "../../../server/src/services/soul-injection.js";

describe("Eval: Soul Layer Injection", () => {
  // --- Capability test: openclaw engine uses XML tags ---
  const openclawCase = defineEvalCase({
    id: "soul-openclaw-xml-tags",
    name: "OpenClaw engine uses XML-style layer tags",
    type: "capability",
    async grader() {
      const result = buildSystemPrompt({
        name: "来财",
        soul: "Direct, humorous, speaks in short sentences.",
        jobDescription: "Manage company operations and strategy.",
        engineType: "openclaw",
        skills: ["research", "writing"],
      });

      const hasIdentityTag = result.systemPrompt.includes("<identity>");
      const hasCapTag = result.systemPrompt.includes("<capabilities>");
      const hasSoul = result.systemPrompt.includes("Direct, humorous");
      const hasJobDesc = result.systemPrompt.includes("Manage company operations");
      const hasSkills = result.systemPrompt.includes("research");

      const passed = hasIdentityTag && hasCapTag && hasSoul && hasJobDesc && hasSkills;
      return { passed, score: passed ? 1 : 0 };
    },
  });

  it("openclaw uses XML tags (capability)", async () => {
    const result = await openclawCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Capability test: claude_local uses markdown ---
  const claudeCase = defineEvalCase({
    id: "soul-claude-markdown",
    name: "Claude local engine uses markdown-style layers",
    type: "capability",
    async grader() {
      const result = buildSystemPrompt({
        name: "Coder-1",
        soul: "Focused and efficient.",
        jobDescription: "Write and review code.",
        engineType: "claude_local",
      });

      const noXmlTags = !result.systemPrompt.includes("<identity>");
      const hasName = result.systemPrompt.includes("You are Coder-1");
      const hasSoul = result.systemPrompt.includes("Focused and efficient");
      const hasJobDesc = result.systemPrompt.includes("Write and review code");

      const passed = noXmlTags && hasName && hasSoul && hasJobDesc;
      return { passed, score: passed ? 1 : 0 };
    },
  });

  it("claude_local uses markdown (capability)", async () => {
    const result = await claudeCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Regression test: SOUL.md round-trip ---
  const roundTripCase = defineEvalCase({
    id: "soul-markdown-roundtrip",
    name: "Soul <-> SOUL.md round-trip preserves content",
    type: "regression",
    async grader() {
      const originalSoul = "Direct, no-nonsense. Always gives actionable advice.\nAvoid filler words.";
      const md = soulToMarkdown("来财", originalSoul);
      const recovered = markdownToSoul(md);

      const passed = recovered === originalSoul;
      return {
        passed,
        score: passed ? 1 : 0,
        error: passed ? undefined : `Expected "${originalSoul}", got "${recovered}"`,
      };
    },
  });

  it("SOUL.md round-trip (regression)", async () => {
    const result = await roundTripCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Regression test: null soul produces valid prompt ---
  const nullSoulCase = defineEvalCase({
    id: "soul-null-soul-valid",
    name: "Null soul produces valid prompt without crash",
    type: "regression",
    async grader() {
      const result = buildSystemPrompt({
        name: "Agent-X",
        soul: null,
        jobDescription: null,
        engineType: "http",
      });

      const passed =
        result.systemPrompt.includes("You are Agent-X") &&
        result.layers.identity.length > 0;

      return { passed, score: passed ? 1 : 0 };
    },
  });

  it("null soul produces valid prompt (regression)", async () => {
    const result = await nullSoulCase.run();
    expect(result.passed).toBe(true);
  });

  // --- Summary ---
  it("summarizes all soul injection eval results", async () => {
    const results = await Promise.all([
      openclawCase.run(),
      claudeCase.run(),
      roundTripCase.run(),
      nullSoulCase.run(),
    ]);

    const summary = summarizeResults(results);
    expect(summary.totalCases).toBe(4);
    expect(summary.passed).toBe(4);
  });
});
