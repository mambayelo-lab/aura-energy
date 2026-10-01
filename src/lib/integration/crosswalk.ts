// Crosswalk (domaine, système, clé_source → id_or) et rapport de rapprochement.
// Trois étapes : 1) correspondance exacte ; 2) clé normalisée (SIRET, TVA, DUNS,
// EAN/GTIN, référence, code site) ; 3) ressemblance de nom avec un score, placée
// en file de validation humaine — jamais appliquée automatiquement.
import { nameScore, normDuns, normEan, normName, normPo, normRef, normSiren, normSite, normVat, vatFromSiren } from "./normalize";
import type { Row } from "./types";

export type Domain = "supplier" | "product" | "site";
export type KeyType = "siren" | "vat" | "duns" | "ean" | "ref" | "site" | "po" | "raw" | "name";
export interface KeyRule { type: KeyType; field: string }

export interface MasterSpec { domain: Domain; system: string; keyField: string; nameField?: string; keys: KeyRule[]; idPrefix: string; linkField?: { field: string; domain: Domain; keys: KeyType[] } }
export interface SourceSpec { domain: Domain; system: string; keyField: string; nameField?: string; keys: KeyRule[]; fuzzy?: boolean }

export interface MasterRecord { idOr: string; sourceKey: string; name?: string; raw: Row; keys: Partial<Record<KeyType, string>>; duplicateOf?: string }
export interface MasterIndex { spec: MasterSpec; records: MasterRecord[]; byId: Map<string, MasterRecord>; index: Map<string, Set<string>>; names: { idOr: string; norm: string; name: string }[]; duplicates: DuplicateGroup[]; nameBlocks: Map<string, { idOr: string; norm: string; name: string }[]> }

export interface CrosswalkEntry { domain: Domain; system: string; sourceKey: string; idOr: string; method: "exact" | "normalized" | "validated"; via: string; score?: number }
export interface ReviewItem { id: string; domain: Domain; system: string; sourceKey: string; sourceName: string; candidateIdOr: string; candidateName: string; score: number; status: "pending" | "validated" | "rejected" }
export interface DuplicateGroup { idOr: string; sourceKeys: string[]; by: KeyType }
export interface Conflict { sourceKey: string; candidates: string[]; by: string }
export interface ReconReport {
  domain: Domain; system: string; total: number; matched: number; pct: number;
  byMethod: Record<CrosswalkEntry["method"], number>;
  orphans: { sourceKey: string; name?: string; reason: string }[];
  duplicates: DuplicateGroup[];
  conflicts: Conflict[];
  pendingReview: number;
}

export type Decisions = Map<string, "validated" | "rejected">;
export const reviewId = (domain: Domain, system: string, sourceKey: string, idOr: string) => `${domain}|${system}|${sourceKey}|${idOr}`;

function normalizeKey(type: KeyType, v: unknown): string | null {
  switch (type) {
    case "siren": return normSiren(v);
    case "vat": return normVat(v) ?? vatFromSiren(v);
    case "duns": return normDuns(v);
    case "ean": return normEan(v);
    case "ref": return normRef(v);
    case "site": return normSite(v);
    case "po": return normPo(v);
    case "raw": case "name": { const s = String(v ?? ""); return s ? s : null; }
  }
}
/** Un identifiant fiscal saisi librement peut être un SIREN/SIRET, une TVA ou un DUNS : on essaie les trois. */
function keysFor(rule: KeyRule, row: Row): [KeyType, string][] {
  const v = row[rule.field];
  if (v == null || v === "") return [];
  const out: [KeyType, string][] = [];
  const add = (t: KeyType) => { const k = normalizeKey(t, v); if (k) out.push([t, k]); };
  add(rule.type);
  if (rule.type === "vat") { const s = normSiren(v); if (s) out.push(["siren", s]); add("duns"); }
  return out;
}
const ix = (t: KeyType, k: string) => `${t}:${k}`;

export function buildMaster(spec: MasterSpec, rows: Row[]): MasterIndex {
  const records: MasterRecord[] = [];
  const byId = new Map<string, MasterRecord>();
  const index = new Map<string, Set<string>>();
  const duplicates = new Map<string, DuplicateGroup>();
  for (const row of rows) {
    const sourceKey = String(row[spec.keyField] ?? "");
    const keys: MasterRecord["keys"] = {};
    for (const rule of spec.keys) for (const [t, k] of keysFor(rule, row)) keys[t] ??= k;
    // Doublon maître : une clé forte (SIREN, TVA, DUNS, EAN) déjà portée par un autre enregistrement.
    let canonical: string | undefined, by: KeyType | undefined;
    for (const t of ["siren", "vat", "duns"] as KeyType[]) {
      const k = keys[t];
      const hit = k ? index.get(ix(t, k)) : undefined;
      if (hit?.size) { canonical = [...hit][0]; by = t; break; }
    }
    const idOr = canonical ?? `${spec.idPrefix}${sourceKey}`;
    const rec: MasterRecord = { idOr, sourceKey, name: spec.nameField ? String(row[spec.nameField] ?? "") : undefined, raw: row, keys, duplicateOf: canonical };
    records.push(rec);
    if (!canonical) byId.set(idOr, rec);
    else {
      const g = duplicates.get(idOr) ?? { idOr, sourceKeys: [byId.get(idOr)!.sourceKey], by: by! };
      g.sourceKeys.push(sourceKey);
      duplicates.set(idOr, g);
    }
    index.set(ix("raw", sourceKey), new Set([idOr]));
    if (!canonical && rec.name) { const n = index.get(ix("name", rec.name)) ?? new Set<string>(); n.add(idOr); index.set(ix("name", rec.name), n); }
    for (const [t, k] of Object.entries(keys) as [KeyType, string][]) {
      const s = index.get(ix(t, k)) ?? new Set<string>();
      s.add(idOr);
      index.set(ix(t, k), s);
    }
  }
  const names = spec.nameField ? [...byId.values()].map(r => ({ idOr: r.idOr, norm: normName(r.name), name: r.name ?? "" })) : [];
  // Blocage pour la ressemblance : on ne compare qu'aux noms partageant un mot.
  const nameBlocks = new Map<string, { idOr: string; norm: string; name: string }[]>();
  for (const n of names) for (const tok of new Set(n.norm.split(" ").filter(w => w.length >= 3))) { const l = nameBlocks.get(tok); if (l) l.push(n); else nameBlocks.set(tok, [n]); }
  return { spec, records, byId, index, names, duplicates: [...duplicates.values()], nameBlocks };
}

/** Clés d'un maître ambiguës (même clé normalisée sur plusieurs id_or, ex. EAN en double). */
export function ambiguousKeys(m: MasterIndex, type: KeyType): Conflict[] {
  const out: Conflict[] = [];
  for (const [k, ids] of m.index) if (k.startsWith(`${type}:`) && ids.size > 1) out.push({ sourceKey: k.slice(type.length + 1), candidates: [...ids], by: type });
  return out;
}

export interface MatchResult { entries: CrosswalkEntry[]; review: ReviewItem[]; report: ReconReport }

export function matchSource(m: MasterIndex, spec: SourceSpec, rows: Row[], decisions: Decisions = new Map(), opts: { fuzzyThreshold?: number } = {}): MatchResult {
  const threshold = opts.fuzzyThreshold ?? 0.82;
  const entries: CrosswalkEntry[] = [], review: ReviewItem[] = [], orphans: ReconReport["orphans"] = [], conflicts: Conflict[] = [];
  const seen = new Set<string>();
  const perIdOr = new Map<string, string[]>();
  const byMethod = { exact: 0, normalized: 0, validated: 0 };
  let pending = 0;
  for (const row of rows) {
    const sourceKey = String(row[spec.keyField] ?? "");
    if (!sourceKey || seen.has(sourceKey)) continue;
    seen.add(sourceKey);
    const name = spec.nameField ? String(row[spec.nameField] ?? "") : "";
    const push = (e: CrosswalkEntry) => { entries.push(e); byMethod[e.method]++; const l = perIdOr.get(e.idOr); if (l) l.push(sourceKey); else perIdOr.set(e.idOr, [sourceKey]); };

    // 1) Exacte : même valeur brute que la clé du maître.
    const exact = m.index.get(ix("raw", sourceKey)) ?? (name ? m.index.get(ix("name", name)) : undefined);
    if (exact?.size === 1) { const id = [...exact][0]; push({ domain: spec.domain, system: spec.system, sourceKey, idOr: canonicalOf(m, id), method: "exact", via: m.spec.keyField }); continue; }

    // 2) Clé normalisée.
    const found = new Map<string, string>();
    let ambiguous: Conflict | null = null;
    for (const rule of spec.keys) for (const [t, k] of keysFor(rule, row)) {
      const hit = m.index.get(ix(t, k));
      if (!hit?.size) continue;
      if (hit.size > 1) { ambiguous = { sourceKey, candidates: [...hit], by: `${t}=${k}` }; continue; }
      found.set(canonicalOf(m, [...hit][0]), `${rule.field}→${t}`);
    }
    if (found.size === 1 && !ambiguous) { const [[idOr, via]] = [...found]; push({ domain: spec.domain, system: spec.system, sourceKey, idOr, method: "normalized", via }); continue; }
    if (found.size > 1 || ambiguous) {
      conflicts.push(ambiguous ?? { sourceKey, candidates: [...found.keys()], by: [...found.values()].join(" / ") });
      orphans.push({ sourceKey, name, reason: "conflit de clés : validation humaine requise" });
      continue;
    }

    // 3) Ressemblance de nom : proposée, jamais appliquée sans validation.
    if (spec.fuzzy !== false && name && m.names.length) {
      const best = bestName(m, name);
      if (best && best.score >= threshold) {
        const id = reviewId(spec.domain, spec.system, sourceKey, best.idOr);
        const decision = decisions.get(id);
        if (decision === "validated") { push({ domain: spec.domain, system: spec.system, sourceKey, idOr: best.idOr, method: "validated", via: `nom (${best.score})`, score: best.score }); continue; }
        if (decision !== "rejected") { review.push({ id, domain: spec.domain, system: spec.system, sourceKey, sourceName: name, candidateIdOr: best.idOr, candidateName: best.name, score: best.score, status: "pending" }); pending++; orphans.push({ sourceKey, name, reason: `en attente de validation (score ${best.score})` }); continue; }
      }
    }
    orphans.push({ sourceKey, name: name || undefined, reason: "aucune clé ne correspond au maître" });
  }
  const duplicates: DuplicateGroup[] = [];
  for (const [idOr, keys] of perIdOr) if (keys.length > 1) duplicates.push({ idOr, sourceKeys: keys, by: "raw" });
  const total = seen.size, matched = entries.length;
  return { entries, review, report: { domain: spec.domain, system: spec.system, total, matched, pct: total ? Math.round((matched / total) * 1000) / 10 : 0, byMethod, orphans, duplicates, conflicts, pendingReview: pending } };
}

function canonicalOf(m: MasterIndex, idOr: string) { return idOr; }

function bestName(m: MasterIndex, name: string) {
  const n = normName(name);
  const seen = new Set<string>();
  let best: { idOr: string; name: string; score: number } | null = null;
  // Candidats : noms du maître partageant au moins un mot (les mots très fréquents sont ignorés).
  const toks = [...new Set(n.split(" ").filter(w => w.length >= 3))].map(t => m.nameBlocks.get(t) ?? []).filter(l => l.length <= 2000).sort((a, b) => a.length - b.length);
  for (const block of toks) for (const c of block) {
    if (seen.has(c.idOr)) continue;
    seen.add(c.idOr);
    const s = c.norm === n ? 1 : nameScore(n, c.norm);
    if (!best || s > best.score) best = { idOr: c.idOr, name: c.name, score: s };
    if (seen.size > 500) break;
  }
  return best;
}

/** Rapport du maître lui-même (doublons, clés ambiguës). */
export function masterReport(m: MasterIndex): ReconReport {
  const conflicts = [...ambiguousKeys(m, "ean"), ...ambiguousKeys(m, "ref")];
  const total = m.records.length;
  return { domain: m.spec.domain, system: m.spec.system, total, matched: total, pct: 100, byMethod: { exact: total, normalized: 0, validated: 0 }, orphans: [], duplicates: m.duplicates, conflicts, pendingReview: 0 };
}

/** Lien produit → fournisseur par le champ fournisseur du maître produit. */
export function linkProductsToSuppliers(products: MasterIndex, suppliers: MasterIndex, field: string, decisions: Decisions = new Map()): MatchResult {
  const rows = products.records.filter(r => !r.duplicateOf).map(r => ({ key: r.idOr, tax: r.raw[field], name: r.raw.supplierName }));
  return matchSource(suppliers, { domain: "supplier", system: `${products.spec.system}.${field}`, keyField: "key", nameField: undefined, keys: [{ type: "vat", field: "tax" }], fuzzy: false }, rows, decisions);
}
