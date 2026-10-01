import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Studio : deux modes. « Pas à pas » est le mode normal (SI du client) ;
// « Démo Maison Lucie en un clic » (mode démo, SI de démonstration seulement) enchaîne questionnaire → connexion → métadonnées → mapping → synchronisation
// → alertes et résilience, puis ouvre le cockpit ; « Pas à pas » valide chaque étape.
// Nécessite Maison Lucie joignable (npm run serve:vercel, 127.0.0.1:4300) et VITE_MAISON_LUCIE_URL pointé dessus.
const LUCIE = process.env.LUCIE_BASE ?? "http://127.0.0.1:4300";
const SHOTS = process.env.ALERT_SHOTS;
const shot = async (page: import("@playwright/test").Page, name: string) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };

async function fresh(page: import("@playwright/test").Page) {
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^aura|argus/i.test(k)) localStorage.removeItem(k); });
  await page.reload({ waitUntil: "load" });
  await expect(page.getByTestId("mode-one-click")).toBeVisible({ timeout: 60_000 });
}

test("Démo Maison Lucie en un clic : du questionnaire au cockpit, alertes chiffrées et chaîne causale", async ({ page, request }) => {
  test.setTimeout(300_000);
  test.skip(!(await request.get(`${LUCIE}/channels`).then(r => r.ok()).catch(() => false)), "SI Maison Lucie non joignable");
  await fresh(page);
  await expect(page.getByTestId("mode-step")).toBeVisible();
  await expect(page.getByTestId("mode-step")).toContainText("votre SI");
  await expect(page.getByTestId("mode-one-click")).toContainText("mode démo");
  await expect(page.getByTestId("mode-one-click")).toContainText("ne s'applique pas au SI d'un client");
  await shot(page, "01-studio-deux-modes");
  const progress = page.getByTestId("one-click-progress");
  // Le bouton est actif une fois la page hydratée : on réessaie tant que la progression n'apparaît pas.
  await expect(async () => { await page.getByTestId("mode-one-click").getByRole("button", { name: /Charger la démo Maison Lucie|En cours/ }).click({ timeout: 2000 }); await expect(progress).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await expect(progress.getByRole("progressbar")).toBeVisible();
  await expect(progress).toContainText("Connexion aux sources", { timeout: 60_000 });
  await shot(page, "02-tout-en-un-clic-progression");
  await page.waitForURL(/\/cockpit\/resilience/, { timeout: 240_000 });
  // Cockpit : alertes de résilience calculées sur les données standard, montant et source.
  await expect(page.getByText("Fournisseur unique : délai de reprise supérieur au délai de survie").first()).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("card-exposure").first()).toContainText(/€|donnée non fournie par le SI/);
  // Cas réglés à la main sur la démo : badge discret « scénario illustratif » et infobulle.
  const uniq = page.locator("article", { hasText: "Fournisseur unique : délai de reprise supérieur au délai de survie" }).first();
  await expect(uniq.getByTestId("alert-illustratif")).toHaveAttribute("title", /EINE-APLFZ/);
  await shot(page, "03-cockpit-alertes-chiffrees");
  // Détail : chaîne cause → conséquences → décision, montant et sa source.
  const card = page.locator("article", { hasText: "Fournisseur unique : délai de reprise supérieur au délai de survie" }).first();
  await card.getByRole("button", { name: /Agrandir|⤢|Détail/ }).first().click().catch(async () => { await card.click(); });
  await expect(page.getByTestId("alert-chain").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("alert-consequence").first()).toBeVisible();
  await expect(page.getByTestId("alert-exposure-source")).toContainText("Valeur lue");
  await shot(page, "04-detail-alerte-chaine-montant");
  // Collaboration (sans session : repli local signalé) : commentaire avec mention, assignation et statut.
  const collab = page.getByTestId("collab-panel").first();
  await expect(collab.getByTestId("collab-mode")).toContainText("local");
  await collab.getByLabel("Nouveau commentaire").fill("À vérifier avec @claire");
  await collab.getByRole("button", { name: "Publier" }).click();
  await expect(collab.locator("mark")).toHaveText("@claire");
  await collab.getByLabel("Statut").selectOption("en_cours");
  await collab.getByText(/Fil d'activité/).click();
  await expect(collab.getByTestId("collab-activity")).toContainText("statut : En cours");
  await expect(collab.getByTestId("collab-activity")).toContainText("a mentionné claire");
  // Chaque étape reste modifiable : retour au Studio, étapes marquées faites.
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  const steps = page.getByRole("list", { name: "Progression du Studio" });
  await expect(steps.locator("button[data-done]")).toHaveCount(4, { timeout: 30_000 });
  await steps.getByRole("button", { name: /Connecter/ }).click();
  await expect(page.locator("[aria-label=Connecter] article[data-status=vert]").first()).toBeVisible();
  await steps.getByRole("button", { name: /Vérifier/ }).click();
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  await expect(page.locator("tr[data-status='validée']").first()).toBeVisible();
  await shot(page, "05-studio-etapes-modifiables");
});

test("Pas à pas : l'utilisateur valide chaque étape", async ({ page, request }) => {
  test.setTimeout(240_000);
  test.skip(!(await request.get(`${LUCIE}/channels`).then(r => r.ok()).catch(() => false)), "SI Maison Lucie non joignable");
  await fresh(page);
  await page.getByTestId("mode-step").getByRole("button", { name: /Commencer pas à pas/ }).click();
  await expect(async () => { await page.getByTestId("ij-demo").click({ timeout: 2000 }); await expect(page.getByLabel("Contrôle d'import")).toContainText("9 applications", { timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Tester les connexions" }).click();
  await expect(page.getByRole("region", { name: "Vérifier" }).or(page.locator("[aria-label=Vérifier]"))).toBeVisible({ timeout: 120_000 });
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  const toValidate = page.locator("tr[data-status='à valider']").getByRole("button", { name: /^Valider / });
  for (let i = 0; i < 20 && await toValidate.count(); i++) await toValidate.first().click();
  await page.getByRole("button", { name: "Mettre à jour maintenant" }).click();
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.getByLabel("Score par source")).toBeVisible({ timeout: 120_000 });
  // Passer d'un mode à l'autre : la démo en un clic reste proposée.
  await expect(page.getByTestId("mode-one-click")).toBeVisible();
});
