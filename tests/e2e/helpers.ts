import { readFileSync } from "node:fs";
import { expect, type Page } from "@playwright/test";
import { isMarketOpen } from "@/domain/market/hours";

/** Signs up a brand-new player and lands on the dashboard. */
export async function signUp(page: Page) {
  const id = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  await page.goto("/signup");
  await page.getByLabel("Email").fill(`e2e_${id}@example.test`);
  await page.getByLabel("Username").fill(`e2e_${id}`.slice(0, 20));
  await page.getByLabel("Password").fill(`e2e-password-${id}`);
  await page.getByRole("button", { name: /Create account/ }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return `e2e_${id}`.slice(0, 20);
}

/** Orders only fill during US market hours (real prices only). */
export const marketIsOpen = () => isMarketOpen(new Date());

export async function holdToConfirm(page: Page, name: RegExp) {
  const hold = page.getByRole("dialog").getByRole("button", { name });
  const box = (await hold.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_300);
  await page.mouse.up();
}

/** Username of the player signed up by auth.setup.ts. */
export function testUsername(): string {
  return (JSON.parse(readFileSync("playwright/.auth/user.meta.json", "utf8")) as { username: string }).username;
}
