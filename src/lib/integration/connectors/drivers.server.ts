// Pilotes SQL (serveur uniquement). Chaque pilote est ouvert pour une fenêtre de
// synchronisation puis fermé : aucune connexion permanente.
import type { SqlDriver, SqlDriverFactory } from "./sql";
import type { Row } from "../types";

// DuckDB (fichiers Parquet/CSV, Postgres via l'extension postgres, tests).
export const duckdbDriver: SqlDriverFactory = async params => {
  const mod = "@duckdb/node-api";
  const { DuckDBInstance } = await import(/* @vite-ignore */ mod);
  const db = await DuckDBInstance.create(String(params.database ?? ":memory:"), { threads: String(params.threads ?? 2), access_mode: params.database && params.database !== ":memory:" ? "READ_ONLY" : "AUTOMATIC" });
  const con = await db.connect();
  for (const stmt of (params.init as string[] | undefined) ?? []) await con.run(stmt);
  return {
    async query(sql: string) { const r = await con.runAndReadAll(sql); return r.getRowObjectsJson() as Row[]; },
    async close() { con.closeSync?.(); db.closeSync?.(); },
  } satisfies SqlDriver;
};

/** Postgres (réplique de lecture de préférence) via l'extension postgres de DuckDB, en lecture seule. */
export const postgresDriver: SqlDriverFactory = async params => {
  const dsn = String(params.dsn ?? "").replace(/'/g, "''");
  return duckdbDriver({ init: ["INSTALL postgres", "LOAD postgres", `ATTACH '${dsn}' AS pg (TYPE postgres, READ_ONLY)`, "USE pg"] });
};

async function post(url: string, headers: Record<string, string>, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...headers }, body: JSON.stringify(body) });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) { const { HttpStatusError, parseRetryAfter } = await import("../budget"); throw new HttpStatusError(r.status, j?.message ?? `${url} → ${r.status}`, parseRetryAfter(r.headers.get("retry-after"))); }
  return j;
}

/** Snowflake SQL API v2 (jeton OAuth ou JWT paire de clés). Première partition de résultat seulement. */
export const snowflakeDriver: SqlDriverFactory = async p => ({
  async query(statement) {
    const j = await post(`https://${p.account}.snowflakecomputing.com/api/v2/statements`, { Authorization: `Bearer ${p.token}`, "X-Snowflake-Authorization-Token-Type": p.tokenType ?? "KEYPAIR_JWT" }, { statement, warehouse: p.warehouse, database: p.database, schema: p.schema, role: p.role, timeout: 60 });
    const cols: string[] = (j.resultSetMetaData?.rowType ?? []).map((c: any) => c.name);
    return (j.data ?? []).map((row: unknown[]) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  },
  async close() {},
});

/** Databricks SQL Statement Execution API (résultat INLINE, JSON_ARRAY). */
export const databricksDriver: SqlDriverFactory = async p => ({
  async query(statement) {
    const j = await post(`https://${p.host}/api/2.0/sql/statements`, { Authorization: `Bearer ${p.token}` }, { statement, warehouse_id: p.warehouseId, catalog: p.catalog, schema: p.schema, wait_timeout: "30s", disposition: "INLINE", format: "JSON_ARRAY" });
    const cols: string[] = (j.manifest?.schema?.columns ?? []).map((c: any) => c.name);
    return (j.result?.data_array ?? []).map((row: unknown[]) => Object.fromEntries(cols.map((c, i) => [c, row[i]])));
  },
  async close() {},
});

/** BigQuery jobs.query (SQL standard). */
export const bigqueryDriver: SqlDriverFactory = async p => ({
  async query(query) {
    const j = await post(`https://bigquery.googleapis.com/bigquery/v2/projects/${p.project}/queries`, { Authorization: `Bearer ${p.token}` }, { query, useLegacySql: false, timeoutMs: 60000, maxResults: 10000 });
    const cols: string[] = (j.schema?.fields ?? []).map((f: any) => f.name);
    return (j.rows ?? []).map((r: any) => Object.fromEntries(cols.map((c, i) => [c, r.f[i]?.v])));
  },
  async close() {},
});

export function driverFor(dialect: string): SqlDriverFactory {
  switch (dialect) {
    case "duckdb": return duckdbDriver;
    case "postgres": return postgresDriver;
    case "snowflake": return snowflakeDriver;
    case "databricks": return databricksDriver;
    case "bigquery": return bigqueryDriver;
    default: throw new Error(`Dialecte SQL inconnu : ${dialect}`);
  }
}
