// si-connector.server.ts — connecteur réel vers le SI mocké "aura-poc-paris-v2"
// (AWS Lightsail, apps *-mock, pattern FastAPI + login form + cookie de session
// + routes /api/<table> renvoyant {"data": [...]}). Serveur uniquement : jamais
// de credential exposé au client. N'est appelé que depuis cockpit.argus-admin.tsx
// (rafraîchissement manuel d'un AppField), jamais depuis Décider/Architecturer.

import { createServerFn } from "@tanstack/react-start";

// Deux protocoles réels rencontrés : le login-formulaire simple (mocks
// aura-poc-paris-v2, cookie de session) et l'OAuth 2.0 Client Credentials
// (le protocole du coffre-fort Aura SI Hub — vault + token M2M, sans cookie).
// `kind` absent = "form", pour rester compatible avec les endpoints déjà
// enregistrés avant l'ajout de l'OAuth2.
export type LiveEndpoint =
  | { kind?: "form"; baseUrl: string; user: string; password: string }
  | { kind: "oauth2_client_credentials"; tokenUrl: string; clientId: string; clientSecret: string; apiBaseUrl: string }
  | { kind: "http"; baseUrl: string; headers?: Record<string, string> }
  | { kind: "file"; fileUrl: string; headers?: Record<string, string> }
  | { kind: "soap"; serviceUrl: string; user: string; password: string; tenant?: string }
  | { kind: "graphql"; url: string; headers?: Record<string, string> }
  | { kind: "kafka"; url: string; headers?: Record<string, string> }
  | { kind: "batch"; url: string; headers?: Record<string, string> }
  | { kind: "mcp"; serverUrl: string; token?: string; toolName?: string }
  // Canal servi par le SDK de connecteurs (src/lib/integration/connectors) : même budget, métadonnées, échantillon.
  | { kind: "channel"; channel: string; url: string; headers?: Record<string, string>; oauth?: { tokenUrl: string; clientId: string; clientSecret: string } };

async function login(endpoint: Extract<LiveEndpoint, { kind?: "form" }>): Promise<{ ok: true; cookie: string } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const body = new URLSearchParams({ username: endpoint.user, password: endpoint.password });
    const r = await fetch(`${endpoint.baseUrl}/login`, {
      method: "POST",
      body,
      redirect: "manual",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const setCookie = r.headers.get("set-cookie");
    if (!setCookie) return { ok: false, error: `Pas de cookie de session reçu (statut ${r.status}) — identifiants invalides ?` };
    const cookie = setCookie.split(";")[0];
    return { ok: true, cookie };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout connexion (10s)" : (e as Error).message };
  }
}

async function fetchTable(baseUrl: string, headers: Record<string, string>, table: string): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  const path = table.startsWith("http://") || table.startsWith("https://") || table.startsWith("data:")
    ? table
    : `${baseUrl.replace(/\/$/, "")}/${table.replace(/^\//, "").replace(/^api\//, "api/")}`;
  try {
    const r = await fetch(path, { headers, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return { ok: false, error: `${path} → ${r.status}` };
    const contentType = r.headers.get("content-type") ?? "";
    if (contentType.includes("text/csv") || path.endsWith(".csv")) {
      const text = await r.text();
      const lines = text.trim().split(/\r?\n/);
      const columns = (lines.shift() ?? "").split(",").map(x => x.trim());
      const rows = lines.filter(Boolean).map(line => {
        const values = line.split(",");
        return Object.fromEntries(columns.map((column, index) => [column, values[index]?.trim() ?? ""]));
      });
      return rows.length ? { ok: true, rows } : { ok: false, error: "Fichier CSV vide" };
    }
    const j = await r.json().catch(() => null) as Record<string, unknown> | unknown[] | null;
    const rows = Array.isArray(j) ? j
      : Array.isArray(j?.data) ? j.data
      : Array.isArray(j?.records) ? j.records
      : Array.isArray(j?.items) ? j.items
      : Array.isArray(j?.messages) ? j.messages
      : Array.isArray(j?.deliveries) ? j.deliveries
      : null;
    if (!rows) return { ok: false, error: "Réponse sans collection tabulaire reconnue (data, records, items, messages ou deliveries)" };
    return { ok: true, rows: rows as Record<string, unknown>[] };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout lecture (10s)" : (e as Error).message };
  }
}

// OAuth 2.0 Client Credentials — le protocole du coffre-fort "Aura SI Hub"
// (client_id + client_secret → jeton d'accès M2M, envoyé en Bearer, jamais
// de cookie). Le jeton n'est jamais mis en cache côté serveur : redemandé à
// chaque appel, exactement comme le login-formulaire ne conserve pas la
// session au-delà d'un appel.
async function fetchTokenOAuth2(endpoint: Extract<LiveEndpoint, { kind: "oauth2_client_credentials" }>): Promise<{ ok: true; accessToken: string } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const body = new URLSearchParams({ grant_type: "client_credentials", client_id: endpoint.clientId, client_secret: endpoint.clientSecret });
    const r = await fetch(endpoint.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!r.ok) return { ok: false, error: `${endpoint.tokenUrl} → ${r.status} (client_id/client_secret invalides ou vault non résolu ?)` };
    const j = await r.json().catch(() => null) as { access_token?: string } | null;
    if (!j?.access_token) return { ok: false, error: "Réponse token sans champ 'access_token'" };
    return { ok: true, accessToken: j.access_token };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout token OAuth2 (10s)" : (e as Error).message };
  }
}

// MCP (Model Context Protocol, transport Streamable HTTP) — le serveur expose
// des outils ; on appelle `tools/call` avec le nom de la table en argument et
// on attend un contenu JSON exploitable. Aucun jeton n'est conservé au-delà de
// l'appel.
async function mcpCall(endpoint: Extract<LiveEndpoint, { kind: "mcp" }>, method: string, params: unknown): Promise<{ ok: true; result: Record<string, unknown> } | { ok: false; error: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  try {
    const r = await fetch(endpoint.serverUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(endpoint.token ? { Authorization: `Bearer ${endpoint.token}` } : {}),
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const raw = await r.text();
    if (!r.ok) return { ok: false, error: `${endpoint.serverUrl} → ${r.status} ${raw.slice(0, 160)}` };
    // Streamable HTTP peut répondre en SSE : on retient la dernière ligne data:.
    const payload = raw.includes("data:")
      ? raw.split(/\r?\n/).filter(l => l.startsWith("data:")).map(l => l.slice(5).trim()).pop() ?? ""
      : raw;
    const j = JSON.parse(payload) as { result?: Record<string, unknown>; error?: { message?: string } };
    if (j.error) return { ok: false, error: j.error.message ?? "Erreur MCP" };
    if (!j.result) return { ok: false, error: "Réponse MCP sans 'result'" };
    return { ok: true, result: j.result };
  } catch (e) {
    clearTimeout(t);
    return { ok: false, error: (e as Error).name === "AbortError" ? "Timeout MCP (15s)" : (e as Error).message };
  }
}

async function mcpFetchTable(endpoint: Extract<LiveEndpoint, { kind: "mcp" }>, table: string): Promise<{ ok: true; rows: Record<string, unknown>[] } | { ok: false; error: string }> {
  const res = await mcpCall(endpoint, "tools/call", {
    name: endpoint.toolName ?? table,
    arguments: endpoint.toolName ? { table } : {},
  });
  if (!res.ok) return res;
  const content = (res.result.content ?? []) as { type?: string; text?: string }[];
  const text = content.map(c => c.text ?? "").join("").trim();
  if (!text) return { ok: false, error: "L'outil MCP n'a renvoyé aucun contenu texte" };
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return { ok: false, error: "Le contenu MCP n'est pas du JSON tabulaire" }; }
  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { data?: unknown[] }).data) ? (parsed as { data: unknown[] }).data : null;
  if (!rows) return { ok: false, error: "Le contenu MCP n'est pas une liste de lignes" };
  return { ok: true, rows: rows as Record<string, unknown>[] };
}

// Première liste d'objets trouvée dans une réponse JSON (data.x.y[], records[]…).
function firstRowArray(value: unknown, depth = 0): Record<string, unknown>[] | null {
  if (depth > 5 || value == null) return null;
  if (Array.isArray(value)) return value.length && typeof value[0] === "object" && value[0] !== null ? value as Record<string, unknown>[] : null;
  if (typeof value === "object") for (const child of Object.values(value as Record<string, unknown>)) { const found = firstRowArray(child, depth + 1); if (found) return found; }
  return null;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); } finally { clearTimeout(t); }
}

// Lecture d'une table, quel que soit le protocole déclaré.
// ── Secrets côté serveur ────────────────────────────────────────────────────
// Un identifiant peut être une référence « {{env:NOM}} » : la valeur est lue
// ici, dans les variables d'environnement du serveur (Vercel → Settings →
// Environment Variables), et n'est jamais renvoyée au navigateur.
// « Basic-plain utilisateur:motdepasse » devient un en-tête Basic encodé ici.
export function resolveSecrets<T>(value: T, env: Record<string, string | undefined> = process.env): T {
  const missing: string[] = [];
  const sub = (x: string) => x.replace(/\{\{env:([A-Z0-9_]+)\}\}/g, (_, n: string) => { const v = env[n]; if (v === undefined) missing.push(n); return v ?? ""; });
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") {
      const r = sub(v);
      return r.startsWith("Basic-plain ") ? `Basic ${Buffer.from(r.slice("Basic-plain ".length)).toString("base64")}` : r;
    }
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)]));
    return v;
  };
  const out = walk(value) as T;
  if (missing.length) throw new Error(`Variable(s) d'environnement absente(s) côté serveur : ${[...new Set(missing)].join(", ")}. Ajoutez-la(les) dans Vercel (Settings → Environment Variables), puis redéployez.`);
  return out;
}

// ── Canaux du SDK : découverte si la source la permet, sinon l'URL est la ressource ──
const DISCOVERY = new Set(["mcp", "graphql", "soap", "salesforce", "sqlhttp"]);
function channelConfig(ep: Extract<LiveEndpoint, { kind: "channel" | "mcp" }>, table: string) {
  const kind = ep.kind === "mcp" ? "mcp" : ep.channel;
  const url = ep.kind === "mcp" ? ep.serverUrl : ep.url, u = new URL(url);
  const headers = ep.kind === "mcp" ? (ep.token ? { Authorization: `Bearer ${ep.token}` } : {}) : { ...(ep.headers ?? {}) };
  const params: Record<string, unknown> = { baseUrl: u.origin, headers };
  if (kind === "mcp") params.serverUrl = url;
  else if (kind === "graphql") params.url = url.split("#")[0];
  else if (kind === "soap") params.serviceUrl = url.split("#")[0];
  else if (kind === "salesforce") { params.baseUrl = url.replace(/\/services\/.*$/, "").replace(/\/$/, ""); if (table) params.objects = [table]; if (ep.kind === "channel" && ep.oauth) Object.assign(params, { clientId: ep.oauth.clientId, clientSecret: ep.oauth.clientSecret, tokenUrl: ep.oauth.tokenUrl || undefined }); }
  else if (kind === "sqlhttp") params.sqlUrl = url.split("#")[0];
  const name = table || decodeURIComponent(u.hash.slice(1)) || decodeURIComponent(u.pathname.split("/").filter(Boolean).pop() ?? "données");
  const discover = DISCOVERY.has(kind);
  if (kind === "kafka") params.entities = { [name]: { path: u.pathname } };
  else if (!discover) params.entities = { [name]: { url: kind === "odata4" && table && !u.pathname.endsWith(`/${table}`) ? `${url.replace(/\/$/, "")}/${table}` : url } };
  return { config: { id: `studio-${kind}-${u.host}`, label: `Studio ${kind}`, kind, params }, name, discover };
}
async function readChannel(ep: Extract<LiveEndpoint, { kind: "channel" | "mcp" }>, table: string, limit = 50): Promise<{ ok: true; rows: Record<string, unknown>[]; source: string; entities?: { name: string; columns: { name: string; type: string }[] }[] } | { ok: false; error: string }> {
  const { createConnector } = await import("../integration/connectors");
  const { config, name, discover } = channelConfig(ep, table);
  const c = createConnector(config as never, {});
  try {
    let entity = name;
    let entities: { name: string; columns: { name: string; type: string }[] }[] | undefined;
    if (discover) {
      entities = (await c.discoverSchema()).map(e => ({ name: e.name, columns: e.columns }));
      if (!entities.length) return { ok: false, error: "Aucune ressource découverte." };
      entity = entities.find(e => e.name === table || e.name.endsWith(`/${table}`) || e.name.endsWith(`.${table}`))?.name ?? entities[0].name;
    }
    const rows = await c.sample(entity, limit);
    return { ok: true, rows, source: config.params.baseUrl as string, entities };
  } catch (e) { return { ok: false, error: (e as Error).message }; }
  finally { await c.close(); }
}

async function readTable(rawEndpoint: LiveEndpoint, table: string): Promise<{ ok: true; rows: Record<string, unknown>[]; source: string } | { ok: false; error: string }> {
  let endpoint: LiveEndpoint;
  try { endpoint = resolveSecrets(rawEndpoint); } catch (e) { return { ok: false, error: (e as Error).message }; }
  if (endpoint.kind === "channel") return readChannel(endpoint, table);
  if (endpoint.kind === "mcp") {
    // Connecteur MCP générique (outils et ressources découverts) ; repli : appel direct de l'outil nommé.
    if (!endpoint.toolName) { const g = await readChannel(endpoint, table); if (g.ok) return g; }
    const res = await mcpFetchTable(endpoint, table);
    return res.ok ? { ...res, source: endpoint.serverUrl } : res;
  }
  if (endpoint.kind === "oauth2_client_credentials") {
    const auth = await fetchTokenOAuth2(endpoint);
    if (!auth.ok) return { ok: false, error: auth.error };
    const res = await fetchTable(endpoint.apiBaseUrl, { Authorization: `Bearer ${auth.accessToken}` }, table);
    return res.ok ? { ...res, source: endpoint.apiBaseUrl } : res;
  }
  if (endpoint.kind === "http") {
    const res = await fetchTable(endpoint.baseUrl, endpoint.headers ?? {}, table);
    return res.ok ? { ...res, source: endpoint.baseUrl } : res;
  }
  if (endpoint.kind === "file") {
    const res = await fetchTable("", endpoint.headers ?? {}, endpoint.fileUrl);
    return res.ok ? { ...res, source: endpoint.fileUrl } : res;
  }
  if (endpoint.kind === "graphql") {
    // « table » = requête GraphQL complète ; les lignes sont la première liste d'objets de data.
    const r = await fetchWithTimeout(endpoint.url, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", ...(endpoint.headers ?? {}) }, body: JSON.stringify({ query: table }) });
    const j = await r.json().catch(() => null) as { data?: unknown; errors?: { message?: string }[] } | null;
    if (!r.ok || !j) return { ok: false, error: `${endpoint.url} → ${r.status}${j?.errors?.[0]?.message ? ` ${j.errors[0].message}` : ""}` };
    if (j.errors?.length) return { ok: false, error: j.errors.map(e => e.message).join(" ; ") };
    const rows = firstRowArray(j.data);
    return rows ? { ok: true, rows, source: endpoint.url } : { ok: false, error: "Réponse GraphQL sans liste d'enregistrements" };
  }
  if (endpoint.kind === "kafka") {
    // « table » = topic ; on consomme depuis l'offset 0 (lecture seule).
    const url = `${endpoint.url}${endpoint.url.includes("?") ? "&" : "?"}topic=${encodeURIComponent(table)}&offset=0&limit=200`;
    const r = await fetchWithTimeout(url, { headers: { Accept: "application/json", ...(endpoint.headers ?? {}) } });
    const j = await r.json().catch(() => null) as { messages?: { offset?: number; key?: string; value?: { data?: unknown; type?: string; time?: string } }[] } | null;
    if (!r.ok || !j) return { ok: false, error: `${url} → ${r.status}` };
    const rows = (j.messages ?? []).map(m => {
      const data = m.value?.data;
      const payload = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : { value: data };
      return { _offset: m.offset, _key: m.key, _type: m.value?.type, _time: m.value?.time, ...payload };
    });
    return rows.length ? { ok: true, rows, source: url } : { ok: false, error: `Topic "${table}" vide` };
  }
  if (endpoint.kind === "batch") {
    // « table » = application[.Table] ; job d'export NDJSON puis téléchargement du résultat.
    const [app, tableName] = table.split(".");
    const headers = { "Content-Type": "application/json", Accept: "application/json", ...(endpoint.headers ?? {}) };
    const job = await fetchWithTimeout(endpoint.url, { method: "POST", headers, body: JSON.stringify({ app, table: tableName, format: "ndjson" }) });
    const jj = await job.json().catch(() => null) as { jobId?: string; status?: string } | null;
    if (!job.ok || !jj?.jobId) return { ok: false, error: `${endpoint.url} → ${job.status} (création du job)` };
    const resultUrl = `${endpoint.url}?job=${encodeURIComponent(jj.jobId)}&result=1`;
    const res = await fetchWithTimeout(resultUrl, { headers: endpoint.headers ?? {} });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: `${resultUrl} → ${res.status}` };
    const rows = text.split(/\r?\n/).filter(Boolean).map(line => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } }).filter((x): x is Record<string, unknown> => !!x);
    return rows.length ? { ok: true, rows, source: endpoint.url } : { ok: false, error: "Résultat de batch vide" };
  }
  if (endpoint.kind === "soap") {
    const auth = Buffer.from(`${endpoint.user}:${endpoint.password}`).toString("base64");
    const operation = table || "GetPurchaseOrders";
    const r = await fetchWithTimeout(endpoint.serviceUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: operation,
        ...(endpoint.tenant ? { "X-Lucie-Tenant": endpoint.tenant, "X-Lumen-Tenant": endpoint.tenant } : {}),
      },
      body: `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><${operation} xmlns="https://maison-lucie-si.vercel.app/soap"/></soap:Body></soap:Envelope>`,
    });
    const xml = await r.text();
    if (!r.ok) return { ok: false, error: `${endpoint.serviceUrl} → ${r.status}` };
    // Enregistrements = enfants répétés de <records> (ou, à défaut, <PurchaseOrder>).
    const container = xml.match(/<records>([\s\S]*)<\/records>/)?.[1] ?? xml;
    const recordTag = container.match(/<([A-Za-z0-9_]+)>\s*</)?.[1] ?? "PurchaseOrder";
    const records = [...container.matchAll(new RegExp(`<${recordTag}>([\\s\\S]*?)<\\/${recordTag}>`, "g"))].map(match => {
      const row: Record<string, string> = {};
      for (const field of match[1].matchAll(/<([A-Za-z0-9_]+)>([\s\S]*?)<\/\1>/g)) row[field[1]] = field[2].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      return row;
    });
    return records.length ? { ok: true, rows: records, source: endpoint.serviceUrl } : { ok: false, error: "Réponse SOAP sans enregistrement exploitable" };
  }
  const auth = await login(endpoint);
  if (!auth.ok) return { ok: false, error: auth.error };
  const res = await fetchTable(endpoint.baseUrl, { Cookie: auth.cookie }, `api/${table}`);
  return res.ok ? { ...res, source: endpoint.baseUrl } : res;
}

// Test de connexion MCP : liste les outils exposés par le serveur.
export const listMcpTools = createServerFn({ method: "POST" })
  .validator((d: { endpoint: Extract<LiveEndpoint, { kind: "mcp" }> }) => d)
  .handler(async ({ data }): Promise<{ ok: true; tools: { name: string; description?: string }[] } | { ok: false; error: string }> => {
    let ep: Extract<LiveEndpoint, { kind: "mcp" }>;
    try { ep = resolveSecrets(data.endpoint); } catch (e) { return { ok: false, error: (e as Error).message }; }
    const res = await mcpCall(ep, "tools/list", {});
    if (!res.ok) return res;
    const tools = (res.result.tools ?? []) as { name: string; description?: string }[];
    return { ok: true, tools };
  });

// Découverte MCP générique : ressources tabulaires (source/ressource, colonnes typées) exposées par le serveur.
export const discoverMcpEntities = createServerFn({ method: "POST" })
  .validator((d: { endpoint: Extract<LiveEndpoint, { kind: "mcp" }> }) => d)
  .handler(async ({ data }): Promise<{ ok: true; entities: { name: string; columns: { name: string; type: string }[] }[] } | { ok: false; error: string }> => {
    let ep: Extract<LiveEndpoint, { kind: "mcp" }>;
    try { ep = resolveSecrets(data.endpoint); } catch (e) { return { ok: false, error: (e as Error).message }; }
    const r = await readChannel(ep, "", 1);
    return r.ok ? { ok: true, entities: r.entities ?? [] } : r;
  });

export interface SiFieldSample {
  table: string;
  columns: string[];
  sampleValues: string[]; // aplati depuis la 1ère ligne de chaque colonne, jusqu'à 6
}

// Interroge un SI réel — login-formulaire ou OAuth2 Client Credentials selon
// l'endpoint — puis lit une table. Ne stocke jamais le secret au-delà de cet
// appel — appelé à la demande depuis Studio, jamais en tâche de fond, jamais
// mis en cache côté serveur.
export const queryLiveSiTable = createServerFn({ method: "POST" })
  .validator((d: { endpoint: LiveEndpoint; table: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true; sample: SiFieldSample } | { ok: false; error: string }> => {
    const res = await readTable(data.endpoint, data.table);
    if (!res.ok) return { ok: false, error: res.error };
    const baseUrl = res.source;
    if (res.rows.length === 0) return { ok: false, error: `Table "${data.table}" vide sur ${baseUrl}` };
    const columns = Object.keys(res.rows[0]);
    const sampleValues = res.rows.slice(0, 6).map(row =>
      columns.map(c => String(row[c] ?? "")).join(" · ")
    );
    return { ok: true, sample: { table: data.table, columns, sampleValues } };
  });

// Lecture tabulaire d'une table du SI source — mêmes protocoles que
// queryLiveSiTable, mais renvoie les LIGNES telles que la source les a
// retournées (colonnes = métadonnées réelles de la table). Sert à afficher
// les échantillons sous forme de tableau dans Studio. Rien n'est inventé :
// si la table est vide, on le dit, on ne fabrique pas de lignes.
export const queryLiveSiRows = createServerFn({ method: "POST" })
  .validator((d: { endpoint: LiveEndpoint; table: string; limit?: number }) => d)
  .handler(async ({ data }): Promise<{ ok: true; columns: string[]; rows: Record<string, string>[] } | { ok: false; error: string }> => {
    const res = await readTable(data.endpoint, data.table);
    if (!res.ok) return { ok: false, error: res.error };
    const baseUrl = res.source;
    if (res.rows.length === 0) return { ok: false, error: `Table "${data.table}" vide sur ${baseUrl}` };
    const columns = Array.from(new Set(res.rows.flatMap(r => Object.keys(r))));
    const rows = res.rows.slice(0, data.limit ?? 25).map(r => {
      const out: Record<string, string> = {};
      for (const c of columns) {
        const v = r[c];
        out[c] = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
      }
      return out;
    });
    return { ok: true, columns, rows };
  });


// « Tester la connexion » : lit une première ligne, sans rien enregistrer.
export const testSiConnection = createServerFn({ method: "POST" })
  .validator((d: { endpoint: LiveEndpoint; table: string }) => d)
  .handler(async ({ data }): Promise<{ ok: true; columns: number } | { ok: false; error: string }> => {
    const res = await readTable(data.endpoint, data.table);
    if (!res.ok) return res;
    return { ok: true, columns: res.rows[0] ? Object.keys(res.rows[0]).length : 0 };
  });
