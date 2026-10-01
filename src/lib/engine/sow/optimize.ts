/**
 * Problème d'optimisation (1) du papier : max_{I⊆N} w(I) s.c. w(I) ≤ s(I).
 * s est non-croissante et w non-décroissante avec I (§2.4) — les deux se
 * croisent : les coalitions « ambitieuses et atteignables » sont sur la
 * frontière w = s ou juste en dessous.
 *
 * Énumération exhaustive garantie jusqu'à MAX_EXACT_CRITERIA critères ;
 * au-delà on restreint aux coalitions de taille ≤ MAX_COALITION_SIZE
 * (limitation ANNONCÉE à l'appelant via `truncated`, jamais silencieuse).
 */
import { achievability, enumeratePlans, mergePlan } from "./achievability";
import { worthQual } from "./worth";
import type { Capacity, Level, SowAction, SowAttitude, SowCoalition } from "./types";

export const MAX_EXACT_CRITERIA = 10;
export const MAX_COALITION_SIZE = 4;

export interface SowAnalysis {
  coalitions: SowCoalition[]; // triées : atteignables d'abord, worth décroissant
  optimal: SowCoalition[];    // les I* du problème (1)
  truncated: boolean;
}

export function analyzeSow(opts: {
  nCriteria: number;
  p0: Level[];
  mu: Capacity;
  maxL: Level;
  actions: SowAction[];
  worthAttitude: SowAttitude;
  /** attitude de fusion des plans pour s(I) — le papier utilise l'optimiste dans son cas d'étude */
  achievAttitude: SowAttitude;
}): SowAnalysis {
  const { nCriteria, p0, mu, maxL, actions, worthAttitude, achievAttitude } = opts;
  const plans = enumeratePlans(actions);
  const mergedPerPlan = plans.map(p => mergePlan(p, nCriteria, achievAttitude));

  const truncated = nCriteria > MAX_EXACT_CRITERIA;
  const subsets: number[][] = [];
  const collect = (start: number, current: number[]) => {
    if (current.length > 0) subsets.push([...current]);
    if (truncated && current.length >= MAX_COALITION_SIZE) return;
    for (let i = start; i < nCriteria; i++) {
      current.push(i);
      collect(i + 1, current);
      current.pop();
    }
  };
  collect(0, []);

  const coalitions: SowCoalition[] = subsets.map(criteria => {
    const worth = worthQual(p0, criteria, mu, maxL, worthAttitude);
    const { s, bestPlans } = achievability(plans, mergedPerPlan, criteria, nCriteria);
    // atteignable = l'ambition (worth) est couverte par la capacité d'action (w ≤ s)
    // hors-de-portée = l'ambition dépasse la capacité | peu-de-valeur = aucun gain attendu
    const verdict: SowCoalition["verdict"] =
      worth > s ? "hors-de-portee" : worth === 0 ? "peu-de-valeur" : "atteignable";
    return { criteria, worth, achievability: s, verdict, bestPlans };
  });

  const feasible = coalitions.filter(c => c.worth <= c.achievability && c.worth > 0);
  const maxWorth = feasible.length ? Math.max(...feasible.map(c => c.worth)) : 0;
  const worthMax = feasible.filter(c => c.worth === maxWorth);
  // Départage conforme au cas d'étude du papier : parmi les coalitions de
  // worth maximal, on retient celles d'atteignabilité maximale (ambition
  // égale → on préfère la plus sûre à réaliser).
  const maxAchiev = worthMax.length ? Math.max(...worthMax.map(c => c.achievability)) : 0;
  const optimal = worthMax.filter(c => c.achievability === maxAchiev);

  coalitions.sort((a, b) => {
    const fa = a.worth <= a.achievability && a.worth > 0 ? 0 : 1;
    const fb = b.worth <= b.achievability && b.worth > 0 ? 0 : 1;
    return fa - fb || b.worth - a.worth || a.criteria.length - b.criteria.length;
  });

  return { coalitions, optimal, truncated };
}
