import { test, expect } from "@playwright/test";

test.describe("Parcours Aura simplifiés", () => {
  test("chaque application a sa propre navigation et un compte compact", async ({ page }) => {
    const apps: [string, string, string[]][] = [
      ["/cockpit/home", "DÉCIDER", ["Accueil", "Nouvelle décision", "Démonstrations"]],
      ["/cockpit/resilience?section=cockpit", "SUPPLY CHAIN", ["Cockpit", "Studio"]],
    ];
    for (const [route, product, links] of apps) {
      await page.goto(route);
      const rail = page.locator(".aura-nav-sidebar");
      await expect(rail).toBeVisible();
      await expect(rail.locator(".aura-brand-lockup")).toContainText(product, { ignoreCase: true });
      for (const label of links) await expect(rail.locator(".aura-nav-main").getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await page.goto("/cockpit/home");
    await page.getByText("Compte", { exact: true }).click();
    const menu = page.locator(".aura-account-menu");
    await expect(menu.getByText("Équipe & accès", { exact: true })).toBeVisible();
    await expect(menu.getByText("Abonnement", { exact: true })).toBeVisible();
  });

  test("Décider : Comprendre, Impacter, Explorer / Résultat, Suivre", async ({ page }) => {
    await page.goto("/cockpit/atelier?demo=supply-stock");
    await page.waitForURL(/sessionId=/);
    // Pas de networkidle ici : le script du Web Worker de calcul reste « en cours » pour Playwright.
    await page.waitForLoadState("load");
    const steps = page.getByRole("navigation", { name: "Étapes de la décision" });
    await expect(steps.getByRole("button")).toHaveCount(4);
    for (const label of ["Comprendre", "Impacter", "Explorer / Résultat", "Suivre"]) await expect(steps).toContainText(label);
  });

  test("Décider a ses propres démonstrations", async ({ page }) => {
    await page.goto("/cockpit/demos");
    await expect(page.getByText("Modernisation de la télérelève")).toBeVisible();
    await expect(page.getByRole("button", { name: "Visualiser" })).toHaveCount(0);
  });

  test("le site public garde une navigation courte sans supprimer la science", async ({ page }) => {
    await page.goto("/aura");
    const header = page.locator("header");
    for (const label of ["Ce que fait Aura", "Comment ça marche", "Pilote"]) {
      await expect(header.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(header.getByText("Science", { exact: true })).toHaveCount(0);
    await page.goto("/aura/science");
    await expect(page.locator("body")).toContainText("Fondement scientifique");
  });
});
