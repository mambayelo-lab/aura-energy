// Preuves d'exactitude du calcul compact et des programmations dynamiques :
//  1. tables : sur TOUS les cas, identiques à aggregateCriterion / aggregateNode ;
//  2. forward : identique à computeLoResults (démos + instances aléatoires) ;
//  3. espace des combinaisons : effectifs par profil identiques à la force brute ;
//  4. plus petit changement de leviers : même k, même ensemble de solutions
//     (dans le même ordre) que searchMinimalRepairs ;
//  5. plus petit changement de notes et d'importances : même k, même
//     ensemble de solutions que la recherche naïve (rankOptions sur la
//     session modifiée).
import { describe, expect, it } from "vitest";
import { aggregateCriterion, aggregateNode, compareASC } from "../../engine/lo/aggregation";
import type { Attitude, OrdinalLevel } from "../../engine/lo/types";
import { qualImpactToElementary, getLeafCriteria } from "../atelier-compute";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierCriterion, type AtelierSession, type ImportanceBadge, type QualitativeImpact } from "../atelier-store";
import { computeLoResults, rankOptions } from "../decision-express";
import { searchMinimalRepairs } from "../exhaustive-search";
import { cellCode, code, compileTree, evalTree, gOf, dOf, NODE_INIT, scenarioRoots, tables } from "../lo-compact";
import { backwardVars, combosWithProfile, decisionBackward, exploreSpace, minimalLeverMove } from "../lo-search";
import { makeEvaluator, type Combo } from "../solution-space";

const IMPACTS: QualitativeImpact[] = ["++", "+", "+L", "0", "-L", "-", "--", "U"];
const IMPS: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];

// Générateur pseudo-aléatoire reproductible.
function rng(seed: number) { let x = seed >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }; }

describe("tables compactes = moteur de la thèse (tous les cas)", () => {
  for (const at of [1, 2] as Attitude[]) {
    it(`étage 1, attitude ${at} : tous les multisets de 0 à 4 avis`, () => {
      const T = tables(at);
      const profile = at === 1 ? "prudent" : "optimiste";
      const rec = (start: number, cells: QualitativeImpact[]) => {
        const ref = aggregateCriterion((cells.length ? cells : ["0" as QualitativeImpact]).map((c, i) => qualImpactToElementary(c, i)), at)[profile];
        let a = 0;
        for (const c of cells) a = T.accAdd[a * 16 + cellCode(c, at)];
        expect(T.leafFin[a]).toBe(code(ref.gPlus, ref.dMinus));
        if (cells.length < 4) for (let i = start; i < IMPACTS.length; i++) rec(i, [...cells, IMPACTS[i]]);
      };
      rec(0, []);
    });
  }
  it("étage 2 : tous les nœuds de 1 à 3 enfants, tous les poids", () => {
    const T = tables(1);
    const pairs = [...Array(16).keys()];
    let n = 0;
    for (let k = 1; k <= 3; k++) {
      const total = 16 ** k * 4 ** k;
      for (let x = 0; x < total; x++) {
        let r = x;
        const ch: number[] = [], w: OrdinalLevel[] = [];
        for (let i = 0; i < k; i++) { ch.push(pairs[r % 16]); r = Math.floor(r / 16); }
        for (let i = 0; i < k; i++) { w.push((r % 4) as OrdinalLevel); r = Math.floor(r / 4); }
        const ref = aggregateNode(ch.map(c => ({ gPlus: gOf(c) as OrdinalLevel, dMinus: dOf(c) as OrdinalLevel })), w);
        // Poids effectifs : ceux de thesisWeights (tous NUL → H), comme compileTree.
        const we = w.some(v => v > 0) ? w : w.map(() => 3);
        let a = NODE_INIT;
        ch.forEach((c, i) => { a = T.nodeAdd[a * 16 + T.ct[we[i] * 16 + c]]; });
        expect(a).toBe(code(ref.gPlus, ref.dMinus));
        n++;
      }
    }
    expect(n).toBe(64 + 4096 + 262144);
  });
  it("ordre compact = compareASC", () => {
    const T = tables(1);
    for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
      const c = compareASC({ gPlus: gOf(a), dMinus: dOf(a) }, { gPlus: gOf(b), dMinus: dOf(b) });
      expect(Math.sign(T.rank[a] - T.rank[b])).toBe(Math.sign(c));
    }
  });
});

// ── Instances aléatoires ──────────────────────────────────────────────────
export function randomSession(seed: number, size: { leaves?: number; levers?: number; options?: number; scenarios?: number } = {}): AtelierSession {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  let id = 0;
  const crit = (depth: number): AtelierCriterion => {
    const c: AtelierCriterion = { id: `c${id++}`, label: `C${id}`, poids: 50, description: "", importance: pick(IMPS) };
    if (depth < 2 && r() < 0.35) c.children = Array.from({ length: 1 + Math.floor(r() * 2) }, () => crit(depth + 1));
    return c;
  };
  const maxLeaves = size.leaves ?? 3;
  let criteria: AtelierCriterion[] = [];
  do { id = 0; criteria = Array.from({ length: 1 + Math.floor(r() * 3) }, () => crit(1)); } while (getLeafCriteria(criteria).length > maxLeaves);
  const leaves = getLeafCriteria(criteria);
  const nl = size.levers ?? 1 + Math.floor(r() * 2);
  const leviersDef = Array.from({ length: nl }, (_, li) => ({
    id: `l${li}`, label: `L${li}`, type: "decision" as const,
    options: Array.from({ length: size.options ?? 2 + Math.floor(r() * 2) }, (_, oi) => ({
      id: `l${li}o${oi}`, label: `O${li}.${oi}`,
      impacts: Object.fromEntries(leaves.filter(() => r() < 0.8).map(l => [l.id, pick(IMPACTS)])) as Record<string, QualitativeImpact>,
    })),
  }));
  const ns = size.scenarios ?? 2 + Math.floor(r() * 2);
  const scenarios = Array.from({ length: ns }, (_, si) => ({
    id: `s${si}`, label: `S${si}`, color: "#000", description: "", scores: {}, valeur: 0, faisabilite: 0,
    leviers: leviersDef.map(l => ({ id: l.id, label: l.label, type: l.type, valeur: pick(l.options).id })),
  }));
  const s = newSession({ contextRaw: "" });
  return { ...s, criteria, leviersDef, scenarios, attitude: r() < 0.5 ? "Pessimiste" : "Optimiste" } as AtelierSession;
}

const demos = Object.keys(DEMO_FACTORIES).map(k => [k, DEMO_FACTORIES[k](newSession({ contextRaw: "" }))] as const);

function allCombos(s: AtelierSession): Combo[] {
  let acc: Combo[] = [{}];
  for (const l of s.leviersDef) acc = acc.flatMap(c => l.options.map(o => ({ ...c, [l.id]: o.id })));
  return acc;
}

describe("forward compact = computeLoResults", () => {
  it("démos et 1 000 instances aléatoires", () => {
    const check = (s: AtelierSession) => {
      const { nodeResults } = computeLoResults(s);
      const roots = scenarioRoots(s);
      s.scenarios.forEach((sc, i) => expect(roots[i]).toBe(code(nodeResults[sc.id].gPlus, nodeResults[sc.id].dMinus)));
    };
    for (const [, s] of demos) check(s);
    for (let i = 1; i <= 1000; i++) check(randomSession(i, { leaves: 6, levers: 3 }));
  });
  it("evalTree sur les démos : même racine que makeEvaluator", () => {
    for (const [, s] of demos) {
      const at = s.attitude === "Pessimiste" ? 1 : 2, T = tables(at), t = compileTree(s.criteria);
      const ev = makeEvaluator(s);
      for (const c of allCombos(s).slice(0, 300)) {
        const acc = new Uint8Array(t.n);
        for (const lf of t.leaves) for (const l of s.leviersDef) { const imp = l.options.find(o => o.id === c[l.id])!.impacts[t.ids[lf]]; if (imp !== undefined) acc[lf] = T.accAdd[acc[lf] * 16 + cellCode(imp, at)]; }
        const r = ev(c);
        expect(evalTree(t, T, acc)).toBe(code(r.gPlus, r.dMinus));
      }
    }
  });
});

describe("espace des combinaisons : programmation dynamique = force brute", () => {
  it("effectifs exacts par profil, démos + 500 instances aléatoires", () => {
    const check = (s: AtelierSession) => {
      const ev = makeEvaluator(s);
      const brute = new Map<number, number>();
      for (const c of allCombos(s)) { const r = ev(c); const k = code(r.gPlus, r.dMinus); brute.set(k, (brute.get(k) ?? 0) + 1); }
      const sp = exploreSpace(s);
      expect(sp.refused).toBeUndefined();
      expect([...sp.counts].sort()).toEqual([...brute].sort());
      // Reconstruction : chaque combinaison listée a bien le profil demandé.
      for (const [p] of brute) for (const c of combosWithProfile(s, sp, p, 50)) { const r = ev(c); expect(code(r.gPlus, r.dMinus)).toBe(p); }
      // Et elles sont toutes retrouvées quand on ne plafonne pas.
      const [p0, n0] = [...brute][0];
      expect(combosWithProfile(s, sp, p0, 1e9)).toHaveLength(n0);
    };
    for (const [, s] of demos) check(s);
    for (let i = 1; i <= 500; i++) check(randomSession(1000 + i, { leaves: 5, levers: 4, options: 3 }));
  });

  it("plus petit changement de leviers : même k, mêmes solutions, même ordre que searchMinimalRepairs (500 instances)", () => {
    const T = tables(1);
    for (let i = 1; i <= 500; i++) {
      const s = randomSession(5000 + i, { leaves: 5, levers: 4, options: 3 });
      const ev = makeEvaluator(s);
      const from: Combo = Object.fromEntries(s.leviersDef.map(l => [l.id, l.options[Math.floor(l.options.length / 2)].id]));
      const combos = allCombos(s);
      // Cible : un profil pris au hasard parmi ceux de l'espace.
      const r0 = ev(combos[(i * 7) % combos.length]);
      const target = code(r0.gPlus, r0.dMinus);
      const naive = searchMinimalRepairs({
        levers: s.leviersDef.map(l => ({ id: l.id, optionIds: l.options.map(o => o.id) })), base: from,
        isValid: cfg => compareASC(ev(cfg), { gPlus: gOf(target), dMinus: dOf(target) }) >= 0, limit: 1e9,
      });
      const mv = minimalLeverMove(s, from, target);
      if ("refused" in mv) throw new Error(mv.refused);
      expect(mv.k).toBe(naive.minSize);
      if (naive.minSize === 0) { expect(mv.count).toBe(1); continue; }
      expect(mv.count).toBe(naive.repairs.length);
      expect(mv.solutions).toEqual(naive.repairs.map(x => x.config));
      // Forme compacte : exactement les options qui apparaissent dans une solution.
      for (const l of s.leviersDef) expect(new Set(mv.admissible[l.id])).toEqual(new Set(naive.repairs.map(x => x.config[l.id])));
      void T;
    }
  });
});

describe("plus petit changement de notes et d'importances : programmation dynamique = force brute", () => {
  function naive(s: AtelierSession, limit: number) {
    const leader = rankOptions(s)[0];
    const vars = backwardVars(s, getLeafCriteria(s.criteria).map(c => c.id));
    const apply = (cfg: Record<string, string>): AtelierSession => ({
      ...s,
      criteria: s.criteria.map(c => cfg[`i|${c.id}`] !== undefined ? { ...c, importance: cfg[`i|${c.id}`] as ImportanceBadge } : c),
      leviersDef: s.leviersDef.map(l => ({ ...l, options: l.options.map(o => ({ ...o, impacts: { ...o.impacts, ...Object.fromEntries(vars.filter(v => v.optionId === o.id).map(v => [v.criterionId, cfg[v.id] as QualitativeImpact])) } })) })),
    });
    return searchMinimalRepairs({
      levers: vars.map(v => ({ id: v.id, optionIds: v.values })), base: Object.fromEntries(vars.map(v => [v.id, v.base])), limit,
      isValid: cfg => { const r = rankOptions(apply(cfg)); return r[0].id !== leader.id && (r.length < 2 || r[0].rank !== r[1].rank); },
    });
  }
  it("150 instances aléatoires (options partagées entre scénarios, effets inconnus, poids tous NUL)", () => {
    let compared = 0, withSolution = 0;
    for (let i = 1; compared < 150; i++) {
      const s = randomSession(9000 + i, { leaves: 2, levers: 2, options: 2, scenarios: 2 + (i % 2) });
      const n = naive(s, 15_000);
      if (!n.complete) continue;
      const dp = decisionBackward(s)!;
      expect(dp.complete).toBe(true);
      expect(dp.k).toBe(n.minSize);
      expect(dp.count).toBe(n.repairs.length);
      expect(dp.solutions).toEqual(n.repairs.map(r => r.changes));
      compared++;
      if (n.repairs.length) withSolution++;
    }
    expect(withSolution).toBeGreaterThan(40);
  }, 600_000);
});
