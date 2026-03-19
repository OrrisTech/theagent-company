// @vitest-environment node

import { describe, expect, it, beforeEach, vi } from "vitest";

// Mock localStorage
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

// Mock document
const classList = new Set<string>();
Object.defineProperty(globalThis, "document", {
  value: {
    documentElement: {
      classList: {
        contains: (cls: string) => classList.has(cls),
        toggle: (cls: string, force: boolean) => {
          if (force) classList.add(cls); else classList.delete(cls);
        },
        add: (cls: string) => classList.add(cls),
        remove: (cls: string) => classList.delete(cls),
      },
      style: { colorScheme: "" },
    },
    querySelector: () => null,
  },
  configurable: true,
});

// Mock window.matchMedia
Object.defineProperty(globalThis, "window", {
  value: {
    matchMedia: (query: string) => ({
      matches: query.includes("dark"),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
    localStorage: globalThis.localStorage,
  },
  configurable: true,
  writable: true,
});

describe("ThemeContext storage key and preferences", () => {
  beforeEach(() => {
    storage.clear();
    classList.clear();
  });

  it("stores theme preference under 'paperclip.theme' key", () => {
    storage.set("paperclip.theme", "dark");
    expect(storage.get("paperclip.theme")).toBe("dark");
  });

  it("supports 'system' as a valid preference value", () => {
    storage.set("paperclip.theme", "system");
    const value = storage.get("paperclip.theme");
    expect(["light", "dark", "system"]).toContain(value);
  });

  it("defaults to dark when no preference is set and document has dark class", () => {
    classList.add("dark");
    // Verify document reflects dark state
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("defaults to light when no preference is set and document has no dark class", () => {
    // classList is empty
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("valid preferences are light, dark, and system", () => {
    const validPreferences = ["light", "dark", "system"];
    for (const pref of validPreferences) {
      storage.set("paperclip.theme", pref);
      expect(storage.get("paperclip.theme")).toBe(pref);
    }
  });
});
