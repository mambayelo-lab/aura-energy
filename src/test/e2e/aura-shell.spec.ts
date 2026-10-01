import { test, expect } from "@playwright/test";

const routes = ["/", "/cockpit/home", "/cockpit/atelier", "/cockpit/demos", "/cockpit/resilience?section=cockpit", "/cockpit/studio", "/aura"];

for (const route of routes) {
  test(`navigation ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("domcontentloaded");
    await expect(page.locator("body")).toBeVisible();
    await expect(page.locator("body")).not.toContainText("Cette page ne s'est pas chargée correctement");
  });
}

test("le shell reste lisible quand le dialogue est replié", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/cockpit/atelier");
  const rail = page.locator(".aura-nav-sidebar");
  await expect(rail).toBeVisible();
  const main = page.locator(".v4-main");
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBeTruthy();
  await page.locator(".aura-nav-collapse").click();
  expect(await main.evaluate(el => el.scrollWidth <= el.clientWidth + 2)).toBeTruthy();
});

test("aucun accès V2 ne subsiste", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/cockpit\/home/);
  await expect(page.locator('a[href="/v2"]')).toHaveCount(0);
});

test("Arbitrer s'hydrate sans divergence React", async ({ page }) => {
  const hydrationErrors: string[] = [];
  page.on("console", message => {
    if (message.type() === "error" && /React error #418|Hydration/i.test(message.text())) hydrationErrors.push(message.text());
  });
  await page.goto("/cockpit/atelier");
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(800);
  expect(hydrationErrors).toEqual([]);
});

test("Studio est l'unique entrée Supply Chain de connexion, modélisation, mapping et publication", async ({ page }) => {
  await page.goto("/cockpit/studio?tab=sources");
  await expect(page.getByRole("heading", { name: "Studio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Connecter une application" })).toBeVisible();
  await page.waitForLoadState("load");
  const phases = page.getByRole("navigation", { name: "Phases du Studio" });
  const pages: [string, string[]][] = [
    ["Connecter", ["Sources", "Métadonnées & échantillons"]],
    ["Modéliser", ["Indicateurs & seuils", "Objets métier"]],
    ["Mapper", ["Mapping"]],
    ["Raisonner", ["Règles & alertes", "Ontologie vivante"]],
    ["Publier", ["Vers le cockpit"]],
  ];
  for (const [phase, labels] of pages) {
    await expect(async () => {
      await phases.getByRole("button", { name: new RegExp(phase) }).click();
      await expect(page.getByRole("navigation", { name: "Pages de la phase" }).getByRole("button", { name: labels[0], exact: true })).toBeVisible({ timeout: 1000 });
    }).toPass();
    for (const label of labels) await expect(page.getByRole("navigation", { name: "Pages de la phase" }).getByRole("button", { name: label, exact: true })).toBeVisible();
  }
  await phases.getByRole("button", { name: /Mapper/ }).click();
  // Mapper : la couverture par objet est la vue principale ; plus d'onglet Capabilities.
  await expect(page.getByRole("heading", { name: "Couverture du mapping" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Capabilities", exact: true })).toHaveCount(0);
});

test("les applications sont étanches : aucun lien d'une application vers une autre", async ({ page }) => {
  const decide = ["/cockpit/home", "/cockpit/atelier", "/cockpit/demos"];
  const supply = ["/cockpit/resilience?section=cockpit", "/cockpit/studio"];
  const forbidden: Record<string, RegExp> = {
    decide: /^\/cockpit\/(resilience|studio)/,
    supply: /^\/cockpit\/(home|atelier|demos)(\b|\?|$)/,
  };
  for (const [app, routes] of Object.entries({ decide, supply })) {
    for (const route of routes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const hrefs = await page.locator("a[href]").evaluateAll(links => links.map(link => link.getAttribute("href") ?? ""));
      const leaks = hrefs.filter(href => forbidden[app].test(href));
      expect(leaks, `${route} renvoie vers une autre application`).toEqual([]);
    }
  }
});

test("le nouveau logo Aura s'affiche dans les shells visibles", async ({ page }) => {
  await page.goto("/cockpit/home");
  const logo = page.locator(".aura-brand-lockup").first();
  await expect(logo).toBeVisible();
  const artwork = logo.locator('img[src="/aura-wordmark.png"]');
  await expect(artwork).toBeVisible();
  const box = await logo.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThanOrEqual(90);
});

const responsiveRoutes = [
  "/cockpit/home",
  "/cockpit/demos",
  "/cockpit/studio",
  "/cockpit/resilience?section=cockpit",
];

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 820, height: 1180 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
]) {
  test(`gabarits sans débordement — ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const route of responsiveRoutes) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      const overflow = await page.locator("body").evaluate(el => el.scrollWidth - el.clientWidth);
      expect(overflow, `${route} déborde de ${overflow}px`).toBeLessThanOrEqual(2);
    }
  });
}

test("un seul déclencheur de copilote par écran", async ({ page }) => {
  for (const route of ["/cockpit/home", "/cockpit/atelier", "/cockpit/demos", "/cockpit/studio"]) {
    await page.goto(route);
    expect(await page.locator(".aura-copilot-trigger").count()).toBeLessThanOrEqual(1);
    await expect(page.getByRole("button", { name: "Parler à Aura" })).toHaveCount(0);
  }
});

test("la même typographie Lexend (texte) + Sora (titres), aérée, pour les deux applications", async ({ page }) => {
  for (const route of ["/cockpit/atelier", "/cockpit/resilience?section=cockpit", "/cockpit/studio"]) {
    await page.goto(route);
    const fonts = await page.locator("html").evaluate(el => {
      const root = getComputedStyle(el);
      const body = getComputedStyle(document.body);
      return { body: body.fontFamily, display: root.getPropertyValue("--font-display"), size: parseFloat(body.fontSize), lh: parseFloat(body.lineHeight) / parseFloat(body.fontSize), ls: parseFloat(body.letterSpacing) || 0 };
    });
    expect(fonts.body, route).toMatch(/^"?Lexend/);
    expect(fonts.size, route).toBeGreaterThanOrEqual(14);
    expect(fonts.lh, route).toBeGreaterThanOrEqual(1.5);
    expect(fonts.ls, route).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.fonts.check('16px "Lexend Variable"')), route).toBe(true);
    expect(fonts.display, route).toMatch(/Sora/);
  }
});

test("la bibliothèque Décider ne montre que des packs exploitables", async ({ page }) => {
  await page.goto("/cockpit/demos");
  await expect(page.getByRole("button", { name: "Communauté" })).toHaveCount(0);
  await expect(page.getByText("Modernisation de la télérelève")).toBeVisible();
  await expect(page.getByText(/indicateurs · .* leviers · .* options/).first()).toBeVisible();
});

test("un pack enrichi traverse Comprendre, Impacter, Explorer / Résultat et Suivre", async ({ page }) => {
  await page.goto("/cockpit/atelier?demo=supply-stock");
  await expect(page).toHaveURL(/sessionId=/, { timeout: 30_000 });

  const model = await page.evaluate(() => {
    const sessions = JSON.parse(localStorage.getItem("aura-v4-atelier-sessions") ?? "[]");
    return sessions[0];
  });
  // Pack ramené aux cibles des cas illustratifs (voir cas-illustratifs.test.ts) : 3 à 5 leviers de 2 à 4 options.
  expect(model.leviersDef.length).toBeGreaterThanOrEqual(3);
  expect(model.leviersDef.length).toBeLessThanOrEqual(5);
  expect(model.leviersDef.flatMap((lever: { options: unknown[] }) => lever.options).length).toBeGreaterThanOrEqual(6);
  const leverIds = new Set(model.leviersDef.map((lever: { id: string }) => lever.id));
  expect(model.scenarios.length).toBeGreaterThanOrEqual(2);
  expect(model.scenarios.every((scenario: { leviers: Array<{ id: string }> }) => scenario.leviers.length > 0 && scenario.leviers.every(lever => leverIds.has(lever.id)))).toBe(true);
  const leverLabel: string = model.leviersDef[0].label;
  expect(model.elicitation.leviersDDP).toContain(leverLabel);
  const objective: string = model.criteria[0].label;

  const currentStep = () => page.evaluate(() => JSON.parse(localStorage.getItem("aura-v4-atelier-sessions") ?? "[]")[0]?.step);

  // Le pack peut rouvrir sur la dernière étape persistée : le test force explicitement le parcours.
  await page.getByTestId("atelier-step-comprendre").click();
  await expect.poll(currentStep).toBe("comprendre");

  await page.getByTestId("atelier-step-impacter").click();
  await expect.poll(currentStep).toBe("impacter");
  // Matrice par défaut (comme avant), arbre à un clic.
  await expect(page.getByText(leverLabel).first()).toBeVisible();
  await page.getByRole("tab", { name: "Arbre" }).click();
  await expect(page.getByTestId("impact-tree")).toContainText(leverLabel);
  await page.getByRole("tab", { name: "Scénarios" }).click();
  await expect(page.getByText("Composer les scénarios")).toBeVisible();

  await page.getByTestId("atelier-step-decider").click();
  await expect.poll(currentStep).toBe("decider");
  await expect(page.getByRole("button", { name: /Évaluer/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Expliquer/ }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Tester", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Par dimension").first()).toBeVisible();

  await page.getByTestId("atelier-step-suivi").click();
  await expect.poll(currentStep).toBe("suivi");
  await page.getByRole("tab", { name: "Tableau de bord" }).click();
  await expect(page.getByText("Tableau de bord · Suivi OKR")).toBeVisible();
  // Le tableau de bord reprend les objectifs du modèle (O1…) et leurs résultats clés.
  await expect(page.getByText(objective, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("KR1.1").first()).toBeVisible();
});


