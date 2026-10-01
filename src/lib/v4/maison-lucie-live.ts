// maison-lucie-live.ts — couche de lecture LIVE (fetch client) du portail de
// démonstration Maison Lucie (github.com/mambayelo-lab/maison-lucie-si,
// déployé sur https://maison-lucie-si.vercel.app), pour rafraîchir en temps
// réel les 5 alertes + 2 situations du Cockpit SCRA déjà "Ancré Maison
// Lucie" de façon STATIQUE (alert-catalogue.ts). Ce module n'écrit jamais
// dans alert-catalogue.ts : il lit son contenu depuis l'extérieur et
// superpose, quand la lecture live réussit, les valeurs fraîchement
// obtenues sur les mêmes champs déjà cités statiquement.
//
// Portée volontairement restreinte à /api/alerts (endpoint agrégé le plus
// directement comparable à ce que alert-catalogue.ts cite déjà :
// exposureEur/decisionWindowHours par alerte ALT-00x — voir
// lib/demo-data.js::resilienceAlerts() dans le repo maison-lucie-si). Une
// lecture qui échoue, time-out, ou renvoie une forme inattendue ne casse
// jamais l'affichage : elle retombe sur l'état "unreachable" et l'appelant
// garde les valeurs statiques déjà affichées.
//
// IMPORTANT — limite honnête : ce module n'a jamais pu être vérifié en
// conditions de succès dans l'environnement où il a été écrit (bac à sable
// dont la sortie réseau vers maison-lucie-si.vercel.app est bloquée, 403 via
// le proxy). Le code ci-dessous est écrit pour être correct dans un vrai
// navigateur/serveur qui atteint ce domaine (comme l'environnement réel de
// l'utilisateur), mais seul le chemin d'échec/repli a pu être vérifié ici.
//
// MISE À JOUR (retour de test réel) — le portail a évolué depuis l'écriture
// initiale de ce module : /api/alerts, /api/data/<app> et /api/events exigent
// désormais une authentification réelle (401 sinon), et /api/files/<name>
// expose maintenant les CSV (auparavant seulement via un "Batch Hub" local
// injoignable). Le contrat exact vérifié dans le dépôt (lib/http-api.js) :
// - /api/alerts et /api/events : Bearer <gateway token> OU X-Client-Id +
//   X-Client-Secret.
// - /api/data/sap-s4 : Basic <user:pass> + X-Lucie-Tenant.
// - /api/data/manhattan-wms : X-API-Key.
// - /api/data/blueyonder-tms : Bearer obtenu via POST /api/token
//   (grant_type=client_credentials + client_id/client_secret).
// - /api/data/coupa-risk : Bearer token direct.
// - /api/data/snowflake-demand : Bearer token + X-Lucie-Account/-Warehouse/-Role.
// - /api/data/mulesoft-events et /api/events : X-Client-Id + X-Client-Secret.
// - /api/files/<name> : X-API-Key.
// Les valeurs elles-mêmes viennent des demoCredentials déjà déclarés par
// application dans argus-vocab-store.ts (donc "les identifiants réellement
// enregistrés dans Studio", pas une constante séparée) — voir
// buildAppAuthHeaders ci-dessous.

// Adresse du SI Maison Lucie — surchargeable (VITE_MAISON_LUCIE_URL) pour
// pointer une instance locale ou un autre déploiement.
export const MAISON_LUCIE_PORTAL: string = (import.meta.env?.VITE_MAISON_LUCIE_URL as string | undefined)?.replace(/\/$/, "") || "https://maison-lucie-si.vercel.app";

// Jeton de la passerelle (gateway) — distinct des identifiants par
// application, nécessaire pour /api/alerts. Valeur de démonstration publique
// documentée par le dépôt (lib/http-api.js::DEMO_CREDENTIALS.gateway.token) ;
// peut être surchargée côté serveur Maison Lucie par LUMEN_GATEWAY_TOKEN,
// mais Aura n'a alors aucun moyen de le deviner — c'est un jeton de démo
// public par construction, pas un secret à protéger côté Aura.
export const LUMEN_GATEWAY_TOKEN = "lucie_aura_gateway_demo_token";

export type DemoCredential = { label: string; value: string };

function credVal(creds: DemoCredential[] | undefined, label: string): string {
  return creds?.find(c => c.label === label)?.value ?? "";
}

// Échange client_id/client_secret contre un access_token via POST /api/token
// (OAuth2 client_credentials) — seule application du catalogue qui suit ce
// protocole en 2 temps (blueyonder-tms). Un échec renvoie undefined : la
// lecture appelante retombe alors proprement sur "unreachable" pour cette
// application, jamais un jeton fabriqué.
export async function fetchMaisonLucieTmsToken(clientId: string, clientSecret: string, timeoutMs = 7000): Promise<string | undefined> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MAISON_LUCIE_PORTAL}/api/token`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }),
    });
    if (!res.ok) return undefined;
    const json = await res.json().catch(() => null) as { access_token?: string } | null;
    return json?.access_token;
  } catch {
    return undefined;
  } finally {
    clearTimeout(timer);
  }
}

// Construit les en-têtes d'authentification réels pour /api/data/<catalogAppId>
// à partir des demoCredentials DÉCLARÉS SUR L'APPLICATION dans Studio (donc
// modifiables par l'utilisateur via "Configurer les identifiants" — pas une
// constante Aura séparée). blueyonder-tms est un cas à part : ses
// credentials sont un client_id/client_secret qui doivent d'abord être
// échangés contre un jeton via fetchMaisonLucieTmsToken (voir
// fetchMaisonLucieAppData) — cette fonction ne construit ici que les
// en-têtes des applications à authentification directe.
export function buildAppAuthHeaders(catalogAppId: string, demoCredentials: DemoCredential[] | undefined): Record<string, string> {
  switch (catalogAppId) {
    case "sap-s4": {
      const user = credVal(demoCredentials, "username");
      const password = credVal(demoCredentials, "password");
      const tenant = credVal(demoCredentials, "tenant");
      return { Authorization: `Basic ${btoa(`${user}:${password}`)}`, "X-Lucie-Tenant": tenant };
    }
    case "manhattan-wms":
      return { "X-API-Key": credVal(demoCredentials, "x-api-key") };
    case "coupa-risk":
      return { Authorization: `Bearer ${credVal(demoCredentials, "token")}` };
    case "snowflake-demand":
      return {
        Authorization: `Bearer ${credVal(demoCredentials, "bearer_token")}`,
        "X-Lucie-Account": credVal(demoCredentials, "account"),
        "X-Lucie-Warehouse": credVal(demoCredentials, "warehouse"),
        "X-Lucie-Role": credVal(demoCredentials, "role"),
      };
    case "mulesoft-events":
    case "kafka-stream":
    case "webhook-gateway":
      return { "X-Client-Id": credVal(demoCredentials, "client_id"), "X-Client-Secret": credVal(demoCredentials, "client_secret") };
    case "rest-order-management":
      return { Authorization: `Bearer ${credVal(demoCredentials, "bearer_token")}` };
    case "legacy-soap": {
      const user = credVal(demoCredentials, "username");
      const password = credVal(demoCredentials, "password");
      return { Authorization: `Basic ${btoa(`${user}:${password}`)}`, "X-Lucie-Tenant": credVal(demoCredentials, "tenant") };
    }
    default:
      return {};
  }
}

export type LiveAlert = {
  id: string;
  severity: string;
  signal: string;
  businessObject: string;
  exposureEur: number;
  decisionWindowHours: number;
  decision: string;
  evidence: string[];
};

export type LiveAlertsResponse = {
  generatedAt: string;
  alerts: LiveAlert[];
};

export type LiveFetchState = "idle" | "loading" | "live" | "unreachable";

export type LiveFetchResult =
  | { ok: true; data: LiveAlertsResponse; fetchedAt: string }
  | { ok: false; error: string };

function isLiveAlert(x: unknown): x is LiveAlert {
  if (!x || typeof x !== "object") return false;
  const a = x as Record<string, unknown>;
  return typeof a.id === "string"
    && typeof a.exposureEur === "number"
    && typeof a.decisionWindowHours === "number"
    && typeof a.businessObject === "string";
}

// Lecture live de GET /api/alerts — timeout raisonnable (AbortController),
// jamais de throw : toute défaillance (réseau, timeout, JSON invalide, forme
// de réponse inattendue) revient comme { ok: false, error }, jamais une
// exception non gérée qui casserait le rendu du Cockpit.
export async function fetchMaisonLucieAlerts(timeoutMs = 7000): Promise<LiveFetchResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${MAISON_LUCIE_PORTAL}/api/alerts`, {
      signal: controller.signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${LUMEN_GATEWAY_TOKEN}` },
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const json: unknown = await res.json();
    if (!json || typeof json !== "object") return { ok: false, error: "réponse JSON inattendue" };
    const body = json as Record<string, unknown>;
    const alerts = body.alerts;
    if (!Array.isArray(alerts) || !alerts.every(isLiveAlert)) {
      return { ok: false, error: "forme de /api/alerts différente de celle attendue (alerts[].id/exposureEur/decisionWindowHours/businessObject)" };
    }
    const generatedAt = typeof body.generatedAt === "string" ? body.generatedAt : new Date().toISOString();
    return { ok: true, data: { generatedAt, alerts: alerts as LiveAlert[] }, fetchedAt: new Date().toISOString() };
  } catch (err) {
    const message = err instanceof Error
      ? (err.name === "AbortError" ? `délai dépassé (${timeoutMs}ms)` : err.message)
      : "erreur inconnue";
    return { ok: false, error: message };
  } finally {
    clearTimeout(timer);
  }
}

// ── Import live du catalogue de sources + des données d'application ──────
// Le portail Maison Lucie expose un vrai contrat générique, au-delà de
// /api/alerts déjà utilisé ci-dessus : GET /api/catalog (liste des
// applications connectables, avec protocole/rôle/mode d'auth réels) et
// GET /api/data/<appId> (jeu de données réel de cette application). C'est
// EXACTEMENT ce que Studio doit interroger pour se "connecter" au SI —
// jamais une valeur recopiée en dur dans le code Aura. Voir
// importMaisonLucieLive dans argus-vocab-store.ts pour l'orchestration qui
// construit apps/fields du vocabulaire à partir de ces réponses.
export type LiveCatalogApp = {
  id: string; name: string; marketReference: string; role: string;
  protocol: string; baseUrl: string; refresh: string; status: string; disclaimer: string;
};
export type LiveCatalogResponse = { environment: string; synthetic: boolean; generatedAt: string; applications: LiveCatalogApp[] };
export type LiveAppDataResponse = { application: LiveCatalogApp; generatedAt: string; entity: string; records: Record<string, unknown>[]; availableTables?: string[] };

async function fetchJson<T>(url: string, timeoutMs = 7000, headers?: Record<string, string>): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json", ...headers } });
    if (!res.ok) return { ok: false, error: `${url} → HTTP ${res.status}${res.status === 401 ? " (identifiants manquants ou invalides)" : ""}` };
    const json = await res.json().catch(() => null);
    if (!json || typeof json !== "object") return { ok: false, error: `${url} → réponse JSON inattendue` };
    return { ok: true, data: json as T };
  } catch (err) {
    const message = err instanceof Error
      ? (err.name === "AbortError" ? `délai dépassé (${timeoutMs}ms)` : err.message)
      : "erreur inconnue";
    return { ok: false, error: `${url} → ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

export function fetchMaisonLucieCatalog(): Promise<{ ok: true; data: LiveCatalogResponse } | { ok: false; error: string }> {
  return fetchJson<LiveCatalogResponse>(`${MAISON_LUCIE_PORTAL}/api/catalog`);
}

// Authentifié — voir buildAppAuthHeaders pour le détail par application.
// blueyonder-tms est un cas à part (OAuth2 2 temps) : ses demoCredentials
// sont un client_id/client_secret, jamais un jeton direct, donc on échange
// d'abord un access_token via POST /api/token avant d'appeler /api/data.
export async function fetchMaisonLucieAppData(catalogAppId: string, demoCredentials: DemoCredential[] | undefined, table?: string): Promise<{ ok: true; data: LiveAppDataResponse } | { ok: false; error: string }> {
  const url = `${MAISON_LUCIE_PORTAL}/api/data/${catalogAppId}${table ? `?table=${encodeURIComponent(table)}` : ""}`;
  if (catalogAppId === "blueyonder-tms") {
    const clientId = credVal(demoCredentials, "client_id");
    const clientSecret = credVal(demoCredentials, "client_secret");
    const accessToken = await fetchMaisonLucieTmsToken(clientId, clientSecret);
    if (!accessToken) return { ok: false, error: `${MAISON_LUCIE_PORTAL}/api/token → échec de l'échange OAuth2 client_credentials (identifiants TMS invalides ou portail indisponible)` };
    return fetchJson<LiveAppDataResponse>(url, 7000, { Authorization: `Bearer ${accessToken}` });
  }
  return fetchJson<LiveAppDataResponse>(url, 7000, buildAppAuthHeaders(catalogAppId, demoCredentials));
}

export type LiveCloudEvent = { specversion: string; id: string; source: string; type: string; subject: string; time: string };

// GET /api/events — cursor-paginé, authentification X-Client-Id/X-Client-Secret
// (mêmes identifiants que l'application "Lucie Integration Hub" déclarée dans
// Studio). Distinct de /api/data/mulesoft-events (même dataset sous-jacent,
// mais enveloppe CloudEvents 1.0 propre plutôt qu'un enregistrement brut).
export async function fetchMaisonLucieEvents(demoCredentials: DemoCredential[] | undefined, limit = 50): Promise<{ ok: true; data: { events: LiveCloudEvent[] } } | { ok: false; error: string }> {
  const clientId = credVal(demoCredentials, "client_id");
  const clientSecret = credVal(demoCredentials, "client_secret");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`${MAISON_LUCIE_PORTAL}/api/events?cursor=0&limit=${limit}`, {
      signal: controller.signal,
      headers: { Accept: "application/json", "X-Client-Id": clientId, "X-Client-Secret": clientSecret },
    });
    if (!res.ok) return { ok: false, error: `/api/events → HTTP ${res.status}${res.status === 401 ? " (identifiants manquants ou invalides)" : ""}` };
    const events = await res.json().catch(() => null) as LiveCloudEvent[] | null;
    if (!Array.isArray(events)) return { ok: false, error: "/api/events → réponse inattendue (tableau CloudEvents attendu)" };
    return { ok: true, data: { events } };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? "délai dépassé (7000ms)" : err.message) : "erreur inconnue";
    return { ok: false, error: `/api/events → ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Import CSV via /api/files/<name> ──────────────────────────────────────
// Contrat vérifié dans le dépôt (api/files/[name].js) : GET, authentifié par
// X-API-Key, renvoie le CSV brut en text/csv. Auparavant injoignable (servi
// par un "Batch Hub" local uniquement) — le portail public l'expose
// maintenant réellement, donc Studio peut l'ingérer comme le reste.
export const MAISON_LUCIE_FILES = ["demand-forecast.csv", "supplier-scorecard.csv"] as const;
export type MaisonLucieFileName = typeof MAISON_LUCIE_FILES[number];

// Parseur CSV minimal — suffisant ici : les deux fichiers exposés n'ont ni
// guillemets ni virgules à l'intérieur d'une valeur (vérifié dans le dépôt).
// Pas de dépendance externe pour un format aussi simple.
export function parseSimpleCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

export async function fetchMaisonLucieFile(name: MaisonLucieFileName, demoCredentials: DemoCredential[] | undefined): Promise<{ ok: true; data: Record<string, string>[] } | { ok: false; error: string }> {
  const apiKey = credVal(demoCredentials, "x-api-key");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(`${MAISON_LUCIE_PORTAL}/api/files/${name}`, {
      signal: controller.signal,
      headers: { Accept: "text/csv", "X-API-Key": apiKey },
    });
    if (!res.ok) return { ok: false, error: `/api/files/${name} → HTTP ${res.status}${res.status === 401 ? " (identifiants manquants ou invalides)" : ""}` };
    const text = await res.text();
    return { ok: true, data: parseSimpleCsv(text) };
  } catch (err) {
    const message = err instanceof Error ? (err.name === "AbortError" ? "délai dépassé (7000ms)" : err.message) : "erreur inconnue";
    return { ok: false, error: `/api/files/${name} → ${message}` };
  } finally {
    clearTimeout(timer);
  }
}

// ── Superposition sur les alertes/situations déjà ancrées statiquement ────
// Ces tables ne dupliquent aucune donnée métier : elles disent seulement
// "quel ALT-00x du gateway Maison Lucie correspond à quelle CatalogueAlert /
// Situation déjà ancrée dans alert-catalogue.ts", d'après les annotations
// déjà présentes dans ce fichier (commentaires "≈ ALT-00x",
// `alertesCorrelees`). Volontairement restreint aux entrées où le lien est
// univoque et déjà documenté — pas une correspondance devinée.
const ALERT_TO_ALT: Record<string, string> = { S1: "ALT-001", S4: "ALT-002" };
const SITUATION_TO_ALT: Record<string, string> = { "SIT-001": "ALT-002", "SIT-002": "ALT-003" };

export type LiveOverlay = {
  altId: string;
  exposureEur: number;
  decisionWindowHours: number;
  generatedAt: string;
  matches: boolean; // les valeurs live confirment (== ou proches) les valeurs statiques déjà citées
};

function findAlt(data: LiveAlertsResponse | null, altId: string | undefined): LiveAlert | undefined {
  if (!data || !altId) return undefined;
  return data.alerts.find(a => a.id === altId);
}

export function liveOverlayForCatalogueAlert(catalogueAlertId: string, data: LiveAlertsResponse | null, staticExpositionEur: number): LiveOverlay | undefined {
  const altId = ALERT_TO_ALT[catalogueAlertId];
  const live = findAlt(data, altId);
  if (!live || !data) return undefined;
  return {
    altId,
    exposureEur: live.exposureEur,
    decisionWindowHours: live.decisionWindowHours,
    generatedAt: data.generatedAt,
    matches: live.exposureEur === staticExpositionEur,
  };
}

export function liveOverlayForSituation(situationId: string, data: LiveAlertsResponse | null, staticValeurExposeeEur: number): LiveOverlay | undefined {
  const altId = SITUATION_TO_ALT[situationId];
  const live = findAlt(data, altId);
  if (!live || !data) return undefined;
  return {
    altId,
    exposureEur: live.exposureEur,
    decisionWindowHours: live.decisionWindowHours,
    generatedAt: data.generatedAt,
    matches: live.exposureEur === staticValeurExposeeEur,
  };
}

// Petit rendu relatif "il y a Xs"/"à HH:MM" pour l'horodatage live — jamais
// de dépendance externe pour ça.
export function relativeFreshness(iso: string, nowMs = Date.now()): string {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return iso;
  const deltaS = Math.max(0, Math.round((nowMs - t) / 1000));
  if (deltaS < 60) return `il y a ${deltaS}s`;
  const d = new Date(iso);
  return `à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}
