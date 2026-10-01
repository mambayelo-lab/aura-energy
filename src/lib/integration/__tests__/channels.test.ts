// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { SourceGovernor } from "../budget";
import { AmqpConnector, CdcConnector, coerce, compileHttpSql, EdifactConnector, grpcWebRequest, grpcWebResponse, OData4Connector, odata4Filter, parseCsv, pbDecode, SqlHttpConnector, xmlRecords, As2Connector, CHANNEL_MAX_PAGE } from "../connectors/channels";
import { as2Mic, edifactRows, idocRows, parseEdifact, x12Rows } from "../connectors/edi";
import { firstRows, McpConnector, toolPayload } from "../connectors/mcp";
import { createConnector } from "../connectors";
import { importQuestionnaire, maisonLucieExample, maisonLucieChannelsExample, maisonLucieMcpExample } from "../questionnaire";
import { KIND_LABELS } from "../types";

const fx = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const gov = (id: string, rows = 1000) => new SourceGovernor(id, { explicitRelax: true, maxRequestsPerMinute: 100_000, maxRowsPerCall: rows, maxDaytimeScanRows: 1e9, offPeak: { startHour: 0, endHour: 24 } });
const json = (x: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(x), { headers: { "content-type": "application/json", ...headers } });

describe("Connecteurs canal : analyseurs", () => {
  it("EDIFACT D.96A : ORDERS, DESADV, INVOIC (comptes UNT/UNZ contrôlés, libération ?)", () => {
    const o = edifactRows(fx("lucie-edifact-orders.edi").toString());
    expect(o.type).toBe("ORDERS");
    expect(o.rows[0]).toMatchObject({ documentNumber: "4500000001", supplier: "0000100001", itemId: "CLASP-AURORA", quantity: 5018, requestedDeliveryDate: "2026-10-17", currency: "EUR" });
    const d = edifactRows(fx("lucie-edifact-desadv.edi").toString());
    expect(d.rows[0]).toMatchObject({ documentNumber: "SHP-00000001", orderReference: "PO-4500000001", supplierName: "Tessitura Milano", transportMode: "AERIEN", carrier: "EuroRail Cargo", itemId: "03760000000024", quantity: 5018, expectedDate: "2026-10-17", actualDate: null });
    const i = edifactRows(fx("lucie-edifact-invoic.edi").toString());
    expect(i.rows[0].lineAmount).toBe(i.rows[0].totalAmount);
    expect(Math.abs(Number(i.rows[0].unitPrice) * Number(i.rows[0].quantity) - Number(i.rows[0].lineAmount))).toBeLessThan(0.01);
    expect(parseEdifact("UNA:+.? 'NAD+SU+++Fils d?'Or?+Co'")[0][4]).toEqual(["Fils d'Or+Co"]);
    expect(() => edifactRows("UNH+1+ORDERS:D:96A:UN'BGM+220+1+9'UNT+9+1'")).toThrow(/UNT/);
  });
  it("X12 004010 : 850, 856, 810 (ISA 106, SE/GE contrôlés)", () => {
    expect(x12Rows(fx("lucie-x12-850.edi").toString()).rows[0]).toMatchObject({ documentNumber: "4500000001", quantity: 5018, itemId: "CLASP-AURORA", supplier: "0000100001", requestedDeliveryDate: "2026-10-17" });
    expect(x12Rows(fx("lucie-x12-856.edi").toString()).rows[1]).toMatchObject({ documentNumber: "SHP-00000002", transportMode: "ROUTE", orderReference: "PO-4500000002" });
    const inv = x12Rows(fx("lucie-x12-810.edi").toString()).rows[0];
    expect(Math.round(Number(inv.unitPrice) * Number(inv.quantity) * 100) / 100).toBe(inv.totalAmount);
    expect(() => x12Rows("ST*850*1~")).toThrow(/ISA/);
  });
  it("IDoc XML : ORDERS05, DESADV01, CREMAS05, MATMAS05", () => {
    expect(idocRows(fx("lucie-idoc-ORDERS05.xml").toString()).rows[0]).toMatchObject({ idocNumber: "0000000000000001", documentNumber: "4500000001", supplier: "0000100001", itemId: "CLASP-AURORA", quantity: 5018 });
    expect(idocRows(fx("lucie-idoc-DESADV01.xml").toString()).rows[0]).toMatchObject({ documentNumber: "SHP-00000001", carrier: "EuroRail Cargo", shipTo: "WHLIL", orderReference: "PO-4500000001" });
    expect(idocRows(fx("lucie-idoc-CREMAS05.xml").toString()).rows[0]).toMatchObject({ supplier: "0000100001", name: "Tessitura Milano", legacyId: "SUP-001" });
    expect(idocRows(fx("lucie-idoc-MATMAS05.xml").toString()).rows[0]).toMatchObject({ material: "PIM-0000001", ean: "3760000000017" });
  });
  it("gRPC-web : requête protobuf, réponse décodée et typée", () => {
    const req = grpcWebRequest("qms", "nonconformities", 3, "");
    expect(pbDecode(req.subarray(5)).map(f => f.no)).toEqual([1, 2, 3]);
    const r = grpcWebResponse(new Uint8Array(fx("lucie-grpc-qms.bin")));
    expect(r.rows).toHaveLength(3);
    expect(r.rows[0]).toMatchObject({ NcId: "NC-0000001", ReturnedQty: 34 });
    expect(r.next).toBe("3");
    expect(r.columns.find(c => c.name === "ReturnedQty")?.type).toBe("integer");
  });
  it("XML typé, CSV, coercition, filtres OData v4 et SQL compilé", () => {
    expect(xmlRecords(`<r><T><a xsi:type="xsd:long">3</a><b xsi:nil="true"/><c xsi:type="xsd:boolean">false</c><d xsi:type="xsd:string">0012</d></T></r>`, "T")).toEqual([{ a: 3, b: null, c: false, d: "0012" }]);
    expect(parseCsv('a,b\n"x,1","he said ""hi"""\n')).toEqual([{ a: "x,1", b: 'he said "hi"' }]);
    expect(coerce("0012", "string")).toBe("0012");
    expect(coerce("12.5", "Edm.Decimal")).toBe(12.5);
    expect(odata4Filter([{ field: "Country", op: "eq", value: "IT" }, { field: "Qty", op: "ge", value: 5 }, { field: "x", op: "in", value: ["a"] }])).toBe("Country eq 'IT' and Qty ge 5");
    expect(compileHttpSql("lake.sales", { entity: "s", filters: [{ field: "StoreCode", op: "eq", value: "o'k" }], groupBy: ["Ean"], metrics: [{ fn: "sum", field: "Quantity", as: "q" }] }, 0, 1000)).toBe("SELECT Ean, SUM(Quantity) AS q FROM lake.sales WHERE StoreCode = 'o''k' GROUP BY Ean LIMIT 1000 OFFSET 0");
    expect(() => compileHttpSql("x; drop", { entity: "x" })).toThrow();
  });
  it("CDC : le rejeu (r, c, u, d) redonne l'état courant, doublons de clé compris", () => {
    const a = { id: 1, v: "a" }, a2 = { id: 1, v: "b" }, dup = { id: 1, v: "a" };
    expect(CdcConnector.replay([{ op: "r", before: null, after: a }, { op: "r", before: null, after: dup }, { op: "c", before: null, after: { id: 2 } }, { op: "u", before: dup, after: a2 }, { op: "d", before: { id: 2 }, after: null }])).toEqual([a, a2]);
    expect(() => CdcConnector.replay([{ op: "u", before: { id: 9 }, after: { id: 9 } }])).toThrow();
  });
  it("AS2 : MIC SHA-256 vérifié, message altéré refusé", async () => {
    const body = fx("lucie-edifact-orders.edi").toString();
    const mic = await as2Mic(body);
    const mk = (m: string) => new As2Connector({ id: "as2", label: "AS2", kind: "as2", params: { baseUrl: "https://p.example", entities: { o: { url: "https://p.example/as2/message/edifact-orders" } } } }, { governor: gov("as2"), fetch: async () => new Response(body, { headers: { "AS2-From": "MAISONLUCIE", "X-Lucie-Content-MIC": m } }) });
    expect((await mk(mic).sample("o", 5))[0].documentNumber).toBe("4500000001");
    await expect(mk("AAAA, sha-256").sample("o", 1)).rejects.toThrow(/MIC/);
  });
});

describe("Connecteurs canal : pagination sous budget", () => {
  it("OData v4 : $top plafonné par le budget, @odata.nextLink suivi, filtre poussé", async () => {
    const rows = Array.from({ length: 25 }, (_, i) => ({ Id: i, Country: i % 2 ? "FR" : "IT" }));
    const seen: string[] = [];
    const c = new OData4Connector({ id: "o4", label: "o4", kind: "odata4", params: { baseUrl: "https://s", entities: { Products: { url: "https://s/odata/v4/pim/Products" } } } }, { governor: gov("o4", 10), fetch: async (url: string) => {
      seen.push(url); const u = new URL(url), top = Number(u.searchParams.get("$top")), skip = Number(u.searchParams.get("$skip"));
      const f = u.searchParams.get("$filter"), r = f ? rows.filter(x => x.Country === /'(\w+)'/.exec(f)![1]) : rows;
      return json({ value: r.slice(skip, skip + top), ...(skip + top < r.length ? { "@odata.nextLink": "x" } : {}) });
    } });
    const all = await c.query({ entity: "Products" });
    expect(all.rows).toHaveLength(25);
    expect(seen.every(u => new URL(u).searchParams.get("$top") === "10")).toBe(true);
    const fr = await c.query({ entity: "Products", filters: [{ field: "Country", op: "eq", value: "FR" }] });
    expect(fr.rows).toHaveLength(12);
    expect(fr.pushedDown.filter).toBe(true);
    expect(CHANNEL_MAX_PAGE).toBe(1000);
  });
  it("AMQP : lecture positionnelle ; file sans position lue une seule fois", async () => {
    const msg = (i: number, left: number, pos = true) => ({ payload: JSON.stringify({ i }), message_count: left, properties: { headers: pos ? { "x-offset": i } : {} } });
    const mk = (pos: boolean) => new AmqpConnector({ id: "q" + pos, label: "q", kind: "amqp", params: { baseUrl: "https://r", entities: { q: { url: "https://r/api/queues/%2F/q" } } } }, { governor: gov("q" + pos, 2), fetch: async (_u: string, init?: RequestInit) => {
      const off = JSON.parse(String(init?.body)).offset; return json([msg(off, 4 - off, pos), msg(off + 1, 3 - off, pos)].filter(m => JSON.parse(m.payload).i < 5));
    } });
    expect((await mk(true).query({ entity: "q" })).rows.map(r => r.i)).toEqual([0, 1, 2, 3, 4]);
    expect((await mk(false).query({ entity: "q" })).rows.map(r => r.i)).toEqual([0, 1]);
  });
  it("SQL sur HTTP : GROUP BY poussé à la source", async () => {
    const bodies: string[] = [];
    const c = new SqlHttpConnector({ id: "lake", label: "lake", kind: "sqlhttp", params: { baseUrl: "https://l", entities: { sales: { url: "https://l/sql#lake.sales" } } } }, { governor: gov("lake"), fetch: async (_u: string, init?: RequestInit) => { bodies.push(JSON.parse(String(init?.body)).sql); return json({ rows: [{ StoreCode: "a", n: 2 }], nextOffset: null }); } });
    const r = await c.query({ entity: "sales", groupBy: ["StoreCode"], metrics: [{ fn: "count", as: "n" }] });
    expect(r.pushedDown).toEqual({ filter: true, aggregate: true });
    expect(bodies[0]).toBe("SELECT StoreCode, COUNT(*) AS n FROM lake.sales GROUP BY StoreCode LIMIT 1000 OFFSET 0");
  });
  it("EDIFACT : pagination par X-Next-Offset", async () => {
    const body = fx("lucie-edifact-orders.edi").toString();
    const c = new EdifactConnector({ id: "e", label: "e", kind: "edifact", params: { baseUrl: "https://e", documents: ["ORDERS"] } }, { governor: gov("e"), fetch: async (url: string) => new Response(body, { headers: new URL(url).searchParams.get("offset") === "0" ? { "X-Next-Offset": "3" } : {} }) });
    expect((await c.query({ entity: "ORDERS" })).rows).toHaveLength(6);
  });
});

/** Mini serveur MCP : réponses JSON ou SSE, session Mcp-Session-Id. */
function mcpServer(opts: { sse?: boolean; catalog?: boolean }) {
  const seen: { method: string; session: string | null; version: string | null }[] = [];
  const data = Array.from({ length: 7 }, (_, i) => ({ id: `P${i}`, qty: i }));
  const fetch = async (_url: string, init?: RequestInit) => {
    const h = new Headers(init?.headers), m = JSON.parse(String(init?.body));
    seen.push({ method: m.method, session: h.get("mcp-session-id"), version: h.get("mcp-protocol-version") });
    if (m.id === undefined) return new Response(null, { status: 202 });
    let result: unknown;
    const tools = opts.catalog
      ? [{ name: "list_sources", inputSchema: { type: "object", properties: {} } }, { name: "query", inputSchema: { type: "object", properties: { source: {}, resource: {}, limit: {}, offset: {}, filters: {} }, required: ["source", "resource"] } }]
      : [{ name: "get_products", inputSchema: { type: "object", properties: {} } }, { name: "echo", inputSchema: { type: "object", properties: { x: {} }, required: ["x"] } }];
    if (m.method === "initialize") result = { protocolVersion: "2025-06-18", capabilities: { tools: {}, resources: {} }, serverInfo: { name: "mock", version: "1" } };
    else if (m.method === "tools/list") result = { tools };
    else if (m.method === "resources/list") result = { resources: [{ uri: "mock://stock", name: "stock", mimeType: "application/json" }] };
    else if (m.method === "resources/read") result = { contents: [{ uri: "mock://stock", text: JSON.stringify({ items: [{ sku: "A", onHand: 3 }] }) }] };
    else if (m.method === "tools/call" && m.params.name === "list_sources") result = { structuredContent: { sources: [{ id: "pim", resources: [{ resource: "products", key: "id", columns: [{ name: "id", type: "string" }, { name: "qty", type: "integer" }] }] }] } };
    else if (m.method === "tools/call" && m.params.name === "query") { const { offset, limit, filters } = m.params.arguments; const r = data.filter(x => !filters || x.qty >= filters[0].value); result = { structuredContent: { rows: r.slice(offset, offset + limit), nextOffset: offset + limit < r.length ? offset + limit : null } }; }
    else if (m.method === "tools/call" && m.params.name === "get_products") result = { content: [{ type: "text", text: JSON.stringify(data) }] };
    const payload = JSON.stringify({ jsonrpc: "2.0", id: m.id, result });
    return opts.sse ? new Response(`event: message\ndata: ${payload}\n\n`, { headers: { "content-type": "text/event-stream", "mcp-session-id": "S1" } }) : new Response(payload, { headers: { "content-type": "application/json", "mcp-session-id": "S1" } });
  };
  return { fetch, seen };
}

describe("Connecteur MCP générique", () => {
  it("catalogue + requête paginée : découverte, métadonnées, échantillon, filtre poussé", async () => {
    const s = mcpServer({ catalog: true });
    const c = new McpConnector({ id: "mcp", label: "mcp", kind: "mcp", params: { serverUrl: "https://m/mcp", bearer: "t" } }, { governor: gov("mcp", 3), fetch: s.fetch });
    const d = await c.describe();
    expect(d.tools.map(t => t.name)).toEqual(["list_sources", "query"]);
    const schema = await c.discoverSchema();
    expect(schema).toEqual([{ name: "pim/products", key: "id", watermark: undefined, columns: [{ name: "id", type: "string" }, { name: "qty", type: "integer" }] }]);
    expect((await c.query({ entity: "pim/products" })).rows).toHaveLength(7);
    expect((await c.query({ entity: "pim/products", filters: [{ field: "qty", op: "ge", value: 5 }] })).rows.map(r => r.id)).toEqual(["P5", "P6"]);
    expect(s.seen.find(x => x.method === "tools/list")).toMatchObject({ session: "S1", version: "2025-06-18" });
    expect(s.seen.some(x => x.method === "notifications/initialized")).toBe(true);
  });
  it("sans catalogue : ressources JSON et outils sans argument deviennent des ressources ; réponses SSE", async () => {
    const s = mcpServer({ sse: true });
    const c = createConnector({ id: "mcp2", label: "mcp2", kind: "mcp", params: { serverUrl: "https://m/mcp" } }, { governor: gov("mcp2"), fetch: s.fetch });
    const names = (await c.discoverSchema()).map(e => e.name);
    expect(names).toEqual(["stock", "get_products"]);
    expect(await c.sample("get_products", 2)).toEqual([{ id: "P0", qty: 0 }, { id: "P1", qty: 1 }]);
    expect(await c.sample("stock")).toEqual([{ sku: "A", onHand: 3 }]);
  });
  it("utilitaires : premières lignes, erreurs d'outil", () => {
    expect(firstRows({ a: { rows: [{ x: 1 }] } })).toEqual([{ x: 1 }]);
    expect(() => toolPayload({ isError: true, content: [{ type: "text", text: "boom" }] })).toThrow(/boom/);
  });
});

describe("Questionnaire et Studio", () => {
  it("chaque mode d'accès devient le bon type de connecteur", () => {
    const setup = importQuestionnaire(maisonLucieChannelsExample("https://lucie.example"));
    const kinds = new Set(setup.sources.map(s => s.kind));
    for (const k of ["odata4", "sftp", "soap", "salesforce", "amqp", "sqlhttp"]) expect(kinds.has(k as never)).toBe(true);
    expect(setup.issues.filter(i => i.level === "erreur")).toEqual([]);
    const mcpSetup = importQuestionnaire(maisonLucieMcpExample("https://lucie.example"));
    expect(mcpSetup.issues.filter(i => i.level === "erreur")).toEqual([]);
    expect(mcpSetup.sources.every(s => s.kind === "mcp" && s.params.serverUrl === "https://lucie.example/mcp")).toBe(true);
    expect(mcpSetup.objects.find(o => o.group === "products")?.entity).toBe("pim/products");
    expect(setup.sources.find(s => s.kind === "sqlhttp")?.accessMode).toBe("replica");
    expect(setup.sources.find(s => s.kind === "sftp")?.accessMode).toBe("depot");
    expect(importQuestionnaire(maisonLucieExample()).sources.map(s => s.kind).sort()).toEqual(["manhattan", "odata", "rest", "rest", "rest", "rest", "rest", "rest", "rest"]);
    expect(Object.keys(KIND_LABELS)).toHaveLength(24);
  });
});
