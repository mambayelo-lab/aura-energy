import { describe, expect, it } from "vitest";
import { SourceGovernor } from "../budget";
import { ODataConnector, odataFilter, parseEdmx } from "../connectors/odata";
import { ManhattanConnector, RestConnector } from "../connectors/rest";
import { compileSql, SqlConnector } from "../connectors/sql";
import { duckdbDriver } from "../connectors/drivers.server";
import { literalSecretFields, resolveRefs } from "../secrets";

const rows = Array.from({ length: 25 }, (_, i) => ({ Supplier: String(100001 + i).padStart(10, "0"), SupplierName: `Fournisseur ${i}`, Country: i % 2 ? "FR" : "IT", LastChangeDateTime: `2026-09-${String(1 + i).padStart(2, "0")} 06:00:00` }));
const gov = (id: string) => new SourceGovernor(id, { explicitRelax: true, maxRequestsPerMinute: 1000, maxRowsPerCall: 10, offPeak: { startHour: 0, endHour: 24 } });

/** Mini-simulateur OData v2 : $filter (eq, gt sur datetime), $select, $top/$skip, __next, $metadata. */
function odataSim(seen: string[]) {
  return async (url: string, init?: RequestInit) => {
    seen.push(url);
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer s3cret");
    const u = new URL(url);
    if (u.pathname.endsWith("$metadata")) return new Response(`<edmx:Edmx><Schema><EntityType Name="A_SupplierType"><Property Name="Supplier" Type="Edm.String"/><Property Name="LastChangeDateTime" Type="Edm.DateTime"/></EntityType><EntityContainer><EntitySet Name="A_Supplier" EntityType="NS.A_SupplierType"/></EntityContainer></Schema></edmx:Edmx>`, { headers: { "content-type": "application/xml" } });
    let r = rows;
    const f = u.searchParams.get("$filter");
    const gt = f?.match(/LastChangeDateTime gt datetime'([^']+)'/);
    if (gt) r = r.filter(x => x.LastChangeDateTime.replace(" ", "T") > gt[1]);
    const eq = f?.match(/Country eq '([^']+)'/);
    if (eq) r = r.filter(x => x.Country === eq[1]);
    const top = Number(u.searchParams.get("$top")), skip = Number(u.searchParams.get("$skip") ?? 0);
    const sel = u.searchParams.get("$select")?.split(",");
    const page = r.slice(skip, skip + top).map(x => (sel ? Object.fromEntries(sel.map(k => [k, (x as Record<string, unknown>)[k]])) : x));
    const d: Record<string, unknown> = { results: page };
    if (skip + top < r.length) { u.searchParams.set("$skip", String(skip + top)); d.__next = u.pathname + u.search; }
    return new Response(JSON.stringify({ d }), { headers: { "content-type": "application/json" } });
  };
}

describe("SDK de connecteurs", () => {
  it("SAP OData : $filter, $select, $top, pagination __next, delta par watermark, $metadata", async () => {
    const seen: string[] = [];
    const c = new ODataConnector({ id: "sap", label: "SAP", kind: "odata", params: { baseUrl: "https://sap.example", bearer: "{{env:SAP_TOKEN}}", entities: { A_Supplier: {} } } }, { governor: gov("sap"), fetch: odataSim(seen), env: { SAP_TOKEN: "s3cret" } });
    const schema = await c.discoverSchema();
    expect(schema[0].columns.map(x => x.name)).toEqual(["Supplier", "LastChangeDateTime"]);
    const all: unknown[] = [];
    for await (const b of c.readIncremental("A_Supplier", "LastChangeDateTime", null, { select: ["Supplier"] })) all.push(...b.rows);
    expect(all).toHaveLength(25);
    expect(seen.filter(u => decodeURIComponent(u).includes("$skip")).length).toBe(2); // 3 pages de 10
    const delta: unknown[] = [];
    let wm: string | null = null;
    for await (const b of c.readIncremental("A_Supplier", "LastChangeDateTime", "2026-09-20T06:00:00.000Z")) { delta.push(...b.rows); wm = b.watermark; }
    expect(delta).toHaveLength(5);
    expect(wm).toBe("2026-09-25T06:00:00.000Z");
    const agg = await c.query({ entity: "A_Supplier", filters: [{ field: "Country", op: "eq", value: "FR" }], groupBy: ["Country"], metrics: [{ fn: "count", as: "n" }] });
    expect(agg.rows).toEqual([{ Country: "FR", n: 12 }]);
    expect(agg.pushedDown).toEqual({ filter: true, aggregate: false });
    expect(odataFilter([{ field: "Country", op: "in", value: ["FR", "IT"] }])).toBe("(Country eq 'FR' or Country eq 'IT')");
    expect(parseEdmx(`<EntityType Name="T"><Property Name="A" Type="Edm.Int32"/></EntityType><EntitySet Name="S" EntityType="x.T"/>`)).toEqual({ S: [{ name: "A", type: "Int32" }] });
    await c.close();
  });

  it("REST (curseur) et Manhattan (page/size) : pagination sous plafond de lignes", async () => {
    const calls: string[] = [];
    const fetchCursor = async (url: string) => {
      calls.push(url);
      const u = new URL(url), off = Number(u.searchParams.get("cursor") ?? 0), lim = Number(u.searchParams.get("limit"));
      const items = rows.slice(off, off + lim);
      return new Response(JSON.stringify({ items, nextCursor: off + lim < rows.length ? String(off + lim) : null }), { headers: { "content-type": "application/json" } });
    };
    const r = new RestConnector({ id: "pim", label: "PIM", kind: "rest", params: { baseUrl: "https://pim.example", entities: { products: { path: "/api/products" } } } }, { governor: gov("pim"), fetch: fetchCursor });
    const q = await r.query({ entity: "products", groupBy: ["Country"], metrics: [{ fn: "count", as: "n" }] });
    expect(q.rows.find(x => x.Country === "IT")?.n).toBe(13);
    expect(calls.every(u => new URL(u).searchParams.get("limit") === "10")).toBe(true);
    const fetchPage = async (url: string) => {
      const u = new URL(url), p = Number(u.searchParams.get("page")), s = Number(u.searchParams.get("size"));
      return new Response(JSON.stringify({ data: rows.slice(p * s, (p + 1) * s), header: { hasMore: (p + 1) * s < rows.length } }), { headers: { "content-type": "application/json" } });
    };
    const m = new ManhattanConnector({ id: "wms", label: "WMS", kind: "manhattan", params: { baseUrl: "https://wms.example", entities: { inventory: { path: "/inventory" } } } }, { governor: gov("wms"), fetch: fetchPage });
    let n = 0;
    for await (const b of m.readIncremental("inventory", "LastChangeDateTime", null)) n += b.rows.length;
    expect(n).toBe(25);
  });

  it("SQL : compilation par dialecte et exécution poussée à la source (DuckDB)", async () => {
    const spec = { entity: "t", filters: [{ field: "Country", op: "eq" as const, value: "FR" }], groupBy: ["Country"], metrics: [{ fn: "count" as const, as: "n" }], limit: 10 };
    expect(compileSql("postgres", "sch.t", spec)).toBe(`SELECT "Country", COUNT(*) AS "n" FROM "sch"."t" WHERE "Country" = 'FR' GROUP BY "Country" LIMIT 10`);
    expect(compileSql("bigquery", "ds.t", spec)).toContain("FROM `ds`.`t`");
    expect(compileSql("databricks", "t", spec)).toContain("`Country`");
    expect(compileSql("snowflake", "t", { entity: "t", filters: [{ field: "ts", op: "gt", value: "2026-09-01T00:00:00Z" }] }, ["ts"])).toContain("'2026-09-01 00:00:00.000'::TIMESTAMP_NTZ");
    expect(() => compileSql("postgres", "t; DROP TABLE x", spec)).toThrow();
    expect(compileSql("postgres", "t", { entity: "t", filters: [{ field: "n", op: "eq", value: "x' OR '1'='1" }] })).toContain("'x'' OR ''1''=''1'");
    const values = rows.map(r => `('${r.Supplier}', '${r.Country}', TIMESTAMP '${r.LastChangeDateTime}')`).join(",");
    const c = new SqlConnector({ id: "dw", label: "DW", kind: "sql", params: { dialect: "duckdb", entities: { suppliers: { table: "suppliers", key: "Supplier", watermark: "ts" } } } }, { governor: gov("dw") },
      p => duckdbDriver({ ...p, init: [`CREATE TABLE suppliers AS SELECT * FROM (VALUES ${values}) v("Supplier", "Country", "ts")`] }));
    const res = await c.query({ entity: "suppliers", groupBy: ["Country"], metrics: [{ fn: "count", as: "n" }], orderBy: [{ field: "Country" }] });
    expect(res.pushedDown.aggregate).toBe(true);
    expect(res.rows.map(r => [r.Country, Number(r.n)])).toEqual([["FR", 12], ["IT", 13]]);
    const inc: unknown[] = [];
    for await (const b of c.readIncremental("suppliers", "ts", "2026-09-20T06:00:00.000Z")) inc.push(...b.rows);
    expect(inc).toHaveLength(5);
    await c.close();
  });

  it("secrets : références résolues côté serveur, secrets en clair détectés", () => {
    expect(resolveRefs({ a: "Bearer {{env:X}}" }, { X: "y" })).toEqual({ a: "Bearer y" });
    expect(() => resolveRefs({ a: "{{env:ABSENT}}" }, {})).toThrow(/ABSENT/);
    expect(literalSecretFields({ bearer: "{{env:T}}", password: "hunter2" })).toEqual(["password"]);
  });
});
