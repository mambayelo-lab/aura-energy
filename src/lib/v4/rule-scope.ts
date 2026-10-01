// Portée d'une règle causale : sur quelle entité métier (fournisseur, SKU sur
// un site, expédition…) toutes ses conditions doivent-elles être vraies en
// même temps ? Déduite de l'ontologie Supply Chain (supply-model.ts) : l'objet
// rattaché à chaque indicateur, les clés de chaque objet et les relations
// entre objets. Aucun réglage demandé à l'utilisateur.
//
// Règle de déduction :
//  - toutes les conditions portent sur le même objet → la règle s'applique
//    par cet objet (même fournisseur, même SKU/site…) ;
//  - objets différents mais reliés → la règle s'applique par l'objet commun le
//    plus proche en remontant les relations (Stock → Article → Fournisseur :
//    « le stock des articles de ce fournisseur ») ;
//  - aucun objet commun → incohérence, signalée par l'éditeur de règle.
//
// Ce module ne référence les constantes de supply-model qu'à l'intérieur des
// fonctions (import circulaire avec argus-vocab-store).
import type { ArgusVocab, CausalCondition, EntityRelationship, KpiDef, SiTableSnapshot } from "./argus-vocab-store";
import { SUPPLY_CHAIN_ENTITIES, SUPPLY_CHAIN_RELATIONSHIPS } from "./supply-model";

// Colonnes clés de chaque objet dans les sources (SI Maison Lucie).
export const ENTITY_KEYS: Record<string, string[]> = {
  "sc-fournisseur": ["supplierId"],
  "sc-article": ["sku"],
  "sc-site": ["siteId"],
  "sc-stock": ["sku", "siteId"],
  "sc-commande": ["purchaseOrderId"],
  "sc-expedition": ["shipmentId"],
  "sc-prevision": ["sku", "week"],
  "sc-perturbation": ["disruptionId"],
  "sc-commande-client": ["orderId"],
};

// Colonne lisible qui accompagne la clé (« SUP-001 · Tessitura Milano »).
const LABEL_COLUMNS: Record<string, string[]> = {
  "sc-fournisseur": ["supplier", "name"],
  "sc-article": ["description"],
  "sc-site": ["name"],
  "sc-expedition": ["carrier"],
  "sc-perturbation": ["title"],
  "sc-commande-client": ["customer"],
};

// Clé étrangère portée par l'objet « vers » d'une relation, quand elle ne
// s'appelle pas comme la clé de l'objet « de ».
const JOIN_COLUMNS: Record<string, string[]> = {
  "sc-r7": ["destinationSiteId"],
  "sc-r8": ["primarySupplierId"],
  "sc-r9": ["disruptionId"],
};

// Ancien identifiant d'objet encore présent dans des vocabulaires enregistrés.
const ENTITY_ALIASES: Record<string, string> = { "e-fournisseur": "sc-fournisseur" };

export function normalizeEntityId(id: string | undefined): string | undefined {
  if (!id) return undefined;
  const e = ENTITY_ALIASES[id] ?? id;
  return ENTITY_KEYS[e] ? e : undefined;
}

export function entityName(vocab: ArgusVocab, entityId: string): string {
  return (vocab.entities ?? []).find(e => e.id === entityId)?.name
    ?? SUPPLY_CHAIN_ENTITIES.find(e => e.id === entityId)?.name
    ?? entityId;
}

function relationships(vocab: ArgusVocab): EntityRelationship[] {
  const own = vocab.relationships ?? [];
  const ids = new Set(own.map(r => r.id));
  return [...own, ...SUPPLY_CHAIN_RELATIONSHIPS.filter(r => !ids.has(r.id))];
}

// Une relation se remonte « vers → de » quand chaque objet « vers » désigne un
// seul objet « de » par une clé étrangère : relation 1-N, 1-1, ou colonne de
// jointure connue (Expédition.disruptionId).
interface UpEdge { rel: EntityRelationship; parent: string; columns: string[] }
function parentsOf(vocab: ArgusVocab, entityId: string): UpEdge[] {
  return relationships(vocab).flatMap(rel => {
    if (rel.toEntityId !== entityId || !ENTITY_KEYS[rel.fromEntityId]) return [];
    const columns = JOIN_COLUMNS[rel.id] ?? (ENTITY_KEYS[rel.fromEntityId].length === 1 ? ENTITY_KEYS[rel.fromEntityId] : []);
    if (!columns.length || (rel.cardinality === "N-N" && !JOIN_COLUMNS[rel.id])) return [];
    return [{ rel, parent: rel.fromEntityId, columns }];
  });
}

// Objets atteignables en remontant les relations, avec le chemin le plus court.
function upPaths(vocab: ArgusVocab, entityId: string): Map<string, UpEdge[]> {
  const paths = new Map<string, UpEdge[]>([[entityId, []]]);
  const queue = [entityId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const edge of parentsOf(vocab, cur)) {
      if (paths.has(edge.parent)) continue;
      paths.set(edge.parent, [...paths.get(cur)!, edge]);
      queue.push(edge.parent);
    }
  }
  return paths;
}

// Table mappée d'un indicateur (instantané lu dans le Studio), si elle existe.
export function kpiSnapshot(vocab: ArgusVocab, kpiId: string): SiTableSnapshot | undefined {
  const mapping = vocab.mappings.find(m => m.kpiId === kpiId && !m.condition) ?? vocab.mappings.find(m => m.kpiId === kpiId);
  const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
  if (!field) return undefined;
  const base = field.name.replace(/\s*\(.*\)$/, "");
  const column = base.includes(".") ? base.slice(base.lastIndexOf(".") + 1) : base;
  const table = field.liveTable ?? (base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : undefined);
  return (vocab.siTables ?? []).find(t => t.appId === field.appId && t.table === table && t.columns.includes(column));
}

// Objet mesuré par un indicateur : son rattachement explicite, sinon l'objet
// dont la table mappée porte les clés (le plus « fin » s'il y en a plusieurs).
export function kpiEntity(vocab: ArgusVocab, kpi: KpiDef): string | undefined {
  const explicit = normalizeEntityId(kpi.entityId);
  if (explicit) return explicit;
  const snap = kpiSnapshot(vocab, kpi.id);
  if (!snap) return undefined;
  const candidates = Object.keys(ENTITY_KEYS).filter(e => ENTITY_KEYS[e].every(c => snap.columns.includes(c)));
  if (!candidates.length) return undefined;
  const finest = candidates.find(c => { const up = upPaths(vocab, c); return candidates.every(o => up.has(o)); });
  return finest ?? [...candidates].sort((a, b) => ENTITY_KEYS[b].length - ENTITY_KEYS[a].length)[0];
}

export interface RuleScope {
  // "entite" : la règle s'applique par `entityId` ; "globale" : aucune
  // condition ne porte sur un objet identifiable (valeurs sans clé) ;
  // "incoherente" : objets sans relation dans l'ontologie.
  kind: "entite" | "globale" | "incoherente";
  entityId?: string;
  entityName?: string;
  // Objet de chaque condition KPI (index dans rule.conditions).
  conditionEntities: (string | undefined)[];
  // Chemin suivi pour chaque condition jusqu'à l'objet de la règle.
  paths: (UpEdge[] | undefined)[];
  // Texte court pour l'éditeur (« Fournisseur », « Fournisseur (Stock → Article → Fournisseur) »).
  summary: string;
}

export function ruleScope(vocab: ArgusVocab, conditions: CausalCondition[]): RuleScope {
  const conditionEntities = conditions.map(c => {
    if (!c.kpiId) return undefined;
    const kpi = vocab.kpis.find(k => k.id === c.kpiId);
    return kpi ? kpiEntity(vocab, kpi) : undefined;
  });
  const distinct = [...new Set(conditionEntities.filter((e): e is string => !!e))];
  if (!distinct.length) return { kind: "globale", conditionEntities, paths: conditions.map(() => undefined), summary: "ensemble des données (aucun objet identifié)" };
  const ups = new Map(distinct.map(e => [e, upPaths(vocab, e)]));
  const common = [...ups.get(distinct[0])!.keys()].filter(c => distinct.every(e => ups.get(e)!.has(c)));
  if (!common.length) {
    const names = distinct.map(e => entityName(vocab, e));
    return { kind: "incoherente", conditionEntities, paths: conditions.map(() => undefined), summary: `aucune relation entre ${names.join(" et ")} dans l'ontologie` };
  }
  const cost = (c: string) => distinct.reduce((s, e) => s + ups.get(e)!.get(c)!.length, 0);
  const target = [...common].sort((a, b) => cost(a) - cost(b))[0];
  const paths = conditionEntities.map(e => e ? ups.get(e)!.get(target) : undefined);
  const via = [...new Set(conditionEntities.filter((e): e is string => !!e && e !== target))]
    .map(e => [e, ...ups.get(e)!.get(target)!.map(edge => edge.parent)].map(x => entityName(vocab, x)).join(" → "));
  const name = entityName(vocab, target);
  return { kind: "entite", entityId: target, entityName: name, conditionEntities, paths, summary: via.length ? `${name} (${via.join(" ; ")})` : name };
}

// ── Résolution d'un enregistrement vers l'objet de la règle ────────────────
export type RowLookup = (columns: string[], keyColumn: string, keyValue: string) => Record<string, string> | undefined;

export function rowLookup(vocab: ArgusVocab): RowLookup {
  const index = new Map<string, Map<string, Record<string, string>>>();
  return (columns, keyColumn, keyValue) => {
    for (const snap of vocab.siTables ?? []) {
      if (!snap.columns.includes(keyColumn) || !columns.every(c => snap.columns.includes(c))) continue;
      const id = `${snap.id}|${keyColumn}`;
      let byKey = index.get(id);
      if (!byKey) {
        byKey = new Map();
        for (const row of snap.rows) if (row[keyColumn] && !byKey.has(row[keyColumn])) byKey.set(row[keyColumn], row);
        index.set(id, byKey);
      }
      const hit = byKey.get(keyValue);
      if (hit) return hit;
    }
    return undefined;
  };
}

// Clé (valeurs jointes par « · ») de l'objet de la règle pour un
// enregistrement de l'objet `from`, en suivant `path`. `undefined` si une
// clé étrangère manque.
export function projectKey(row: Record<string, string>, target: string, path: UpEdge[], lookup: RowLookup): string | undefined {
  if (!path.length) {
    const keys = ENTITY_KEYS[target];
    return keys.every(k => row[k]) ? keys.map(k => row[k]).join(" · ") : undefined;
  }
  let current: Record<string, string> | undefined = row;
  for (let i = 0; i < path.length; i++) {
    const edge = path[i];
    const value = edge.columns.map(c => current?.[c]).find(Boolean);
    if (!value) return undefined;
    if (i === path.length - 1) return value;
    // Relit l'objet intermédiaire (ex. l'article du stock) pour trouver la
    // clé étrangère suivante (son fournisseur principal).
    current = lookup(path[i + 1].columns, ENTITY_KEYS[edge.parent][0], value);
    if (!current) return undefined;
  }
  return undefined;
}

// « SUP-001 · Tessitura Milano », « BAG-ORION · WH-LIL », « SHP-883 · AsiaBridge ».
export function entityLabel(target: string, key: string, row: Record<string, string> | undefined, sameEntity: boolean, lookup: RowLookup): string {
  const cols = LABEL_COLUMNS[target] ?? [];
  const keys = ENTITY_KEYS[target];
  const fromRow = sameEntity ? cols.map(c => row?.[c]).find(Boolean) : undefined;
  const found = fromRow ?? (keys.length === 1 ? cols.map(c => lookup([c], keys[0], key)?.[c]).find(Boolean) : undefined);
  return found ? `${key} · ${found}` : key;
}
