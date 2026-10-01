import { test, expect, type Page } from "@playwright/test";

// Comprendre (Décider et Décision encapsulée dans Supply) : l'arbre objectifs →
// critères → indicateurs est affiché en premier, l'importance d'un indicateur se
// règle directement dans l'arbre (NUL / L / M / H) et persiste, et le survol d'un
// levier met en surbrillance les indicateurs qu'il influence.
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(90_000);

const SHOTS = process.env.AURA_SHOTS_DIR;

async function reglerEtVerifier(page: Page, prefix: string) {
  const arbre = page.getByTestId("comprendre-arbre");
  await expect(arbre).toBeVisible({ timeout: 30_000 });
  const ind = arbre.getByTestId("arbre-indicateur").first();
  const nom = (await ind.locator("strong").first().innerText()).trim();
  const seg = ind.getByTestId("poids-seg");
  const actuel = await seg.locator("button[aria-pressed=true]").getAttribute("data-level");
  const cible = actuel === "H" ? "L" : "H";
  await seg.locator(`button[data-level="${cible}"]`).click();
  await expect(seg.locator(`button[data-level="${cible}"]`)).toHaveAttribute("aria-pressed", "true");
  if (SHOTS) {
    await arbre.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${SHOTS}/${prefix}-comprendre-arbre-poids.png` });
  }
  // Persistance : après rechargement, le même indicateur garde son importance.
  await page.waitForTimeout(800);
  await page.reload();
  const again = page.getByTestId("comprendre-arbre").getByTestId("arbre-indicateur").filter({ has: page.locator("strong", { hasText: nom }) }).first();
  await expect(again.locator(`button[data-level="${cible}"]`)).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });

  // Rapprochement leviers ↔ indicateurs : survol d'un levier lié.
  const leviers = page.getByTestId("comprendre-arbre").getByTestId("arbre-levier");
  const n = await leviers.count();
  expect(n).toBeGreaterThan(0);
  let ok = false;
  for (let i = 0; i < n && !ok; i++) {
    const lev = leviers.nth(i);
    if (await lev.locator(".cal-link").count() === 0) continue;
    await lev.hover();
    await expect(lev).toHaveAttribute("data-lien-actif", "true");
    const lies = page.getByTestId("comprendre-arbre").locator('[data-testid="arbre-indicateur"][data-lien-actif="true"]');
    await expect(lies.first()).toBeVisible();
    ok = true;
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/${prefix}-comprendre-leviers-liens.png` });
  }
  expect(ok).toBe(true);
}

test("Décider (démo) : importance réglée dans l'arbre, persistée, liens leviers → indicateurs", async ({ page }) => {
  await page.goto("/cockpit/atelier?demo=supply-stock");
  await page.waitForURL(/sessionId=/);
  await page.getByTestId("atelier-step-comprendre").click();
  await reglerEtVerifier(page, "decider");
});

test("Supply mode Décision (démo) : importance réglée dans l'arbre et liens leviers", async ({ page }) => {
  await page.goto("/cockpit/atelier?demo=supply-stock");
  await page.waitForURL(/sessionId=/);
  await page.goto("/cockpit/resilience?section=decision");
  // La liste des décisions s'ouvre à la demande.
  const picker = page.getByRole("combobox", { name: "Choisir une décision" });
  await expect(async () => {
    await page.getByRole("button", { name: "Choisir une décision" }).click({ timeout: 2000 });
    await expect(picker).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  const demoValue = await picker.locator("option", { hasText: "Demande volatile" }).first().getAttribute("value");
  if (demoValue) await picker.selectOption(demoValue);
  await page.getByTestId("atelier-step-comprendre").click();
  await reglerEtVerifier(page, "supply");
});

// Plancher de lisibilité : aucun texte visible des pages principales sous 12 px.
const PAGES = [
  "/cockpit/atelier",
  "/cockpit/atelier?demo=supply-stock",
  "/cockpit/resilience",
  "/cockpit/resilience?section=decision",
  "/cockpit/studio",
  "/cockpit/home",
];

for (const url of PAGES) {
  test(`Lisibilité ≥ 12px : ${url}`, async ({ page }) => {
    const res = await page.goto(url);
    test.skip(!res || res.status() >= 400, "page absente");
    // Borne : le script d'un Web Worker de calcul reste « en cours » pour Playwright, networkidle peut ne jamais venir.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1200);
    const petits = await page.evaluate(() => {
      const out: string[] = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        const t = (n.textContent ?? "").trim();
        if (!t || t.length < 2) continue;
        const el = n.parentElement;
        if (!el || el.closest("svg, [aria-hidden=true], .sr-only, script, style")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
        const fs = parseFloat(cs.fontSize);
        if (fs < 12) out.push(`${fs}px « ${t.slice(0, 40)} » <${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 40)}">`);
      }
      return out;
    });
    expect(petits, petits.join("\n")).toEqual([]);
  });
}
