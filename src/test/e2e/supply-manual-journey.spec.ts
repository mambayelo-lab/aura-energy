import { test, expect, type Page } from "@playwright/test";

// Parcours Supply fait entièrement à la main (sans démo en un clic) :
// connexion GraphQL Maison Lucie → indicateur créé → mappings manuels
// (ajout, modification, suppression) → alerte et règle causale créées,
// modifiées, dupliquées, désactivées, supprimées → cockpit → copilote avec
// et sans graphique. Nécessite le SI Maison Lucie (E2E_LUCIE=1 et
// VITE_MAISON_LUCIE_URL côté serveur de dev).
test.skip(!process.env.E2E_LUCIE, "Maison Lucie non disponible pour ce run");

const GQL = "(Maison Lucie · GraphQL)";

async function mapKpi(page: Page, kpi: string, column: string) {
  await page.getByLabel("Indicateur à mapper").selectOption({ label: kpi });
  await page.getByLabel("Colonne source").selectOption({ label: `supplierRiskAssessments.${column} ${GQL}` });
  await page.getByRole("button", { name: "Ajouter le mapping" }).click();
}

test("parcours manuel : connecter, mapper, paramétrer, exploiter le cockpit", async ({ page }) => {
  test.setTimeout(240_000);
  page.on("dialog", dialog => dialog.accept());
  const phases = page.getByRole("navigation", { name: "Phases du Studio" });
  const pages = page.getByRole("navigation", { name: "Pages de la phase" });

  // 1. Connecter
  await page.goto("/cockpit/studio?tab=sources");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Repartir de zéro/ }).click();
  await page.locator(".catalog-grid article", { hasText: "Maison Lucie" }).getByRole("button", { name: "Connecter" }).click();
  await page.getByRole("button", { name: /Connecter, lire les métadonnées/ }).click();
  await expect(page.getByText(/1 table\(s\) lue\(s\)/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Tessitura Milano").first()).toBeVisible();

  // 2. Indicateur + mappings manuels
  await phases.getByRole("button", { name: /Modéliser/ }).click();
  await pages.getByRole("button", { name: "Indicateurs & seuils" }).click();
  await page.getByLabel("Nom du nouvel indicateur").fill("Capacité fournisseur");
  await page.getByLabel("Unité du nouvel indicateur").fill("score/100");
  await page.getByLabel("Seuil d'alerte du nouvel indicateur").fill("60");
  await page.getByLabel("Seuil critique du nouvel indicateur").fill("85");
  await page.getByRole("button", { name: "+ Indicateur" }).click();
  await expect(page.getByLabel("Libellé de Capacité fournisseur")).toBeVisible();

  await phases.getByRole("button", { name: /Mapper/ }).click();
  await mapKpi(page, "Capacité fournisseur", "capacityRisk");
  await mapKpi(page, "Risque géopolitique fournisseur", "overallRisk");
  await page.getByLabel("Champ source de Risque géopolitique fournisseur").selectOption({ label: `supplierRiskAssessments.geopoliticalRisk ${GQL}` });
  await mapKpi(page, "Risque global fournisseur", "country");
  await page.getByRole("button", { name: /Supprimer le mapping Risque global fournisseur/ }).click();
  await expect(page.getByLabel("Champ source de Risque global fournisseur")).toHaveCount(0);

  // 3. Alertes et règles
  await phases.getByRole("button", { name: /Raisonner/ }).click();
  await pages.getByRole("button", { name: "Règles & alertes" }).click();
  // Les actions de liste (dupliquer, activer, supprimer) sont dans la vue Liste.
  await page.getByRole("tab", { name: "Liste" }).click();
  const editor = page.getByRole("form", { name: "Éditeur de règle" });
  await page.getByRole("button", { name: "+ Nouvelle alerte" }).click();
  await editor.locator("input[name=label]").fill("Fournisseur saturé");
  await editor.locator("select[name=severity]").selectOption("critique");
  await editor.getByLabel("Condition 1", { exact: true }).selectOption({ label: "Capacité fournisseur (score/100 · alerte 60, critique 85)" });
  await editor.getByLabel("Niveau de la condition 1").selectOption("critique");
  await editor.locator("textarea[name=conclusion]").fill("Le fournisseur ne peut plus honorer ses commandes.");
  await editor.locator("textarea[name=options]").fill("Dual sourcing\nStock tampon");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  const alertCard = page.getByRole("article", { name: "Fournisseur saturé" });
  await expect(alertCard.getByText("déclenchée")).toBeVisible();

  await page.getByRole("button", { name: "+ Nouvelle règle causale" }).click();
  await editor.locator("input[name=label]").fill("Double exposition");
  await editor.getByLabel("Condition 1", { exact: true }).selectOption({ label: "Capacité fournisseur (score/100 · alerte 60, critique 85)" });
  await editor.getByLabel("Condition 2", { exact: true }).selectOption({ label: "Risque géopolitique fournisseur (score/100 · alerte 50, critique 75)" });
  await expect(editor.getByTestId("rule-scope")).toHaveText("S'applique par : Fournisseur");
  await editor.locator("textarea[name=conclusion]").fill("Fournisseur saturé dans un pays à risque.");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("button", { name: "Modifier Double exposition" }).click();
  await editor.locator("input[name=label]").fill("Double exposition capacité et géopolitique");
  await editor.locator("textarea[name=options]").fill("Nearshore\nDual sourcing");
  await editor.getByRole("button", { name: "Enregistrer" }).click();
  const double = page.getByRole("article", { name: "Double exposition capacité et géopolitique" });
  await expect(double.getByText("Options : Nearshore · Dual sourcing")).toBeVisible();
  // Même fournisseur pour les deux conditions : SUP-003 (72 et 68) et SUP-006
  // (81 et 58), jamais SUP-001 (capacité 88 mais géopolitique 12).
  await expect(double.getByTestId("rule-entities")).toHaveText("Entités concernées (2) : SUP-003 · Shenzhen Atelier Components, SUP-006 · Atlas Metalworks");
  await page.getByRole("button", { name: "Dupliquer Double exposition capacité et géopolitique" }).click();
  const copy = "Double exposition capacité et géopolitique (copie)";
  await page.getByLabel(`Activer ${copy}`).uncheck();
  await expect(page.getByRole("article", { name: copy }).getByText("déclenchée")).toHaveCount(0);
  await page.getByRole("button", { name: `Supprimer ${copy}` }).click();
  await expect(page.getByRole("article", { name: copy })).toHaveCount(0);
  await page.getByRole("button", { name: "Supprimer Risque géopolitique/pays" }).click();
  await expect(page.getByRole("article", { name: "Risque géopolitique/pays" })).toHaveCount(0);

  // 4. Cockpit et copilote
  await page.goto("/cockpit/resilience?section=cockpit");
  await expect(page.getByRole("heading", { name: "Fournisseur saturé" })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Risque géopolitique/pays" })).toHaveCount(0);
  const input = page.getByPlaceholder("Poser une question à Aura…");
  const lastTurn = page.locator(".cp-panel .cp-turn").last();

  await input.fill("Compare les fournisseurs sur la capacité");
  await page.keyboard.press("Enter");
  await expect(lastTurn.locator(".aura-chart[data-chart-type=bar]")).toBeVisible({ timeout: 60_000 });
  await expect(lastTurn).toContainText("Tessitura Milano");

  await input.fill("Quelle est la tendance du risque de capacité ?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cp-panel .cp-turn")).toHaveCount(2, { timeout: 60_000 });
  await expect(lastTurn.locator(".aura-chart")).toBeVisible();
  await expect(lastTurn).toContainText("Évaluation précédente");

  await input.fill("Pourquoi l'alerte Fournisseur saturé est-elle déclenchée ?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cp-panel .cp-turn")).toHaveCount(3, { timeout: 60_000 });
  await expect(lastTurn).toContainText("88");
  await expect(lastTurn.locator(".aura-chart")).toHaveCount(0);

  await input.fill("Que recommandes-tu de faire ?");
  await page.keyboard.press("Enter");
  await expect(page.locator(".cp-panel .cp-turn")).toHaveCount(4, { timeout: 60_000 });
  await expect(lastTurn).toContainText(/dual sourcing/i);
  await expect(lastTurn.locator(".aura-chart")).toHaveCount(0);
});
