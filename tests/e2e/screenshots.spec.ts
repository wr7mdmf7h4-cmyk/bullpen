import { expect, test } from "@playwright/test";

/**
 * Regenerates the README screenshots against a running instance. Opt-in:
 *   SCREENSHOTS=1 npx playwright test screenshots
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate README screenshots");

const OUT = "docs/screenshots";

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });

  test("screens", async ({ page, browser }) => {
    // landing page as a logged-out visitor
    const anon = await browser.newPage({
      storageState: { cookies: [], origins: [] },
      viewport: { width: 1360, height: 900 },
      deviceScaleFactor: 2,
    });
    await anon.goto("/");
    await settle(anon);
    await anon.screenshot({ path: `${OUT}/landing.png` });
    await anon.close();

    await page.goto("/dashboard");
    await settle(page);
    await page.screenshot({ path: `${OUT}/dashboard.png` });

    await page.goto("/markets");
    await settle(page);
    await page.screenshot({ path: `${OUT}/markets.png` });

    await page.goto("/stocks/NVDA");
    await settle(page);
    await page.screenshot({ path: `${OUT}/stock.png` });

    await page.goto("/leagues/global");
    await expect(page.getByRole("heading", { name: "Global League" })).toBeVisible();
    await settle(page);
    await page.screenshot({ path: `${OUT}/league.png` });
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test("screens", async ({ page }) => {
    await page.goto("/stocks/TSLA");
    await settle(page);
    await page.screenshot({ path: `${OUT}/mobile-stock.png` });
  });
});
