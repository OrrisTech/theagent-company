// @vitest-environment node

import { describe, expect, it, beforeEach } from "vitest";

// Mock localStorage before importing i18n
const storage = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => { storage.set(key, value); },
    removeItem: (key: string) => { storage.delete(key); },
    clear: () => { storage.clear(); },
  },
  configurable: true,
});

// Mock navigator for language detection
Object.defineProperty(globalThis, "navigator", {
  value: { language: "en-US", languages: ["en-US", "en"] },
  configurable: true,
});

import en from "./en.json";
import zh from "./zh.json";

describe("i18n translation resources", () => {
  it("en.json has all required top-level sections", () => {
    const required = ["common", "sidebar", "theme", "branding", "language", "settings", "pages",
      "overview", "usage", "memory", "documents", "collaboration",
      "models", "channels", "skills", "cron", "teamMember"];
    for (const key of required) {
      expect(Object.keys(en), `en.json should have section '${key}'`).toContain(key);
    }
  });

  it("zh.json has all required top-level sections", () => {
    const required = ["common", "sidebar", "theme", "branding", "language", "settings", "pages",
      "overview", "usage", "memory", "documents", "collaboration",
      "models", "channels", "skills", "cron", "teamMember"];
    for (const key of required) {
      expect(Object.keys(zh), `zh.json should have section '${key}'`).toContain(key);
    }
  });

  it("en and zh have matching keys in common section", () => {
    const enKeys = Object.keys(en.common).sort();
    const zhKeys = Object.keys(zh.common).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("en and zh have matching keys in sidebar section", () => {
    const enKeys = Object.keys(en.sidebar).sort();
    const zhKeys = Object.keys(zh.sidebar).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("en and zh have matching keys in theme section", () => {
    const enKeys = Object.keys(en.theme).sort();
    const zhKeys = Object.keys(zh.theme).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("en and zh have matching keys in branding section", () => {
    const enKeys = Object.keys(en.branding).sort();
    const zhKeys = Object.keys(zh.branding).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("en and zh have matching keys in pages section", () => {
    const enKeys = Object.keys(en.pages).sort();
    const zhKeys = Object.keys(zh.pages).sort();
    expect(enKeys).toEqual(zhKeys);
  });

  it("all en string values are non-empty", () => {
    function checkNonEmpty(obj: Record<string, unknown>, path = "") {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (typeof value === "string") {
          expect(value.length, `${fullPath} should not be empty`).toBeGreaterThan(0);
        } else if (typeof value === "object" && value !== null) {
          checkNonEmpty(value as Record<string, unknown>, fullPath);
        }
      }
    }
    checkNonEmpty(en);
  });

  it("all zh string values are non-empty", () => {
    function checkNonEmpty(obj: Record<string, unknown>, path = "") {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = path ? `${path}.${key}` : key;
        if (typeof value === "string") {
          expect(value.length, `${fullPath} should not be empty`).toBeGreaterThan(0);
        } else if (typeof value === "object" && value !== null) {
          checkNonEmpty(value as Record<string, unknown>, fullPath);
        }
      }
    }
    checkNonEmpty(zh);
  });

  it("sidebar section has keys for all PRD navigation items", () => {
    const requiredKeys = [
      "overview", "projects", "team", "members", "orgChart",
      "workflows", "usageBudget", "documents", "memory",
      "collaboration", "settings", "models", "channels",
      "skills", "cronHeartbeat", "branding", "language", "security",
    ];
    for (const key of requiredKeys) {
      expect(en.sidebar, `sidebar should have key '${key}'`).toHaveProperty(key);
      expect(zh.sidebar, `sidebar (zh) should have key '${key}'`).toHaveProperty(key);
    }
  });

  it("en.json has Phase 4 sections (models, channels, skills, cron, teamMember)", () => {
    const phase4Sections = ["models", "channels", "skills", "cron", "teamMember"];
    for (const key of phase4Sections) {
      expect(Object.keys(en), `en.json should have section '${key}'`).toContain(key);
    }
  });

  it("zh.json has Phase 4 sections (models, channels, skills, cron, teamMember)", () => {
    const phase4Sections = ["models", "channels", "skills", "cron", "teamMember"];
    for (const key of phase4Sections) {
      expect(Object.keys(zh), `zh.json should have section '${key}'`).toContain(key);
    }
  });

  it("en and zh have matching keys in Phase 4 sections", () => {
    const phase4Sections = ["models", "channels", "skills", "cron", "teamMember"] as const;
    for (const section of phase4Sections) {
      const enSection = en[section] as Record<string, unknown>;
      const zhSection = zh[section] as Record<string, unknown>;
      function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
        const keys: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (typeof v === "object" && v !== null) {
            keys.push(...flatKeys(v as Record<string, unknown>, path));
          } else {
            keys.push(path);
          }
        }
        return keys;
      }
      const enKeys = flatKeys(enSection).sort();
      const zhKeys = flatKeys(zhSection).sort();
      expect(enKeys, `${section} section keys should match between en and zh`).toEqual(zhKeys);
    }
  });

  it("en and zh have matching keys in Phase 3 sections", () => {
    const phase3Sections = ["overview", "usage", "memory", "documents", "collaboration"] as const;
    for (const section of phase3Sections) {
      const enSection = en[section] as Record<string, unknown>;
      const zhSection = zh[section] as Record<string, unknown>;
      // Compare flattened key sets
      function flatKeys(obj: Record<string, unknown>, prefix = ""): string[] {
        const keys: string[] = [];
        for (const [k, v] of Object.entries(obj)) {
          const path = prefix ? `${prefix}.${k}` : k;
          if (typeof v === "object" && v !== null) {
            keys.push(...flatKeys(v as Record<string, unknown>, path));
          } else {
            keys.push(path);
          }
        }
        return keys;
      }
      const enKeys = flatKeys(enSection).sort();
      const zhKeys = flatKeys(zhSection).sort();
      expect(enKeys, `${section} section keys should match between en and zh`).toEqual(zhKeys);
    }
  });

  it("pages section covers all placeholder pages", () => {
    const requiredPages = [
      "overview", "workflows", "usageBudget", "documents",
      "memory", "collaboration", "models", "channels",
      "skills", "cronHeartbeat", "security", "languageSettings",
    ];
    for (const page of requiredPages) {
      expect(en.pages, `pages should have key '${page}'`).toHaveProperty(page);
      expect(zh.pages, `pages (zh) should have key '${page}'`).toHaveProperty(page);
      // Each page should have title and description
      const enPage = (en.pages as unknown as Record<string, Record<string, unknown>>)[page]!;
      const zhPage = (zh.pages as unknown as Record<string, Record<string, unknown>>)[page]!;
      expect(enPage).toHaveProperty("title");
      expect(enPage).toHaveProperty("description");
      expect(zhPage).toHaveProperty("title");
      expect(zhPage).toHaveProperty("description");
    }
  });
});
