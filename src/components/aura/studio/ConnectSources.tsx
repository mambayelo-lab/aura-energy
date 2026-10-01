// Connecter une source au Studio Supply : cartes de connecteurs honnêtes
// (ce que Supply en tire, ce qu'il faut fournir) et un bloc « Identifiants »
// explicite : URL, méthode d'authentification, secret en variable Vercel
// (lue côté serveur uniquement) ou saisi pour la session, « Tester la connexion ».
import { useState } from "react";
import { KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import type { LiveEndpoint } from "../../../lib/v4/si-connector";
import type { ConnectorKind } from "../../../lib/integration/types";
import { TOOL_PROTOCOLS, kindsFor, toolOf, type ToolProtocols } from "../../../lib/integration/tool-protocols";

export type Access = "rest" | "soap" | "graphql" | "file" | "mcp" | ChannelAccess;
/** Canaux servis par le SDK de connecteurs (budget, cache, métadonnées, échantillon, mapping avec score). */
export type ChannelAccess = "odata4" | "salesforce" | "idoc" | "rfc" | "edifact" | "x12" | "as2" | "kafka" | "amqp" | "mq" | "cloudevents" | "cdc" | "sftp" | "sqlhttp" | "grpcweb" | "esb";
export const CHANNEL_ACCESSES: ChannelAccess[] = ["odata4", "salesforce", "idoc", "rfc", "edifact", "x12", "as2", "kafka", "amqp", "mq", "cloudevents", "cdc", "sftp", "sqlhttp", "grpcweb", "esb"];
const isChannel = (a: Access): a is ChannelAccess => (CHANNEL_ACCESSES as string[]).includes(a);
export type AuthMethod = "apikey" | "oauth2" | "userpass" | "bearer" | "none";

export interface Connector {
  id: string; label: string; type: string;
  donnees: string;   // ce que Supply en tire
  fournir: string;   // ce qu'il faut fournir
  access: Access; auth: AuthMethod;
  status: "disponible" | "bientot" | "demo";
  urlHint: string; resourceHint: string;
}

// Connecteurs affichés. Les connexions passent par le connecteur générique
// (REST / OData, SOAP, GraphQL, fichier, MCP) ou par le SDK de connecteurs
// (OData v4, SAP IDoc et RFC, Salesforce, EDIFACT, X12, AS2, Kafka, AMQP, MQ,
// CloudEvents, CDC, SFTP, SQL/JDBC, gRPC-web, ESB) ; Snowflake (authentification par paire de
// clés) n'est pas encore pris en charge : import CSV en attendant.
export const CONNECTORS: Connector[] = [
  { id: "sap", label: "SAP S/4HANA", type: "ERP", status: "disponible", access: "rest", auth: "userpass",
    donnees: "Commandes d'achat, stocks, fournisseurs, délais de livraison.",
    fournir: "URL OData du service, utilisateur technique et mot de passe (ou OAuth).",
    urlHint: "https://<hôte>/sap/opu/odata/sap/API_PURCHASEORDER_PROCESS_SRV", resourceHint: "A_PurchaseOrder" },
  { id: "sap-odata4", label: "SAP · OData v4", type: "ERP (S/4HANA, RAP)", status: "disponible", access: "odata4", auth: "bearer",
    donnees: "Toute entité d'un service OData v4 : $metadata lu (types, clés), $filter et $select poussés à la source.",
    fournir: "URL du service ou de l'EntitySet (…/odata/v4/<service>/<EntitySet>) et un jeton ou un utilisateur technique.",
    urlHint: "https://<hôte>/sap/opu/odata4/sap/<service>/srvd_a2x/sap/<service>/0001/PurchaseOrder", resourceHint: "PurchaseOrder" },
  { id: "sap-idoc", label: "SAP · IDoc", type: "ERP (ALE / EDI)", status: "disponible", access: "idoc", auth: "userpass",
    donnees: "Commandes (ORDERS05), avis d'expédition (DESADV01), fournisseurs (CREMAS05), articles (MATMAS05), en XML.",
    fournir: "URL du port IDoc XML (HTTP) et le type d'IDoc à lire ; utilisateur technique.",
    urlHint: "https://<hôte>/sap/idoc/ORDERS05", resourceHint: "ORDERS05" },
  { id: "sap-rfc", label: "SAP · RFC / BAPI", type: "ERP", status: "disponible", access: "rfc", auth: "userpass",
    donnees: "Tables lues par RFC_READ_TABLE (champs et types), BAPI de commande et de fournisseur.",
    fournir: "URL de la passerelle RFC (JSON-RPC sur HTTP) et la table à lire ; utilisateur technique autorisé S_RFC.",
    urlHint: "https://<passerelle>/sap/bc/rfc#EKPO", resourceHint: "EKPO" },
  { id: "salesforce", label: "Salesforce", type: "CRM", status: "disponible", access: "salesforce", auth: "oauth2",
    donnees: "Commandes clients, comptes, opportunités : SOQL (REST) pour les échantillons, Bulk API 2.0 pour les gros volumes.",
    fournir: "URL de l'instance, application connectée : identifiant client et secret (OAuth), objet à lire.",
    urlHint: "https://<domaine>.my.salesforce.com", resourceHint: "Order" },
  { id: "dynamics", label: "Microsoft Dynamics 365", type: "ERP / CRM", status: "disponible", access: "rest", auth: "oauth2",
    donnees: "Commandes, stocks et clients (Supply Chain Management).",
    fournir: "URL de l'environnement, application Entra ID : identifiant client et secret.",
    urlHint: "https://<env>.operations.dynamics.com/data", resourceHint: "PurchaseOrderHeadersV2" },
  { id: "oracle", label: "Oracle ERP / EBS", type: "ERP", status: "disponible", access: "soap", auth: "userpass",
    donnees: "Commandes d'achat, réceptions, fournisseurs.",
    fournir: "URL du service (REST ou SOAP), utilisateur et mot de passe.",
    urlHint: "https://<hôte>/fscmService/PurchaseOrderService", resourceHint: "findPurchaseOrder" },
  { id: "edifact", label: "EDI · EDIFACT", type: "Partenaires (EDI)", status: "disponible", access: "edifact", auth: "bearer",
    donnees: "ORDERS, DESADV, INVOIC (D.96A) : commandes, avis d'expédition, factures, une ligne par article.",
    fournir: "URL du dépôt ou du traducteur EDI (VAN) exposant les échanges, et le type de message.",
    urlHint: "https://<van>/edi/edifact/DESADV", resourceHint: "DESADV" },
  { id: "x12", label: "EDI · ANSI X12", type: "Partenaires (EDI)", status: "disponible", access: "x12", auth: "bearer",
    donnees: "850 (commande), 856 (avis d'expédition), 810 (facture), version 004010.",
    fournir: "URL du dépôt ou du traducteur EDI et le numéro de l'ensemble.",
    urlHint: "https://<van>/edi/x12/856", resourceHint: "856" },
  { id: "as2", label: "AS2", type: "Échange EDI sécurisé", status: "disponible", access: "as2", auth: "bearer",
    donnees: "Messages EDIFACT ou X12 reçus par AS2 ; MIC (SHA-256) vérifié avant lecture.",
    fournir: "URL de la boîte AS2 du partenaire (identifiants AS2-From / AS2-To côté partenaire).",
    urlHint: "https://<partenaire>/as2/message/edifact-desadv", resourceHint: "" },
  { id: "kafka", label: "Kafka", type: "Flux d'événements", status: "disponible", access: "kafka", auth: "bearer",
    donnees: "Topics lus par offset (proxy REST), valeur CloudEvents ou JSON : aucune consommation de groupe.",
    fournir: "URL du proxy REST Kafka et le nom du topic.",
    urlHint: "https://<proxy>/api/kafka", resourceHint: "lucie.tms.shipments" },
  { id: "rabbitmq", label: "RabbitMQ · AMQP", type: "Messagerie", status: "disponible", access: "amqp", auth: "userpass",
    donnees: "Messages d'une file (JSON) via l'API HTTP de management, relus sans être consommés.",
    fournir: "URL de l'API de management et de la file (…/api/queues/<vhost>/<file>), utilisateur en lecture.",
    urlHint: "https://<rabbit>/api/queues/%2F/commandes", resourceHint: "" },
  { id: "ibm-mq", label: "IBM MQ", type: "Messagerie", status: "disponible", access: "mq", auth: "userpass",
    donnees: "Messages d'une file (REST messaging), lecture non destructive, au fil de l'eau.",
    fournir: "URL REST de la file (…/qmgr/<QM>/queue/<FILE>/message), utilisateur MQ en lecture.",
    urlHint: "https://<mq>/ibmmq/rest/v2/messaging/qmgr/QM1/queue/APP.ORDERS/message", resourceHint: "" },
  { id: "webhooks", label: "Webhooks · CloudEvents", type: "Événements", status: "disponible", access: "cloudevents", auth: "bearer",
    donnees: "Lots CloudEvents 1.0 (données de l'évènement), paginés par offset.",
    fournir: "URL du flux CloudEvents (ou de la boîte de réception des webhooks).",
    urlHint: "https://<hub>/cloudevents/<source>/<type>", resourceHint: "" },
  { id: "cdc", label: "CDC · Debezium", type: "Capture de changements", status: "disponible", access: "cdc", auth: "bearer",
    donnees: "Flux de changements (instantané, créations, mises à jour, suppressions) rejoué en état courant.",
    fournir: "URL du flux Debezium (proxy REST du topic de changements).",
    urlHint: "https://<proxy>/cdc/<base>/<table>", resourceHint: "" },
  { id: "sftp", label: "SFTP", type: "Dépôt de fichiers", status: "disponible", access: "sftp", auth: "bearer",
    donnees: "Fichiers CSV, JSON, XML ou Parquet d'un dépôt : listing, téléchargement, lecture.",
    fournir: "URL du fichier sur la passerelle du dépôt (…/sftp/get?path=…) ; clé ou jeton.",
    urlHint: "https://<passerelle>/sftp/get?path=/outbound/stocks.json", resourceHint: "" },
  { id: "jdbc", label: "SQL · JDBC (HTTP)", type: "Data lake / entrepôt", status: "disponible", access: "sqlhttp", auth: "bearer",
    donnees: "Tables du lac en lecture seule : filtres et GROUP BY exécutés par la source.",
    fournir: "URL du point SQL (…/sql) et la table (schéma.table).",
    urlHint: "https://<lac>/sql", resourceHint: "lake.sales" },
  { id: "grpc", label: "gRPC-web", type: "API", status: "disponible", access: "grpcweb", auth: "bearer",
    donnees: "Service de lecture gRPC-web (protobuf), colonnes typées.",
    fournir: "URL de la méthode et la ressource après « # » (source/ressource) ; la réflexion gRPC n'est pas utilisée.",
    urlHint: "https://<hôte>/grpc/lucie.v1.RowService/ListRows#pim/products", resourceHint: "" },
  { id: "esb", label: "ESB · iPaaS", type: "MuleSoft, Boomi", status: "disponible", access: "esb", auth: "bearer",
    donnees: "API d'expérience de l'intégrateur : Aura lit la sortie du flux (demi-flux), avec l'identifiant de corrélation.",
    fournir: "URL du flux (…/api/v1/<flux>) et le jeton du client d'API.",
    urlHint: "https://<esb>/esb/api/v1/inventory", resourceHint: "" },
  { id: "mcp", label: "Serveur MCP", type: "Model Context Protocol", status: "disponible", access: "mcp", auth: "bearer",
    donnees: "Tout serveur MCP : outils et ressources découverts, convertis en tables (métadonnées et échantillon).",
    fournir: "URL du serveur (transport Streamable HTTP) et son jeton.",
    urlHint: "https://maison-lucie-si.vercel.app/mcp", resourceHint: "" },
  { id: "snowflake", label: "Snowflake", type: "Entrepôt de données", status: "bientot", access: "file", auth: "none",
    donnees: "Historique et indicateurs consolidés (demande, service, stocks).",
    fournir: "Bientôt disponible (authentification par paire de clés). En attendant : export CSV ci-dessous.",
    urlHint: "https://…/export.csv", resourceHint: "" },
  { id: "csv", label: "Fichier CSV ou JSON", type: "Fichier", status: "disponible", access: "file", auth: "none",
    donnees: "Tout export tabulaire : stocks, commandes, prévisions.",
    fournir: "L'URL du fichier (et une clé d'API si le lien est protégé).",
    urlHint: "https://…/stocks.csv", resourceHint: "" },
  { id: "autre", label: "Autre API", type: "REST, SOAP, GraphQL, MCP", status: "disponible", access: "rest", auth: "apikey",
    donnees: "Toute table exposée par une API de votre SI.",
    fournir: "URL de base, méthode d'authentification et une première table à lire.",
    urlHint: "https://api.exemple.com", resourceHint: "api/stocks" },
];

/** Protocole du SDK → accès du formulaire (REST/OData v2, fichier et SQL regroupés). */
const ACCESS_OF_KIND: Partial<Record<ConnectorKind, Access>> = { odata: "rest", rest: "rest", manhattan: "rest", file: "file", sql: "sqlhttp", sqlhttp: "sqlhttp", odata4: "odata4", graphql: "graphql", soap: "soap", salesforce: "salesforce", idoc: "idoc", rfc: "rfc", edifact: "edifact", x12: "x12", as2: "as2", kafka: "kafka", amqp: "amqp", mq: "mq", cloudevents: "cloudevents", cdc: "cdc", sftp: "sftp", grpcweb: "grpcweb", esb: "esb", mcp: "mcp" };
/** Accès réalistes pour un type d'outil (natif en premier) ; tous si le type n'est pas précisé. */
export function accessesFor(tool: ToolProtocols | undefined): Access[] {
  const k = kindsFor(tool);
  if (!k) return Object.keys(ACCESS_LABEL) as Access[];
  return [...new Set(k.map(x => ACCESS_OF_KIND[x]).filter((a): a is Access => !!a))];
}
const AUTH_LABEL: Record<AuthMethod, string> = { apikey: "Clé API", oauth2: "OAuth 2.0 (client credentials)", userpass: "Utilisateur / mot de passe", bearer: "Jeton (Bearer)", none: "Aucune" };
const ACCESS_LABEL: Record<Access, string> = { rest: "REST / OData v2", soap: "SOAP", graphql: "GraphQL", file: "Fichier", mcp: "MCP", odata4: "OData v4", salesforce: "Salesforce", idoc: "SAP IDoc", rfc: "SAP RFC / BAPI", edifact: "EDIFACT", x12: "ANSI X12", as2: "AS2", kafka: "Kafka", amqp: "AMQP · RabbitMQ", mq: "IBM MQ", cloudevents: "CloudEvents / webhooks", cdc: "CDC · Debezium", sftp: "SFTP", sqlhttp: "SQL · JDBC", grpcweb: "gRPC-web", esb: "ESB · iPaaS" };

/** Nom de variable Vercel conseillé pour un secret de la source. */
export function vercelVar(label: string, what: string): string {
  const slug = label.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || "SOURCE";
  return `AURA_SRC_${slug}_${what}`;
}
const ref = (name: string) => `{{env:${name}}}`;

/** Un endpoint contient-il un secret en clair (hors références {{env:…}}) ? */
export function hasLiteralSecret(ep: LiveEndpoint | undefined): boolean {
  if (!ep) return false;
  const lit = (v?: string) => !!v && !v.includes("{{env:");
  if (ep.kind === "oauth2_client_credentials") return lit(ep.clientSecret);
  if (ep.kind === "soap" || ep.kind === undefined || ep.kind === "form") return lit((ep as { password?: string }).password);
  if (ep.kind === "mcp") return lit(ep.token);
  if (ep.kind === "channel") return lit(ep.oauth?.clientSecret) || ["Authorization", "X-API-Key"].some(k => lit(ep.headers?.[k]));
  const h = (ep as { headers?: Record<string, string> }).headers ?? {};
  return ["Authorization", "X-API-Key", "X-Client-Secret"].some(k => lit(h[k]));
}

export interface ConnectRequest { endpoint: LiveEndpoint; label: string; type: string; resource: string; access: Access; authLabel: string }

export function buildEndpoint(p: { access: Access; auth: AuthMethod; url: string; label: string; vault: boolean; user: string; secret: string; clientId: string; tokenUrl: string }): LiveEndpoint | null {
  const url = p.url.trim();
  if (!url) return null;
  const secret = p.vault ? ref(vercelVar(p.label, p.auth === "userpass" ? "PASSWORD" : p.auth === "apikey" ? "API_KEY" : p.auth === "oauth2" ? "CLIENT_SECRET" : "TOKEN")) : p.secret;
  if (p.auth !== "none" && !secret) return null;
  if (p.access === "mcp") return { kind: "mcp", serverUrl: url, token: p.auth === "none" ? undefined : secret };
  if (isChannel(p.access)) {
    const headers: Record<string, string> = {};
    if (p.auth === "apikey") headers["X-API-Key"] = secret;
    if (p.auth === "bearer") headers.Authorization = `Bearer ${secret}`;
    if (p.auth === "userpass") { if (!p.user.trim()) return null; headers.Authorization = `Basic-plain ${p.user.trim()}:${secret}`; }
    if (p.auth === "oauth2") { if (!p.clientId.trim()) return null; return { kind: "channel", channel: p.access, url, headers, oauth: { tokenUrl: p.tokenUrl.trim(), clientId: p.clientId.trim(), clientSecret: secret } }; }
    return { kind: "channel", channel: p.access, url, headers };
  }
  if (p.auth === "oauth2") return p.tokenUrl.trim() && p.clientId.trim() ? { kind: "oauth2_client_credentials", tokenUrl: p.tokenUrl.trim(), clientId: p.clientId.trim(), clientSecret: secret, apiBaseUrl: url } : null;
  if (p.access === "soap") return p.user.trim() ? { kind: "soap", serviceUrl: url, user: p.user.trim(), password: secret } : null;
  const headers: Record<string, string> = {};
  if (p.auth === "apikey") headers["X-API-Key"] = secret;
  if (p.auth === "bearer") headers.Authorization = `Bearer ${secret}`;
  if (p.auth === "userpass") { if (!p.user.trim()) return null; headers.Authorization = `Basic-plain ${p.user.trim()}:${secret}`; }
  if (p.access === "file") return { kind: "file", fileUrl: url, headers };
  if (p.access === "graphql") return { kind: "graphql", url, headers };
  return { kind: "http", baseUrl: url, headers };
}

export function ConnectSources({ onConnect, onTest, onDemo }: {
  onConnect: (r: ConnectRequest) => Promise<string | null>;
  onTest: (r: ConnectRequest) => Promise<string>;
  onDemo?: () => void;
}) {
  const [picked, setPicked] = useState<Connector | null>(null);
  const [access, setAccess] = useState<Access>("rest");
  const [toolId, setToolId] = useState<string>("");
  const tool = TOOL_PROTOCOLS.find(t => t.id === toolId);
  const accesses = accessesFor(tool);
  const chooseTool = (id: string) => { setToolId(id); const t = TOOL_PROTOCOLS.find(x => x.id === id); if (t) setAccess(accessesFor(t)[0]); };
  const [auth, setAuth] = useState<AuthMethod>("apikey");
  const [f, setF] = useState({ label: "", type: "", url: "", resource: "", user: "", secret: "", clientId: "", tokenUrl: "" });
  const [vault, setVault] = useState(true);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const pick = (c: Connector) => {
    setPicked(c); setAccess(c.access); setAuth(c.auth); setMsg(null);
    // Type d'outil reconnu : le protocole natif le plus courant est proposé (sauf carte d'un protocole précis).
    const t = toolOf(c.label, c.type); setToolId(t?.id ?? "");
    setF({ label: c.label, type: c.type, url: "", resource: "", user: "", secret: "", clientId: "", tokenUrl: "" });
    setTimeout(() => document.getElementById("studio-connection")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const req = (): ConnectRequest | null => {
    const endpoint = buildEndpoint({ access, auth, vault, ...f });
    if (!endpoint || !f.label.trim()) return null;
    return { endpoint, label: f.label.trim(), type: f.type.trim() || "Application", resource: access === "file" ? f.url.trim() : f.resource.trim(), access, authLabel: AUTH_LABEL[auth] };
  };
  const run = async (kind: "test" | "connect") => {
    const r = req();
    if (!r) { setMsg({ ok: false, text: "Renseignez le nom, l'URL et les identifiants de la méthode choisie." }); return; }
    if (access !== "file" && access !== "mcp" && !isChannel(access) && !r.resource) { setMsg({ ok: false, text: "Indiquez une première table ou route à lire." }); return; }
    setBusy(true); setMsg(null);
    try {
      if (kind === "test") setMsg({ ok: true, text: await onTest(r) });
      else { const e = await onConnect(r); setMsg(e ? { ok: false, text: e } : { ok: true, text: "Source connectée : métadonnées et échantillons lus." }); if (!e) setPicked(null); }
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : "Connexion impossible" }); }
    finally { setBusy(false); }
  };
  const varNames = auth === "none" ? [] : [vercelVar(f.label || "source", auth === "userpass" ? "PASSWORD" : auth === "apikey" ? "API_KEY" : auth === "oauth2" ? "CLIENT_SECRET" : "TOKEN")];
  return (
    <div className="cs">
      <style>{CSS}</style>
      <div className="cs-grid" id="st-catalogue">
        {CONNECTORS.map(c => (
          <article key={c.id} className={`cs-card${c.status === "bientot" ? " soon" : ""}`} data-testid={`connector-${c.id}`}>
            <header><b>{c.label}</b><span className={`cs-pill ${c.status}`}>{c.status === "bientot" ? "bientôt disponible" : c.type}</span></header>
            <p><strong>Données :</strong> {c.donnees}</p>
            <p><strong>À fournir :</strong> {c.fournir}</p>
            {c.status === "bientot"
              ? <button type="button" onClick={() => pick(CONNECTORS.find(x => x.id === "csv")!)}>Importer un CSV</button>
              : <button type="button" onClick={() => pick(c)}>Connecter</button>}
          </article>
        ))}
        {onDemo && <article className="cs-card demo"><header><b>Maison Lucie</b><span className="cs-pill demo">démo</span></header>
          <p><strong>Données :</strong> un SI fictif complet (ERP, WMS, TMS, risques fournisseurs).</p>
          <p><strong>À fournir :</strong> rien, identifiants de démonstration inclus.</p>
          <button type="button" onClick={onDemo}>Charger la démo</button></article>}
      </div>

      {picked && (
        <section className="cs-form" id="studio-connection" aria-label="Identifiants" data-testid="credentials-form">
          <h3><KeyRound size={15} /> Identifiants : {picked.label}</h3>
          <div className="cs-row">
            <label>Nom<input value={f.label} onChange={e => setF({ ...f, label: e.target.value })} /></label>
            <label>Type d'outil<select aria-label="Type d'outil" value={toolId} onChange={e => chooseTool(e.target.value)}><option value="">Non précisé (tous les protocoles)</option>{TOOL_PROTOCOLS.map(t => <option key={t.id} value={t.id}>{t.label} · {t.examples}</option>)}</select></label>
            <label>Accès<select aria-label="Accès" value={access} onChange={e => setAccess(e.target.value as Access)}>{(accesses.includes(access) ? accesses : [access, ...accesses]).map((a, i) => <option key={a} value={a}>{ACCESS_LABEL[a]}{tool && i === 0 && accesses[0] === a ? " (natif)" : ""}</option>)}</select></label>
            <label>Méthode d'authentification<select aria-label="Méthode d'authentification" value={auth} onChange={e => setAuth(e.target.value as AuthMethod)}>{(Object.keys(AUTH_LABEL) as AuthMethod[]).map(a => <option key={a} value={a}>{AUTH_LABEL[a]}</option>)}</select></label>
          </div>
          {tool && <p className="cs-proto" data-testid="tool-protocols">Un {tool.label} ({tool.examples}) expose en standard : {accesses.map(a => ACCESS_LABEL[a]).join(", ")}. Protocole proposé : <b>{ACCESS_LABEL[accesses[0]]}</b>.{tool.aConfirmer ? ` À confirmer : ${tool.aConfirmer}` : ""}</p>}
          <div className="cs-row">
            <label className="wide">URL<input aria-label="URL" placeholder={picked.urlHint} value={f.url} onChange={e => setF({ ...f, url: e.target.value })} /></label>
            {access !== "file" && access !== "mcp" && <label>{isChannel(access) ? "Ressource (facultatif : découverte sinon)" : "Première table ou route"}<input placeholder={picked.resourceHint} value={f.resource} onChange={e => setF({ ...f, resource: e.target.value })} /></label>}
          </div>
          {auth !== "none" && <div className="cs-row">
            {auth === "userpass" && <label>Utilisateur<input value={f.user} onChange={e => setF({ ...f, user: e.target.value })} /></label>}
            {auth === "oauth2" && <><label>URL du jeton<input value={f.tokenUrl} onChange={e => setF({ ...f, tokenUrl: e.target.value })} /></label><label>Identifiant client<input value={f.clientId} onChange={e => setF({ ...f, clientId: e.target.value })} /></label></>}
            <fieldset className="cs-secret">
              <legend>{auth === "userpass" ? "Mot de passe" : auth === "apikey" ? "Clé API" : auth === "oauth2" ? "Secret client" : "Jeton"}</legend>
              <label className="radio"><input type="radio" checked={vault} onChange={() => setVault(true)} /> Variable Vercel (recommandé)</label>
              <label className="radio"><input type="radio" checked={!vault} onChange={() => setVault(false)} /> Saisir pour cette session</label>
              {vault
                ? <p className="cs-var" data-testid="vercel-var">Ajoutez dans Vercel (Settings → Environment Variables) : {varNames.map(v => <code key={v}>{v}</code>)}, puis redéployez.</p>
                : <input type="password" aria-label="Secret" value={f.secret} onChange={e => setF({ ...f, secret: e.target.value })} />}
            </fieldset>
          </div>}
          <p className="cs-store"><ShieldCheck size={13} /> {vault
            ? "Le secret est lu côté serveur dans les variables d'environnement : il n'est jamais envoyé ni stocké dans le navigateur. Seule la référence est enregistrée."
            : "Le secret saisi reste en mémoire le temps de la session et n'est jamais enregistré (ni navigateur, ni serveur). Pour une connexion durable, utilisez une variable Vercel."}</p>
          <div className="cs-actions">
            <button type="button" disabled={busy} onClick={() => void run("test")} data-testid="test-connection"><PlugZap size={14} /> Tester la connexion</button>
            <button type="button" className="primary" disabled={busy} onClick={() => void run("connect")}>{busy ? "Connexion…" : "Connecter et lire les données"}</button>
          </div>
          {msg && <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "cs-ok" : "cs-err"}>{msg.text}</p>}
        </section>
      )}
    </div>
  );
}

const CSS = `
.cs-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.cs-card{border:1px solid var(--v4-border,#e5e3f5);border-radius:10px;padding:12px;background:#fff;display:flex;flex-direction:column;gap:5px}
.cs-card header{display:flex;justify-content:space-between;gap:6px;align-items:center}
.cs-card p{margin:0;font-size:13px;color:#3b3f68;line-height:1.4}
.cs-card button{align-self:flex-start;margin-top:4px;padding:6px 12px;border-radius:8px;border:1px solid #c9c6f3;background:#f4f3ff;color:#4743E6;font-weight:700;cursor:pointer;font-family:inherit}
.cs-card.soon{opacity:.85;border-style:dashed}
.cs-pill{font-size:12px;padding:2px 8px;border-radius:999px;background:#f1f0fb;color:#4c3d7a;white-space:nowrap}
.cs-pill.bientot{background:#fff4e0;color:#8a5a00}.cs-pill.demo{background:#e8f7ef;color:#0d7a54}
.cs-form{margin-top:14px;border:1.5px solid #c9c6f3;border-radius:12px;padding:14px;background:#fbfbff;display:grid;gap:10px}
.cs-form h3{margin:0;font-size:15px;display:flex;gap:6px;align-items:center}
.cs-row{display:flex;flex-wrap:wrap;gap:10px}
.cs-row label{display:grid;gap:3px;font-size:12.5px;color:#4c3d7a;min-width:180px}
.cs-row label.wide{flex:1 1 380px}
.cs-row input,.cs-row select{padding:7px 9px;border-radius:8px;border:1px solid #d9d6f5;font:inherit;font-size:13.5px}
.cs-secret{border:1px solid #d9d6f5;border-radius:8px;padding:6px 10px;display:grid;gap:4px;min-width:280px}
.cs-secret legend{font-size:12.5px;color:#4c3d7a}
.cs-secret label.radio{display:flex;gap:6px;align-items:center;font-size:13px;min-width:0}
.cs-var{margin:0;font-size:12.5px}.cs-var code{background:#eef;padding:1px 5px;border-radius:5px;margin:0 3px}
.cs-store{margin:0;font-size:12.5px;color:#0d7a54;display:flex;gap:6px;align-items:flex-start}
.cs-actions{display:flex;gap:8px}
.cs-actions button{padding:7px 13px;border-radius:8px;border:1px solid #c9c6f3;background:#fff;font-weight:700;cursor:pointer;font-family:inherit;display:inline-flex;gap:6px;align-items:center}
.cs-actions button.primary{background:#4743E6;color:#fff;border-color:#4743E6}
.cs-proto{margin:0;font-size:12.5px;color:#3b3f68;background:#f4f3ff;border-radius:8px;padding:6px 10px}
.cs-ok{color:#0d7a54;margin:0}.cs-err{color:#c0392b;margin:0}
`;
