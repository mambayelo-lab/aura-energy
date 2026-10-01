import { test, expect } from "@playwright/test";

// Démo Supply Maison Lucie en un clic, depuis le cockpit vide : sources,
// lecture live du SI synthétique, modèle objet, mappings validés au-dessus du
// seuil, alertes issues des règles causales, mention « démonstration ».
// Si le SI n'est pas joignable : message clair et aucune alerte inventée.
test.use({ viewport: { width: 1440, height: 900 } });

test("charger la démo Supply en un clic depuis le cockpit vide", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/resilience?section=cockpit");
  await expect(page.getByText("Rien à signaler")).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(".ct-alert-card")).toHaveCount(0);

  await page.getByTestId("supply-demo-load").click();
  await expect(page.getByLabel("Progression de la démo")).toBeVisible();
  await expect(page.locator(".ct-alert-card").first().or(page.getByText(/n’est pas joignable/))).toBeVisible({ timeout: 90_000 });

  if (await page.getByRole("alert").filter({ hasText: "n’est pas joignable" }).isVisible()) {
    await expect(page.getByText("Aucune donnée n’a été chargée ni inventée.")).toBeVisible();
    await expect(page.locator(".ct-alert-card")).toHaveCount(0);
    test.info().annotations.push({ type: "info", description: "SI Maison Lucie injoignable : chemin d'erreur vérifié." });
    return;
  }

  // Cockpit alimenté par les règles causales évaluées sur les données lues.
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 20_000 });
  // Les 5 règles ancrées se déclenchent (voir supply-coherence.test.ts) :
  // capacité SUP-001, couverture BOX-PREMIUM · WH-PAR, retard SHP-893 au
  // seuil critique ; écart de prévision BAG-LUNA · 2026-W40 et risque
  // géopolitique SUP-003 à surveiller. Une seule condition par règle : la
  // cohérence par entité ne change ni le nombre ni la gravité des alertes.
  // S'y ajoutent les alertes de résilience calculées sur les mêmes données
  // (resilience-tts.ts) : 3 nœuds critiques (TTR > TTS) et le signal sanitaire.
  await expect(page.locator(".ct-alert-card")).toHaveCount(9);
  await expect(page.locator(".ct-alert-card", { hasText: "Nœud critique" })).toHaveCount(3);
  await expect(page.locator(".ct-alert-card", { hasText: "Pic de demande et commandes amplifiées" })).toHaveCount(1);
  await expect(page.locator(".ct-alert-card .ct-alert-pill", { hasText: "Critique" })).toHaveCount(3);
  // Chaque carte nomme l'entité qui déclenche la règle (la plus grave).
  for (const who of ["SUP-001 · Tessitura Milano", "BOX-PREMIUM · WH-PAR", "SHP-893 · AsiaBridge", "BAG-LUNA · 2026-W40", "SUP-003 · Shenzhen Atelier Components"]) {
    await expect(page.locator(".ct-alert-card", { hasText: who })).toHaveCount(1);
  }
  await expect(page.getByTestId("supply-demo-notice").first()).toHaveText("Données de démonstration — SI synthétique Maison Lucie");

  // Scénario guidé : ouvrir le détail coche l'étape, le bandeau se referme.
  const guide = page.getByTestId("supply-demo-guide");
  await expect(guide).toBeVisible();
  await page.locator(".ct-alert-card").first().getByRole("button", { name: /Agrandir l'alerte/ }).click();
  await page.keyboard.press("Escape");
  // Épuré : seule l'étape suivante est affichée ; la progression avance.
  await expect(guide).toContainText("2/5");
  await page.getByRole("button", { name: "Fermer le scénario guidé" }).click();
  await expect(guide).toHaveCount(0);

  // La démo survit au rechargement puis se réinitialise proprement.
  await page.reload();
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("supply-demo-banner").getByTestId("supply-demo-reset").click();
  await expect(page.locator(".ct-alert-card")).toHaveCount(0, { timeout: 20_000 });
  await expect(page.getByTestId("supply-demo-banner")).toHaveCount(0);
});

test("Studio : la démo en un clic affiche sa progression étape par étape", async ({ page }) => {
  test.setTimeout(120_000);
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/studio?tab=sources");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("supply-demo-load").click();
  await expect(page.getByLabel("Progression de la démo")).toBeVisible();
  await expect(page.getByText(/Démo chargée|n’est pas joignable/)).toBeVisible({ timeout: 90_000 });
  if (await page.getByText(/Démo chargée/).isVisible()) {
    await expect(page.locator(".sd-step[data-state=done]")).toHaveCount(5);
    await expect(page.getByTestId("supply-demo-notice")).toBeVisible();
    await page.getByRole("link", { name: /Voir le cockpit/ }).click();
    await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 20_000 });
  } else {
    await expect(page.locator(".sd-step[data-state=error]")).toHaveCount(1);
  }
});
