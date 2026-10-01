import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("connexion : SSO Microsoft, Google et SAML proposés", async ({ page }) => {
  await page.goto("/auth");
  await expect(page.getByTestId("sso-microsoft")).toHaveText("Se connecter avec Microsoft");
  await expect(page.getByRole("button", { name: "Continuer avec Google" })).toBeVisible();
  await expect(page.getByLabel("Domaine SSO")).toBeVisible();
});

test("mode démo étiqueté, journal d'audit filtrable et exportable", async ({ page }) => {
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await expect(page.getByTestId("demo-mode")).toBeVisible({ timeout: 30_000 });
  // Une action tracée : import de l'exemple, puis un réglage modifié.
  await expect(async () => { await page.getByTestId("ij-demo").click(); await expect(page.locator(".ij-check")).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.locator(".ij-policy summary").first().click();
  await page.getByLabel("Requêtes / min").first().fill("20");
  await page.goto("/cockpit/utilisateurs", { waitUntil: "load" });
  await expect(page.getByRole("tab", { name: "Utilisateurs et rôles" })).toBeVisible();
  await expect(page.getByText("Lecteur", { exact: true })).toBeVisible();
  const table = page.getByTestId("audit-table");
  await expect(async () => { await page.getByRole("tab", { name: "Journal d'audit" }).click(); await expect(table).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 30_000 });
  await expect(table).toContainText("sources.enregistrement", { timeout: 20_000 });
  await expect(table).toContainText("sources.modification");
  await page.getByLabel("Action").selectOption("sources");
  await expect(table).not.toContainText("connexion");
  const dl = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter en CSV" }).click();
  expect((await dl).suggestedFilename()).toMatch(/^journal-audit-\d{4}-\d\d-\d\d\.csv$/);
});
