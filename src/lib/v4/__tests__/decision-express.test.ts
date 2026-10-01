// Parcours court de Décider : classement et plus petit changement calculés par
// le moteur Bora, pré-remplissage depuis une alerte Supply, suivi et revue.
import { describe, expect, it } from "vitest";
import { getLeafCriteria } from "../atelier-compute";
import { compareASC } from "../../engine/lo/aggregation";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierSession } from "../atelier-store";
import {
  applyBackward, backwardSentence, backwardSmallestChange, computeLoResults, gapText, isSingleLever, krProgress, krStatus, needsReview, rankOptions, seedFromAlert, setImpact,
  type DecisionFollowUp,
} from "../decision-express";

const demo = (k: string) => DEMO_FACTORIES[k](newSession({ contextRaw: "" }));
const fromAlert = (): AtelierSession => {
  const seed = seedFromAlert({ id: "S1", kpiLabel: "Risque de capacité fournisseur", options: ["Accélérer les commandes (expedite)", "Double sourcing", "Stock tampon", "Attendre et surveiller"] });
  return { ...newSession({ contextRaw: "" }), ...seed, step: "impacter" };
};

describe("classement", () => {
  it("même ordre que le moteur (comparaison lexicographique bipolaire)", () => {
    const s = demo("telereleve");
    const { nodeResults } = computeLoResults(s);
    const r = rankOptions(s);
    expect(r).toHaveLength(s.scenarios.length);
    for (let i = 1; i < r.length; i++) expect(compareASC(nodeResults[r[i - 1].id], nodeResults[r[i].id])).toBeGreaterThanOrEqual(0);
    expect(r[0].rank).toBe(1);
  });
});

describe("depuis une alerte Supply", () => {
  it("options de la règle et critères de l'alerte, hypothèses marquées « à confirmer » ; résultat immédiat", () => {
    const s = fromAlert();
    expect(isSingleLever(s)).toBe(false);
    const leaves = getLeafCriteria(s.criteria);
    expect(leaves[0].label).toBe("Réduire : Risque de capacité fournisseur");
    expect(leaves[0].importance).toBe("Essentiel");
    expect(s.leviersDef[0].options.map(o => o.label)).toEqual(["Accélérer les commandes (expedite)", "Double sourcing", "Stock tampon", "Attendre et surveiller"]);
    expect(s.leviersDef.every(l => l.options.every(o => Object.keys(o.impactOrigins ?? {}).length === leaves.length))).toBe(true);
    const r = rankOptions(s);
    expect(r[0].label).not.toBe("Attendre et surveiller");
    expect(r.at(-1)!.label).toBe("Attendre et surveiller");
  });

  it("corriger une case retire la mention d'hypothèse", () => {
    const s = fromAlert();
    const o = s.leviersDef[0].options[1];
    const cout = getLeafCriteria(s.criteria).find(c => c.label === "Coût d'achat unitaire")!.id;
    const next = { ...s, ...setImpact(s, o.id, cout, "--") };
    const o2 = next.leviersDef[0].options[1];
    expect(o2.impacts[cout]).toBe("--");
    expect(o2.impactOrigins?.[cout]).toBeUndefined();
  });

});

// Force brute indépendante (sans searchMinimalRepairs) : toutes les
// modifications d'UNE variable (importance d'un critère ou note d'une option
// utilisée sur un critère feuille), jugées par le même classement moteur.
const NOTES = ["--", "-", "0", "+", "++"] as const;
const IMPS = ["Faible", "Secondaire", "Important", "Essentiel"] as const;
function singleChangeWinners(s: AtelierSession): Set<string> {
  const leader = rankOptions(s)[0].id;
  const out = new Set<string>();
  const check = (t: AtelierSession, key: string) => { const r = rankOptions(t); if (r[0].id !== leader && (r.length < 2 || r[0].rank !== r[1].rank)) out.add(key); };
  for (const c of s.criteria) for (const v of IMPS) if (v !== c.importance) check({ ...s, criteria: s.criteria.map(x => x.id === c.id ? { ...x, importance: v } : x) }, `i|${c.id}`);
  const used = new Set(s.scenarios.flatMap(sc => sc.leviers.map(l => l.valeur)));
  const leaves = (cs: AtelierSession["criteria"]): AtelierSession["criteria"] => cs.flatMap(c => c.children?.length ? leaves(c.children) : [c]);
  for (const l of s.leviersDef) for (const o of l.options) if (used.has(o.id)) for (const c of leaves(s.criteria)) for (const v of NOTES) {
    if (v === (o.impacts[c.id] ?? "0")) continue;
    check({ ...s, ...setImpact(s, o.id, c.id, v) }, `n|${o.id}|${c.id}`);
  }
  return out;
}

describe("plus petit changement : backward strict", () => {
  const cases: [string, () => AtelierSession][] = [
    ...["telereleve"].map(k => [k, () => demo(k)] as [string, () => AtelierSession]),
    ["alerte Supply", fromAlert],
  ];
  for (const [name, make] of cases) {
    it(`${name} : changement minimal vérifié par le moteur et identique à la force brute`, () => {
      const s = make();
      const b = backwardSmallestChange(s)!;
      const brute = singleChangeWinners(s);
      expect(b.found).toBe(true);
      // Minimalité : un changement d'une seule variable existe ssi la recherche en trouve un de taille 1.
      expect(b.minSize === 1).toBe(brute.size > 0);
      if (b.minSize === 1) expect(brute.has(b.changes[0].kind === "importance" ? `i|${b.changes[0].criterionId}` : `n|${b.changes[0].optionId}|${b.changes[0].criterionId}`)).toBe(true);
      // Le moteur confirme : appliquer le changement met bien « winner » en tête.
      const after = rankOptions({ ...s, ...applyBackward(s, b.changes) });
      expect(after[0].id).toBe(b.winnerId);
      expect(b.winnerId).not.toBe(rankOptions(s)[0].id);
      expect(backwardSentence(b)).toMatch(/^Si .* devient premier à la place de/);
      expect(b.evaluated).toBeLessThanOrEqual(1_000_000);
    });
  }

  it("robuste : aucune variable modifiable, étendue explorée indiquée", () => {
    const s = fromAlert();
    // Budget de recherche réduit à la seule évaluation de départ.
    const b = backwardSmallestChange(s, { limit: 1 })!;
    expect(b.found).toBe(false);
    expect(b.complete).toBe(false);
    expect(backwardSentence(b)).toMatch(/^Robuste .*\(1 évaluation du moteur sur un espace de .* limite de recherche/);
  });

  it("classement : moteur Bora, attitude pessimiste par défaut", () => {
    expect(fromAlert().attitude).toBe("Pessimiste");
  });

  it("gapText lisible", () => {
    const r = rankOptions(fromAlert());
    expect(gapText(r[0], r[1])).toMatch(/^(Devance|À égalité)/);
  });
});

describe("suivre", () => {
  const f: DecisionFollowUp = {
    scenarioId: "a", label: "Double sourcing", decidedAt: "2026-09-01T00:00:00Z", reviewDate: "2026-10-01",
    keyResults: [{ id: "k", label: "Risque de capacité · SUP-001", unit: "score/100", start: 88, target: 60, current: 74, deadline: "2026-10-01", owner: "Achats" }],
  };
  it("avancement et statut selon le temps écoulé", () => {
    expect(krProgress(f.keyResults[0])).toBe(0.5);
    expect(krStatus(f.keyResults[0], f.decidedAt, Date.parse("2026-09-05"))).toBe("en avance");
    expect(krStatus(f.keyResults[0], f.decidedAt, Date.parse("2026-09-16"))).toBe("à l'heure");
    expect(krStatus(f.keyResults[0], f.decidedAt, Date.parse("2026-09-29"))).toBe("en retard");
  });
  it("« réviser la décision ? » si l'effet s'inverse ou si la revue échoit en retard", () => {
    expect(needsReview(f, Date.parse("2026-09-10"))).toBeNull();
    expect(needsReview({ ...f, keyResults: [{ ...f.keyResults[0], current: 92 }] }, Date.parse("2026-09-10"))).toMatch(/s'éloigne de sa cible/);
    expect(needsReview(f, Date.parse("2026-10-02"))).toMatch(/Revue échue/);
  });
});
