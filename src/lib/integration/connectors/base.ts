import { HttpStatusError, parseRetryAfter, type CallKind, type SourceGovernor } from "../budget";
import { openCredentialSession, type CredentialSession } from "../secrets";
import { applyLocal, StreamingAggregator } from "../local-engine";
import type { Connector, ConnectorKind, EntityInfo, IncrementalBatch, Pushdown, QueryResult, QuerySpec, Row, SourceConfig, TestResult } from "../types";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface ConnectorDeps { governor: SourceGovernor; env?: Record<string, string | undefined>; fetch?: FetchLike }

/** Socle commun : identifiants juste-à-temps, appels HTTP sous budget, agrégation locale en flux. */
export abstract class BaseConnector implements Connector {
  abstract readonly kind: ConnectorKind;
  abstract readonly pushdown: Pushdown;
  private session: CredentialSession<Record<string, unknown>> | null = null;
  calls = 0;
  constructor(readonly config: SourceConfig, protected deps: ConnectorDeps) {}
  get id() { return this.config.id; }
  get governor() { return this.deps.governor; }

  /** Paramètres résolus : secrets lus à la première utilisation de la session, effacés par close(). */
  protected get p(): Record<string, any> {
    if (!this.session || this.session.closed) this.session = openCredentialSession(this.config.params, this.deps.env);
    return this.session.params;
  }
  /** Fin de fenêtre de synchronisation : identifiants effacés, connexions fermées. */
  async close(): Promise<void> { this.session?.close(); this.session = null; }

  /** Parcours complet : léger tant qu'il reste sous le plafond de jour, lourd (heures creuses) au-delà. */
  protected kindFor(full: boolean, readSoFar: number): CallKind {
    return full && readSoFar >= this.governor.budget.maxDaytimeScanRows ? "heavy" : "light";
  }

  protected async http<T = any>(url: string, init: RequestInit & { kind?: CallKind; rows?: (t: T) => number } = {}): Promise<T> {
    const f = this.deps.fetch ?? fetch;
    const { kind = "light", rows, ...req } = init;
    const key = `${req.method ?? "GET"} ${url} ${typeof req.body === "string" ? req.body : ""}`;
    return this.governor.call(key, kind, async () => {
      this.calls++;
      const r = await f(url, req);
      if (!r.ok) throw new HttpStatusError(r.status, `${new URL(url).pathname} → ${r.status}`, parseRetryAfter(r.headers.get("retry-after")));
      const ct = r.headers.get("content-type") ?? "";
      return (ct.includes("json") ? await r.json() : await r.text()) as T;
    }, rows);
  }

  abstract testConnection(): Promise<TestResult>;
  abstract discoverSchema(): Promise<EntityInfo[]>;
  abstract readIncremental(entity: string, watermarkField: string, since: string | null, opts?: { select?: string[]; pageSize?: number }): AsyncIterable<IncrementalBatch>;
  abstract sample(entity: string, n?: number): Promise<Row[]>;

  /** Par défaut : lecture paginée sous budget + agrégation locale en flux (rien n'est conservé). */
  async query(spec: QuerySpec): Promise<QueryResult> {
    const before = this.calls;
    const agg = spec.groupBy?.length || spec.metrics?.length ? new StreamingAggregator(spec) : null;
    const kept: Row[] = [];
    let read = 0;
    for await (const b of this.scan(spec)) {
      read += b.length;
      if (agg) agg.push(b); else for (const r of applyLocal(b, { ...spec, limit: undefined, orderBy: undefined })) kept.push(r);
      if (!agg && spec.limit && kept.length >= spec.limit && !spec.orderBy?.length) break;
    }
    const rows = agg ? agg.result() : applyLocal(kept, { entity: spec.entity, orderBy: spec.orderBy, limit: spec.limit });
    return { rows, rowsRead: read, calls: this.calls - before, pushedDown: { filter: this.pushdown.filter, aggregate: false } };
  }
  /** Parcours paginé avec les filtres que la source sait appliquer. */
  protected abstract scan(spec: QuerySpec): AsyncIterable<Row[]>;

  protected timed = async (fn: () => Promise<unknown>): Promise<TestResult> => {
    const t = Date.now();
    try { await fn(); return { ok: true, message: "Connexion réussie", latencyMs: Date.now() - t }; }
    catch (e) { return { ok: false, message: (e as Error).message, latencyMs: Date.now() - t }; }
  };
}

export const columnsOf = (rows: Row[]) => Object.keys(rows[0] ?? {}).map(name => ({ name, type: typeof rows[0][name] === "number" ? "number" : "string" }));
/** Watermark canonique (ISO 8601 UTC) quel que soit le format de la source (y compris /Date(ms)/ OData v2). */
export function isoOf(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return new Date(v).toISOString();
  const s = String(v);
  const ms = s.match(/^\/Date\((-?\d+)/);
  if (ms) return new Date(Number(ms[1])).toISOString();
  if (/^\d{4}-\d\d-\d\d$/.test(s)) return `${s}T00:00:00.000Z`;
  if (/^\d{4}-\d\d-\d\d[ T]\d\d:\d\d/.test(s)) { const d = new Date(/Z|[+-]\d\d:?\d\d$/.test(s) ? s.replace(" ", "T") : `${s.replace(" ", "T")}Z`); return Number.isNaN(d.getTime()) ? s : d.toISOString(); }
  return s;
}
export const maxWatermark = (rows: Row[], field: string, prev: string | null) => rows.reduce<string | null>((m, r) => { const v = isoOf(r[field]); return v && (!m || v > m) ? v : m; }, prev);
