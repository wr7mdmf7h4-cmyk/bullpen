import { test as setup } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { signUp } from "./helpers";

/** Signs up one throwaway player per test run and shares the session. */
setup("sign up a test player", async ({ page }) => {
  const username = await signUp(page);
  mkdirSync("playwright/.auth", { recursive: true });
  await page.context().storageState({ path: "playwright/.auth/user.json" });
  writeFileSync("playwright/.auth/user.meta.json", JSON.stringify({ username }));
});
