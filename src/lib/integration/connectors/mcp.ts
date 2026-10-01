// Connecteur MCP générique (Model Context Protocol, transport Streamable HTTP).
// Se branche sur n'importe quel serveur MCP : initialize → tools/list et
// resources/list, puis convertit ce qu'il découvre en ressources tabulaires
// (métadonnées et échantillon), sous le même budget que les autres connecteurs.
// Stratégies de découverte, de la plus riche à la plus simple :
//  1. outil de catalogue (list_sources, list_tables…) + outil de requête paginée
//     (arguments source/resource ou table, limit, offset) ;
//  2. ressources JSON (resources/read) contenant une liste d'objets ;
//  3. outils sans argument obligatoire, dont le résultat contient une liste d'objets.
// Les réponses SSE (text/event-stream) et l'en-tête Mcp-Session-Id sont gérés.
import { HttpStatusError, parseRetryAfter, type CallKind } from "../budget";
import { ChannelConnector, type ChannelEntity, type Page } from "./channels";
import type { ColumnInfo, QuerySpec, Row } from "../types";

export const MCP_PROTOCOL_VERSION = "2025-06-18";
export interface McpTool { name: string; title?: string; description?: string; inputSchema?: { properties?: Record<string, { type?: string | string[]; enum?: string[] }>; required?: string[] }; outputSchema?: unknown }
export interface McpResource { uri: string; name?: string; title?: string; mimeType?: string; description?: string }
export interface McpDescription { serverInfo: { name: string; version?: string; title?: string }; protocolVersion: string; tools: McpTool[]; resources: McpResource[]; instructions?: string }

/** Première liste d'objets dans une valeur JSON (profondeur bornée). */
export function firstRows(value: unknown, depth = 0): Row[] | null {
  if (depth > 5 || value == null) return null;
  if (Array.isArray(value)) return value.length && value.every(x => x && typeof x === "object" && !Array.isArray(x)) ? (value as Row[]) : null;
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["rows", "items", "records", "data", "value", "results"]) { const r = firstRows(o[k], depth + 1); if (r) return r; }
    for (const child of Object.values(o)) { const r = firstRows(child, depth + 1); if (r) return r; }
  }
  return null;
}
/** Contenu d'un résultat d'outil : structuredContent, sinon le texte JSON des blocs « text ». */
export function toolPayload(result: any): unknown {
  if (result?.isError) throw new Error(`Outil MCP en erreur : ${(result.content ?? []).map((c: any) => c.text ?? "").join(" ").slice(0, 300)}`);
  if (result?.structuredContent !== undefined) return result.structuredContent;
  const text = (result?.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("");
  try { return JSON.parse(text); } catch { return text; }
}

export class McpConnector extends ChannelConnector {
  readonly kind = "mcp" as const;
  private mcpSession: string | null = null;
  private negotiated: string | null = null;
  private info: McpDescription | null = null;
  private rpcId = 0;

  private get serverUrl() { return String(this.p.serverUrl ?? this.p.baseUrl); }
  /** Appel JSON-RPC sous budget ; réponse JSON ou flux SSE (on retient le message de même id). */
  async rpc(method: string, params: unknown = {}, kind: CallKind = "light"): Promise<any> {
    const id = ++this.rpcId, f = this.deps.fetch ?? fetch;
    const headers: Record<string, string> = { ...this.headers(), "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (this.mcpSession) headers["Mcp-Session-Id"] = this.mcpSession;
    if (this.negotiated) headers["MCP-Protocol-Version"] = this.negotiated;
    const body = JSON.stringify({ jsonrpc: "2.0", id, method, params });
    const res = await this.governor.call(`MCP ${this.serverUrl} ${method} ${JSON.stringify(params)}`, kind, async () => {
      this.calls++;
      const r = await f(this.serverUrl, { method: "POST", headers, body });
      if (!r.ok) throw new HttpStatusError(r.status, `MCP ${method} → ${r.status}`, parseRetryAfter(r.headers.get("retry-after")));
      const sid = r.headers.get("mcp-session-id");
      if (sid) this.mcpSession = sid;
      const text = await r.text();
      const ct = r.headers.get("content-type") ?? "";
      const msgs = ct.includes("text/event-stream")
        ? text.split(/\r?\n\r?\n/).map(ev => ev.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trimStart()).join("\n")).filter(Boolean).map(d => JSON.parse(d))
        : [JSON.parse(text)];
      return (msgs.flat() as any[]).find(m => m.id === id) ?? msgs[0];
    }, (m: any) => firstRows(m?.result?.structuredContent)?.length ?? 0);
    if (res?.error) throw new Error(`MCP ${method} : ${res.error.message} (${res.error.code})`);
    return res?.result;
  }
  private async notify(method: string) {
    const f = this.deps.fetch ?? fetch;
    const headers: Record<string, string> = { ...this.headers(), "Content-Type": "application/json", Accept: "application/json, text/event-stream", ...(this.mcpSession ? { "Mcp-Session-Id": this.mcpSession } : {}), ...(this.negotiated ? { "MCP-Protocol-Version": this.negotiated } : {}) };
    await this.governor.call(`MCP notify ${method} ${this.serverUrl}`, "light", async () => { this.calls++; await f(this.serverUrl, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", method }) }); });
  }
  /** Poignée de main MCP puis inventaire des outils et des ressources (listes paginées suivies). */
  async describe(): Promise<McpDescription> {
    if (this.info) return this.info;
    const init = await this.rpc("initialize", { protocolVersion: MCP_PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: "aura-supply", title: "Aura Supply", version: "1.0.0" } });
    this.negotiated = init.protocolVersion;
    await this.notify("notifications/initialized");
    const tools: McpTool[] = [], resources: McpResource[] = [];
    if (init.capabilities?.tools) for (let cursor: string | undefined; ;) { const r = await this.rpc("tools/list", cursor ? { cursor } : {}); tools.push(...(r.tools ?? [])); cursor = r.nextCursor; if (!cursor) break; }
    if (init.capabilities?.resources) for (let cursor: string | undefined; ;) { const r = await this.rpc("resources/list", cursor ? { cursor } : {}); resources.push(...(r.resources ?? [])); cursor = r.nextCursor; if (!cursor) break; }
    this.info = { serverInfo: init.serverInfo, protocolVersion: init.protocolVersion, tools, resources, instructions: init.instructions };
    return this.info;
  }
  async callTool(name: string, args: Record<string, unknown> = {}, kind: CallKind = "light") { return toolPayload(await this.rpc("tools/call", { name, arguments: args }, kind)); }

  private queryTool(tools: McpTool[]) {
    return tools.find(t => { const p = t.inputSchema?.properties ?? {}; return /query|read_rows|select|search/i.test(t.name) && "limit" in p && "offset" in p && (("source" in p && "resource" in p) || "table" in p); });
  }
  protected override async discover(): Promise<Record<string, ChannelEntity>> {
    const d = await this.describe(), out: Record<string, ChannelEntity> = {};
    const q = this.queryTool(d.tools);
    const catalogTool = d.tools.find(t => /^(list_(sources|tables|entities|datasets)|catalog|describe_sources)$/i.test(t.name) && !(t.inputSchema?.required ?? []).length);
    // 1. Catalogue + requête paginée.
    if (q && catalogTool) {
      const cat: any = await this.callTool(catalogTool.name);
      const sources: any[] = Array.isArray(cat?.sources) ? cat.sources : [];
      for (const s of sources) for (const r of s.resources ?? []) out[`${s.id}/${r.resource ?? r.name}`] = { url: `mcp://${q.name}/${s.id}/${r.resource ?? r.name}`, key: r.key, watermark: r.watermark ?? undefined, columns: (r.columns ?? []).map((c: ColumnInfo) => ({ name: c.name, type: c.type })) };
      for (const t of Array.isArray(cat?.tables) ? cat.tables : []) out[t.name ?? t] = { url: `mcp://${q.name}/${t.name ?? t}`, columns: t.columns };
      if (Object.keys(out).length) return out;
    }
    // 2. Ressources JSON tabulaires.
    for (const r of d.resources.filter(x => !x.mimeType || /json/.test(x.mimeType))) {
      try { const c = await this.rpc("resources/read", { uri: r.uri }); const rows = firstRows(JSON.parse(c.contents?.[0]?.text ?? "null")); if (rows?.length) out[r.name ?? r.uri] = { url: `mcp-resource:${r.uri}` }; } catch { /* ressource non tabulaire */ }
    }
    // 3. Outils sans argument obligatoire renvoyant une liste d'objets.
    for (const t of d.tools.filter(x => !(x.inputSchema?.required ?? []).length && x !== catalogTool)) {
      try { const rows = firstRows(await this.callTool(t.name)); if (rows?.length) out[t.name] = { url: `mcp-tool:${t.name}` }; } catch { /* outil non tabulaire */ }
    }
    if (!Object.keys(out).length) throw new Error("MCP : aucun outil ni aucune ressource ne renvoie de données tabulaires.");
    return out;
  }
  protected async fetchPage(e: ChannelEntity, name: string, offset: number, size: number, o: { kind: CallKind; spec?: QuerySpec }): Promise<Page> {
    if (e.url.startsWith("mcp-resource:")) { const c = await this.rpc("resources/read", { uri: e.url.slice(13) }, o.kind); const rows = firstRows(JSON.parse(c.contents?.[0]?.text ?? "null")) ?? []; return { rows: rows.slice(offset, offset + size), next: offset + size < rows.length ? offset + size : null }; }
    if (e.url.startsWith("mcp-tool:")) { const rows = firstRows(await this.callTool(e.url.slice(9), {}, o.kind)) ?? []; return { rows: rows.slice(offset, offset + size), next: offset + size < rows.length ? offset + size : null }; }
    const [tool, ...path] = e.url.replace(/^mcp:\/\//, "").split("/");
    const ops = ["eq", "ne", "gt", "ge", "lt", "le", "in"];
    const filters = (o.spec?.filters ?? []).filter(f => ops.includes(f.op));
    const args: Record<string, unknown> = path.length === 2 ? { source: path[0], resource: path[1] } : { table: path[0] ?? name };
    Object.assign(args, { limit: size, offset }, filters.length ? { filters } : {});
    const res: any = await this.callTool(tool, args, o.kind);
    const rows = firstRows(res) ?? [];
    const next = typeof res?.nextOffset === "number" ? res.nextOffset : res?.nextOffset === null ? null : rows.length === size ? offset + size : null;
    return { rows, next };
  }
  override readonly pushdown = { filter: true, select: false, aggregate: false, limit: true, columnExpr: false };
  override async close() { this.mcpSession = null; this.info = null; await super.close(); }
}
