import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for Phase 7 — Polish & Error Handling.
 *
 * These are lightweight structural tests that verify:
 * - ErrorBoundary and QueryError components exist at their expected paths
 * - i18n JSON files contain all required Phase 7 error-handling keys
 * - i18n JSON files contain Phase 6 sidebar navigation keys
 * - index.css defines dark mode CSS custom properties
 *
 * No React rendering is performed — tests only inspect the filesystem
 * and the shape of static assets, keeping them fast and dependency-free.
 */

// Use import.meta.url to get a reliable absolute path for this test file,
// regardless of which directory vitest is invoked from.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Resolve paths relative to the ui package root.
// This file lives at: ui/src/__tests__/phase7-polish.test.ts
// __dirname resolves to: ui/src/__tests__
// Going two levels up lands at: ui/
const UI_ROOT = path.resolve(__dirname, "../..");
const SRC = path.join(UI_ROOT, "src");
const I18N_DIR = path.join(SRC, "i18n");

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Read and JSON-parse an i18n locale file. */
function readLocale(filename: string): Record<string, unknown> {
  const fullPath = path.join(I18N_DIR, filename);
  const raw = fs.readFileSync(fullPath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Component file existence
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — ErrorBoundary component", () => {
  const componentPath = path.join(SRC, "components", "ErrorBoundary.tsx");

  it("file exists at ui/src/components/ErrorBoundary.tsx", () => {
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it("file is non-empty", () => {
    const stat = fs.statSync(componentPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("exports a class named ErrorBoundary", () => {
    // Read source and check for the named export without importing the module
    // (avoids pulling in React / Radix UI into the node test environment).
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("export class ErrorBoundary");
  });

  it("uses getDerivedStateFromError lifecycle (confirms it is a proper error boundary)", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("getDerivedStateFromError");
  });

  it("references errorBoundaryTitle and refreshPage i18n keys", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("common.errorBoundaryTitle");
    expect(source).toContain("common.refreshPage");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. QueryError component file existence
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — QueryError component", () => {
  const componentPath = path.join(SRC, "components", "QueryError.tsx");

  it("file exists at ui/src/components/QueryError.tsx", () => {
    expect(fs.existsSync(componentPath)).toBe(true);
  });

  it("file is non-empty", () => {
    const stat = fs.statSync(componentPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  it("exports a function named QueryError", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("export function QueryError");
  });

  it("accepts an error prop and an optional onRetry callback", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    // The interface definition documents the public API
    expect(source).toContain("error:");
    expect(source).toContain("onRetry");
  });

  it("references errorLoadingData and retry i18n keys", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("common.errorLoadingData");
    expect(source).toContain("common.retry");
  });

  it("supports a compact display mode", () => {
    const source = fs.readFileSync(componentPath, "utf-8");
    expect(source).toContain("compact");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. i18n — error-handling keys in en.json
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — i18n en.json error-handling keys", () => {
  let en: Record<string, unknown>;

  // Load once; individual tests are lightweight assertions on the object.
  it("en.json is valid JSON and loads without error", () => {
    en = readLocale("en.json");
    expect(en).toBeTruthy();
  });

  const REQUIRED_ERROR_KEYS = [
    "errorLoadingData",
    "retry",
    "unexpectedError",
    "errorBoundaryTitle",
    "errorBoundaryDescription",
    "refreshPage",
  ] as const;

  for (const key of REQUIRED_ERROR_KEYS) {
    it(`common.${key} is defined and non-empty`, () => {
      // Reload each time in case the first test was skipped
      const locale = readLocale("en.json");
      const common = locale.common as Record<string, string> | undefined;
      expect(common).toBeDefined();
      expect(typeof common![key]).toBe("string");
      expect(common![key].length).toBeGreaterThan(0);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. i18n — error-handling keys in zh.json
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — i18n zh.json error-handling keys", () => {
  const REQUIRED_ERROR_KEYS = [
    "errorLoadingData",
    "retry",
    "unexpectedError",
    "errorBoundaryTitle",
    "errorBoundaryDescription",
    "refreshPage",
  ] as const;

  it("zh.json is valid JSON and loads without error", () => {
    const zh = readLocale("zh.json");
    expect(zh).toBeTruthy();
  });

  for (const key of REQUIRED_ERROR_KEYS) {
    it(`common.${key} is defined and non-empty`, () => {
      const locale = readLocale("zh.json");
      const common = locale.common as Record<string, string> | undefined;
      expect(common).toBeDefined();
      expect(typeof common![key]).toBe("string");
      expect(common![key].length).toBeGreaterThan(0);
    });
  }

  it("zh.json error keys have distinct values from en.json (i.e. they are translated)", () => {
    const en = readLocale("en.json");
    const zh = readLocale("zh.json");
    const enCommon = en.common as Record<string, string>;
    const zhCommon = zh.common as Record<string, string>;

    // At least some keys must differ, confirming translation was applied
    const translatedCount = REQUIRED_ERROR_KEYS.filter(
      (k) => enCommon[k] !== zhCommon[k],
    ).length;
    expect(translatedCount).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. i18n — Phase 6 sidebar navigation keys present in both locales
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — i18n sidebar has Phase 6 navigation keys", () => {
  // These three keys were introduced in Phase 6 to support the new sidebar routes.
  const PHASE6_SIDEBAR_KEYS = ["notifications", "performance", "teamCollab"] as const;

  for (const locale of ["en.json", "zh.json"] as const) {
    describe(`${locale}`, () => {
      for (const key of PHASE6_SIDEBAR_KEYS) {
        it(`sidebar.${key} is defined and non-empty`, () => {
          const data = readLocale(locale);
          const sidebar = data.sidebar as Record<string, string> | undefined;
          expect(sidebar).toBeDefined();
          expect(typeof sidebar![key]).toBe("string");
          expect(sidebar![key].length).toBeGreaterThan(0);
        });
      }
    });
  }

  it("sidebar.notifications differs between en and zh (confirms translation)", () => {
    const en = readLocale("en.json");
    const zh = readLocale("zh.json");
    const enSidebar = en.sidebar as Record<string, string>;
    const zhSidebar = zh.sidebar as Record<string, string>;
    expect(enSidebar["notifications"]).not.toBe(zhSidebar["notifications"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Theme — index.css defines dark mode CSS custom properties
// ─────────────────────────────────────────────────────────────────────────────

describe("Phase 7 — index.css dark mode CSS variables", () => {
  const CSS_PATH = path.join(SRC, "index.css");
  let css: string;

  it("index.css exists", () => {
    expect(fs.existsSync(CSS_PATH)).toBe(true);
    css = fs.readFileSync(CSS_PATH, "utf-8");
  });

  it("contains a .dark selector block", () => {
    const source = fs.readFileSync(CSS_PATH, "utf-8");
    expect(source).toMatch(/\.dark\s*\{/);
  });

  // Core semantic tokens that must be present in dark mode
  const DARK_MODE_VARS = [
    "--background",
    "--foreground",
    "--card",
    "--primary",
    "--secondary",
    "--muted",
    "--accent",
    "--destructive",
    "--border",
    "--sidebar",
    "--sidebar-foreground",
  ] as const;

  for (const cssVar of DARK_MODE_VARS) {
    it(`dark mode defines ${cssVar}`, () => {
      const source = fs.readFileSync(CSS_PATH, "utf-8");

      // Locate the .dark block by finding the text after it, then check
      // that the variable appears within it.  A simple approach: verify
      // the variable is present inside the file AND the .dark block exists —
      // the CSS structure test above already ensures .dark { ... } is present.
      const darkBlockMatch = source.match(/\.dark\s*\{([^}]+)\}/s);
      expect(darkBlockMatch).not.toBeNull();

      const darkBlock = darkBlockMatch![1]!;
      expect(darkBlock).toContain(cssVar);
    });
  }

  it("light mode :root block also defines --background and --foreground", () => {
    const source = fs.readFileSync(CSS_PATH, "utf-8");
    const rootBlockMatch = source.match(/:root\s*\{([^}]+)\}/s);
    expect(rootBlockMatch).not.toBeNull();
    const rootBlock = rootBlockMatch![1]!;
    expect(rootBlock).toContain("--background");
    expect(rootBlock).toContain("--foreground");
  });

  it("dark mode background differs from light mode background (confirms dark theme override)", () => {
    const source = fs.readFileSync(CSS_PATH, "utf-8");

    const rootMatch = source.match(/:root\s*\{([^}]+)\}/s);
    const darkMatch = source.match(/\.dark\s*\{([^}]+)\}/s);
    expect(rootMatch).not.toBeNull();
    expect(darkMatch).not.toBeNull();

    // Extract --background values from each block
    const extractVar = (block: string, varName: string): string | null => {
      const re = new RegExp(`${varName}\\s*:\\s*([^;]+);`);
      const m = block.match(re);
      return m ? m[1]!.trim() : null;
    };

    const lightBg = extractVar(rootMatch![1]!, "--background");
    const darkBg = extractVar(darkMatch![1]!, "--background");

    expect(lightBg).not.toBeNull();
    expect(darkBg).not.toBeNull();
    expect(lightBg).not.toBe(darkBg);
  });
});
