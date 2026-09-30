import { expect, test, type Page } from "@playwright/test";

/**
 * Regenerates the README screenshots. Opt-in (needs a seeded database):
 *   SCREENSHOTS=1 npx playwright test screenshots
 */
test.skip(!process.env.SCREENSHOTS, "set SCREENSHOTS=1 to regenerate README screenshots");

const OUT = "docs/screenshots";

async function demoLogin(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
}

async function useLeague(page: Page, name: RegExp) {
  await page
    .getByRole("button", { name: /League|Practice|Club/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name }).click();
  await page.waitForLoadState("networkidle");
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800); // let entrance animations finish
}

test.describe("desktop", () => {
  test.use({ viewport: { width: 1360, height: 900 }, deviceScaleFactor: 2 });

  test("screens", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await page.screenshot({ path: `${OUT}/landing.png` });

    await demoLogin(page);
    await useLeague(page, /Paper Hands Club/);
    await settle(page);
    await page.screenshot({ path: `${OUT}/dashboard.png` });

    await page.goto("/stocks/NVDA");
    await settle(page);
    await page.screenshot({ path: `${OUT}/stock.png` });

    await page.getByRole("button", { name: "Review buy" }).click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/confirm.png` });
    await page.keyboard.press("Escape");

    await page.goto("/portfolio");
    await settle(page);
    await page.screenshot({ path: `${OUT}/portfolio.png` });

    await page.getByRole("link", { name: "Leagues", exact: true }).first().click();
    await page.getByRole("link", { name: /Paper Hands Club/ }).click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/league.png` });
  });
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  test("screens", async ({ page }) => {
    await demoLogin(page);
    await useLeague(page, /Paper Hands Club/);
    await page.goto("/stocks/TSLA");
    await settle(page);
    await page.screenshot({ path: `${OUT}/mobile-stock.png` });

    await page.getByRole("link", { name: "Leagues" }).last().click();
    await page.getByRole("link", { name: /Paper Hands Club/ }).click();
    await settle(page);
    await page.screenshot({ path: `${OUT}/mobile-league.png` });
  });
});
