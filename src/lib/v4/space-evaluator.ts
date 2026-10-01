/**
 * Évaluateur forward COMPILÉ d'un modèle d'atelier — même calcul que
 * aggregateHierarchy (atelier-compute.ts), mais préparé une fois par modèle
 * pour parcourir tout l'espace des configurations (backward exhaustif,
 * goal-seek, treillis d'Arbitrer) sans geler l'interface.
 *
 * Aucune formule n'est réimplémentée : la fusion d'une feuille appelle
 * aggregateCriterion (étage 1, thèse Lô ch. IV §3.1, éq. (1)-(4)) et la remontée appelle
 * aggregateNode (étage 2, éq. (9)). La compilation ne fait que :
 *  · tabuler, pour chaque feuille, le résultat de l'étage 1 pour chaque
 *    combinaison d'options des SEULS leviers qui touchent cette feuille ;
 *  · précalculer les poids normalisés de chaque fratrie.
 * L'égalité avec aggregateHierarchy est vérifiée sur toutes les
 * configurations de toutes les démonstrations (tests).
 */
import { aggregateCriterion, aggregateNode, thesisWeights } from "../engine/lo/aggregation";
import type { Attitude, OrdinalImpact, OrdinalLevel } from "../engine/lo/types";
import { importanceToWeight, qualImpactToElementary } from "./atelier-compute";
import type { AtelierCriterion, AtelierLevierDef, QualitativeImpact } from "./atelier-store";

export type OrdPair = { gPlus: OrdinalLevel; dMinus: OrdinalLevel };

interface LeafPlan { kind: "leaf"; id: string; levers: number[]; radix: number[]; table: OrdinalImpact[] | null; cache: Map<number, OrdinalImpact> }
interface NodePlan { kind: "node"; id: string; children: Plan[]; weights: OrdinalLevel[] }
type Plan = LeafPlan | NodePlan;

export interface CompiledEvaluator {
  leviersDef: AtelierLevierDef[];
  /** Évalue une configuration donnée par ses indices d'options (−1 = option inconnue, sans impact). */
  evaluateIdx(idx: ArrayLike<number>): { perNode: Record<string, OrdPair>; global: OrdPair };
  /** Évalue une configuration leverId → optionId (levier absent : aucun impact). */
  evaluate(combo: Record<string, string>): { perNode: Record<string, OrdPair>; global: OrdPair };
  /** Indices d'options d'une configuration. */
  toIdx(combo: Record<string, string>): number[];
}

function normWeights(nodes: AtelierCriterion[]): OrdinalLevel[] {
  return thesisWeights(nodes.map(c => importanceToWeight(c.importance)));
}

const TABLE_MAX = 4096;

export function compileEvaluator(criteria: AtelierCriterion[], leviersDef: AtelierLevierDef[], attitude: "Pessimiste" | "Optimiste"): CompiledEvaluator {
  const at: Attitude = attitude === "Pessimiste" ? 1 : 2;
  const profile = attitude === "Pessimiste" ? "prudent" : "optimiste";
  const optPos = leviersDef.map(l => new Map(l.options.map((o, i) => [o.id, i])));

  function fuseLeaf(leafId: string, levers: number[], opts: number[]): OrdinalImpact {
    // Même construction que aggregateHierarchy : un impact élémentaire par levier
    // dont l'option déclare un impact sur la feuille ; aucun → impact « 0 ».
    const imps = [];
    for (let k = 0; k < levers.length; k++) {
      const o = opts[k];
      if (o < 0) continue;
      const imp = leviersDef[levers[k]].options[o].impacts[leafId];
      if (imp !== undefined) imps.push(qualImpactToElementary(imp as QualitativeImpact, levers[k]));
    }
    return aggregateCriterion(imps.length ? imps : [qualImpactToElementary("0", 0)], at)[profile];
  }

  function plan(c: AtelierCriterion): Plan {
    if (!c.children?.length) {
      const levers = leviersDef.map((l, i) => (l.options.some(o => o.impacts[c.id] !== undefined) ? i : -1)).filter(i => i >= 0);
      const radix = levers.map(i => leviersDef[i].options.length);
      const size = radix.reduce((a, b) => a * b, 1);
      let table: OrdinalImpact[] | null = null;
      if (size <= TABLE_MAX) {
        table = new Array(size);
        for (let n = 0; n < size; n++) {
          let rem = n;
          const opts = radix.map(r => { const v = rem % r; rem = Math.floor(rem / r); return v; });
          table[n] = fuseLeaf(c.id, levers, opts);
        }
      }
      return { kind: "leaf", id: c.id, levers, radix, table, cache: new Map() };
    }
    return { kind: "node", id: c.id, children: c.children.map(plan), weights: normWeights(c.children) };
  }

  const roots = criteria.map(plan);
  const rootWeights = normWeights(criteria);

  function evalPlan(p: Plan, idx: ArrayLike<number>, out: Record<string, OrdPair>): OrdinalImpact {
    if (p.kind === "leaf") {
      let res: OrdinalImpact | undefined;
      let unknown = false;
      let n = 0, mul = 1;
      for (let k = 0; k < p.levers.length; k++) {
        const o = idx[p.levers[k]];
        if (o < 0) { unknown = true; break; }
        n += o * mul; mul *= p.radix[k];
      }
      if (!unknown) {
        res = p.table ? p.table[n] : p.cache.get(n);
        if (!res) { res = fuseLeaf(p.id, p.levers, p.levers.map(l => idx[l])); p.cache.set(n, res); }
      } else {
        res = fuseLeaf(p.id, p.levers, p.levers.map(l => idx[l]));
      }
      out[p.id] = { gPlus: res.gPlus, dMinus: res.dMinus };
      return res;
    }
    const ch = p.children.map(c => evalPlan(c, idx, out));
    let r: OrdinalImpact;
    try { r = aggregateNode(ch, p.weights); } catch { r = { gPlus: 0, dMinus: 0 }; }
    out[p.id] = { gPlus: r.gPlus, dMinus: r.dMinus };
    return r;
  }

  const evaluateIdx = (idx: ArrayLike<number>) => {
    const perNode: Record<string, OrdPair> = {};
    const stage1 = roots.map(p => evalPlan(p, idx, perNode));
    let global: OrdPair;
    try { global = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], rootWeights.length ? rootWeights : [3]) as OrdPair; }
    catch { global = { gPlus: 0, dMinus: 0 }; }
    return { perNode, global };
  };
  const toIdx = (combo: Record<string, string>) => leviersDef.map((l, i) => {
    const v = combo[l.id];
    // Levier absent ou option inconnue : aucun impact (comme aggregateHierarchy
    // sur un scénario qui ne renseigne pas ce levier).
    return v === undefined ? -1 : optPos[i].get(v) ?? -1;
  });
  return { leviersDef, evaluateIdx, toIdx, evaluate: combo => evaluateIdx(toIdx(combo)) };
}

// Un évaluateur par modèle (clé : objets immuables de la session).
const COMPILED = new WeakMap<object, WeakMap<object, Map<string, CompiledEvaluator>>>();
export function evaluatorFor(criteria: AtelierCriterion[], leviersDef: AtelierLevierDef[], attitude: "Pessimiste" | "Optimiste"): CompiledEvaluator {
  let a = COMPILED.get(criteria);
  if (!a) { a = new WeakMap(); COMPILED.set(criteria, a); }
  let b = a.get(leviersDef);
  if (!b) { b = new Map(); a.set(leviersDef, b); }
  let ev = b.get(attitude);
  if (!ev) { ev = compileEvaluator(criteria, leviersDef, attitude); b.set(attitude, ev); }
  return ev;
}
