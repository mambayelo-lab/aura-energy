import { test, expect, type Page } from "@playwright/test";

// Anglais : le choix EN (mémorisé) s'applique partout. Sur les écrans
// principaux de Supply et de Décider, aucun texte français ne doit rester
// visible (hors noms propres, identifiants et données brutes des sources).
const SHOTS = process.env.AURA_SHOTS_DIR;
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

// Mots français fréquents (sans équivalent anglais identique) et lettres accentuées typiques.
const FR_WORDS = /\b(le|la|les|des|du|une|et|ou|pour|avec|sans|sur|dans|par|aux|est|sont|vos|votre|nos|notre|cette|ces|qui|que|pas|plus|leur|au|à|d'un|d'une|Le|La|Les|Des|Une|Pour|Avec|Sans|Sur|Dans|Par|Vos|Votre|Cette|Ces|Aucun|Aucune|leviers|contraintes?|risques?|Alerte|Seuil|seuil|jours|indicateurs|critères|objectifs)\b|\b[dlDL]'[a-zéèàâ]/;
const FR_ACCENTS = /[éèêàùçôîâœ]/i;
// Noms propres et données de démonstration conservés tels quels.
const KEEP = /Le Havre|Maison Lucie|Tessitura|Côme|Vendôme|Fréjus|Radès|Hô Chi|Céleste|Rhône|Montréal|Gonesse|Lesquin|Saint-Priest|Fos|Havre|Sirius|Orion|Vega|Mira|Azur|Aurora|Comète|Anatolia|Kanpur|Shenzhen|Saigon|Atlas|Chennai|Yantian|Suez|Milan|Lille|Lyon|Paris|Marseille|AsiaBridge|MekongLines|AtlasMaritime|RhôneExpress|SpendGuard|Luminate|Snowflake|Coupa|Blue Yonder|Manhattan|Mistral|Décider|Aura|télérelève|Québec/i;

async function frenchLeft(page: Page): Promise<string[]> {
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = w.nextNode())) {
      const el = n.parentElement;
      if (!el || el.closest("script,style,[data-no-translate],textarea,input,code,pre,details:not([open])")) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none") continue;
      const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
      if (t.length > 2) out.push(t);
    }
    return out;
  });
  return [...new Set(texts)].filter(t => {
    const s = t.replace(new RegExp(KEEP.source, "gi"), "");
    return FR_WORDS.test(s) || FR_ACCENTS.test(s);
  });
}

async function setEnglish(page: Page) {
  await page.goto("/cockpit/home", { waitUntil: "commit" });
  await page.evaluate(() => { localStorage.setItem("aura.lang", "en"); localStorage.setItem("aura-decider-mode", "dialogue"); });
}
async function check(page: Page, name: string) {
  await page.waitForTimeout(2500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false });
  const left = await frenchLeft(page);
  expect.soft(left, `${name} : textes français restants`).toEqual([]);
}

test("Décider et Supply entièrement en anglais", async ({ page }) => {
  test.setTimeout(600_000);
  page.on("dialog", d => d.accept());
  await setEnglish(page);
  // Le sélecteur est visible et le choix est mémorisé.
  await page.goto("/cockpit/home", { waitUntil: "commit" });
  await expect(page.locator('button[aria-pressed="true"]', { hasText: /^EN$/ }).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await check(page, "decider-home");
  await page.goto("/cockpit/demos", { waitUntil: "commit" }); await check(page, "decider-demos");
  await page.goto("/cockpit/atelier?demo=supply-stock", { waitUntil: "commit" });
  await expect(page.getByTestId("decision-dialogue")).toBeVisible({ timeout: 60_000 });
  await check(page, "decider-dialogue");
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "detail"));
  await page.reload({ waitUntil: "commit" });
  for (const step of ["comprendre", "impacter", "decider", "suivi"]) {
    await page.getByTestId(`atelier-step-${step}`).first().click({ timeout: 30_000 });
    await check(page, `decider-${step}`);
    for (const tab of await page.getByRole("tab").all()) {
      const name = (await tab.innerText().catch(() => "")).trim();
      if (!name || /Dialogue|Detail/.test(name) || !(await tab.isVisible())) continue;
      await tab.click({ timeout: 5000 }).catch(() => {});
      await check(page, `decider-${step}-${name.replace(/\W+/g, "-")}`);
    }
  }
  // Dialogue depuis une description libre : déductions et questions générées.
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "dialogue"));
  await page.goto("/cockpit/atelier", { waitUntil: "commit" });
  await page.getByRole("button", { name: /New decision/ }).first().click({ timeout: 30_000 });
  await page.getByLabel("Describe the decision").fill("Dual sourcing or safety stock for SUP-003? Above all we want to avoid a stockout at our customers by the end of the quarter, without exceeding the purchasing budget.");
  await page.getByRole("button", { name: "Analyse" }).click();
  await expect(page.getByTestId("deductions")).toBeVisible({ timeout: 60_000 });
  await check(page, "decider-dialogue-free-text");
  // Supply : Studio, cockpit, alerte, décision.
  await page.goto("/cockpit/studio?tab=sources", { waitUntil: "commit" });
  const load = page.getByTestId("supply-demo-load").first();
  await load.waitFor({ timeout: 60_000 });
  // Le bouton est rendu côté serveur avant l'hydratation : on reclique tant que la progression n'apparaît pas.
  await expect(async () => { await load.click({ timeout: 2000 }); await expect(page.getByTestId("supply-demo-launcher").first().locator(".sd-steps")).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await page.getByText(/Demo loaded|Démo chargée/).waitFor({ timeout: 120_000 });
  // Parcours en 4 étapes (exemple Maison Lucie importé) : étapes Cartographier et Connecter.
  await page.goto("/cockpit/studio", { waitUntil: "commit" });
  await expect(async () => { await page.getByTestId("ij-demo").click(); await expect(page.locator(".ij-check")).toBeVisible({ timeout: 2000 }); }).toPass({ timeout: 60_000 });
  await check(page, "supply-studio-journey-1");
  await page.getByRole("button", { name: /Continue/ }).click();
  await check(page, "supply-studio-journey-2");
  for (const tab of ["sources", "vocab", "entities", "mapping", "rules", "ontology", "cockpit"]) { await page.goto(`/cockpit/studio?tab=${tab}`, { waitUntil: "commit" }); if (tab === "rules") await page.getByRole("tab", { name: "Graph" }).click({ timeout: 30_000 }).catch(() => {}); await check(page, `supply-studio-${tab}`); }
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "commit" });
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 30_000 });
  await check(page, "supply-cockpit");
  await page.locator(".ct-alert-card").first().getByRole("button", { name: /Expand/ }).click({ timeout: 10_000 });
  await check(page, "supply-alert-zoom");
  await page.keyboard.press("Escape");
  await page.getByPlaceholder(/Ask Aura/).fill("Why this alert?");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(6000);
  await check(page, "supply-copilot");
  await page.goto("/cockpit/resilience?section=ontologie", { waitUntil: "commit" });
  await check(page, "supply-ontology");
  await page.goto("/cockpit/resilience?section=cockpit", { waitUntil: "commit" });
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => localStorage.setItem("aura-decider-mode", "dialogue"));
  await page.locator(".ct-alert-card").first().getByRole("button", { name: /Decide/ }).click();
  await expect(page.getByTestId("decision-dialogue")).toBeVisible({ timeout: 60_000 });
  await check(page, "supply-decision");
});
