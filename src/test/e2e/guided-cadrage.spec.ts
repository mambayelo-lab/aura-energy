import { test, expect } from "@playwright/test";

test.describe("Cadrage guidé", () => {
  test("Décider : l'étape Comprendre le parcours reste dans Décider", async ({ page }) => {
    await page.goto("/cockpit/atelier", { waitUntil: "commit" });
    await page.evaluate(() => localStorage.setItem("aura-decider-mode", "detail"));
    await page.goto("/cockpit/atelier");
    await expect(page.getByText(/Comprendre/).first()).toBeVisible();
    await expect(page.getByText(/Impacter|Explorer/).first()).toBeVisible(); // étapes actuelles : Comprendre, Impacter, Explorer, Suivre
    await expect(page.getByText(/Architecturer/)).toHaveCount(0);
  });
});
