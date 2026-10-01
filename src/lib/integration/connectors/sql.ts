// SQL générique : la requête (filtre, expression, GROUP BY, métriques, LIMIT) est
// compilée dans le dialecte de la source et exécutée par elle. Dialectes :
// Snowflake, Databricks, BigQuery, Postgres, DuckDB (testés sur DuckDB).
import { BaseConnector, isoOf, maxWatermark } from "./base";
import type { EntityInfo, IncrementalBatch, Metric, QueryResult, QuerySpec, Row, Scalar } from "../types";

export type SqlDialect = "postgres" | "snowflake" | "databricks" | "bigquery" | "duckdb";

export interface SqlDriver { query(sql: string): Promise<Row[]>; close(): Promise<void> }
export type SqlDriverFactory = (params: Record<string, any>) => Promise<SqlDriver>;

export function quoteIdent(d: SqlDialect, name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_$.]*$/.test(name)) throw new Error(`Identifiant SQL refusé : ${name}`);
  const q = d === "databricks" || d === "bigquery" ? "`" : '"';
  return name.split(".").map(p => `${q}${p}${q}`).join(".");
}
export function sqlLiteral(d: SqlDialect, v: Scalar, asTimestamp = false): string {
  if (v === null) return "NULL";
  if (typeof v === "number") { if (!Number.isFinite(v)) throw new Error("Nombre invalide"); return String(v); }
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  const s = `'${String(v).replace(/'/g, "''")}'`;
  if (!asTimestamp) return s;
  const iso = `'${String(isoOf(v)).replace("T", " ").replace("Z", "")}'`;
  return d === "snowflake" ? `${iso}::TIMESTAMP_NTZ` : `TIMESTAMP ${iso}`;
}
function metricSql(d: SqlDialect, m: Metric): string {
  const f = m.field ? quoteIdent(d, m.field) : "*";
  const expr = m.fn === "count_distinct" ? `COUNT(DISTINCT ${f})` : m.fn === "count" ? `COUNT(${f})` : `${m.fn.toUpperCase()}(${f})`;
  return `${expr} AS ${quoteIdent(d, m.as)}`;
}

/** Compile une QuerySpec en SQL (valeurs échappées, identifiants contrôlés). */
export function compileSql(d: SqlDialect, table: string, spec: QuerySpec, timestampFields: string[] = []): string {
  const q = (n: string) => quoteIdent(d, n);
  const agg = !!(spec.groupBy?.length || spec.metrics?.length);
  const cols = agg ? [...(spec.groupBy ?? []).map(q), ...(spec.metrics ?? []).map(m => metricSql(d, m))] : spec.select?.length ? spec.select.map(q) : ["*"];
  const where = [
    ...(spec.filters ?? []).map(f => {
      const ts = timestampFields.includes(f.field);
      if (f.op === "in") return `${q(f.field)} IN (${(f.value as Scalar[]).map(v => sqlLiteral(d, v, ts)).join(", ") || "NULL"})`;
      const op = { eq: "=", ne: "<>", gt: ">", ge: ">=", lt: "<", le: "<=" }[f.op];
      return f.value === null ? `${q(f.field)} IS ${f.op === "ne" ? "NOT " : ""}NULL` : `${q(f.field)} ${op} ${sqlLiteral(d, f.value as Scalar, ts)}`;
    }),
    ...(spec.where ?? []).map(e => e.kind === "diff_lt" ? `(${q(e.a)} - ${q(e.b)}) < ${q(e.c)}`
      : `(${q(e.actual)} > ${q(e.expected)} OR (${q(e.actual)} IS NULL AND ${q(e.expected)} < ${sqlLiteral(d, e.asOf)}))`),
  ];
  let sql = `SELECT ${cols.join(", ")} FROM ${quoteIdent(d, table)}`;
  if (where.length) sql += ` WHERE ${where.join(" AND ")}`;
  if (spec.groupBy?.length) sql += ` GROUP BY ${spec.groupBy.map(q).join(", ")}`;
  if (spec.orderBy?.length) sql += ` ORDER BY ${spec.orderBy.map(o => `${q(o.field)}${o.desc ? " DESC" : ""}`).join(", ")}`;
  if (spec.limit) sql += ` LIMIT ${Math.floor(spec.limit)}`;
  return sql;
}

export function schemaSql(d: SqlDialect, schema?: string): string {
  if (d === "bigquery") return `SELECT table_name, column_name, data_type FROM ${quoteIdent(d, `${schema ?? "dataset"}.INFORMATION_SCHEMA.COLUMNS`)} ORDER BY table_name, ordinal_position`;
  const where = schema ? ` WHERE table_schema = ${sqlLiteral(d, d === "snowflake" ? schema.toUpperCase() : schema)}` : ` WHERE table_schema NOT IN ('information_schema','pg_catalog')`;
  return `SELECT table_name, column_name, data_type FROM information_schema.columns${where} ORDER BY table_name, ordinal_position`;
}

export interface SqlEntity { table: string; key?: string; watermark?: string; timestampFields?: string[] }

export class SqlConnector extends BaseConnector {
  readonly kind: "sql" | "file" = "sql";
  readonly pushdown = { filter: true, select: true, aggregate: true, limit: true, columnExpr: true };
  private driver: SqlDriver | null = null;
  constructor(config: ConstructorParameters<typeof BaseConnector>[0], deps: ConstructorParameters<typeof BaseConnector>[1], private factory: SqlDriverFactory) { super(config, deps); }

  get dialect(): SqlDialect { return (this.config.params.dialect as SqlDialect) ?? "postgres"; }
  private ent(entity: string): SqlEntity {
    const e = (this.config.params.entities as Record<string, SqlEntity> | undefined)?.[entity];
    return e ?? { table: entity };
  }
  /** Connexion ouverte à la demande pour la fenêtre de synchronisation, fermée par close(). */
  private async conn() { return (this.driver ??= await this.factory(this.p)); }
  override async close() { await this.driver?.close().catch(() => {}); this.driver = null; await super.close(); }

  private async run(sql: string, kind: "light" | "heavy" = "light"): Promise<Row[]> {
    return this.governor.call(`sql ${sql}`, kind, async () => { this.calls++; return (await this.conn()).query(sql); }, r => r.length);
  }
  async testConnection() { return this.timed(() => this.run("SELECT 1 AS ok")); }
  async discoverSchema(): Promise<EntityInfo[]> {
    const rows = await this.run(schemaSql(this.dialect, this.config.params.schema as string | undefined));
    const by = new Map<string, EntityInfo>();
    for (const r of rows) {
      const t = String(r.table_name ?? r.TABLE_NAME);
      const e = by.get(t) ?? { name: t, columns: [] };
      e.columns.push({ name: String(r.column_name ?? r.COLUMN_NAME), type: String(r.data_type ?? r.DATA_TYPE) });
      by.set(t, e);
    }
    return [...by.values()];
  }
  async sample(entity: string, n = 20) { return this.run(compileSql(this.dialect, this.ent(entity).table, { entity, limit: Math.min(n, this.governor.rowsPerCall()) })); }
  statement(spec: QuerySpec) { const e = this.ent(spec.entity); return compileSql(this.dialect, e.table, spec, [...(e.timestampFields ?? []), ...(e.watermark ? [e.watermark] : [])]); }

  /** Tout est poussé à la source : une seule requête (GROUP BY), résultat plafonné. */
  override async query(spec: QuerySpec): Promise<QueryResult> {
    const before = this.calls;
    const agg = !!(spec.groupBy?.length || spec.metrics?.length);
    const selective = agg || !!spec.filters?.length || !!spec.where?.length;
    if (agg || spec.limit) {
      const sql = this.statement(spec);
      const rows = await this.run(sql, selective ? "light" : "heavy");
      return { rows, rowsRead: rows.length, calls: this.calls - before, pushedDown: { filter: true, aggregate: agg }, statement: sql };
    }
    // Lignes filtrées sans limite : pages de maxRowsPerCall, ordre stable.
    const size = this.governor.rowsPerCall();
    const order = spec.orderBy?.length ? spec.orderBy : (spec.select ?? []).map(field => ({ field }));
    const rows: Row[] = [];
    let sql = "";
    for (let off = 0; ; off += size) {
      sql = `${this.statement({ ...spec, orderBy: order.length ? order : undefined, limit: size })} OFFSET ${off}`;
      const page = await this.run(sql, selective ? "light" : this.kindFor(true, off));
      for (const r of page) rows.push(r);
      if (page.length < size) break;
    }
    return { rows, rowsRead: rows.length, calls: this.calls - before, pushedDown: { filter: true, aggregate: false }, statement: sql };
  }
  protected async *scan(spec: QuerySpec): AsyncIterable<Row[]> { yield (await this.query(spec)).rows; }

  /** Pagination par clé (watermark, clé) : aucun OFFSET, chaque page reprend après la précédente. */
  async *readIncremental(entity: string, watermarkField: string, since: string | null, opts: { select?: string[]; pageSize?: number } = {}): AsyncIterable<IncrementalBatch> {
    const e = this.ent(entity), d = this.dialect, q = (n: string) => quoteIdent(d, n);
    const size = this.governor.rowsPerCall(opts.pageSize);
    const key = e.key ?? watermarkField;
    const cols = opts.select?.length ? [...new Set([...opts.select, watermarkField, key])].map(q).join(", ") : "*";
    let wm = since, lastKey: Scalar = null, read = 0;
    for (;;) {
      const cond = wm === null ? "" : lastKey === null
        ? ` WHERE ${q(watermarkField)} > ${sqlLiteral(d, wm, true)}`
        : ` WHERE (${q(watermarkField)} > ${sqlLiteral(d, wm, true)} OR (${q(watermarkField)} = ${sqlLiteral(d, wm, true)} AND ${q(key)} > ${sqlLiteral(d, lastKey)}))`;
      const sql = `SELECT ${cols} FROM ${quoteIdent(d, e.table)}${cond} ORDER BY ${q(watermarkField)}, ${q(key)} LIMIT ${size}`;
      const rows = await this.run(sql, this.kindFor(since === null, read));
      read += rows.length;
      if (!rows.length) return;
      const last = rows[rows.length - 1];
      wm = isoOf(last[watermarkField]) ?? wm; lastKey = last[key] as Scalar;
      yield { rows, watermark: maxWatermark(rows, watermarkField, since) };
      if (rows.length < size) return;
    }
  }
}
