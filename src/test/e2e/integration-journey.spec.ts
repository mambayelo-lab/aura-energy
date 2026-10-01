import { test, expect } from "@playwright/test";
import { writeXlsx } from "../../lib/integration/office";
import { questionnaireSheets, maisonLucieExample } from "../../lib/integration/questionnaire";

// Parcours complet du Studio sur le SI multi-sources Maison Lucie (5 sources) :
// questionnaire rempli → import → connexion → correspondances et cohérence → alertes au cockpit → décision.
// Nécessite le SI Maison Lucie joignable (npm start ou .local-shim.mjs sur 127.0.0.1:3300).
const LUCIE = process.env.LUCIE_URL ?? "http://127.0.0.1:3300";
const SHOTS = process.env.SHOTS;

test("Studio en 4 étapes : questionnaire Maison Lucie → cockpit → décision", async ({ page, request }) => {
  test.setTimeout(240_000);
  const up = await request.get(`${LUCIE}/api/sources/index`).then(r => r.ok()).catch(() => false);
  test.skip(!up, "SI Maison Lucie non joignable");
  const shot = async (name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); };
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => { localStorage.removeItem("aura.integration.v1"); localStorage.removeItem("aura.integration.cockpit.v1"); });
  await page.reload({ waitUntil: "load" });
  await expect(page.getByRole("list", { name: "Progression du Studio" })).toBeVisible();
  await shot("1-cartographier");

  // 1. Cartographier : questionnaire Excel rempli (exemple Maison Lucie), importé tel quel.
  const sheets = questionnaireSheets(LUCIE);
  const filled = [{ ...sheets[0], rows: [...sheets[0].rows.slice(0, sheets[0].headerRow! + 1), ...sheets[1].rows.slice(1)] }];
  const bytes = await writeXlsx(filled);
  await expect(async () => {
    await page.getByTestId("ij-file").setInputFiles({ name: "cartographie-maison-lucie.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(bytes) });
    await expect(page.getByLabel("Contrôle d'import")).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 30_000 });
  await expect(page.getByLabel("Contrôle d'import")).toContainText("9 applications");
  expect(maisonLucieExample(LUCIE).length).toBeGreaterThan(40);
  await shot("1-cartographier-importe");
  await page.getByRole("button", { name: /Continuer/ }).click();

  // 2. Connecter : variable serveur du jeton (la démo Maison Lucie lit LUCIE_GATEWAY_TOKEN), test, métadonnées.
  for (const input of await page.getByLabel(/^Variable serveur de /).all()) await input.fill("LUCIE_GATEWAY_TOKEN");
  await shot("2-connecter");
  await page.getByRole("button", { name: "Tester les connexions" }).click();
  await expect(page.getByRole("region", { name: "Vérifier" }).or(page.locator("[aria-label=Vérifier]"))).toBeVisible({ timeout: 90_000 });
  await expect(page.locator(".ij-cov").first()).toBeVisible();
  await shot("3-verifier");

  // 3. Vérifier : on valide les correspondances restant à valider, puis mise à jour sous budget.
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  await expect(page.locator(".ij-samples code").first()).toBeVisible();
  const toValidate = page.locator("tr[data-status='à valider']").getByRole("button", { name: /^Valider / });
  for (let i = 0; i < 20 && await toValidate.count(); i++) await toValidate.first().click();
  await page.getByRole("button", { name: "Mettre à jour maintenant" }).click();
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.getByLabel("Score par source")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Score par source")).toContainText("Écarts entre sources");
  await expect(page.getByLabel("Stocké dans Aura")).toContainText("aucune ligne brute");
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.getByLabel("Score par source")).toBeVisible({ timeout: 90_000 });
  await shot("3-verifier-couverture");
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  await shot("3-verifier-mapping");
  await page.getByRole("button", { name: "Échantillon et métadonnées" }).first().click();
  await expect(page.getByRole("dialog", { name: "Échantillon et métadonnées" })).toBeVisible();
  await shot("3-verifier-echantillon");
  await page.getByRole("button", { name: "Fermer" }).click();
  await page.getByRole("tab", { name: "Ontologie vivante" }).click();
  // Graphe non vide, indicateurs colorés selon l'état d'alerte.
  await expect(page.getByTestId("ontology-graph")).toBeVisible();
  // Graphe dépliable : un objet déplié montre ses attributs avec source et valeur réelles.
  await page.getByRole("button", { name: "Objet Fournisseur" }).click();
  await expect(page.getByRole("button", { name: "Objet Fournisseur" })).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByTestId("ontology-graph")).toContainText("Tessitura Milano");
  await shot("3-verifier-ontologie");
  // Bascule vers le Lignage filtré sur l'objet, depuis le Mapping.
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  await page.locator(".ij-props-head", { hasText: "Fournisseur" }).getByRole("link", { name: "Lignage" }).click();
  await expect(page.getByTestId("lineage")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByLabel("Filtrer par objet")).toHaveValue("sc-fournisseur");
  await shot("3-lignage-fournisseur");
  await page.goBack();
  await page.getByRole("button", { name: /Vérifier/ }).first().click();
  await page.getByRole("tab", { name: /^Écarts entre sources/ }).click();
  await expect(page.getByText("écart de fond").first()).toBeVisible();
  await shot("3-verifier-ecarts");

  // Désactiver le TMS : couverture Expédition à 0 %, alertes de retard suspendues ; puis réactivation.
  await page.getByRole("button", { name: /Connecter/ }).first().click();
  await page.getByLabel("État de TMS").selectOption("inactive");
  await page.getByRole("button", { name: /Vérifier/ }).first().click();
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.locator(".ij-cov", { hasText: "Expédition" })).toContainText("0 %");
  await shot("3-source-desactivee");
  await page.getByRole("button", { name: /Régler les alertes/ }).first().click();
  await expect(page.locator(".ij-alerts")).not.toContainText(/Retards fournisseur|Retards sur la route/);
  await page.getByRole("button", { name: /Connecter/ }).first().click();
  await page.getByLabel("État de TMS").selectOption("active");
  await page.getByRole("button", { name: /Vérifier/ }).first().click();
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.locator(".ij-cov", { hasText: "Expédition" })).toContainText(/[1-9][0-9]* %/);

  // 4. Régler les alertes et publier au cockpit.
  await page.getByRole("button", { name: /Régler les alertes/ }).first().click();
  await expect(page.locator(".ij-alerts li").first()).toBeVisible();
  await page.getByRole("button", { name: "Publier au cockpit" }).click();
  await shot("4-regler-alertes");
  // Règles : liste par défaut, graphe sur demande et amené à l'écran.
  await page.locator("summary", { hasText: "Règles causales du cockpit" }).click();
  await expect(page.getByRole("tab", { name: "Liste" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "Graphe" }).click();
  await expect(page.getByTestId("causal-graph")).toBeInViewport({ ratio: 0.3, timeout: 10_000 });
  await shot("4-graphe-causal");
  await page.getByRole("link", { name: /Voir le cockpit/ }).click();
  const card = page.locator(".ct-alert-card", { hasText: /Retards fournisseur|Retards sur la route|Ruptures de stock|Risque fournisseur/ }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await shot("5-cockpit");
  // L'alerte ouvre une décision préremplie avec ses options.
  await card.getByRole("button", { name: /Agrandir l'alerte/ }).click();
  await shot("6-alerte");
  await page.getByRole("button", { name: /Ouvrir une décision/ }).click();
  await expect(page.getByText(/Transfert inter-sites|Relancer et appliquer les pénalités|Double sourcing/).first()).toBeVisible({ timeout: 60_000 });
  await shot("7-decision");
});
