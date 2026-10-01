import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Alertes de résilience sur le SI standard Maison Lucie : graphe causal, stress-test
// avec plans B classés par Décider, décision préremplie, encart « solide » et mini-rapport.
const LUCIE = process.env.LUCIE_BASE ?? "http://127.0.0.1:4300";
const SHOTS = process.env.ALERT_SHOTS;
const shot = async (page: import("@playwright/test").Page, name: string) => { if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true }); } };

test("graphe causal, stress-test, décision préremplie, mini-rapport", async ({ page, request }) => {
  test.setTimeout(300_000);
  test.skip(!(await request.get(`${LUCIE}/channels`).then(r => r.ok()).catch(() => false)), "SI Maison Lucie non joignable");
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/^aura|argus/i.test(k)) localStorage.removeItem(k); });
  await page.reload({ waitUntil: "load" });
  const progress = page.getByTestId("one-click-progress");
  await expect(async () => { await page.getByTestId("mode-one-click").getByRole("button", { name: /Charger la démo Maison Lucie|En cours/ }).click({ timeout: 2000 }); await expect(progress).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.waitForURL(/\/cockpit\/resilience/, { timeout: 240_000 });

  // Graphe causal : les règles de résilience et leurs chaînes vers les conséquences existantes.
  await page.goto("/cockpit/studio?tab=rules", { waitUntil: "load" });
  const graph = page.getByTestId("causal-graph");
  await expect(async () => { await page.getByRole("tab", { name: "Graphe" }).click({ timeout: 2000 }); await expect(graph).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await expect(graph).toBeVisible({ timeout: 60_000 });
  await expect(graph).toContainText("Fournisseur unique");
  await expect(graph).toContainText("Source unique puis rupture projetée");
  await graph.scrollIntoViewIfNeeded();
  await shot(page, "06-graphe-causal");

  // Stress-test : plans B classés par Décider (attitude pessimiste, combinaisons, plus petit changement).
  await page.goto("/cockpit/resilience?section=resilience", { waitUntil: "load" });
  await expect(page.getByTestId("resilience-stress")).toBeVisible({ timeout: 60_000 });
  await page.getByTestId("stress-scenario").selectOption("fournisseur");
  const plans = page.getByTestId("stress-plans-b");
  await expect(plans).toContainText("Plans B classés par Décider");
  await expect(plans).toContainText("combinaisons explorées");
  await plans.getByText("Pourquoi ce classement est solide").click();
  await expect(plans).toContainText("Plus petit changement");
  await plans.scrollIntoViewIfNeeded();
  await shot(page, "07-stress-test-plans-b");

  // Décision préremplie depuis l'alerte « Fournisseur unique ».
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "load" });
  const card = page.locator("article", { has: page.getByRole("heading", { name: "Fournisseur unique : délai de reprise supérieur au délai de survie" }) }).first();
  await expect(card).toBeVisible({ timeout: 60_000 });
  await card.getByRole("button", { name: "Décider →" }).click();
  await expect(page.getByText("Qualifier une source alternative").first()).toBeVisible({ timeout: 60_000 });
  await shot(page, "08-decision-preremplie");
  // Résultat : les impacts préremplis sont des hypothèses ; on les accepte pour voir le classement.
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
  await expect(solid).toContainText("combinaisons de leviers");
  await expect(solid).toContainText("Plus petit changement");
  const dl = page.waitForEvent("download");
  await page.getByTestId("mini-report-pdf").click();
  expect((await dl).suggestedFilename()).toMatch(/^mini-rapport-.*\.pdf$/);
  await expect(page.getByTestId("mini-report-message")).toContainText(/enregistré/);
  await shot(page, "09-resultat-solide-mini-rapport");
});
