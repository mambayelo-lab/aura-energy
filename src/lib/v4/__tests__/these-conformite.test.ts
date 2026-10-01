/**
 * Conformité du moteur Aura à la thèse de M. Lô (2013), « Contribution à
 * l'évaluation d'architectures en Ingénierie Système : application en
 * conception de systèmes mécatroniques », sur les EXEMPLES NUMÉRIQUES du
 * manuscrit, et preuves d'exhaustivité du backward et d'exactitude du treillis.
 *
 *  · Ch. V §4.2 (fauteuil roulant à assistance électrique, SAF) :
 *    Tableau V-4 (avis d'experts δ⁺_ij / δ⁻_ij des instances d'iDDP sur les
 *    TPM), Tableau V-5 (ASC 495), Tableau V-6 (TPM1, trois jeux de poids) et
 *    Tableau V-7 (remontée TPM → MOP → MOE des ASC 4 et 495), attitude
 *    optimiste (at = 2), équations (1)-(4) et (9) du ch. IV §3.
 *  · Backward exhaustif (extension d'Aura) contre la force brute.
 *  · Treillis d'Arbitrer (plan (δ⁺, δ⁻)) sur toutes les démonstrations.
 */
import { describe, expect, it } from "vitest";
import { aggregateCriterion, aggregateNode, compareASC, fuseImpacts, integraleMaxMin, thesisWeights, type ElementaryImpact } from "../../engine/lo/aggregation";
import type { OrdinalImpact, OrdinalLevel } from "../../engine/lo/types";
import { findMinimalRepairsReport, globalVetoBreaches } from "../goalseek-verify";
import { computeOutcomeLattice, evaluateCombo, lexCompare, paretoDominates } from "../arbitrage-lattice";
import { aggregateHierarchy, importanceToWeight } from "../atelier-compute";
import { rankUnder } from "../arbitrage-analytics";
import { buildDecisionModel, forward, configFromScenario } from "../bora-kernel";
import { newSession, type AtelierSession, type AtelierLevierDef, type AtelierCriterion, type QualitativeImpact } from "../atelier-store";
import { SECTOR_PACKS } from "../packs-sectoriels";
import { enrichDecisionDemoCase } from "../demo-enrichment";
import { DEMO_FACTORIES } from "../atelier-cases";
import { EXHAUSTIVE_LIMIT, searchMinimalRepairs } from "../exhaustive-search";
import { compileEvaluator } from "../space-evaluator";

// ── Exemple SAF (thèse Lô, ch. V §4.2) ─────────────────────────────────────

const L: Record<string, OrdinalLevel> = { "0": 0, N: 0, L: 1, M: 2, H: 3 };
const pair = (s: string): OrdinalImpact => { const [g, d] = s.split(","); return { gPlus: L[g], dMinus: L[d] }; };
/** Cellule de tableau « +M », « -L », « M », « -M », « 0 » ou vide → impact élémentaire. */
const cell = (c: string, j: number): ElementaryImpact =>
  !c || c === "0" ? { leverIndex: j, gPlus: "N", dMinus: "N" }
    : c[0] === "-" ? { leverIndex: j, gPlus: "N", dMinus: c[1] as "L" | "M" | "H" }
      : { leverIndex: j, gPlus: c.replace("+", "") as "L" | "M" | "H", dMinus: "N" };
const opt = (cells: string[]) => aggregateCriterion(cells.map(cell), 2).optimiste;

// Tableau V-4 : lignes = instances d'iDDP (1..18), colonnes TPM11..16, TPM21, TPM22, TPM31..34.
const COLS = ["TPM11", "TPM12", "TPM13", "TPM14", "TPM15", "TPM16", "TPM21", "TPM22", "TPM31", "TPM32", "TPM33", "TPM34"];
const V4: Record<number, string[]> = {
  1: ["+M", "+M", "+M", "+M", "-L", "-L", "-M", "-L", "", "", "-H", "-H"],
  5: ["", "", "", "", "", "+H", "-L", "+L", "-L", "", "-L", ""],
  7: ["", "", "", "", "+L", "+L", "", "", "+L", "-M", "-M", "+L"],
  9: ["", "", "+L", "", "", "+H", "+M", "-L", "-L", "-L", "-H", "-H"],
  11: ["", "", "+M", "", "+L", "+M", "+M", "", "+L", "-H", "-M", "+M"],
  13: ["", "", "+M", "+L", "", "", "+H", "", "", "", "", "+H"],
  15: ["", "", "", "-L", "", "", "", "", "+L", "", "", ""],
  17: ["", "", "", "-M", "", "", "", "", "+L", "", "", ""],
};
const ASC4 = [1, 5, 7, 9, 11, 13, 15, 17]; // alternative n° 4 : [1 5 7 9 11 13 15 17]

// Tableau V-5 : avis sur les TPM de la MOP « Manœuvrabilité » pour l'ASC 495 (8 instances).
const V5 = [
  ["M", "M", "M", "M", "0", "-M"], ["0", "0", "0", "0", "0", "-L"], ["0", "0", "0", "0", "L", "-L"], ["0", "0", "M", "0", "L", "L"],
  ["0", "0", "L", "0", "0", "0"], ["0", "0", "M", "L", "0", "0"], ["M", "M", "M", "L", "0", "L"], ["0", "0", "0", "L", "0", "M"],
];
const w = (s: string) => s.split(" ").map(x => L[x]) as OrdinalLevel[];

describe("Thèse Lô — exemple du SAF, attitude optimiste (Tableaux V-5 à V-7)", () => {
  it("Tableau V-6 : possibilités d'impact des TPM11..16 de l'ASC 495 (équations (3)-(4))", () => {
    const tpm = [0, 1, 2, 3, 4, 5].map(k => opt(V5.map(r => r[k])));
    expect(tpm).toEqual(["M,0", "M,0", "M,0", "M,0", "L,0", "0,M"].map(pair));
    // TPM16 : max δ⁺ = M = max δ⁻ → égalité : la détérioration est retenue (équation (4)).
  });

  it("Tableau V-6 : TPM1 de l'ASC 495 pour les trois jeux de poids (équation (9))", () => {
    const tpm = [0, 1, 2, 3, 4, 5].map(k => opt(V5.map(r => r[k])));
    expect(aggregateNode(tpm, w("H H H H H H"))).toEqual(pair("0,M")); // test n° 1
    expect(aggregateNode(tpm, w("M M L L L H"))).toEqual(pair("0,M")); // test n° 2
    expect(aggregateNode(tpm, w("H M L M M L"))).toEqual(pair("L,L")); // test n° 3
  });

  it("Tableau V-7 : ASC 4 calculée de bout en bout depuis le Tableau V-4 (TPM → MOP → MOE, 3 tests)", () => {
    const tpmOf = (col: string) => opt(ASC4.map(j => V4[j][COLS.indexOf(col)]));
    const T1 = ["TPM11", "TPM12", "TPM13", "TPM14", "TPM15", "TPM16"].map(tpmOf);
    const T2 = ["TPM21", "TPM22"].map(tpmOf);
    const T3 = ["TPM31", "TPM32", "TPM33", "TPM34"].map(tpmOf);
    const tests = [
      { w1: "H H H H H H", w2: "H H", w3: "H H H H", wMop: "H H", wMoe: "H H", TPM1: "0,M", TPM2: "0,L", MOP1: "0,M", MOP2: "0,H", MOE1: "0,H" },
      { w1: "M M L L L H", w2: "L H", w3: "L M M H", wMop: "M L", wMoe: "M H", TPM1: "M,L", TPM2: "0,L", MOP1: "M,L", MOP2: "0,H", MOE1: "0,H" },
      { w1: "H M L M M L", w2: "M L", w3: "L L H M", wMop: "H L", wMoe: "H L", TPM1: "L,M", TPM2: "M,L", MOP1: "L,M", MOP2: "0,H", MOE1: "L,M" },
    ];
    for (const t of tests) {
      const tpm1 = aggregateNode(T1, w(t.w1));
      const tpm2 = aggregateNode(T2, w(t.w2));
      const mop1 = aggregateNode([tpm1, tpm2], w(t.wMop));   // poids [M, L] au test 2 : utilisés TELS QUELS
      const mop2 = aggregateNode(T3, w(t.w3));
      const moe1 = aggregateNode([mop1, mop2], w(t.wMoe));
      expect([tpm1, tpm2, mop1, mop2, moe1]).toEqual([t.TPM1, t.TPM2, t.MOP1, t.MOP2, t.MOE1].map(pair));
    }
  });

  it("Tableau V-7 : ASC 495, remontée MOP → MOE à partir des valeurs publiées (3 tests)", () => {
    const tests = [
      { TPM1: "0,M", TPM2: "L,0", wMop: "H H", MOP1: "0,M", MOP2: "0,M", wMoe: "H H", MOE1: "0,M" },
      { TPM1: "0,M", TPM2: "L,0", wMop: "M L", MOP1: "L,M", MOP2: "L,M", wMoe: "M H", MOE1: "L,M" },
      { TPM1: "L,L", TPM2: "M,0", wMop: "H L", MOP1: "L,L", MOP2: "0,M", wMoe: "H L", MOE1: "L,L" },
    ];
    for (const t of tests) {
      const mop1 = aggregateNode([pair(t.TPM1), pair(t.TPM2)], w(t.wMop));
      expect(mop1).toEqual(pair(t.MOP1));
      expect(aggregateNode([mop1, pair(t.MOP2)], w(t.wMoe))).toEqual(pair(t.MOE1));
    }
  });

  it("une normalisation des poids (max ω = H) contredirait le Tableau V-7 (test 2, MOP1 de l'ASC 4)", () => {
    const tpm1 = pair("M,L"), tpm2 = pair("0,L");
    expect(aggregateNode([tpm1, tpm2], w("M L"))).toEqual(pair("M,L")); // valeur de la thèse
    expect(aggregateNode([tpm1, tpm2], w("H M"))).not.toEqual(pair("M,L")); // poids décalés vers H
    expect(thesisWeights(w("M L"))).toEqual(w("M L"));
    expect(thesisWeights(w("N N"))).toEqual(w("H H")); // aucun poids exprimé → équation (7)
  });
});

describe("Thèse Lô — équations (1)-(4) : règles de fusion", () => {
  it("pessimiste : min des possibilités d'amélioration exprimées ; un iDDP neutre ou dégradant ne l'annule pas", () => {
    expect(fuseImpacts([3, 0], [0, 0], 1)).toEqual({ gPlus: 3, dMinus: 0 });
    expect(fuseImpacts([3, 1, 0], [0, 0, 0], 1)).toEqual({ gPlus: 1, dMinus: 0 });
    expect(fuseImpacts([3, 0], [0, 1], 1)).toEqual({ gPlus: 3, dMinus: 0 }); // min δ⁺ = H > max δ⁻ = L
    expect(fuseImpacts([1, 0], [0, 2], 1)).toEqual({ gPlus: 0, dMinus: 2 });
  });
  it("optimiste : max des possibilités d'amélioration ; égalité → détérioration retenue (équations (2)/(4))", () => {
    expect(fuseImpacts([3, 1], [0, 0], 2)).toEqual({ gPlus: 3, dMinus: 0 });
    expect(fuseImpacts([2, 0], [0, 2], 2)).toEqual({ gPlus: 0, dMinus: 2 });
    expect(fuseImpacts([2, 0], [0, 2], 1)).toEqual({ gPlus: 0, dMinus: 2 });
  });
  it("effet inconnu δ^u (p. 79) : pessimiste → détérioration H ; optimiste → NUL", () => {
    const u: ElementaryImpact = { leverIndex: 0, gPlus: "U", dMinus: "U" };
    const r = aggregateCriterion([u, { leverIndex: 1, gPlus: "M", dMinus: "N" }], 1);
    expect(r.prudent).toEqual({ gPlus: 0, dMinus: 3 });
    expect(r.optimiste).toEqual({ gPlus: 2, dMinus: 0 });
  });
  it("comparaison des ASC (p. 83) : détérioration d'abord, puis amélioration", () => {
    expect(compareASC(pair("L,0"), pair("H,L"))).toBeGreaterThan(0);
    expect(compareASC(pair("H,L"), pair("M,L"))).toBeGreaterThan(0);
    expect(compareASC(pair("0,0"), pair("H,M"))).toBeGreaterThan(0);
    expect(compareASC(pair("M,M"), pair("M,M"))).toBe(0);
  });
  it("équation (9) = agrégations max-min pondérées (p. 77) par rapport aux mesures de nécessité et de possibilité des poids, lorsque max ω = H", () => {
    // Si max ω < H, (9) n'est plus exactement une agrégation max-min pondérée : le gain
    // du parent est minoré par 1 − max ω (c'est le cas du Tableau V-7, test 2).
    const lv: OrdinalLevel[] = [0, 1, 2, 3];
    for (const g1 of lv) for (const g2 of lv) for (const g3 of lv) for (const ws of [[3, 3, 3], [3, 2, 1], [1, 3, 0], [2, 2, 3]] as OrdinalLevel[][]) {
      const ch = [g1, g2, g3].map(g => ({ gPlus: g, dMinus: g }));
      const Pi = (A: number[]) => (A.length ? Math.max(...A.map(i => ws[i])) : 0) as OrdinalLevel;
      const Nec = (A: number[]) => (3 - Pi([0, 1, 2].filter(i => !A.includes(i)))) as OrdinalLevel;
      const r = aggregateNode(ch, ws);
      expect(r.gPlus).toBe(integraleMaxMin([g1, g2, g3], Nec));
      expect(r.dMinus).toBe(integraleMaxMin([g1, g2, g3], Pi));
    }
  });
});

// ── Backward exhaustif (goalseek-verify, utilisé par Arbitrer et « Atteindre un objectif ») ──

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const IMPS: QualitativeImpact[] = ["++", "+", "0", "-", "--", "U"];
const IMPORTANCE = ["Essentiel", "Important", "Secondaire"] as const;

function randomSession(r: () => number): AtelierSession {
  const pick = <T,>(a: readonly T[]) => a[Math.floor(r() * a.length)];
  const leaf = (id: string): AtelierCriterion => ({ id, label: id, importance: pick(IMPORTANCE), level: "TPM" } as AtelierCriterion);
  const criteria: AtelierCriterion[] = [
    { id: "m1", label: "m1", importance: pick(IMPORTANCE), level: "MOE", children: [leaf("t1"), leaf("t2")] } as AtelierCriterion,
    { id: "m2", label: "m2", importance: pick(IMPORTANCE), level: "MOE", children: [leaf("t3"), leaf("t4")] } as AtelierCriterion,
  ];
  const nLev = 2 + Math.floor(r() * 3);
  const leviersDef: AtelierLevierDef[] = Array.from({ length: nLev }, (_, li) => ({
    id: `L${li}`, label: `L${li}`, type: "autre",
    options: Array.from({ length: 2 + Math.floor(r() * 2) }, (_, oi) => {
      const impacts: Record<string, QualitativeImpact> = {};
      for (const t of ["t1", "t2", "t3", "t4"]) if (r() < 0.5) impacts[t] = pick(IMPS);
      return { id: `L${li}o${oi}`, label: `o${oi}`, impacts };
    }),
  } as AtelierLevierDef));
  const base = newSession({ contextRaw: "" });
  const sc = { id: "sc", label: "sc", color: "", description: "", leviers: leviersDef.map(l => ({ id: l.id, label: l.label, valeur: l.options[0].id, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
  return { ...base, criteria, leviersDef, scenarios: [sc], attitude: r() < 0.5 ? "Pessimiste" : "Optimiste" } as AtelierSession;
}

function allCombos(levers: AtelierLevierDef[]): Record<string, string>[] {
  let acc: Record<string, string>[] = [{}];
  for (const l of levers) acc = acc.flatMap(c => l.options.map(o => ({ ...c, [l.id]: o.id })));
  return acc;
}

describe("Backward exhaustif — findMinimalRepairs identique à la force brute (400 modèles aléatoires)", () => {
  it("complétude et minimalité, cible sur un objectif, veto Essentiel globaux", () => {
    const r = rng(7);
    let found = 0, none = 0;
    for (let n = 0; n < 400; n++) {
      const session = randomSession(r);
      const sc = session.scenarios[0];
      const base = Object.fromEntries(session.leviersDef.map(l => [l.id, l.options[Math.floor(r() * l.options.length)].id]));
      const target = { critId: r() < 0.5 ? "m1" : "m2", min: (1 + Math.floor(r() * 3)) as OrdinalLevel };
      const tol = Math.floor(r() * 2) as OrdinalLevel;
      const allObjectives = session.criteria.map(c => ({ id: c.id, label: c.label, importance: c.importance }));
      const evaluate = (combo: Record<string, string>) => evaluateCombo(session, sc, combo);
      const valid = (combo: Record<string, string>) => {
        const ev = evaluate(combo);
        const p = ev.perCrit[target.critId];
        return p.gPlus >= target.min && p.dMinus <= tol && globalVetoBreaches(ev.perCrit, allObjectives).length === 0;
      };
      if (valid(base)) continue;
      const report = findMinimalRepairsReport({ baseCombo: base, leviersDef: session.leviersDef, evaluate, activeTargets: [target], tolerateRisk: tol, allObjectives });
      expect(report.complete).toBe(true);
      const size = (c: Record<string, string>) => Object.keys(c).filter(k => c[k] !== base[k]).length;
      const validAll = allCombos(session.leviersDef).filter(valid);
      const kmin = validAll.length ? Math.min(...validAll.map(size)) : Infinity;
      const brute = new Set(validAll.filter(c => size(c) === kmin).map(c => JSON.stringify(session.leviersDef.map(l => c[l.id]))));
      const got = new Set(report.repairs.map(rep => JSON.stringify(session.leviersDef.map(l => rep.combo[l.id]))));
      expect(got).toEqual(brute);
      for (const rep of report.repairs) expect(rep.changes.length).toBe(kmin);
      if (report.repairs.length) found++; else none++;
    }
    expect(found).toBeGreaterThan(40);
    expect(none).toBeGreaterThan(5);
  });

  it("recherche générique : chaque configuration évaluée au plus une fois, limite signalée", () => {
    const levers = [{ id: "A", optionIds: ["a0", "a1", "a2"] }, { id: "B", optionIds: ["b0", "b1"] }, { id: "C", optionIds: ["c0", "c1", "c2"] }];
    const seen = new Set<string>();
    const res = searchMinimalRepairs({ levers, base: { A: "a0", B: "b0", C: "c0" }, isValid: cfg => { const k = JSON.stringify(cfg); expect(seen.has(k)).toBe(false); seen.add(k); return false; } });
    expect(res).toMatchObject({ complete: true, evaluated: 18, spaceSize: 18, repairs: [] });
    expect(searchMinimalRepairs({ levers, base: { A: "a0", B: "b0", C: "c0" }, isValid: () => false, limit: 4 }).complete).toBe(false);
    expect(EXHAUSTIVE_LIMIT).toBe(1_000_000);
  });
});

// ── Treillis d'Arbitrer sur toutes les démonstrations (Décider et Supply) ──────

function demoSessions(): Array<{ name: string; session: AtelierSession }> {
  const out: Array<{ name: string; session: AtelierSession }> = [];
  for (const p of SECTOR_PACKS) for (const c of p.cases) {
    const k = enrichDecisionDemoCase(c);
    const base = newSession({ contextRaw: k.contextRaw, criteria: k.criteria, scenarios: k.scenarios });
    out.push({ name: `${p.id}/${(c as { key?: string }).key ?? k.title}`, session: { ...base, leviersDef: k.leviersDef, sector: p.sector } as AtelierSession });
  }
  for (const [k, f] of Object.entries(DEMO_FACTORIES)) out.push({ name: `factory/${k}`, session: f(newSession({ contextRaw: "" })) });
  return out;
}

describe("Treillis d'Arbitrer — placement exact des configurations dans le plan (δ⁺, δ⁻)", () => {
  const demos = demoSessions();

  it(`${demos.length} démonstrations × 2 attitudes : comptes par case = forward indépendant (noyau BORA)`, () => {
    for (const { name, session: s0 } of demos) for (const attitude of ["Pessimiste", "Optimiste"] as const) {
      const session = { ...s0, attitude } as AtelierSession;
      if (!session.leviersDef.length || !session.scenarios.length) continue;
      const lattice = computeOutcomeLattice(session, session.scenarios[0]);
      expect(lattice.exhaustive, name).toBe(true);
      // Recalcul indépendant : forward du noyau BORA + remontée au niveau global.
      const model = buildDecisionModel(session);
      const roots = session.criteria;
      const w = roots.map(c => importanceToWeight(c.importance));
      const maxW = Math.max(...w);
      const nw = w.map(x => (maxW < 3 ? Math.min(3, x + 3 - maxW) : x) as OrdinalLevel);
      const grid = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      const gridAny = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
      let best: { gPlus: OrdinalLevel; dMinus: OrdinalLevel } | null = null;
      const clean: Array<{ gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = [];
      for (const combo of allCombos(session.leviersDef)) {
        const f = forward(combo, model);
        const g = aggregateNode(roots.map(c => f.impacts[c.id]), nw);
        gridAny[g.gPlus][g.dMinus]++;
        const veto = roots.some(c => c.importance === "Essentiel" && f.impacts[c.id].dMinus > 0);
        if (veto) continue;
        grid[g.gPlus][g.dMinus]++;
        clean.push(g);
        if (!best || lexCompare(g, best) > 0) best = g;
      }
      expect(lattice.gridAny, name).toEqual(gridAny);
      expect(lattice.grid, name).toEqual(grid);
      expect(gridAny.flat().reduce((a, b) => a + b, 0)).toBe(lattice.totalCombinations);
      expect(lattice.admissible).toBe(grid.flat().reduce((a, b) => a + b, 0));
      if (best) {
        expect(lattice.best!.global, name).toEqual(best);
        // La recommandation (max lexicographique) est non dominée au sens de Pareto (thèse p. 80).
        expect(clean.some(c => paretoDominates(c, lattice.best!.global))).toBe(false);
      }
    }
  }, 120_000);

  it("chaque scénario nommé est placé dans la case de son propre forward, et cette case est non vide", () => {
    for (const { name, session: s0 } of demos) for (const attitude of ["Pessimiste", "Optimiste"] as const) {
      const session = { ...s0, attitude } as AtelierSession;
      if (!session.leviersDef.length || !session.scenarios.length) continue;
      const lattice = computeOutcomeLattice(session, session.scenarios[0]);
      const optionIndex = Object.fromEntries(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o])));
      const at = attitude === "Pessimiste" ? 1 : 2;
      const prof = attitude === "Pessimiste" ? "prudent" : "optimiste";
      // Mêmes « cells » que computeLoResults (cockpit.atelier.tsx) → rankUnder (badges du treillis).
      const cells = Object.fromEntries(session.scenarios.map(sc => [sc.id, Object.fromEntries(session.criteria.map(c => [c.id, aggregateHierarchy(c, sc, optionIndex, at, prof)]))]));
      const ranked = rankUnder(session.scenarios, session.criteria.map(c => ({ id: c.id, label: c.label, weight: importanceToWeight(c.importance) })), cells);
      for (const r of ranked) {
        const sc = session.scenarios.find(x => x.id === r.sc.id)!;
        const full = session.leviersDef.every(l => sc.leviers.some(v => v.id === l.id && l.options.some(o => o.id === v.valeur)));
        const ev = evaluateCombo(session, sc, configFromScenario(sc));
        if (full) {
          expect(r.result, `${name} ${sc.label}`).toEqual(ev.global);
          expect(lattice.gridAny[r.result.gPlus][r.result.dMinus], `${name} ${sc.label}`).toBeGreaterThan(0);
        }
      }
      // Classement des scénarios : ordre lexicographique décroissant (δ⁺ puis δ⁻).
      for (let i = 1; i < ranked.length; i++) expect(lexCompare(ranked[i - 1].result, ranked[i].result)).toBeGreaterThanOrEqual(0);
    }
  }, 120_000);
});

describe("Évaluateur compilé — identique à aggregateHierarchy sur TOUT l'espace de chaque démo et de modèles aléatoires", () => {
  it("toutes les configurations, tous les nœuds, deux attitudes", () => {
    const sessions = [...demoSessions().map(d => d.session)];
    const r = rng(99);
    for (let i = 0; i < 150; i++) sessions.push(randomSession(r));
    let checked = 0;
    for (const s0 of sessions) for (const attitude of ["Pessimiste", "Optimiste"] as const) {
      const session = { ...s0, attitude } as AtelierSession;
      const ev = compileEvaluator(session.criteria, session.leviersDef, attitude);
      const optionIndex = Object.fromEntries(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o])));
      const at = attitude === "Pessimiste" ? 1 : 2;
      const prof = attitude === "Pessimiste" ? "prudent" : "optimiste";
      const nodes: AtelierCriterion[] = [];
      const walk = (c: AtelierCriterion) => { nodes.push(c); c.children?.forEach(walk); };
      session.criteria.forEach(walk);
      const combos = allCombos(session.leviersDef);
      const step = Math.max(1, Math.floor(combos.length / 600));
      for (let k = 0; k < combos.length; k += step) {
        const combo = combos[k];
        const sc = { id: "_", label: "", color: "", description: "", leviers: Object.entries(combo).map(([id, valeur]) => ({ id, label: id, valeur, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
        const got = ev.evaluate(combo);
        for (const n of nodes) {
          const ref = aggregateHierarchy(n, sc, optionIndex, at, prof);
          expect(got.perNode[n.id]).toEqual({ gPlus: ref.gPlus, dMinus: ref.dMinus });
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(5_000); // démos ramenées aux cibles (3 à 5 leviers) : espace plus petit
  }, 180_000);
});
