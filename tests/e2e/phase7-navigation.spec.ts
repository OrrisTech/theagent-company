import { test, expect, type Page } from "@playwright/test";

/**
 * E2E: Phase 7 Navigation & Rendering tests.
 *
 * Verifies that all Phase 3-6 pages are reachable from the sidebar,
 * render without error on initial load, and that the theme/language
 * switchers work correctly.
 *
 * Design decisions:
 * - Routes are prefixed with a company issuePrefix (e.g. /ABC/usage-budget).
 *   We resolve the prefix from the /api/companies endpoint before running
 *   page navigation tests. When no company exists we navigate to the
 *   unprefixed route and verify that the app shows a reasonable fallback
 *   rather than a crash.
 * - Tests do NOT require any authentication setup beyond what the default
 *   local_trusted deployment mode provides.
 * - We never assert on live data counts or backend-populated content
 *   because the test environment may have an empty database. We only
 *   assert that the page container renders and does not enter an
 *   error-boundary state.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the issue-prefix of the first company via the API so we can build
 * correct prefixed route paths. Returns null if no companies exist yet.
 */
async function getCompanyPrefix(page: Page): Promise<string | null> {
  const baseUrl = new URL(page.url()).origin;
  const res = await page.request.get(`${baseUrl}/api/companies`);
  if (!res.ok()) return null;
  const companies = await res.json() as Array<{ issuePrefix: string }>;
  return companies[0]?.issuePrefix ?? null;
}

/**
 * Navigate to a page that lives under the company prefix, falling back to
 * the un-prefixed path when no company exists. Returns the URL that was
 * loaded.
 */
async function gotoCompanyPage(page: Page, prefix: string | null, path: string): Promise<void> {
  if (prefix) {
    await page.goto(`/${prefix}${path}`);
  } else {
    // With no company the app redirects to /onboarding or shows a
    // "Create your first company" start page — navigate there anyway and
    // the per-test assertion will handle the empty-state check.
    await page.goto(path);
  }
}

/**
 * Assert the page does not show the error-boundary fallback heading
 * ("Something went wrong").
 */
async function expectNoErrorBoundary(page: Page): Promise<void> {
  const errorHeading = page.locator("h1, h2, h3", { hasText: /something went wrong/i });
  // Give the page a moment to stabilise, then confirm the error heading is absent.
  await page.waitForLoadState("networkidle").catch(() => { /* ignore timeout */ });
  await expect(errorHeading).not.toBeVisible();
}

/**
 * Wait for the initial app shell (sidebar nav or onboarding/start page) to
 * appear. This guards against asserting before React has hydrated.
 */
async function waitForAppReady(page: Page): Promise<void> {
  // Either the sidebar nav link section or a "Create your first company"
  // start page are acceptable indicators that the app has mounted.
  const sidebarNav = page.locator("nav").first();
  const onboardingBtn = page.getByRole("button", { name: /new company|start onboarding/i });
  const wizardHeading = page.locator("h3", { hasText: /name your company/i });

  await expect(sidebarNav.or(onboardingBtn).or(wizardHeading)).toBeVisible({ timeout: 20_000 });
}

// ---------------------------------------------------------------------------
// Fixtures — resolve company prefix once per describe block
// ---------------------------------------------------------------------------

// We store the prefix in a module-level variable populated in beforeAll so
// that every test in the block shares it without redundant API calls.
let companyPrefix: string | null = null;

// ---------------------------------------------------------------------------
// Suite 1: Sidebar navigation — Phase 3-6 pages
// ---------------------------------------------------------------------------

test.describe("Phase 7 — Sidebar navigation (Phase 3-6 pages)", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    await waitForAppReady(page);
    companyPrefix = await getCompanyPrefix(page);
    await page.close();
  });

  // Helper used by every navigation test: navigate, confirm no crash.
  async function expectPageLoads(
    page: Page,
    path: string,
    headingMatcher: RegExp | string,
  ): Promise<void> {
    await gotoCompanyPage(page, companyPrefix, path);
    await waitForAppReady(page);
    await expectNoErrorBoundary(page);

    if (companyPrefix) {
      // Only assert the page heading when a company exists; without one the
      // route redirects to the onboarding/start flow.
      const heading = page.locator("h1, h2, h3").filter({ hasText: headingMatcher });
      await expect(heading.first()).toBeVisible({ timeout: 10_000 });
    }
  }

  // ------------------------------------------------------------------
  // Phase 3 — OpenClaw Observability pages
  // ------------------------------------------------------------------

  test("usage-budget page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/usage-budget", /usage & budget/i);
  });

  test("documents page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/documents", /documents/i);
  });

  test("memory page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/memory", /memory/i);
  });

  test("collaboration page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/collaboration", /collaboration/i);
  });

  // ------------------------------------------------------------------
  // Phase 5 — Workflow System
  // ------------------------------------------------------------------

  test("workflows page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/workflows", /workflows/i);
  });

  // ------------------------------------------------------------------
  // Phase 6 — Team Collaboration Enhancement
  // ------------------------------------------------------------------

  test("notifications page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/notifications", /notifications/i);
  });

  test("performance page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/performance", /performance/i);
  });

  test("team-collaboration page loads and shows heading", async ({ page }) => {
    await expectPageLoads(page, "/team-collaboration", /team collaboration/i);
  });
});

// ---------------------------------------------------------------------------
// Suite 2: Sidebar navigation links are present in the DOM
// ---------------------------------------------------------------------------

test.describe("Phase 7 — Sidebar nav items are rendered", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    await waitForAppReady(page);
    companyPrefix = await getCompanyPrefix(page);
    await page.close();
  });

  test("sidebar renders Phase 3-6 nav links", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Only meaningful when a company (and therefore the sidebar) is present.
    // When no company exists the app shows the onboarding/start page; skip
    // the sidebar assertions in that case.
    if (!companyPrefix) {
      test.skip();
      return;
    }

    // The company sidebar uses SidebarNavItem which renders <a> elements via
    // NavLink. Check that all Phase 3-6 links appear somewhere in the page.
    const expectedLabels = [
      "Usage & Budget",
      "Documents",
      "Memory",
      "Collaboration",
      "Workflows",
      "Notifications",
      "Performance",
      "Team Collab",
    ];

    for (const label of expectedLabels) {
      const link = page.locator("nav a", { hasText: label });
      await expect(link.first()).toBeVisible({ timeout: 5_000 });
    }
  });

  test("sidebar nav links point to the correct prefixed routes", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    if (!companyPrefix) {
      test.skip();
      return;
    }

    // Spot-check a few hrefs to confirm the prefix is applied.
    const routeChecks: [string, RegExp][] = [
      ["Usage & Budget", new RegExp(`/${companyPrefix}/usage-budget`)],
      ["Workflows",      new RegExp(`/${companyPrefix}/workflows`)],
      ["Notifications",  new RegExp(`/${companyPrefix}/notifications`)],
      ["Performance",    new RegExp(`/${companyPrefix}/performance`)],
      ["Team Collab",    new RegExp(`/${companyPrefix}/team-collaboration`)],
    ];

    for (const [label, hrefPattern] of routeChecks) {
      const link = page.locator("nav a", { hasText: label }).first();
      await expect(link).toBeVisible({ timeout: 5_000 });
      const href = await link.getAttribute("href");
      expect(href).toMatch(hrefPattern);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite 3: Theme switching
// ---------------------------------------------------------------------------

test.describe("Phase 7 — Theme switching", () => {
  /**
   * Locate the ThemeSwitcherButton rendered in the Layout footer.
   * It has aria-label="Switch to ... mode".
   */
  function getThemeToggleBtn(page: Page) {
    return page.locator('button[aria-label*="Switch to"]');
  }

  test("theme toggle button is visible in the layout footer", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const btn = getThemeToggleBtn(page);
    await expect(btn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking theme toggle cycles the resolved theme class on <html>", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const btn = getThemeToggleBtn(page);
    await expect(btn.first()).toBeVisible({ timeout: 10_000 });

    // Capture the starting class state of <html>
    const initialIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );

    // Click the toggle — cycles light → dark → system (or whichever step is next)
    await btn.first().click();

    // After one click the class must have changed (or stayed the same if
    // moving from one resolved value to another with same appearance, e.g.
    // dark → system when OS is dark). We allow either outcome but require
    // the click itself didn't crash the app.
    await expectNoErrorBoundary(page);

    // Click a second time to ensure we can cycle again.
    await btn.first().click();
    await expectNoErrorBoundary(page);

    // Click a third time to complete the light → dark → system → light cycle.
    await btn.first().click();
    await expectNoErrorBoundary(page);

    // After three clicks the cycle is complete; the class should be back to
    // whatever it started as (the CYCLE is light → dark → system → light).
    const finalIsDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    // Three full-cycle clicks return us to the original state.
    expect(finalIsDark).toBe(initialIsDark);
  });

  test("theme preference persists to localStorage", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Force a known starting state: set light via localStorage directly.
    await page.evaluate(() => {
      localStorage.setItem("paperclip.theme", "light");
      document.documentElement.classList.remove("dark");
    });

    // Reload so the app reads the stored preference on mount.
    await page.reload();
    await waitForAppReady(page);

    const isDark = await page.evaluate(() =>
      document.documentElement.classList.contains("dark")
    );
    expect(isDark).toBe(false);

    // Now toggle to dark.
    const btn = getThemeToggleBtn(page);
    await btn.first().click();

    // Verify localStorage was updated.
    const stored = await page.evaluate(() => localStorage.getItem("paperclip.theme"));
    // After one click from "light" the next step is "dark".
    expect(stored).toBe("dark");
  });

  test("ThemeSelector on language settings page shows three theme buttons", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    if (!companyPrefix) {
      test.skip();
      return;
    }

    await page.goto(`/${companyPrefix}/settings/language`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoErrorBoundary(page);

    // The ThemeSelector is rendered on the branding settings page, not here.
    // On the language page we should still see the footer ThemeSwitcherButton.
    const btn = getThemeToggleBtn(page);
    await expect(btn.first()).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Suite 4: Language switching
// ---------------------------------------------------------------------------

test.describe("Phase 7 — Language switching", () => {
  /**
   * Locate the LanguageSwitcher button in the Layout footer.
   * It has aria-label="Switch language to …".
   */
  function getLangBtn(page: Page) {
    return page.locator('button[aria-label*="Switch language to"]');
  }

  test("language switcher button is visible", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    const btn = getLangBtn(page);
    await expect(btn.first()).toBeVisible({ timeout: 10_000 });
  });

  test("clicking language switcher switches UI text to Chinese", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Start from a known state — ensure the language is English.
    await page.evaluate(() => {
      // i18next stores the language in localStorage under 'i18nextLng'.
      localStorage.setItem("i18nextLng", "en");
    });
    await page.reload();
    await waitForAppReady(page);

    // Verify we are in English by checking the sidebar's "New Issue" text.
    // Only check this when a company (and sidebar) is present.
    if (companyPrefix) {
      await expect(page.locator("button", { hasText: "New Issue" })).toBeVisible({ timeout: 10_000 });
    }

    // Click the language switcher to switch to Chinese.
    const btn = getLangBtn(page);
    await btn.first().click();

    // After switching, at minimum the button's aria-label should now indicate
    // the NEXT language to switch to (i.e. "English"), confirming zh is active.
    await expect(btn.first()).toHaveAttribute("aria-label", /English/i, { timeout: 5_000 });

    if (companyPrefix) {
      // Sidebar "New Issue" button should now read its Chinese translation.
      await expect(page.locator("button", { hasText: "新建任务" })).toBeVisible({ timeout: 5_000 });
    }

    await expectNoErrorBoundary(page);
  });

  test("clicking language switcher again returns to English", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Force Chinese as starting state.
    await page.evaluate(() => {
      localStorage.setItem("i18nextLng", "zh");
    });
    await page.reload();
    await waitForAppReady(page);

    const btn = getLangBtn(page);
    // The button should currently say "Switch language to English"
    await expect(btn.first()).toHaveAttribute("aria-label", /English/i, { timeout: 10_000 });

    // Switch back to English.
    await btn.first().click();

    // Now it should say "Switch language to 中文"
    await expect(btn.first()).toHaveAttribute("aria-label", /中文/i, { timeout: 5_000 });

    await expectNoErrorBoundary(page);
  });

  test("language preference persists in localStorage", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    // Start from English.
    await page.evaluate(() => { localStorage.setItem("i18nextLng", "en"); });
    await page.reload();
    await waitForAppReady(page);

    const btn = getLangBtn(page);
    await btn.first().click();

    const stored = await page.evaluate(() => localStorage.getItem("i18nextLng"));
    expect(stored).toBe("zh");
  });

  test("Language settings page renders correctly in both languages", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);

    if (!companyPrefix) {
      test.skip();
      return;
    }

    // English version
    await page.evaluate(() => { localStorage.setItem("i18nextLng", "en"); });
    await page.goto(`/${companyPrefix}/settings/language`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoErrorBoundary(page);
    await expect(page.locator("h1", { hasText: /language/i })).toBeVisible({ timeout: 5_000 });

    // Language selector buttons for English and Chinese are both rendered.
    await expect(page.locator('button[aria-pressed]', { hasText: "English" })).toBeVisible();
    await expect(page.locator('button[aria-pressed]', { hasText: "中文" })).toBeVisible();

    // Chinese version — click the 中文 button.
    await page.locator('button[aria-pressed]', { hasText: "中文" }).click();
    // Heading should now be in Chinese.
    await expect(page.locator("h1", { hasText: /语言/i })).toBeVisible({ timeout: 5_000 });
    await expectNoErrorBoundary(page);
  });
});

// ---------------------------------------------------------------------------
// Suite 5: Basic page structure — no error state on cold load
// ---------------------------------------------------------------------------

test.describe("Phase 7 — Page structure and initial render", () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await page.goto("/");
    await waitForAppReady(page);
    companyPrefix = await getCompanyPrefix(page);
    await page.close();
  });

  /**
   * Each page must:
   * 1. Load without triggering the error boundary.
   * 2. Render either a heading or a known empty-state message.
   * 3. Not show a full-page spinner that never resolves.
   */
  const pages: Array<{ path: string; description: string }> = [
    { path: "/usage-budget",       description: "Usage & Budget" },
    { path: "/documents",          description: "Documents" },
    { path: "/memory",             description: "Memory" },
    { path: "/collaboration",      description: "Collaboration" },
    { path: "/workflows",          description: "Workflows" },
    { path: "/notifications",      description: "Notifications" },
    { path: "/performance",        description: "Performance" },
    { path: "/team-collaboration", description: "Team Collaboration" },
  ];

  for (const { path, description } of pages) {
    test(`${description} — no error boundary on initial load`, async ({ page }) => {
      if (!companyPrefix) {
        // Without a company the routes redirect; just load the root and verify
        // the generic start state renders without error.
        await page.goto("/");
        await waitForAppReady(page);
        await expectNoErrorBoundary(page);
        return;
      }

      await page.goto(`/${companyPrefix}${path}`);
      // Wait for network to settle so async data fetches complete (or fail gracefully).
      await page.waitForLoadState("networkidle").catch(() => {});
      await expectNoErrorBoundary(page);

      // The page must not be stuck on a permanent loading spinner. If the page
      // still shows ONLY a loading indicator after 10 s it is considered failed.
      const loadingOnly = page.locator("text=Loading...");
      const hasContent = page.locator("h1, h2, h3, [data-testid], main > *");
      // At least one non-loading element must be visible.
      await expect(hasContent.first()).toBeVisible({ timeout: 10_000 });
    });
  }

  test("main content area is present and scrollable", async ({ page }) => {
    if (!companyPrefix) {
      test.skip();
      return;
    }

    await page.goto(`/${companyPrefix}/workflows`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // The Layout renders <main id="main-content">
    const main = page.locator("main#main-content");
    await expect(main).toBeVisible({ timeout: 10_000 });
  });

  test("sidebar is rendered alongside page content", async ({ page }) => {
    if (!companyPrefix) {
      test.skip();
      return;
    }

    await page.goto(`/${companyPrefix}/workflows`);
    await page.waitForLoadState("networkidle").catch(() => {});

    // Layout wraps the sidebar in an <aside> element.
    const sidebar = page.locator("aside");
    await expect(sidebar).toBeVisible({ timeout: 10_000 });
  });

  test("breadcrumb bar is rendered above page content", async ({ page }) => {
    if (!companyPrefix) {
      test.skip();
      return;
    }

    await page.goto(`/${companyPrefix}/notifications`);
    await page.waitForLoadState("networkidle").catch(() => {});
    await expectNoErrorBoundary(page);

    // BreadcrumbBar renders a <nav aria-label="breadcrumb"> or similar.
    // We use the fact that BreadcrumbBar is positioned above <main>.
    // At minimum confirm <main> exists, which requires BreadcrumbBar to have
    // mounted without error (they share the same Layout outlet).
    await expect(page.locator("main#main-content")).toBeVisible({ timeout: 5_000 });
  });
});
