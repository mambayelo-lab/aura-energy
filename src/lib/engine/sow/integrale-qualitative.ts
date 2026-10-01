/**
 * intégrale qualitative + capacité par défaut (moteur Sow).
 * Sₘ(f) = max_i min(f_σ(i), μ(A_σ(i))) — §2.3 du papier IPMU 2016.
 */
import type { Capacity, Level } from "./types";

/**
 * Agrégation max-min pondérée de f (perf. par critère, échelle L) par rapport à μ.
 * n = nombre de critères ; μ prend un bitmask sur n bits.
 */
export function integraleQualitative(f: Level[], mu: Capacity): Level {
  const n = f.length;
  // σ : permutation triant f croissant
  const idx = f.map((_, i) => i).sort((a, b) => f[a] - f[b]);
  let best = 0;
  for (let k = 0; k < n; k++) {
    // A_σ(k) = {σ(k), σ(k+1), …, σ(n)}
    let mask = 0;
    for (let j = k; j < n; j++) mask |= 1 << idx[j];
    best = Math.max(best, Math.min(f[idx[k]], mu(mask)));
  }
  return best;
}

/**
 * Capacité possibiliste par défaut : μ(I) = max des importances des critères de I,
 * avec μ(∅)=0 et μ(N)=maxL garantis. C'est le défaut d'élicitation d'Aura :
 * il ne demande AUCUNE question supplémentaire (réutilise les importances
 * ordinales déjà saisies), au prix d'ignorer les interactions — une table
 * explicite peut le raffiner (cf. capacityFromTable).
 */
export function possibilisticCapacity(importances: Level[], maxL: Level): Capacity {
  const n = importances.length;
  const full = (1 << n) - 1;
  return (mask: number) => {
    if (mask === 0) return 0;
    if (mask === full) return maxL;
    let m = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) m = Math.max(m, importances[i]);
    return m;
  };
}

/**
 * Capacité explicite depuis une table {bitmask → niveau} (ex : Table 2 du papier).
 * Vérifie μ(∅)=0, μ(N)=maxL et la monotonie ; lève une erreur sinon.
 */
export function capacityFromTable(table: Map<number, Level>, n: number, maxL: Level): Capacity {
  const full = (1 << n) - 1;
  if ((table.get(0) ?? 0) !== 0) throw new Error("μ(∅) doit valoir 0");
  if (table.get(full) !== maxL) throw new Error("μ(N) doit valoir le top de l'échelle");
  for (const [mask, v] of table) {
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        const sub = table.get(mask & ~(1 << i));
        if (sub !== undefined && sub > v) throw new Error(`Monotonie violée entre ${mask & ~(1 << i)} et ${mask}`);
      }
    }
  }
  return (mask: number) => {
    const v = table.get(mask);
    if (v === undefined) throw new Error(`μ non définie pour le sous-ensemble ${mask}`);
    return v;
  };
}
