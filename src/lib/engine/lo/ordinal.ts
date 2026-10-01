/**
 * Opérateurs min/max sur l'échelle ordinale L = {N < L < M < H}.
 * Toutes les fonctions opèrent sur OrdinalLevel (0–3) et sont pures.
 */

import type { OrdinalLevel, OrdinalSymbol, RawCell, Attitude, OrdinalImpact } from "./types";
import { ORD, SYM } from "./types";

// ── Opérateurs de base ────────────────────────────────────────────────────────

export function ordMin(a: OrdinalLevel, b: OrdinalLevel): OrdinalLevel {
  return Math.min(a, b) as OrdinalLevel;
}

export function ordMax(a: OrdinalLevel, b: OrdinalLevel): OrdinalLevel {
  return Math.max(a, b) as OrdinalLevel;
}

/** ¬w = complément ordinal : N↔H, L↔M */
export function ordNeg(w: OrdinalLevel): OrdinalLevel {
  return (3 - w) as OrdinalLevel;
}

/** Médiane ordinale sur un tableau non vide (médiane basse si pair) */
export function ordMedian(levels: OrdinalLevel[]): OrdinalLevel {
  if (levels.length === 0) return 0;
  const sorted = [...levels].sort((a, b) => a - b);
  const mid = Math.floor((sorted.length - 1) / 2);
  return sorted[mid];
}

export function fromSymbol(s: OrdinalSymbol): OrdinalLevel {
  return ORD[s];
}

export function toSymbol(l: OrdinalLevel): OrdinalSymbol {
  return SYM[l];
}

// ── Résolution des cellules inconnues (Sprint 0) ──────────────────────────────

/**
 * Résout une cellule non renseignée selon l'attitude.
 *
 * Règle de la thèse (Lô 2013, ch. IV §3.1, p. 79) pour l'effet inconnu δ^u_ij :
 *   at=1 (Prudent)   : U → gain=N (on ne présume d'aucun gain), risque=H (pire cas)
 *   at=2 (Optimiste) : U → gain=N (rien de prouvé non plus), risque=N (optimisme)
 *
 * Dans les deux cas, la composante non active reste N.
 * Une cellule renseignée est retournée sans modification.
 */
export function resolveU(cell: RawCell, at: Attitude): OrdinalImpact {
  if (cell !== "U") {
    const level = fromSymbol(cell);
    // Convention : une cellule d'impact brute est un gain δ⁺ si positive,
    // à interpréter en contexte. Ici on retourne gPlus=level, dMinus=N
    // (la décomposition positive/négative se fait dans aggregateCriterion).
    return { gPlus: level, dMinus: 0 };
  }
  // Cellule inconnue
  if (at === 1) {
    // Prudent : gain nul, risque maximal
    return { gPlus: 0, dMinus: 3 };
  } else {
    // Optimiste : gain nul, risque nul (on suppose le meilleur)
    return { gPlus: 0, dMinus: 0 };
  }
}

/**
 * Résout une paire d'impacts bruts (gPlus, dMinus) séparés.
 * Utilisé quand l'entrée distingue déjà les deux composantes.
 */
export function resolveUBipolar(
  gRaw: RawCell,
  dRaw: RawCell,
  at: Attitude,
): OrdinalImpact {
  const gDefault: OrdinalLevel = 0;
  const dDefault: OrdinalLevel = at === 1 ? 3 : 0;

  const gPlus: OrdinalLevel = gRaw === "U" ? gDefault : fromSymbol(gRaw);
  const dMinus: OrdinalLevel = dRaw === "U" ? dDefault : fromSymbol(dRaw);

  return { gPlus, dMinus };
}

// ── Assertion invariant bipolaire ─────────────────────────────────────────────

/**
 * Vérifie l'invariant bipolaire : gPlus === N || dMinus === N.
 * Lance une erreur si les deux composantes sont actives simultanément.
 * À appeler en sortie de aggregateCriterion.
 */
export function assertBipolaire(impact: OrdinalImpact, context?: string): void {
  if (impact.gPlus !== 0 && impact.dMinus !== 0) {
    throw new Error(
      `Invariant bipolaire violé${context ? ` (${context})` : ""}: ` +
      `gPlus=${SYM[impact.gPlus]} dMinus=${SYM[impact.dMinus]} — ` +
      `une seule composante peut être active.`,
    );
  }
}
