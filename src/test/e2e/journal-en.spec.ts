import { test, expect } from "@playwright/test";

// Le journal des décisions de Supply s'affiche en anglais : décision prise depuis une alerte, puis lecture au cockpit.
test.use({ viewport: { width: 1440, height: 900 } });

test("Supply EN : journal des décisions visible et traduit", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/home", { waitUntil: "commit" });
  await page.evaluate(() => { localStorage.setItem("aura.lang", "en"); localStorage.setItem("aura-decider-mode", "dialogue"); });
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "commit" });
  const load = page.getByTestId("supply-demo-load").first();
  await load.waitFor({ timeout: 60_000 });
  // Le bouton est rendu côté serveur avant l'hydratation : on reclique tant que la progression n'apparaît pas.
  await expect(async () => { await load.click({ timeout: 2000 }); await expect(page.getByTestId("supply-demo-launcher").first().locator(".sd-steps")).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.getByText(/Demo loaded|Démo chargée/).waitFor({ timeout: 120_000 });
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "commit" });
  const card = page.locator(".ct-alert-card").first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Expand/ }).click();
  await page.getByRole("button", { name: /Open a decision/ }).click();
  await page.getByRole("button", { name: /Follow this decision/ }).click({ timeout: 90_000 });
  await page.goto("/cockpit/resilience?section=cockpit#journal", { waitUntil: "commit" });
  const journal = page.getByTestId("decision-journal");
  await expect(journal).toBeVisible({ timeout: 30_000 });
  await expect(journal).toContainText(/Decision log/);
  await expect(journal.locator("tbody tr")).toHaveCount(1);
  await expect(journal).not.toContainText(/Journal des décisions|Option choisie|Aujourd'hui/);
  if (process.env.SHOTS) await journal.screenshot({ path: `${process.env.SHOTS}/journal-en.png` });
});
