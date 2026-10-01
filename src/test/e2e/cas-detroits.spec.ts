import { test, expect } from "@playwright/test";

// Cas « perturbation d'un détroit maritime » sous ses trois formes, avec captures.
const DIR = process.env.CAPTURES_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => { if (DIR) await page.screenshot({ path: `${DIR}/${name}.png`, fullPage: false }); };
test.use({ viewport: { width: 1440, height: 900 } });

test("Décider autonome : cas illustré dans la galerie, sans données", async ({ page }) => {
  await page.goto("/cockpit/demos");
  await expect(page.getByText(/Perturbation d'un détroit maritime/).first()).toBeVisible({ timeout: 30_000 });
  await shot(page, "1-galerie-detroit");
  await page.goto("/cockpit/atelier?demo=supply-detroits");
  await expect(page.getByRole("main").first()).toContainText("Perturbation d'un détroit maritime", { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "2-decider-autonome-detroit");
});

test("Supply sans alerte : évaluation prédéfinie à l'étape Comprendre", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=decision");
  await expect(page.getByRole("textbox", { name: "Décrire la décision" })).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByTestId("preset-detroit").click();
    await expect(page.getByRole("main").first()).toContainText("Perturbation d'un détroit maritime (mer Rouge", { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "3-supply-preset-comprendre");
});

test("Supply avec alerte Maison Lucie : retard Shenzhen → Paris ouvre le profil détroit", async ({ page }) => {
  test.setTimeout(150_000);
  page.on("dialog", d => d.accept());
  // Environnement sans accès direct du navigateur au SI déployé : relais par Node (E2E_LUCIE_RELAY=1), données inchangées.
  if (process.env.E2E_LUCIE_RELAY) await page.route(/maison-lucie-si\.vercel\.app/, async route => {
    const r = route.request(); const h = { ...r.headers() }; delete h["host"];
    const res = await fetch(r.url(), { method: r.method(), headers: h, body: ["GET", "HEAD"].includes(r.method()) ? undefined : r.postData() ?? undefined });
    await route.fulfill({ status: res.status, headers: Object.fromEntries(res.headers), body: Buffer.from(await res.arrayBuffer()) });
  });
  await page.goto("/cockpit/resilience?section=cockpit");
  await page.getByTestId("supply-demo-load").click({ timeout: 30_000 });
  await expect(page.locator(".ct-alert-card").first().or(page.getByText(/n’est pas joignable/))).toBeVisible({ timeout: 90_000 });
  if (await page.getByText(/n’est pas joignable/).first().isVisible()) { await shot(page, "x-injoignable"); test.info().annotations.push({ type: "info", description: "SI Maison Lucie injoignable" }); return; }
  await expect(page.locator(".ct-alert-card", { hasText: "AsiaBridge" }).first()).toBeVisible({ timeout: 30_000 });
  const card = page.locator(".ct-alert-card", { hasText: "AsiaBridge" }).first();
  await shot(page, "4-supply-alertes-lucie");
  await card.getByRole("button", { name: /Décider/ }).click();
  await expect(page.getByRole("main").first()).toContainText(/Route Asie → Europe|Mer-air|Fret et couverture/, { timeout: 30_000 });
  await page.waitForTimeout(1500);
  await shot(page, "5-supply-alerte-detroit");
});
