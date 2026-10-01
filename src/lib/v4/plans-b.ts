// Stress-test : les plans B d'une alerte de résilience classés par Décider, avec
// l'attitude pessimiste (prudente), toutes les combinaisons de leviers explorées
// et le plus petit changement qui ferait gagner une autre option. Aucun poids
// arbitraire : les options et leurs effets sont des évaluations qualitatives
// (hypothèses marquées « à confirmer » tant qu'un expert ne les a pas revues).
import { newSession, type AtelierSession } from "./atelier-store";
import { backwardSmallestChange, rankOptions, seedFromAlert, type BackwardResult, type RankedOption } from "./decision-express";
import { exploreSolutions } from "./solution-space";

export interface PlansB {
  alertId: string; attitude: "Pessimiste";
  ranking: RankedOption[];
  /** Nombre de combinaisons de leviers explorées (espace complet). */
  combinations: number; exhaustive: boolean;
  smallestChange: BackwardResult | null;
  session: AtelierSession;
}
export function rankPlansB(alert: { id: string; label: string; options: string[] }): PlansB {
  const seed = seedFromAlert({ id: alert.id, alertLabel: alert.label, options: alert.options });
  const session: AtelierSession = { ...newSession({ contextRaw: alert.label, title: alert.label, alertId: alert.id, alertLabel: alert.label }), ...seed, attitude: "Pessimiste", step: "decider" };
  const space = exploreSolutions(session);
  return { alertId: alert.id, attitude: "Pessimiste", ranking: rankOptions(session), combinations: space.total, exhaustive: space.exhaustive, smallestChange: backwardSmallestChange(session, { limit: 20_000 }), session };
}
