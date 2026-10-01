/**
 * Logique d'Ordre (lo) — types fondamentaux.
 *
 * Échelles ordinales PS = NS = {NUL=N < L < M < H} (thèse M. Lô 2013, ch. IV §3.1 et ch. V §4.2.2.3).
 * N = Nul, L = Faible, M = Moyen, H = Haut.
 *
 * Représentation interne : entier 0–3 pour les opérateurs min/max.
 * Représentation externe : string "N"|"L"|"M"|"H" pour l'UI et les tests.
 *
 * Invariant bipolaire : dans tout OrdinalImpact, exactement une composante
 * vaut N. (gPlus = gain, dMinus = risque de dégradation — jamais les deux
 * actifs simultanément sur un même critère feuille.)
 */

/** Niveau ordinal externe (UI, tests golden) */
export type OrdinalSymbol = "N" | "L" | "M" | "H";

/** Niveau ordinal interne (calculs min/max) */
export type OrdinalLevel = 0 | 1 | 2 | 3;

/** Correspondance symbol → level */
export const ORD: Record<OrdinalSymbol, OrdinalLevel> = {
  N: 0,
  L: 1,
  M: 2,
  H: 3,
};

/** Correspondance level → symbol */
export const SYM: Record<OrdinalLevel, OrdinalSymbol> = {
  0: "N",
  1: "L",
  2: "M",
  3: "H",
};

/**
 * Attitude du décideur at (thèse Lô, ch. IV §3.1, p. 79) :
 *   1 = pessimiste (« Prudent ») — min des possibilités d'amélioration, équations (1)-(2)
 *   2 = optimiste               — max des possibilités d'amélioration, équations (3)-(4)
 * La possibilité de détérioration retenue est max_j δ⁻_ij dans les deux cas.
 */
export type Attitude = 1 | 2;

/**
 * Cellule d'impact élémentaire π_ij pour un levier j sur un critère i.
 * "U" = Unknown (non renseigné par l'expert).
 */
export type RawCell = OrdinalSymbol | "U";

/**
 * Impact bipolaire résolu pour un critère i, un profil r.
 * Invariant : gPlus === 0 || dMinus === 0  (exactement une composante = N).
 */
export interface OrdinalImpact {
  /** Gain potentiel δ⁺ ∈ {N,L,M,H} */
  gPlus: OrdinalLevel;
  /** Risque de dégradation δ⁻ ∈ {N,L,M,H} */
  dMinus: OrdinalLevel;
}

/**
 * Résultat pour les deux attitudes de la thèse (at = 1 pessimiste « prudent »,
 * at = 2 optimiste) — aucun profil intermédiaire.
 */
export interface TriProfileImpact {
  prudent: OrdinalImpact;
  optimiste: OrdinalImpact;
}
