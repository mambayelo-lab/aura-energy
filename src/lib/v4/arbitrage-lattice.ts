/**
 * Treillis d'Arbitrer — placement des ASC dans le plan (δ⁺, δ⁻) ∈ PS × NS
 * (16 cases) : ligne = possibilité d'amélioration δ^{+at}_x de l'objectif
 * global (H en haut), colonne = possibilité de détérioration δ^{−at}_x
 * (N à gauche). Thèse de M. Lô (2013), ch. IV §3 : δ^{at}_x est le couple
 * (5)/(9) ; les ASC prometteuses et à rejeter se lisent par (6)/(8) ; avec
 * poids, la p. 83 propose l'ordre lexicographique « détérioration d'abord,
 * puis amélioration », qui sert ici à désigner la meilleure ASC. Ce maximum
 * lexicographique n'est jamais dominé au sens de Pareto sur (δ⁺ ↑, δ⁻ ↓).
 *
 * Module pur (aucune dépendance React) : ArbitrageMinimal l'utilise pour
 * Décider comme pour Supply (mode Décision, même atelier embarqué), et les
 * tests le comparent à une énumération indépendante.
 */
import type { OrdinalLevel } from "../engine/lo/types";
import { importanceToWeight } from "./atelier-compute";
import { compareASC, thesisWeights } from "../engine/lo/aggregation";
import type { AtelierCriterion, AtelierScenario, AtelierSession } from "./atelier-store";
import { evaluatorFor } from "./space-evaluator";

export type OrdPair = { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
export type ComboEvaluation = { perCrit: Record<string, OrdPair>; global: OrdPair };

/** > 0 si a est préférée à b — ordre de la thèse (Lô p. 83) : δ⁻ d'abord, puis δ⁺. */
export function lexCompare(a: OrdPair, b: OrdPair): number {
  return compareASC(a, b);
}

/** a domine b au sens de Pareto sur (δ⁺ ↑, δ⁻ ↓) (thèse p. 80). */
export function paretoDominates(a: OrdPair, b: OrdPair): boolean {
  return a.gPlus >= b.gPlus && a.dMinus <= b.dMinus && (a.gPlus > b.gPlus || a.dMinus < b.dMinus);
}

export function normalizeSessionWeights(criteria: AtelierCriterion[]): OrdinalLevel[] {
  return thesisWeights(criteria.map(c => importanceToWeight(c.importance)));
}

export function scenarioFromCombo(session: AtelierSession, scenario: AtelierScenario, combo: Record<string, string>): AtelierScenario {
  return {
    ...scenario,
    leviers: session.leviersDef.map(def => {
      const current = scenario.leviers.find(l => l.id === def.id);
      return current ? { ...current, valeur: combo[def.id] ?? current.valeur } : {
        id: def.id, label: def.label, valeur: combo[def.id] ?? def.options[0]?.id ?? "", type: def.type,
      };
    }),
  };
}

/** Configuration complète sur leviersDef : valeur du combo, sinon celle du scénario, sinon la 1re option. */
function completeCombo(session: AtelierSession, scenario: AtelierScenario, combo: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const def of session.leviersDef) {
    out[def.id] = combo[def.id] ?? scenario.leviers.find(l => l.id === def.id)?.valeur ?? def.options[0]?.id ?? "";
  }
  return out;
}

/** Forward complet d'une configuration : impact par objectif (MOE) et impact global.
 *  Même calcul que aggregateHierarchy, via l'évaluateur compilé (space-evaluator). */
export function evaluateCombo(session: AtelierSession, scenario: AtelierScenario, combo: Record<string, string>): ComboEvaluation {
  const ev = evaluatorFor(session.criteria, session.leviersDef, session.attitude).evaluate(completeCombo(session, scenario, combo));
  const perCrit: Record<string, OrdPair> = {};
  for (const c of session.criteria) perCrit[c.id] = ev.perNode[c.id];
  return { perCrit, global: ev.global };
}

export interface OutcomeLattice {
  /** grid[δ⁺][δ⁻] = nombre de configurations SANS point bloquant (aucun veto Essentiel). */
  grid: number[][];
  /** gridAny[δ⁺][δ⁻] = nombre de configurations, points bloquants compris. */
  gridAny: number[][];
  totalCombinations: number;
  totalTested: number;
  admissible: number;
  exhaustive: boolean;
  /** Meilleure configuration admissible (maximum lexicographique). */
  best: { combo: Record<string, string>; global: OrdPair; perCrit: Record<string, OrdPair> } | null;
}

export const LATTICE_CAP = 200_000;

/**
 * Énumère l'espace des configurations (tous les leviers × toutes leurs
 * options) et compte, pour chaque case (δ⁺, δ⁻), les configurations qui y
 * aboutissent. Exact tant que l'espace ≤ `cap` (toutes les démonstrations) ;
 * au-delà `exhaustive = false` et l'interface affiche « estimation ».
 */
export function computeOutcomeLattice(
  session: AtelierSession, _baseScenario: AtelierScenario, cap = LATTICE_CAP,
): OutcomeLattice {
  const leviersDef = session.leviersDef;
  const totalCombinations = leviersDef.reduce((acc, l) => acc * Math.max(1, l.options.length), 1);
  const grid: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const gridAny: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  let best: OutcomeLattice["best"] = null;
  let count = 0;
  let admissible = 0;
  const evaluator = evaluatorFor(session.criteria, session.leviersDef, session.attitude);
  const essential = session.criteria.filter(c => c.importance === "Essentiel").map(c => c.id);
  const radix = leviersDef.map(l => Math.max(1, l.options.length));
  const idx = new Array<number>(leviersDef.length).fill(0);
  const n = Math.min(totalCombinations, cap);
  for (let k = 0; k < n; k++) {
    count++;
    const ev = evaluator.evaluateIdx(idx);
    gridAny[ev.global.gPlus][ev.global.dMinus]++;
    // Même règle que globalVetoBreaches : un objectif Essentiel avec δ⁻ > 0 est un point bloquant.
    if (!essential.some(id => (ev.perNode[id]?.dMinus ?? 0) > 0)) {
      admissible++;
      grid[ev.global.gPlus][ev.global.dMinus]++;
      if (!best || lexCompare(ev.global, best.global) > 0) {
        const combo = Object.fromEntries(leviersDef.map((l, i) => [l.id, l.options[idx[i]]?.id ?? ""]));
        const perCrit = Object.fromEntries(session.criteria.map(c => [c.id, ev.perNode[c.id]]));
        best = { combo, global: ev.global, perCrit };
      }
    }
    // Compteur en base mixte, dans l'ordre lexicographique des leviers (dernier levier le plus rapide).
    for (let p = leviersDef.length - 1; p >= 0; p--) { if (++idx[p] < radix[p]) break; idx[p] = 0; }
  }
  return { grid, gridAny, totalCombinations, totalTested: count, admissible, exhaustive: count >= totalCombinations, best };
}
