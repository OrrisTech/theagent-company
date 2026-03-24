/**
 * Tests that role template soul texts integrate correctly with the
 * soul injection service — verifying that template-sourced souls
 * produce valid multi-layer system prompts.
 */
import { describe, it, expect } from "vitest";
import { buildSystemPrompt, soulToMarkdown, markdownToSoul } from "../services/soul-injection.js";

// Import a sample of template soul/capabilities values directly
// to avoid depending on the UI package from server tests.
const SAMPLE_TEMPLATES = [
  {
    id: "frontend-engineer",
    name: "Frontend Engineer",
    soul: "You are a senior frontend engineer who takes pride in clean, performant code. You think in components, care deeply about user experience, and ship pixel-perfect implementations. You prefer pragmatic solutions over over-engineering, and you always consider accessibility and responsive design.",
    capabilities: "React, TypeScript, CSS/Tailwind, responsive design, accessibility, component architecture, performance optimization",
  },
  {
    id: "ceo",
    name: "CEO",
    soul: "You are a visionary strategic leader who balances ambitious long-term thinking with pragmatic execution. You communicate with clarity and conviction, inspire your team with purpose, and make tough calls decisively. You value transparency, hold yourself and others to high standards, and never lose sight of the mission.",
    capabilities: "Strategic planning, team leadership, stakeholder management, fundraising, company culture",
  },
  {
    id: "data-analyst",
    name: "Data Analyst",
    soul: "You are a data analyst who transforms raw numbers into actionable insights. You question assumptions, validate data quality before drawing conclusions, and present findings in ways that drive decisions — not just dashboards. You know that the most important metric is the one that changes behavior.",
    capabilities: "SQL, data visualization, metrics definition, cohort analysis, A/B test analysis, dashboard building, reporting",
  },
];

describe("Role template soul injection", () => {
  for (const tpl of SAMPLE_TEMPLATES) {
    describe(`template: ${tpl.id}`, () => {
      it("builds a valid system prompt with soul and capabilities", () => {
        const result = buildSystemPrompt({
          name: tpl.name,
          soul: tpl.soul,
          jobDescription: tpl.capabilities,
          engineType: "claude_local",
          skills: [],
        });

        // Identity layer contains name and soul
        expect(result.layers.identity).toContain(tpl.name);
        expect(result.layers.identity).toContain("Personality & Guidelines");
        expect(result.layers.identity).toContain(tpl.soul);

        // Capabilities layer contains job description
        expect(result.layers.capabilities).toContain(tpl.capabilities);

        // Full prompt is non-empty and contains both layers
        expect(result.systemPrompt.length).toBeGreaterThan(100);
        expect(result.systemPrompt).toContain(tpl.name);
        expect(result.systemPrompt).toContain(tpl.soul);
      });

      it("SOUL.md round-trip preserves template soul", () => {
        const md = soulToMarkdown(tpl.name, tpl.soul);
        const recovered = markdownToSoul(md);
        expect(recovered).toBe(tpl.soul);
      });

      it("openclaw engine wraps soul in XML tags", () => {
        const result = buildSystemPrompt({
          name: tpl.name,
          soul: tpl.soul,
          jobDescription: tpl.capabilities,
          engineType: "openclaw",
        });

        expect(result.systemPrompt).toContain("<identity>");
        expect(result.systemPrompt).toContain("</identity>");
        expect(result.systemPrompt).toContain("<capabilities>");
        expect(result.systemPrompt).toContain("</capabilities>");
      });
    });
  }

  it("handles null soul gracefully (custom blank-slate template)", () => {
    const result = buildSystemPrompt({
      name: "Custom Agent",
      soul: null,
      jobDescription: null,
      engineType: "claude_local",
    });

    expect(result.systemPrompt).toContain("You are Custom Agent");
    expect(result.systemPrompt).not.toContain("Personality");
  });
});
