import { test, expect } from "@playwright/test";

test("cockpit énergie : 23 alertes causales lues dans Héliade et ouverture de Décider", async ({ page }) => {
  await page.goto("/cockpit/energie");
  await expect(page.getByRole("heading", { name: "Cockpit énergie" })).toBeVisible();
  await expect(page.getByTestId("energy-source")).toContainText("Héliade Énergies");
  await expect(page.getByTestId("energy-alert")).toHaveCount(23);
  await expect(page.locator("body")).not.toContainText(/Bora|Sugeno|Choquet/);
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByTestId("energy-decide").first().click();
    await expect(page).toHaveURL(/\/cockpit\/atelier/, { timeout: 2000 });
  }).toPass({ timeout: 20_000 });
});
