import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1440, height: 900 } });

test("Décider Comprendre : mots clés surlignés et import de document", async ({ page }) => {
  // La question guidée vit dans la vue « Détail » de Décider (la vue par défaut est le dialogue).
  await page.goto("/cockpit/atelier", { waitUntil: "commit" });
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "detail"));
  await page.goto("/cockpit/atelier");
  const question = page.getByTestId("decision-question");
  await expect(question).toHaveText(/Quelle décision souhaitez-vous arbitrer/);
  await expect(question.locator("mark.aura-kw", { hasText: /^décision$/ })).toBeVisible();
  await expect(question.locator("mark.aura-kw", { hasText: /^arbitrer$/ })).toBeVisible();
  const weight = await question.locator("mark.aura-kw").first().evaluate(el => Number(getComputedStyle(el).fontWeight));
  expect(weight).toBeGreaterThanOrEqual(600);
  const drop = page.getByTestId("doc-import").first();
  await expect(drop).toContainText("Importer un document");
  await expect(drop).toContainText(/PDF, Word/);
  await expect(drop.locator("input[type=file]")).toHaveCount(1);
});

test("Supply Studio : les questions de « Paramétrer avec Aura » sont surlignées", async ({ page }) => {
  await page.goto("/cockpit/studio");
  const kw = page.locator("mark.aura-kw", { hasText: /domaine métier/i }).first();
  await expect(async () => {
    await page.getByRole("button", { name: /Paramétrer avec Aura/ }).first().click();
    await expect(kw).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20_000 });
});

test("Démonstrations : icône sectorielle dans une pastille cohérente", async ({ page }) => {
  for (const route of ["/cockpit/demos"]) {
    await page.goto(route);
    const icons = page.getByTestId("demo-icon");
    expect(await icons.count(), route).toBeGreaterThan(3);
    await expect(icons.first().locator("svg")).toBeVisible();
  }
});
