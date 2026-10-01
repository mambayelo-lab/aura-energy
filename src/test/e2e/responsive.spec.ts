import { test, expect, type Page } from "@playwright/test";

// Responsive des deux applications (Décider, Supply) et des pages
// communes, aux six largeurs de référence : pas de défilement horizontal de la
// page, menu accessible (tiroir « Menu » sous 768 px, rail latéral au-delà),
// aucune cible interactive visible de moins de 32 px de haut.

const WIDTHS = [360, 390, 768, 1024, 1280, 1440];
test.describe.configure({ mode: "serial" });

type Visit = { name: string; url: string; then?: (page: Page) => Promise<void> };
const step = (id: string) => async (page: Page) => {
  await page.getByTestId(id).first().click({ timeout: 30_000 });
  await page.waitForTimeout(600);
};
const VISITS: Visit[] = [
  { name: "Décider · accueil", url: "/cockpit/home" },
  { name: "Décider · démos", url: "/cockpit/demos" },
  { name: "Décider · Comprendre (démo)", url: "/cockpit/atelier?demo=supply-stock", then: async page => { await step("atelier-step-comprendre")(page); await expect(page.getByTestId("comprendre-arbre")).toBeVisible({ timeout: 30_000 }); } },
  { name: "Décider · Arbitrer (démo)", url: "/cockpit/atelier?demo=supply-stock", then: async page => { await step("atelier-step-decider")(page); await expect(page.locator(".am-lattice-card")).toBeVisible({ timeout: 30_000 }); } },
  { name: "Supply · cockpit (démo)", url: "/cockpit/resilience?section=cockpit" },
  { name: "Supply · décision", url: "/cockpit/resilience?section=decision" },
  { name: "Supply · Studio", url: "/cockpit/studio" },
  { name: "Compte · équipe", url: "/cockpit/comptes" },
  { name: "Administration", url: "/cockpit/admin-plateforme" },
];

let demoStorage: Record<string, string> = {};
let demoLoaded = false;

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("dialog", d => d.accept());
  await page.goto("/cockpit/studio?tab=sources");
  // Le script d'un Web Worker de calcul reste « en cours » pour Playwright : networkidle peut ne jamais venir.
  await page.getByTestId("supply-demo-load").first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("supply-demo-load").first().click();
  await expect(page.getByText(/Démo chargée|n’est pas joignable/)).toBeVisible({ timeout: 90_000 });
  demoLoaded = await page.getByText(/Démo chargée/).isVisible();
  demoStorage = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => /vocab|argus/i.test(k)).map(k => [k, localStorage.getItem(k) ?? ""])));
  await page.close();
});

async function audit(page: Page, label: string) {
  const r = await page.evaluate(() => {
    const de = document.documentElement;
    const main = document.querySelector<HTMLElement>(".v4-main");
    const overflow = Math.max(de.scrollWidth - de.clientWidth, main ? main.scrollWidth - main.clientWidth : 0);
    const vw = de.clientWidth, vh = window.innerHeight;
    const small: string[] = [];
    const sel = "button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]";
    for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
      if (el.closest("[aria-hidden=true],.aura-nav-sidebar:not(.drawer-open)")) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) continue;
      if (el.tagName === "A" && cs.display === "inline") continue; // lien dans le texte
      const box = (el as HTMLInputElement).type === "checkbox" || (el as HTMLInputElement).type === "radio" ? (el.closest("label") ?? el) : el;
      const rc = box.getBoundingClientRect();
      if (!rc.width || !rc.height || rc.bottom <= 0 || rc.top >= vh || rc.right <= 0 || rc.left >= vw) continue;
      if (rc.height < 32) small.push(`${el.tagName.toLowerCase()} « ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)} » ${Math.round(rc.height)}px`);
    }
    return { overflow, small };
  });
  expect(r.overflow, `${label} : défilement horizontal de ${r.overflow}px`).toBeLessThanOrEqual(1);
  expect(r.small, `${label} : cibles < 32 px`).toEqual([]);
}

async function checkMenu(page: Page, width: number, label: string) {
  if (width < 768) {
    const open = page.getByRole("button", { name: "Ouvrir le menu" }).first();
    await expect(open, `${label} : bouton Menu`).toBeVisible();
    await open.click();
    const nav = page.locator(".aura-nav-sidebar.drawer-open .aura-nav-main a").first();
    await expect(nav, `${label} : tiroir ouvert`).toBeVisible();
    await audit(page, `${label} (menu ouvert)`);
    await page.getByRole("button", { name: "Fermer le menu" }).click();
    await expect(page.locator(".aura-nav-sidebar.drawer-open")).toHaveCount(0);
  } else {
    await expect(page.locator(".aura-nav-sidebar .aura-nav-main a").first(), `${label} : navigation latérale`).toBeVisible();
  }
}

for (const width of WIDTHS) {
  test(`responsive ${width}px — Décider, Supply, pages communes`, async ({ page }) => {
    test.setTimeout(240_000);
    page.on("dialog", d => d.accept());
    await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
    await page.goto("/cockpit/home");
    await page.evaluate(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, demoStorage);
    for (const v of VISITS) {
      const label = `${v.name} @${width}`;
      await page.goto(v.url);
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      if (v.then) await v.then(page);
      if (v.name.startsWith("Supply · cockpit") && demoLoaded) await expect(page.locator(".ct-alert-card").first()).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(300);
      await audit(page, label);
      if (v.name === "Décider · accueil" || v.name.startsWith("Supply · cockpit")) await checkMenu(page, width, label);
    }
  });
}
