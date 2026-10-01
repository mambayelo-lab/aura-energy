// REST générique (PIM, OMS…), Manhattan Active (page/size) et Kafka (proxy REST),
// réalignés sur le SDK : pagination sous budget, filtre « égal » et fenêtre de
// temps poussés à la source quand l'API le permet, agrégation locale en flux.
import { BaseConnector, columnsOf, isoOf, maxWatermark } from "./base";
import type { EntityInfo, IncrementalBatch, QueryResult, QuerySpec, Row } from "../types";

export interface RestEntity {
  path: string;
  itemsField?: string;
  pagination?: "cursor" | "page" | "offset-topic" | "none";
  cursorParam?: string; cursorField?: string; limitParam?: string;
  pageParam?: string; sizeParam?: string; hasMoreField?: string;
  updatedAfterParam?: string;
  /** Champs filtrables par égalité en paramètre d'URL. */
  filterParams?: string[];
  key?: string; watermark?: string;
  /** Agrégation offerte par l'API (GROUP BY côté source) : paramètre de regroupement et colonnes renvoyées. */
  aggregate?: { groupByParam: string; params?: Record<string, string>; sums: string[]; countAs?: string; itemsField?: string; rangeField?: string; fromParam?: string; toParam?: string };
}

export class RestConnector extends BaseConnector {
  readonly kind: "rest" | "manhattan" | "kafka" = "rest";
  readonly pushdown = { filter: true, select: false, aggregate: false, limit: true, columnExpr: false };

  protected ent(entity: string): RestEntity {
    const e = (this.config.params.entities as Record<string, RestEntity> | undefined)?.[entity];
    if (!e) throw new Error(`Ressource inconnue : ${entity}`);
    return { itemsField: "items", pagination: "cursor", cursorParam: "cursor", cursorField: "nextCursor", limitParam: "limit", pageParam: "page", sizeParam: "size", updatedAfterParam: "updatedAfter", ...this.defaults(), ...e };
  }
  protected defaults(): Partial<RestEntity> { return {}; }
  protected headers(): Record<string, string> {
    const p = this.p, h: Record<string, string> = { Accept: "application/json", ...(p.headers ?? {}) };
    if (p.bearer) h.Authorization = `Bearer ${p.bearer}`;
    if (p.apiKey) h["X-API-Key"] = String(p.apiKey);
    return h;
  }
  protected url(e: RestEntity, q: Record<string, string>) {
    const u = new URL(e.path, String(this.p.baseUrl));
    for (const [k, v] of Object.entries(q)) if (v !== "") u.searchParams.set(k, v);
    return u.toString();
  }
  protected items(e: RestEntity, j: any): Row[] {
    return (e.itemsField ? j?.[e.itemsField] : j) ?? [];
  }

  async testConnection() { return this.timed(async () => { await this.sample(Object.keys(this.config.params.entities as object)[0], 1); }); }
  async discoverSchema(): Promise<EntityInfo[]> {
    const out: EntityInfo[] = [];
    for (const name of Object.keys(this.config.params.entities as object)) {
      const e = this.ent(name);
      out.push({ name, key: e.key, watermark: e.watermark, columns: columnsOf(await this.sample(name, 1)) });
    }
    return out;
  }
  async sample(entity: string, n = 20): Promise<Row[]> {
    const e = this.ent(entity);
    const size = String(Math.min(n, this.governor.rowsPerCall()));
    const j = await this.http(this.url(e, e.pagination === "page" ? { [e.sizeParam!]: size } : { [e.limitParam!]: size }), { headers: this.headers() });
    return this.items(e, j).slice(0, n);
  }

  protected async *pages(e: RestEntity, base: Record<string, string>, full: boolean): AsyncIterable<Row[]> {
    const size = String(this.governor.rowsPerCall());
    let cursor: string | null = "0", page = 0, read = 0;
    for (;;) {
      const q = e.pagination === "page" ? { ...base, [e.pageParam!]: String(page), [e.sizeParam!]: size }
        : e.pagination === "cursor" ? { ...base, [e.limitParam!]: size, ...(cursor && cursor !== "0" ? { [e.cursorParam!]: cursor } : {}) }
        : base;
      const j: any = await this.http(this.url(e, q), { headers: this.headers(), kind: this.kindFor(full, read), rows: (x: any) => this.items(e, x).length });
      const rows = this.items(e, j);
      read += rows.length;
      yield rows;
      if (e.pagination === "page") { if (!(e.hasMoreField ? pathGet(j, e.hasMoreField) : rows.length === Number(size))) return; page++; }
      else if (e.pagination === "cursor") { cursor = pathGet(j, e.cursorField!) ?? null; if (!cursor) return; }
      else return;
    }
  }

  /** GROUP BY poussé à la source quand l'API le propose (sommes et comptes uniquement). */
  override async query(spec: QuerySpec): Promise<QueryResult> {
    const e = this.ent(spec.entity), a = e.aggregate;
    const metricsOk = (spec.metrics ?? []).every(m => m.fn === "count" || (m.fn === "sum" && m.field && a?.sums.includes(m.field)));
    const filtersOk = (spec.filters ?? []).every(f => (f.field === a?.rangeField && ["ge", "lt"].includes(f.op)) || (f.op === "eq" && e.filterParams?.includes(f.field)));
    if (!a || !spec.groupBy?.length || !metricsOk || !filtersOk || spec.where?.length) return super.query(spec);
    const before = this.calls;
    const q: Record<string, string> = { ...(a.params ?? {}), [a.groupByParam]: spec.groupBy.join(",") };
    for (const f of spec.filters ?? []) {
      if (f.field === a.rangeField) q[f.op === "ge" ? a.fromParam ?? "from" : a.toParam ?? "to"] = String(f.value);
      else q[f.field] = String(f.value);
    }
    const j: any = await this.http(this.url(e, q), { headers: this.headers(), rows: (x: any) => (x?.[a.itemsField ?? "items"] ?? []).length });
    const rows: Row[] = (j?.[a.itemsField ?? "items"] ?? []).map((r: Row) => {
      const out: Row = Object.fromEntries(spec.groupBy!.map(g => [g, r[g]]));
      for (const m of spec.metrics ?? []) out[m.as] = m.fn === "count" ? r[a.countAs ?? "count"] : r[m.field!];
      return out;
    });
    return { rows: spec.limit ? rows.slice(0, spec.limit) : rows, rowsRead: rows.length, calls: this.calls - before, pushedDown: { filter: true, aggregate: true } };
  }

  protected pushed(e: RestEntity, spec: QuerySpec): Record<string, string> {
    const q: Record<string, string> = {};
    for (const f of spec.filters ?? []) {
      if (f.op === "eq" && e.filterParams?.includes(f.field)) q[f.field] = String(f.value);
      if ((f.op === "gt" || f.op === "ge") && f.field === e.watermark && e.updatedAfterParam) q[e.updatedAfterParam] = String(isoOf(f.value));
    }
    return q;
  }
  protected async *scan(spec: QuerySpec): AsyncIterable<Row[]> {
    const e = this.ent(spec.entity);
    const pushed = this.pushed(e, spec);
    yield* this.pages(e, pushed, !Object.keys(pushed).length);
  }
  async *readIncremental(entity: string, watermarkField: string, since: string | null): AsyncIterable<IncrementalBatch> {
    const e = this.ent(entity);
    let wm = since;
    for await (const rows of this.pages(e, since && e.updatedAfterParam ? { [e.updatedAfterParam]: since } : {}, !since)) {
      const fresh = since ? rows.filter(r => (isoOf(r[watermarkField]) ?? "") > since) : rows;
      wm = maxWatermark(fresh, watermarkField, wm);
      yield { rows: fresh, watermark: wm };
    }
  }
}

/**
 * Manhattan Active (WM) : pagination page/size et fenêtre temporelle.
 * Noms de paramètres et forme de réponse à vérifier avec la documentation client
 * (les API Manhattan Active varient selon le composant et la version).
 */
export class ManhattanConnector extends RestConnector {
  override readonly kind = "manhattan" as const;
  protected override defaults(): Partial<RestEntity> { return { itemsField: "data", pagination: "page", pageParam: "page", sizeParam: "size", hasMoreField: "header.hasMore", updatedAfterParam: "from" }; }
}

/** Kafka via proxy REST (offsets) : le watermark est l'offset. Aura lit, ne consomme pas de groupe. */
export class KafkaRestConnector extends RestConnector {
  override readonly kind = "kafka" as const;
  protected override defaults(): Partial<RestEntity> { return { itemsField: "messages", pagination: "offset-topic" }; }
  async *readIncremental(entity: string, _w: string, since: string | null): AsyncIterable<IncrementalBatch> {
    const e = this.ent(entity);
    let offset = since ? Number(since) + 1 : 0;
    for (;;) {
      const j: any = await this.http(this.url(e, { topic: entity, offset: String(offset), limit: String(this.governor.rowsPerCall()) }), { headers: this.headers(), rows: (x: any) => x?.messages?.length ?? 0 });
      const msgs: any[] = j?.messages ?? [];
      if (!msgs.length) return;
      const rows = msgs.map(m => ({ _offset: m.offset, _key: m.key, ...(m.value?.data && typeof m.value.data === "object" ? m.value.data : { value: m.value }) }));
      offset = Math.max(...msgs.map(m => Number(m.offset))) + 1;
      yield { rows, watermark: String(offset - 1) };
      if (msgs.length < this.governor.rowsPerCall()) return;
    }
  }
  protected override async *scan(spec: QuerySpec): AsyncIterable<Row[]> { for await (const b of this.readIncremental(spec.entity, "_offset", null)) yield b.rows; }
}

function pathGet(o: any, path: string) { return path.split(".").reduce((x, k) => (x == null ? x : x[k]), o); }
