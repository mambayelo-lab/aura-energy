/**
 * Recherche EXHAUSTIVE des réparations minimales (backward) — extension
 * d'Aura. La thèse de M. Lô (2013) évalue des ASC données (ch. IV §3) et cite
 * en perspective l'aide à la formulation des objectifs (conclusion, p. 120).
 * Partant de l'ASC courante x, on cherche les ASC x' ∈ X qui atteignent la
 * cible (δ^{+at}_{k,x'} ≥ niveau visé, δ^{−at}_{k,x'} ≤ tolérance, aucun point
 * bloquant) en minimisant |{ j : x'_j ≠ x_j }|, le nombre d'iDDP modifiés.
 * Le forward (éq. (1)-(4), (9)) reste le seul juge.
 *
 * Garanties (prouvées par les tests contre la force brute) :
 *  · COMPLÉTUDE — toutes les configurations de l'espace sont candidates :
 *    tous les leviers, toutes leurs options (pas seulement les branches
 *    bloquées ni un sous-ensemble « influent »).
 *  · MINIMALITÉ — on renvoie TOUTES les configurations valides de coût
 *    minimal k* ; aucune de leurs parties strictes n'est valide (sinon son
 *    coût serait < k*).
 *  · Énumération par coût croissant k = 0, 1, 2, … : chaque configuration est
 *    évaluée au plus une fois ; le nombre total d'évaluations est donc borné
 *    par la taille de l'espace ∏_j |options_j|.
 *
 * Limite documentée : EXHAUSTIVE_LIMIT = 10⁶ évaluations. Tant que l'espace
 * (ou la partie parcourue jusqu'au coût minimal) tient dans cette limite, le
 * résultat est exact. Au-delà, la recherche s'arrête et renvoie
 * `complete: false` — l'interface affiche alors « résultat dans les limites
 * de recherche » (jamais un plafond silencieux).
 */

export const EXHAUSTIVE_LIMIT = 1_000_000;

export interface SearchLever { id: string; optionIds: string[] }

export interface RepairSearchResult {
  /** Toutes les configurations valides de coût minimal (changements par rapport à la base). */
  repairs: Array<{ changes: Record<string, string>; config: Record<string, string> }>;
  /** Coût minimal k* (nombre de leviers changés) ; 0 si la base est déjà valide ; null si aucune. */
  minSize: number | null;
  /** true si le résultat est prouvé exact (espace parcouru jusqu'au bout nécessaire). */
  complete: boolean;
  /** Nombre d'évaluations forward effectuées. */
  evaluated: number;
  /** Taille de l'espace des configurations ∏_j |options_j|. */
  spaceSize: number;
}

export function spaceSize(levers: SearchLever[]): number {
  return levers.reduce((acc, l) => acc * Math.max(1, l.optionIds.length), 1);
}

function* kSubsets(n: number, k: number, start = 0): Generator<number[]> {
  if (k === 0) { yield []; return; }
  for (let i = start; i <= n - k; i++) {
    for (const rest of kSubsets(n, k - 1, i + 1)) yield [i, ...rest];
  }
}

/**
 * Parcourt l'espace par coût croissant et renvoie toutes les réparations de
 * coût minimal. `isValid` est le forward (seul juge) : cible atteinte ET
 * aucun veto violé, sur le modèle complet.
 */
export function searchMinimalRepairs(params: {
  levers: SearchLever[];
  base: Record<string, string>;
  isValid: (config: Record<string, string>) => boolean;
  limit?: number;
  /** Avancement (évaluations faites, niveau k en cours), appelé toutes les 2 000 évaluations. */
  onProgress?: (evaluated: number, k: number) => void;
}): RepairSearchResult {
  const limit = params.limit ?? EXHAUSTIVE_LIMIT;
  const { base, isValid } = params;
  const size = spaceSize(params.levers);
  // Leviers ayant au moins une option alternative à la base.
  const levers = params.levers
    .map(l => ({ id: l.id, alts: l.optionIds.filter(o => o !== base[l.id]) }))
    .filter(l => l.alts.length > 0);

  let evaluated = 1;
  if (isValid({ ...base })) {
    return { repairs: [], minSize: 0, complete: true, evaluated, spaceSize: size };
  }

  for (let k = 1; k <= levers.length; k++) {
    const found: RepairSearchResult["repairs"] = [];
    for (const subset of kSubsets(levers.length, k)) {
      const alts = subset.map(i => levers[i].alts);
      const idx = new Array(k).fill(0);
      // Produit cartésien des options alternatives du sous-ensemble.
      for (;;) {
        if (evaluated >= limit) {
          return { repairs: found, minSize: found.length ? k : null, complete: false, evaluated, spaceSize: size };
        }
        const changes: Record<string, string> = {};
        subset.forEach((li, j) => { changes[levers[li].id] = alts[j][idx[j]]; });
        const config = { ...base, ...changes };
        evaluated++;
        if (params.onProgress && evaluated % 2000 === 0) params.onProgress(evaluated, k);
        if (isValid(config)) found.push({ changes, config });
        let p = k - 1;
        while (p >= 0 && ++idx[p] === alts[p].length) { idx[p] = 0; p--; }
        if (p < 0) break;
      }
    }
    if (found.length > 0) {
      return { repairs: found, minSize: k, complete: true, evaluated, spaceSize: size };
    }
  }
  return { repairs: [], minSize: null, complete: true, evaluated, spaceSize: size };
}

// ── Mémo « dernière valeur » pour les énumérations rendues par l'interface ──
// L'espace exhaustif est recalculé seulement si le modèle (clé) change, pas à
// chaque rendu.
const lastValues = new Map<string, { key: string; value: unknown }>();
export function memoLast<T>(slot: string, key: string, compute: () => T): T {
  const hit = lastValues.get(slot);
  if (hit && hit.key === key) return hit.value as T;
  const value = compute();
  lastValues.set(slot, { key, value });
  return value;
}

/** Index combo → évaluation, construit une fois par tableau d'évaluations. */
const comboIndexes = new WeakMap<object, Map<string, unknown>>();
export function comboKey(combo: Record<string, string>): string {
  return Object.keys(combo).sort().map(k => `${k}=${combo[k]}`).join("\u0000");
}
export function lookupCombo<T extends { combo: Record<string, string> }>(evals: T[], combo: Record<string, string>): T | undefined {
  let idx = comboIndexes.get(evals) as Map<string, T> | undefined;
  if (!idx) {
    idx = new Map(evals.map(e => [comboKey(e.combo), e]));
    comboIndexes.set(evals, idx);
  }
  return idx.get(comboKey(combo));
}
