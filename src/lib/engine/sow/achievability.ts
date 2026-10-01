/**
 * Atteignabilité s(I) — §2.2 du papier IPMU 2016.
 *
 * Un plan d'action ap = une action par groupe (options de leviers mutuellement
 * exclusives, comme les configurations du cas RobAFIS).
 *
 * Fusion des impacts d'un plan sur le critère i :
 *   optimiste  : S_i(ap) = max des S_i(a) sur les actions soutenantes
 *   pessimiste : S_i(ap) = min des S_i(a) sur les actions soutenantes
 *   dans les deux cas D_i(ap) = max des D_i(a) (les nuisances ne sont
 *   jamais sous-estimées — choix explicite du papier, note 1).
 *
 * s_I(ap) = min_{i∈I} S_i(ap) si ∀ j∈N\I : S_j(ap) > D_j(ap) ou aucune action
 * ne nuit à j ; 0 sinon. Puis s(I) = max_{ap} s_I(ap).
 */
import type { Level, SowAction, SowAttitude } from "./types";

export interface MergedImpact { S: Level; D: Level; hasDistractor: boolean }

export function mergePlan(plan: SowAction[], nCriteria: number, attitude: SowAttitude): MergedImpact[] {
  const out: MergedImpact[] = [];
  for (let i = 0; i < nCriteria; i++) {
    const supports = plan.filter(a => (a.support[i] ?? 0) > 0).map(a => a.support[i]);
    const distracts = plan.filter(a => (a.distract[i] ?? 0) > 0).map(a => a.distract[i]);
    const S = supports.length === 0 ? 0
      : attitude === "optimiste" ? Math.max(...supports) : Math.min(...supports);
    const D = distracts.length === 0 ? 0 : Math.max(...distracts);
    out.push({ S, D, hasDistractor: distracts.length > 0 });
  }
  return out;
}

export function sIofPlan(merged: MergedImpact[], criteria: number[], nCriteria: number): Level {
  const inI = new Set(criteria);
  for (let j = 0; j < nCriteria; j++) {
    if (inI.has(j)) continue;
    const m = merged[j];
    // Non-dégradation des critères hors coalition. Le papier énonce S_j > D_j,
    // mais ses résultats (Table 5, ex. s({Cr3})=d via le plan G2-R1-S1 où
    // S_4 = D_4 = c) ne se reproduisent qu'avec S_j ≥ D_j : le soutien
    // compense la nuisance à niveau égal. C'est la lecture retenue, validée
    // par les fixtures RobAFIS.
    if (m.hasDistractor && !(m.S >= m.D)) return 0;
  }
  let s = Infinity;
  for (const i of criteria) s = Math.min(s, merged[i].S);
  return criteria.length ? (Number.isFinite(s) ? s : 0) : 0;
}

/** Génère tous les plans (une action par groupe — produit cartésien). */
export function enumeratePlans(actions: SowAction[]): SowAction[][] {
  const groups = new Map<string, SowAction[]>();
  for (const a of actions) {
    const g = groups.get(a.group) ?? [];
    g.push(a);
    groups.set(a.group, g);
  }
  let plans: SowAction[][] = [[]];
  for (const g of groups.values()) {
    const next: SowAction[][] = [];
    for (const p of plans) for (const a of g) next.push([...p, a]);
    plans = next;
  }
  return plans;
}

/** s(I) et les plans qui l'atteignent. */
export function achievability(
  plans: SowAction[][],
  mergedPerPlan: MergedImpact[][],
  criteria: number[],
  nCriteria: number,
): { s: Level; bestPlans: string[][] } {
  let s = 0;
  let best: string[][] = [];
  for (let k = 0; k < plans.length; k++) {
    const v = sIofPlan(mergedPerPlan[k], criteria, nCriteria);
    if (v > s) { s = v; best = [plans[k].map(a => a.id)]; }
    else if (v === s && v > 0) best.push(plans[k].map(a => a.id));
  }
  return { s, bestPlans: best };
}
