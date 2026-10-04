import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const out = "artifacts";

test.beforeAll(async () => {
  await mkdir(out, { recursive: true });
});

async function settle(page: import("@playwright/test").Page) {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1200);
}

test("capture SCRA cockpit réel", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: `${out}/scra-cockpit.png`, fullPage: true });
  await expect(page.locator("body")).not.toContainText("Cette page ne s'est pas chargée correctement");
  await expect(page.locator("body")).toContainText(/Supply Chain (?:Control|Resilience) Agent|Cockpit/i);
});

test("capture Studio SCRA réel", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "domcontentloaded" });
  await settle(page);
  await page.screenshot({ path: `${out}/scra-studio.png`, fullPage: true });
  await expect(page.locator("body")).not.toContainText("Cette page ne s'est pas chargée correctement");
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
});

test("Studio reste ancré dans SCRA et utilise Maison Lucie uniquement", async ({ page }) => {
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "domcontentloaded" });
  await settle(page);

  await expect(page.getByRole("link", { name: "Aura Supply Chain" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cockpit", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Décider" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();

  await expect(page.getByText("0 source(s) connectée(s)")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Boutique flagship");
  await expect(page.locator("body")).not.toContainText("Direction merchandising");
  await expect(page.locator("body")).not.toContainText("DEMO-NOT-A-SECRET");
});

test("le cockpit vide ne fabrique aucune donnée Maison Lucie", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "domcontentloaded" });
  await settle(page);

  await expect(page.getByText("Hors ligne", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("Maison Lucie · Live");
  await expect(page.locator("body")).not.toContainText("Exemple illustratif");
});

test("une source fichier découvre ses métadonnées et son échantillon", async ({ page }) => {
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "domcontentloaded" });
  await settle(page);

  // Vue avancée : le formulaire s'ouvre depuis la carte « Fichier CSV ou JSON » du catalogue.
  const form = page.getByTestId("credentials-form");
  await expect(async () => { await page.locator("article", { hasText: "Fichier CSV ou JSON" }).getByRole("button", { name: /^(Connecter|Importer un CSV)$/ }).first().click(); await expect(form).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 30_000 });
  await form.getByLabel("Nom").fill("Fixture Supply");
  await form.getByLabel("URL").fill(
    'data:application/json,%5B%7B%22productId%22%3A%22P-001%22%2C%22stock%22%3A42%2C%22supplier%22%3A%22SUP-01%22%7D%5D',
  );
  await form.getByRole("button", { name: "Connecter et lire les données" }).click();

  await expect(page.getByRole("heading", { name: "Observer ce que le SI expose réellement" })).toBeVisible();
  await expect(page.getByText("productId", { exact: true })).toBeVisible();
  await expect(page.getByText("P-001", { exact: true })).toBeVisible();
  await expect(page.getByText("stock", { exact: true })).toBeVisible();
});
