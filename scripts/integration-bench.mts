// Banc d'essai à l'échelle : 5 sources Maison Lucie en Parquet (npm run generate:scale
// dans maison-lucie-si), lues par DuckDB avec calculs poussés à la source.
// Usage : NODE_OPTIONS=--max-old-space-size=8192 npx tsx scripts/integration-bench.mts [dossier]
import { writeFileSync, existsSync, readFileSync, statSync } from "node:fs";
import { writeFileSync, existsSync, readFileSync, statSync, rmSync } from "node:fs";
import { createConnector } from "../src/lib/integration/connectors";
import { duckdbDriver } from "../src/lib/integration/connectors/drivers.server";
import { importQuestionnaire, maisonLucieExample, buildTemplate } from "../src/lib/integration/questionnaire";
import { discoverSetup } from "../src/lib/integration/runtime.server";
import { emptyState, runPipeline, drillDown } from "../src/lib/integration/pipeline";
import { TieredCache, MemoryLevel, FileLevel } from "../src/lib/integration/cache";
import { resetGovernors, allGovernorStats } from "../src/lib/integration/budget";
import { toCockpitAlerts } from "../src/lib/integration/cockpit";

const dir = process.argv[2] ?? "/tmp/maison-lucie-scale";
if (!existsSync(`${dir}/manifest.json`)) { console.error(`Jeu absent : lancer « npm run generate:scale » dans maison-lucie-si (${dir}).`); process.exit(1); }
const manifest = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8"));
rmSync("/tmp/aura-bench-l3", { recursive: true, force: true });
const delta = `${dir}/wms_stock_delta.parquet`;
{ // pas de delta pour le premier chargement
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const db = await DuckDBInstance.create(":memory:"); const con = await db.connect();
  await con.run(`COPY (SELECT * FROM '${dir}/wms_stock.parquet' LIMIT 0) TO '${delta}' (FORMAT parquet)`);
}


// Même questionnaire que l'exemple Maison Lucie, mais en « dépôt » de fichiers Parquet (réplique) :
// l'import, la lecture des métadonnées et le mapping sont ceux du Studio, sans code spécifique.
const FILES: Record<string, string> = { A_Supplier: "sap_suppliers.parquet", A_PurchaseOrderItem: "sap_purchase_orders.parquet", products: "pim_products.parquet", inventory: "wms_stock*.parquet", shipments: "tms_shipments.parquet", facilities: "wms_facilities.parquet", "order-lines": "oms_order_lines.parquet", sales: "lake_sales/*/*.parquet", forecasts: "aps_forecasts.parquet", suppliers: "srm_suppliers.parquet", nonconformities: "qms_nonconformities.parquet" };
const rowsQ = maisonLucieExample("https://exemple").map(r => {
  const key = r.acces.match(/resource=([\w-]+)/)?.[1] ?? r.acces.split("/").pop()!;
  return { ...r, mode: "fichier", acces: `${dir}/${FILES[key]}` };
});
const setup = importQuestionnaire(rowsQ);
const BENCH_BUDGET = { explicitRelax: true, maxRequestsPerMinute: 100_000, maxRowsPerCall: 250_000, maxCallsPerDay: 1_000_000, maxDaytimeScanRows: 1e12, offPeak: { startHour: 0, endHour: 24 }, maxConcurrent: 1 } as const;
setup.sources = setup.sources.map(s => ({ ...s, budget: BENCH_BUDGET }));
resetGovernors();
let t0 = performance.now();
const disc = await discoverSetup(setup, 200);
const discoveryMs = performance.now() - t0;
setup.proposals = disc.proposals.map(p => (p.status === "à valider" ? { ...p, status: "validée" as const } : p));
const { template: t, missing } = buildTemplate(setup);
if (missing.length) throw new Error(missing.join(", "));
const wms = t.sources.find(s => s.id === t.bindings.stock.source)!;
const mb = (n: number) => Math.round((n / 1048576) * 10) / 10;
const cache = new TieredCache(new MemoryLevel("L1", 60_000), new MemoryLevel("L2", 3600_000, 2 * 1024 ** 3), new FileLevel("/tmp/aura-bench-l3"));
const mk = () => Object.fromEntries(t.sources.map(s => [s.id, createConnector({ ...s, budget: BENCH_BUDGET }, { sqlDriver: () => duckdbDriver })]));

const mem0 = process.memoryUsage().rss;
t0 = performance.now();
let state = await runPipeline({ template: t, connectors: mk(), state: emptyState(t.id, "2026-09-28"), mode: "full", asOf: "2026-09-28", cache, acv: setup.acv, onLog: r => console.error(`[full] ${r.sourceId} ${r.step} ${r.durationMs} ms lu ${r.rowsRead} ${r.error ?? ""}`) });
const firstLoadMs = performance.now() - t0;
const firstRuns = state.runs.map(r => ({ source: r.sourceId, step: r.step, ms: r.durationMs, rowsRead: r.rowsRead, rowsStored: r.rowsStored, calls: r.calls, pushedDown: r.pushedDown, error: r.error }));

// Incrémental : 10 000 positions de stock modifiées (dont des ruptures qui s'ouvrent et se ferment).
{
  const { DuckDBInstance } = await import("@duckdb/node-api");
  const db = await DuckDBInstance.create(":memory:"); const con = await db.connect();
  await con.run(`COPY (SELECT ItemId, FacilityId, CASE WHEN row_number() OVER () % 2 = 0 THEN 0 ELSE 900 END AS OnHand, Allocated, SafetyStock, TIMESTAMP '2026-09-28 12:00:00' AS UpdatedTimestamp FROM '${dir}/wms_stock.parquet' USING SAMPLE 10000 ROWS (reservoir, 42)) TO '${delta}' (FORMAT parquet)`);
}
t0 = performance.now();
state = await runPipeline({ template: t, connectors: mk(), state, mode: "incremental", asOf: "2026-09-28", cache, acv: setup.acv, onLog: r => console.error(`[incr] ${r.sourceId} ${r.step} ${r.durationMs} ms lu ${r.rowsRead} ${r.error ?? ""}`) });
const incrementalMs = performance.now() - t0;
const incRuns = state.runs.filter(r => r.mode === "incremental").map(r => ({ source: r.sourceId, step: r.step, ms: r.durationMs, rowsRead: r.rowsRead, calls: r.calls, error: r.error }));

// Volume stocké : état léger (JSON) + référentiel produits et crosswalk en Parquet (colonnaire).
const light = { ...state, masters: { ...state.masters, product: [] }, crosswalk: [] };
const lightJson = JSON.stringify(light);
const { DuckDBInstance } = await import("@duckdb/node-api");
const db = await DuckDBInstance.create(":memory:"); const con = await db.connect();
writeFileSync("/tmp/aura-bench-products.ndjson", state.masters.product.map(p => JSON.stringify(p)).join("\n"));
await con.run(`COPY (SELECT * FROM read_json_auto('/tmp/aura-bench-products.ndjson')) TO '/tmp/aura-bench-products.parquet' (FORMAT parquet, COMPRESSION zstd)`);
const cwFile = "/tmp/aura-bench-crosswalk.ndjson";
writeFileSync(cwFile, "");
const chunk = 200_000;
for (let i = 0; i < state.crosswalk.length; i += chunk) writeFileSync(cwFile, state.crosswalk.slice(i, i + chunk).map(e => JSON.stringify({ d: e.domain, s: e.system, k: e.sourceKey, id: e.idOr, m: e.method })).join("\n") + "\n", { flag: "a" });
await con.run(`COPY (SELECT * FROM read_json_auto('${cwFile}')) TO '/tmp/aura-bench-crosswalk.parquet' (FORMAT parquet, COMPRESSION zstd)`);
const stored = { etatLegerJsonMo: mb(lightJson.length), referentielProduitsParquetMo: mb(statSync("/tmp/aura-bench-products.parquet").size), crosswalkParquetMo: mb(statSync("/tmp/aura-bench-crosswalk.parquet").size), crosswalkLignes: state.crosswalk.length, alertes: state.alerts.length, positionsEnRupture: Object.keys(state.stockouts).length };

// Affichage cockpit : lecture de l'instantané cockpit (alertes + séries + santé) et conversion.
const cockpitSnapshot = JSON.stringify({ alerts: state.alerts, series: state.series, runs: state.runs.slice(0, 50) });
t0 = performance.now();
const cockpit = toCockpitAlerts(JSON.parse(cockpitSnapshot).alerts);
const cockpitMs = performance.now() - t0;

// Drill-down : positions d'un article en rupture, à froid (source) puis à chaud (cache niveau 2).
const wmsConn = createConnector({ ...wms, budget: BENCH_BUDGET }, { sqlDriver: () => duckdbDriver });
const anyOut = Object.values(state.stockouts)[0];
t0 = performance.now();
const itemCol = t.bindings.stock.fields.item;
const cold = await drillDown(wmsConn, { entity: t.bindings.stock.entity, filters: [{ field: itemCol, op: "eq", value: anyOut.item }] }, "stock", 200, cache);
const drillColdMs = performance.now() - t0;
t0 = performance.now();
const warm = await drillDown(wmsConn, { entity: t.bindings.stock.entity, filters: [{ field: itemCol, op: "eq", value: anyOut.item }] }, "stock", 200, cache);
const drillWarmMs = performance.now() - t0;
await wmsConn.close();

const result = {
  machine: "4 vCPU, 15 Go RAM", jeu: manifest.counts, veriteTerrain: manifest.groundTruth,
  decouverteS: Math.round(discoveryMs / 100) / 10, correspondancesValideesOffice: disc.proposals.filter(p => p.status === "validée").length, correspondancesAValider: disc.proposals.filter(p => p.status === "à valider").length,
  premierChargementS: Math.round(firstLoadMs / 100) / 10, incrementalS: Math.round(incrementalMs / 100) / 10,
  etapesPremierChargement: firstRuns, etapesIncremental: incRuns,
  stockage: stored,
  rapprochement: state.reports.map(r => ({ systeme: r.system, domaine: r.domain, total: r.total, pct: r.pct, orphelins: r.orphans.length, doublons: r.duplicates.length, conflits: r.conflicts.length, enAttente: r.pendingReview })),
  fileValidation: state.review.length,
  alertes: state.alerts.map(a => a.label), ecarts: state.divergenceCount,
  cockpit: { alertes: cockpit.length, instantaneKo: Math.round(cockpitSnapshot.length / 1024), affichageMs: Math.round(cockpitMs * 100) / 100 },
  drillDown: { froidMs: Math.round(drillColdMs), chaudMs: Math.round(drillWarmMs * 100) / 100, lignes: cold.value.length, depuisCache: warm.fromCache },
  appels: allGovernorStats().map(g => ({ source: g.sourceId, appels: g.callsToday, lignes: g.rowsToday })),
  memoireMaxMo: mb(Math.max(process.memoryUsage().rss, mem0)),
};
const out = process.env.BENCH_OUT ?? "/tmp/aura-integration-bench.json";
writeFileSync(out, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
