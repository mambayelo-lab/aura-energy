// Modèle d'exécution : sources, maître par domaine et liaisons (attribut Aura ← colonne),
// construit par l'import du questionnaire puis la validation des correspondances.
import type { KeyRule, MasterSpec, SourceSpec } from "./crosswalk";
import type { SourceConfig } from "./types";

/** Champ du modèle Aura ← colonne de la source. */
export interface Binding { source: string; entity: string; fields: Record<string, string>; watermark?: string }

export interface IntegrationTemplate {
  id: string;
  label: string;
  sources: SourceConfig[];
  masters: { supplier: string; product: string; site: string };
  bindings: {
    suppliers: Binding; products: Binding; facilities: Binding;
    stock: Binding; shipments: Binding; orders: Binding; sales: Binding;
  };
}

// ── Règles de rapprochement (maîtres et sources) ─────────────────────────────
export function masterSpecs(t: IntegrationTemplate): { supplier: MasterSpec; product: MasterSpec; site: MasterSpec } {
  const s = t.bindings.suppliers.fields, p = t.bindings.products.fields, f = t.bindings.facilities.fields;
  return {
    supplier: { domain: "supplier", system: t.masters.supplier, keyField: s.key, nameField: s.name, idPrefix: "FRN-", keys: [{ type: "siren", field: s.siret }, { type: "vat", field: s.vat }, { type: "duns", field: s.duns }, { type: "raw", field: s.legacy }] },
    product: { domain: "product", system: t.masters.product, keyField: p.key, nameField: p.name, idPrefix: "ART-", keys: [{ type: "ean", field: p.ean }, { type: "ref", field: p.ref }] },
    site: { domain: "site", system: t.masters.site, keyField: f.code, idPrefix: "SITE-", keys: [{ type: "site", field: f.code }, { type: "site", field: f.key }] },
  };
}

export function sourceSpecs(t: IntegrationTemplate): Record<string, SourceSpec> {
  const b = t.bindings;
  const k = (type: KeyRule["type"], field: string): KeyRule => ({ type, field });
  return {
    stockItems: { domain: "product", system: `${b.stock.source}.${b.stock.entity}.${b.stock.fields.item}`, keyField: b.stock.fields.item, keys: [k("ean", b.stock.fields.item)], fuzzy: false },
    stockSites: { domain: "site", system: `${b.stock.source}.${b.stock.entity}.${b.stock.fields.site}`, keyField: b.stock.fields.site, keys: [k("site", b.stock.fields.site)], fuzzy: false },
    shipmentSuppliers: { domain: "supplier", system: `${b.shipments.source}.${b.shipments.entity}.${b.shipments.fields.supplierName}`, keyField: b.shipments.fields.supplierName, nameField: b.shipments.fields.supplierName, keys: [], fuzzy: true },
    orderProducts: { domain: "product", system: `${b.orders.source}.${b.orders.entity}.${b.orders.fields.product}`, keyField: b.orders.fields.product, keys: [k("ref", b.orders.fields.product)], fuzzy: false },
    salesProducts: { domain: "product", system: `${b.sales.source}.${b.sales.entity}.${b.sales.fields.ean}`, keyField: b.sales.fields.ean, keys: [k("ean", b.sales.fields.ean)], fuzzy: false },
    salesSites: { domain: "site", system: `${b.sales.source}.${b.sales.entity}.${b.sales.fields.store}`, keyField: b.sales.fields.store, keys: [k("site", b.sales.fields.store)], fuzzy: false },
  };
}
