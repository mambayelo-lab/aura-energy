import { test, expect, type Page } from "@playwright/test";
import { computeOutcomeLattice, evaluateCombo } from "../../lib/v4/arbitrage-lattice";
import { configFromScenario } from "../../lib/v4/bora-kernel";
import type { AtelierSession } from "../../lib/v4/atelier-store";
import { impactCompleteness, withoutSuggestedOptions } from "../../lib/v4/decision-express";

// Le treillis d'Arbitrer (Potentiel δ⁺ × Risque δ⁻, 16 cases) affiché dans
// Décider et dans Supply (mode Décision, même atelier embarqué) doit être
// EXACTEMENT celui calculé par le moteur : comptes par case, ordre des axes,
// libellés, placement des scénarios, case recommandée.

const LEVEL_LONG = ["Nul", "Faible", "Moyen", "Haut"];

async function loadSession(page: Page): Promise<AtelierSession> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("aura-v4-atelier-sessions") ?? "[]")[0]);
}

async function setAttitude(page: Page, attitude: "Pessimiste" | "Optimiste") {
  // Le treillis vit dans le mode Détail (Explorer / Résultat).
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "detail"));
  await page.evaluate(a => {
    const all = JSON.parse(localStorage.getItem("aura-v4-atelier-sessions") ?? "[]");
    all[0].attitude = a;
    localStorage.setItem("aura-v4-atelier-sessions", JSON.stringify(all));
  }, attitude);
}

async function checkLattice(page: Page) {
  const card = page.locator(".am-lattice-card");
  await expect(card.locator(".am-lattice-plot-row")).toHaveCount(4, { timeout: 30_000 });
  const raw = await loadSession(page);
  // Options suggérées par Aura non validées : hors de l'espace exploré.
  const session = withoutSuggestedOptions(raw);
  const lattice = computeOutcomeLattice(session, session.scenarios.find(s => s.id === raw.retainedScenarioId) ?? session.scenarios[0]);
  expect(lattice.exhaustive).toBe(true);

  // Axes : Potentiel (δ⁺) de Haut (en haut) à Nul ; Risque (δ⁻) de Nul (à gauche) à Haut.
  expect(await card.locator(".am-lattice-ytick").allInnerTexts()).toEqual(["Haut", "Moyen", "Faible", "Nul"]);
  expect((await card.locator(".am-lattice-xticks span").allInnerTexts()).filter(Boolean)).toEqual(LEVEL_LONG);
  await expect(card.locator(".am-lattice-ylabel")).toContainText("Potentiel");
  await expect(page.locator(".am-lattice-xlabel")).toContainText("Risque");

  // En-tête : taille de l'espace et nombre de configurations sans point bloquant.
  const meta = await card.locator(".am-lattice-meta").innerText();
  const nf = (n: number) => n.toLocaleString("fr-FR");
  expect(meta.replace(/\s/g, " ")).toContain(`${nf(lattice.totalCombinations)} combinaisons possibles`.replace(/\s/g, " "));
  expect(meta.replace(/\s/g, " ")).toContain(`${nf(lattice.admissible)} sans point bloquant`.replace(/\s/g, " "));
  expect(meta).not.toContain("estimation");

  // Chaque case : compte exact (propre) ou, à défaut, compte « bloquants seulement ».
  const rows = card.locator(".am-lattice-plot-row");
  const scenarioCell = new Map<string, string>();
  for (const sc of raw.scenarios) {
    const ev = evaluateCombo(raw, sc, configFromScenario(sc));
    scenarioCell.set(sc.label, `${ev.global.gPlus},${ev.global.dMinus}`);
  }
  for (let r = 0; r < 4; r++) {
    const g = 3 - r;
    const cells = rows.nth(r).locator(".am-lattice-cell");
    await expect(cells).toHaveCount(4);
    for (let d = 0; d < 4; d++) {
      const cell = cells.nth(d);
      const clean = lattice.grid[g][d];
      const any = lattice.gridAny[g][d];
      if (clean > 0) {
        await expect(cell.locator(".am-lattice-count")).toHaveText(String(clean));
        await expect(cell.locator(".am-lattice-blocked")).toHaveCount(0);
      } else if (any > 0) {
        await expect(cell.locator(".am-lattice-count")).toHaveCount(0);
        await expect(cell.locator(".am-lattice-blocked")).toHaveText(String(any));
      } else {
        await expect(cell.locator(".am-lattice-count")).toHaveCount(0);
        await expect(cell.locator(".am-lattice-blocked")).toHaveCount(0);
      }
      // Badges des scénarios nommés : chacun dans la case de son propre forward.
      for (const title of await cell.locator(".am-lattice-alt.user").evaluateAll(els => els.map(e => e.getAttribute("title") ?? ""))) {
        expect(scenarioCell.get(title), `${title} placé en (${g},${d})`).toBe(`${g},${d}`);
      }
    }
  }

  // Matrice trop incomplète (< 60 % des impacts) : aucune recommandation, ni case recommandée.
  if (!impactCompleteness(session).reliable) {
    await expect(page.getByTestId("arbitrer-incomplete")).toBeVisible();
    await expect(card.locator(".am-lattice-cell.reco")).toHaveCount(0);
    return { session, lattice };
  }
  // Case recommandée = potentiel/risque affichés par la recommandation.
  const reco = card.locator(".am-lattice-cell.reco");
  await expect(reco).toHaveCount(1);
  const potentiel = (await page.locator(".pill-gplus").first().innerText()).split(":").pop()!.trim();
  const risque = (await page.locator(".pill-dminus").first().innerText()).split(":").pop()!.trim();
  const recoRow = await reco.evaluate(el => Array.from(el.parentElement!.parentElement!.children).filter(c => c.classList.contains("am-lattice-plot-row")).indexOf(el.parentElement!));
  const recoCol = await reco.evaluate(el => Array.from(el.parentElement!.querySelectorAll(".am-lattice-cell")).indexOf(el));
  expect(LEVEL_LONG[3 - recoRow]).toBe(potentiel);
  expect(LEVEL_LONG[recoCol]).toBe(risque);
  return { session, lattice };
}

for (const demo of ["supply-stock", "energie-reseau"]) {
  test(`Décider — treillis d'Arbitrer conforme au moteur (${demo}, deux attitudes)`, async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto(`/cockpit/atelier?demo=${demo}`);
    await page.waitForURL(/sessionId=/);
    await page.waitForLoadState("load");
    const url = page.url();
    for (const attitude of ["Pessimiste", "Optimiste"] as const) {
      await setAttitude(page, attitude);
      await page.goto(url);
      await page.waitForLoadState("load");
      await page.getByTestId("atelier-step-decider").click();
      // Réessaie si le serveur de développement recharge la page pendant la lecture.
      await expect(async () => {
        const { session } = await checkLattice(page);
        expect(session.attitude).toBe(attitude);
      }).toPass({ timeout: 90_000 });
    }
  });
}

test("Supply (mode Décision) — même treillis que le moteur", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/cockpit/atelier?demo=supply-stock");
  await page.waitForURL(/sessionId=/);
  await page.waitForLoadState("load");
  for (const attitude of ["Pessimiste", "Optimiste"] as const) {
    await setAttitude(page, attitude);
    await page.goto("/cockpit/resilience?section=decision");
    await page.waitForLoadState("load");
    await expect(page.getByText("Aura Supply Chain").first()).toBeVisible();
    if (await page.locator(".am-lattice-card").count() === 0) {
      await page.getByTestId("atelier-step-decider").click();
    }
    await expect(async () => {
      const { session } = await checkLattice(page);
      expect(session.sector).toBe("Supply chain");
      expect(session.attitude).toBe(attitude);
    }).toPass({ timeout: 90_000 });
  }
});
