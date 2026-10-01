// « Décider vite » : déductions sur des énoncés réalistes, questions de
// complétude posées seulement si elles changent le classement, correction
// libre, et même modèle que le mode Détail.
import { describe, expect, it } from "vitest";
import { newSession, type AtelierSession } from "../atelier-store";
import { rankOptions } from "../decision-express";
import { getLeafCriteria } from "../atelier-compute";
import { TARGETS, pickTemplate } from "../decision-templates";
import { seedFromAlert } from "../decision-express";
import { decisionBackward } from "../lo-search";
import { applyCorrection, applyDeduction, completenessChecklist, completenessQuestions, deduceFromDescription } from "../decision-dialogue";

const CASES = [
  {
    name: "supply", template: "supply",
    text: "Double source ou stock de sécurité pour SUP-003 ? Le fournisseur est en Chine et le risque géopolitique monte. Nous voulons surtout éviter une rupture chez nos clients d'ici la fin du trimestre, sans dépasser le budget achats.",
    options: ["Double source", "Stock de sécurité"], criteria: ["Réduire le risque", "Coût maîtrisé", "Qualité de service"], essentiel: "Réduire le risque", essentielTpm: "Probabilité de rupture", attitude: "Pessimiste", horizon: /fin du trimestre/, contrainte: /sans dépasser/,
  },
  {
    name: "investissement", template: "investissement",
    text: "Faut-il acheter une nouvelle ligne de production ou louer une ligne existante ? Le coût est avant tout la priorité, la trésorerie est tendue. Il faut aussi pouvoir démarrer rapidement.",
    options: ["Acheter une nouvelle ligne de production", "Louer une ligne existante"], criteria: ["Coût maîtrisé", "Effet rapide"], essentiel: "Coût maîtrisé", essentielTpm: "Investissement initial", attitude: "Pessimiste",
  },
  {
    name: "stratégie", template: "strategie",
    text: "Acquisition d'un concurrent, alliance commerciale ou croissance interne ? L'objectif : doubler notre part de marché. Nous sommes prêts à oser, la croissance compte plus que tout.",
    options: ["Acquisition d'un concurrent", "Alliance commerciale", "Croissance interne"], criteria: ["Croissance"], essentiel: "Croissance", essentielTpm: "Part de marché", attitude: "Optimiste",
  },
  {
    name: "choix de solution", template: "solution",
    text: "SAP ou Salesforce pour notre nouveau CRM ? L'équipe est petite, la simplicité de mise en oeuvre est essentielle, et la qualité de service client aussi.",
    options: ["SAP", "Salesforce"], criteria: ["Faisabilité", "Qualité de service"], essentiel: "Faisabilité", essentielTpm: "Simplicité d'usage", attitude: "Pessimiste",
  },
  {
    name: "logistique", template: "logistique",
    text: "Rerouter par avion ou attendre le prochain navire ? Le délai compte plus que le coût, les clients attendent sous 2 semaines.",
    options: ["Rerouter par avion", "Attendre le prochain navire"], criteria: ["Effet rapide", "Coût maîtrisé"], essentiel: "Effet rapide", essentielTpm: "Délai de livraison", attitude: "Pessimiste", horizon: /sous 2 semaines/,
  },
];

function build(text: string): AtelierSession {
  const s = newSession({ contextRaw: "" });
  return { ...s, ...applyDeduction(s, deduceFromDescription(text), text) };
}

/** Cibles d'une décision réaliste : 3 à 5 leviers, 2 à 4 options, 5 à 8 TPM sous 2 ou 3 MOP et 1 ou 2 MOE. */
export function expectRealisticSize(s: AtelierSession) {
  const leaves = getLeafCriteria(s.criteria);
  const mops = s.criteria.flatMap(m => m.children ?? []).filter(c => c.children?.length);
  expect(s.leviersDef.length).toBeGreaterThanOrEqual(TARGETS.levers[0]);
  expect(s.leviersDef.length).toBeLessThanOrEqual(TARGETS.levers[1]);
  for (const l of s.leviersDef) { expect(l.options.length).toBeGreaterThanOrEqual(TARGETS.options[0]); expect(l.options.length).toBeLessThanOrEqual(TARGETS.options[1]); }
  expect(leaves.length).toBeGreaterThanOrEqual(TARGETS.tpm[0]);
  expect(leaves.length).toBeLessThanOrEqual(TARGETS.tpm[1]);
  expect(mops.length).toBeGreaterThanOrEqual(TARGETS.mop[0]);
  expect(mops.length).toBeLessThanOrEqual(TARGETS.mop[1]);
  expect(s.criteria.length).toBeGreaterThanOrEqual(TARGETS.moe[0]);
  expect(s.criteria.length).toBeLessThanOrEqual(TARGETS.moe[1]);
  // Aucun élément en double.
  expect(new Set(leaves.map(c => c.label)).size).toBe(leaves.length);
  for (const l of s.leviersDef) expect(new Set(l.options.map(o => o.label)).size).toBe(l.options.length);
}

describe("déductions sur des énoncés réalistes", () => {
  for (const c of CASES) {
    it(`${c.name} : options, critères, poids, attitude, contexte ; taille réaliste ; au plus 3 questions utiles`, () => {
      const d = deduceFromDescription(c.text);
      expect(d.proposal.options).toEqual(c.options);
      const labels = d.proposal.criteria.map(x => x.label);
      for (const k of c.criteria) expect(labels).toContain(k);
      if (c.essentiel) expect(d.proposal.criteria.find(x => x.label === c.essentiel)?.importance).toBe("Essentiel");
      expect(d.attitude).toBe(c.attitude);
      if (c.horizon) expect(d.horizon).toMatch(c.horizon);
      if (c.contrainte) expect(d.contraintes.join(" ")).toMatch(c.contrainte);
      for (const x of d.deductions) expect(x.source.length).toBeGreaterThan(0);
      const s = build(c.text);
      expectRealisticSize(s);
      expect(pickTemplate(c.text).id.split("-")[0]).toBe(c.template); // « supply-stock » : gabarit spécialisé
      // L'insistance de la description se retrouve sur l'indicateur du métier.
      expect(getLeafCriteria(s.criteria).find(x => x.label === c.essentielTpm)?.importance).toBe("Essentiel");
      // Levier principal = options de la question ; tous les effets restent « à confirmer ».
      expect(s.leviersDef[0].options.map(o => o.label)).toEqual(c.options);
      expect(s.leviersDef.every(l => l.options.every(o => Object.keys(o.impactOrigins ?? {}).length === getLeafCriteria(s.criteria).length))).toBe(true);
      const qs = completenessQuestions(s, rankOptions);
      expect(qs.length).toBeLessThanOrEqual(3);
      for (const q of qs.filter(x => x.choices.length)) expect(new Set(q.choices.map(ch => rankOptions({ ...s, ...ch.patch })[0].id)).size).toBeGreaterThan(1);
      expect(completenessChecklist(s).map(x => x.label)).toEqual(["Objectif", "Options", "Critères et poids", "Leviers", "Niveaux d'impact", "Attitude face au risque", "Contraintes", "Horizon", "Parties prenantes"]);
      // Le moteur tient la taille sans peine : plus petit changement exact.
      const t = performance.now();
      const b = decisionBackward(s)!;
      const ms = performance.now() - t;
      expect(b.complete).toBe(true);
      process.stderr.write(`\nTAILLE ${c.name}: ${s.leviersDef.length} leviers, ${getLeafCriteria(s.criteria).length} TPM, ${qs.length} question(s), backward exact k=${b.k} (${b.count} solutions) en ${ms.toFixed(0)} ms\n`);
    });
  }
});

describe("correction libre et modèle partagé", () => {
  it("« A compte plus que B », « ajoute l'option … », « X améliore beaucoup Y »", () => {
    let s = build(CASES[1].text);
    const r1 = applyCorrection(s, "le coût d'exploitation compte plus que le délai de disponibilité")!;
    expect(r1).not.toBeNull();
    s = { ...s, ...r1.patch };
    const leaf = (l: string) => getLeafCriteria(s.criteria).find(c => c.label === l)!;
    expect(leaf("Coût d'exploitation").importance).toBe("Essentiel");
    const r2 = applyCorrection(s, "ajoute l'option location longue durée")!;
    s = { ...s, ...r2.patch };
    expect(s.scenarios.map(x => x.label)).toContain("Location longue durée");
    const r3 = applyCorrection(s, "Louer une ligne existante améliore beaucoup le délai de disponibilité")!;
    s = { ...s, ...r3.patch };
    const o = s.leviersDef[0].options.find(x => x.label === "Louer une ligne existante")!;
    const c = leaf("Délai de disponibilité");
    expect(o.impacts[c.id]).toBe("++");
    expect(o.impactOrigins?.[c.id]).toBeUndefined();
    expect(applyCorrection(s, "blablabla")).toBeNull();
    // Même modèle que le mode Détail : un scénario par option du levier principal.
    expect(s.scenarios).toHaveLength(s.leviersDef[0].options.length);
    expect(rankOptions(s).length).toBe(s.scenarios.length);
  });
});

describe("pré-remplissage depuis une alerte Supply", () => {
  it("taille réaliste, indicateur de l'alerte en tête, options de la règle", () => {
    const seed = seedFromAlert({ id: "S1", kpiLabel: "Risque de capacité fournisseur", options: ["Accélérer les commandes (expedite)", "Double sourcing", "Stock tampon"] });
    const s = { ...newSession({ contextRaw: "" }), ...seed };
    expectRealisticSize(s);
    expect(getLeafCriteria(s.criteria)[0].label).toBe("Réduire : Risque de capacité fournisseur");
  });
});

describe("garde-fou : le LLM ne calcule jamais", () => {
  it("une proposition qui contient un gagnant ou un classement est rejetée", async () => {
    const { sanitizeProposal } = await import("../decision-dialogue");
    const base = { options: ["A", "B"], criteria: [{ label: "Coût", importance: "Important" as const }], impacts: { A: { Coût: "+" as const }, B: { Coût: "-" as const } } };
    expect(sanitizeProposal(base, "A ou B ?")).not.toBeNull();
    expect(sanitizeProposal({ ...base, winner: "B" } as never, "A ou B ?")).toBeNull();
    expect(sanitizeProposal({ ...base, classement: ["B", "A"] } as never, "A ou B ?")).toBeNull();
  });
  it("un modèle LLM sous les minimums (leviers, options, indicateurs) est écarté : repli sur le modèle déterministe", async () => {
    const { sanitizeProposal } = await import("../decision-dialogue");
    const base = { options: ["A", "B"], criteria: [{ label: "Coût", importance: "Important" as const }], impacts: {} };
    const ind = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `Indicateur ${String.fromCharCode(97 + i)}`, why: "compte" }));
    const lev = (label: string, n: number) => ({ label, options: Array.from({ length: n }, (_, i) => ({ label: `${label} option ${String.fromCharCode(97 + i)}`, why: "fait" })) });
    const ok = { objectifs: [{ label: "Servir", criteres: [{ label: "Service", indicateurs: ind(3) }, { label: "Coût", indicateurs: ind(3) }] }], leviers: [lev("Stock", 2), lev("Transport", 3)] };
    expect(sanitizeProposal({ ...base, modele: ok } as never, "A ou B ?")?.modele).toBeDefined();
    expect(sanitizeProposal({ ...base, modele: { ...ok, leviers: [lev("Stock", 2), lev("Transport", 1)] } } as never, "A ou B ?")?.modele).toBeUndefined();
    expect(sanitizeProposal({ ...base, modele: { ...ok, objectifs: [{ label: "Servir", criteres: [{ label: "Service", indicateurs: ind(2) }, { label: "Coût", indicateurs: ind(2) }] }] } } as never, "A ou B ?")?.modele).toBeUndefined();
  });
  it("un texte qui désigne une autre option que celle du moteur est détecté", async () => {
    const { contradictsEngine } = await import("../decision-dialogue");
    expect(contradictsEngine("Le fournisseur local est clairement le meilleur choix.", "Fournisseur asiatique", ["Fournisseur local", "Fournisseur asiatique"])).toBe(true);
    expect(contradictsEngine("Le fournisseur asiatique arrive en tête.", "Fournisseur asiatique", ["Fournisseur local", "Fournisseur asiatique"])).toBe(false);
  });
});

describe("garde-fou des copilotes", () => {
  it("remplace une réponse qui contredit le classement du moteur", async () => {
    const { setActiveRanking, guardAgainstEngine } = await import("../active-report");
    setActiveRanking({ winner: "Stock tampon", options: ["Stock tampon", "Double sourcing"] });
    expect((await guardAgainstEngine("Le double sourcing est la meilleure option ici.")).rejected).toBe(true);
    expect((await guardAgainstEngine("Le stock tampon reste en tête.")).rejected).toBe(false);
    setActiveRanking(undefined);
    expect((await guardAgainstEngine("Le double sourcing est la meilleure option.")).rejected).toBe(false);
  });
});

describe("démos : taille réaliste", () => {
  it("chaque démo tient les cibles et le moteur calcule vite", async () => {
    const { DEMO_FACTORIES } = await import("../atelier-cases");
    for (const k of Object.keys(DEMO_FACTORIES)) {
      const s = DEMO_FACTORIES[k](newSession({ contextRaw: "" }));
      expectRealisticSize(s);
      const t = performance.now(); const b = decisionBackward(s)!; const ms = performance.now() - t;
      expect(b.complete).toBe(true);
      process.stderr.write(`\nTAILLE démo ${k}: ${s.leviersDef.length} leviers, ${getLeafCriteria(s.criteria).length} TPM, backward exact k=${b.k} (${b.count} solutions) en ${ms.toFixed(0)} ms\n`);
    }
  }, 120_000);
});

describe("réponses riches (mode rapide et pré-remplissage)", () => {
  const digitsIn = (t: string) => t.match(/\d+/g) ?? [];
  for (const c of CASES) {
    it(`${c.name} : enjeu, sens des indicateurs, rôle des options, raisons des effets, risques ; aucun chiffre inventé`, () => {
      const d = deduceFromDescription(c.text);
      const enjeu = d.deductions.find(x => x.field === "enjeu")!;
      expect(enjeu.hypothesis).toBe(true);
      for (const o of c.options) expect(enjeu.value).toContain(o);
      const s = build(c.text);
      const leaves = getLeafCriteria(s.criteria);
      for (const l of leaves) expect(l.description!.length).toBeGreaterThan(15);
      for (const n of s.criteria) expect(n.description).toMatch(/^Objectif/);
      for (const l of s.leviersDef) for (const o of l.options) expect(o.justification!.length).toBeGreaterThan(8);
      const main = s.leviersDef[0];
      const withEffect = main.options.flatMap(o => leaves.filter(x => (o.impacts[x.id] ?? "0") !== "0").map(x => o.impactReasons?.[x.id]));
      // Sans indice métier sur une option (ex. deux éditeurs), les effets restent à préciser : aucun n'est inventé.
      if (c.name !== "choix de solution") expect(withEffect.length).toBeGreaterThan(0);
      for (const r of withEffect) expect(r).toBeTruthy();
      expect(s.elicitation?.risques?.length).toBeGreaterThanOrEqual(2);
      // Garde-fou : tout chiffre affiché figure dans l'énoncé.
      const rich = [enjeu.value, ...leaves.map(l => l.description ?? ""), ...s.leviersDef.flatMap(l => l.options.flatMap(o => [o.justification ?? "", ...Object.values(o.impactReasons ?? {})])), ...(s.elicitation?.risques ?? [])].join(" ");
      for (const n of digitsIn(rich)) expect(c.text).toContain(n);
      // Cartes de choix expliquées et réponse pré-remplie.
      for (const q of completenessQuestions(s, rankOptions)) if (q.choices.length) { expect(q.choices.every(ch => ch.hint)).toBe(true); expect(q.suggestion).toBeTruthy(); }
    });
  }
  it("pré-remplissage depuis une alerte Supply : justifications et risques", () => {
    const seed = seedFromAlert({ id: "S1", kpiLabel: "Risque de capacité fournisseur", options: ["Double sourcing", "Stock tampon", "Attendre et surveiller"] });
    expect(getLeafCriteria(seed.criteria)[0].description).toMatch(/Indicateur de l'alerte/);
    expect(seed.leviersDef.every(l => l.options.every(o => o.justification))).toBe(true);
    expect(seed.risques.length).toBeGreaterThanOrEqual(2);
  });
  it("sortie structurée du LLM validée : un champ riche avec un chiffre inventé est écarté", async () => {
    const { sanitizeProposal } = await import("../decision-dialogue");
    const p = sanitizeProposal({ options: ["A", "B"], criteria: [{ label: "Coût", importance: "Important" }], impacts: {}, enjeu: "Choisir A ou B pour réduire le coût.", optionWhy: { A: "Réduit le coût de 30 %", B: "Mutualise les achats." }, risques: ["Surcoût de 2 M€", "Dépendance fournisseur"] } as never, "A ou B ?")!;
    expect(p.enjeu).toBe("Choisir A ou B pour réduire le coût.");
    expect(p.optionWhy).toEqual({ B: "Mutualise les achats." });
    expect(p.risques).toEqual(["Dépendance fournisseur"]);
  });
});
