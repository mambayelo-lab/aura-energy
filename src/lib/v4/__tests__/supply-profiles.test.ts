import { describe, expect, it } from "vitest";
import { seedFromAlert } from "../decision-express";
import { getLeafCriteria } from "../atelier-compute";
import { SUPPLY_PROFILES, supplyProfileFor } from "../supply-profiles";
import { pickTemplate } from "../decision-templates";
import { RESILIENCE_RULES } from "../supply-derived";
import { OPTIONS_NOEUD, OPTIONS_PANDEMIE } from "../resilience-tts";
import { ALERT_NEEDS } from "../alert-data-matrix";

// Chaque type d'alerte Supply (Studio S1 à S15, couche d'intégration INT-*) reçoit une
// proposition riche et propre à la situation.
const ALERTS: [string, string, string][] = [
  ["S1", "Risque de rupture fournisseur", "appro"], ["S2", "Couverture de stock sous seuil", "stock"], ["S3", "Surstock ou obsolescence", "stock"],
  ["S4", "Retard transport critique", "transport"], ["S5", "Dégradation OTIF/qualité fournisseur", "appro"], ["S6", "Prévision de demande en dérive", "prevision"],
  ["S7", "Capacité insuffisante", "capacite"], ["S8", "Marge menacée par coûts supply", "marge"], ["S9", "Risque géopolitique/pays", "geo"],
  ["S10", "Défaillance d'un nœud logistique", "transport"], ["S11", "Allocation sous pénurie", "appro"], ["S12", "Changement produit/nomenclature à risque", "produit"],
  ["S13", "Donnée supply incohérente", "donnees"], ["S14", "Configuration réseau sous-optimale", "reseau"], ["S15", "Risque de transformation SI Supply", "si"],
  ["INT-RUPTURE", "Ruptures de stock : 72 positions sous le stock de sécurité", "stock"], ["INT-RETARD-FRN-0000100003", "Retards fournisseur : Shenzhen (83 % des expéditions)", "transport"],
  ["INT-RETARD-ASIE-FRN-0000100003", "Retards sur la route Asie → Europe : Shenzhen (83 % des expéditions)", "detroit"],
  ["INT-RISQUE-FRN-0000100003", "Risque fournisseur : Shenzhen — 1 article en rupture", "appro"], ["INT-ECART", "Écarts entre sources : 3 valeurs différentes du maître", "donnees"],
];

/** Minimums de la proposition préremplie : 3–5 leviers, 2–4 options, 5–8 TPM, 2–3 MOP, 1–2 MOE. */
function expectRich(s: ReturnType<typeof seedFromAlert>) {
  expect(s.leviersDef.length).toBeGreaterThanOrEqual(3); expect(s.leviersDef.length).toBeLessThanOrEqual(5);
  for (const l of s.leviersDef) { expect(l.options.length, l.label).toBeGreaterThanOrEqual(2); expect(l.options.length, l.label).toBeLessThanOrEqual(4); }
  const leaves = getLeafCriteria(s.criteria);
  expect(leaves.length).toBeGreaterThanOrEqual(5); expect(leaves.length).toBeLessThanOrEqual(8);
  expect(s.criteria.length).toBeGreaterThanOrEqual(1); expect(s.criteria.length).toBeLessThanOrEqual(2);
  const mops = s.criteria.flatMap(c => c.children ?? []);
  expect(mops.length).toBeGreaterThanOrEqual(2); expect(mops.length).toBeLessThanOrEqual(3);
}

describe("catalogue unique : chaque alerte de résilience a sa proposition riche, avec ses vraies options", () => {
  const cases: [string, string, string[]][] = [
    ...RESILIENCE_RULES.map(r => [r.id, r.label, r.options] as [string, string, string[]]),
    ["RES-TTS-ML-0000097", "Nœud critique : Article 97 tient 127 j, il en faut 138", OPTIONS_NOEUD],
    ["RES-PANDEMIE", "Pic de demande et commandes amplifiées", OPTIONS_PANDEMIE],
  ];
  for (const [id, label, options] of cases) it(`${id} · ${label}`, () => {
    expect(supplyProfileFor(id, label), id).toBeTruthy();
    expectRich(seedFromAlert({ id, alertLabel: label, kpiLabel: "indicateur de l'alerte", options }));
  });
  it("toutes les alertes de la matrice alerte × données ont un profil", () => {
    for (const n of ALERT_NEEDS) expect(supplyProfileFor(n.id, n.label), n.id).toBeTruthy();
  });
});

describe("propositions par type d'alerte Supply", () => {
  for (const [id, label, profile] of ALERTS) {
    it(`${id} · ${label}`, () => {
      expect(supplyProfileFor(id, label)?.id).toBe(profile);
      const s = seedFromAlert({ id, alertLabel: label, kpiLabel: "indicateur de l'alerte", options: ["Option A de l'alerte", "Option B de l'alerte", "Option C de l'alerte"] });
      expect(s.leviersDef.length).toBeGreaterThanOrEqual(3); expect(s.leviersDef.length).toBeLessThanOrEqual(5);
      for (const l of s.leviersDef) { expect(l.options.length).toBeGreaterThanOrEqual(2); expect(l.options.length).toBeLessThanOrEqual(4); }
      const leaves = getLeafCriteria(s.criteria);
      expect(leaves.length).toBeGreaterThanOrEqual(5); expect(leaves.length).toBeLessThanOrEqual(8);
      const mops = s.criteria.flatMap(c => c.children ?? []);
      expect(s.criteria.length).toBeGreaterThanOrEqual(1); expect(s.criteria.length).toBeLessThanOrEqual(2);
      expect(mops.length).toBeGreaterThanOrEqual(2); expect(mops.length).toBeLessThanOrEqual(3);
      // Justifications, raisons des effets et risques.
      for (const l of s.leviersDef.slice(1)) for (const o of l.options) {
        expect(o.justification?.length).toBeGreaterThan(5);
        for (const [cid, v] of Object.entries(o.impacts)) if (v !== "0") expect(o.impactReasons?.[cid], `${o.label}`).toBeTruthy();
      }
      expect(leaves.every(c => (c.description ?? "").length > 10)).toBe(true);
      expect(s.risques.length).toBeGreaterThanOrEqual(3);
      // Leviers propres à la situation.
      const p = SUPPLY_PROFILES.find(x => x.id === profile)!;
      expect(s.leviersDef.map(l => l.label)).toEqual(expect.arrayContaining(p.levers.map(l => l.label)));
    });
  }
  it("Décider vite : la question choisit le profil (transport, prévision, données)", () => {
    expect(pickTemplate("Retard transport sur l'axe Asie : passer en aérien ou attendre ?").id).toBe("logistique"); // gabarit Logistique dédié
    expect(pickTemplate("La prévision de demande dérive avant la promotion, que faire en S&OP ?").id).toBe("supply-prevision");
    expect(pickTemplate("Écart entre sources sur le pays fournisseur : quelle donnée maître retenir ?").id).toBe("supply-donnees");
  });
});

describe("décisions stratégiques (hors alertes) : modèles pré-remplis riches", () => {
  it("chaque décision a sa proposition dans les cibles et des faits honnêtes sans données", async () => {
    const { STRATEGIC_DECISIONS } = await import("../strategic-decisions");
    expect(STRATEGIC_DECISIONS.length).toBe(9);
    for (const d of STRATEGIC_DECISIONS) {
      expect(supplyProfileFor(d.id, d.titre)?.alertIds, d.id).toContain(d.id);
      const s = seedFromAlert({ id: d.id, alertLabel: d.titre, kpiLabel: d.indicateur, options: d.options });
      expectRich(s);
      expect(s.risques.length).toBeGreaterThanOrEqual(3);
      expect(d.faits(undefined).join(" ")).toMatch(/pas de moteur d'optimisation/);
    }
  });
  it("les décisions stratégiques ne captent aucune question de Décider vite", () => {
    expect(supplyProfileFor(undefined, "Faut-il ouvrir un hub régional ou un 3PL ?")?.id).not.toMatch(/^strat-/);
  });
});

describe("traçabilité : chaque levier et chaque indicateur découle de l'alerte", () => {
  it("levier principal = options de la règle causale ; autres leviers et indicateurs = profil rattaché à l'alerte ou gabarit ; rien en double", async () => {
    const { maisonLucieVocab } = await import("../argus-vocab-store");
    const { TEMPLATES } = await import("../decision-templates");
    const { STRATEGIC_DECISIONS } = await import("../strategic-decisions");
    const rules = maisonLucieVocab().causalRules;
    const base = new Set(TEMPLATES.find(t => t.id === "supply")!.moes.flatMap(m => m.mops.flatMap(p => p.tpms.map(t => t.label))));
    const cases: { id: string; label: string; kpi: string; options: string[] }[] = [
      ...rules.filter(r => /^S\d+$/.test(r.id)).map(r => ({ id: r.id, label: r.label, kpi: r.label, options: r.options ?? [] })),
      ...RESILIENCE_RULES.map(r => ({ id: r.id, label: r.label, kpi: r.kpi.label, options: r.options })),
      { id: "RES-TTS-X", label: "Nœud critique", kpi: "Écart TTR − TTS", options: OPTIONS_NOEUD },
      { id: "RES-PANDEMIE", label: "Crise sanitaire", kpi: "Amplification des commandes", options: OPTIONS_PANDEMIE },
      ...STRATEGIC_DECISIONS.map(d => ({ id: d.id, label: d.titre, kpi: d.indicateur, options: d.options })),
    ];
    expect(cases.length).toBe(15 + 17 + 2 + 9);
    for (const c of cases) {
      const p = supplyProfileFor(c.id, c.label)!;
      expect(p.alertIds.some(a => c.id === a || c.id.startsWith(`${a}-`)), `${c.id} rattaché à ${p.id} par identifiant`).toBe(true);
      const s = seedFromAlert({ id: c.id, alertLabel: c.label, kpiLabel: c.kpi, options: c.options });
      expectRich(s);
      expect(s.leviersDef[0].options.map(o => o.label), c.id).toEqual(c.options.slice(0, 4));
      const levers = new Set(p.levers.map(l => l.label));
      for (const l of s.leviersDef.slice(1)) expect(levers.has(l.label), `${c.id} · levier ${l.label}`).toBe(true);
      const opts = s.leviersDef.flatMap(l => l.options.map(o => o.label.toLowerCase()));
      expect(new Set(opts).size, `${c.id} options en double`).toBe(opts.length);
      const leaves = getLeafCriteria(s.criteria).map(x => x.label);
      expect(leaves[0], c.id).toBe(`Réduire : ${c.kpi}`);
      const allowed = new Set([...base, ...p.tpms.map(t => t.label)]);
      for (const t of leaves.slice(1)) expect(allowed.has(t), `${c.id} · indicateur ${t}`).toBe(true);
      expect(new Set(leaves).size, `${c.id} indicateurs en double`).toBe(leaves.length);
    }
  });
});
