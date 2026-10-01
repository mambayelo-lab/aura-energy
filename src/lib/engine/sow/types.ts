/**
 * Moteur Sow — « A qualitative approach to set achievable goals during the
 * design phase of complex systems » (Sow, Imoussaten, Couturier, Montmain,
 * IPMU 2016, hal-01929424).
 *
 * Problème résolu : quelle coalition de critères I* améliorer en priorité,
 * telle que le gain de satisfaction attendu w(I) soit maximal SOUS CONTRAINTE
 * d'atteignabilité w(I) ≤ s(I) — l'ambition ne doit pas dépasser la capacité
 * d'action réelle.
 *
 * Tout est ordinal sur une échelle L = {0, 1, …, maxL}. Aucune arithmétique
 * cardinale : uniquement min / max / médiane.
 */

/** Niveau ordinal générique sur l'échelle L (0 = nul, maxL = top). */
export type Level = number;

export type SowAttitude = "pessimiste" | "optimiste";

/**
 * Une action élémentaire (dans Aura : une option de levier).
 * `support[i]` = degré de confiance que l'action améliore le critère i (S_i(a)).
 * `distract[i]` = degré de confiance qu'elle le dégrade (D_i(a)).
 * Invariant bipolaire : pour un même i, min(support[i], distract[i]) = 0.
 * `group` : les actions d'un même groupe sont mutuellement exclusives
 * (dans Aura : les options d'un même levier).
 */
export interface SowAction {
  id: string;
  label: string;
  group: string;
  support: Record<number, Level>;
  distract: Record<number, Level>;
}

/** Capacité qualitative μ : 2^N → L (mesure floue ordinale, encodée par bitmask). */
export type Capacity = (subsetMask: number) => Level;

export interface SowCoalition {
  /** Indices des critères de la coalition. */
  criteria: number[];
  /** Worth w_p0(I) : gain de satisfaction attendu (échelle L). */
  worth: Level;
  /** s(I) : capacité à atteindre l'amélioration (échelle L). */
  achievability: Level;
  /** Verdict qualitatif. */
  verdict: "atteignable" | "hors-de-portee" | "peu-de-valeur";
  /** Plans d'action réalisant s(I) (ids d'actions), vide si s(I)=0. */
  bestPlans: string[][];
}
