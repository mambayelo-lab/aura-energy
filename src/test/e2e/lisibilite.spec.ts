import { test, expect, type Page } from "@playwright/test";

// Lisibilité des schémas et graphiques : police d'au moins 11 px à la taille
// réelle et aucun texte hors de sa forme. Pour chaque <text> SVG, le cadre
// (getBBox, ramené à l'écran) doit tenir dans la forme de son groupe qui
// contient son point d'ancrage ; pour le HTML, aucun texte ne déborde de son
// bloc sans troncature (text-overflow: ellipsis). Nécessite Maison Lucie.
test.skip(!process.env.E2E_LUCIE, "Maison Lucie non disponible pour ce run");
test.use({ viewport: { width: 1440, height: 900 } });

const SHOTS = process.env.LISIBILITE_DIR;

type Issue = string;
async function audit(page: Page, root: string, label: string): Promise<Issue[]> {
  await page.waitForTimeout(400);
  const issues = await page.$$eval(root, (roots, label) => {
    const out: string[] = [];
    const MIN = 11 - 0.05;
    const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && Number(s.opacity) > 0; };
    for (const rootEl of roots) {
      // SVG
      rootEl.querySelectorAll("svg text").forEach(node => {
        const t = node as SVGTextElement;
        if (!visible(t) || !t.textContent?.trim()) return;
        const scale = t.getScreenCTM()?.a ?? 1;
        const size = parseFloat(getComputedStyle(t).fontSize) * scale;
        const name = `${label} · svg « ${t.textContent.trim().slice(0, 40)} »`;
        if (size < MIN) out.push(`${name} : police ${size.toFixed(1)} px`);
        const box = t.getBoundingClientRect();
        // Le texte reste dans le cadre visible de son SVG (sauf SVG à débordement visible).
        const svg = t.ownerSVGElement;
        if (svg && getComputedStyle(svg).overflow !== "visible") {
          const sr = svg.getBoundingClientRect();
          if (box.left < sr.left - 1 || box.right > sr.right + 1 || box.top < sr.top - 1 || box.bottom > sr.bottom + 1) out.push(`${name} : coupé par le cadre du schéma`);
        }
        const parent = t.parentElement;
        const shapes = parent ? [...parent.children].filter(c => c !== t && (c.tagName === "rect" || c.tagName === "circle")) as SVGGraphicsElement[] : [];
        const x0 = box.left + 1, y0 = box.top + box.height / 2;
        const host = shapes.map(s => s.getBoundingClientRect()).filter(r => r.width > 20 && x0 >= r.left && x0 <= r.right && y0 >= r.top && y0 <= r.bottom).sort((a, b) => a.width * a.height - b.width * b.height)[0];
        if (host && (box.left < host.left - 1 || box.right > host.right + 1 || box.top < host.top - 2 || box.bottom > host.bottom + 2)) {
          out.push(`${name} : dépasse sa forme (${Math.round(box.right - host.right)} px à droite)`);
        }
      });
      // HTML
      rootEl.querySelectorAll("*").forEach(el => {
        if (el.closest("svg") || !visible(el)) return;
        const own = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim());
        if (!own) return;
        const s = getComputedStyle(el);
        const name = `${label} · <${el.tagName.toLowerCase()} class="${(el as HTMLElement).className}"> « ${el.textContent!.trim().slice(0, 40)} »`;
        if (parseFloat(s.fontSize) < MIN) out.push(`${name} : police ${s.fontSize}`);
        const h = el as HTMLElement;
        if (h.scrollWidth > h.clientWidth + 1 && s.textOverflow !== "ellipsis" && s.overflowX !== "auto" && s.overflowX !== "scroll" && h.clientWidth > 0) out.push(`${name} : déborde de ${h.scrollWidth - h.clientWidth} px`);
      });
    }
    return out;
  }, label);
  return [...new Set(issues)];
}

async function loadDemo(page: Page) {
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/studio?tab=sources");
  await page.waitForLoadState("networkidle");
  await page.getByTestId("supply-demo-load").click();
  await expect(page.getByText(/Démo chargée/)).toBeVisible({ timeout: 90_000 });
}

test("Supply : schémas et graphiques lisibles", async ({ page }) => {
  test.setTimeout(300_000);
  await loadDemo(page);
  const issues: Issue[] = [];
  const shot = async (name: string) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

  await page.goto("/cockpit/studio?tab=entities");
  await page.waitForLoadState("networkidle");
  const onto = page.getByTestId("ontology-graph");
  await onto.getByRole("button", { name: "Tout déplier" }).click();
  await onto.scrollIntoViewIfNeeded();
  issues.push(...await audit(page, "[data-testid=ontology-graph]", "Ontologie"));
  await shot("ontologie");

  await page.goto("/cockpit/studio?tab=mapping");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Lignage" }).click();
  await page.getByRole("button", { name: "Déplier les tables" }).click();
  issues.push(...await audit(page, "[data-testid=lineage]", "Lignage"));
  await page.getByTestId("lineage").scrollIntoViewIfNeeded();
  await shot("lignage");

  await page.goto("/cockpit/studio?tab=rules");
  await page.waitForLoadState("networkidle");
  await page.getByRole("tab", { name: "Graphe" }).click();
  await page.getByTestId("causal-graph").scrollIntoViewIfNeeded();
  issues.push(...await audit(page, "[data-testid=causal-graph]", "Graphe causal"));
  await shot("graphe-causal");

  await page.goto("/cockpit/resilience?section=cockpit");
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 30_000 });
  issues.push(...await audit(page, ".ct-alert-card", "Cartes du cockpit"));
  await shot("cockpit");
  await page.locator(".ct-alert-card", { hasText: "Prévision de demande" }).getByRole("button", { name: /Agrandir l'alerte/ }).click();
  issues.push(...await audit(page, ".ct-alert-zoom", "Détail d'alerte et chaîne"));
  await shot("chaine-causalite");
  await page.keyboard.press("Escape");

  const input = page.getByPlaceholder("Poser une question à Aura…");
  for (const q of ["Compare les fournisseurs sur le risque de capacité", "Quelle est la tendance de l'écart de prévision par semaine ?", "Quelle est la répartition des stocks sur la couverture ?"]) {
    const n = await page.locator(".cp-panel .cp-turn").count();
    await input.fill(q);
    await page.keyboard.press("Enter");
    await expect(page.locator(".cp-panel .cp-turn")).toHaveCount(n + 1, { timeout: 60_000 });
  }
  await page.locator(".cp-panel .aura-chart").first().scrollIntoViewIfNeeded();
  issues.push(...await audit(page, ".cp-panel .aura-chart", "Graphiques du copilote"));
  await shot("copilote-graphiques");

  expect(issues, issues.join("\n")).toEqual([]);
});

// Plusieurs démos pour afficher tous les visuels de Décider : treillis,
// radar, cartes d'arbitrage, dossier d'exigences (conception complexe)…
for (const demo of ["supply-stock", "telereleve", "energie-reseau", "retail-omnicanal", "demo-genai-make-or-buy", "renouv-flexibilite"]) {
  test(`Décider : visuels lisibles (${demo})`, async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto(`/cockpit/atelier?demo=${demo}`);
    await page.waitForLoadState("networkidle");
    await page.getByTestId("atelier-step-decider").waitFor({ timeout: 60_000 });
    const issues: Issue[] = [];
    for (const step of ["comprendre", "impacter", "composer", "decider", "suivi"]) {
      const tab = page.getByTestId(`atelier-step-${step}`);
      if (!(await tab.count())) continue;
      await tab.click();
      await page.waitForTimeout(1200);
      issues.push(...await audit(page, "body svg, .am-lattice-card", `Décider ${demo} · ${step}`));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/decider-${demo}-${step}.png`, fullPage: true });
    }
    const req = page.getByRole("button", { name: /Dossier d'exigences/ });
    if (await req.count()) {
      await req.first().click();
      await page.waitForTimeout(800);
      issues.push(...await audit(page, "body svg", `Décider ${demo} · exigences`));
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/decider-${demo}-exigences.png`, fullPage: true });
    }
    expect(issues, issues.join("\n")).toEqual([]);
  });
}
