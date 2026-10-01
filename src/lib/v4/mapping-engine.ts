// mapping-engine.ts — moteur de rapprochement "objet métier . attribut ↔ champ
// source", porté depuis l'algorithme de mapping d'Aura Decision Compass.
//
// Pile de scoring (identique dans l'esprit à Compass) :
//   1. alias multilingues FR/EN (un champ `ville` doit matcher un attribut `City`)
//   2. Jaccard sur tokens, avec expansion par alias
//   3. cosinus de trigrammes (rattrape les abréviations cryptiques : `KUNNR`, `mb_pct`)
//   4. bonus de profil d'échantillon (des valeurs en forme d'e-mail pour un
//      attribut « email »), et bonus de contexte objet (le nom de l'objet
//      métier apparaît dans le chemin du champ)
//
// Aucune donnée inventée : le profil d'échantillon est calculé sur les valeurs
// réellement remontées par la source. Purement local — aucune dépendance
// serveur, appelé depuis Studio (Ontology Mapping).

import type { ArgusVocab, AppField, BusinessEntity, EntityAttribute, EntityMapping } from "./argus-vocab-store";

// ── alias canoniques ────────────────────────────────────────────────────────
const ALIASES: Record<string, string[]> = {
  id: ["code", "identifier", "identifiant", "ref", "reference", "no", "num", "numero", "key", "pk"],
  customer: ["client", "partner", "account", "compte", "buyer", "acheteur", "contact", "user", "usager"],
  product: ["produit", "article", "item", "material", "sku", "ref", "reference", "model"],
  order: ["commande", "cmd", "sale", "vente", "ticket", "salesorder", "vbak"],
  invoice: ["facture", "billing", "bill", "fact"],
  supplier: ["fournisseur", "vendor", "lifnr"],
  shipment: ["expedition", "delivery", "livraison", "colis", "parcel", "shipping"],
  warehouse: ["entrepot", "site", "depot", "plant", "location", "store", "magasin"],
  inventory: ["stock", "stocks", "on_hand", "available", "dispo", "disponible"],
  email: ["mail", "courriel", "e_mail", "email_address", "emailaddress"],
  phone: ["tel", "telephone", "mobile", "portable", "cell"],
  name: ["nom", "raison_sociale", "company_name", "label", "libelle", "designation", "title", "titre", "lastname", "firstname"],
  country: ["pays", "ctry", "land", "nation"],
  city: ["ville", "town"],
  address: ["adresse", "street", "rue", "voie"],
  date: ["date", "datetime", "timestamp", "created", "createdat", "created_at", "creation", "horodatage", "posting"],
  amount: ["total", "price", "value", "valeur", "ttc", "ht", "grand_total", "paid", "subtotal", "montant", "prix"],
  quantity: ["qty", "quantite", "qte", "count", "nb", "nombre", "units"],
  status: ["statut", "state", "etat", "current_state", "stage"],
  segment: ["segment", "tier", "category", "categorie", "type"],
  channel: ["canal", "channel_code", "media", "source_channel"],
  currency: ["currency", "devise", "ccy"],
  margin: ["marge", "margin_pct", "marge_brute", "mb"],
  cost: ["cout", "cost", "purchase_price", "prix_achat"],
  delay: ["delai", "lead_time", "leadtime", "retard", "days", "jours"],
};

const FIELD_TYPE_HINTS: Record<string, RegExp> = {
  email: /\b(e?mail|courriel)\b/i,
  phone: /\b(phone|tel|mobile|portable)\b/i,
  currency: /\b(amount|total|price|montant|prix|cost|cout|revenue|ca|sales)\b/i,
  date: /\b(date|datetime|timestamp|created|updated|posting|expedie|livre|delivered)\b/i,
  number: /\b(qty|quantite|qte|count|stock|nb|nombre|units|score|pct|ratio|days?|jours?)\b/i,
  bool: /\b(is_|has_|active|enabled|actif|paid|paye)\b/i,
};

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[._\-/[\]()]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/\s+/)
    .filter(Boolean);
}

function expandAliases(tokens: string[]): Set<string> {
  const out = new Set<string>();
  for (const t of tokens) {
    out.add(t);
    for (const [canon, aliases] of Object.entries(ALIASES)) {
      if (t === canon || aliases.includes(t)) {
        out.add(canon);
        for (const a of aliases) out.add(a);
      }
    }
  }
  return out;
}

function jaccard(a: string, b: string): number {
  const A = expandAliases(tokenize(a));
  const B = expandAliases(tokenize(b));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

function ngramCosine(a: string, b: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  const va = new Map<string, number>();
  const vb = new Map<string, number>();
  for (const [src, dst] of [[norm(a), va], [norm(b), vb]] as const) {
    if (src.length < 2) continue;
    const padded = ` ${src} `;
    for (let i = 0; i <= padded.length - 3; i++) {
      const g = padded.slice(i, i + 3);
      dst.set(g, (dst.get(g) ?? 0) + 1);
    }
  }
  for (const v of [va, vb]) {
    let sum = 0;
    for (const x of v.values()) sum += x * x;
    const n = Math.sqrt(sum) || 1;
    for (const [k, x] of v) v.set(k, x / n);
  }
  let dot = 0;
  for (const [k, x] of va) {
    const y = vb.get(k);
    if (y !== undefined) dot += x * y;
  }
  return dot;
}

// ── profil d'échantillon ────────────────────────────────────────────────────
export type SampleProfile =
  | "email" | "phone" | "url" | "date" | "datetime"
  | "number" | "bool" | "uuid" | "postal" | "currency" | "text" | "empty";

const RX = {
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/i,
  url: /^https?:\/\/\S+$/i,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  phone: /^\+?[\d\s().-]{7,}$/,
  postal: /^[A-Z0-9]{3,10}([- ]?[A-Z0-9]{3,4})?$/i,
  isoDate: /^\d{4}-\d{2}-\d{2}$/,
  isoDt: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/,
  date2: /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}$/,
  number: /^-?\d+([.,]\d+)?$/,
  currency: /^-?\d+([.,]\d+)?\s?(€|EUR|\$|USD|£|GBP)$/i,
  bool: /^(true|false|yes|no|oui|non|0|1|y|n)$/i,
};

function classifyOne(v: string): SampleProfile {
  const s = v.trim();
  if (!s) return "empty";
  if (RX.email.test(s)) return "email";
  if (RX.url.test(s)) return "url";
  if (RX.uuid.test(s)) return "uuid";
  if (RX.currency.test(s)) return "currency";
  if (RX.isoDt.test(s)) return "datetime";
  if (RX.isoDate.test(s) || RX.date2.test(s)) return "date";
  if (RX.bool.test(s) && s.length <= 5) return "bool";
  if (RX.number.test(s)) return "number";
  if (RX.phone.test(s) && /\d{6,}/.test(s.replace(/\D/g, ""))) return "phone";
  if (RX.postal.test(s) && s.length <= 10) return "postal";
  return "text";
}

/** Profil dominant des valeurs d'échantillon (≥60 % d'accord), sinon "text". */
export function profileSamples(samples: unknown[]): SampleProfile {
  const strs = (samples ?? [])
    .map(v => (v == null ? "" : String(v)))
    .filter(s => s.trim().length > 0)
    .slice(0, 20);
  if (strs.length === 0) return "empty";
  const counts = new Map<SampleProfile, number>();
  for (const s of strs) {
    const c = classifyOne(s);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  let best: SampleProfile = "text";
  let bestN = 0;
  for (const [k, n] of counts) if (n > bestN) { best = k; bestN = n; }
  return bestN / strs.length < 0.6 ? "text" : best;
}

/** Profil attendu pour un attribut d'objet métier (au mieux). */
export function expectedProfile(attr: { name: string; type?: string }): SampleProfile | null {
  const t = (attr.type ?? "").toLowerCase();
  const hay = attr.name.toLowerCase();
  if (/\bemail|mail|courriel\b/.test(hay)) return "email";
  if (/\bphone|tel|mobile|portable\b/.test(hay)) return "phone";
  if (/\burl|website|site|lien\b/.test(hay)) return "url";
  if (/\buuid|guid\b/.test(hay)) return "uuid";
  if (/\bzip|postal|code postal|cp\b/.test(hay)) return "postal";
  if (/\bamount|price|total|montant|prix|ca|revenue\b/.test(hay)) return "currency";
  if (t === "date" || /\bdate|jour\b/.test(hay)) return "date";
  if (t === "boolean" || /\bactif|active|enabled|is_/.test(hay)) return "bool";
  if (t === "number" || /\bqty|quantite|qte|count|stock|nombre|age|taux|pct|%|delai\b/.test(hay)) return "number";
  return null;
}

// ── scoring ─────────────────────────────────────────────────────────────────
export interface MappingCandidate {
  field: AppField;
  score: number;              // 0–1
  profile: SampleProfile;     // profil réel des valeurs du champ
  expected: SampleProfile | null;
  rationale: string;          // pourquoi ce candidat, en langage lisible
}

export function scoreCandidate(
  entity: Pick<BusinessEntity, "name" | "description">,
  attr: Pick<EntityAttribute, "name" | "type">,
  fieldName: string,
  sampleValues: string[],
): { score: number; profile: SampleProfile; expected: SampleProfile | null; rationale: string } {
  const entityHay = `${entity.name} ${entity.description ?? ""}`;
  const attrHay = attr.name;
  const expected = expectedProfile(attr);
  const typeHint = expected ? FIELD_TYPE_HINTS[expected] : undefined;
  const fieldLast = fieldName.split(/[.[\]/]/).filter(Boolean).pop() ?? fieldName;

  const j = Math.max(jaccard(attrHay, fieldName), jaccard(attrHay, fieldLast), jaccard(`${entityHay} ${attrHay}`, fieldName));
  const n = ngramCosine(attrHay, fieldLast);
  let raw = 0.65 * j + 0.35 * n;
  const reasons: string[] = [];
  if (j > 0.15) reasons.push("noms proches");
  else if (n > 0.35) reasons.push("abréviation proche");

  const entityTokens = expandAliases(tokenize(entityHay));
  const fieldTokens = expandAliases(tokenize(fieldName));
  let ctx = 0;
  for (const t of entityTokens) if (fieldTokens.has(t)) ctx++;
  if (ctx > 0) {
    raw *= 1 + Math.min(0.3, ctx * 0.08);
    reasons.push(`contexte « ${entity.name} » présent dans le champ`);
  }

  const profile = profileSamples(sampleValues);
  if (expected && profile !== "empty") {
    if (expected === profile) { raw *= 1.25; reasons.push(`valeurs de type ${profile}`); }
    else if (profile !== "text") { raw *= 0.85; reasons.push(`valeurs ${profile} ≠ attendu ${expected}`); }
  }
  if (typeHint && typeHint.test(fieldName)) { raw *= 1.15; reasons.push("nom du champ typé"); }

  return {
    score: Math.min(1, raw),
    profile,
    expected,
    rationale: reasons.length ? reasons.join(" · ") : "aucun indice fort",
  };
}

/** Classe tous les champs applicatifs disponibles pour un attribut donné. */
export function rankCandidates(
  vocab: ArgusVocab,
  entity: BusinessEntity,
  attr: EntityAttribute,
  limit = 8,
): MappingCandidate[] {
  const enabledApps = new Set(vocab.apps.filter(a => a.enabled !== false).map(a => a.id));
  return vocab.fields
    .filter(f => enabledApps.has(f.appId))
    .map(f => {
      const s = scoreCandidate(entity, attr, f.name, f.sampleValues);
      return { field: f, ...s };
    })
    .filter(c => c.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Couverture d'un objet métier : part d'attributs ayant au moins un branchement. */
export function entityCoverage(vocab: ArgusVocab, entity: BusinessEntity): { mapped: number; total: number; pct: number } {
  const links: EntityMapping[] = vocab.entityMappings ?? [];
  const total = entity.attributes.length;
  const mapped = entity.attributes.filter(a => links.some(l => l.entityId === entity.id && l.attributeId === a.id)).length;
  return { mapped, total, pct: total === 0 ? 0 : Math.round((mapped / total) * 100) };
}

