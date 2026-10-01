// Connecteurs « canal » du SDK : OData v4, GraphQL, SOAP, Salesforce (REST et
// Bulk API 2.0), AMQP (API HTTP RabbitMQ), IBM MQ (REST), CloudEvents, CDC
// (Debezium), SFTP (CSV, JSON, XML, Parquet), SQL sur HTTP (JDBC-like),
// gRPC-web, ESB / iPaaS, SAP IDoc, SAP RFC/BAPI, EDIFACT, X12 et AS2.
// Tous passent par le gouverneur de la source (budget, plafond de lignes par
// appel, repli sur 429/503, disjoncteur) et renvoient des lignes plates : les
// métadonnées, l'échantillon et le mapping avec score sont ceux du SDK commun.
import { HttpStatusError, parseRetryAfter, type CallKind } from "../budget";
import { BaseConnector, columnsOf, isoOf, maxWatermark, type ConnectorDeps } from "./base";
import { as2Mic, edifactRows, idocRows, x12Rows } from "./edi";
import type { SqlDriverFactory } from "./sql";
import type { ColumnInfo, ConnectorKind, EntityInfo, Filter, IncrementalBatch, Metric, Pushdown, QueryResult, QuerySpec, Row, Scalar, SourceConfig } from "../types";

/** Ressource d'un canal : URL complète (le fragment « #… » porte la ressource quand le protocole n'a pas d'URL par ressource). */
export interface ChannelEntity { url: string; key?: string; watermark?: string; columns?: ColumnInfo[]; fields?: string[] }
export interface Page { rows: Row[]; next: number | null; columns?: ColumnInfo[] }
export interface Raw { status: number; headers: Headers; text: string; bytes: Uint8Array }

/** Taille de page plafond, côté Aura, pour tous les canaux (budget de la source). */
export const CHANNEL_MAX_PAGE = 1000;

const TYPE_OF: Record<string, string> = { integer: "number", decimal: "number", long: "number", int: "number", double: "number", float: "number", boolean: "boolean" };
export function coerce(value: unknown, type?: string): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return value;
  const t = TYPE_OF[String(type ?? "").toLowerCase().replace(/^(xsd:|edm\.)/, "")] ?? (/^(int|bigint|double|decimal|number|int64|int32|p|i|f)$/i.test(String(type)) ? "number" : /^bool/i.test(String(type)) ? "boolean" : "string");
  if (value === "" && t !== "string") return null;
  if (t === "number") return Number.isNaN(Number(value)) ? value : Number(value);
  if (t === "boolean") return value === "true" || value === "1" || value === "X";
  return value;
}
const unxml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
/** Lignes XML typées (xsi:type / xsi:nil) ; types absents : valeurs texte, ou types déclarés (XSD). */
export function xmlRecords(xml: string, tag: string, declared: Record<string, string> = {}): Row[] {
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${tag}>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "g"))].map(m => {
    const row: Row = {};
    for (const f of m[1].matchAll(/<(?:\w+:)?([A-Za-z_][\w.-]*)((?:\s+[\w:]+="[^"]*")*)\s*(?:\/>|>([\s\S]*?)<\/(?:\w+:)?\1>)/g)) {
      const attrs = f[2] ?? "", nil = /xsi:nil="true"/.test(attrs), t = /xsi:type="(?:\w+:)?(\w+)"/.exec(attrs)?.[1] ?? declared[f[1]];
      row[f[1]] = nil ? null : coerce(unxml(f[3] ?? ""), t);
    }
    return row;
  });
}
/** CSV RFC 4180 (guillemets, séparateurs dans les champs). Les valeurs restent du texte (le CSV n'a pas de types). */
export function parseCsv(text: string, sep = ","): Row[] {
  const out: string[][] = []; let row: string[] = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === sep) { row.push(cell); cell = ""; } else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); out.push(row); row = []; cell = ""; } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  const [head, ...body] = out.filter(r => r.length > 1 || r[0] !== "");
  return body.map(r => Object.fromEntries((head ?? []).map((h, i) => [h, r[i] ?? ""])));
}

export abstract class ChannelConnector extends BaseConnector {
  abstract override readonly kind: ConnectorKind;
  readonly pushdown: Pushdown = { filter: false, select: false, aggregate: false, limit: true, columnExpr: false };
  private discovered: Record<string, ChannelEntity> | null = null;
  constructor(config: SourceConfig, deps: ConnectorDeps) { super(config, deps); }

  protected headers(): Record<string, string> {
    const p = this.p, h: Record<string, string> = { Accept: "application/json", ...(p.headers ?? {}) };
    if (p.bearer) h.Authorization = `Bearer ${p.bearer}`;
    if (p.user && p.password) h.Authorization = `Basic ${btoa(`${p.user}:${p.password}`)}`;
    if (p.apiKey) h["X-API-Key"] = String(p.apiKey);
    return h;
  }
  protected size(requested?: number) { return Math.min(CHANNEL_MAX_PAGE, this.governor.rowsPerCall(requested)); }
  protected base(path = "") { return `${String(this.p.baseUrl ?? "").replace(/\/$/, "")}${path}`; }

  /** Appel HTTP brut sous budget (statut, en-têtes, texte et octets). 204 accepté. */
  protected async raw(url: string, init: RequestInit & { kind?: CallKind; rows?: (r: Raw) => number } = {}): Promise<Raw> {
    const f = this.deps.fetch ?? fetch;
    const { kind = "light", rows, ...req } = init;
    const body = typeof req.body === "string" ? req.body : req.body instanceof Uint8Array ? Array.from(req.body.slice(0, 64)).join(",") : "";
    return this.governor.call(`${req.method ?? "GET"} ${url} ${body}`, kind, async () => {
      this.calls++;
      const r = await f(url, req);
      if (!r.ok && r.status !== 204) throw new HttpStatusError(r.status, `${new URL(url).pathname} → ${r.status}`, parseRetryAfter(r.headers.get("retry-after")));
      const bytes = new Uint8Array(await r.arrayBuffer());
      return { status: r.status, headers: r.headers, text: new TextDecoder().decode(bytes), bytes };
    }, rows);
  }
  protected async getJson<T = any>(url: string, init: RequestInit & { kind?: CallKind; count?: (j: T) => number } = {}): Promise<T> {
    const { count, ...rest } = init;
    const r = await this.raw(url, { ...rest, headers: { ...this.headers(), ...(rest.headers as Record<string, string> ?? {}) }, rows: count ? x => { try { return count(JSON.parse(x.text)); } catch { return 0; } } : undefined });
    return (r.text ? JSON.parse(r.text) : null) as T;
  }

  /** Ressources déclarées (params.entities), sinon découvertes auprès de la source. */
  async entities(): Promise<Record<string, ChannelEntity>> {
    const declared = this.config.params.entities as Record<string, ChannelEntity> | undefined;
    if (declared && Object.keys(declared).length) return declared;
    this.discovered ??= await this.discover();
    return this.discovered;
  }
  protected async discover(): Promise<Record<string, ChannelEntity>> { throw new Error(`${this.kind} : déclarer les ressources (params.entities) — la source n'offre pas de découverte.`); }
  protected async ent(name: string): Promise<ChannelEntity> {
    const e = (await this.entities())[name];
    if (!e) throw new Error(`Ressource inconnue : ${name}`);
    return e;
  }
  protected abstract fetchPage(e: ChannelEntity, name: string, offset: number, size: number, opts: { kind: CallKind; spec?: QuerySpec }): Promise<Page>;

  async testConnection() { return this.timed(async () => { const names = Object.keys(await this.entities()); if (!names.length) throw new Error("Aucune ressource exposée."); await this.sample(names[0], 1); }); }
  async discoverSchema(): Promise<EntityInfo[]> {
    const out: EntityInfo[] = [];
    for (const [name, e] of Object.entries(await this.entities())) {
      let columns = e.columns;
      if (!columns?.length) { const p = await this.fetchPage(e, name, 0, 1, { kind: "light" }); columns = p.columns?.length ? p.columns : columnsOf(p.rows); }
      out.push({ name, key: e.key, watermark: e.watermark, columns });
    }
    return out;
  }
  async sample(entity: string, n = 20): Promise<Row[]> {
    const e = await this.ent(entity);
    return (await this.fetchPage(e, entity, 0, this.size(n), { kind: "light" })).rows.slice(0, n);
  }
  protected async *scan(spec: QuerySpec): AsyncIterable<Row[]> {
    const e = await this.ent(spec.entity), size = this.size();
    let offset = 0, read = 0;
    for (;;) {
      const p = await this.fetchPage(e, spec.entity, offset, size, { kind: this.kindFor(!spec.filters?.length, read), spec });
      read += p.rows.length;
      yield p.rows;
      if (p.next === null || !p.rows.length) return;
      offset = p.next;
    }
  }
  async *readIncremental(entity: string, watermarkField: string, since: string | null): AsyncIterable<IncrementalBatch> {
    let wm = since;
    for await (const rows of this.scan({ entity })) {
      const fresh = since ? rows.filter(r => (isoOf(r[watermarkField]) ?? "") > since) : rows;
      wm = maxWatermark(fresh, watermarkField, wm);
      yield { rows: fresh, watermark: wm };
    }
  }
}
const nextHeader = (r: Raw) => { const n = r.headers.get("x-next-offset"); return n === null || n === "" ? null : Number(n); };
const urlWith = (url: string, q: Record<string, string | number>) => { const u = new URL(url); for (const [k, x] of Object.entries(q)) u.searchParams.set(k, String(x)); return u.toString(); };
const lastName = (url: string) => decodeURIComponent(new URL(url).pathname.split("/").filter(Boolean).pop() ?? "");

// ── OData v4 ────────────────────────────────────────────────────────────────
function odata4Literal(v: Scalar): string { return v === null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`; }
export function odata4Filter(filters: Filter[] = []): string {
  return filters.filter(f => ["eq", "ne", "gt", "ge", "lt", "le"].includes(f.op)).map(f => `${f.field} ${f.op} ${odata4Literal(f.value as Scalar)}`).join(" and ");
}
export class OData4Connector extends ChannelConnector {
  readonly kind = "odata4" as const;
  override readonly pushdown = { filter: true, select: true, aggregate: false, limit: true, columnExpr: false };
  protected override async discover() {
    const svc = String(this.p.serviceUrl ?? this.p.baseUrl).replace(/\/$/, "");
    const doc = await this.getJson<{ value: { name: string; url: string }[] }>(`${svc}/`);
    const meta = (await this.raw(`${svc}/$metadata`, { headers: { ...this.headers(), Accept: "application/xml" } })).text;
    const { parseEdmx } = await import("./odata");
    const cols = parseEdmx(meta), keys = Object.fromEntries([...meta.matchAll(/<EntityType Name="(\w+)"><Key><PropertyRef Name="(\w+)"/g)].map(m => [m[1], m[2]]));
    const typeOf = Object.fromEntries([...meta.matchAll(/<EntitySet Name="(\w+)" EntityType="[\w.]*?(\w+)"/g)].map(m => [m[1], m[2]]));
    return Object.fromEntries(doc.value.map(s => [s.name, { url: `${svc}/${s.url}`, key: keys[typeOf[s.name]], columns: (cols[s.name] ?? []).map(c => ({ name: c.name, type: c.type })) }]));
  }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    const filter = odata4Filter(o.spec?.filters);
    const q: Record<string, string | number> = { $top: size, $skip: offset, ...(filter ? { $filter: filter } : {}) };
    const j = await this.getJson(urlWith(e.url, q), { kind: o.kind, count: (x: any) => x?.value?.length ?? 0 });
    return { rows: j.value ?? [], next: j["@odata.nextLink"] ? offset + (j.value?.length ?? 0) : null };
  }
}

// ── GraphQL (introspection → ressources = champs listes avec limit/offset) ──
interface GqlType { name: string; kind: string; ofType?: GqlType | null }
const unwrapT = (t: GqlType | null | undefined): GqlType | null => (!t ? null : t.kind === "NON_NULL" || t.kind === "LIST" ? unwrapT(t.ofType) : t);
const isList = (t: GqlType | null | undefined): boolean => !!t && (t.kind === "LIST" || (t.kind === "NON_NULL" && isList(t.ofType)));
export class GraphQLConnector extends ChannelConnector {
  readonly kind = "graphql" as const;
  private intro: Record<string, ChannelEntity> | null = null;
  private async introspected() { return (this.intro ??= await this.discover()); }
  private post(query: string, kind: CallKind = "light") { return this.getJson(String(this.p.url ?? this.base("/api/graphql")), { method: "POST", kind, body: JSON.stringify({ query }), headers: { "Content-Type": "application/json" } }); }
  protected override async discover() {
    const q = "{ __schema { queryType { name } types { name kind fields { name args { name } type { name kind ofType { name kind ofType { name kind ofType { name kind } } } } } } } }";
    const j = await this.post(q);
    if (j.errors?.length) throw new Error(j.errors[0].message);
    const types: Record<string, { name: string; kind: string; fields: { name: string; args: { name: string }[]; type: GqlType }[] | null }> = Object.fromEntries(j.data.__schema.types.map((t: any) => [t.name, t]));
    const roots = (this.p.roots as string[] | undefined) ?? null;
    const out: Record<string, ChannelEntity> = {};
    const scalarCols = (typeName: string) => (types[typeName]?.fields ?? []).filter(f => unwrapT(f.type)?.kind === "SCALAR").map(f => ({ name: f.name, type: unwrapT(f.type)!.name }));
    const url = String(this.p.url ?? this.base("/api/graphql"));
    const addLists = (prefix: string, typeName: string) => {
      for (const f of types[typeName]?.fields ?? []) {
        const t = unwrapT(f.type);
        if (isList(f.type) && t?.kind === "OBJECT" && f.args.some(a => a.name === "limit") && !t.name.startsWith("__")) out[prefix ? `${prefix}.${f.name}` : f.name] = { url: `${url}#${prefix ? `${prefix}.` : ""}${f.name}`, columns: scalarCols(t.name) };
      }
    };
    const query = j.data.__schema.queryType.name;
    addLists("", query);
    for (const f of types[query]?.fields ?? []) {
      const t = unwrapT(f.type);
      if (!isList(f.type) && t?.kind === "OBJECT" && !t.name.startsWith("__") && (!roots || roots.includes(f.name))) addLists(f.name, t.name);
    }
    return out;
  }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const path = new URL(e.url).hash.slice(1).split(".");
    if (!e.fields?.length && !e.columns?.length) e = { ...e, columns: (await this.introspected())[path.join(".")]?.columns };
    const cols = (e.fields ?? e.columns?.map(c => c.name) ?? []).join(" ");
    if (!cols) throw new Error("GraphQL : colonnes inconnues (découverte par introspection ou params.entities[].fields).");
    const leaf = path.pop()!;
    const body = `${leaf}(limit: ${size}, offset: ${offset}) { ${cols} }`;
    const j = await this.post(`{ ${path.reduceRight((inner, p) => `${p} { ${inner} }`, body)} }`, o.kind);
    if (j.errors?.length) throw new Error(j.errors.map((x: any) => x.message).join(" ; "));
    const rows: Row[] = [...path, leaf].reduce((x: any, k) => x?.[k], j.data) ?? [];
    return { rows, next: rows.length === size ? offset + size : null };
  }
}

// ── SOAP 1.1 (GetRecords, WSDL typé) ──────────────────────────────────────────
export class SoapConnector extends ChannelConnector {
  readonly kind = "soap" as const;
  protected override async discover() {
    const svc = String(this.p.serviceUrl);
    const wsdl = (await this.raw(urlWith(svc, { wsdl: "" }), { headers: { ...this.headers(), Accept: "text/xml" } })).text;
    const out: Record<string, ChannelEntity> = {};
    for (const m of wsdl.matchAll(/<xsd:complexType name="(\w+)"><xsd:sequence>([\s\S]*?)<\/xsd:sequence>/g)) {
      out[m[1]] = { url: `${svc}#${m[1]}`, columns: [...m[2].matchAll(/<xsd:element name="(\w+)" type="xsd:(\w+)"/g)].map(c => ({ name: c[1], type: c[2] })) };
    }
    return out;
  }
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    const u = new URL(e.url), resource = u.hash.slice(1) || u.searchParams.get("resource") || name; u.hash = "";
    const eq = o.spec?.filters?.find(f => f.op === "eq");
    const env = `<?xml version="1.0" encoding="UTF-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><GetRecords><resource>${resource}</resource><limit>${size}</limit><offset>${offset}</offset>${eq ? `<filterField>${eq.field}</filterField><filterValue>${String(eq.value)}</filterValue>` : ""}</GetRecords></soap:Body></soap:Envelope>`;
    const r = await this.raw(u.toString(), { method: "POST", kind: o.kind, body: env, headers: { ...this.headers(), "Content-Type": "text/xml; charset=utf-8", SOAPAction: "GetRecords", Accept: "text/xml" } });
    if (/<(?:\w+:)?Fault>/.test(r.text)) throw new Error(`SOAP Fault : ${/<faultstring>([^<]*)/.exec(r.text)?.[1] ?? ""}`);
    const tag = /<records><(\w+)>/.exec(r.text)?.[1] ?? name;
    const declared = Object.fromEntries((e.columns ?? []).map(c => [c.name, c.type]));
    const rows = xmlRecords(r.text.match(/<records>([\s\S]*)<\/records>/)?.[1] ?? "", tag, declared);
    const next = /nextOffset="(\d+)"/.exec(r.text)?.[1];
    return { rows, next: next ? Number(next) : null };
  }
}

// ── Salesforce : SOQL (REST query, nextRecordsUrl) et Bulk API 2.0 ────────────
const SF_TYPES: Record<string, string> = { int: "integer", double: "decimal", currency: "decimal", percent: "decimal", boolean: "boolean", date: "date", datetime: "datetime" };
export class SalesforceConnector extends ChannelConnector {
  readonly kind = "salesforce" as const;
  override readonly pushdown = { filter: true, select: true, aggregate: false, limit: true, columnExpr: false };
  private token: string | null = null;
  private get version() { return String(this.p.version ?? "v60.0"); }
  protected override headers() {
    const h = super.headers();
    if (this.token) h.Authorization = `Bearer ${this.token}`;
    return h;
  }
  /** Jeton : Bearer fourni, ou OAuth 2.0 client credentials (application connectée). */
  private async auth() {
    if (this.token || this.p.bearer) return;
    if (!this.p.clientId) return;
    const r = await this.raw(String(this.p.tokenUrl ?? this.base("/services/oauth2/token")), { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: new URLSearchParams({ grant_type: "client_credentials", client_id: String(this.p.clientId), client_secret: String(this.p.clientSecret ?? "") }).toString() });
    const j = JSON.parse(r.text);
    this.token = j.access_token;
  }
  protected override async discover() {
    await this.auth();
    const all = await this.getJson<{ sobjects: { name: string; queryable: boolean; custom: boolean }[] }>(this.base(`/services/data/${this.version}/sobjects`));
    const only = this.p.objects as string[] | undefined;
    const out: Record<string, ChannelEntity> = {};
    for (const o of all.sobjects.filter(x => x.queryable && (!only || only.includes(x.name)))) {
      const d = await this.getJson<{ fields: { name: string; type: string; externalId?: boolean }[] }>(this.base(`/services/data/${this.version}/sobjects/${o.name}/describe`));
      out[o.name] = { url: this.base(`/services/data/${this.version}/sobjects/${o.name}`), key: d.fields.find(f => f.externalId)?.name, columns: d.fields.filter(f => f.name !== "Id").map(f => ({ name: f.name, type: SF_TYPES[f.type] ?? "string" })) };
    }
    return out;
  }
  /** Champs d'une ressource déclarée sans colonnes : lus par describe. */
  private async withColumns(e: ChannelEntity, name: string): Promise<ChannelEntity> {
    if (e.columns?.length) return e;
    const d = await this.getJson<{ fields: { name: string; type: string; externalId?: boolean }[] }>(this.base(`/services/data/${this.version}/sobjects/${name}/describe`));
    return { ...e, key: e.key ?? d.fields.find(f => f.externalId)?.name, columns: d.fields.filter(f => f.name !== "Id").map(f => ({ name: f.name, type: SF_TYPES[f.type] ?? "string" })) };
  }
  private soql(e: ChannelEntity, name: string, spec?: QuerySpec) {
    const cols = (e.columns ?? []).map(c => c.name);
    if (!cols.length) throw new Error("Salesforce : champs inconnus (describe).");
    const lit = (v: Scalar) => (v === null ? "null" : typeof v === "number" || typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`);
    const ops: Record<string, string> = { eq: "=", ne: "!=", gt: ">", ge: ">=", lt: "<", le: "<=" };
    const where = (spec?.filters ?? []).filter(f => ops[f.op] || f.op === "in").map(f => (f.op === "in" ? `${f.field} IN (${(f.value as Scalar[]).map(lit).join(", ")})` : `${f.field} ${ops[f.op]} ${lit(f.value as Scalar)}`));
    return `SELECT ${cols.join(", ")} FROM ${name}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}`;
  }
  private strip = (r: Row) => { const { attributes: _a, Id: _i, ...rest } = r as Row & { attributes?: unknown; Id?: unknown }; void _a; void _i; return rest; };
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    await this.auth();
    e = await this.withColumns(e, name);
    const j = await this.getJson(this.base(`/services/data/${this.version}/query?q=${encodeURIComponent(`${this.soql(e, name, o.spec)} LIMIT ${size} OFFSET ${offset}`)}`), { kind: o.kind, count: (x: any) => x?.records?.length ?? 0 });
    return { rows: j.records.map(this.strip), next: j.records.length === size ? offset + size : null };
  }
  /** Parcours complet : curseur nextRecordsUrl (REST) ou, si params.bulk, job Bulk API 2.0 en CSV. */
  protected override async *scan(spec: QuerySpec): AsyncIterable<Row[]> {
    await this.auth();
    const e = await this.withColumns(await this.ent(spec.entity), spec.entity), soql = this.soql(e, spec.entity, spec);
    let read = 0;
    if (this.p.bulk) {
      const job = await this.getJson(this.base(`/services/data/${this.version}/jobs/query`), { method: "POST", body: JSON.stringify({ operation: "query", query: soql }), headers: { "Content-Type": "application/json" } });
      for (let i = 0; i < 20; i++) { const st = await this.getJson(this.base(`/services/data/${this.version}/jobs/query/${job.id}`)); if (st.state === "JobComplete") break; if (st.state === "Failed" || st.state === "Aborted") throw new Error(`Bulk API : job ${st.state}`); await new Promise(r => setTimeout(r, 1000)); }
      const types = Object.fromEntries((e.columns ?? []).map(c => [c.name, c.type]));
      let locator = "";
      for (;;) {
        const r = await this.raw(this.base(`/services/data/${this.version}/jobs/query/${job.id}/results?maxRecords=${this.size()}${locator ? `&locator=${locator}` : ""}`), { headers: { ...this.headers(), Accept: "text/csv" }, kind: this.kindFor(!spec.filters?.length, read) });
        const rows = parseCsv(r.text).map(x => Object.fromEntries(Object.entries(x).map(([k, val]) => [k, coerce(val, types[k])])));
        read += rows.length;
        yield rows;
        locator = r.headers.get("sforce-locator") ?? "null";
        if (locator === "null" || !rows.length) return;
      }
    }
    let url: string | null = this.base(`/services/data/${this.version}/query?q=${encodeURIComponent(soql)}`);
    while (url) {
      const j: any = await this.getJson(url, { kind: this.kindFor(!spec.filters?.length, read), count: (x: any) => x?.records?.length ?? 0 });
      read += j.records.length;
      yield j.records.map(this.strip);
      url = j.done ? null : this.base(j.nextRecordsUrl);
    }
  }
}

// ── AMQP : API HTTP de management RabbitMQ ─────────────────────────────────────
export class AmqpConnector extends ChannelConnector {
  readonly kind = "amqp" as const;
  protected override async discover() {
    const qs = await this.getJson<{ name: string; vhost: string }[]>(this.base("/api/queues"));
    return Object.fromEntries(qs.map(q => [q.name, { url: this.base(`/api/queues/${encodeURIComponent(q.vhost)}/${encodeURIComponent(q.name)}`) }]));
  }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const msgs = await this.getJson<any[]>(`${e.url}/get`, { method: "POST", kind: o.kind, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ count: size, ackmode: "ack_requeue_true", encoding: "auto", truncate: 50_000_000, offset }), count: x => x.length });
    // Sans « x-offset » renvoyé, la file ne gère pas la position : une seule lecture (évite de relire les mêmes messages).
    const positional = msgs.length > 0 && msgs[0].properties?.headers?.["x-offset"] === offset;
    const rows = msgs.map(m => { try { return JSON.parse(m.payload); } catch { return { payload: m.payload }; } });
    return { rows, next: positional && msgs.at(-1).message_count > 0 ? offset + msgs.length : null };
  }
}

// ── IBM MQ : API REST messaging (un message par appel, lecture non destructive) ─
export class MqConnector extends ChannelConnector {
  readonly kind = "mq" as const;
  /** Plafond de messages par parcours : MQ sert un message par appel, réservé au fil de l'eau. */
  private get maxMessages() { return Number(this.p.maxMessages ?? 200); }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const rows: Row[] = [];
    let pos = offset;
    while (rows.length < size && pos < this.maxMessages) {
      const r = await this.raw(urlWith(e.url, { offset: pos }), { kind: o.kind, headers: { ...this.headers(), "ibm-mq-rest-csrf-token": "aura" } });
      if (r.status === 204) return { rows, next: null };
      try { rows.push(JSON.parse(r.text)); } catch { rows.push({ body: r.text }); }
      pos++;
      if (r.headers.get("x-lucie-next-offset") === "") return { rows, next: null };
    }
    return { rows, next: pos < this.maxMessages ? pos : null };
  }
}

// ── CloudEvents (lot structuré) ────────────────────────────────────────────────
export class CloudEventsConnector extends ChannelConnector {
  readonly kind = "cloudevents" as const;
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const r = await this.raw(urlWith(e.url, { offset, limit: size }), { kind: o.kind, headers: { ...this.headers(), Accept: "application/cloudevents-batch+json" }, rows: x => (x.text.match(/"specversion"/g) ?? []).length });
    const evs: any[] = JSON.parse(r.text);
    for (const ev of evs) if (ev.specversion !== "1.0") throw new Error(`CloudEvents : specversion ${ev.specversion} non pris en charge`);
    const next = nextHeader(r), end = Number(r.headers.get("x-end-offset") ?? NaN);
    return { rows: evs.map(ev => (ev.data && typeof ev.data === "object" ? ev.data : { data: ev.data })), next: next !== null && (Number.isNaN(end) || next < end) && evs.length ? next : null };
  }
}

// ── CDC de type Debezium : rejeu des évènements (r, c, u, d) ────────────────────
export class CdcConnector extends ChannelConnector {
  readonly kind = "cdc" as const;
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const j = await this.getJson(urlWith(e.url, { offset, limit: size }), { kind: o.kind, count: (x: any) => x?.messages?.length ?? 0 });
    return { rows: j.messages.map((m: any) => ({ _op: m.value.op, _lsn: m.value.source?.lsn ?? m.offset, _ts: m.value.ts_ms, ...(m.value.after ?? m.value.before) })), next: j.hasMore ? j.nextOffset : null };
  }
  /** État courant = rejeu du flux : r/c ajoutent, u remplace l'état « before », d le retire. */
  static replay(events: { op: string; before: Row | null; after: Row | null }[]): Row[] {
    const rows: (Row | null)[] = [], same = (a: Row | null, b: Row | null) => JSON.stringify(a) === JSON.stringify(b);
    for (const ev of events) {
      if (ev.op === "r" || ev.op === "c") rows.push(ev.after);
      else { let i = rows.length - 1; while (i >= 0 && !same(rows[i], ev.before)) i--; if (i < 0) throw new Error("CDC : évènement sans état précédent"); rows[i] = ev.op === "d" ? null : ev.after; }
    }
    return rows.filter((r): r is Row => r !== null);
  }
  protected override async *scan(spec: QuerySpec): AsyncIterable<Row[]> {
    const e = await this.ent(spec.entity), events: { op: string; before: Row | null; after: Row | null }[] = [];
    let offset = 0;
    for (;;) {
      const j = await this.getJson(urlWith(e.url, { offset, limit: this.size() }), { count: (x: any) => x?.messages?.length ?? 0 });
      for (const m of j.messages) events.push({ op: m.value.op, before: m.value.before, after: m.value.after });
      if (!j.hasMore || !j.messages.length) break;
      offset = j.nextOffset;
    }
    yield CdcConnector.replay(events);
  }
  /** Incrémental par position (lsn) : seuls les évènements après la dernière position lue. */
  override async *readIncremental(entity: string, _w: string, since: string | null): AsyncIterable<IncrementalBatch> {
    const e = await this.ent(entity);
    let offset = since ? Number(since) + 1 : 0;
    for (;;) {
      const j = await this.getJson(urlWith(e.url, { offset, limit: this.size() }), { count: (x: any) => x?.messages?.length ?? 0 });
      if (!j.messages.length) return;
      yield { rows: j.messages.map((m: any) => ({ _op: m.value.op, ...(m.value.after ?? m.value.before) })), watermark: String(j.nextOffset - 1) };
      if (!j.hasMore) return;
      offset = j.nextOffset;
    }
  }
}

// ── Dépôt SFTP (listing, téléchargement ; CSV, JSON, XML, Parquet) ──────────────
export class SftpConnector extends ChannelConnector {
  readonly kind = "sftp" as const;
  private files = new Map<string, Row[]>();
  constructor(config: SourceConfig, deps: ConnectorDeps, private duckdb?: SqlDriverFactory) { super(config, deps); }
  private get format() { return String(this.p.format ?? "json"); }
  protected override async discover() {
    const root = String(this.p.root ?? "/outbound"), out: Record<string, ChannelEntity> = {};
    const dirs = await this.getJson<{ entries: { name: string; type: string }[] }>(this.base(`/sftp/ls?path=${encodeURIComponent(root)}`));
    for (const d of dirs.entries.filter(x => x.type === "d")) {
      const ls = await this.getJson<{ entries: { name: string; type: string }[] }>(this.base(`/sftp/ls?path=${encodeURIComponent(`${root}/${d.name}`)}`));
      for (const f of ls.entries.filter(x => x.type === "-" && x.name.endsWith(`.${this.format}`))) out[`${d.name}/${f.name.replace(/\.\w+$/, "")}`] = { url: this.base(`/sftp/get?path=${encodeURIComponent(`${root}/${d.name}/${f.name}`)}`) };
    }
    return out;
  }
  private async load(e: ChannelEntity, kind: CallKind): Promise<Row[]> {
    if (this.files.has(e.url)) return this.files.get(e.url)!;
    const path = new URL(e.url).searchParams.get("path") ?? e.url, fmt = path.split(".").pop()!.toLowerCase();
    const r = await this.raw(e.url, { kind, headers: this.headers() });
    let rows: Row[];
    if (fmt === "json") rows = JSON.parse(r.text);
    else if (fmt === "csv") rows = parseCsv(r.text);
    else if (fmt === "xml") { const tag = /<(\w+)><\w+ xsi:/.exec(r.text)?.[1]; rows = tag ? xmlRecords(r.text, tag) : []; }
    else if (fmt === "parquet") {
      if (!this.duckdb) throw new Error("Parquet : lecteur DuckDB indisponible dans ce contexte (serveur uniquement).");
      const { writeFile, rm } = await import(/* @vite-ignore */ "node:fs/promises"), { tmpdir } = await import(/* @vite-ignore */ "node:os");
      const file = `${tmpdir()}/aura-sftp-${Date.now()}-${Math.random().toString(36).slice(2)}.parquet`;
      await writeFile(file, r.bytes);
      const db = await this.duckdb({ database: ":memory:" });
      try {
        // Types lus dans le schéma Parquet : les entiers 64 bits arrivent en texte (JSON), ramenés en nombres.
        const src = `read_parquet('${file.replace(/'/g, "''")}')`;
        const types = Object.fromEntries((await db.query(`DESCRIBE SELECT * FROM ${src}`)).map(d => [String(d.column_name), String(d.column_type)]));
        rows = (await db.query(`SELECT * FROM ${src}`)).map(x => Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "bigint" || (typeof v === "string" && /INT|DOUBLE|DECIMAL|FLOAT/.test(types[k] ?? "")) ? Number(v) : v])));
      }
      finally { await db.close(); await rm(file, { force: true }); }
    } else throw new Error(`Format de fichier non pris en charge : ${fmt}`);
    this.files.set(e.url, rows);
    return rows;
  }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const all = await this.load(e, o.kind);
    return { rows: all.slice(offset, offset + size), next: offset + size < all.length ? offset + size : null };
  }
  override async close() { this.files.clear(); await super.close(); }
}

// ── SQL sur HTTP (JDBC-like, lecture seule) : filtre et GROUP BY poussés ────────
const ident = (s: string) => { if (!/^[A-Za-z_][\w.]*$/.test(s)) throw new Error(`Identifiant refusé : ${s}`); return s; };
const sqlLit = (v: Scalar) => (v === null ? "NULL" : typeof v === "number" ? String(v) : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : `'${String(v).replace(/'/g, "''")}'`);
export function compileHttpSql(table: string, spec: QuerySpec, offset = 0, limit = CHANNEL_MAX_PAGE): string {
  const ops: Record<string, string> = { eq: "=", ne: "<>", gt: ">", ge: ">=", lt: "<", le: "<=" };
  const where = (spec.filters ?? []).map(f => (f.op === "in" ? `${ident(f.field)} IN (${(f.value as Scalar[]).map(sqlLit).join(", ")})` : f.value === null && (f.op === "eq" || f.op === "ne") ? `${ident(f.field)} IS ${f.op === "ne" ? "NOT " : ""}NULL` : `${ident(f.field)} ${ops[f.op]} ${sqlLit(f.value as Scalar)}`));
  const agg = !!(spec.groupBy?.length || spec.metrics?.length);
  const m = (x: Metric) => `${x.fn.toUpperCase()}(${x.field ? ident(x.field) : "*"}) AS ${ident(x.as)}`;
  const cols = agg ? [...(spec.groupBy ?? []).map(ident), ...(spec.metrics ?? []).map(m)] : spec.select?.length ? spec.select.map(ident) : ["*"];
  return `SELECT ${cols.join(", ")} FROM ${ident(table)}${where.length ? ` WHERE ${where.join(" AND ")}` : ""}${agg && spec.groupBy?.length ? ` GROUP BY ${spec.groupBy.map(ident).join(", ")}` : ""} LIMIT ${limit} OFFSET ${offset}`;
}
export class SqlHttpConnector extends ChannelConnector {
  readonly kind = "sqlhttp" as const;
  override readonly pushdown = { filter: true, select: true, aggregate: true, limit: true, columnExpr: false };
  private get endpoint() { return String(this.p.sqlUrl ?? this.base("/sql")); }
  protected override async discover() {
    const j = await this.getJson<{ tables: { name: string; columns: { name: string; type: string }[] }[] }>(urlWith(this.endpoint, { tables: "" }));
    return Object.fromEntries(j.tables.map(t => [t.name, { url: `${this.endpoint}#${t.name}`, columns: t.columns.map(c => ({ name: c.name, type: c.type })) }]));
  }
  private table(e: ChannelEntity, name: string) { return new URL(e.url).hash.slice(1) || name; }
  private run(sql: string, kind: CallKind = "light") { return this.getJson(this.endpoint, { method: "POST", kind, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sql }), count: (x: any) => x?.rows?.length ?? 0 }); }
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    const pushable = (o.spec?.filters ?? []).filter(f => f.op !== "in" || Array.isArray(f.value));
    const j = await this.run(compileHttpSql(this.table(e, name), { entity: name, filters: pushable }, offset, size), o.kind);
    return { rows: j.rows, next: j.nextOffset ?? null, columns: j.columns };
  }
  /** Agrégats sum/count/min/max/avg poussés à la source (une requête, paginée par 1 000 groupes). */
  override async query(spec: QuerySpec): Promise<QueryResult> {
    const agg = spec.groupBy?.length || spec.metrics?.length;
    if (!agg || spec.where?.length || spec.metrics?.some(m => m.fn === "count_distinct")) return super.query(spec);
    const e = await this.ent(spec.entity), before = this.calls, rows: Row[] = [];
    for (let off = 0; ;) { const j = await this.run(compileHttpSql(this.table(e, spec.entity), spec, off)); rows.push(...j.rows); if (j.nextOffset == null) break; off = j.nextOffset; }
    return { rows: spec.limit ? rows.slice(0, spec.limit) : rows, rowsRead: rows.length, calls: this.calls - before, pushedDown: { filter: true, aggregate: true } };
  }
}

// ── gRPC-web (protobuf écrit à la main, service lucie.v1.RowService) ─────────────
function varint(n: number): number[] { const out: number[] = []; while (n > 127) { out.push((n & 127) | 128); n = Math.floor(n / 128); } out.push(n); return out; }
const pbStr = (no: number, s: string) => { const b = new TextEncoder().encode(s); return [...varint((no << 3) | 2), ...varint(b.length), ...b]; };
function readVarint(b: Uint8Array, p: number): [number, number] { let n = 0, mul = 1, x; do { x = b[p++]; n += (x & 127) * mul; mul *= 128; } while (x & 128); return [n, p]; }
export function pbDecode(b: Uint8Array): { no: number; value?: number; bytes?: Uint8Array }[] {
  const out: { no: number; value?: number; bytes?: Uint8Array }[] = []; let p = 0;
  while (p < b.length) { let tag; [tag, p] = readVarint(b, p); const no = tag >> 3, wt = tag & 7; if (wt === 0) { let v; [v, p] = readVarint(b, p); out.push({ no, value: v }); } else if (wt === 2) { let len; [len, p] = readVarint(b, p); out.push({ no, bytes: b.subarray(p, p + len) }); p += len; } else throw new Error(`protobuf : type de fil ${wt} non pris en charge`); }
  return out;
}
export function grpcWebRequest(source: string, resource: string, pageSize: number, pageToken: string): Uint8Array {
  const msg = [...pbStr(1, source), ...pbStr(2, resource), ...varint(3 << 3), ...varint(pageSize), ...(pageToken ? pbStr(4, pageToken) : [])];
  const out = new Uint8Array(5 + msg.length); new DataView(out.buffer).setUint32(1, msg.length); out.set(msg, 5); return out;
}
export function grpcWebResponse(b: Uint8Array): { rows: Row[]; next: string | null; total: number; columns: ColumnInfo[] } {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), td = new TextDecoder();
  let p = 0, msg: Uint8Array | null = null, trailer = "";
  while (p + 5 <= b.length) { const flag = b[p], len = dv.getUint32(p + 1); const body = b.subarray(p + 5, p + 5 + len); if (flag & 0x80) trailer += td.decode(body); else msg = body; p += 5 + len; }
  const status = /grpc-status:\s*(\d+)/.exec(trailer)?.[1];
  if (status && status !== "0") throw new Error(`gRPC : statut ${status} ${/grpc-message:\s*(.*)/.exec(trailer)?.[1] ?? ""}`);
  if (!msg) return { rows: [], next: null, total: 0, columns: [] };
  const f = pbDecode(msg);
  const columns = f.filter(x => x.no === 4).map(x => { const c = pbDecode(x.bytes!); return { name: td.decode(c[0].bytes), type: td.decode(c[1].bytes) }; });
  const types = Object.fromEntries(columns.map(c => [c.name, c.type]));
  const rows = f.filter(x => x.no === 1).map(x => {
    const row: Row = {};
    for (const e of pbDecode(x.bytes!)) { if (e.no === 1) { const kv = pbDecode(e.bytes!); const k = td.decode(kv[0].bytes); row[k] = coerce(kv[1] ? td.decode(kv[1].bytes) : "", types[k] === "date" || types[k] === "datetime" ? "string" : types[k]); } else if (e.no === 2) row[td.decode(e.bytes)] = null; }
    return columns.length ? Object.fromEntries(columns.map(c => [c.name, row[c.name] ?? null])) : row;
  });
  const next = f.find(x => x.no === 2);
  return { rows, next: next ? td.decode(next.bytes) : null, total: f.find(x => x.no === 3)?.value ?? rows.length, columns };
}
export class GrpcWebConnector extends ChannelConnector {
  readonly kind = "grpcweb" as const;
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const u = new URL(e.url), [source, resource] = (u.hash.slice(1) || name).split("/"); u.hash = "";
    const r = await this.raw(u.toString(), { method: "POST", kind: o.kind, body: grpcWebRequest(source, resource, size, offset ? String(offset) : "") as unknown as BodyInit, headers: { ...this.headers(), "Content-Type": "application/grpc-web+proto", Accept: "application/grpc-web+proto", "X-Grpc-Web": "1" } });
    const g = grpcWebResponse(r.bytes);
    return { rows: g.rows, next: g.next === null ? null : Number(g.next), columns: g.columns };
  }
}

// ── ESB / iPaaS (experience API : {data, meta.pagination}) ──────────────────────
export class EsbConnector extends ChannelConnector {
  readonly kind = "esb" as const;
  protected override async discover() {
    const j = await this.getJson<{ flows: { id: string; url: string }[] }>(this.base("/esb/api/v1"));
    return Object.fromEntries(j.flows.map(f => [f.id, { url: this.base(f.url) }]));
  }
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const j = await this.getJson(urlWith(e.url, { offset, limit: size }), { kind: o.kind, headers: { "X-Correlation-ID": `aura-${this.id}-${offset}` }, count: (x: any) => x?.data?.length ?? 0 });
    return { rows: j.data, next: j.meta?.pagination?.nextOffset ?? null };
  }
}

// ── Documents : IDoc, EDIFACT, X12, AS2 (texte → lignes ; X-Next-Offset) ────────
abstract class DocumentConnector extends ChannelConnector {
  protected abstract parse(text: string): { rows: Row[] };
  protected accept = "*/*";
  protected async check(_r: Raw): Promise<void> {}
  protected async fetchPage(e: ChannelEntity, _n: string, offset: number, size: number, o: { kind: CallKind }): Promise<Page> {
    const r = await this.raw(urlWith(e.url, { offset, limit: size }), { kind: o.kind, headers: { ...this.headers(), Accept: this.accept }, rows: x => Number(x.headers.get("x-document-count") ?? 0) });
    await this.check(r);
    return { rows: this.parse(r.text).rows, next: nextHeader(r) };
  }
  protected override async discover(): Promise<Record<string, ChannelEntity>> {
    const types = (this.p.documents as string[] | undefined) ?? [];
    if (!types.length) throw new Error(`${this.kind} : déclarer les documents (params.documents ou params.entities).`);
    return Object.fromEntries(types.map(t => [t, { url: this.base(`${this.docPath()}/${t}`) }]));
  }
  protected abstract docPath(): string;
}
export class IdocConnector extends DocumentConnector {
  readonly kind = "idoc" as const;
  protected override accept = "application/xml";
  protected parse(t: string) { return idocRows(t); }
  protected docPath() { return "/sap/idoc"; }
}
export class EdifactConnector extends DocumentConnector {
  readonly kind = "edifact" as const;
  protected override accept = "application/EDIFACT";
  protected parse(t: string) { return edifactRows(t); }
  protected docPath() { return "/edi/edifact"; }
}
export class X12Connector extends DocumentConnector {
  readonly kind = "x12" as const;
  protected override accept = "application/EDI-X12";
  protected parse(t: string) { return x12Rows(t); }
  protected docPath() { return "/edi/x12"; }
}
/** AS2 : message sortant du partenaire ; le MIC (SHA-256) est vérifié avant analyse EDIFACT ou X12. */
export class As2Connector extends DocumentConnector {
  readonly kind = "as2" as const;
  protected parse(t: string) { return t.startsWith("ISA") ? x12Rows(t) : edifactRows(t); }
  protected docPath() { return "/as2/message"; }
  protected override async check(r: Raw) {
    const announced = r.headers.get("x-lucie-content-mic") ?? r.headers.get("content-mic");
    if (announced && announced !== (await as2Mic(r.text))) throw new Error("AS2 : MIC invalide, message altéré.");
    if (!r.headers.get("as2-from")) throw new Error("AS2 : en-tête AS2-From absent.");
  }
  protected override async discover() {
    const j = await this.getJson<{ messages: { id: string }[] }>(this.base("/as2/outbox"));
    return Object.fromEntries(j.messages.map(m => [m.id, { url: this.base(`/as2/message/${m.id}`) }]));
  }
}

// ── SAP RFC / BAPI (JSON-RPC) : RFC_READ_TABLE ──────────────────────────────────
export class RfcConnector extends ChannelConnector {
  readonly kind = "rfc" as const;
  override readonly pushdown = { filter: true, select: true, aggregate: false, limit: true, columnExpr: false };
  private get endpoint() { return String(this.p.rfcUrl ?? this.base("/sap/bc/rfc")); }
  async call(method: string, params: Record<string, unknown>, kind: CallKind = "light") {
    const j = await this.getJson(this.endpoint, { method: "POST", kind, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }), count: (x: any) => x?.result?.DATA?.length ?? 0 });
    if (j.error) throw new Error(`RFC ${method} : ${j.error.data?.exception ?? ""} ${j.error.message}`.trim());
    return j.result;
  }
  protected override async discover() {
    const tables = (this.p.tables as string[] | undefined) ?? [];
    if (!tables.length) throw new Error("RFC : déclarer les tables (params.tables, ex. LFA1, EKPO).");
    return Object.fromEntries(tables.map(t => [t, { url: `${this.endpoint}#${t}` }]));
  }
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    const table = new URL(e.url).hash.slice(1) || name, ops: Record<string, string> = { eq: "=", ne: "<>", gt: ">", ge: ">=", lt: "<", le: "<=" };
    const OPTIONS = (o.spec?.filters ?? []).filter(f => ops[f.op] && f.value !== null).map((f, i) => ({ TEXT: `${i ? "AND " : ""}${ident(f.field)} ${ops[f.op]} ${typeof f.value === "number" ? f.value : `'${String(f.value).replace(/'/g, "''")}'`}` }));
    const r = await this.call("RFC_READ_TABLE", { QUERY_TABLE: table, DELIMITER: "|", OPTIONS, ROWSKIPS: offset, ROWCOUNT: size, ...(e.fields ? { FIELDS: e.fields.map(f => ({ FIELDNAME: f })) } : {}) }, o.kind);
    const fields: { FIELDNAME: string; TYPE: string }[] = r.FIELDS;
    const rows = (r.DATA as { WA: string }[]).map(d => { const parts = d.WA.split("|"); return Object.fromEntries(fields.map((f, i) => [f.FIELDNAME, parts[i] === "" ? null : coerce(parts[i], f.TYPE === "I" || f.TYPE === "P" ? "number" : "string")])); });
    const total = r.X_TOTAL as number | undefined;
    return { rows, next: total !== undefined ? (offset + rows.length < total ? offset + rows.length : null) : rows.length === size ? offset + size : null, columns: fields.map(f => ({ name: f.FIELDNAME, type: f.TYPE === "I" ? "integer" : f.TYPE === "P" ? "decimal" : f.TYPE === "D" ? "date" : "string" })) };
  }
}
