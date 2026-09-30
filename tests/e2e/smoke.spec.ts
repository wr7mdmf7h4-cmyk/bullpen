import { expect, test } from "@playwright/test";
import { holdToConfirm, marketIsOpen, testUsername } from "./helpers";

/**
 * Smoke tests of the core loops, as one player signed up by auth.setup.ts.
 * Orders only fill while the US market is open, so the trading tests skip
 * outside market hours.
 */

test("a new player can buy a stock and see it in their portfolio", async ({ page }) => {
  test.skip(!marketIsOpen(), "US market is closed");
  await page.goto("/stocks/KO");
  await expect(page.getByRole("heading", { name: "Coca-Cola Co." })).toBeVisible();
  const ticket = page.locator("div.surface", { has: page.getByRole("heading", { name: "Trade KO" }) });
  await ticket.getByLabel("Shares").fill("1");
  await ticket.getByRole("button", { name: "Review buy" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Buy 1 KO")).toBeVisible();
  await expect(dialog.getByText("Flat fee")).toBeVisible();
  await holdToConfirm(page, /Hold to buy/);
  await expect(page.getByText(/Bought 1 KO at \$/)).toBeVisible();

  await page.goto("/portfolio");
  await expect(page.getByRole("link", { name: /KO/ }).first()).toBeVisible();
  await expect(page.getByText(/Bought \d+\s+KO/).first()).toBeVisible();
});

test("any US-listed stock can be found with ⌘K search (typos included) and bought", async ({ page }) => {
  test.skip(!marketIsOpen(), "US market is closed");
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Search stocks" }).click();
  await page.getByRole("combobox").fill("robinhod");
  await page.getByRole("option", { name: /HOOD/ }).click();
  await expect(page).toHaveURL(/\/stocks\/HOOD/);
  const ticket = page.locator("div.surface", { has: page.getByRole("heading", { name: "Trade HOOD" }) });
  await ticket.getByLabel("Shares").fill("1");
  await ticket.getByRole("button", { name: "Review buy" }).click();
  await holdToConfirm(page, /Hold to buy/);
  await expect(page.getByText(/Bought 1 HOOD at \$/)).toBeVisible();
});

test("the Profile menu opens your profile", async ({ page }) => {
  const username = testUsername();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Profile" }).click();
  await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Achievements" })).toBeVisible();
});

test("a player can create a league and leave it", async ({ page }) => {
  await page.goto("/leagues");
  await page.getByRole("button", { name: "Create league" }).click();
  await page.getByLabel("Name").fill("E2E Leavers");
  await page.getByRole("dialog").getByRole("button", { name: "Create league" }).click();
  await expect(page.getByRole("heading", { name: "E2E Leavers" })).toBeVisible();

  await page.getByRole("button", { name: "Leave league" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Leave league" }).click();
  await expect(page).toHaveURL(/\/leagues\?left=1/);
  await expect(page.getByText("You left the league.")).toBeVisible();
  await expect(page.getByRole("link", { name: /E2E Leavers/ })).toHaveCount(0);
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test("the Profile tab in the bottom bar works", async ({ page }) => {
    const username = testUsername();
    await page.goto("/dashboard");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Profile" }).click();
    await expect(page.getByRole("heading", { name: `@${username}` })).toBeVisible();
  });
});
