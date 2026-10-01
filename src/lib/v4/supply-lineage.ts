// Lignage du mapping Supply : sources (système → table → colonne), objets et
// attributs, indicateurs, et les liens entre eux (mappés, proposés, en erreur
// de type). Fonctions pures ; le rendu est dans LineageView.tsx.
import type { AppField, ArgusVocab, EntityMapping, MappingDef } from "./argus-vocab-store";
import { isNumericField, proposeMappings } from "./supply-model";

export type LinkState = "mappe" | "propose" | "erreur";
export interface LineageColumn { fieldId: string; column: string; name: string; numeric: boolean; linked: boolean }
export interface LineageTable { key: string; appId: string; table: string; columns: LineageColumn[]; linked: boolean }
export interface LineageSystem { appId: string; label: string; tables: LineageTable[] }
export interface LineageLink {
  id: string; fieldId: string; target: string; // "a:<attrId>" | "k:<kpiId>"
  state: LinkState; kind: "attribut" | "indicateur";
  mappingId?: string; proposal?: EntityMapping | MappingDef;
}

const clean = (n: string) => n.replace(/\s*\(.*\)$/, "");
export const tableOf = (f: AppField) => f.liveTable ?? (clean(f.name).includes(".") ? clean(f.name).slice(0, clean(f.name).lastIndexOf(".")) : "(sans table)");
export const columnOf = (f: AppField) => { const b = clean(f.name); return b.includes(".") ? b.slice(b.lastIndexOf(".") + 1) : b; };
export const shortApp = (label: string) => label.split(" · ")[0];

export function buildLineage(vocab: ArgusVocab, refused: string[] = []) {
  const attrType = new Map((vocab.entities ?? []).flatMap(e => e.attributes.map(a => [a.id, a.type] as const)));
  const fieldById = new Map(vocab.fields.map(f => [f.id, f]));
  const links: LineageLink[] = [];
  for (const m of vocab.entityMappings ?? []) {
    const f = fieldById.get(m.fieldId);
    if (!f) continue;
    const bad = attrType.get(m.attributeId) === "number" && !isNumericField(f);
    links.push({ id: `em:${m.id}`, fieldId: m.fieldId, target: `a:${m.attributeId}`, state: bad ? "erreur" : "mappe", kind: "attribut", mappingId: m.id });
  }
  for (const m of vocab.mappings) {
    const f = fieldById.get(m.fieldId);
    if (!f) continue;
    links.push({ id: `km:${m.id}`, fieldId: m.fieldId, target: `k:${m.kpiId}`, state: isNumericField(f) ? "mappe" : "erreur", kind: "indicateur", mappingId: m.id });
  }
  for (const p of proposeMappings(vocab)) {
    const target = p.kind === "kpi" ? `k:${p.mapping.kpiId}` : `a:${(p.mapping as EntityMapping).attributeId}`;
    const id = `pr:${p.mapping.fieldId}>${target}`;
    if (refused.includes(id)) continue;
    links.push({ id, fieldId: p.mapping.fieldId, target, state: "propose", kind: p.kind === "kpi" ? "indicateur" : "attribut", proposal: p.mapping });
  }
  const linkedFields = new Set(links.map(l => l.fieldId));
  const systems: LineageSystem[] = vocab.apps.filter(a => a.enabled !== false).map(app => {
    const byTable = new Map<string, LineageColumn[]>();
    // Les champs d'ancrage internes (« …(SUP-001) ») ne s'affichent que s'ils sont reliés.
    for (const f of vocab.fields.filter(x => x.appId === app.id && (!/\(.*\)$/.test(x.name) || linkedFields.has(x.id)))) {
      const t = tableOf(f);
      byTable.set(t, [...(byTable.get(t) ?? []), { fieldId: f.id, column: columnOf(f), name: f.name, numeric: isNumericField(f), linked: linkedFields.has(f.id) }]);
    }
    const tables = [...byTable].map(([table, columns]) => ({ key: `${app.id}|${table}`, appId: app.id, table, columns, linked: columns.some(c => c.linked) }));
    return { appId: app.id, label: shortApp(app.label), tables };
  }).filter(s => s.tables.length);
  const linkedTargets = new Set(links.map(l => l.target));
  return { systems, links, linkedTargets };
}

// Crée un lien colonne → attribut ou indicateur (clic-clic ou glisser-déposer).
export function addLink(vocab: ArgusVocab, fieldId: string, target: string): ArgusVocab {
  const f = vocab.fields.find(x => x.id === fieldId);
  if (!f) return vocab;
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `m-${Date.now()}`;
  if (target.startsWith("k:")) {
    const kpiId = target.slice(2);
    if (vocab.mappings.some(m => m.kpiId === kpiId && m.fieldId === fieldId)) return vocab;
    return { ...vocab, mappings: [...vocab.mappings, { id, kpiId, appId: f.appId, fieldId, method: "manuel", confidence: 1 }] };
  }
  const attributeId = target.slice(2);
  const entityId = (vocab.entities ?? []).find(e => e.attributes.some(a => a.id === attributeId))?.id;
  if (!entityId || (vocab.entityMappings ?? []).some(m => m.attributeId === attributeId && m.fieldId === fieldId)) return vocab;
  const hasMaster = (vocab.entityMappings ?? []).some(m => m.attributeId === attributeId && m.isMaster);
  return { ...vocab, entityMappings: [...(vocab.entityMappings ?? []), { id, entityId, attributeId, appId: f.appId, fieldId, isMaster: !hasMaster, method: "manuel" }] };
}

export function removeLink(vocab: ArgusVocab, link: LineageLink): ArgusVocab {
  if (link.id.startsWith("em:")) return { ...vocab, entityMappings: (vocab.entityMappings ?? []).filter(m => m.id !== link.mappingId) };
  if (link.id.startsWith("km:")) return { ...vocab, mappings: vocab.mappings.filter(m => m.id !== link.mappingId) };
  return vocab;
}

export function changeLinkColumn(vocab: ArgusVocab, link: LineageLink, fieldId: string): ArgusVocab {
  const f = vocab.fields.find(x => x.id === fieldId);
  if (!f) return vocab;
  if (link.id.startsWith("em:")) return { ...vocab, entityMappings: (vocab.entityMappings ?? []).map(m => m.id === link.mappingId ? { ...m, fieldId, appId: f.appId, method: "manuel" as const } : m) };
  if (link.id.startsWith("km:")) return { ...vocab, mappings: vocab.mappings.map(m => m.id === link.mappingId ? { ...m, fieldId, appId: f.appId, method: "manuel" as const } : m) };
  return vocab;
}

export function acceptProposal(vocab: ArgusVocab, link: LineageLink): ArgusVocab {
  if (!link.proposal) return vocab;
  return link.target.startsWith("k:")
    ? { ...vocab, mappings: [...vocab.mappings, link.proposal as MappingDef] }
    : { ...vocab, entityMappings: [...(vocab.entityMappings ?? []), link.proposal as EntityMapping] };
}

// Fraîcheur lisible d'après la dernière lecture de la table source.
export function freshness(fetchedAt: string | undefined, now = Date.now()): string | undefined {
  if (!fetchedAt) return undefined;
  const min = Math.max(0, Math.round((now - new Date(fetchedAt).getTime()) / 60000));
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `il y a ${h} h` : `il y a ${Math.round(h / 24)} j`;
}

// Pré-remplissage du mapping depuis la pastille « à mapper » du graphe.
let prefill: string | undefined;
export function setMappingPrefill(target: string | undefined) { prefill = target; }
export function takeMappingPrefill(): string | undefined { const p = prefill; prefill = undefined; return p; }
