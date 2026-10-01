import { test, expect } from "@playwright/test";

test.describe("Entrée unique AURA", () => {
  test("la racine ouvre le cockpit et aucun lien V2 ne subsiste", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/cockpit\/home/);
    await expect(page.locator('a[href="/v2"]')).toHaveCount(0);
  });

  test("l'accueil de Décider ne renvoie pas vers Architecture", async ({ page }) => {
    await page.goto("/cockpit/home");
    await expect(page.getByText(/Décider/i).first()).toBeVisible();
    await expect(page.getByText(/Architecturer/i)).toHaveCount(0);
  });
});
