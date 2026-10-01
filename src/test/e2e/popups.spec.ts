import { test, expect, type Locator, type Page } from "@playwright/test";

// Inventaire des pop-ups, panneaux et tiroirs de Supply et de Décider en autonome :
// chacun s'ouvre puis se ferme par la croix, par Échap et, quand c'est pertinent,
// par un clic à l'extérieur. Les formulaires (revue, identifiants) ne se ferment
// pas au clic extérieur, pour ne pas perdre une saisie.

async function closes(page: Page, open: () => Promise<void>, panel: () => Locator, how: { cross?: () => Locator; outside?: boolean }) {
  if (how.cross) { await open(); await expect(panel()).toBeVisible(); await how.cross().click(); await expect(panel()).toBeHidden(); }
  await open(); await expect(panel()).toBeVisible(); await page.keyboard.press("Escape"); await expect(panel()).toBeHidden();
  if (how.outside) { await open(); await expect(panel()).toBeVisible(); await page.mouse.click(3, 3); await expect(panel()).toBeHidden(); }
}

test.use({ viewport: { width: 1440, height: 900 } });

test("Décider : menu d'outils, annotations, revue", async ({ page }) => {
  test.setTimeout(90_000);
  // Décider embarqué dans Supply (même composant que Décider en autonome, avec sa barre latérale).
  await page.goto("/cockpit/resilience?section=decision");
  await page.waitForLoadState("networkidle");
  await expect(async () => {
    await page.getByRole("button", { name: "+ Nouvelle décision" }).first().click();
    await expect(page.getByRole("tab", { name: "Dialogue" })).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  // « Comment ça marche » (CommentCaMarche) : la barre latérale qui l'ouvre est masquée ; la fenêtre se ferme par ×, Échap ou clic extérieur (useDismiss).

  // Menu « Plus d'outils » : Échap et clic extérieur.
  const tools = page.getByRole("button", { name: "Plus d'outils" });
  await closes(page, () => tools.click(), () => page.getByRole("menuitem", { name: /Annotations/ }), { outside: true });

  // Panneau d'annotations : croix, Échap, clic extérieur.
  const openNotes = async () => { await tools.click(); await page.getByRole("menuitem", { name: /Annotations/ }).click(); };
  const notes = () => page.getByPlaceholder(/annotation|commentaire|note/i).first();
  await closes(page, openNotes, notes, { cross: () => page.getByRole("button", { name: "✕" }).first(), outside: true });

  // Revue (formulaire) : croix et Échap.
  const openRevue = async () => { await tools.click(); await page.getByRole("menuitem", { name: /Programmer la revue/ }).click(); };
  await closes(page, openRevue, () => page.getByText("Programmer la revue de décision"), { cross: () => page.getByRole("button", { name: "Fermer" }).first() });
});

test("Supply : copilote et panneau Exposition", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=cockpit");
  await page.waitForLoadState("networkidle");
  const panel = () => page.getByRole("complementary", { name: "Copilote Aura" });
  await expect(panel()).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Réduire le copilote" }).click();
  await expect(panel()).toBeHidden();
  await page.getByRole("button", { name: "Ouvrir le copilote Aura" }).click();
  await expect(panel()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel()).toBeHidden();
  // L'onglet Exposition porte sa question en clair.
  await page.getByRole("tab", { name: "Exposition" }).click();
  await expect(page.getByTestId("resilience-view")).toContainText("Combien de temps tenez-vous", { ignoreCase: true, timeout: 30_000 });
});

test("Menu de navigation en tiroir (mobile) : croix, Échap, clic extérieur", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/cockpit/resilience?section=cockpit");
  const burger = page.getByRole("button", { name: "Ouvrir le menu" });
  await expect(burger).toBeVisible({ timeout: 30_000 });
  const drawer = () => page.locator(".aura-nav-sidebar.drawer-open");
  await burger.click(); await expect(drawer()).toBeVisible();
  await page.getByRole("button", { name: "Fermer le menu" }).click(); await expect(drawer()).toHaveCount(0);
  await burger.click(); await page.keyboard.press("Escape"); await expect(drawer()).toHaveCount(0);
  await burger.click(); await page.mouse.click(385, 400); await expect(drawer()).toHaveCount(0);
});

test("Décisions stratégiques : modèle prérempli ouvert dans Décider", async ({ page }) => {
  await page.goto("/cockpit/resilience?section=decision");
  const box = page.getByTestId("strategic-decisions");
  await expect(box).toBeVisible({ timeout: 30_000 });
  await page.waitForLoadState("networkidle");
  await box.locator("summary").click();
  await expect(async () => {
    await page.getByTestId("strategic-STRAT-ENTREPOT").click();
    await expect(page.getByRole("main").first()).toContainText(/Emplacement|Exploitation/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
});
