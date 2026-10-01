// Modèles des schémas Supply (ontologie, graphe causal, chaîne d'une alerte).
// Fonctions pures : elles ne lisent que le vocabulaire du Studio et les
// valeurs réellement observées, jamais une donnée inventée. Le rendu SVG est
// dans components/aura/studio/SupplyDiagrams.tsx et ControlTowerShell.tsx.
import {
  deriveObservation, evaluateCausalRules, kpiStatus,
  type ArgusVocab, type CausalRule, type CausalRuleEvaluation, type EntityRelationship, type KpiDef, type RelationshipCardinality,
} from "./argus-vocab-store";
import { ENTITY_KEYS, kpiEntity, kpiSnapshot } from "./rule-scope";
import { attributeValues, DETAIL_OBJECTS } from "./supply-model";
import { freshness } from "./supply-lineage";

export type Status = "ok" | "alerte" | "critique";

// ── Ontologie ───────────────────────────────────────────────────────────────
// Position de référence des objets Supply Chain (viewBox 1200 × 640) : trois
// rangées (acteurs amont, flux, positions), relations lisibles sans chevauchement.
export const ONTOLOGY_VIEW = { width: 1200, height: 640 };
const LAYOUT: Record<string, { x: number; y: number }> = {
  "sc-fournisseur": { x: 430, y: 90 },
  "sc-perturbation": { x: 900, y: 90 },
  "sc-article": { x: 190, y: 330 },
  "sc-commande": { x: 600, y: 330 },
  "sc-expedition": { x: 1000, y: 330 },
  "sc-prevision": { x: 130, y: 560 },
  "sc-stock": { x: 430, y: 560 },
  "sc-site": { x: 730, y: 560 },
  "sc-commande-client": { x: 1040, y: 560 },
};
// Relations tracées en arc pour contourner les objets.
const BENDS: Record<string, number> = { "sc-r11": 64 };

export const NODE_W = 210;
export const NODE_W_OPEN = 290;
export const ATTR_H = 66;
const HEAD_H = 50;
const KPI_H = 26;

export interface OntologyKpi { id: string; label: string; unit: string; value?: number; status: Status; seuilAlerte: number; seuilCritique: number; direction: KpiDef["direction"] }
export interface OntologyNode {
  id: string; name: string; description?: string;
  x: number; y: number; w: number; h: number;
  attributeCount: number; mappedCount: number;
  keys: string[];
  kpis: OntologyKpi[];
  baseH: number;
  anchor: { x: number; y: number }; // position de référence (centre de l'en-tête), avant décalage des rangées
  attributes?: { id: string; name: string; type: string; source?: string; value?: string; count: number; fresh?: string }[];
}
export interface OntologyEdge {
  id: string; label: string; cardinality: RelationshipCardinality;
  from: string; to: string;
  path: string;               // tracé SVG
  mid: { x: number; y: number };
  fromEnd: { x: number; y: number; text: string };
  toEnd: { x: number; y: number; text: string };
}

export function kpiReading(vocab: ArgusVocab, kpi: KpiDef): OntologyKpi {
  const value = deriveObservation(vocab, kpi.id)?.value;
  return {
    id: kpi.id, label: kpi.label, unit: kpi.unit, value, direction: kpi.direction,
    status: value === undefined ? "ok" : kpiStatus({ ...kpi, currentValue: value }),
    seuilAlerte: kpi.seuilAlerte, seuilCritique: kpi.seuilCritique,
  };
}

// Point où la droite centre → cible sort du rectangle du nœud.
function clip(n: OntologyNode, tx: number, ty: number): { x: number; y: number } {
  const cx = n.x, cy = n.y + n.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = (n.w / 2 + 4) / Math.abs(dx || 1e-9), sy = (n.h / 2 + 4) / Math.abs(dy || 1e-9);
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

export function ontologyGraph(vocab: ArgusVocab, expanded: Set<string> = new Set()): { nodes: OntologyNode[]; edges: OntologyEdge[]; unplaced: string[]; height: number } {
  // Schéma principal : les objets de détail (sources approuvées, historiques, lots…) sont listés ailleurs.
  const entities = (vocab.entities ?? []).filter(e => !DETAIL_OBJECTS.has(e.id));
  const links = vocab.entityMappings ?? [];
  const extra = entities.filter(e => !LAYOUT[e.id]);
  const kpisByEntity = new Map<string, KpiDef[]>();
  for (const k of vocab.kpis) {
    const e = kpiEntity(vocab, k) ?? k.entityId;
    if (e) kpisByEntity.set(e, [...(kpisByEntity.get(e) ?? []), k]);
  }
  const nodes: OntologyNode[] = entities.map(e => {
    const extraIndex = extra.indexOf(e);
    const pos = vocab.layout?.ontologie?.[e.id] ?? LAYOUT[e.id] ?? { x: 110 + (extraIndex % 5) * 240, y: ONTOLOGY_VIEW.height + 40 + Math.floor(extraIndex / 5) * 150 };
    const kpis = (kpisByEntity.get(e.id) ?? []).map(k => kpiReading(vocab, k));
    const baseH = HEAD_H + kpis.length * KPI_H + (kpis.length ? 6 : 0);
    const open = expanded.has(e.id);
    const attributes = open ? entityDetail(vocab, e.id)?.attributes.map(a => ({
      id: a.id, name: a.name, type: a.type,
      source: a.field ? `${(a.app ?? "").split(" · ")[0]} · ${a.field.replace(/\s*\(.*\)$/, "")}` : undefined,
      value: a.sample[0], count: a.count, fresh: freshness(a.fetchedAt),
    })) : undefined;
    const h = baseH + (attributes ? 8 + attributes.length * ATTR_H : 0);
    return {
      id: e.id, name: e.name, description: e.description,
      x: pos.x, y: pos.y - baseH / 2, w: open ? NODE_W_OPEN : NODE_W, h, baseH, attributes, anchor: { x: pos.x, y: pos.y },
      attributeCount: e.attributes.length,
      mappedCount: e.attributes.filter(a => links.some(l => l.entityId === e.id && l.attributeId === a.id)).length,
      keys: ENTITY_KEYS[e.id] ?? [],
      kpis,
    };
  });
  // Un objet déplié grandit vers le bas : les rangées suivantes descendent d'autant.
  const rows = [...new Set(nodes.map(n => n.y + n.baseH / 2))].sort((a, b) => a - b);
  let shift = 0;
  for (const r of rows) {
    const inRow = nodes.filter(n => n.y + n.baseH / 2 === r);
    inRow.forEach(n => { n.y += shift; });
    shift += Math.max(0, ...inRow.map(n => n.h - n.baseH));
  }
  const byId = new Map(nodes.map(n => [n.id, n]));
  const edges: OntologyEdge[] = (vocab.relationships ?? []).flatMap((r: EntityRelationship) => {
    const a = byId.get(r.fromEntityId), b = byId.get(r.toEntityId);
    if (!a || !b) return [];
    const ac = { x: a.x, y: a.y + a.h / 2 }, bc = { x: b.x, y: b.y + b.h / 2 };
    const bend = BENDS[r.id] ?? 0;
    const [fromTxt, toTxt] = r.cardinality === "1-1" ? ["1", "1"] : r.cardinality === "1-N" ? ["1", "N"] : ["N", "N"];
    if (bend) {
      // Arc sous les objets : départ et arrivée par le bas.
      const p1 = { x: a.x, y: a.y + a.h + 4 }, p2 = { x: b.x, y: b.y + b.h + 4 };
      const low = Math.max(p1.y, p2.y) + bend;
      return [{
        id: r.id, label: r.label, cardinality: r.cardinality, from: a.id, to: b.id,
        path: `M ${p1.x} ${p1.y} C ${p1.x} ${low} ${p2.x} ${low} ${p2.x} ${p2.y}`,
        mid: { x: (p1.x + p2.x) / 2, y: Math.max(p1.y, p2.y) + bend * 0.75 },
        fromEnd: { x: p1.x + 12, y: p1.y + 16, text: fromTxt },
        toEnd: { x: p2.x - 12, y: p2.y + 16, text: toTxt },
      }];
    }
    const p1 = clip(a, bc.x, bc.y), p2 = clip(b, ac.x, ac.y);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const ux = (p2.x - p1.x) / len, uy = (p2.y - p1.y) / len;
    // Cardinalités posées à côté de chaque extrémité, décalées de la ligne.
    const off = (p: { x: number; y: number }, along: number) => ({ x: p.x + ux * along - uy * 11, y: p.y + uy * along + ux * 11 + 4 });
    return [{
      id: r.id, label: r.label, cardinality: r.cardinality, from: a.id, to: b.id,
      path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
      fromEnd: { ...off(p1, 16), text: fromTxt },
      toEnd: { ...off(p2, -16), text: toTxt },
    }];
  });
  const height = Math.max(ONTOLOGY_VIEW.height, ...nodes.map(n => n.y + n.h + 30), ...edges.map(e => e.mid.y + 30));
  return { nodes, edges, unplaced: extra.map(e => e.id), height };
}

export function nextCardinality(c: RelationshipCardinality): RelationshipCardinality {
  return c === "1-1" ? "1-N" : c === "1-N" ? "N-N" : "1-1";
}

export function setRelationshipCardinality(vocab: ArgusVocab, relId: string, cardinality: RelationshipCardinality): ArgusVocab {
  return { ...vocab, relationships: (vocab.relationships ?? []).map(r => r.id === relId ? { ...r, cardinality } : r) };
}

// Détail d'un objet cliqué : attributs (branchement, source, valeurs lues) et indicateurs.
export function entityDetail(vocab: ArgusVocab, entityId: string) {
  const entity = (vocab.entities ?? []).find(e => e.id === entityId);
  if (!entity) return undefined;
  const attributes = entity.attributes.map(a => {
    const link = (vocab.entityMappings ?? []).find(l => l.entityId === entityId && l.attributeId === a.id && l.isMaster)
      ?? (vocab.entityMappings ?? []).find(l => l.entityId === entityId && l.attributeId === a.id);
    const field = link ? vocab.fields.find(f => f.id === link.fieldId) : undefined;
    const obs = attributeValues(vocab, entityId, a.id);
    return { id: a.id, name: a.name, type: a.type, field: field?.name, app: link ? vocab.apps.find(x => x.id === link.appId)?.label : undefined, master: link?.isMaster ?? false, sample: obs.values.slice(0, 3), count: obs.count, fetchedAt: obs.fetchedAt };
  });
  const kpis = vocab.kpis.filter(k => (kpiEntity(vocab, k) ?? k.entityId) === entityId).map(k => {
    const m = vocab.mappings.find(x => x.kpiId === k.id && !x.condition) ?? vocab.mappings.find(x => x.kpiId === k.id);
    const field = m ? vocab.fields.find(f => f.id === m.fieldId) : undefined;
    return { ...kpiReading(vocab, k), field: field?.name };
  });
  const relations = (vocab.relationships ?? []).filter(r => r.fromEntityId === entityId || r.toEntityId === entityId).map(r => ({
    id: r.id, label: r.label, cardinality: r.cardinality,
    other: (vocab.entities ?? []).find(e => e.id === (r.fromEntityId === entityId ? r.toEntityId : r.fromEntityId))?.name ?? "?",
    outgoing: r.fromEntityId === entityId,
  }));
  return { entity, attributes, kpis, relations };
}

// ── Graphe causal : indicateurs → conditions → règles → conclusion/options ──
export interface FlowKpi { id: string; label: string; unit: string; value?: number; status: Status; seuilAlerte: number; seuilCritique: number; sens: "≥" | "≤"; y: number }
export interface FlowCondition { id: string; ruleId: string; kpiId?: string; refRuleId?: string; text: string; seuil?: string; met: boolean; y: number }
export interface FlowRule { id: string; label: string; severity: CausalRule["severity"]; triggered: boolean; enabled: boolean; entities: string[]; scope?: string; y: number; conclusion: string; options: string[] }
export interface CausalFlow { kpis: FlowKpi[]; conditions: FlowCondition[]; rules: FlowRule[]; height: number }

export const FLOW_ROW = 46;

export function causalFlow(vocab: ArgusVocab, evaluations: CausalRuleEvaluation[] = evaluateCausalRules(vocab)): CausalFlow {
  const rules = evaluations.filter(e => e.rule.conditions.length > 0);
  const kpiById = new Map(vocab.kpis.map(k => [k.id, k]));
  const readings = new Map<string, FlowKpi>();
  const conditions: FlowCondition[] = [];
  const flowRules: FlowRule[] = [];
  let y = 30;
  for (const e of rules) {
    const band = Math.max(e.rule.conditions.length, 2) * FLOW_ROW;
    const top = e.matches[0];
    e.rule.conditions.forEach((c, i) => {
      const cy = y + (band - e.rule.conditions.length * FLOW_ROW) / 2 + i * FLOW_ROW + FLOW_ROW / 2;
      if (c.ruleId) {
        const ref = evaluations.find(x => x.rule.id === c.ruleId);
        conditions.push({ id: `${e.rule.id}#${i}`, ruleId: e.rule.id, refRuleId: c.ruleId, text: `« ${ref?.rule.label ?? c.ruleId} » déclenchée`, met: ref?.triggered ?? false, y: cy });
        return;
      }
      const kpi = c.kpiId ? kpiById.get(c.kpiId) : undefined;
      if (!kpi) return;
      if (!readings.has(kpi.id)) {
        const r = kpiReading(vocab, kpi);
        readings.set(kpi.id, { ...r, sens: kpi.direction === "au_dessus_alerte" ? "≥" : "≤", y: 0 });
      }
      const seuil = c.minStatus === "critique" ? kpi.seuilCritique : kpi.seuilAlerte;
      const sens = kpi.direction === "au_dessus_alerte" ? "≥" : "≤";
      const reading = readings.get(kpi.id)!;
      const met = top ? top.facts.some(f => f.kpiId === kpi.id) : reading.status !== "ok" && (c.minStatus !== "critique" || reading.status === "critique");
      conditions.push({ id: `${e.rule.id}#${i}`, ruleId: e.rule.id, kpiId: kpi.id, text: `${c.minStatus === "critique" ? "critique" : "alerte"} ${sens} ${seuil.toLocaleString("fr-FR")} ${kpi.unit}`, seuil: `${sens} ${seuil}`, met, y: cy });
    });
    flowRules.push({
      id: e.rule.id, label: e.rule.label, severity: e.rule.severity, triggered: e.triggered, enabled: e.rule.alertEnabled !== false,
      entities: e.matches.map(m => m.label), scope: e.scope.kind === "entite" ? e.scope.entityName : undefined,
      y: y + band / 2, conclusion: e.rule.conclusion, options: e.rule.options ?? [],
    });
    y += band + 14;
  }
  // Indicateurs : à hauteur moyenne de leurs conditions, sans chevauchement.
  const kpis = [...readings.values()].map(k => {
    const ys = conditions.filter(c => c.kpiId === k.id).map(c => c.y);
    return { ...k, y: ys.reduce((s, v) => s + v, 0) / ys.length };
  }).sort((a, b) => a.y - b.y);
  for (let i = 1; i < kpis.length; i++) if (kpis[i].y < kpis[i - 1].y + FLOW_ROW + 8) kpis[i].y = kpis[i - 1].y + FLOW_ROW + 8;
  const height = Math.max(y, ...kpis.map(k => k.y + FLOW_ROW)) + 10;
  return { kpis, conditions, rules: flowRules, height };
}

// ── Chaîne de causalité d'une alerte (cockpit) ─────────────────────────────
export interface AlertChain {
  entity?: string;          // « SUP-001 · Tessitura Milano »
  scope?: string;           // « Fournisseur »
  others: number;           // autres entités concernées
  indicators: { kpiId: string; label: string; value: number; unit: string; seuil: number; sens: "≥" | "≤"; status: Status }[];
  rule: { id: string; label: string; conditions: number };
  /** Conséquences en chaîne jusqu'à la décision (règles de résilience). */
  consequences: string[];
  decision: string;
}

export function alertChain(vocab: ArgusVocab, evaluation: CausalRuleEvaluation): AlertChain {
  const top = evaluation.matches[0];
  const indicators = evaluation.rule.conditions.flatMap(c => {
    const kpi = c.kpiId ? vocab.kpis.find(k => k.id === c.kpiId) : undefined;
    if (!kpi) return [];
    const value = top?.facts.find(f => f.kpiId === kpi.id)?.value ?? deriveObservation(vocab, kpi.id)?.value;
    if (value === undefined) return [];
    const seuil = c.minStatus === "critique" ? kpi.seuilCritique : kpi.seuilAlerte;
    return [{ kpiId: kpi.id, label: kpi.label, value, unit: kpi.unit, seuil, sens: kpi.direction === "au_dessus_alerte" ? "≥" as const : "≤" as const, status: kpiStatus({ ...kpi, currentValue: value }) }];
  });
  return {
    entity: top?.label, scope: evaluation.scope.kind === "entite" ? evaluation.scope.entityName : undefined,
    others: Math.max(0, evaluation.matches.length - 1), indicators,
    rule: { id: evaluation.rule.id, label: evaluation.rule.label, conditions: evaluation.rule.conditions.length },
    consequences: (evaluation.rule.consequences ?? []).filter(c => !/^Décision/.test(c)),
    decision: evaluation.rule.decisionQuestion ?? evaluation.rule.conclusion,
  };
}

// Tendance de l'indicateur pour l'entité concernée : série datée de la même
// entité (semaine, période) si la source en porte une, sinon évaluation
// précédente reconstituée depuis la colonne `trend` publiée par la source.
export interface TrendPoint { label: string; value: number }
const TIME_COLUMNS = ["week", "period", "date", "assessedAt", "lastCountAt"];
export function entityTrend(vocab: ArgusVocab, kpiId: string, record: Record<string, string> | undefined): { points: TrendPoint[]; source: "série" | "tendance publiée" } | undefined {
  const kpi = vocab.kpis.find(k => k.id === kpiId);
  const snap = kpiSnapshot(vocab, kpiId);
  if (!kpi || !snap || !record) return undefined;
  const m = vocab.mappings.find(x => x.kpiId === kpiId && !x.condition) ?? vocab.mappings.find(x => x.kpiId === kpiId);
  const field = m ? vocab.fields.find(f => f.id === m.fieldId) : undefined;
  if (!field) return undefined;
  const base = field.name.replace(/\s*\(.*\)$/, "");
  const column = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  const num = (v: string | undefined) => { const n = Number(String(v ?? "").replace(",", ".")); return v !== undefined && v !== "" && Number.isFinite(n) ? n : undefined; };
  const time = TIME_COLUMNS.find(c => snap.columns.includes(c) && c !== column);
  const entity = kpiEntity(vocab, kpi);
  const idCols = (entity ? ENTITY_KEYS[entity] : []).filter(c => c !== time);
  if (time && idCols.length) {
    const rows = snap.rows.filter(r => idCols.every(c => r[c] === record[c]) && num(r[column]) !== undefined);
    if (rows.length >= 2) {
      return { points: rows.map(r => ({ label: r[time], value: num(r[column])! })).sort((a, b) => a.label.localeCompare(b.label)), source: "série" };
    }
  }
  const trend = num(record.trend), now = num(record[column]);
  if (trend !== undefined && now !== undefined && trend !== 0) {
    return { points: [{ label: "précédente", value: now - trend }, { label: "actuelle", value: now }], source: "tendance publiée" };
  }
  return undefined;
}
