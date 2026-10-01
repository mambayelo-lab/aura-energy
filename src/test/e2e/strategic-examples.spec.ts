import { test, expect } from "@playwright/test";

// Exemples stratégiques Supply Chain (8 secteurs) : à l'accueil de Décider et dans le dialogue ; chacun pré-remplit la question.
test("exemples stratégiques : accueil et dialogue pré-remplis", async ({ page }) => {
  await page.goto("/cockpit/home", { waitUntil: "load" });
  await expect(page.getByTestId("strategic-example")).toHaveCount(8);
  for (const s of ["Retail", "Industrie", "Luxe", "Énergie", "Pharma", "Agroalimentaire", "E-commerce", "Automobile"]) await expect(page.getByTestId("strategic-example").filter({ hasText: s })).toHaveCount(1);
  await expect(async () => {
    await page.getByTestId("strategic-example").filter({ hasText: "Double sourcing" }).click();
    await expect(page.getByLabel("Décrire la décision")).toHaveValue(/Double sourcing ou accord-cadre/, { timeout: 5000 });
  }).toPass({ timeout: 60_000 });
  await expect(page.getByTestId("dialogue-example")).toHaveCount(8);
  await page.getByTestId("dialogue-example").filter({ hasText: "Décarbonation" }).click();
  await expect(page.getByLabel("Décrire la décision")).toHaveValue(/Ferroviaire multimodal/);
});

// Comprendre : compteur d'options par levier, PESTEL replié et suggestions stratégiques.
test("dialogue : options par levier, PESTEL et suggestions stratégiques", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/cockpit/home", { waitUntil: "load" });
  await expect(async () => {
    await page.getByTestId("strategic-example").filter({ hasText: "Double sourcing" }).click();
    await expect(page.getByLabel("Décrire la décision")).toHaveValue(/Double sourcing/, { timeout: 5000 });
  }).toPass({ timeout: 60_000 });
  await page.getByLabel("Décrire la décision").press("Enter");
  await expect(page.getByTestId("option-counts")).toContainText(/\d+( \/ \d+)+ options/, { timeout: 120_000 });
  await expect(page.getByTestId("pestel")).toContainText(/PESTEL \(\d facteurs/);
  await expect(page.getByTestId("strategic-suggestions")).toContainText("Questions de cadrage");
});
