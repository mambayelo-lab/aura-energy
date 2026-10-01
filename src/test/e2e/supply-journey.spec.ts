import { test, expect } from "@playwright/test";

// Parcours complet Supply sur le SI Maison Lucie. Nécessite une instance
// joignable (E2E_LUCIE=1 et VITE_MAISON_LUCIE_URL côté serveur de dev).
test.skip(!process.env.E2E_LUCIE, "Maison Lucie non disponible pour ce run");

test("Maison Lucie → Studio → mapping → cockpit → copilote → décision préremplie", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", dialog => dialog.accept());
  await page.goto("/cockpit/studio?tab=sources");
  await page.waitForLoadState("networkidle");
  const phases = page.getByRole("navigation", { name: "Phases du Studio" });
  const pages = page.getByRole("navigation", { name: "Pages de la phase" });

  await expect(async () => {
    await page.getByRole("button", { name: /Installer la démo Maison Lucie/ }).click();
    await expect(page.getByText(/sources Maison Lucie configurées/)).toBeVisible({ timeout: 1500 });
  }).toPass();
  await pages.getByRole("button", { name: "Métadonnées & échantillons" }).click();
  await page.getByRole("button", { name: /Actualiser les données Maison Lucie/ }).click();
  await expect(page.getByText(/actualisés depuis le SI/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Tessitura Milano").first()).toBeVisible();

  await phases.getByRole("button", { name: /Modéliser/ }).click();
  await pages.getByRole("button", { name: "Objets métier" }).click();
  await page.getByRole("button", { name: /Charger le modèle Supply Chain/ }).click();
  await expect(page.getByRole("button", { name: "Modèle chargé" })).toBeVisible();

  await phases.getByRole("button", { name: /Mapper/ }).click();
  await page.getByRole("button", { name: /Valider les \d+ propositions/ }).click();

  await phases.getByRole("button", { name: /Raisonner/ }).click();
  await pages.getByRole("button", { name: "Ontologie vivante" }).click();
  await expect(page.locator(".attr-values code").first()).toBeVisible();

  await page.goto("/cockpit/resilience?section=cockpit");
  await expect(page.getByText("Alertes critiques")).toBeVisible();
  await expect(page.locator(".ct-exec-record", { hasText: "SUP-001 · Tessitura Milano" })).toBeVisible();
  // La chaîne de causalité s'affiche à la demande, dans le détail de l'alerte.
  await page.locator(".ct-alert-card", { hasText: "Risque de rupture fournisseur" }).getByRole("button", { name: /Agrandir l'alerte/ }).click();
  await expect(page.getByLabel("Chaîne de causalité de Risque de rupture fournisseur")).toContainText("88 ≥ 60");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Faits issus de Studio")).toHaveCount(0);

  await page.getByPlaceholder("Poser une question à Aura…").fill("Quels fournisseurs sont en risque de capacité ?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cp-panel .recharts-wrapper").first()).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: "Décider →" }).first().click();
  await expect(page.getByRole("tab", { name: "Décision", selected: true })).toBeVisible();
  // Options de la règle et critères de l'alerte pré-remplis : le résultat est à un clic.
  // Impacter pré-rempli depuis l'alerte et la règle : l'arbre est là, le résultat à un clic.
  await expect(page.getByText("Évaluation des impacts")).toBeVisible();
  await page.getByRole("button", { name: "Voir le résultat →" }).click();
  await page.getByRole("tab", { name: "Explorer les solutions" }).click();
  await expect(page.getByTestId("space-extent")).toContainText("exhaustif", { timeout: 60_000 });
});
