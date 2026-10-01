// Données standard de Maison Lucie dans le modèle objet Supply, par le chemin
// normal : questionnaire « Cartographie des sources » (exemple Maison Lucie) →
// lecture des points d'accès déclarés (pages de 1 000 lignes, colonnes utiles
// seulement) → métadonnées et profil des colonnes → correspondances proposées
// avec leur score (nom, type, profil, indice du questionnaire) → acceptées
// au-dessus du seuil → indicateurs calculés, règles de résilience et alertes.
import type { AppCredential, AppField, ArgusVocab, EntityMapping, SiTableSnapshot } from "./argus-vocab-store";
import { withSupplyChainRulebook } from "./argus-vocab-store";
import { withSupplyChainModel } from "./supply-model";
import { withDerivedIndicators, type DerivedParams } from "./supply-derived";
import { maisonLucieExample, Q_ONTOLOGY, type QRow } from "../integration/questionnaire";
import { ATTRIBUTE_SPECS, profileColumns, scoreAttribute, type AttributeSpec, type ColType } from "../integration/discovery";
import { LUMEN_GATEWAY_TOKEN, MAISON_LUCIE_PORTAL } from "./maison-lucie-live";

export const STANDARD_DOMAIN = "Supply · SI standard Maison Lucie";
/** Seuil d'acceptation automatique (en dessous : « à valider » dans le Studio). */
export const STANDARD_THRESHOLD = 0.55;
const PAGE = 1000;
type Fetch = (url: string, init?: RequestInit) => Promise<Response>;
export type StandardStep = "questionnaire" | "lecture" | "mapping" | "indicateurs";
export interface StandardResult { ok: true; vocab: ArgusVocab; tables: number; rows: number; calls: number; mappings: number; accepted: number; rejected: { attribut: string; champ: string; score: number }[] }

const slug = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
/** Nom de table lisible d'un point d'accès : entité OData ou ressource REST. */
export const tableOfUrl = (acces: string) => { const u = new URL(acces); return u.searchParams.get("resource") ?? u.pathname.split("/").filter(Boolean).pop() ?? "data"; };

/** Lecture paginée d'un point d'accès déclaré, colonnes utiles seulement (projection poussée à la source). */
export async function readEndpoint(acces: string, columns: string[], opts: { fetch?: Fetch; token?: string; maxRows?: number } = {}): Promise<{ rows: Record<string, string>[]; calls: number }> {
  const f = opts.fetch ?? fetch, headers = { Authorization: `Bearer ${opts.token ?? LUMEN_GATEWAY_TOKEN}`, Accept: "application/json" };
  const cols = columns.join(","), out: Record<string, string>[] = [];
  const isOData = /\/sap\/opu\/odata\//.test(acces), isManhattan = /\/api\/sources\/manhattan\b/.test(acces);
  let calls = 0;
  const str = (row: Record<string, unknown>) => Object.fromEntries(columns.map(c => [c, row[c] === null || row[c] === undefined ? "" : String(row[c])]));
  for (let off = 0, page = 0; off < (opts.maxRows ?? 20_000); page++) {
    const url = isOData ? `${acces}?$top=${PAGE}&$skip=${off}&$select=${encodeURIComponent(cols)}`
      : `${acces}${acces.includes("?") ? "&" : "?"}fields=${encodeURIComponent(cols)}&${isManhattan ? `size=${PAGE}&page=${page}` : `limit=${PAGE}${off ? `&cursor=${off}` : ""}`}`;
    const r = await f(url, { headers }); calls++;
    if (!r.ok) throw new Error(`${new URL(url).pathname} → ${r.status}`);
    const j = await r.json() as { d?: { results: Record<string, unknown>[]; __next?: string }; items?: Record<string, unknown>[]; nextCursor?: string | null; data?: Record<string, unknown>[]; header?: { hasMore: boolean } };
    const rows = j.d?.results ?? j.items ?? j.data ?? [];
    out.push(...rows.map(str));
    const more = isOData ? !!j.d?.__next : isManhattan ? !!j.header?.hasMore : !!j.nextCursor;
    if (!more || !rows.length) break;
    off += rows.length;
  }
  return { rows: out, calls };
}

const TYPES: Record<string, ColType[]> = { number: ["integer", "decimal"], date: ["date", "datetime"], boolean: ["boolean", "string"], text: ["string", "integer"] };

/**
 * Charge le SI standard Maison Lucie dans le vocabulaire. `rows` : questionnaire
 * (par défaut l'exemple Maison Lucie) ; seules les lignes rattachées au modèle
 * objet (`model`) sont lues. S'arrête à la première erreur, avec l'étape.
 */
export async function loadStandardSi(start: ArgusVocab, opts: { base?: string; token?: string; fetch?: Fetch; rows?: QRow[]; threshold?: number; params?: Partial<DerivedParams>; onStep?: (s: StandardStep, detail: string) => void } = {}): Promise<StandardResult | { ok: false; step: StandardStep; error: string }> {
  const base = opts.base ?? MAISON_LUCIE_PORTAL, step = opts.onStep ?? (() => {});
  const threshold = opts.threshold ?? STANDARD_THRESHOLD;
  // 1. Questionnaire : lignes rattachées au modèle objet.
  const declared = (opts.rows ?? maisonLucieExample(base)).map(r => { const o = Q_ONTOLOGY.find(x => x.objet === r.objet && x.attribut === r.attribut); return { r, model: o?.model, binding: o?.binding }; }).filter((x): x is { r: QRow; model: string; binding: string | undefined } => !!x.model && !!x.r.champ && /^https?:/.test(x.r.acces));
  if (!declared.length) return { ok: false, step: "questionnaire", error: "Aucune ligne du questionnaire n'est rattachée au modèle objet Supply." };
  step("questionnaire", `${declared.length} correspondances déclarées`);
  // 2. Lecture : un appel par page et par point d'accès, colonnes déclarées seulement.
  const byUrl = new Map<string, { app: string; cols: Set<string> }>();
  for (const { r } of declared) { const e = byUrl.get(r.acces) ?? { app: r.sources, cols: new Set<string>() }; e.cols.add(r.champ); byUrl.set(r.acces, e); }
  const snapshots: SiTableSnapshot[] = [], fields: AppField[] = [];
  const apps = new Map<string, AppCredential>();
  const now = new Date().toISOString();
  let calls = 0, total = 0;
  for (const [acces, { app, cols }] of byUrl) {
    const appId = `mls-${slug(app)}`, table = tableOfUrl(acces);
    let read: { rows: Record<string, string>[]; calls: number };
    try { read = await readEndpoint(acces, [...cols], { fetch: opts.fetch, token: opts.token }); }
    catch (e) { return { ok: false, step: "lecture", error: `${app} · ${table} : ${(e as Error).message}` }; }
    calls += read.calls; total += read.rows.length;
    if (!apps.has(appId)) apps.set(appId, { id: appId, label: `${app} · SI standard Maison Lucie`, type: app, connectionHint: /\/sap\/opu\/odata\//.test(acces) ? "SAP OData v2" : "API REST", endpoint: new URL(acces).origin, secretConfigured: true, secretRef: "LUCIE_GATEWAY_TOKEN", sourceStatus: "connected", lastSyncAt: now, environment: "Maison Lucie · données synthétiques" });
    snapshots.push({ id: `${appId}:${table}`, appId, table, columns: [...cols], rows: read.rows, fetchedAt: now });
    for (const c of cols) fields.push({ id: `${appId}:${table}:${c}`, appId, name: `${table}.${c}`, liveTable: table, sampleValues: [...new Set(read.rows.slice(0, 50).map(x => x[c]).filter(Boolean))].slice(0, 6) });
    step("lecture", `${snapshots.length}/${byUrl.size} points d'accès · ${total.toLocaleString("fr-FR")} lignes · ${calls} appels`);
  }
  // 3. Correspondances : profil de la colonne déclarée et score (nom, type, profil, indice du questionnaire).
  let vocab = withSupplyChainModel(withSupplyChainRulebook({
    ...start, domaine: start.domaine ?? STANDARD_DOMAIN,
    apps: [...start.apps.filter(a => !a.id.startsWith("mls-")), ...apps.values()],
    fields: [...start.fields.filter(f => !f.appId.startsWith("mls-")), ...fields],
    siTables: [...(start.siTables ?? []).filter(s => !s.appId.startsWith("mls-")), ...snapshots],
    entityMappings: (start.entityMappings ?? []).filter(m => !m.appId.startsWith("mls-")),
  }));
  const mappings: EntityMapping[] = [], rejected: StandardResult["rejected"] = [];
  const profiles = new Map<string, ReturnType<typeof profileColumns>>();
  for (const { r, model, binding } of declared) {
    const appId = `mls-${slug(r.sources)}`, table = tableOfUrl(r.acces), snap = snapshots.find(s => s.appId === appId && s.table === table)!;
    const key = `${appId}:${table}`;
    if (!profiles.has(key)) profiles.set(key, profileColumns(snap.rows.slice(0, 500)));
    const entityId = model.slice(0, model.lastIndexOf(".")), entity = (vocab.entities ?? []).find(e => e.id === entityId), attr = entity?.attributes.find(a => a.id === model);
    if (!entity || !attr) continue;
    // Attribut de la couche d'intégration (synonymes FR/EN, motif de valeurs) quand il existe, sinon libellés du modèle.
    const known = binding ? ATTRIBUTE_SPECS.find(a => a.id === binding) : undefined;
    const spec: AttributeSpec = known ?? { id: model, label: `${entity.name} ${attr.name}`, synonyms: [r.attribut, attr.name], types: TYPES[attr.type] ?? ["string"] };
    const cand = scoreAttribute(spec, profiles.get(key)!.filter(p => p.name === r.champ), r.champ)[0];
    const score = cand?.score ?? 0;
    if (score < threshold) { rejected.push({ attribut: `${r.objet} · ${r.attribut}`, champ: `${table}.${r.champ}`, score }); continue; }
    if (mappings.some(m => m.attributeId === model && m.fieldId === `${key}:${r.champ}`)) continue;
    mappings.push({ id: `std:${model}:${key}:${r.champ}`, entityId, attributeId: model, appId, fieldId: `${key}:${r.champ}`, isMaster: r.sources === r.maitre, confidence: score, method: "semantique", rationale: `Questionnaire Maison Lucie (${r.sources} → ${r.champ}) ; score ${Math.round(score * 100)} % (nom ${cand.parts.nom}, type ${cand.parts.type}, profil ${cand.parts.profil}${cand.parts.indice !== null ? `, indice ${cand.parts.indice}` : ""}).` });
  }
  vocab = { ...vocab, entityMappings: [...(vocab.entityMappings ?? []), ...mappings] };
  step("mapping", `${mappings.length} correspondances acceptées (seuil ${Math.round(threshold * 100)} %)${rejected.length ? `, ${rejected.length} à valider` : ""}`);
  // 4. Indicateurs calculés, règles de résilience, alertes.
  const asOf = opts.params?.asOf ?? snapshots.flatMap(s => s.rows.map(x => x.AssessedOn || x.UpdatedAt || "")).filter(Boolean).sort().pop()?.slice(0, 10);
  vocab = withDerivedIndicators(vocab, { ...opts.params, ...(asOf ? { asOf } : {}) });
  step("indicateurs", `${(vocab.siTables ?? []).filter(s => s.appId === "aura-derive").length} tables calculées`);
  return { ok: true, vocab, tables: snapshots.length, rows: total, calls, mappings: mappings.length, accepted: mappings.length, rejected };
}
