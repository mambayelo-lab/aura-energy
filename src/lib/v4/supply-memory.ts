// Mémoire Supply : branchement du module générique src/lib/memoire sur le
// produit « supply ». Trois usages :
//  1. décisions prises depuis une alerte (option, raison, résultat attendu,
//     valeur de l'indicateur au moment de la décision) ;
//  2. journal « décision → résultat » : valeur au moment de la décision puis
//     valeur lue aujourd'hui pour la même entité ;
//  3. versions du modèle (indicateurs, seuils, règles, mappings, relations),
//     avec annuler / rétablir et retour à une version.
// Fonctions pures, sauf recordSupplyDecision qui écrit dans la mémoire.
import type { AuraMemory, MemoryEntry } from "../memoire/memoire";
import {
  kpiStatus,
  type ArgusVocab, type CausalRuleEvaluation, type KpiDirection,
} from "./argus-vocab-store";
import { ENTITY_KEYS, kpiEntity, kpiSnapshot } from "./rule-scope";

export const SUPPLY_MODEL_PROJECT = "supply-modele";

// ── Décisions ───────────────────────────────────────────────────────────────
export interface SupplyDecisionInput {
  alertId: string;
  alertLabel: string;
  entity?: string;       // « SUP-001 · Tessitura Milano »
  entityKey?: string;    // clé de l'enregistrement de l'indicateur (« SUP-001 », « BAG-ORION · WH-LIL »)
  kpiId?: string;
  kpiLabel?: string;
  unit?: string;
  direction?: KpiDirection;
  valueAtDecision?: number;
  option: string;
  reason: string;
  expected: string;
  sessionId?: string; // décision Décider correspondante (même objet que son suivi)
}
export interface SupplyDecision extends SupplyDecisionInput { id: string; createdAt: string }

// Contexte d'une alerte au moment de décider : entité la plus grave et valeur
// de l'indicateur principal pour elle (jamais une valeur estimée).
export function decisionContext(vocab: ArgusVocab, evaluation: CausalRuleEvaluation): Omit<SupplyDecisionInput, "option" | "reason" | "expected"> {
  const top = evaluation.matches[0];
  const kpiId = evaluation.rule.conditions.find(c => c.kpiId)?.kpiId;
  const kpi = kpiId ? vocab.kpis.find(k => k.id === kpiId) : undefined;
  const fact = top?.facts.find(f => f.kpiId === kpiId);
  const entityId = kpi ? kpiEntity(vocab, kpi) : undefined;
  const entityKey = fact?.record && entityId ? ENTITY_KEYS[entityId].map(c => fact.record![c]).filter(Boolean).join(" · ") || undefined : undefined;
  return {
    alertId: evaluation.rule.id, alertLabel: evaluation.rule.label,
    entity: top?.label, entityKey,
    kpiId, kpiLabel: kpi?.label, unit: kpi?.unit, direction: kpi?.direction,
    valueAtDecision: fact?.value,
  };
}

export async function recordSupplyDecision(memory: AuraMemory, d: SupplyDecisionInput) {
  const subject = `${d.alertLabel}${d.entity ? ` · ${d.entity}` : ""} → ${d.option}`;
  return memory.decide(subject, "accepte", d.reason, undefined, { kind: "supply-decision", ...d });
}

export function supplyDecisions(entries: MemoryEntry[]): SupplyDecision[] {
  return entries.flatMap(e => {
    const p = e.payload as (SupplyDecisionInput & { kind?: string }) | undefined;
    return e.kind === "decision" && p?.kind === "supply-decision" ? [{ ...p, id: e.id, createdAt: e.createdAt }] : [];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR");

// « La dernière fois sur SUP-001 · Tessitura Milano (12/09/2026), vous avez choisi « Dual source » … »
export function memoryHint(decisions: SupplyDecision[], where: { entity?: string; alertId?: string }): string | undefined {
  const same = decisions.find(d => where.entity && d.entity === where.entity) ?? decisions.find(d => where.alertId && d.alertId === where.alertId);
  if (!same) return undefined;
  const on = same.entity ?? same.alertLabel;
  return `La dernière fois sur ${on} (${day(same.createdAt)}), vous avez choisi « ${same.option} »${same.reason ? ` — raison : ${same.reason}` : ""}${same.expected ? ` ; résultat attendu : ${same.expected}` : ""}.`;
}

// ── Journal « décision → résultat » ─────────────────────────────────────────
// Valeur lue aujourd'hui pour la même entité (la plus défavorable si
// plusieurs enregistrements portent la même clé).
export function valueForEntity(vocab: ArgusVocab, kpiId: string, entityKey: string): number | undefined {
  const kpi = vocab.kpis.find(k => k.id === kpiId);
  const snap = kpiSnapshot(vocab, kpiId);
  const entityId = kpi ? kpiEntity(vocab, kpi) : undefined;
  if (!kpi || !snap || !entityId) return undefined;
  const m = vocab.mappings.find(x => x.kpiId === kpiId && !x.condition) ?? vocab.mappings.find(x => x.kpiId === kpiId);
  const field = m ? vocab.fields.find(f => f.id === m.fieldId) : undefined;
  if (!field) return undefined;
  const base = field.name.replace(/\s*\(.*\)$/, "");
  const column = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  const values = snap.rows
    .filter(r => ENTITY_KEYS[entityId].map(c => r[c]).filter(Boolean).join(" · ") === entityKey)
    .map(r => Number(String(r[column] ?? "").replace(",", ".")))
    .filter(v => Number.isFinite(v));
  if (!values.length) return undefined;
  return kpi.direction === "au_dessus_alerte" ? Math.max(...values) : Math.min(...values);
}

export type Outcome = "amélioration" | "dégradation" | "stable" | "inconnu";
export interface JournalRow {
  id: string; date: string; alert: string; entity?: string; option: string; reason: string; expected: string;
  kpiLabel?: string; unit?: string;
  before?: number; now?: number; delta?: number; outcome: Outcome;
  statusBefore?: "ok" | "alerte" | "critique"; statusNow?: "ok" | "alerte" | "critique";
  sessionId?: string; // suivi correspondant dans Décider
  /** Niveau d'autonomie (cadre Revilla et Sáenz) : Aura propose, une personne valide. */
  mode: "assistée" | "semi-autonome" | "autonome bornée";
  /** Qui a validé : Décider (parcours complet) ou saisie directe du journal. */
  validation: string;
}

export function decisionJournal(vocab: ArgusVocab, decisions: SupplyDecision[]): JournalRow[] {
  return decisions.map(d => {
    const kpi = d.kpiId ? vocab.kpis.find(k => k.id === d.kpiId) : undefined;
    const now = d.kpiId && d.entityKey ? valueForEntity(vocab, d.kpiId, d.entityKey) : undefined;
    const before = d.valueAtDecision;
    const delta = now !== undefined && before !== undefined ? Math.round((now - before) * 100) / 100 : undefined;
    const higherIsWorse = (kpi?.direction ?? d.direction) !== "en_dessous_alerte";
    const outcome: Outcome = delta === undefined ? "inconnu" : delta === 0 ? "stable" : (delta < 0) === higherIsWorse ? "amélioration" : "dégradation";
    return {
      id: d.id, date: d.createdAt, alert: d.alertLabel, entity: d.entity, option: d.option, reason: d.reason, expected: d.expected,
      kpiLabel: kpi?.label ?? d.kpiLabel, unit: kpi?.unit ?? d.unit, before, now, delta, outcome, sessionId: d.sessionId,
      mode: "assistée", validation: d.sessionId ? "validée dans Décider (options comparées)" : "validée par une personne",
      statusBefore: kpi && before !== undefined ? kpiStatus({ ...kpi, currentValue: before }) : undefined,
      statusNow: kpi && now !== undefined ? kpiStatus({ ...kpi, currentValue: now }) : undefined,
    };
  });
}

export function journalSummary(rows: JournalRow[]) {
  const count = (o: Outcome) => rows.filter(r => r.outcome === o).length;
  return { total: rows.length, improved: count("amélioration"), worse: count("dégradation"), stable: count("stable"), unknown: count("inconnu"), resolved: rows.filter(r => r.statusBefore && r.statusBefore !== "ok" && r.statusNow === "ok").length };
}

// Impact déjà observé d'une option : une décision passée avec la même option
// sur la même alerte, dont le résultat a été mesuré. Sinon rien (« à confirmer »).
export function observedImpact(journal: JournalRow[], alertLabel: string, option: string): JournalRow | undefined {
  return journal.find(r => r.alert === alertLabel && r.option === option && r.delta !== undefined);
}

// ── Versions du modèle ──────────────────────────────────────────────────────
export interface ModelSnapshot {
  kpis: ArgusVocab["kpis"];
  causalRules: ArgusVocab["causalRules"];
  mappings: ArgusVocab["mappings"];
  entities?: ArgusVocab["entities"];
  relationships?: ArgusVocab["relationships"];
  entityMappings?: ArgusVocab["entityMappings"];
  removedStandard?: ArgusVocab["removedStandard"];
  layout?: ArgusVocab["layout"];
}

export function modelSnapshot(v: ArgusVocab): ModelSnapshot {
  // Les valeurs lues (currentValue, updatedAt) ne sont pas du modèle.
  return structuredCloneSafe({
    kpis: v.kpis.map(({ currentValue: _c, updatedAt: _u, ...k }) => k),
    causalRules: v.causalRules, mappings: v.mappings,
    entities: v.entities, relationships: v.relationships, entityMappings: v.entityMappings, removedStandard: v.removedStandard, layout: v.layout,
  });
}

function structuredCloneSafe<T>(x: T): T { return JSON.parse(JSON.stringify(x)) as T; }

export function sameModel(a: ModelSnapshot, b: ModelSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function applyModelSnapshot(v: ArgusVocab, s: ModelSnapshot): ArgusVocab {
  const values = new Map(v.kpis.map(k => [k.id, { currentValue: k.currentValue, updatedAt: k.updatedAt }]));
  return {
    ...v,
    kpis: s.kpis.map(k => ({ ...k, ...(values.get(k.id) ?? {}) })),
    causalRules: s.causalRules, mappings: s.mappings,
    entities: s.entities, relationships: s.relationships, entityMappings: s.entityMappings, removedStandard: s.removedStandard, layout: s.layout,
  };
}

// Libellé lisible d'une modification du modèle (première différence trouvée).
export function describeModelChange(prev: ModelSnapshot, next: ModelSnapshot): string {
  const changes: string[] = [];
  const byId = <T extends { id: string }>(xs: T[] | undefined) => new Map((xs ?? []).map(x => [x.id, x]));
  const pk = byId(prev.kpis), nk = byId(next.kpis);
  for (const k of next.kpis) {
    const o = pk.get(k.id);
    if (!o) changes.push(`Indicateur ajouté : ${k.label}`);
    else if (o.seuilAlerte !== k.seuilAlerte || o.seuilCritique !== k.seuilCritique) changes.push(`Seuils de ${k.label} : ${o.seuilAlerte}/${o.seuilCritique} → ${k.seuilAlerte}/${k.seuilCritique}`);
    else if (JSON.stringify(o) !== JSON.stringify(k)) changes.push(`Indicateur modifié : ${k.label}`);
  }
  for (const k of prev.kpis) if (!nk.has(k.id)) changes.push(`Indicateur supprimé : ${k.label}`);
  const pr = byId(prev.causalRules), nr = byId(next.causalRules);
  for (const r of next.causalRules) {
    const o = pr.get(r.id);
    if (!o) changes.push(`Règle ajoutée : ${r.label}`);
    else if (o.alertEnabled !== r.alertEnabled) changes.push(`Règle ${r.alertEnabled === false ? "désactivée" : "activée"} : ${r.label}`);
    else if (JSON.stringify(o) !== JSON.stringify(r)) changes.push(`Règle modifiée : ${r.label}`);
  }
  for (const r of prev.causalRules) if (!nr.has(r.id)) changes.push(`Règle supprimée : ${r.label}`);
  const kpiLabel = (id: string) => next.kpis.find(k => k.id === id)?.label ?? prev.kpis.find(k => k.id === id)?.label ?? id;
  const pm = byId(prev.mappings), nm = byId(next.mappings);
  for (const m of next.mappings) { const o = pm.get(m.id); if (!o) changes.push(`Mapping ajouté : ${kpiLabel(m.kpiId)}`); else if (JSON.stringify(o) !== JSON.stringify(m)) changes.push(`Mapping modifié : ${kpiLabel(m.kpiId)}`); }
  for (const m of prev.mappings) if (!nm.has(m.id)) changes.push(`Mapping retiré : ${kpiLabel(m.kpiId)}`);
  const prl = byId(prev.relationships), nrl = byId(next.relationships);
  for (const r of next.relationships ?? []) { const o = prl.get(r.id); if (o && o.cardinality !== r.cardinality) changes.push(`Relation « ${r.label} » : ${o.cardinality} → ${r.cardinality}`); else if (!o) changes.push(`Relation ajoutée : ${r.label}`); }
  for (const r of prev.relationships ?? []) if (!nrl.has(r.id)) changes.push(`Relation supprimée : ${r.label}`);
  if (JSON.stringify(prev.entityMappings ?? []) !== JSON.stringify(next.entityMappings ?? [])) changes.push("Branchements d'attributs modifiés");
  if (JSON.stringify(prev.entities ?? []) !== JSON.stringify(next.entities ?? [])) changes.push("Objets métier modifiés");
  if (JSON.stringify(prev.layout ?? {}) !== JSON.stringify(next.layout ?? {})) changes.push(next.layout && Object.keys(next.layout).length ? "Mise en page modifiée" : "Mise en page réorganisée");
  if (!changes.length) return "Modèle modifié";
  return changes.length > 2 ? `${changes.slice(0, 2).join(" ; ")} (+${changes.length - 2})` : changes.join(" ; ");
}

// Pile annuler / rétablir, indépendante du stockage.
export class ModelUndoStack {
  past: ModelSnapshot[] = [];
  future: ModelSnapshot[] = [];
  constructor(public current: ModelSnapshot, private limit = 50) {}
  /** Enregistre un nouvel état ; renvoie false s'il est identique au courant. */
  push(next: ModelSnapshot): boolean {
    if (sameModel(next, this.current)) return false;
    this.past = [...this.past, this.current].slice(-this.limit);
    this.future = [];
    this.current = next;
    return true;
  }
  undo(): ModelSnapshot | undefined {
    const prev = this.past.pop();
    if (!prev) return undefined;
    this.future = [this.current, ...this.future];
    this.current = prev;
    return prev;
  }
  redo(): ModelSnapshot | undefined {
    const [next, ...rest] = this.future;
    if (!next) return undefined;
    this.past = [...this.past, this.current];
    this.future = rest;
    this.current = next;
    return next;
  }
}
