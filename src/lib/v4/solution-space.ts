// Espace des solutions d'une décision : TOUTES les combinaisons d'options par
// levier (listées jusqu'à 10⁶ ; au-delà, effectifs exacts par programmation
// dynamique, lo-search, et refus explicite si le budget est dépassé), chacune évaluée
// par le forward de la thèse (aggregateHierarchy → aggregateNode, agrégation max-min,
// attitude de la session, pessimiste par défaut). Le backward (plus petit
// changement de leviers vers la meilleure solution) est une extension
// d'Aura : même recherche exhaustive que l'ancien backward
// (searchMinimalRepairs), le forward restant seul juge.
import { aggregateNode, compareASC, thesisWeights } from "../engine/lo/aggregation";
import type { Attitude, OrdinalLevel } from "../engine/lo/types";
import { aggregateHierarchy, enumerateCombos, importanceToWeight } from "./atelier-compute";
import type { AtelierOptionDef, AtelierScenario, AtelierSession } from "./atelier-store";
import { EXHAUSTIVE_LIMIT, searchMinimalRepairs } from "./exhaustive-search";
import { code, dOf, gOf } from "./lo-compact";
import { combosWithProfile, exploreSpace, minimalLeverMove } from "./lo-search";

export type Combo = Record<string, string>;
export interface ComboResult { key: string; combo: Combo; gPlus: OrdinalLevel; dMinus: OrdinalLevel }
export interface SolutionSpace {
  results: ComboResult[];     // triés du meilleur au moins bon (compareASC)
  total: number;              // taille de l'espace ∏ |options|
  exhaustive: boolean;        // true : tout l'espace évalué ; false : budget atteint
  front: Set<string>;         // profils (g,d) non dominés
  best?: ComboResult;
  counts?: Map<string, number>; // nombre EXACT de combinaisons par profil « g,d » (tout l'espace)
  refused?: string;             // budget dépassé : explication et réduction proposée (jamais d'échantillon)
}

export const comboKey = (session: AtelierSession, c: Combo) => session.leviersDef.map(l => c[l.id]).join("|");

// Forward d'une combinaison : exactement le calcul du classement des scénarios.
export function makeEvaluator(session: AtelierSession) {
  const attitudeCode: Attitude = session.attitude === "Pessimiste" ? 1 : 2;
  const profile: "prudent" | "optimiste" = session.attitude === "Pessimiste" ? "prudent" : "optimiste";
  const optionIndex: Record<string, AtelierOptionDef> = {};
  for (const lev of session.leviersDef) for (const opt of lev.options) optionIndex[opt.id] = opt;
  const normW = thesisWeights(session.criteria.map(c => importanceToWeight(c.importance)));
  return (combo: Combo): { gPlus: OrdinalLevel; dMinus: OrdinalLevel } => {
    const sc: AtelierScenario = { id: "_x", label: "", color: "", description: "", scores: {}, valeur: 0, faisabilite: 0,
      leviers: session.leviersDef.map(l => ({ id: l.id, label: l.label, valeur: combo[l.id], type: l.type })) };
    const stage1 = session.criteria.map(c => aggregateHierarchy(c, sc, optionIndex, attitudeCode, profile));
    try { return aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], normW.length ? normW : [3]) as { gPlus: OrdinalLevel; dMinus: OrdinalLevel }; }
    catch { return { gPlus: 0, dMinus: 0 }; }
  };
}

const pairKey = (r: { gPlus: number; dMinus: number }) => `${r.gPlus},${r.dMinus}`;

export function exploreSolutions(session: AtelierSession, limit = EXHAUSTIVE_LIMIT): SolutionSpace {
  if (!session.leviersDef.length || session.leviersDef.some(l => !l.options.length)) return { results: [], total: 0, exhaustive: true, front: new Set() };
  const total = session.leviersDef.reduce((a, l) => a * l.options.length, 1);
  let results: ComboResult[];
  let counts: Map<string, number>;
  if (total <= limit) {
    // Tout l'espace est listé et évalué (odomètre, aucune troncature).
    const evaluate = makeEvaluator(session);
    const { combos } = enumerateCombos(session.leviersDef, total);
    results = combos.map(combo => ({ key: comboKey(session, combo), combo, ...evaluate(combo) }));
    counts = new Map();
    for (const r of results) counts.set(pairKey(r), (counts.get(pairKey(r)) ?? 0) + 1);
  } else {
    // Au-delà : effectifs exacts par programmation dynamique, liste reconstruite par profil.
    const sp = exploreSpace(session);
    if (sp.refused) return { results: [], total, exhaustive: false, front: new Set(), refused: sp.refused };
    counts = new Map([...sp.counts].map(([c, n]) => [`${gOf(c)},${dOf(c)}`, n]));
    const evaluate = makeEvaluator(session);
    results = [...sp.counts.keys()].flatMap(c => combosWithProfile(session, sp, c, c === sp.best ? 2000 : 200))
      .map(combo => ({ key: comboKey(session, combo), combo, ...evaluate(combo) }));
  }
  results.sort((a, b) => compareASC(b, a));
  const pairs = [...counts.keys()].map(k => { const [g, d] = k.split(",").map(Number); return { gPlus: g, dMinus: d }; });
  const front = new Set(pairs.filter(p => !pairs.some(q => q.gPlus >= p.gPlus && q.dMinus <= p.dMinus && (q.gPlus > p.gPlus || q.dMinus < p.dMinus))).map(pairKey));
  return { results, total, exhaustive: true, front, best: results[0], counts };
}

export const isOnFront = (space: SolutionSpace, r: { gPlus: number; dMinus: number }) => space.front.has(pairKey(r));

// Combinaison de départ : scénario retenu, sinon premier scénario classé.
export function currentCombo(session: AtelierSession, scenarioId?: string): Combo | undefined {
  const sc = session.scenarios.find(s => s.id === (scenarioId ?? session.retainedScenarioId)) ?? session.scenarios[0];
  if (!sc) return undefined;
  const combo: Combo = {};
  for (const l of session.leviersDef) combo[l.id] = sc.leviers.find(x => x.id === l.id)?.valeur ?? l.options[0]?.id;
  return combo;
}

// Plus petit changement de leviers pour atteindre le meilleur profil de l'espace.
export interface LeverChange { leverId: string; lever: string; from: string; to: string; fromId: string; toId: string }
export interface MinimalMove { changes: LeverChange[]; reached: { gPlus: OrdinalLevel; dMinus: OrdinalLevel }; exhaustive: boolean; evaluated: number; spaceSize: number; alreadyBest: boolean; count?: number; admissible?: Record<string, string[]> }

export function minimalMoveToBest(session: AtelierSession, from: Combo, best: { gPlus: OrdinalLevel; dMinus: OrdinalLevel }, limit = EXHAUSTIVE_LIMIT): MinimalMove | null {
  const evaluate = makeEvaluator(session);
  const size = session.leviersDef.reduce((a, l) => a * l.options.length, 1);
  // Programmation dynamique exacte (lo-search) ; recherche par nombre de changements seulement si le budget d'états est dépassé.
  const mv = minimalLeverMove(session, from, code(best.gPlus, best.dMinus));
  if (!("refused" in mv)) {
    if (mv.k === 0) return { changes: [], reached: evaluate(from), exhaustive: true, evaluated: size, spaceSize: size, alreadyBest: true, count: 1 };
    if (mv.k === null) return null;
    const to = mv.solutions[0];
    const changes = Object.fromEntries(session.leviersDef.filter(l => to[l.id] !== from[l.id]).map(l => [l.id, to[l.id]]));
    return { changes: describe(session, from, changes), reached: evaluate(to), exhaustive: true, evaluated: size, spaceSize: size, alreadyBest: false, count: mv.count, admissible: mv.admissible };
  }
  const search = searchMinimalRepairs({
    levers: session.leviersDef.map(l => ({ id: l.id, optionIds: l.options.map(o => o.id) })),
    base: from,
    isValid: cfg => compareASC(evaluate(cfg), best) >= 0,
    limit,
  });
  if (search.minSize === 0) return { changes: [], reached: evaluate(from), exhaustive: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, alreadyBest: true };
  if (!search.repairs.length) return null;
  const pick = search.repairs[0];
  return { changes: describe(session, from, pick.changes), reached: evaluate(pick.config), exhaustive: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, alreadyBest: false, count: search.complete ? search.repairs.length : undefined };
}

function describe(session: AtelierSession, from: Combo, changes: Record<string, string>): LeverChange[] {
  return session.leviersDef.filter(l => l.id in changes).map(l => ({
    leverId: l.id, lever: l.label,
    fromId: from[l.id], toId: changes[l.id],
    from: l.options.find(o => o.id === from[l.id])?.label ?? from[l.id],
    to: l.options.find(o => o.id === changes[l.id])?.label ?? changes[l.id],
  }));
}

// Chemin d'amélioration : un levier à la fois, en choisissant à chaque pas le
// changement qui améliore le plus (forward), jusqu'à la combinaison cible.
export interface PathStep extends LeverChange { result: { gPlus: OrdinalLevel; dMinus: OrdinalLevel } }
export function improvementPath(session: AtelierSession, from: Combo, to: Combo): PathStep[] {
  const evaluate = makeEvaluator(session);
  let cur = { ...from };
  const remaining = session.leviersDef.filter(l => cur[l.id] !== to[l.id]).map(l => l.id);
  const steps: PathStep[] = [];
  while (remaining.length) {
    let bestI = 0, bestR = evaluate({ ...cur, [remaining[0]]: to[remaining[0]] });
    for (let i = 1; i < remaining.length; i++) {
      const r = evaluate({ ...cur, [remaining[i]]: to[remaining[i]] });
      if (compareASC(r, bestR) > 0) { bestI = i; bestR = r; }
    }
    const lev = remaining.splice(bestI, 1)[0];
    const [change] = describe(session, cur, { [lev]: to[lev] });
    cur = { ...cur, [lev]: to[lev] };
    steps.push({ ...change, result: bestR });
  }
  return steps;
}

export const LEVEL = ["NUL", "L", "M", "H"] as const;
export const profileText = (r: { gPlus: number; dMinus: number }) => `potentiel ${LEVEL[r.gPlus]} · risque ${LEVEL[r.dMinus]}`;
