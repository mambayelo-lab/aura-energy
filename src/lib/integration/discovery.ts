// Mapping au niveau des champs, réalisé par Aura : métadonnées réelles de la source
// + échantillon limité (sous budget) → profil de chaque colonne → correspondances
// proposées avec un score de confiance (nom FR/EN, type, profil des valeurs, indice
// du questionnaire). Rien n'est appliqué automatiquement en dessous du seuil.
import { jaroWinkler, normDuns, normEan, normSiret, normVat } from "./normalize";
import type { Row } from "./types";

export type ColType = "integer" | "decimal" | "date" | "datetime" | "boolean" | "string" | "empty";
export type PatternId = "ean" | "siret" | "vat" | "duns" | "iso2" | "code" | "prefixedId" | "words" | "status" | "po";

export interface ColumnProfile {
  name: string;
  /** Type déclaré par les métadonnées de la source (information_schema, $metadata…), s'il existe. */
  declaredType?: string;
  type: ColType;
  nullRate: number;
  distinctRatio: number;
  unique: boolean;
  patterns: Partial<Record<PatternId, number>>;
  min?: number; max?: number;
  samples: string[];
}

const isInt = (s: string) => /^-?\d+$/.test(s);
const isDec = (s: string) => /^-?\d+[.,]\d+$/.test(s);
const isDate = (s: string) => /^\d{4}-\d\d-\d\d$/.test(s) || /^\d\d\/\d\d\/\d{4}$/.test(s);
const isDateTime = (s: string) => /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(s) || /^\/Date\(\d+/.test(s);

export function profileColumns(rows: Row[], declared: Record<string, string> = {}): ColumnProfile[] {
  const names = [...new Set(rows.flatMap(r => Object.keys(r)))].filter(n => !n.startsWith("__"));
  return names.map(name => {
    const all = rows.map(r => r[name]);
    const vals = all.filter(v => v !== null && v !== undefined && v !== "").map(v => (typeof v === "object" ? JSON.stringify(v) : String(v)));
    const n = vals.length || 1;
    const ratio = (f: (s: string) => boolean) => Math.round((vals.filter(f).length / n) * 100) / 100;
    const distinct = new Set(vals).size;
    const type: ColType = !vals.length ? "empty" : ratio(isInt) >= 0.95 && !vals.every(v => /^0\d/.test(v)) ? "integer" : ratio(s => isInt(s) || isDec(s)) >= 0.95 ? "decimal"
      : ratio(isDateTime) >= 0.9 ? "datetime" : ratio(isDate) >= 0.9 ? "date" : ratio(s => /^(true|false)$/i.test(s)) >= 0.95 ? "boolean" : "string";
    const nums = vals.map(Number).filter(Number.isFinite);
    const patterns: ColumnProfile["patterns"] = {
      ean: ratio(s => /^\d{8,14}$/.test(s) && !!normEan(s)),
      siret: ratio(s => /^[\d ]{14,17}$/.test(s) && !!normSiret(s)),
      vat: ratio(s => /[A-Za-z]{2}/.test(s.slice(0, 2)) && !!normVat(s)),
      duns: ratio(s => /^[\d -]{9,11}$/.test(s) && !!normDuns(s)),
      iso2: ratio(s => /^[A-Z]{2}$/.test(s)),
      code: ratio(s => /^(?=.*[A-Za-z])[A-Za-z0-9]{1,12}([-_][A-Za-z0-9]{1,12}){0,4}$/.test(s)),
      prefixedId: ratio(s => /^[A-Za-z]{1,5}-?\d{3,}$/.test(s) || /^\d{6,12}$/.test(s)),
      words: ratio(s => /[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ0-9]/.test(s)),
      status: distinct <= Math.max(6, n * 0.05) && ratio(s => /^[A-Z][A-Z_ ]{2,20}$/.test(s)) >= 0.9 ? 1 : 0,
      po: ratio(s => /^(PO-?)?\d{8,10}$/i.test(s)),
    };
    return {
      name, declaredType: declared[name], type,
      nullRate: Math.round((1 - vals.length / Math.max(1, all.length)) * 100) / 100,
      distinctRatio: Math.round((distinct / n) * 100) / 100, unique: vals.length > 0 && distinct === vals.length,
      patterns, min: nums.length ? Math.min(...nums) : undefined, max: nums.length ? Math.max(...nums) : undefined,
      samples: [...new Set(vals)].slice(0, 5),
    };
  });
}

// ── Attributs Aura attendus ─────────────────────────────────────────────────
export interface AttributeSpec {
  id: string;
  label: string;
  synonyms: string[];
  types: ColType[];
  pattern?: PatternId;
  key?: boolean;
  nonNegative?: boolean;
  /** Attribut technique (horodatage de mise à jour) : peut partager la colonne d'un autre attribut. */
  shareable?: boolean;
}

const A = (id: string, label: string, synonyms: string[], types: ColType[], extra: Partial<AttributeSpec> = {}): AttributeSpec => ({ id, label, synonyms, types, ...extra });
const TS: ColType[] = ["datetime", "date"];
const NUM: ColType[] = ["integer", "decimal"];
export const ATTRIBUTE_SPECS: AttributeSpec[] = [
  A("suppliers.key", "Identifiant fournisseur", ["supplier", "fournisseur id", "vendor", "vendor id", "lifnr", "supplier id", "code fournisseur", "partner"], ["string", "integer"], { key: true, pattern: "prefixedId" }),
  A("suppliers.name", "Nom fournisseur", ["supplier name", "nom fournisseur", "raison sociale", "vendor name", "name", "company"], ["string"], { pattern: "words" }),
  A("suppliers.country", "Pays", ["country", "pays", "land", "country code"], ["string"], { pattern: "iso2" }),
  A("suppliers.siret", "SIRET", ["siret", "tax number", "taxnumber1", "stcd1", "numero fiscal"], ["string", "integer"], { pattern: "siret" }),
  A("suppliers.vat", "N° TVA intracommunautaire", ["vat", "tva", "vat registration", "vat number", "stceg", "numero tva"], ["string"], { pattern: "vat" }),
  A("suppliers.duns", "DUNS", ["duns", "dun", "d u n s"], ["string", "integer"], { pattern: "duns" }),
  A("suppliers.legacy", "Ancien identifiant", ["legacy", "legacy id", "ancien identifiant", "old id"], ["string"]),
  A("suppliers.updated", "Date de mise à jour", ["last change", "updated", "modified", "date modification", "maj", "changed", "timestamp"], TS, { shareable: true }),
  A("products.key", "Identifiant article", ["product id", "productid", "article id", "id article", "material", "matnr", "item id"], ["string"], { key: true, pattern: "prefixedId" }),
  A("products.ean", "EAN / GTIN", ["ean", "gtin", "barcode", "code barre", "upc", "ean13"], ["string", "integer"], { pattern: "ean" }),
  A("products.ref", "SKU (référence interne)", ["sku", "reference", "internal ref", "ref", "reference interne", "part number", "manufacturer ref"], ["string"], { pattern: "code" }),
  A("products.name", "Désignation", ["name", "designation", "description", "libelle", "product name", "label"], ["string"]),
  A("products.supplierTaxId", "Fournisseur principal", ["supplier tax", "supplier", "fournisseur", "vendor", "supplier id", "fiscal"], ["string"], { pattern: "vat" }),
  A("products.supplierCountry", "Pays du fournisseur", ["supplier country", "pays fournisseur", "vendor country", "origin country"], ["string"], { pattern: "iso2" }),
  A("products.updated", "Date de mise à jour", ["updated", "updated at", "last change", "modified", "maj"], TS, { shareable: true }),
  A("facilities.key", "Identifiant site", ["facility", "facility id", "site id", "location", "warehouse", "plant", "werks"], ["string"], { key: true, pattern: "code" }),
  A("facilities.code", "Code site", ["site code", "code site", "facility code", "store code", "location code"], ["string"], { pattern: "code" }),
  A("facilities.type", "Type de site", ["type", "facility type", "site type", "location type"], ["string"], { pattern: "status" }),
  A("stock.item", "Article", ["item", "item id", "article", "sku", "ean", "gtin", "material", "product"], ["string", "integer"], { pattern: "ean" }),
  A("stock.site", "Site", ["facility", "site", "location", "warehouse", "plant", "depot", "entrepot"], ["string"], { pattern: "code" }),
  A("stock.onHand", "Stock physique", ["on hand", "onhand", "stock", "quantity", "qty", "physical", "stock physique", "qte"], NUM, { nonNegative: true }),
  A("stock.allocated", "Stock réservé", ["allocated", "reserved", "reserve", "stock reserve", "committed"], NUM, { nonNegative: true }),
  A("stock.safety", "Stock de sécurité", ["safety", "safety stock", "stock securite", "min stock", "reorder point"], NUM, { nonNegative: true }),
  A("stock.updated", "Date de mise à jour", ["updated", "updated timestamp", "last change", "modified", "maj"], TS, { shareable: true }),
  A("shipments.key", "Identifiant expédition", ["shipment", "shipment id", "expedition", "asn", "delivery id"], ["string"], { key: true, pattern: "prefixedId" }),
  A("shipments.po", "Identifiant commande d'achat", ["purchase order", "po", "po ref", "commande achat", "ebeln"], ["string"], { pattern: "po" }),
  A("shipments.item", "Article", ["item", "item id", "sku", "ean", "product"], ["string", "integer"], { pattern: "ean" }),
  A("shipments.supplierName", "Fournisseur", ["origin", "origin name", "supplier", "vendor", "shipper", "fournisseur"], ["string"], { pattern: "words" }),
  A("shipments.expected", "Arrivée prévue", ["expected", "expected date", "eta", "planned", "date prevue", "due date"], TS),
  A("shipments.actual", "Arrivée réelle", ["actual", "actual date", "ata", "received", "date reelle", "arrival"], TS),
  A("shipments.updated", "Date de mise à jour", ["updated", "updated timestamp", "last change", "modified"], TS, { shareable: true }),
  A("orders.key", "Identifiant ligne", ["order line", "order line id", "line id", "ligne commande"], ["string"], { key: true, pattern: "prefixedId" }),
  A("orders.product", "SKU", ["product", "product ref", "sku", "article", "item"], ["string"], { pattern: "code" }),
  A("orders.qty", "Quantité commandée", ["quantity", "qty", "quantite", "ordered"], NUM, { nonNegative: true }),
  A("orders.status", "Statut", ["status", "statut", "state", "etat"], ["string"], { pattern: "status" }),
  A("orders.site", "Site de livraison", ["fulfillment site", "site", "ship from", "warehouse", "store"], ["string"], { pattern: "code" }),
  A("orders.date", "Date demandée", ["order date", "date", "date commande", "created"], TS),
  A("orders.updated", "Date de mise à jour", ["updated", "updated at", "last change", "modified"], TS, { shareable: true }),
  A("sales.date", "Date de vente", ["sale date", "date", "date vente", "transaction date", "day"], TS),
  A("sales.ean", "EAN", ["ean", "gtin", "barcode", "item"], ["string", "integer"], { pattern: "ean" }),
  A("sales.store", "Magasin", ["store", "store code", "magasin", "shop", "boutique", "point de vente"], ["string"], { pattern: "code" }),
  A("sales.qty", "Quantité", ["quantity", "qty", "quantite", "units"], NUM, { nonNegative: true }),
  A("sales.amount", "Montant net", ["amount", "net amount", "montant", "revenue", "ca", "sales"], NUM),
  A("sales.key", "Ticket", ["ticket", "ticket id", "receipt", "transaction"], ["string"], { key: false, pattern: "prefixedId" }),
];

// ── Score ───────────────────────────────────────────────────────────────────
const tokens = (s: string) => s.replace(/([a-z])([A-Z])/g, "$1 $2").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function nameSimilarity(column: string, synonyms: string[]): number {
  const c = tokens(column), ct = new Set(c.split(" ").filter(Boolean));
  let best = 0;
  for (const syn of synonyms) {
    const s = tokens(syn);
    if (s === c) return 1;
    const st = s.split(" ").filter(Boolean);
    // Recouvrement : part du synonyme présente dans le nom de colonne, légèrement pénalisée par les mots en trop.
    const overlap = (st.filter(t => ct.has(t)).length / Math.max(1, st.length)) * (0.85 + 0.15 * Math.min(1, st.length / Math.max(1, ct.size)));
    best = Math.max(best, 0.9 * overlap, 0.85 * jaroWinkler(c.replace(/ /g, ""), s.replace(/ /g, "")) - 0.1);
  }
  return Math.max(0, Math.min(1, Math.round(best * 100) / 100));
}
function typeScore(a: AttributeSpec, p: ColumnProfile): number {
  if (p.type === "empty") return 0.2;
  if (a.types.includes(p.type)) return 1;
  if (a.types.includes("string")) return 0.5;
  if (a.types.includes("datetime") && p.type === "date") return 0.8;
  return 0;
}
function profileScore(a: AttributeSpec, p: ColumnProfile): number {
  let s = 0.5;
  if (a.pattern) s = p.patterns[a.pattern] ?? 0;
  if (a.key) s = (0.6 * s + 0.4 * (p.unique ? 1 : p.distinctRatio)) * (1 - p.nullRate);
  else if (p.nullRate > 0.5) s *= 0.8;
  if (a.nonNegative) s = p.min !== undefined && p.min >= 0 ? Math.max(s, 0.8) : 0.1;
  return Math.round(s * 100) / 100;
}

export interface FieldCandidate { column: string; score: number; parts: { nom: number; type: number; profil: number; indice: number | null } }
export function scoreAttribute(a: AttributeSpec, profiles: ColumnProfile[], hint?: string): FieldCandidate[] {
  return profiles.map(p => {
    const nom = nameSimilarity(p.name, [a.label, ...a.synonyms]), type = typeScore(a, p), profil = profileScore(a, p);
    const indice = hint ? (tokens(hint) === tokens(p.name) ? 1 : 0) : null;
    const score = indice === null ? (0.4 * nom + 0.2 * type + 0.4 * profil) : (0.3 * nom + 0.15 * type + 0.3 * profil + 0.25 * indice);
    return { column: p.name, score: Math.round(score * 100) / 100, parts: { nom, type, profil, indice } };
  }).sort((x, y) => y.score - x.score);
}

export type ProposalStatus = "validée" | "à valider" | "refusée" | "corrigée" | "sans proposition";
export interface FieldProposal {
  attributeId: string; label: string; sourceId: string; entity: string;
  column: string | null; score: number; parts: FieldCandidate["parts"] | null;
  alternatives: { column: string; score: number }[];
  status: ProposalStatus;
}

/** Seuil au-dessus duquel une correspondance est validée d'office (modifiable par l'utilisateur). */
export const AUTO_THRESHOLD = 0.8;
export const MIN_PROPOSAL = 0.45;

/** Propose les correspondances d'un groupe d'attributs sur une entité (une colonne par attribut). */
export function proposeMappings(attrs: AttributeSpec[], profiles: ColumnProfile[], ctx: { sourceId: string; entity: string; hints?: Record<string, string> }): FieldProposal[] {
  const cands = attrs.map(a => ({ a, list: scoreAttribute(a, profiles, ctx.hints?.[a.id]) }));
  const pairs = cands.flatMap(c => c.list.map(x => ({ a: c.a, x }))).sort((p, q) => q.x.score - p.x.score);
  const taken = new Set<string>(), done = new Map<string, FieldCandidate>();
  for (const { a, x } of pairs) {
    if (done.has(a.id) || x.score < MIN_PROPOSAL) continue;
    if (taken.has(x.column) && !a.shareable) continue;
    done.set(a.id, x);
    if (!a.shareable) taken.add(x.column);
  }
  return cands.map(({ a, list }) => {
    const best = done.get(a.id);
    return {
      attributeId: a.id, label: a.label, sourceId: ctx.sourceId, entity: ctx.entity,
      column: best?.column ?? null, score: best?.score ?? 0, parts: best?.parts ?? null,
      alternatives: list.filter(x => x.column !== best?.column).slice(0, 3).map(x => ({ column: x.column, score: x.score })),
      status: !best ? "sans proposition" : best.score >= AUTO_THRESHOLD ? "validée" : "à valider",
    };
  });
}
