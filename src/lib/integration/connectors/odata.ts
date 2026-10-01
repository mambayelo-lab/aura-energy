// SAP OData v2 : $filter, $select, $top, pagination (__next / $skip), delta
// (!deltatoken quand le service est delta-enabled, sinon filtre sur le watermark).
// OData v2 n'agrège pas ($apply est v4) : l'agrégation est faite en flux, sans stockage.
import { BaseConnector, columnsOf, isoOf, maxWatermark } from "./base";
import type { EntityInfo, Filter, IncrementalBatch, QuerySpec, Row, Scalar } from "../types";

export interface ODataEntityTemplate {
  entitySet: string;
  servicePath: string;
  table: string;
  key: string;
  watermark?: string;
  delta?: boolean;
  objectClass: "master" | "stock" | "shipment" | "order";
  fields: string[];
  note?: string;
}

/** Modèles prêts à l'emploi (API SAP S/4HANA publiées). */
export const SAP_TEMPLATES: Record<string, ODataEntityTemplate> = {
  A_Supplier: {
    entitySet: "A_Supplier", servicePath: "/sap/opu/odata/sap/API_BUSINESS_PARTNER", table: "LFA1", key: "Supplier",
    watermark: "LastChangeDateTime", objectClass: "master",
    fields: ["Supplier", "SupplierName", "Country", "TaxNumber1", "VATRegistration"],
    note: "Champ de changement (LastChangeDateTime) à vérifier avec la documentation client : selon la version, A_Supplier n'expose que CreationDate ; utiliser alors le delta CDS ou un rechargement de nuit.",
  },
  A_PurchaseOrder: {
    entitySet: "A_PurchaseOrder", servicePath: "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV", table: "EKKO", key: "PurchaseOrder",
    watermark: "LastChangeDateTime", objectClass: "order",
    fields: ["PurchaseOrder", "Supplier", "PurchaseOrderDate", "DocumentCurrency", "LastChangeDateTime"],
  },
  A_PurchaseOrderItem: {
    entitySet: "A_PurchaseOrderItem", servicePath: "/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV", table: "EKPO", key: "PurchaseOrder",
    watermark: "LastChangeDateTime", objectClass: "order",
    fields: ["PurchaseOrder", "PurchaseOrderItem", "Supplier", "Material", "OrderQuantity", "ScheduleLineDeliveryDate", "LastChangeDateTime"],
    note: "Sur S/4HANA, la date de modification est portée par l'en-tête A_PurchaseOrder : à vérifier avec la documentation client (jointure $expand ou lecture de l'en-tête).",
  },
  A_MatlStkInAcctMod: {
    entitySet: "A_MatlStkInAcctMod", servicePath: "/sap/opu/odata/sap/API_MATERIAL_STOCK_SRV", table: "MARD", key: "Material",
    objectClass: "stock",
    fields: ["Material", "Plant", "StorageLocation", "MatlWrhsStkQtyInMatlBaseUnit", "InventoryStockType"],
    note: "Pas de champ de modification : instantané complet, classé extraction lourde (heures creuses).",
  },
  A_Product: {
    entitySet: "A_Product", servicePath: "/sap/opu/odata/sap/API_PRODUCT_SRV", table: "MARA", key: "Product",
    watermark: "LastChangeDateTime", objectClass: "master",
    fields: ["Product", "ProductType", "ProductGroup", "BaseUnit", "LastChangeDateTime"],
  },
};

function literal(v: Scalar, field: string, watermark?: string): string {
  if (v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (field === watermark || /DateTime$/.test(field)) return `datetime'${String(isoOf(v)).replace(/\.\d{3}Z$|Z$/, "")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}
export function odataFilter(filters: Filter[] = [], watermark?: string): string {
  return filters.map(f => {
    if (f.op === "in") return `(${(f.value as Scalar[]).map(v => `${f.field} eq ${literal(v, f.field, watermark)}`).join(" or ")})`;
    return `${f.field} ${f.op} ${literal(f.value as Scalar, f.field, watermark)}`;
  }).join(" and ");
}

export class ODataConnector extends BaseConnector {
  readonly kind = "odata" as const;
  readonly pushdown = { filter: true, select: true, aggregate: false, limit: true, columnExpr: false };

  private tpl(entity: string): ODataEntityTemplate {
    const custom = (this.config.params.entities as Record<string, Partial<ODataEntityTemplate>> | undefined)?.[entity];
    const t = SAP_TEMPLATES[entity];
    if (!t && !custom) throw new Error(`Entité OData inconnue : ${entity}`);
    return { ...(t ?? {}), ...(custom ?? {}) } as ODataEntityTemplate;
  }
  private headers(): Record<string, string> {
    const h: Record<string, string> = { Accept: "application/json" };
    const p = this.p;
    if (p.user && p.password) h.Authorization = `Basic ${Buffer.from(`${p.user}:${p.password}`).toString("base64")}`;
    if (p.bearer) h.Authorization = `Bearer ${p.bearer}`;
    if (p.client) h["sap-client"] = String(p.client);
    return h;
  }
  private url(entity: string, q: Record<string, string>) {
    const t = this.tpl(entity);
    const base = String(this.p.baseUrl).replace(/\/$/, "");
    const qs = Object.entries({ $format: "json", ...q }).filter(([, v]) => v !== "").map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join("&");
    // Paramètres fixes du point d'accès déclaré (ex. size=scale pour la volumétrie Maison Lucie).
    const extra = (t as ODataEntityTemplate & { extraQuery?: string }).extraQuery;
    return `${base}${t.servicePath}/${t.entitySet}?${qs}${extra ? `&${extra}` : ""}`;
  }
  private abs(next: string) { return /^https?:/.test(next) ? next : `${String(this.p.baseUrl).replace(/\/$/, "")}${next.startsWith("/") ? "" : "/"}${next}`; }

  async testConnection() {
    return this.timed(async () => { await this.http(this.url(Object.keys(this.config.entities ?? SAP_TEMPLATES)[0], { $top: "1" }), { headers: this.headers() }); });
  }
  /** Schéma lu dans $metadata (EDMX) ; repli sur un échantillon si le service ne l'expose pas. */
  async discoverSchema(): Promise<EntityInfo[]> {
    const out: EntityInfo[] = [];
    const names = Object.keys((this.config.params.entities as object) ?? this.config.entities ?? {});
    const byService = new Map<string, Record<string, { name: string; type: string }[]>>();
    for (const name of names) {
      const t = this.tpl(name);
      if (!byService.has(t.servicePath)) {
        const xml = await this.http<string>(`${String(this.p.baseUrl).replace(/\/$/, "")}${t.servicePath}/$metadata`, { headers: { ...this.headers(), Accept: "application/xml" } }).catch(() => "");
        byService.set(t.servicePath, typeof xml === "string" ? parseEdmx(xml) : {});
      }
      const cols = byService.get(t.servicePath)![name];
      if (cols?.length) out.push({ name, key: t.key, watermark: t.watermark, columns: cols });
      else {
        const rows = await this.sample(name, 1).catch(() => []);
        out.push({ name, key: t.key, watermark: t.watermark, columns: rows.length ? columnsOf(rows) : (t.fields ?? []).map(f => ({ name: f, type: "string" })) });
      }
    }
    return out;
  }
  async sample(entity: string, n = 20): Promise<Row[]> {
    const j = await this.http(this.url(entity, { $top: String(Math.min(n, this.governor.rowsPerCall())) }), { headers: this.headers() });
    return j.d?.results ?? [];
  }

  protected async *pages(first: string, full: boolean): AsyncIterable<{ rows: Row[]; delta?: string }> {
    let url: string | undefined = first, read = 0;
    while (url) {
      const j: any = await this.http(url, { headers: this.headers(), kind: this.kindFor(full, read), rows: (x: any) => x?.d?.results?.length ?? 0 });
      const rows: Row[] = j.d?.results ?? [];
      read += rows.length;
      url = j.d?.__next ? this.abs(j.d.__next) : undefined;
      yield { rows, delta: j.d?.__delta };
    }
  }

  protected async *scan(spec: QuerySpec): AsyncIterable<Row[]> {
    const t = this.tpl(spec.entity);
    const cols = new Set<string>([...(spec.select ?? []), ...(spec.groupBy ?? []), ...(spec.metrics ?? []).map(m => m.field).filter(Boolean) as string[], ...(spec.filters ?? []).map(f => f.field), ...(spec.where ?? []).flatMap(e => (e.kind === "diff_lt" ? [e.a, e.b, e.c] : [e.actual, e.expected]))]);
    const q = { $filter: odataFilter(spec.filters, t.watermark), $select: cols.size ? [...cols].join(",") : "", $top: String(this.governor.rowsPerCall()) };
    for await (const p of this.pages(this.url(spec.entity, q), !spec.filters?.length)) yield p.rows;
  }

  async *readIncremental(entity: string, watermarkField: string, since: string | null, opts: { select?: string[]; pageSize?: number } = {}): AsyncIterable<IncrementalBatch> {
    const t = this.tpl(entity);
    const top = String(this.governor.rowsPerCall(opts.pageSize));
    const select = opts.select?.length ? [...new Set([...opts.select, watermarkField])].join(",") : "";
    // Delta SAP (!deltatoken) si le service le propose, sinon filtre sur le watermark.
    const q: Record<string, string> = since && t.delta ? { "!deltatoken": since, $select: select, $top: top }
      : { $filter: since ? odataFilter([{ field: watermarkField, op: "gt", value: since }], watermarkField) : "", $select: select, $top: top };
    let wm = since;
    for await (const p of this.pages(this.url(entity, q), !since)) {
      wm = maxWatermark(p.rows, watermarkField, wm);
      yield { rows: p.rows, watermark: wm };
    }
  }
}

/** EDMX (OData v2/v4) → colonnes par EntitySet. */
export function parseEdmx(xml: string): Record<string, { name: string; type: string }[]> {
  const types = new Map<string, { name: string; type: string }[]>();
  for (const m of xml.matchAll(/<EntityType\b[^>]*Name="([^"]+)"[^>]*>([\s\S]*?)<\/EntityType>/g)) {
    types.set(m[1], [...m[2].matchAll(/<Property\b[^>]*Name="([^"]+)"[^>]*Type="([^"]+)"/g)].map(p => ({ name: p[1], type: p[2].replace(/^Edm\./, "") })));
  }
  const out: Record<string, { name: string; type: string }[]> = {};
  for (const m of xml.matchAll(/<EntitySet\b[^>]*Name="([^"]+)"[^>]*EntityType="([^"]+)"/g)) out[m[1]] = types.get(m[2].split(".").pop()!) ?? [];
  return out;
}
