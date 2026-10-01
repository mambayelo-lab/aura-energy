// Calcul de l'exploration des solutions (exécuté dans un Web Worker).
import type { AtelierSession } from "./atelier-store";
import { backwardSmallestChange } from "./decision-express";
import { currentCombo, exploreSolutions, improvementPath, minimalMoveToBest, type ComboResult, type MinimalMove, type PathStep } from "./solution-space";
import type { BackwardResult } from "./decision-express";

export interface Explored {
  results: ComboResult[];            // meilleures combinaisons + échantillon par profil (liste affichée)
  counts: [string, number][];        // nombre exact de combinaisons par profil « g,d »
  total: number; evaluated: number; exhaustive: boolean; refused?: string;
  front: string[];
  move: MinimalMove | null; path: PathStep[];
  judgment: BackwardResult | null;
}

export function exploreAll(session: AtelierSession): Explored {
  const space = exploreSolutions(session);
  const counts = new Map<string, number>();
  const perCell = new Map<string, number>();
  const keep: ComboResult[] = [];
  for (const [k, n] of space.counts ?? []) counts.set(k, n);
  space.results.forEach((r, i) => {
    const k = `${r.gPlus},${r.dMinus}`;
    const n = perCell.get(k) ?? 0;
    if (i < 2000 || n < 200) { keep.push(r); perCell.set(k, n + 1); }
  });
  const from = currentCombo(session);
  const move = from && space.best ? minimalMoveToBest(session, from, space.best) : null;
  const path = from && space.best && move && !move.alreadyBest ? improvementPath(session, from, { ...from, ...Object.fromEntries(move.changes.map(c => [c.leverId, c.toId])) }) : [];
  let judgment: BackwardResult | null = null;
  try { judgment = session.scenarios.length >= 2 ? backwardSmallestChange(session) : null; } catch { judgment = null; }
  return { results: keep, counts: [...counts], total: space.total, evaluated: space.total, refused: space.refused, exhaustive: space.exhaustive, front: [...space.front], move, path, judgment };
}
