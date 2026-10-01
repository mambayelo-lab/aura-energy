/**
 * Moteur Goal-seek — « Partir de l'objectif ».
 *
 * Orchestration des équations de la thèse de M. Lô (2013, ch. IV §3) — aucune
 * n'est modifiée ; le goal-seek lui-même est une extension d'Aura :
 *  · atteinte d'une cible sur l'indicateur k : δ^{+at}_{k,x} ≥ niveau visé et
 *    δ^{−at}_{k,x} ≤ tolérance (δ^{at}_{k,x} calculé par les équations (1)-(4), (9)) ;
 *  · classement des ASC atteignantes : ordre lexicographique de la p. 83
 *    (détérioration d'abord, puis amélioration) ;
 *  · goulot : cible manquée par le plus grand nombre d'ASC ;
 *  · worth : nombre d'ASC non atteignantes débloquées si la coalition de cibles
 *    I était relevée — pour TOUTES les coalitions I (exact, sans plafond) ;
 *  · relâchement : ASC qui atteindraient si l'on renonçait à une cible ;
 *  · `evals` doit contenir TOUT l'espace X des ASC (enumerateCombos avec
 *    EXHAUSTIVE_LIMIT) pour que « reaching » soit exhaustif.
 */
import type { OrdinalLevel } from "../lo/types";
import { compareASC } from "../lo/aggregation";

export interface OrdPair { gPlus: OrdinalLevel; dMinus: OrdinalLevel }
export interface GoalTarget { critId: string; min: OrdinalLevel }
export interface ComboEval {
  key: string;
  combo: Record<string, string>;
  perCrit: Record<string, OrdPair>; // par MOE (ou critère objectif)
  global: OrdPair;
}
export interface GoalSeekResult {
  reaching: ComboEval[];                                    // triées Eq.6/8
  bottlenecks: Array<{ critId: string; blocked: number }>;  // goulots (min actif)
  worth: Array<{ coalition: string[]; unlocked: number }>;  // coalitions débloquantes
  relaxations: Array<{ critId: string; wouldReach: number }>;
}

/** Au-delà de 20 cibles simultanées (2^20 coalitions), le worth n'est pas calculé. */
const MAX_EXACT_TARGETS = 20;

// Thèse Lô, ch. IV §3.3 p. 83 : δ⁻ croissant d'abord, puis δ⁺ décroissant.
const cmpLex = (a: OrdPair, b: OrdPair) => compareASC(b, a);

function meets(c: ComboEval, t: GoalTarget, tolerateRisk: OrdinalLevel): boolean {
  const p = c.perCrit[t.critId];
  if (!p) return false;
  return p.gPlus >= t.min && p.dMinus <= tolerateRisk;
}

export function goalSeek(
  evals: ComboEval[],
  targets: GoalTarget[],
  opts: { tolerateRisk?: OrdinalLevel } = {},
): GoalSeekResult {
  const tol = opts.tolerateRisk ?? 0;
  const active = targets.filter(t => t.min > 0);

  const reaching = evals
    .filter(c => active.every(t => meets(c, t, tol)))
    .sort((a, b) => cmpLex(a.global, b.global));

  // Goulots : pour chaque combinaison non atteignante, la ou les cibles qui la
  // bloquent — le critère est l'argument actif du min de l'Eq.5 restreinte à G.
  const blockedBy = new Map<string, number>();
  const failing = evals.filter(c => !active.every(t => meets(c, t, tol)));
  for (const c of failing) {
    for (const t of active) if (!meets(c, t, tol)) blockedBy.set(t.critId, (blockedBy.get(t.critId) ?? 0) + 1);
  }
  const bottlenecks = [...blockedBy.entries()]
    .map(([critId, blocked]) => ({ critId, blocked }))
    .sort((a, b) => b.blocked - a.blocked);

  // Worth discret : combien de combinaisons non atteignantes le deviendraient
  // si la coalition I (⊆ cibles actives) était relevée vers sa cible — pour
  // TOUTES les coalitions non vides (aucun plafond de taille). Une combinaison
  // c est débloquée par I ssi F(c) ⊆ I, où F(c) = cibles que c manque ; on
  // calcule donc l'histogramme des F(c) puis sa transformée « somme sur les
  // sous-ensembles » (exacte, O(2^|G|·|G|)).
  const n = active.length;
  const worth: GoalSeekResult["worth"] = [];
  if (n > 0 && n <= MAX_EXACT_TARGETS) {
    const size = 1 << n;
    const acc = new Array<number>(size).fill(0);
    for (const c of failing) {
      let mask = 0;
      active.forEach((t, i) => { if (!meets(c, t, tol)) mask |= 1 << i; });
      acc[mask]++;
    }
    for (let i = 0; i < n; i++) for (let m = 0; m < size; m++) if (m & (1 << i)) acc[m] += acc[m ^ (1 << i)];
    for (let m = 1; m < size; m++) {
      const unlocked = acc[m];
      if (unlocked > 0) worth.push({ coalition: active.filter((_, i) => m & (1 << i)).map(t => t.critId), unlocked });
    }
    worth.sort((a, b) => (b.unlocked - a.unlocked) || (a.coalition.length - b.coalition.length));
  }

  // Backtracking : si l'on relâche UNE cible, combien de solutions apparaissent.
  const relaxations = active.map(t => ({
    critId: t.critId,
    wouldReach: evals.filter(c => active.every(t2 => t2.critId === t.critId || meets(c, t2, tol))).length,
  })).sort((a, b) => b.wouldReach - a.wouldReach);

  return { reaching, bottlenecks, worth, relaxations };
}
