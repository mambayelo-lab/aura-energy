/**
 * Worth w_p0(I) — §2.3 du papier IPMU 2016.
 * On fait progresser tous les critères de I d'un cran à la fois depuis p0
 * (la « diagonale du |I|-cube ») jusqu'à p^max = (top_I, p0_{N\I}), et le
 * worth est la MÉDIANE des agrégation max-min de ces vecteurs :
 *   w_p0(I) = med(Sμ(p⁰), Sμ(p¹), …, Sμ(p^max))
 * Cardinal pair → le choix du point médian dépend de l'attitude
 * (pessimiste : premier point ; optimiste : second).
 */
import { integraleQualitative } from "./integrale-qualitative";
import type { Capacity, Level, SowAttitude } from "./types";

export function worthQual(
  p0: Level[],
  criteria: number[],
  mu: Capacity,
  maxL: Level,
  attitude: SowAttitude,
): Level {
  const scores: Level[] = [integraleQualitative(p0, mu)];
  const p = [...p0];
  // nombre de pas pour amener tous les critères de I au top
  const steps = Math.max(0, ...criteria.map(i => maxL - p0[i]));
  for (let k = 0; k < steps; k++) {
    for (const i of criteria) p[i] = Math.min(maxL, p[i] + 1);
    scores.push(integraleQualitative(p, mu));
  }
  scores.sort((a, b) => a - b);
  const m = scores.length;
  if (m % 2 === 1) return scores[(m - 1) / 2];
  return attitude === "pessimiste" ? scores[m / 2 - 1] : scores[m / 2];
}
