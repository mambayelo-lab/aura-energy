// @vitest-environment node
// Bout en bout : Aura Supply branché sur Maison Lucie par chaque type d'échange,
// et par MCP. Pour chacune des 21 ressources des 9 applications, les lignes lues
// par chaque connecteur du SDK sont identiques à la lecture REST de référence ;
// les documents EDI et IDoc redonnent les champs des tables d'origine.
// Lancé seulement si LUCIE_BASE est défini (budget Vercel : jamais en CI par défaut) :
//   LUCIE_BASE=http://127.0.0.1:4300 npx vitest run src/lib/integration/__tests__/lucie-channels.e2e.test.ts
//   (côté Maison Lucie : npm run serve:vercel), ou LUCIE_BASE=https://maison-lucie-si.vercel.app.
import { describe, expect, it } from "vitest";
import { SourceGovernor } from "../budget";
import { createConnector } from "../connectors";
import { duckdbDriver } from "../connectors/drivers.server";
import { McpConnector } from "../connectors/mcp";
import { ATTRIBUTE_SPECS, profileColumns, proposeMappings } from "../discovery";
import type { ConnectorKind, Row, SourceConfig } from "../types";

const B = process.env.LUCIE_BASE?.replace(/\/$/, "");
const TOKEN = process.env.LUCIE_GATEWAY_TOKEN ?? "lucie_aura_gateway_demo_token";
const remote = !!B && !/127\.0\.0\.1|localhost/.test(B);
// Ressources lues dans l'index public des canaux de Maison Lucie (toutes les applications, RH comprise),
// avec les canaux que chaque application expose réellement (protocoles réalistes par type d'outil).
type Res = [string, string, string];
const INDEX = B ? ((await fetch(`${B}/channels`).then(r => r.json()).catch(() => ({ sources: [] }))) as { sources: { id: string; channels: string[]; resources: { resource: string; entitySet: string }[] }[] }) : { sources: [] };
const RES: Res[] = INDEX.sources.flatMap(s => s.resources.map(r => [s.id, r.resource, r.entitySet] as Res));
const CHANNELS = new Map(INDEX.sources.map(s => [s.id, new Set(s.channels)]));
// À distance (Vercel), un échantillon de ressources suffit : plafond de requêtes et budget.
const SUBSET = remote ? RES.filter(([s, r]) => ["sap/A_Supplier", "pim/products", "manhattan/facilities", "tms/shipments", "aps/forecasts", "srm/suppliers", "qms/nonconformities", "oms/order-lines", "hr/emp-job", "lake/purchases"].includes(`${s}/${r}`)) : RES;
const Pascal = (s: string) => s[0].toUpperCase() + s.slice(1);

let n = 0;
const gov = () => new SourceGovernor(`e2e-${n++}`, { explicitRelax: true, maxRequestsPerMinute: remote ? 50 : 100_000, maxConcurrent: 1, maxRowsPerCall: 1000, maxDaytimeScanRows: 1e9, offPeak: { startHour: 0, endHour: 24 }, callTimeoutMs: 30_000 });
function conn(kind: ConnectorKind, params: Record<string, unknown>) {
  const cfg: SourceConfig = { id: `lucie-${kind}-${n}`, label: `Maison Lucie · ${kind}`, kind, params: { baseUrl: B, bearer: "{{env:LUCIE_GATEWAY_TOKEN}}", ...params } };
  return createConnector(cfg, { governor: gov(), env: { LUCIE_GATEWAY_TOKEN: TOKEN }, sqlDriver: () => duckdbDriver });
}
async function readAll(kind: ConnectorKind, params: Record<string, unknown>, entity: string) {
  const c = conn(kind, params);
  if (!c) throw new Error(`connecteur ${kind} non créé`);
  try { return (await c.query({ entity })).rows; } finally { await c.close(); }
}
const sortRows = (rows: Row[]) => rows.map(r => JSON.stringify(r)).sort();
const reference = new Map<string, Row[]>();
async function rest(source: string, resource: string): Promise<Row[]> {
  const k = `${source}/${resource}`;
  if (!reference.has(k)) {
    const rows = source === "sap"
      ? await readAll("odata", { entities: { [resource]: { entitySet: resource, servicePath: resource === "A_Supplier" ? "/sap/opu/odata/sap/API_BUSINESS_PARTNER" : "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV", key: "Supplier", fields: [], objectClass: "master" } } }, resource)
      : source === "manhattan" ? await readAll("manhattan", { entities: { [resource]: { path: `/api/sources/manhattan?resource=${resource}` } } }, resource)
      : await readAll("rest", { entities: { [resource]: { path: `/api/sources/${source}?resource=${resource}` } } }, resource);
    reference.set(k, rows.map(({ __metadata, ...r }: Row & { __metadata?: unknown }) => r));
  }
  return reference.get(k)!;
}

describe.skipIf(!B)("Supply branché sur Maison Lucie : chaque type d'échange, et MCP", () => {
  it.each(SUBSET)("%s/%s : chaque canal autorisé = REST, les autres refusés", async (source, resource, set) => {
    const ref = await rest(source, resource);
    expect(ref.length).toBeGreaterThan(0);
    const ok = CHANNELS.get(source)!;
    const same = (rows: Row[], via: string) => expect(rows, via).toEqual(ref);
    // Canal autorisé : mêmes lignes ; canal non autorisé : le connecteur échoue (404 CHANNEL_NOT_OFFERED).
    const check = async (ch: string, read: () => Promise<Row[]>, via: string, cmp: (rows: Row[]) => void = rows => expect(rows, via).toEqual(ref)) => {
      if (ok.has(ch)) cmp(await read()); else await expect(read(), `${via} devrait être refusé`).rejects.toThrow();
    };
    await check("odata4", () => readAll("odata4", { entities: { [set]: { url: `${B}/odata/v4/${source}/${set}` } } }, set), "odata4");
    if (ok.has("graphql")) { const c = conn("graphql", { url: `${B}/api/graphql`, roots: [`src${Pascal(source)}`] }); const names = (await c.discoverSchema()).filter(e => e.columns.map(x => x.name).join() === Object.keys(ref[0]).join()); expect((await c.query({ entity: names[0].name })).rows, "graphql").toEqual(ref); await c.close(); }
    if (ok.has("soap")) { const c = conn("soap", { serviceUrl: `${B}/api/soap?source=${source}` }); const e = (await c.discoverSchema()).find(x => x.columns.map(y => y.name).join() === Object.keys(ref[0]).join())!; expect((await c.query({ entity: e.name })).rows, "soap").toEqual(ref); await c.close(); }
    else { const c = conn("soap", { serviceUrl: `${B}/api/soap?source=${source}` }); await expect(c.discoverSchema(), "soap refusé").rejects.toThrow(); await c.close(); }
    await check("sf", () => readAll("salesforce", { objects: [`Lucie_${Pascal(source)}_${set}__c`] }, `Lucie_${Pascal(source)}_${set}__c`), "salesforce");
    await check("kafka", async () => (await readAll("kafka", { entities: { [`lucie.${source}.${resource}`]: { path: "/api/kafka" } } }, `lucie.${source}.${resource}`)).map(({ _offset, _key, ...r }) => r), "kafka");
    await check("amqp", () => readAll("amqp", { entities: { q: { url: `${B}/api/queues/%2F/lucie.${source}.${resource}` } } }, "q"), "amqp");
    await check("ce", () => readAll("cloudevents", { entities: { e: { url: `${B}/cloudevents/${source}/${resource}` } } }, "e"), "cloudevents");
    await check("cdc", () => readAll("cdc", { entities: { e: { url: `${B}/cdc/${source}/${resource}` } } }, "e"), "cdc", rows => expect(sortRows(rows), "cdc").toEqual(sortRows(ref)));
    await check("sftp", () => readAll("sftp", { entities: { f: { url: `${B}/sftp/get?path=/outbound/${source}/${resource}.json` } } }, "f"), "sftp json");
    if (ok.has("sftp")) {
      same(await readAll("sftp", { entities: { f: { url: `${B}/sftp/get?path=/outbound/${source}/${resource}.xml` } } }, "f"), "sftp xml");
      same(await readAll("sftp", { entities: { f: { url: `${B}/sftp/get?path=/outbound/${source}/${resource}.parquet` } } }, "f"), "sftp parquet");
      const csv = await readAll("sftp", { entities: { f: { url: `${B}/sftp/get?path=/outbound/${source}/${resource}.csv` } } }, "f");
      expect(csv, "sftp csv (texte)").toEqual(ref.map(r => Object.fromEntries(Object.entries(r).map(([k, x]) => [k, x === null ? "" : String(x)]))));
    }
    await check("grpc", () => readAll("grpcweb", { entities: { g: { url: `${B}/grpc/lucie.v1.RowService/ListRows#${source}/${resource}` } } }, "g"), "grpc-web");
    same(await readAll("esb", { entities: { f: { url: `${B}/esb/api/v1/route?to=${source}&resource=${resource}` } } }, "f"), "esb");
    same(await readAll("mcp", { serverUrl: `${B}/mcp` }, `${source}/${resource}`), "mcp");
    // MQ : un message par appel, réservé au fil de l'eau : les 20 premiers.
    await check("mq", () => readAll("mq", { maxMessages: 20, entities: { q: { url: `${B}/ibmmq/rest/v2/messaging/qmgr/LUCIEQM/queue/LUCIE.${source.toUpperCase()}.${resource.toUpperCase()}/message` } } }, "q"), "mq", rows => expect(rows, "mq").toEqual(ref.slice(0, 20)));
    if (source === "lake") {
      same(await readAll("sqlhttp", {}, `lake.${resource.replace(/-/g, "_")}`), "sql");
    }
  }, 180_000);

  it("SQL / JDBC : GROUP BY poussé au lac = agrégat calculé sur la lecture REST", async () => {
    const c = conn("sqlhttp", {});
    const r = await c.query({ entity: "lake.sales", groupBy: ["StoreCode"], metrics: [{ fn: "count", as: "n" }, { fn: "sum", field: "Quantity", as: "q" }] });
    expect(r.pushedDown.aggregate).toBe(true);
    const ref = await rest("lake", "sales");
    expect(Object.fromEntries(r.rows.map(x => [x.StoreCode, [x.n, x.q]]))).toEqual(ref.reduce<Record<string, number[]>>((m, x) => { const k = String(x.StoreCode); m[k] = [(m[k]?.[0] ?? 0) + 1, (m[k]?.[1] ?? 0) + Number(x.Quantity)]; return m; }, {}));
    await c.close();
  }, 60_000);

  it("SAP : RFC_READ_TABLE et IDoc (ORDERS05, CREMAS05) redonnent les tables ; DESADV01 et MATMAS05 refusés", async () => {
    const sup = await rest("sap", "A_Supplier"), po = await rest("sap", "A_PurchaseOrderItem"), shp = await rest("tms", "shipments"), pim = await rest("pim", "products");
    expect(await readAll("rfc", { entities: { LFA1: { url: `${B}/sap/bc/rfc#LFA1` } } }, "LFA1")).toEqual(sup);
    expect(await readAll("rfc", { entities: { EKPO: { url: `${B}/sap/bc/rfc#EKPO` } } }, "EKPO")).toEqual(po);
    const orders = await readAll("idoc", { documents: ["ORDERS05"] }, "ORDERS05");
    expect(orders.map(o => [o.documentNumber, o.supplier, o.itemId, o.quantity, o.requestedDeliveryDate])).toEqual(po.map(p => [p.PurchaseOrder, p.Supplier, p.Material, p.OrderQuantity, p.ScheduleLineDeliveryDate]));
    const cremas = await readAll("idoc", { documents: ["CREMAS05"] }, "CREMAS05");
    expect(cremas.map(v => [v.supplier, v.name, v.country, v.taxNumber1, v.vatRegistration, v.duns, v.legacyId])).toEqual(sup.map(s => [s.Supplier, s.SupplierName, s.Country, s.TaxNumber1, s.VATRegistration, s.DUNS, s.LegacySupplierId]));
    // DESADV01 viendrait du TMS et MATMAS05 du PIM : ces outils n'exposent pas d'IDoc (refus clair).
    expect(shp.length && pim.length).toBeTruthy();
    await expect(readAll("idoc", { documents: ["DESADV01"] }, "DESADV01")).rejects.toThrow();
    await expect(readAll("idoc", { documents: ["MATMAS05"] }, "MATMAS05")).rejects.toThrow();
  }, 180_000);

  it("EDIFACT, X12 et AS2 (MIC vérifié) redonnent commandes, avis d'expédition et factures", async () => {
    const po = await rest("sap", "A_PurchaseOrderItem"), shp = await rest("tms", "shipments");
    const ordersKey = (r: Row) => [r.documentNumber, r.supplier, r.itemId, r.quantity, r.requestedDeliveryDate];
    const poKey = (p: Row) => [p.PurchaseOrder, p.Supplier, p.Material, p.OrderQuantity, p.ScheduleLineDeliveryDate];
    const asnKey = (r: Row) => [r.documentNumber, r.orderReference, r.itemId, r.quantity, r.transportMode, r.carrier, r.supplierName, r.expectedDate, r.actualDate];
    const shpKey = (s: Row) => [s.ShipmentId, s.PurchaseOrderRef, s.ItemId, s.Quantity, s.TransportMode, s.Carrier, s.OriginName, s.ExpectedDate, s.ActualDate];
    expect((await readAll("edifact", { documents: ["ORDERS"] }, "ORDERS")).map(ordersKey)).toEqual(po.map(poKey));
    expect((await readAll("x12", { documents: ["850"] }, "850")).map(ordersKey)).toEqual(po.map(poKey));
    expect((await readAll("edifact", { documents: ["DESADV"] }, "DESADV")).map(asnKey)).toEqual(shp.map(shpKey));
    expect((await readAll("x12", { documents: ["856"] }, "856")).map(asnKey)).toEqual(shp.map(shpKey));
    const inv = await readAll("edifact", { documents: ["INVOIC"] }, "INVOIC"), inv810 = await readAll("x12", { documents: ["810"] }, "810");
    expect(inv.map(i => [i.orderReference, i.quantity, i.totalAmount])).toEqual(inv810.map(i => [i.orderReference, i.quantity, i.totalAmount]));
    expect(inv.every(i => po.some(p => p.PurchaseOrder === i.orderReference && p.OrderQuantity === i.quantity))).toBe(true);
    expect((await readAll("as2", {}, "edifact-desadv")).map(asnKey)).toEqual(shp.map(shpKey));
    expect((await readAll("as2", {}, "x12-850")).map(ordersKey)).toEqual(po.map(poKey));
  }, 180_000);

  it("Salesforce Bulk API 2.0 (jeton OAuth client credentials) = REST", async () => {
    const ref = await rest("oms", "order-lines");
    expect(await readAll("salesforce", { bearer: undefined, clientId: "aura", clientSecret: TOKEN, bulk: true, objects: ["Lucie_Oms_OrderLines__c"] }, "Lucie_Oms_OrderLines__c")).toEqual(ref);
  }, 120_000);

  it("MCP générique : découverte des outils et ressources, métadonnées typées, indicateurs et alertes", async () => {
    const c = conn("mcp", { serverUrl: `${B}/mcp` }) as McpConnector & { close(): Promise<void> };
    const d = await c.describe();
    expect(d.serverInfo.name).toBe("maison-lucie-si");
    expect(d.tools.map(t => t.name)).toEqual(expect.arrayContaining(["list_sources", "read_object", "query", "kpi_series", "alerts"]));
    expect(d.resources.map(r => r.uri)).toEqual(expect.arrayContaining(["lucie://catalog", "lucie://ontology", "lucie://schema/sap"]));
    const schema = await c.discoverSchema();
    expect(schema).toHaveLength(RES.length);
    expect(schema.find(e => e.name === "sap/A_Supplier")).toMatchObject({ key: "Supplier", watermark: "LastChangeDateTime" });
    const kpi: any = await c.callTool("kpi_series", { kpi: "sales-by-month" });
    const ref = await rest("lake", "sales");
    expect(Math.round(kpi.series.reduce((s: number, p: { value: number }) => s + p.value, 0))).toBe(Math.round(ref.reduce((s, r) => s + Number(r.NetAmount), 0)));
    const alerts: any = await c.callTool("alerts");
    expect(alerts.alerts.map((a: { id: string }) => a.id)).toEqual(["SI-RUPTURE", "SI-RETARD", "SI-CERTIFICATION", "SI-RISQUE"]);
    const filtered = await c.query({ entity: "srm/suppliers", filters: [{ field: "RiskScore", op: "ge", value: 80 }] });
    expect(filtered.rows).toEqual((await rest("srm", "suppliers")).filter(r => Number(r.RiskScore) >= 80));
    await c.close();
  }, 120_000);

  it("Mapping avec score : mêmes propositions par REST, fichier SFTP, ESB et MCP", async () => {
    const attrs = ATTRIBUTE_SPECS.filter(a => a.id.startsWith("products."));
    const propose = (rows: Row[]) => proposeMappings(attrs, profileColumns(rows.slice(0, 50)), { sourceId: "pim", entity: "products" }).map(p => [p.attributeId, p.column, p.score, p.status]);
    const ref = propose(await rest("pim", "products"));
    expect(ref.find(p => p[0] === "products.ean")?.[1]).toBe("ean");
    for (const [kind, params, entity] of [
      ["sftp", { entities: { f: { url: `${B}/sftp/get?path=/outbound/pim/products.json` } } }, "f"],
      ["esb", { entities: { f: { url: `${B}/esb/api/v1/products` } } }, "f"],
      ["mcp", { serverUrl: `${B}/mcp` }, "pim/products"],
    ] as [ConnectorKind, Record<string, unknown>, string][]) {
      const c = conn(kind, params);
      expect(propose(await c.sample(entity, 50)), kind).toEqual(ref);
      await c.close();
    }
  }, 60_000);
});
