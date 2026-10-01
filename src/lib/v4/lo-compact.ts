// Calcul compact et exact du forward de la thèse Lô (2013, ch. IV §3) et des
// recherches exhaustives qui s'appuient dessus (espace des solutions, plus
// petit changement). Aucune formule nouvelle : les tables ci-dessous sont
// REMPLIES en appelant le moteur (fuseImpacts, résolution de l'effet inconnu,
// ordNeg/ordMin/ordMax, compareASC) et les tests vérifient, sur tous les cas
// possibles, qu'elles redonnent aggregateCriterion et aggregateNode.
//
// Représentation : un couple (δ⁺, δ⁻) de niveaux {NUL, L, M, H} tient sur
// 4 bits (δ⁺·4 + δ⁻) : 16 états. Les deux étages de la thèse sont des
// replis min/max, donc des monoïdes :
//  · étage 1, éq. (1)-(4) : l'accumulateur d'une feuille est
//    (min ou max des δ⁺_ij exprimés, max des δ⁻_ij) — 16 états — et la
//    feuille vaut fuseImpacts appliqué à cet accumulateur ;
//  · étage 2, éq. (9) et (7) : l'accumulateur d'un nœud est
//    (min_i max(1−ω_i, δ⁺_i), max_i min(ω_i, δ⁻_i)) — 16 états.
// Toute l'évaluation devient une suite de lectures dans des tables de
// 256 octets (Uint8Array), sans allocation.
//
// Programmation dynamique (runDP) : les variables (leviers, ou notes et
// importances) sont traitées une à une ; l'état est le vecteur des
// accumulateurs encore ouverts (feuilles et nœuds dont tous les enfants ne
// sont pas encore connus). Deux chemins qui mènent au même vecteur ont le
// même avenir : on les fusionne en gardant le nombre de combinaisons, le
// coût minimal (nombre de changements) et le nombre de façons de l'atteindre.
// C'est exact (aucun échantillonnage) ; si le nombre d'états dépasse le
// budget, le calcul s'arrête et le dit.
import { compareASC, fuseImpacts, thesisWeights } from "../engine/lo/aggregation";
import { ordMax, ordMin, ordNeg, resolveUBipolar } from "../engine/lo/ordinal";
import type { Attitude, OrdinalLevel } from "../engine/lo/types";
import { importanceToWeight, qualImpactToElementary } from "./atelier-compute";
import type { AtelierCriterion, AtelierSession, ImportanceBadge, QualitativeImpact } from "./atelier-store";

export const code = (g: number, d: number) => g * 4 + d;
export const gOf = (c: number) => c >> 2;
export const dOf = (c: number) => c & 3;
export const NODE_INIT = code(3, 0); // neutre du repli (min sur δ⁺, max sur δ⁻)

export interface Tables {
  at: Attitude;
  accAdd: Uint8Array;   // [acc·16 + cellule] → acc  (étage 1)
  leafFin: Uint8Array;  // [acc] → couple de la feuille (fuseImpacts)
  ct: Uint8Array;       // [ω·16 + couple enfant] → (max(1−ω, δ⁺), min(ω, δ⁻))
  nodeAdd: Uint8Array;  // [acc·16 + terme] → acc  (étage 2)
  rank: Uint8Array;     // [couple] → rang selon compareASC (plus grand = préféré)
}

const TABLES = new Map<Attitude, Tables>();
export function tables(at: Attitude): Tables {
  const hit = TABLES.get(at);
  if (hit) return hit;
  const accAdd = new Uint8Array(256), leafFin = new Uint8Array(16), ct = new Uint8Array(64), nodeAdd = new Uint8Array(256), rank = new Uint8Array(16);
  for (let a = 0; a < 16; a++) {
    const pa = gOf(a), ma = dOf(a);
    const r = fuseImpacts([pa], [ma], at);
    leafFin[a] = code(r.gPlus, r.dMinus);
    for (let c = 0; c < 16; c++) {
      const p = gOf(c), m = dOf(c);
      const np = p === 0 ? pa : pa === 0 ? p : at === 1 ? Math.min(pa, p) : Math.max(pa, p);
      accAdd[a * 16 + c] = code(np, Math.max(ma, m));
      nodeAdd[a * 16 + c] = code(ordMin(pa as OrdinalLevel, p as OrdinalLevel), ordMax(ma as OrdinalLevel, m as OrdinalLevel));
    }
  }
  for (let w = 0; w < 4; w++) for (let c = 0; c < 16; c++) {
    const W = w as OrdinalLevel;
    ct[w * 16 + c] = code(ordMax(ordNeg(W), gOf(c) as OrdinalLevel), ordMin(W, dOf(c) as OrdinalLevel));
  }
  const order = [...Array(16).keys()].sort((x, y) => compareASC({ gPlus: gOf(x), dMinus: dOf(x) }, { gPlus: gOf(y), dMinus: dOf(y) }));
  order.forEach((c, i) => { rank[c] = i; });
  const t = { at, accAdd, leafFin, ct, nodeAdd, rank };
  TABLES.set(at, t);
  return t;
}

/** Cellule d'un avis qualitatif : (δ⁺_ij, δ⁻_ij) après résolution de l'effet inconnu selon l'attitude. */
export function cellCode(impact: QualitativeImpact, at: Attitude): number {
  const e = qualImpactToElementary(impact, 0);
  const r = resolveUBipolar(e.gPlus, e.dMinus, at);
  return code(r.gPlus, r.dMinus);
}

// ── Arbre compilé ──────────────────────────────────────────────────────────
export interface Tree {
  n: number;                 // nœud 0 = racine virtuelle (critères de tête)
  ids: string[];
  parent: Int32Array;
  kids: number[][];
  w: Uint8Array;             // poids effectif (thesisWeights des frères) comme enfant
  leaf: boolean[];
  post: number[];            // ordre postfixe (enfants avant parents), racine en dernier
  leaves: number[];          // feuilles dans l'ordre postfixe
  leafIndex: Map<string, number>;
}

export function compileTree(criteria: AtelierCriterion[]): Tree {
  const ids = ["__racine"], parent = [-1], kids: number[][] = [[]], w = [3], leaf = [false];
  const add = (c: AtelierCriterion, p: number) => {
    const i = ids.length;
    ids.push(c.id); parent.push(p); kids.push([]); w.push(0); leaf.push(!c.children?.length);
    kids[p].push(i);
    for (const ch of c.children ?? []) add(ch, i);
  };
  const imp = new Map<number, ImportanceBadge>();
  criteria.forEach(c => add(c, 0));
  // Importances (pour les poids) : même parcours que add.
  let k = 1;
  const fill = (c: AtelierCriterion) => { imp.set(k++, c.importance); (c.children ?? []).forEach(fill); };
  criteria.forEach(fill);
  for (let i = 0; i < ids.length; i++) {
    const ks = kids[i];
    if (!ks.length) continue;
    const ws = thesisWeights(ks.map(c => importanceToWeight(imp.get(c)!)));
    ks.forEach((c, j) => { w[c] = ws[j]; });
  }
  const post: number[] = [];
  const rec = (i: number) => { kids[i].forEach(rec); post.push(i); };
  rec(0);
  const leaves = post.filter(i => i !== 0 && leaf[i]);
  return { n: ids.length, ids, parent: Int32Array.from(parent), kids, w: Uint8Array.from(w), leaf, post, leaves, leafIndex: new Map(leaves.map(i => [ids[i], i])) };
}

/** Valeur de la racine à partir des accumulateurs de feuilles (acc[i] pour i feuille). */
export function evalTree(t: Tree, T: Tables, acc: Uint8Array, val: Uint8Array = new Uint8Array(t.n)): number {
  if (!t.kids[0].length) return 0; // aucun critère : aggregateNode([{0,0}], [3]) = (0,0)
  for (const i of t.post) {
    if (t.leaf[i] && i !== 0) { val[i] = T.leafFin[acc[i]]; continue; }
    let a = NODE_INIT;
    for (const c of t.kids[i]) a = T.nodeAdd[a * 16 + T.ct[t.w[c] * 16 + val[c]]];
    val[i] = a;
  }
  return val[0];
}

// ── Programmation dynamique générique ──────────────────────────────────────
export interface DPOption { cost: number; mult: number; tag: number; apply: (s: Uint8Array) => void }
export interface DPStep { options: DPOption[]; close: (s: Uint8Array) => void }
export interface DPEntry { s: Uint8Array; cost: number; ways: number; cnt: number }
export type Layer = Map<string, DPEntry>;
export interface DPRun { layers: Layer[]; steps: DPStep[]; states: number; exceeded: boolean; pruned: boolean }

const keyOf = (s: Uint8Array) => String.fromCharCode.apply(null, s as unknown as number[]);

export function runDP(init: Uint8Array, steps: DPStep[], opts: { costCap?: number; maxStates?: number; onProgress?: (done: number, total: number) => void } = {}): DPRun {
  const cap = opts.costCap ?? Infinity, max = opts.maxStates ?? 2_000_000;
  let cur: Layer = new Map([[keyOf(init), { s: init, cost: 0, ways: 1, cnt: 1 }]]);
  const layers: Layer[] = [cur];
  let states = 1, pruned = false;
  for (let j = 0; j < steps.length; j++) {
    const next: Layer = new Map();
    const step = steps[j];
    for (const e of cur.values()) {
      for (const o of step.options) {
        const c = e.cost + o.cost;
        if (c > cap) { pruned = true; continue; }
        const ns = e.s.slice();
        o.apply(ns); step.close(ns);
        const k = keyOf(ns);
        const ex = next.get(k);
        if (!ex) next.set(k, { s: ns, cost: c, ways: e.ways * o.mult, cnt: e.cnt * o.mult });
        else {
          ex.cnt += e.cnt * o.mult;
          if (c < ex.cost) { ex.cost = c; ex.ways = e.ways * o.mult; } else if (c === ex.cost) ex.ways += e.ways * o.mult;
        }
      }
      if (next.size > max) return { layers, steps, states: states + next.size, exceeded: true, pruned };
    }
    states += next.size;
    layers.push(next);
    cur = next;
    opts.onProgress?.(j + 1, steps.length);
  }
  return { layers, steps, states, exceeded: false, pruned };
}

/** Coût restant minimal b(état) pour finir dans un état accepté (Infinity si impossible). */
export function backwardCosts(run: DPRun, accept: (s: Uint8Array) => boolean, useCost = true, costCap = Infinity): Map<string, number>[] {
  const L = run.layers.length;
  const b: Map<string, number>[] = new Array(L);
  b[L - 1] = new Map([...run.layers[L - 1]].map(([k, e]) => [k, accept(e.s) ? 0 : Infinity]));
  for (let j = L - 2; j >= 0; j--) {
    const m = new Map<string, number>();
    const step = run.steps[j];
    for (const [k, e] of run.layers[j]) {
      let best = Infinity;
      for (const o of step.options) {
        const c = useCost ? o.cost : 0;
        if (useCost && e.cost + c > costCap) continue;
        const ns = e.s.slice(); o.apply(ns); step.close(ns);
        const r = b[j + 1].get(keyOf(ns));
        if (r !== undefined && c + r < best) best = c + r;
      }
      m.set(k, best);
    }
    b[j] = m;
  }
  return b;
}

/** Énumère les suites d'options (tags) des solutions de coût exactement k (ou de toutes les solutions si useCost=false). */
export function* enumerateSolutions(run: DPRun, b: Map<string, number>[], k: number, useCost = true): Generator<number[]> {
  const tags: number[] = [];
  const rec = function* (j: number, s: Uint8Array, g: number): Generator<number[]> {
    if (j === run.steps.length) { yield [...tags]; return; }
    const step = run.steps[j];
    for (const o of step.options) {
      const c = useCost ? o.cost : 0;
      const ns = s.slice(); o.apply(ns); step.close(ns);
      const r = b[j + 1].get(keyOf(ns));
      if (r === undefined || g + c + r !== k) continue;
      tags.push(o.tag);
      yield* rec(j + 1, ns, g + c);
      tags.pop();
    }
  };
  const [first] = run.layers[0].values();
  yield* rec(0, first.s, 0);
}

/** Options admissibles par étape : celles qui figurent sur au moins une solution de coût k. */
export function admissibleTags(run: DPRun, b: Map<string, number>[], k: number): Set<number>[] {
  return run.steps.map((step, j) => {
    const out = new Set<number>();
    for (const e of run.layers[j].values()) {
      const r0 = b[j].get(keyOf(e.s));
      if (r0 === undefined || e.cost + r0 !== k) continue;
      for (const o of step.options) {
        const ns = e.s.slice(); o.apply(ns); step.close(ns);
        const r = b[j + 1].get(keyOf(ns));
        if (r !== undefined && e.cost + o.cost + r === k) out.add(o.tag);
      }
    }
    return out;
  });
}

/** Fermetures statiques : après l'étape j, replie dans leur parent les nœuds dont tous les enfants sont connus. */
export function closer(t: Tree, T: Tables, nodes: number[], offsets: number[]): (s: Uint8Array) => void {
  if (!nodes.length) return () => {};
  return (s: Uint8Array) => {
    for (const off of offsets) for (const i of nodes) {
      const v = t.leaf[i] ? T.leafFin[s[off + i]] : s[off + i];
      const p = off + t.parent[i];
      s[p] = T.nodeAdd[s[p] * 16 + T.ct[t.w[i] * 16 + v]];
      s[off + i] = 0;
    }
  };
}

/** Instant de fermeture de chaque nœud : max des instants de ses enfants (feuille : dernière variable qui la touche, −1 sinon). */
export function closeTimes(t: Tree, lastVar: (leaf: number) => number): Int32Array {
  const ct = new Int32Array(t.n).fill(-1);
  for (const i of t.post) ct[i] = t.leaf[i] && i !== 0 ? lastVar(i) : Math.max(-1, ...t.kids[i].map(c => ct[c]));
  return ct;
}

// ── Évaluation d'une session (forward exact, compact) ──────────────────────
export function attitudeOf(session: AtelierSession): Attitude { return session.attitude === "Pessimiste" ? 1 : 2; }

/** Classement des scénarios : même résultat que computeLoResults (tests). */
export function scenarioRoots(session: AtelierSession): number[] {
  const at = attitudeOf(session), T = tables(at), t = compileTree(session.criteria);
  const opt = new Map(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o] as const)));
  return session.scenarios.map(sc => {
    const acc = new Uint8Array(t.n);
    for (const lf of t.leaves) {
      let a = 0;
      for (const lev of sc.leviers) { const imp = opt.get(lev.valeur)?.impacts[t.ids[lf]]; if (imp !== undefined) a = T.accAdd[a * 16 + cellCode(imp, at)]; }
      acc[lf] = a;
    }
    return evalTree(t, T, acc);
  });
}
