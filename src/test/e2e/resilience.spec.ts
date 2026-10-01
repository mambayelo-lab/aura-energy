import { test, expect, type Page } from "@playwright/test";

// Résilience (TTS / TTR lus), scénario d'arrêt et cas « pandémie » sous ses trois formes, avec captures.
const DIR = process.env.CAPTURES_DIR;
const shot = async (page: Page, name: string, fullPage = false) => { if (DIR) await page.screenshot({ path: `${DIR}/${name}.png`, fullPage }); };
test.use({ viewport: { width: 1440, height: 900 } });

async function relay(page: Page) {
  // Environnement sans accès direct du navigateur au SI déployé : relais par Node (E2E_LUCIE_RELAY=1), données inchangées.
  if (process.env.E2E_LUCIE_RELAY) await page.route(/maison-lucie-si\.vercel\.app/, async route => {
    const r = route.request(); const h = { ...r.headers() }; delete h["host"];
    const res = await fetch(r.url(), { method: r.method(), headers: h, body: ["GET", "HEAD"].includes(r.method()) ? undefined : r.postData() ?? undefined });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
}
/** Charge la démo Maison Lucie ; false si le SI est injoignable. */
async function loadDemo(page: Page) {
  page.on("dialog", d => d.accept());
  await relay(page);
  await page.goto("/cockpit/resilience?section=cockpit");
  await page.getByTestId("supply-demo-load").click({ timeout: 30_000 });
  await expect(page.locator(".ct-alert-card").first().or(page.getByText(/n’est pas joignable/))).toBeVisible({ timeout: 90_000 });
  if (await page.getByText(/n’est pas joignable/).first().isVisible()) { test.info().annotations.push({ type: "info", description: "SI Maison Lucie injoignable" }); return false; }
  return true;
}

test("Résilience sans données : aucun chiffre inventé", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=resilience");
  await expect(page.getByTestId("resilience-view")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("resilience-empty")).toBeVisible();
});

test("Résilience Maison Lucie : carte d'exposition, nœuds critiques, stress-test, décision", async ({ page }) => {
  test.setTimeout(180_000);
  if (!(await loadDemo(page))) return;
  await expect(page.locator(".ct-alert-card", { hasText: "Nœud critique" }).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "1-cockpit-alertes-resilience");
  await page.getByRole("tab", { name: "Exposition" }).click();
  await expect(page.getByTestId("resilience-map")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("resilience-critical")).toContainText("TTS lu");
  await expect(page.getByTestId("resilience-view")).not.toContainText(/Probabilité|marge exposée/i);
  await shot(page, "2-resilience-carte");
  await page.getByTestId("resilience-critical").scrollIntoViewIfNeeded();
  await shot(page, "3-resilience-noeuds-critiques");
  // Scénario d'arrêt qualitatif : un fournisseur s'arrête 180 jours ; la règle compare le TTS lu à la durée, sans montant.
  await expect(page.getByTestId("stress-explain")).toContainText("sans calculer aucun montant");
  await page.getByTestId("stress-scenario").selectOption("fournisseur");
  await page.getByTestId("stress-duree").fill("180");
  await expect(page.getByTestId("stress-breaks")).not.toHaveText("0");
  await expect(page.getByTestId("resilience-stress")).not.toContainText("€");
  await page.getByTestId("resilience-stress").scrollIntoViewIfNeeded();
  await shot(page, "4-scenario-arret");
  await page.getByTestId("resilience-maturite").scrollIntoViewIfNeeded();
  await shot(page, "5-maturite");
  // Traiter un nœud critique dans Décider.
  await page.getByTestId("resilience-critical").getByRole("button", { name: /Traiter dans Décider/ }).first().click();
  await expect(page.getByRole("main").first()).toContainText(/Source alternative|Stock tampon|Délai de reprise/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "6-decider-noeud-critique");
});

test("Démo enregistrée par une version antérieure : relue automatiquement", async ({ page }) => {
  test.setTimeout(240_000);
  if (!(await loadDemo(page))) return;
  await page.evaluate(() => {
    const v = JSON.parse(localStorage.getItem("aura-v4-studio-vocab") ?? "{}");
    delete v.demoVersion;
    localStorage.setItem("aura-v4-studio-vocab", JSON.stringify(v));
  });
  await page.goto("/cockpit/resilience?section=resilience");
  await expect(page.getByTestId("stress-scenario")).toBeVisible({ timeout: 90_000 });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("aura-v4-studio-vocab") ?? "{}").demoVersion), { timeout: 90_000 }).toBeTruthy();
});

test("Cockpit Maison Lucie : alertes historiques et de résilience côte à côte", async ({ page }) => {
  test.setTimeout(180_000);
  if (!(await loadDemo(page))) return;
  for (const label of ["Risque de rupture fournisseur", "Couverture de stock sous seuil", "Surstock ou obsolescence", "Retard transport critique", "Dégradation OTIF", "Prévision de demande en dérive", "Risque géopolitique",
    "Promesse client menacée", "Commande fournisseur non confirmée", "Rupture projetée", "Paramètres MRP obsolètes",
    "Fournisseur unique", "Exposition géographique", "Effet coup de fouet", "Défaillance financière", "Qualité fournisseur", "Certification fournisseur", "Congestion portuaire", "Rappel produit", "Devoir de vigilance"])
    await expect(page.locator(".ct-alert-card", { hasText: label }).first(), label).toBeAttached({ timeout: 30_000 });
});

test("Pandémie, Décider autonome : cas illustré sans données", async ({ page }) => {
  await page.goto("/cockpit/atelier?demo=supply-pandemie");
  await expect(page.getByRole("main").first()).toContainText("Crise sanitaire (pandémie)", { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "7-pandemie-decider-autonome");
});

test("Pandémie, Supply sans alerte : évaluation prédéfinie à l'étape Comprendre", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=decision");
  await expect(page.getByRole("textbox", { name: "Décrire la décision" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByTestId("preset-pandemie").click();
    await expect(page.getByRole("main").first()).toContainText("Crise sanitaire (pandémie)", { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "8-pandemie-preset-comprendre");
});

test("Pandémie, Supply avec alerte Maison Lucie : pic de demande et commandes amplifiées", async ({ page }) => {
  test.setTimeout(180_000);
  if (!(await loadDemo(page))) return;
  const card = page.locator(".ct-alert-card", { hasText: "crise sanitaire" }).first();
  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.scrollIntoViewIfNeeded();
  await shot(page, "9-alerte-sanitaire");
  await card.getByRole("button", { name: /Décider/ }).click();
  await expect(page.getByRole("main").first()).toContainText(/Pilotage de la demande|Équipes|Stock stratégique/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "10-alerte-sanitaire-decider");
});
