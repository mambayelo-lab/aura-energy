// Pipeline d'intégration : référentiels légers → crosswalk → indicateurs agrégés
// → alertes avec preuve. Premier chargement complet, puis incrémental (watermark).
// Rien n'est copié ligne à ligne : les requêtes sont poussées à la source (GROUP BY,
// filtre), les lignes lues en flux ne sont pas conservées, aucun client individuel
// n'est stocké (les commandes clients ne sont lues qu'agrégées par produit/statut).
import { buildMaster, linkProductsToSuppliers, masterReport, matchSource, type CrosswalkEntry, type Decisions, type MasterIndex, type ReconReport, type ReviewItem, type SourceSpec } from "./crosswalk";
import { masterSpecs, sourceSpecs, type Binding, type IntegrationTemplate } from "./templates";
import { TieredCache, sharedTieredCache } from "./cache";
import { normRef, normSite } from "./normalize";
import { isoOf } from "./connectors/base";
import { BudgetError } from "./budget";
import { DEFAULT_ALERT_SETTINGS, DEFAULT_OPTIONS, type AlertSettings } from "./questionnaire";
const ASIA = new Set(["CN", "HK", "TW", "IN", "VN", "TH", "BD", "ID", "MY", "KH", "PK", "LK", "PH", "KR", "JP", "SG", "MM"]);
const optionsFor = (ctx: { settings?: AlertSettings }, k: keyof typeof DEFAULT_OPTIONS) => { const o = ctx.settings?.options?.[k]; return o && o.length >= 2 ? o : DEFAULT_OPTIONS[k]; };
import { ATTR, defaultAcv, detectDivergences, type Acv, type Divergence, type ObservedValue } from "./ownership";
import type { Connector, ObjectClass, QuerySpec, Row } from "./types";

export type SyncMode = "full" | "incremental";

export interface RunLog {
  runId: string; sourceId: string; entity: string; step: string; mode: SyncMode;
  startedAt: string; durationMs: number; rowsRead: number; rowsStored: number; calls: number;
  pushedDown: boolean; watermarkBefore: string | null; watermarkAfter: string | null; error?: string; deferred?: boolean;
}

export interface IntegrationAlert {
  id: string; kind: "rupture" | "retard" | "risque-fournisseur" | "ecart-sources"; severity: "critique" | "majeure" | "mineure";
  label: string; subject: string; subjectLabel: string; decisionQuestion: string; options: string[];
  evidence: { source: string; statement: string; asOf: string; values: Record<string, string | number>; sample: Row[] };
}

export interface MasterRow { idOr: string; key: string; name?: string; [k: string]: unknown }

export interface IntegrationState {
  version: 1;
  templateId: string;
  asOf: string;
  watermarks: Record<string, string>;
  masters: { supplier: MasterRow[]; product: MasterRow[]; site: MasterRow[] };
  crosswalk: CrosswalkEntry[];
  reports: ReconReport[];
  review: ReviewItem[];
  decisions: Record<string, "validated" | "rejected">;
  /** Positions en rupture (clé article|site) : seul état ligne à ligne conservé, et seulement pour les alertes. */
  stockouts: Record<string, { item: string; site: string; productId: string | null; siteId: string | null; onHand: number; allocated: number; safety: number }>;
  supplierStats: Record<string, { name: string; idOr: string | null; shipments: number; late: number }>;
  series: Record<string, { t: string; v: number }[]>;
  alerts: IntegrationAlert[];
  runs: RunLog[];
  /** Contrôle golden record : valeurs différentes pour un même id_or selon les sources. */
  divergences: Divergence[];
  divergenceCount: number;
  /** Replis déclarés : maître indisponible, valeur prise ailleurs (signalée comme telle). */
  fallbacks: { domain: string; master: string; used: string; reason: string; at: string }[];
}

export const emptyState = (templateId: string, asOf: string): IntegrationState => ({
  version: 1, templateId, asOf, watermarks: {}, masters: { supplier: [], product: [], site: [] }, crosswalk: [], reports: [], review: [], decisions: {}, stockouts: {}, supplierStats: {}, series: {}, alerts: [], runs: [], divergences: [], divergenceCount: 0, fallbacks: [],
});

export interface PipelineContext {
  template: IntegrationTemplate;
  connectors: Record<string, Connector & { close?(): Promise<void>; calls?: number }>;
  state: IntegrationState;
  mode: SyncMode;
  asOf: string;
  cache?: TieredCache;
  onLog?: (r: RunLog) => void;
  /** Échantillons de preuve limités (lignes par alerte). */
  evidenceRows?: number;
  /** ACV Master/Consumer par attribut (héritage du maître de domaine par défaut). */
  acv?: Acv;
  /** Réglages des alertes (étape 4 du Studio). */
  settings?: AlertSettings;
}

const wmKey = (b: Binding) => `${b.source}:${b.entity}`;
const now = () => new Date().toISOString();

const MASTER_CACHE = new Map<string, MasterIndex>();
const LINK_CACHE = new WeakMap<MasterIndex, { suppliers: MasterIndex; link: ReturnType<typeof linkProductsToSuppliers> }>();

export async function runPipeline(ctx: PipelineContext): Promise<IntegrationState> {
  const { template: t, state, mode } = ctx;
  const cache = ctx.cache ?? sharedTieredCache;
  const runId = `run-${Date.now().toString(36)}`;
  const logs: RunLog[] = [];
  const conn = (b: Binding) => { const c = ctx.connectors[b.source]; if (!c) throw new Error(`Source non connectée : ${b.source}`); return c; };

  async function step<T>(b: Binding, name: string, fn: (log: RunLog) => Promise<T>): Promise<T | undefined> {
    // Objet sans source active (source désactivée ou non déclarée) : étape suspendue, déclarée au journal.
    if (!ctx.connectors[b.source]) { const skip: RunLog = { runId, sourceId: b.source || "—", entity: b.entity, step: name, mode, startedAt: now(), durationMs: 0, rowsRead: 0, rowsStored: 0, calls: 0, pushedDown: false, watermarkBefore: null, watermarkAfter: null, error: "source désactivée ou absente : étape suspendue" }; logs.push(skip); ctx.onLog?.(skip); return undefined; }
    const c = conn(b);
    const log: RunLog = { runId, sourceId: b.source, entity: b.entity, step: name, mode, startedAt: now(), durationMs: 0, rowsRead: 0, rowsStored: 0, calls: 0, pushedDown: false, watermarkBefore: state.watermarks[wmKey(b)] ?? null, watermarkAfter: null };
    const t0 = performance.now(), calls0 = c.calls ?? 0;
    try { return await fn(log); }
    catch (e) { log.error = (e as Error).message; log.deferred = e instanceof BudgetError; return undefined; }
    finally {
      log.durationMs = Math.round(performance.now() - t0);
      log.calls = (c.calls ?? 0) - calls0;
      log.watermarkAfter = state.watermarks[wmKey(b)] ?? log.watermarkBefore;
      logs.push(log); ctx.onLog?.(log);
    }
  }

  state.fallbacks = [];
  /** Lecture incrémentale d'un référentiel : seules les lignes modifiées depuis le watermark. */
  async function syncMaster(b: Binding, current: MasterRow[], toRow: (r: Row) => MasterRow, domain = b.entity): Promise<MasterRow[]> {
    const out = await step(b, "référentiel", async log => {
      const since = mode === "incremental" ? state.watermarks[wmKey(b)] ?? null : null;
      const byKey = new Map((since ? current : []).map(r => [r.key, r]));
      const fields = Object.values(b.fields);
      let wm = since;
      for await (const batch of conn(b).readIncremental(b.entity, b.watermark ?? fields[0], since, { select: fields })) {
        log.rowsRead += batch.rows.length;
        for (const r of batch.rows) { const m = toRow(r); byKey.set(m.key, m); }
        if (batch.watermark && (!wm || batch.watermark > wm)) wm = batch.watermark;
      }
      if (b.watermark && wm) state.watermarks[wmKey(b)] = wm;
      log.rowsStored = byKey.size;
      return [...byKey.values()];
    });
    if (!out) {
      // Maître indisponible : repli déclaré sur la dernière copie connue (jamais silencieux).
      const err = logs.at(-1)?.error ?? "indisponible";
      state.fallbacks.push({ domain, master: b.source, used: current.length ? `dernière copie du maître (${current.length} enregistrements)` : "aucune copie : domaine vide", reason: err, at: now() });
    }
    return out ?? current;
  }

  let lastFromCache = false;
  /** Agrégat poussé à la source, mis en cache (clé = requête + watermark, TTL par classe d'objet). */
  async function aggregate(b: Binding, spec: Omit<QuerySpec, "entity">, objectClass: ObjectClass, log: RunLog): Promise<Row[]> {
    const c = conn(b), full: QuerySpec = { entity: b.entity, ...spec };
    const key = cache.key(b.source, full, state.watermarks[wmKey(b)] ?? null);
    const { value, fromCache } = await cache.getOrLoad(key, objectClass, async () => {
      const r = await c.query(full);
      log.rowsRead += r.rowsRead; log.pushedDown = r.pushedDown.aggregate || r.pushedDown.filter;
      return r.rows;
    });
    if (fromCache) log.pushedDown = true;
    lastFromCache = fromCache;
    return value;
  }

  // ── 1. Référentiels (un maître par domaine) ─────────────────────────────────
  const sb = t.bindings.suppliers.fields, pb = t.bindings.products.fields, fb = t.bindings.facilities.fields;
  state.masters.supplier = await syncMaster(t.bindings.suppliers, state.masters.supplier, r => ({ idOr: "", key: String(r[sb.key]), name: String(r[sb.name] ?? ""), country: r[sb.country] ?? null, siret: r[sb.siret] ?? null, vat: r[sb.vat] ?? null, duns: r[sb.duns] ?? null, legacy: r[sb.legacy] ?? null }));
  state.masters.product = await syncMaster(t.bindings.products, state.masters.product, r => ({ idOr: "", key: String(r[pb.key]), name: String(r[pb.name] ?? ""), ean: r[pb.ean] ?? null, ref: r[pb.ref] ?? null, supplierTaxId: r[pb.supplierTaxId] ?? null, supplierCountry: pb.supplierCountry ? r[pb.supplierCountry] ?? null : null }));
  state.masters.site = await syncMaster(t.bindings.facilities, state.masters.site, r => ({ idOr: "", key: String(r[fb.code] ?? r[fb.key]), code: r[fb.code] ?? null, facility: r[fb.key] ?? null, type: r[fb.type] ?? null }));

  const specs = masterSpecs(t);
  const asMaster = (rows: MasterRow[], map: Record<string, string>) => rows.map(r => Object.fromEntries(Object.entries(map).filter(([, f]) => f).map(([k, f]) => [f, r[k]])) as Row);
  // Index des maîtres conservé en mémoire tant que le référentiel n'a pas changé (même watermark, même volume).
  const cached = (b: Binding, rows: MasterRow[], build: () => MasterIndex) => {
    const k = `${t.id}|${b.source}|${b.entity}|${state.watermarks[wmKey(b)] ?? "-"}|${rows.length}`;
    const hit = MASTER_CACHE.get(k);
    if (hit && mode === "incremental") return hit;
    const m = build(); MASTER_CACHE.set(k, m); if (MASTER_CACHE.size > 12) MASTER_CACHE.delete(MASTER_CACHE.keys().next().value as string);
    return m;
  };
  const supplierM = cached(t.bindings.suppliers, state.masters.supplier, () => buildMaster(specs.supplier, asMaster(state.masters.supplier, { key: sb.key, name: sb.name, siret: sb.siret, vat: sb.vat, duns: sb.duns, legacy: sb.legacy, country: sb.country })));
  const productM = cached(t.bindings.products, state.masters.product, () => buildMaster(specs.product, asMaster(state.masters.product, { key: pb.key, name: pb.name, ean: pb.ean, ref: pb.ref, supplierTaxId: pb.supplierTaxId })));
  const siteM = cached(t.bindings.facilities, state.masters.site, () => buildMaster(specs.site, asMaster(state.masters.site, { key: fb.code, code: fb.code, facility: fb.key })));
  const decisions: Decisions = new Map(Object.entries(state.decisions));

  // Lien produit → fournisseur par le champ fournisseur du maître produit.
  const prevLink = LINK_CACHE.get(productM);
  const link = prevLink && prevLink.suppliers === supplierM ? prevLink.link : linkProductsToSuppliers(productM, supplierM, pb.supplierTaxId, decisions);
  LINK_CACHE.set(productM, { suppliers: supplierM, link });
  const supplierOfProduct = new Map(link.entries.map(e => [e.sourceKey, e.idOr]));
  setIds(state.masters.supplier, supplierM); setIds(state.masters.product, productM); setIds(state.masters.site, siteM);
  for (const p of state.masters.product) p.supplierIdOr = supplierOfProduct.get(p.idOr) ?? null;

  const reports: ReconReport[] = [masterReport(supplierM), masterReport(productM), masterReport(siteM), { ...link.report, duplicates: [], system: `${t.masters.product} → fournisseur` }];
  const crosswalk: CrosswalkEntry[] = [...masterEntries(supplierM), ...masterEntries(productM), ...masterEntries(siteM)];
  const review: ReviewItem[] = [];
  const src = sourceSpecs(t);
  const observed: ObservedValue[] = [];
  for (const r of supplierM.records) {
    const sys = r.duplicateOf ? `${t.masters.supplier} (doublon ${r.sourceKey})` : t.masters.supplier;
    observed.push({ idOr: r.idOr, domain: "supplier", attribute: ATTR.supplierName, system: sys, value: r.name }, { idOr: r.idOr, domain: "supplier", attribute: ATTR.supplierCountry, system: sys, value: r.raw[sb.country] });
  }
  for (const p of state.masters.product) if (p.supplierIdOr && p.supplierCountry) observed.push({ idOr: p.supplierIdOr as string, domain: "supplier", attribute: ATTR.supplierCountry, system: t.masters.product, value: p.supplierCountry });
  const keep = (m: ReturnType<typeof matchSource>) => { for (const e of m.entries) crosswalk.push(e); for (const r of m.review) review.push(r); reports.push(m.report); return new Map(m.entries.map(e => [e.sourceKey, e.idOr])); };
  // Incrémental : le crosswalk d'un système déjà rapproché est réutilisé ; seules les clés nouvelles sont rapprochées.
  const prevEntries = new Map<string, CrosswalkEntry[]>();
  for (const e of state.crosswalk) { const l = prevEntries.get(e.system); if (l) l.push(e); else prevEntries.set(e.system, [e]); }
  const prevReports = new Map(state.reports.map(r => [r.system, r]));
  const prevReview = state.review;
  const match = (m: MasterIndex, spec: SourceSpec, rows: Row[], reusable: boolean) => {
    const prev = prevEntries.get(spec.system), prevReport = prevReports.get(spec.system);
    if (mode === "incremental" && prev && prevReport) {
      // Décisions de validation prises depuis le dernier passage : appliquées sans relecture.
      const validated = Object.entries(state.decisions).filter(([id, d]) => d === "validated" && id.startsWith(`${spec.domain}|${spec.system}|`)).map(([id]) => id.split("|"));
      const have = new Set(prev.map(e => e.sourceKey));
      const added: CrosswalkEntry[] = validated.filter(([, , k]) => !have.has(k)).map(([, , k, idOr]) => ({ domain: spec.domain, system: spec.system, sourceKey: k, idOr, method: "validated", via: "validation humaine" }));
      if (added.length) { prev.push(...added.slice(0, 10_000)); prevReport.matched += added.length; prevReport.pendingReview = Math.max(0, prevReport.pendingReview - added.length); prevReport.orphans = prevReport.orphans.filter(o => !added.some(a => a.sourceKey === o.sourceKey)); prevReport.pct = prevReport.total ? Math.round((prevReport.matched / prevReport.total) * 1000) / 10 : 0; }
      if (reusable) return keep({ entries: prev, review: prevReview.filter(r => r.system === spec.system && !state.decisions[r.id]), report: prevReport });
      const known = new Set(prev.map(e => e.sourceKey));
      const fresh = matchSource(m, spec, rows.filter(r => !known.has(String(r[spec.keyField] ?? ""))), decisions);
      const report: ReconReport = { ...prevReport, total: prevReport.total + fresh.report.total, matched: prevReport.matched + fresh.report.matched, orphans: [...prevReport.orphans, ...fresh.report.orphans], conflicts: [...prevReport.conflicts, ...fresh.report.conflicts], pendingReview: prevReport.pendingReview + fresh.report.pendingReview };
      report.pct = report.total ? Math.round((report.matched / report.total) * 1000) / 10 : 0;
      return keep({ entries: [...prev, ...fresh.entries], review: [...prevReview.filter(r => r.system === spec.system), ...fresh.review], report });
    }
    return keep(matchSource(m, spec, rows, decisions));
  };

  // ── 2. Stock : ruptures (filtre poussé à la source) et crosswalk article/site ──
  const st = t.bindings.stock, stf = st.fields;
  let itemMap = new Map<string, string>(), siteMap = new Map<string, string>();
  const changedItems = new Set<string>(), changedSites = new Set<string>();
  await step(st, "ruptures", async log => {
    const since = mode === "incremental" ? state.watermarks[wmKey(st)] ?? null : null;
    const pos = (r: Row) => ({ item: String(r[stf.item]), site: String(r[stf.site]), onHand: Number(r[stf.onHand]), allocated: Number(r[stf.allocated]), safety: Number(r[stf.safety]) });
    const enrich = (p: ReturnType<typeof pos>) => ({ ...p, productId: null as string | null, siteId: null as string | null });
    if (!since && conn(st).pushdown.columnExpr) {
      // Premier chargement : seules les positions en rupture remontent (WHERE poussé à la source).
      const rows = await aggregate(st, { where: [{ kind: "diff_lt", a: stf.onHand, b: stf.allocated, c: stf.safety }], select: [stf.item, stf.site, stf.onHand, stf.allocated, stf.safety] }, "stock", log);
      state.stockouts = {};
      for (const r of rows) { const p = pos(r); state.stockouts[`${p.item}|${p.site}`] = enrich(p); }
      const wm = await maxOf(conn(st), st, log);
      if (wm) state.watermarks[wmKey(st)] = wm;
    } else if (!since) {
      // Source sans filtre sur expression (API) : un seul parcours paginé, évalué en flux, rien n'est conservé hors alertes.
      state.stockouts = {};
      let wm: string | null = null;
      for await (const b of conn(st).readIncremental(st.entity, st.watermark!, null, { select: [stf.item, stf.site, stf.onHand, stf.allocated, stf.safety] })) {
        log.rowsRead += b.rows.length;
        for (const r of b.rows) { const p = pos(r); if (p.onHand - p.allocated < p.safety) state.stockouts[`${p.item}|${p.site}`] = enrich(p); }
        if (b.watermark && b.watermark > (wm ?? "")) wm = b.watermark;
      }
      if (wm) state.watermarks[wmKey(st)] = wm;
    } else {
      // Incrémental (CDC par watermark) : positions modifiées seulement ; ouverture ou fermeture d'alerte.
      let wm = since;
      for await (const b of conn(st).readIncremental(st.entity, st.watermark!, since, { select: [stf.item, stf.site, stf.onHand, stf.allocated, stf.safety] })) {
        log.rowsRead += b.rows.length;
        for (const r of b.rows) { const p = pos(r), k = `${p.item}|${p.site}`; changedItems.add(p.item); changedSites.add(p.site); if (p.onHand - p.allocated < p.safety) state.stockouts[k] = enrich(p); else delete state.stockouts[k]; }
        if (b.watermark && b.watermark > (wm ?? "")) wm = b.watermark;
      }
      if (wm) state.watermarks[wmKey(st)] = wm;
    }
    log.rowsStored = Object.keys(state.stockouts).length;
  });

  await step(st, "clés articles et sites", async log => {
    const incremental = mode === "incremental" && prevEntries.has(src.stockItems.system);
    // Incrémental : seules les clés des lignes modifiées sont rapprochées (aucune relecture complète).
    const items = incremental ? [...changedItems].map(k => ({ [stf.item]: k })) : await aggregate(st, { groupBy: [stf.item], metrics: [{ fn: "count", as: "n" }] }, "stock", log);
    const sites = incremental ? [...changedSites].map(k => ({ [stf.site]: k })) : await aggregate(st, { groupBy: [stf.site], metrics: [{ fn: "count", as: "n" }] }, "stock", log);
    itemMap = match(productM, src.stockItems, items, false);
    siteMap = match(siteM, src.stockSites, sites, false);
    log.rowsStored = items.length + sites.length;
  });
  for (const o of Object.values(state.stockouts)) { o.productId = itemMap.get(o.item) ?? null; o.siteId = siteMap.get(o.site) ?? null; }

  // ── 3. Expéditions : retards par fournisseur (GROUP BY à la source) ──────────
  const sh = t.bindings.shipments, shf = sh.fields;
  await step(sh, "retards fournisseurs", async log => {
    const since = mode === "incremental" ? state.watermarks[wmKey(sh)] ?? null : null;
    let touched: string[] | null = null;
    if (since) {
      // Fournisseurs touchés depuis le watermark (clé seule), puis ré-agrégation ciblée.
      const changed = await aggregate(sh, { filters: [{ field: sh.watermark!, op: "gt", value: since }], groupBy: [shf.supplierName], metrics: [{ fn: "count", as: "n" }] }, "shipment", log);
      touched = changed.map(r => String(r[shf.supplierName]));
      if (!touched.length) return;
    }
    const scope = touched ? [{ field: shf.supplierName, op: "in" as const, value: touched }] : [];
    // Taux de retard sur les expéditions échues (date prévue passée) : les expéditions à venir ne comptent pas.
    const totals = await aggregate(sh, { filters: [...scope, { field: shf.expected, op: "lt", value: ctx.asOf }], groupBy: [shf.supplierName], metrics: [{ fn: "count", as: "shipments" }, { fn: "max", field: sh.watermark!, as: "wm" }] }, "shipment", log);
    const lates = await aggregate(sh, { filters: scope, where: [{ kind: "late", actual: shf.actual, expected: shf.expected, asOf: ctx.asOf }], groupBy: [shf.supplierName], metrics: [{ fn: "count", as: "late" }] }, "shipment", log);
    const supMap = match(supplierM, src.shipmentSuppliers, totals, false);
    for (const [name, idOr] of supMap) observed.push({ idOr, domain: "supplier", attribute: ATTR.supplierName, system: sh.source, value: name });
    const lateBy = new Map(lates.map(r => [String(r[shf.supplierName]), Number(r.late)]));
    if (!touched) state.supplierStats = {};
    for (const r of totals) {
      const name = String(r[shf.supplierName]);
      state.supplierStats[name] = { name, idOr: supMap.get(name) ?? null, shipments: Number(r.shipments), late: lateBy.get(name) ?? 0 };
    }
    const wm = totals.reduce<string | null>((m, r) => { const v = isoOf(r.wm); return v && (!m || v > m) ? v : m; }, since);
    if (wm) state.watermarks[wmKey(sh)] = wm;
    log.rowsStored = Object.keys(state.supplierStats).length;
  });

  // ── 4. Commandes clients : agrégées par produit et statut (aucun client stocké) ──
  const od = t.bindings.orders, odf = od.fields;
  let backorders = new Map<string, number>();
  await step(od, "commandes en attente", async log => {
    // Statuts « en attente de stock » : réglables (étape 4), comparés sans tenir compte de la casse.
    const statuses = (ctx.settings ?? DEFAULT_ALERT_SETTINGS).backorderStatuses.flatMap(x => [x, x.toUpperCase(), x.toLowerCase()]);
    const rows = await aggregate(od, { filters: [{ field: odf.status, op: "in", value: [...new Set(statuses)] }], groupBy: [odf.product], metrics: [{ fn: "sum", field: odf.qty, as: "qty" }] }, "order", log);
    const map = match(productM, src.orderProducts, rows, lastFromCache);
    for (const [ref, idOr] of map) observed.push({ idOr, domain: "product", attribute: ATTR.productRef, system: od.source, value: ref }, { idOr, domain: "product", attribute: ATTR.productRef, system: t.masters.product, value: productM.byId.get(idOr)?.raw[pb.ref] });
    backorders = new Map();
    for (const r of rows) { const id = map.get(String(r[odf.product])); if (id) backorders.set(id, (backorders.get(id) ?? 0) + Number(r.qty)); }
    const byStatus = await aggregate(od, { groupBy: [odf.status], metrics: [{ fn: "count", as: "n" }] }, "order", log);
    state.series["oms.lignes_par_statut"] = byStatus.map(r => ({ t: String(r[odf.status]), v: Number(r.n) }));
    log.rowsStored = backorders.size + byStatus.length;
  });

  // ── 5. Ventes : série mensuelle et vélocité des articles en alerte (lac) ──────
  const sa = t.bindings.sales, saf = sa.fields;
  const velocity = new Map<string, number>();
  await step(sa, "ventes", async log => {
    const days = (ctx.settings ?? DEFAULT_ALERT_SETTINGS).velocityDays;
    const from = new Date(Date.parse(ctx.asOf) - days * 86400_000).toISOString().slice(0, 10);
    const byEan = await aggregate(sa, { filters: [{ field: saf.date, op: "ge", value: from }], groupBy: [saf.ean], metrics: [{ fn: "sum", field: saf.qty, as: "qty" }] }, "sales", log);
    const map = match(productM, src.salesProducts, byEan, lastFromCache);
    for (const r of byEan) { const id = map.get(String(r[saf.ean])); if (id) velocity.set(id, Math.round((Number(r.qty) / days) * 100) / 100); }
    const stores = await aggregate(sa, { groupBy: [saf.store], metrics: [{ fn: "count", as: "n" }] }, "sales", log);
    match(siteM, src.salesSites, stores, lastFromCache);
    log.rowsStored = velocity.size + stores.length;
  });

  // ── 6. Alertes avec preuve ──────────────────────────────────────────────────
  // Systèmes non relus pendant ce passage (rien de modifié) : leur rapprochement précédent est conservé.
  if (mode === "incremental") {
    const done = new Set(reports.map(r => r.system));
    for (const [sys, rep] of prevReports) if (!done.has(sys)) { reports.push(rep); for (const e of prevEntries.get(sys) ?? []) crosswalk.push(e); for (const r of prevReview) if (r.system === sys) review.push(r); }
  }
  state.crosswalk = crosswalk;
  state.reports = reports;
  // La file de validation conserve les décisions déjà prises.
  state.review = review.filter(r => !state.decisions[r.id]);
  const acv = ctx.acv ?? defaultAcv(t.masters, { supplier: [t.bindings.shipments.source], product: [t.bindings.stock.source, t.bindings.orders.source, t.bindings.sales.source], site: [t.bindings.sales.source] });
  const divergences = detectDivergences(acv, observed);
  state.divergenceCount = divergences.length;
  state.divergences = divergences.slice(0, 500);
  state.alerts = buildAlerts(ctx, state, productM, supplierM, velocity, backorders);
  const stamp = ctx.asOf;
  const push = (name: string, v: number) => { const s = (state.series[name] ??= []); s.push({ t: stamp, v }); if (s.length > 400) s.splice(0, s.length - 400); };
  push("stock.positions_en_rupture", Object.keys(state.stockouts).length);
  const tot = Object.values(state.supplierStats).reduce((a, s) => ({ n: a.n + s.shipments, l: a.l + s.late }), { n: 0, l: 0 });
  push("expeditions.taux_retard_pct", tot.n ? Math.round((tot.l / tot.n) * 1000) / 10 : 0);
  state.asOf = ctx.asOf;
  state.runs = [...logs, ...state.runs].slice(0, 300);
  for (const c of Object.values(ctx.connectors)) await c.close?.();
  return state;
}

async function maxOf(c: Connector, b: Binding, log: RunLog): Promise<string | null> {
  if (!b.watermark) return null;
  const r = await c.query({ entity: b.entity, metrics: [{ fn: "max", field: b.watermark, as: "wm" }] });
  log.rowsRead += r.rowsRead;
  return isoOf(r.rows[0]?.wm ?? null);
}

function setIds(rows: MasterRow[], m: MasterIndex) {
  const by = new Map(m.records.map(r => [r.sourceKey, r.idOr]));
  for (const r of rows) r.idOr = by.get(r.key) ?? r.idOr;
}
function masterEntries(m: MasterIndex): CrosswalkEntry[] {
  return m.records.map(r => ({ domain: m.spec.domain, system: m.spec.system, sourceKey: r.sourceKey, idOr: r.idOr, method: r.duplicateOf ? "normalized" as const : "exact" as const, via: r.duplicateOf ? "doublon maître" : m.spec.keyField }));
}

function buildAlerts(ctx: PipelineContext, state: IntegrationState, products: MasterIndex, suppliers: MasterIndex, velocity: Map<string, number>, backorders: Map<string, number>): IntegrationAlert[] {
  const out = buildAlertsCore(ctx, state, products, suppliers, velocity, backorders);
  const lbl = (sys: string) => sys.replace(/^[\w-]+/, id => ctx.template.sources.find(x => x.id === id)?.label ?? id);
  for (const a of out) a.evidence.source = lbl(a.evidence.source);
  // Preuve : écarts entre sources au-delà de la tolérance et replis déclarés, pour l'objet de l'alerte.
  for (const a of out) {
    for (const d of state.divergences.filter(x => x.idOr === a.subject && x.kind === "fond").slice(0, 3))
      for (const o of d.others) a.evidence.values[`écart ${d.attribute} (${lbl(o.system)})`] = `${o.value} ; maître ${lbl(d.master.system)} : ${d.master.value}`;
    for (const f of state.fallbacks) a.evidence.values[`repli ${f.domain}`] = `${lbl(f.master)} indisponible → ${f.used}`;
  }
  // Écarts de fond entre sources : une alerte de qualité des données, avec les premiers écarts en preuve.
  const fond = state.divergences.filter(d => d.kind === "fond");
  if (fond.length) out.push({
    id: "INT-ECART", kind: "ecart-sources", severity: fond.length > 20 ? "majeure" : "mineure",
    label: `Écarts entre sources : ${fond.length} valeur${fond.length > 1 ? "s" : ""} différente${fond.length > 1 ? "s" : ""} du maître`,
    subject: fond[0].idOr, subjectLabel: fond[0].attribute, decisionQuestion: "Quelle valeur retenir et où corriger les écarts entre sources ?",
    options: optionsFor(ctx, "ecart-sources"),
    evidence: { source: lbl(fond[0].master.system), statement: "comparaison au maître de chaque attribut, selon sa tolérance", asOf: ctx.asOf,
      values: Object.fromEntries(fond.slice(0, 4).map(d => [`${d.attribute} · ${d.idOr}`, `${d.others.map(o => `${lbl(o.system)} : ${o.value}`).join(", ")} ; maître : ${d.master.value}`])), sample: [] },
  });
  return out;
}

function buildAlertsCore(ctx: PipelineContext, state: IntegrationState, products: MasterIndex, suppliers: MasterIndex, velocity: Map<string, number>, backorders: Map<string, number>): IntegrationAlert[] {
  const n = ctx.evidenceRows ?? 5, t = ctx.template, alerts: IntegrationAlert[] = [];
  const pname = (id: string | null) => (id ? String(products.byId.get(id)?.raw[t.bindings.products.fields.ref] ?? products.byId.get(id)?.name ?? id) : "article inconnu");
  const sname = (id: string | null) => (id ? suppliers.byId.get(id)?.name ?? id : "fournisseur inconnu");
  const legacyOf = (id: string | null) => (id ? String(suppliers.byId.get(id)?.raw[t.bindings.suppliers.fields.legacy] ?? "") : "");

  // Ruptures : regroupées par article, classées par demande perdue estimée (vélocité × manque).
  const outs = Object.values(state.stockouts);
  const byProduct = new Map<string, typeof outs>();
  for (const o of outs) { const k = o.productId ?? `?${o.item}`; byProduct.set(k, [...(byProduct.get(k) ?? []), o]); }
  const ranked = [...byProduct.entries()].map(([id, list]) => ({ id, list, v: velocity.get(id) ?? 0, bo: backorders.get(id) ?? 0, gap: list.reduce((s, o) => s + Math.max(0, o.safety - (o.onHand - o.allocated)), 0) }))
    .sort((a, b) => b.v * b.gap + b.bo - (a.v * a.gap + a.bo) || b.gap - a.gap);
  if (outs.length) {
    const top = ranked[0];
    alerts.push({
      id: "INT-RUPTURE", kind: "rupture", severity: outs.length > 20 || top.bo > 0 ? "critique" : "majeure",
      label: `Ruptures de stock : ${outs.length} position${outs.length > 1 ? "s" : ""} sous le stock de sécurité`,
      subject: top.id, subjectLabel: pname(top.id.startsWith("?") ? null : top.id),
      decisionQuestion: `Comment couvrir la rupture de ${pname(top.id.startsWith("?") ? null : top.id)} (${top.list.length} site${top.list.length > 1 ? "s" : ""}) ?`,
      options: optionsFor(ctx, "rupture"),
      evidence: { source: t.bindings.stock.source, statement: `${t.bindings.stock.entity} WHERE ${t.bindings.stock.fields.onHand} - ${t.bindings.stock.fields.allocated} < ${t.bindings.stock.fields.safety}`, asOf: ctx.asOf,
        values: { positions: outs.length, articles: byProduct.size, manque_unites: top.gap, ventes_jour: top.v, commandes_en_attente: top.bo },
        sample: top.list.slice(0, n).map(o => ({ article: pname(o.productId), site: o.site, disponible: o.onHand - o.allocated, securite: o.safety })) },
    });
  }
  // Retards : fournisseurs dont plus de 30 % des expéditions (≥ 5) sont en retard.
  const cfg = ctx.settings ?? DEFAULT_ALERT_SETTINGS;
  const late = Object.values(state.supplierStats).filter(s => s.shipments >= cfg.minShipments && s.late / s.shipments > cfg.lateRatePct / 100).sort((a, b) => b.late / b.shipments - a.late / a.shipments);
  for (const s of late.slice(0, 3)) {
    const pct = Math.round((s.late / s.shipments) * 100);
    const legacy = legacyOf(s.idOr);
    // Fournisseur en Asie : le flux vers l'Europe passe par la mer Rouge (ou contourne par le cap) s'il est maritime.
    const country = String(state.masters.supplier.find(m => m.idOr === s.idOr)?.country ?? "").toUpperCase();
    const asia = ASIA.has(country);
    const who = s.idOr ? sname(s.idOr) : s.name;
    alerts.push({
      id: `INT-RETARD-${asia ? "ASIE-" : ""}${s.idOr ?? s.name}`, kind: "retard", severity: pct >= 50 ? "critique" : "majeure",
      label: asia ? `Retards sur la route Asie → Europe : ${s.idOr ? who : `${s.name} (à rapprocher)`} (${pct} % des expéditions)` : `Retards fournisseur : ${s.idOr ? who : `${s.name} (à rapprocher)`} (${pct} % des expéditions)`,
      subject: s.idOr ?? s.name, subjectLabel: `${who}${legacy ? ` (${legacy})` : ""}`,
      decisionQuestion: asia ? `Comment protéger le flux Asie → Europe de ${who} face à la perturbation de la mer Rouge : contourner, changer de mode, renforcer le stock ?` : `Que faire face aux retards de ${who} ?`,
      options: asia ? optionsFor(ctx, "retard-asie") : optionsFor(ctx, "retard"),
      evidence: { source: t.bindings.shipments.source, statement: `${t.bindings.shipments.entity} GROUP BY ${t.bindings.shipments.fields.supplierName}`, asOf: ctx.asOf,
        values: { expeditions: s.shipments, en_retard: s.late, taux_pct: pct, ...(asia ? { pays_fournisseur: country, route: "Asie → Europe (mer Rouge ou cap de Bonne-Espérance si maritime, à confirmer dans le TMS)" } : {}) }, sample: [] },
    });
  }
  // Risque fournisseur : retards + articles en rupture qui dépendent de lui (lien produit → fournisseur).
  const exposure = new Map<string, number>();
  const supplierOf = new Map(state.masters.product.map(p => [p.idOr, p.supplierIdOr as string | null]));
  for (const [id] of byProduct) { const sup = supplierOf.get(id); if (sup) exposure.set(sup, (exposure.get(sup) ?? 0) + 1); }
  const statsById = new Map(Object.values(state.supplierStats).filter(s => s.idOr).map(s => [s.idOr!, s]));
  const risky = [...exposure.entries()].map(([id, k]) => { const st = statsById.get(id); return { id, k, rate: st && st.shipments ? st.late / st.shipments : 0 }; })
    .filter(x => x.k >= 2 || (x.k >= 1 && x.rate > 0.3)).sort((a, b) => b.k + b.rate * 10 - (a.k + a.rate * 10));
  if (risky[0]) {
    const r = risky[0];
    alerts.push({
      id: `INT-RISQUE-${r.id}`, kind: "risque-fournisseur", severity: r.rate > 0.3 ? "critique" : "majeure",
      label: `Risque fournisseur : ${sname(r.id)} — ${r.k} article${r.k > 1 ? "s" : ""} en rupture, ${Math.round(r.rate * 100)} % de retards`,
      subject: r.id, subjectLabel: sname(r.id), decisionQuestion: `Faut-il sécuriser l'approvisionnement auprès de ${sname(r.id)} ?`,
      options: optionsFor(ctx, "risque-fournisseur"),
      evidence: { source: `${t.masters.product} + ${t.bindings.shipments.source}`, statement: "articles en rupture × fournisseur du maître produit ; taux de retard", asOf: ctx.asOf, values: { articles_en_rupture: r.k, taux_retard_pct: Math.round(r.rate * 100) }, sample: [] },
    });
  }
  return alerts;
}

/** Drill-down à la demande : lu en direct (limite de lignes), sous budget, puis mis en cache (niveau 2). */
export async function drillDown(connector: Connector, spec: QuerySpec, objectClass: ObjectClass, limit = 200, cache: TieredCache = sharedTieredCache, watermark: string | null = null) {
  const s = { ...spec, limit: Math.min(spec.limit ?? limit, limit) };
  const key = cache.key(connector.id, s, watermark, 2);
  return cache.getOrLoad(key, objectClass, async () => (await connector.query(s)).rows, watermark, connector.id);
}

export { normRef, normSite };
