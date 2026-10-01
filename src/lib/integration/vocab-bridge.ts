import { KIND_LABELS } from "./types";
// Pont vers les visuels existants du Studio (graphe du modèle, lignage, ontologie
// vivante) : ils affichent les vraies métadonnées lues par les connecteurs et les
// correspondances validées. Rien n'est inventé : colonnes, échantillons et
// mappings viennent de la découverte et des validations.
import type { AppCredential, AppField, ArgusVocab, EntityMapping, SiTableSnapshot } from "../v4/argus-vocab-store";
import { withSupplyChainModel } from "../v4/supply-model";
import type { ColumnProfile, FieldProposal } from "./discovery";
import { Q_ONTOLOGY, OBJECT_OF_GROUP, isActive, type BindingGroup, type ImportedSetup } from "./questionnaire";

export const ENTITY_OF_GROUP: Record<BindingGroup, string> = { suppliers: "sc-fournisseur", products: "sc-article", facilities: "sc-site", stock: "sc-stock", shipments: "sc-expedition", orders: "sc-commande-client", sales: "sc-vente" };
/** Attribut Aura → attribut du modèle Supply (existant) ; les autres sont ajoutés au modèle. */
const MODEL_ATTR: Record<string, string> = {
  "suppliers.key": "id", "suppliers.name": "nom", "suppliers.country": "pays",
  "products.ref": "sku", "products.name": "designation", "products.supplierTaxId": "fournisseur",
  "facilities.key": "id", "facilities.type": "type",
  "stock.item": "sku", "stock.site": "site", "stock.onHand": "physique", "stock.allocated": "reserve", "stock.safety": "securite",
  "shipments.key": "id", "shipments.po": "commande", "shipments.expected": "eta", "shipments.supplierName": "origine",
  "orders.key": "id", "orders.product": "sku", "orders.qty": "quantite", "orders.status": "statut", "orders.date": "date", "orders.site": "site",
};

export type Profiles = Record<string, { source: string; entity: string; metadata: string; columns: ColumnProfile[]; error?: string }>;

export function bridgeToVocab(vocab: ArgusVocab, setup: ImportedSetup, profiles: Profiles, proposals: FieldProposal[], tested: Record<string, boolean> = {}): ArgusVocab {
  let v = withSupplyChainModel(vocab);
  const ids = new Set(setup.sources.map(s => s.id));
  const apps: AppCredential[] = setup.sources.map(s => ({
    id: s.id, label: s.label, type: ({ odata: "ERP (OData)", sql: "Base SQL", file: "Fichiers", rest: "API REST", manhattan: "WMS (REST)", kafka: "Événements" } as Record<string, string>)[s.kind] ?? KIND_LABELS[s.kind],
    connectionHint: { depot: "Dépôt de fichiers ou d'événements", replica: "Réplique ou data lake", api: "API directe (sous budget)" }[s.accessMode ?? "api"],
    secretConfigured: true, endpoint: String(s.params.baseUrl ?? ""), secretRef: String((s.params.bearer ?? s.params.dsn ?? "") as string).replace(/^\{\{env:|\}\}$/g, ""),
    sourceStatus: tested[s.id] ? "connected" : "configured", enabled: isActive(s),
  }));
  const fields: AppField[] = [], snapshots: SiTableSnapshot[] = [];
  for (const p of Object.values(profiles)) {
    for (const c of p.columns) fields.push({ id: `${p.source}:${p.entity}:${c.name}`, appId: p.source, name: `${p.entity}.${c.name}`, liveTable: p.entity, sampleValues: c.samples.slice(0, 6) });
    if (p.columns.length) snapshots.push({ id: `${p.source}:${p.entity}`, appId: p.source, table: p.entity, columns: p.columns.map(c => c.name), rows: Array.from({ length: Math.min(5, Math.max(...p.columns.map(c => c.samples.length))) }, (_, i) => Object.fromEntries(p.columns.map(c => [c.name, c.samples[i] ?? ""]))), fetchedAt: new Date().toISOString() });
  }
  // Modèle : objet Vente et attributs d'identification ajoutés s'ils manquent.
  const entities = [...(v.entities ?? [])];
  const ensure = (entityId: string, name: string, attrId: string, attrName: string) => {
    let e = entities.find(x => x.id === entityId);
    if (!e) { e = { id: entityId, name, description: "Historique des ventes par article et magasin.", attributes: [] }; entities.push(e); }
    if (!e.attributes.some(a => a.id === `${entityId}.${attrId}`)) e.attributes = [...e.attributes, { id: `${entityId}.${attrId}`, name: attrName, type: "text" }];
    return `${entityId}.${attrId}`;
  };
  const mappings: EntityMapping[] = [];
  const active = new Set(setup.sources.filter(isActive).map(x => x.id));
  for (const p of proposals.filter(x => active.has(x.sourceId) && x.column && (x.status === "validée" || x.status === "corrigée"))) {
    const group = p.attributeId.split(".")[0] as BindingGroup;
    const entityId = ENTITY_OF_GROUP[group];
    const q = Q_ONTOLOGY.find(o => o.binding === p.attributeId);
    const attrId = MODEL_ATTR[p.attributeId] ? `${entityId}.${MODEL_ATTR[p.attributeId]}` : ensure(entityId, OBJECT_OF_GROUP[group], p.attributeId.split(".")[1], q?.attribut ?? p.label);
    mappings.push({ id: `int:${p.attributeId}:${p.sourceId}`, entityId, attributeId: attrId, appId: p.sourceId, fieldId: `${p.sourceId}:${p.entity}:${p.column}`, isMaster: true, confidence: p.score, method: p.status === "corrigée" ? "manuel" : "hybride", rationale: p.parts ? `nom ${p.parts.nom} · type ${p.parts.type} · profil ${p.parts.profil}${p.parts.indice !== null ? ` · indice ${p.parts.indice}` : ""}` : undefined });
  }
  v = {
    ...v,
    entities,
    apps: [...v.apps.filter(a => !ids.has(a.id)), ...apps],
    fields: [...v.fields.filter(f => !ids.has(f.appId)), ...fields],
    siTables: [...(v.siTables ?? []).filter(s => !ids.has(s.appId)), ...snapshots],
    entityMappings: [...(v.entityMappings ?? []).filter(m => !m.id.startsWith("int:")), ...mappings],
  };
  return v;
}
