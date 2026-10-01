// Lien entre une décision de Décider et Supply : quand la décision vient d'une
// alerte, le premier résultat clé suit l'indicateur de l'entité concernée et la
// décision entre dans le journal Supply (même objet, relié par sessionId).
import { getMemory } from "../memoire/memoire";
import { evaluateCausalRules, loadVocab } from "./argus-vocab-store";
import type { AtelierSession } from "./atelier-store";
import { addDays, type DecisionFollowUp, type KeyResult } from "./decision-express";
import { decisionContext, recordSupplyDecision, valueForEntity } from "./supply-memory";

export async function retainDecision(session: AtelierSession, scenarioId: string, now = new Date()): Promise<DecisionFollowUp> {
  const label = session.scenarios.find(s => s.id === scenarioId)?.label ?? scenarioId;
  const decidedAt = now.toISOString();
  const krDeadline = addDays(decidedAt, 30);
  let keyResults: KeyResult[] = [{ id: "kr-1", label: "Résultat attendu", unit: "%", start: 0, target: 100, current: 0, deadline: addDays(decidedAt, 90), owner: "" }];
  let journalId: string | undefined;
  const vocab = session.alertId ? loadVocab() : undefined;
  const evaluation = vocab ? evaluateCausalRules(vocab).find(e => e.rule.id === session.alertId) : undefined;
  if (vocab && evaluation) {
    const ctx = decisionContext(vocab, evaluation);
    const kpi = ctx.kpiId ? vocab.kpis.find(k => k.id === ctx.kpiId) : undefined;
    if (kpi && ctx.valueAtDecision !== undefined) {
      keyResults = [{
        id: "kr-1", label: `${kpi.label}${ctx.entity ? ` · ${ctx.entity.split(" · ")[0]}` : ""}`, unit: kpi.unit,
        start: ctx.valueAtDecision, target: kpi.seuilAlerte, current: ctx.valueAtDecision,
        deadline: krDeadline, owner: "", kpiId: kpi.id, entityKey: ctx.entityKey,
      }];
    }
    try {
      const memory = await getMemory("supply");
      const entry = await recordSupplyDecision(memory, { ...ctx, option: label, reason: `Décidé dans Décider (${session.title})`, expected: keyResults[0].label ? `${keyResults[0].label} : ${keyResults[0].start} → ${keyResults[0].target}` : "", sessionId: session.id });
      journalId = entry.id;
    } catch { /* mémoire indisponible : le suivi reste utilisable */ }
  }
  return { scenarioId, label, decidedAt, keyResults, reviewDate: krDeadline, journalId };
}

// Valeur actuelle d'un résultat clé relié à un indicateur Supply.
export function liveKrValue(kr: KeyResult): number | undefined {
  if (!kr.kpiId || !kr.entityKey) return undefined;
  try { return valueForEntity(loadVocab(), kr.kpiId, kr.entityKey); } catch { return undefined; }
}
