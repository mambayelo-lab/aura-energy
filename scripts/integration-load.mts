// Test de charge en mode API directe sur le jeu « scale » généré à la volée par Maison Lucie
// (1 000 000 articles, pagination seule) : débit réel sous budget, plafonds jamais dépassés.
// Usage : npx tsx scripts/integration-load.mts [URL Maison Lucie]   (défaut : shim local 127.0.0.1:3300)
import { RestConnector } from "../src/lib/integration/connectors/rest";
import { SourceGovernor } from "../src/lib/integration/budget";

const base = process.argv[2] ?? "http://127.0.0.1:3300";
const rpm = Number(process.env.RPM ?? 600);
const gov = new SourceGovernor("pim-scale", { explicitRelax: true, maxRequestsPerMinute: rpm, maxRowsPerCall: 5000, maxConcurrent: 1, maxDaytimeScanRows: 1e12, offPeak: { startHour: 0, endHour: 24 }, maxCallsPerDay: 100_000 });
const c = new RestConnector({ id: "pim-scale", label: "PIM (échelle)", kind: "rest", params: { baseUrl: base, bearer: "{{env:LUCIE_GATEWAY_TOKEN}}", entities: { products: { path: "/api/sources/pim?resource=products&size=scale" } } } }, { governor: gov, env: { LUCIE_GATEWAY_TOKEN: process.env.LUCIE_GATEWAY_TOKEN ?? "lucie_aura_gateway_demo_token" } });
const t0 = performance.now();
let rows = 0;
const limit = Number(process.env.ROWS ?? 1_000_000);
for await (const b of c.readIncremental("products", "updatedAt", null)) { rows += b.rows.length; if (rows >= limit) break; }
const s = (performance.now() - t0) / 1000;
// 50 utilisateurs demandent le même échantillon au même moment : un seul appel part.
const before = gov.stats().callsToday;
await Promise.all(Array.from({ length: 50 }, () => c.sample("products", 20)));
const st = gov.stats();
const out = { lignes: rows, secondes: Math.round(s * 10) / 10, lignesParSeconde: Math.round(rows / s), appels: st.callsToday, plafondParMinute: rpm, picParFenetre: st.peakPerWindow, picSimultane: st.peakConcurrent, appelsPour50Utilisateurs: st.callsToday - before, fusionnes: st.coalesced, latenceReferenceMs: st.baselineMs, regime: st.mode };
console.log(JSON.stringify(out, null, 1));
if (st.peakPerWindow > rpm || st.peakConcurrent > 1) process.exit(1);
