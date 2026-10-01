/**
 * Agrégation bipolaire à deux étages (thèse Lô, 2013, ch. IV §3) — thèse de M. Lô, « Contribution à
 * l'évaluation d'architectures en Ingénierie Système », ch. IV §3.
 *
 *   Étage 1 — possibilités d'impact d'une ASC x sur un oDDP i (§3.1, p. 78-79),
 *     à partir des avis d'experts δ⁺_ij (échelle PS) et δ⁻_ij (échelle NS) de
 *     chaque iDDP j, selon l'attitude at ∈ {1 = pessimiste, 2 = optimiste} :
 *     équations (1)-(4) → (δ^{+at}_{i,x}, δ^{-at}_{i,x}), un des deux NUL.
 *
 *   Étage 2 — remontée dans la hiérarchie d'ITs TPM → MOP → MOE (§3.2-3.3,
 *     p. 80-82) : pour l'indicateur k de fils K_k, avec les poids ω_i,
 *     équation (9) : δ^{at}_{k,x} = (min_{i∈K_k} max(1−ω_i, δ^{+at}_{i,x}),
 *                                     max_{i∈K_k} min(ω_i, δ^{−at}_{i,x})).
 *     Sans poids, équation (7) : (min_i δ^{+at}, max_i δ^{−at}).
 *
 * ⚠️  ω n'intervient JAMAIS à l'étage 1 ; at n'intervient JAMAIS à l'étage 2.
 */

import type { OrdinalLevel, OrdinalImpact, TriProfileImpact, Attitude, RawCell } from "./types";
import {
  ordMin, ordMax, ordNeg,
  resolveUBipolar, assertBipolaire,
} from "./ordinal";

// ── Types d'entrée ────────────────────────────────────────────────────────────

/**
 * Impact élémentaire d'un levier j sur un critère i.
 * Les deux composantes peuvent être U (non renseignées).
 */
export interface ElementaryImpact {
  leverIndex: number;
  /** δ⁺ij : gain potentiel du levier j sur le critère i */
  gPlus: RawCell;
  /** δ⁻ij : risque de dégradation du levier j sur le critère i */
  dMinus: RawCell;
}

/** Importance ordinale d'un critère/nœud enfant */
export type ImportanceSymbol = "N" | "L" | "M" | "H";

// ── Étage 1 : aggregateCriterion ─────────────────────────────────────────────

/**
 * Étage 1 — thèse Lô, ch. IV §3.1, équations (1)-(4), p. 79 :
 *
 *   pessimiste (at=1) : δ^{+1}_{i,x} = min_j δ⁺_ij  si min_j δ⁺_ij > max_j δ⁻_ij, NUL sinon   (1)
 *                       δ^{−1}_{i,x} = NUL          si min_j δ⁺_ij > max_j δ⁻_ij, max_j δ⁻_ij sinon (2)
 *   optimiste  (at=2) : δ^{+2}_{i,x} = max_j δ⁺_ij  si max_j δ⁺_ij > max_j δ⁻_ij, NUL sinon   (3)
 *                       δ^{−2}_{i,x} = NUL          si max_j δ⁺_ij > max_j δ⁻_ij, max_j δ⁻_ij sinon (4)
 *
 * · min_j et max_j δ⁺_ij portent sur les possibilités d'AMÉLIORATION δ⁺_ij
 *   exprimées (iDDP j dont l'avis est une amélioration) : un iDDP sans effet
 *   ou seulement dégradant n'a pas de δ⁺_ij et n'annule donc pas le minimum
 *   pessimiste (« le niveau de possibilité d'amélioration le plus petit comme
 *   agrégation des possibilités d'amélioration », p. 79). min ou max d'un
 *   ensemble vide = NUL.
 * · Égalité : la condition stricte « > » n'étant pas remplie, (2)/(4)
 *   retiennent la détérioration max_j δ⁻_ij (vérifié sur le Tableau V-6,
 *   TPM16 de l'ASC 495 : (0, M)).
 * · Effet inconnu δ^u_ij (p. 79) : pessimiste → détérioration du plus haut
 *   niveau de NS ; optimiste → NUL (voir resolveUBipolar).
 *
 * Les deux attitudes sont toujours calculées ; `at` ne sert qu'à l'appelant.
 */
export function aggregateCriterion(
  impacts: ElementaryImpact[],
  _at: Attitude,
): TriProfileImpact {
  if (impacts.length === 0) {
    const neutral: OrdinalImpact = { gPlus: 0, dMinus: 0 };
    return { prudent: neutral, optimiste: neutral };
  }

  const fuse = (at: Attitude): OrdinalImpact => {
    const resolved = impacts.map(imp => resolveUBipolar(imp.gPlus, imp.dMinus, at));
    const r = fuseImpacts(resolved.map(x => x.gPlus), resolved.map(x => x.dMinus), at);
    return { gPlus: r.gPlus as OrdinalLevel, dMinus: r.dMinus as OrdinalLevel };
  };

  const prudent = fuse(1);
  const optimiste = fuse(2);

  assertBipolaire(prudent, "Prudent");
  assertBipolaire(optimiste, "Optimiste");

  return { prudent, optimiste };
}

/**
 * Équations (1)-(4) sur une échelle ordinale quelconque codée 0 = NUL < 1 < … :
 * `plus` = (δ⁺_ij)_j, `minus` = (δ⁻_ij)_j (0 = pas d'avis sur ce pôle).
 */
export function fuseImpacts(
  plus: number[], minus: number[], at: Attitude,
): { gPlus: number; dMinus: number } {
  const p = plus.filter(v => v > 0);   // possibilités d'amélioration exprimées
  const m = minus.filter(v => v > 0);  // possibilités de détérioration exprimées
  const aggPlus = p.length === 0 ? 0 : at === 1 ? Math.min(...p) : Math.max(...p);
  const maxMinus = m.length === 0 ? 0 : Math.max(...m);
  return aggPlus > maxMinus ? { gPlus: aggPlus, dMinus: 0 } : { gPlus: 0, dMinus: maxMinus };
}

/**
 * Agrégation max-min pondérée discrète par rapport à une mesure floue μ — thèse Lô,
 * ch. IV §2.3, p. 77 : S_μ(u(y)) = ⋁_{i=1..n} u_σ(i)(y_σ(i)) ∧ μ(A_σ(i)),
 * σ ordonnant les u croissants, A_σ(i) = {σ(i), …, σ(n)}.
 * `mu` reçoit l'ensemble A (indices) et renvoie μ(A).
 */
export function integraleMaxMin(k: OrdinalLevel[], mu: (A: number[]) => OrdinalLevel): OrdinalLevel {
  const sigma = k.map((_, i) => i).sort((a, b) => k[a] - k[b]);
  let best: OrdinalLevel = 0;
  sigma.forEach((_, i) => {
    best = ordMax(best, ordMin(k[sigma[i]], mu(sigma.slice(i))));
  });
  return best;
}

// ── Étage 2 : aggregateNode ───────────────────────────────────────────────────

/**
 * Étage 2 — thèse Lô, ch. IV §3.3, équation (9), p. 82 : pour l'indicateur k
 * et ses fils i ∈ K_k de poids ω_i,
 *
 *   δ^{+at}_{k,x} = min_{i∈K_k} max(1 − ω_i, δ^{+at}_{i,x})
 *   δ^{−at}_{k,x} = max_{i∈K_k} min(ω_i,     δ^{−at}_{i,x})
 *
 * avec 1 − ω le renversement de l'échelle (H↔N, M↔L, p. 108). Les poids sont
 * utilisés TELS QUELS (aucune normalisation : cf. Tableau V-7, test 2, poids
 * [M, L] des TPM de la MOP1). Si aucun poids n'est exprimé (tous NUL), on
 * applique l'équation (7) sans poids : (min_i δ^{+at}, max_i δ^{−at}).
 *
 * Remarque : ce sont deux agrégations max-min pondérées (p. 77) par rapport aux mesures
 * de nécessité et de possibilité induites par les poids — vérifié par les tests.
 */
export function aggregateNode(
  children: OrdinalImpact[],
  weights: OrdinalLevel[],
): OrdinalImpact {
  if (children.length === 0) return { gPlus: 0, dMinus: 0 };
  if (children.length !== weights.length) {
    throw new Error(
      `aggregateNode : ${children.length} enfants pour ${weights.length} poids.`,
    );
  }
  const w = thesisWeights(weights);

  // δ⁺_k = min_i max(1 − ω_i, δ⁺_i)
  const G = children.reduce<OrdinalLevel>(
    (acc, child, i) => ordMin(acc, ordMax(ordNeg(w[i]), child.gPlus)),
    3,
  );

  // δ⁻_k = max_i min(ω_i, δ⁻_i)
  const D = children.reduce<OrdinalLevel>(
    (acc, child, i) => ordMax(acc, ordMin(w[i], child.dMinus)),
    0,
  );

  return { gPlus: G, dMinus: D };
}

/**
 * Poids effectifs de l'équation (9) : ceux saisis, sans normalisation ; si
 * aucun n'est exprimé (tous NUL), équation (7) sans poids ⇔ ω_i = H pour tous.
 */
export function thesisWeights(weights: OrdinalLevel[]): OrdinalLevel[] {
  return weights.some(x => x > 0) ? weights : weights.map(() => 3 as OrdinalLevel);
}

/**
 * Comparaison de deux ASC selon leurs couples (δ⁺, δ⁻) — thèse Lô, ch. IV
 * §3.3, p. 83 : ordre lexicographique « par possibilité de détérioration en
 * premier lieu, puis par possibilité d'amélioration en second ». Renvoie > 0
 * si a est préférée à b (δ⁻ plus faible ; à δ⁻ égal, δ⁺ plus fort). Cohérent
 * avec (6) et (8) quand les poids ne sont pas utilisés.
 */
export function compareASC(
  a: { gPlus: number; dMinus: number },
  b: { gPlus: number; dMinus: number },
): number {
  if (a.dMinus !== b.dMinus) return a.dMinus < b.dMinus ? 1 : -1;
  if (a.gPlus !== b.gPlus) return a.gPlus > b.gPlus ? 1 : -1;
  return 0;
}

// ── Agrégation complète (3 profils) ──────────────────────────────────────────

/**
 * Applique aggregateNode sur les 3 profils simultanément.
 */
export function aggregateNodeTriProfile(
  children: TriProfileImpact[],
  weights: OrdinalLevel[],
): TriProfileImpact {
  return {
    prudent: aggregateNode(children.map(c => c.prudent), weights),
    optimiste: aggregateNode(children.map(c => c.optimiste), weights),
  };
}

// ── Helpers de conversion depuis les données existantes ───────────────────────

/**
 * Convertit un impact continu [-1, 1] (format actuel de engine.ts) en
 * impact élémentaire bipolaire ordinal.
 *
 * Quantification :
 *   [0.75, 1]  → H
 *   [0.35, 0.75[ → M
 *   [0.05, 0.35[ → L
 *   ]-0.05, 0.05[ → N (neutre)
 *   négatif : symétrique sur dMinus
 */
export function fromContinuousImpact(value: number, leverIndex = 0): ElementaryImpact {
  const abs = Math.abs(value);
  let level: RawCell;
  if (abs >= 0.75) level = "H";
  else if (abs >= 0.35) level = "M";
  else if (abs >= 0.05) level = "L";
  else level = "N";

  if (value >= 0.05) return { leverIndex, gPlus: level, dMinus: "N" };
  if (value <= -0.05) return { leverIndex, gPlus: "N", dMinus: level };
  return { leverIndex, gPlus: "N", dMinus: "N" };
}

/**
 * Convertit une importance continue [0,1] en OrdinalLevel.
 */
export function fromContinuousWeight(value: number): OrdinalLevel {
  if (value >= 0.75) return 3;
  if (value >= 0.45) return 2;
  if (value >= 0.2) return 1;
  return 0;
}
