import { test, expect } from "@playwright/test";

// Maison Lucie « volumétrie » : les 9 applications en taille scale (millions de lignes générées à la volée),
// lues sous budget : échantillon et métadonnées tout de suite, extractions lourdes reportées aux heures creuses.
const LUCIE = process.env.LUCIE_URL ?? "http://127.0.0.1:3300";
test("Studio · Maison Lucie en volumétrie, dans le respect du budget", async ({ page, request }) => {
  test.setTimeout(300_000);
  const up = await request.get(`${LUCIE}/api/sources/index`).then(r => r.ok()).catch(() => false);
  test.skip(!up, "SI Maison Lucie non joignable");
  const scale = await request.get(`${LUCIE}/api/sources/lake?resource=sales&size=scale&limit=2&cursor=49999998`, { headers: { Authorization: "Bearer lucie_aura_gateway_demo_token" } }).then(r => r.json());
  expect(scale.total).toBe(50_000_000);
  await page.goto("/cockpit/studio", { waitUntil: "load" });
  await page.evaluate(() => localStorage.removeItem("aura.integration.v1"));
  await page.reload({ waitUntil: "load" });
  await expect(async () => { await page.getByTestId("ij-demo-scale").click(); await expect(page.locator(".ij-check")).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await expect(page.getByLabel("Contrôle d'import")).toContainText("9 applications");
  await page.getByRole("button", { name: /Continuer/ }).click();
  await page.getByRole("button", { name: "Tester les connexions" }).click();
  await expect(page.locator(".ij-cov").first()).toBeVisible({ timeout: 120_000 });
  await page.getByRole("tab", { name: /^Mapping/ }).click();
  await expect(page.locator(".ij-samples code").first()).toBeVisible();
  const v = page.locator("tr[data-status='à valider']").getByRole("button", { name: /^Valider / });
  for (let i = 0; i < 20 && await v.count(); i++) await v.first().click();
  await page.getByRole("button", { name: "Mettre à jour maintenant" }).click();
  await page.getByRole("tab", { name: "Couverture" }).click();
  await expect(page.getByLabel("Stocké dans Aura")).toBeVisible({ timeout: 240_000 });
  // Les données remontent (référentiels légers) et les parcours complets lourds sont reportés, sous budget.
  await expect(page.getByLabel("Stocké dans Aura")).toContainText(/\d+ fournisseurs/);
  await expect(page.getByLabel("Journal des relevés")).toContainText(/reporté aux heures creuses/);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/volumetrie.png`, fullPage: true });
});
