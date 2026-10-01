// Exécution locale d'une QuerySpec (filtre, expression, GROUP BY, métriques) —
// utilisée seulement quand la source ne sait pas agréger (OData v2, REST), et en
// flux : les lignes lues ne sont jamais conservées, seuls les agrégats le sont.
import type { ColumnExpr, Filter, Metric, QuerySpec, Row, Scalar } from "./types";

const num = (v: unknown) => (typeof v === "number" ? v : Number(v));
function cmp(a: unknown, b: unknown): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  const na = Number(a), nb = Number(b);
  if (a !== "" && b !== "" && Number.isFinite(na) && Number.isFinite(nb) && typeof a !== "string") return na - nb;
  return String(a).localeCompare(String(b));
}
export function matchFilter(row: Row, f: Filter): boolean {
  const v = row[f.field] as Scalar;
  switch (f.op) {
    case "eq": return v == f.value || String(v) === String(f.value);
    case "ne": return !(v == f.value || String(v) === String(f.value));
    case "in": return (f.value as Scalar[]).some(x => String(x) === String(v));
    case "gt": return v != null && cmp(v, f.value) > 0;
    case "ge": return v != null && cmp(v, f.value) >= 0;
    case "lt": return v != null && cmp(v, f.value) < 0;
    case "le": return v != null && cmp(v, f.value) <= 0;
  }
}
export const matchExpr = (row: Row, e: ColumnExpr) => {
  if (e.kind === "diff_lt") return num(row[e.a]) - num(row[e.b]) < num(row[e.c]);
  const a = row[e.actual], x = String(row[e.expected] ?? "");
  return a == null || a === "" ? x !== "" && x < e.asOf : String(a) > x;
};

type Acc = { key: Scalar[]; m: Record<string, { n: number; sum: number; min: number; max: number; set?: Set<unknown>; smin?: string; smax?: string }> };

export class StreamingAggregator {
  private groups = new Map<string, Acc>();
  rowsSeen = 0;
  constructor(private spec: QuerySpec) {}
  push(rows: Row[]) {
    const { filters = [], where = [], groupBy = [], metrics = [] } = this.spec;
    for (const r of rows) {
      if (!filters.every(f => matchFilter(r, f)) || !where.every(e => matchExpr(r, e))) continue;
      this.rowsSeen++;
      const key = groupBy.map(g => (r[g] ?? null) as Scalar);
      const k = JSON.stringify(key);
      let acc = this.groups.get(k);
      if (!acc) { acc = { key, m: {} }; this.groups.set(k, acc); }
      for (const m of metrics) {
        const a = (acc.m[m.as] ??= { n: 0, sum: 0, min: Infinity, max: -Infinity, set: m.fn === "count_distinct" ? new Set() : undefined });
        const v = m.field ? r[m.field] : 1;
        if (m.fn === "count" && m.field && (v == null || v === "")) continue;
        a.n++;
        if (a.set) a.set.add(v);
        const x = num(v);
        if (typeof v === "string" && !/^-?\d+(\.\d+)?$/.test(v)) { if (a.smin === undefined || v < a.smin) a.smin = v; if (a.smax === undefined || v > a.smax) a.smax = v; }
        else if (Number.isFinite(x)) { a.sum += x; a.min = Math.min(a.min, x); a.max = Math.max(a.max, x); }
      }
    }
  }
  result(): Row[] {
    const { groupBy = [], metrics = [], orderBy = [], limit } = this.spec;
    let out = [...this.groups.values()].map(acc => {
      const row: Row = Object.fromEntries(groupBy.map((g, i) => [g, acc.key[i]]));
      for (const m of metrics) row[m.as] = finalize(m, acc.m[m.as]);
      return row;
    });
    out = order(out, orderBy);
    return limit ? out.slice(0, limit) : out;
  }
}
function finalize(m: Metric, a?: Acc["m"][string]): number | string | null {
  if (!a) return m.fn === "count" || m.fn === "sum" || m.fn === "count_distinct" ? 0 : null;
  switch (m.fn) {
    case "count": return a.n;
    case "count_distinct": return a.set!.size;
    case "sum": return Math.round(a.sum * 1e6) / 1e6;
    case "avg": return a.n ? Math.round((a.sum / a.n) * 1e6) / 1e6 : null;
    case "min": return a.smin ?? (Number.isFinite(a.min) ? a.min : null);
    case "max": return a.smax ?? (Number.isFinite(a.max) ? a.max : null);
  }
}
function order(rows: Row[], orderBy: NonNullable<QuerySpec["orderBy"]>) {
  if (!orderBy.length) return rows;
  return rows.sort((x, y) => { for (const o of orderBy) { const c = cmp(x[o.field], y[o.field]); if (c) return o.desc ? -c : c; } return 0; });
}

/** Applique une requête complète sur des lignes en mémoire (petits volumes, tests). */
export function applyLocal(rows: Row[], spec: QuerySpec): Row[] {
  if (spec.groupBy?.length || spec.metrics?.length) { const a = new StreamingAggregator(spec); a.push(rows); return a.result(); }
  let out = rows.filter(r => (spec.filters ?? []).every(f => matchFilter(r, f)) && (spec.where ?? []).every(e => matchExpr(r, e)));
  out = order(out, spec.orderBy ?? []);
  if (spec.limit) out = out.slice(0, spec.limit);
  return spec.select ? out.map(r => Object.fromEntries(spec.select!.map(c => [c, r[c] ?? null]))) : out;
}
