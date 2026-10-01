import { test, expect } from "@playwright/test";

// Alerte « Stock immobilisé » (BFR) : la décision préremplie va jusqu'au résultat
// (recommandation, « pourquoi c'est solide », mini-rapport).
const LUCIE = process.env.LUCIE_BASE ?? "http://127.0.0.1:4300";

test("stock immobilisé : décision préremplie jusqu'au résultat", async ({ page, request }) => {
  test.setTimeout(300_000);
  test.skip(!(await request.get(`${LUCIE}/channels`).then(r => r.ok()).catch(() => false)), "SI Maison Lucie non joignable");
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^aura|argus/i.test(k)) localStorage.removeItem(k); });
  await page.reload({ waitUntil: "load" });
  const progress = page.getByTestId("one-click-progress");
  await expect(async () => { await page.getByTestId("mode-one-click").getByRole("button", { name: /Charger la démo Maison Lucie|En cours/ }).click({ timeout: 2000 }); await expect(progress).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.waitForURL(/\/cockpit\/resilience/, { timeout: 240_000 });
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "load" });
  const card = page.locator("article", { has: page.getByRole("heading", { name: /Stock immobilisé/ }) }).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole("button", { name: "Décider →" }).click();
  await expect(page.getByText("Arrêt des commandes").first()).toBeVisible({ timeout: 60_000 });
  for (let i = 0; i < 30; i++) {
    const winner = page.getByTestId("dialogue-winner");
    if (await winner.isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: /Voir le résultat|Explorer|Continuer|Valider les hypothèses|Accepter/ }).first();
    if (await next.isVisible().catch(() => false)) await next.click().catch(() => undefined);
    const missing = page.getByTestId("missing-impact").first();
    if (await missing.isVisible().catch(() => false)) await missing.getByRole("button").first().click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await expect(page.getByTestId("dialogue-winner")).toBeVisible({ timeout: 30_000 });
  const solid = page.getByTestId("solidity-note");
  await solid.locator("summary").click();
  await expect(solid).toContainText("Plus petit changement");
  const dl = page.waitForEvent("download");
  await page.getByTestId("mini-report-pdf").click();
  expect((await dl).suggestedFilename()).toMatch(/^mini-rapport-.*\.pdf$/);
  await expect(page.getByTestId("mini-report-message")).toContainText(/enregistré/);
});
