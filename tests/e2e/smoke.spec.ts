import { expect, test } from "@playwright/test";

/**
 * Smoke test of the core loop: demo login → buy a stock → see it in the
 * portfolio. Uses the 24/7 Practice league so it passes outside US market hours.
 */
test("demo user can buy a stock and see it in their portfolio", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Switch to the always-open simulated league.
  await page
    .getByRole("button", { name: /League|Practice|Club/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /24\/7 Practice/ }).click();
  await expect(page.getByRole("button", { name: /24\/7 Practice/ })).toBeVisible();

  await page.goto("/stocks/KO");
  await expect(page.getByRole("heading", { name: "Coca-Cola Co." })).toBeVisible();

  const ticket = page.locator("div.surface", { has: page.getByRole("heading", { name: "Trade KO" }) });
  await ticket.getByRole("tab", { name: "Buy" }).click();
  await ticket.getByLabel("Shares").fill("1");
  await ticket.getByRole("button", { name: "Review buy" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Buy 1 KO")).toBeVisible();
  await expect(dialog.getByText("Flat fee")).toBeVisible();

  // Press and hold to confirm.
  const hold = dialog.getByRole("button", { name: /Hold to buy/ });
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();

  await expect(page.getByText(/Bought 1 KO at \$/)).toBeVisible();

  await page.goto("/portfolio");
  await expect(page.getByRole("link", { name: /KO/ }).first()).toBeVisible();
  await expect(page.getByText(/Bought 1\s+KO/).first()).toBeVisible();
});

test("any US-listed stock can be found with ⌘K search and bought", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page
    .getByRole("button", { name: /League|Practice|Club/ })
    .first()
    .click();
  await page.getByRole("menuitem", { name: /24\/7 Practice/ }).click();
  await expect(page.getByRole("button", { name: /24\/7 Practice/ })).toBeVisible();

  // HOOD isn't in the curated popular list: it comes from the full universe.
  await page.getByRole("button", { name: "Search stocks" }).click();
  await page.getByRole("combobox").fill("robinhood");
  await page.getByRole("option", { name: /HOOD/ }).click();
  await expect(page).toHaveURL(/\/stocks\/HOOD/);

  const ticket = page.locator("div.surface", { has: page.getByRole("heading", { name: "Trade HOOD" }) });
  await ticket.getByLabel("Shares").fill("1");
  await ticket.getByRole("button", { name: "Review buy" }).click();
  const hold = page.getByRole("dialog").getByRole("button", { name: /Hold to buy/ });
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();
  await expect(page.getByText(/Bought 1 HOOD at \$/)).toBeVisible();
});

test("the Profile tab opens the signed-in user's profile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Try the demo" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/u\/demo$/);
  await expect(page.getByRole("heading", { name: "@demo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the Profile tab in the bottom bar works", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try the demo" }).first().click();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { name: "@demo" })).toBeVisible();
  });
});
