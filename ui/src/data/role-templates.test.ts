// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  ROLE_TEMPLATES,
  ROLE_TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  getTemplateById,
  type RoleTemplate,
} from "./role-templates";
import { AGENT_ROLES, AGENT_ADAPTER_TYPES } from "@theagentcompany/shared";

describe("Role Templates — data integrity", () => {
  it("has at least 15 templates", () => {
    expect(ROLE_TEMPLATES.length).toBeGreaterThanOrEqual(15);
  });

  it("every template has a unique id", () => {
    const ids = ROLE_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every template has all required fields populated", () => {
    for (const tpl of ROLE_TEMPLATES) {
      expect(tpl.id, `${tpl.id}: missing id`).toBeTruthy();
      expect(tpl.name, `${tpl.id}: missing name`).toBeTruthy();
      expect(tpl.nameZh, `${tpl.id}: missing nameZh`).toBeTruthy();
      expect(tpl.icon, `${tpl.id}: missing icon`).toBeTruthy();
      expect(tpl.category, `${tpl.id}: missing category`).toBeTruthy();
      expect(tpl.role, `${tpl.id}: missing role`).toBeTruthy();
      expect(tpl.soul.length, `${tpl.id}: soul too short`).toBeGreaterThan(50);
      expect(tpl.systemPrompt.length, `${tpl.id}: systemPrompt too short`).toBeGreaterThan(100);
      expect(tpl.capabilities, `${tpl.id}: missing capabilities`).toBeTruthy();
      expect(tpl.recommendedEngine, `${tpl.id}: missing recommendedEngine`).toBeTruthy();
      // suggestedSkills is an array (can be empty)
      expect(Array.isArray(tpl.suggestedSkills)).toBe(true);
    }
  });

  it("every template.role is a valid AGENT_ROLE", () => {
    const validRoles = new Set<string>(AGENT_ROLES);
    for (const tpl of ROLE_TEMPLATES) {
      expect(
        validRoles.has(tpl.role),
        `${tpl.id}: role "${tpl.role}" is not in AGENT_ROLES`,
      ).toBe(true);
    }
  });

  it("every template.recommendedEngine is a valid AGENT_ADAPTER_TYPE", () => {
    const validTypes = new Set<string>(AGENT_ADAPTER_TYPES);
    for (const tpl of ROLE_TEMPLATES) {
      expect(
        validTypes.has(tpl.recommendedEngine),
        `${tpl.id}: recommendedEngine "${tpl.recommendedEngine}" is not a valid adapter type`,
      ).toBe(true);
    }
  });

  it("every template.category is listed in ROLE_TEMPLATE_CATEGORIES", () => {
    const validCategories = new Set(ROLE_TEMPLATE_CATEGORIES.map((c) => c.id));
    for (const tpl of ROLE_TEMPLATES) {
      expect(
        validCategories.has(tpl.category),
        `${tpl.id}: category "${tpl.category}" not in ROLE_TEMPLATE_CATEGORIES`,
      ).toBe(true);
    }
  });

  it("every category has at least one template", () => {
    for (const cat of ROLE_TEMPLATE_CATEGORIES) {
      const templates = getTemplatesByCategory(cat.id);
      expect(
        templates.length,
        `category "${cat.id}" has no templates`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it("soul text is production-quality (multi-sentence, no placeholder markers)", () => {
    const placeholders = ["{", "TODO", "PLACEHOLDER", "TBD", "xxx", "...", "lorem"];
    for (const tpl of ROLE_TEMPLATES) {
      for (const marker of placeholders) {
        // Allow {company} in systemPrompt but not in soul
        if (marker === "{") {
          expect(
            tpl.soul.includes("{"),
            `${tpl.id}: soul should not contain template variables`,
          ).toBe(false);
        } else {
          expect(
            tpl.soul.toLowerCase().includes(marker.toLowerCase()),
            `${tpl.id}: soul contains placeholder "${marker}"`,
          ).toBe(false);
        }
      }
    }
  });

  it("systemPrompt uses {company} placeholder consistently", () => {
    for (const tpl of ROLE_TEMPLATES) {
      expect(
        tpl.systemPrompt.includes("{company}"),
        `${tpl.id}: systemPrompt should contain {company} placeholder`,
      ).toBe(true);
    }
  });
});

describe("Role Templates — lookup functions", () => {
  it("getTemplateById returns correct template", () => {
    const ceo = getTemplateById("ceo");
    expect(ceo).toBeDefined();
    expect(ceo!.name).toBe("CEO");
    expect(ceo!.role).toBe("ceo");
  });

  it("getTemplateById returns undefined for unknown id", () => {
    expect(getTemplateById("nonexistent")).toBeUndefined();
  });

  it("getTemplatesByCategory returns only matching templates", () => {
    const engineering = getTemplatesByCategory("engineering");
    expect(engineering.length).toBeGreaterThanOrEqual(3);
    for (const tpl of engineering) {
      expect(tpl.category).toBe("engineering");
    }
  });

  it("getTemplatesByCategory returns empty array for nonexistent category", () => {
    const result = getTemplatesByCategory("nonexistent" as never);
    expect(result).toEqual([]);
  });
});

describe("Role Templates — covers expected roles", () => {
  const templateIds = new Set(ROLE_TEMPLATES.map((t) => t.id));

  it.each([
    "ceo", "cto", "coo", "cmo",
    "frontend-engineer", "backend-engineer", "fullstack-engineer", "devops-engineer",
    "product-manager", "designer",
    "content-writer", "growth-marketer", "seo-specialist",
    "qa-engineer", "data-analyst",
  ])("includes template: %s", (id) => {
    expect(templateIds.has(id)).toBe(true);
  });
});
