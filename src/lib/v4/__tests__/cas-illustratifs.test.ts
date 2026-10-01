// Cas illustratifs : toutes les démos, les exemples stratégiques (Décider vite, sans modèle de langage)
// et les pré-remplissages depuis une alerte tiennent les cibles : 3 à 5 leviers, 2 à 4 options,
// 5 à 8 TPM, 2 à 3 MOP, 1 à 2 MOE.
import { describe, it } from "vitest";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierSession } from "../atelier-store";
import { SECTOR_PACKS, findSectorCase } from "../packs-sectoriels";
import { enrichDecisionDemoCase } from "../demo-enrichment";
import { applyDeduction, deduceFromDescription } from "../decision-dialogue";
import { seedFromAlert } from "../decision-express";
import { STRATEGIC_EXAMPLES } from "../strategic-examples";
import { ALERT_CATALOGUE } from "../alert-catalogue";
import { SUPPLY_PROFILES } from "../supply-profiles";
import { expectRealisticSize } from "./decision-dialogue.test";

const demos: [string, AtelierSession][] = Object.keys(DEMO_FACTORIES).map(k => [k, DEMO_FACTORIES[k](newSession({ contextRaw: "" }))]);
for (const p of SECTOR_PACKS) for (const c of (p as { cases?: { key: string }[] }).cases ?? []) {
  const f = findSectorCase(c.key); if (!f) continue;
  const k = enrichDecisionDemoCase(f.c);
  demos.push([c.key, { ...newSession({ contextRaw: "" }), criteria: k.criteria, scenarios: k.scenarios, leviersDef: k.leviersDef ?? [] }]);
}
const fromText = (t: string) => { const s = newSession({ contextRaw: "" }); return { ...s, ...applyDeduction(s, deduceFromDescription(t), t) } as AtelierSession; };
const fromAlert = (id: string, label: string, kpi: string, options: string[]) => { const seed = seedFromAlert({ id, alertLabel: label, kpiLabel: kpi, options }); return { ...newSession({ contextRaw: "", alertId: id, alertLabel: label }), ...seed } as AtelierSession; };

describe("cas illustratifs : taille réaliste", () => {
  for (const [k, s] of demos) it(`démo ${k}`, () => expectRealisticSize(s));
  for (const e of STRATEGIC_EXAMPLES) it(`exemple ${e.secteur} · ${e.titre}`, () => expectRealisticSize(fromText(e.question)));
  for (const a of ALERT_CATALOGUE) it(`alerte ${a.id} · ${a.label}`, () => expectRealisticSize(fromAlert(a.id, a.label, a.label, a.options.slice(0, 4))));
  for (const p of SUPPLY_PROFILES) it(`profil ${p.id} (alerte ${p.alertIds[0]})`, () => expectRealisticSize(fromAlert(p.alertIds[0], p.label, p.label, p.levers[0].options.map(o => o.label).slice(0, 3))));
});

import { expect } from "vitest";
import { DETROITS, DETROIT_PESTEL, detroitPreset, estRouteAsieEurope } from "../cas-detroits";
import { buildDemoElicitation } from "../demo-enrichment";
import { supplyProfileFor } from "../supply-profiles";

describe("cas détroit maritime : trois formes", () => {
  it("PESTEL : chaque fait a une source, une URL et une date", () => {
    expect(DETROIT_PESTEL.length).toBeGreaterThanOrEqual(5);
    for (const f of DETROIT_PESTEL) { expect(f.url).toMatch(/^https:\/\//); expect(f.date).toMatch(/\d{4}/); expect(f.source.length).toBeGreaterThan(3); }
    expect(DETROITS.contextRaw).toMatch(/Scénario illustratif/);
  });
  it("Décider autonome : cas illustré sans données, dans le pack Supply", () => expect(findSectorCase("supply-detroits")).toBeTruthy());
  it("Supply sans alerte : évaluation prédéfinie à l'étape Comprendre, PESTEL rempli", () => {
    const s = detroitPreset(newSession({ contextRaw: "" }), enrichDecisionDemoCase, buildDemoElicitation);
    expect(s.step).toBe("comprendre"); expect(s.alertId).toBeFalsy();
    expect(Object.keys(s.elicitation?.pestelAnswers ?? {}).length).toBeGreaterThanOrEqual(4);
    expectRealisticSize(s);
  });
  it("Supply avec alerte : un retard Asie → Europe ouvre le profil détroit", () => {
    const id = "INT-RETARD-ASIE-FRN-0000100003", label = "Retards sur la route Asie → Europe : Shenzhen (83 % des expéditions)";
    expect(supplyProfileFor(id, label)?.id).toBe("detroit");
    const s = fromAlert(id, label, label, ["Reroutage par le cap de Bonne-Espérance", "Bascule mer-air sur les références critiques", "Attendre la réouverture de la route Suez"]);
    expect(s.leviersDef.map(l => l.label).join(" ")).toMatch(/Mode de transport|Sourcing/);
    expectRealisticSize(s);
  });
  it("trajet Asie → Europe reconnu (Maison Lucie : Shenzhen → Paris), pas les autres", () => {
    expect(estRouteAsieEurope("Expédition SHP-883 — AsiaBridge (Shenzhen → Paris)")).toBe(true);
    expect(estRouteAsieEurope("Milan → Paris")).toBe(false);
  });
});

import { PANDEMIE, PANDEMIE_PESTEL, pandemiePreset } from "../cas-pandemie";
describe("cas pandémie : trois formes", () => {
  it("PESTEL : chaque fait a une source, une URL et une date ; scénario illustratif", () => {
    expect(PANDEMIE_PESTEL.length).toBeGreaterThanOrEqual(5);
    for (const f of PANDEMIE_PESTEL) { expect(f.url).toMatch(/^https:\/\//); expect(f.date).toMatch(/\d{4}/); }
    expect(PANDEMIE.contextRaw).toMatch(/Scénario illustratif/);
  });
  it("Décider autonome : cas illustré dans le pack Supply", () => expect(findSectorCase("supply-pandemie")).toBeTruthy());
  it("Supply sans alerte : évaluation prédéfinie à l'étape Comprendre", () => {
    const s = pandemiePreset(newSession({ contextRaw: "" }), enrichDecisionDemoCase, buildDemoElicitation);
    expect(s.step).toBe("comprendre"); expect(s.alertId).toBeFalsy();
    expect(Object.keys(s.elicitation?.pestelAnswers ?? {}).length).toBeGreaterThanOrEqual(4);
    expectRealisticSize(s);
  });
  it("Supply avec alerte : le signal sanitaire ouvre le profil pandémie", () => {
    const s = fromAlert("RES-PANDEMIE", "Pic de demande et commandes amplifiées", "Jours de rupture", ["Double sourcing dans une autre région", "Stock tampon là où TTR > TTS", "Plafonnement et allocation des commandes"]);
    expect(s.leviersDef.map(l => l.label).join(" ")).toMatch(/Pilotage de la demande|Équipes/);
    expectRealisticSize(s);
  });
});
