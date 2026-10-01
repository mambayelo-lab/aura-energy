import { test, expect } from "@playwright/test";

// Comprendre (mode Détail) sur une démo : modèle riche (leviers, options,
// lampe des options inspirantes), retour aux questions puis au modèle sans
// rien perdre.
test.use({ viewport: { width: 1440, height: 900 } });

test("Comprendre : modèle riche, retour aux questions et au modèle conservé", async ({ page }) => {
  test.setTimeout(120_000);
  await page.addInitScript(() => { try { localStorage.setItem("aura-decider-mode", "detail"); } catch { /* */ } });
  await page.goto("/cockpit/atelier?demo=supply-stock");
  await page.waitForURL(/sessionId=/);
  await page.getByTestId("atelier-step-comprendre").first().click({ timeout: 30_000 });
  await expect(page.getByTestId("comprendre-arbre")).toBeVisible({ timeout: 30_000 });
  // Les leviers détaillés sont repliés : on ouvre l'encart.
  await page.getByRole("button", { name: /Leviers & options déduits/ }).click();
  const leviers = page.getByTestId("comprendre-levier");
  await expect(leviers.first()).toBeVisible();
  const nLeviers = await leviers.count();
  expect(nLeviers).toBeGreaterThanOrEqual(3);
  expect(await page.getByTestId("comprendre-option").count()).toBeGreaterThanOrEqual(6);
  // Retour aux questions : le cadrage est conservé, puis retour au modèle identique.
  await page.getByTestId("comprendre-revoir-questions").click();
  await expect(page.getByTestId("comprendre-question")).toBeVisible();
  await expect(page.locator("textarea:visible").first()).not.toHaveValue("");
  await page.getByTestId("comprendre-precedent-modele").or(page.getByRole("button", { name: /modèle/i })).first().click().catch(() => {});
  await page.getByTestId("atelier-step-impacter").first().click();
  await page.getByTestId("atelier-step-comprendre").first().click();
  await expect(page.getByTestId("comprendre-arbre")).toBeVisible({ timeout: 30_000 });
  const toggle = page.getByRole("button", { name: /Leviers & options déduits/ });
  if (await toggle.getAttribute("aria-expanded") === "false") await toggle.click();
  expect(await page.getByTestId("comprendre-levier").count()).toBe(nLeviers);
});
