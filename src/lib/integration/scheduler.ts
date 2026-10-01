// Relevé juste-à-temps planifié : deltas légers toutes les 3 heures en journée,
// extraction complète la nuit. Cadence configurable par source, sous budget.
export interface Cadence { daytimeEveryHours: number; dayStartHour: number; dayEndHour: number; nightlyFullHour: number }
export const DEFAULT_CADENCE: Cadence = { daytimeEveryHours: 3, dayStartHour: 7, dayEndHour: 21, nightlyFullHour: 2 };

export type Due = { mode: "incremental" | "full"; reason: string } | null;

/** Que faut-il lancer maintenant pour une source, vu son dernier relevé ? */
export function dueNow(now: Date, last: { at: string | null; mode: "incremental" | "full" | null; lastFullAt: string | null }, c: Partial<Cadence> = {}): Due {
  const k = { ...DEFAULT_CADENCE, ...c }, h = now.getUTCHours();
  const hoursSince = (iso: string | null) => (iso ? (now.getTime() - Date.parse(iso)) / 3600_000 : Infinity);
  if (!last.lastFullAt) return { mode: "full", reason: "premier chargement" };
  const night = h < k.dayStartHour || h >= k.dayEndHour;
  if (night && h >= k.nightlyFullHour && hoursSince(last.lastFullAt) >= 20) return { mode: "full", reason: "relevé complet de nuit" };
  if (!night && hoursSince(last.at) >= k.daytimeEveryHours - 0.05) return { mode: "incremental", reason: `delta léger (toutes les ${k.daytimeEveryHours} h en journée)` };
  return null;
}
