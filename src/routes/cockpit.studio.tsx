import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow, ArrowRight, CheckCircle2, Database, Link2,
  Network, RadioTower, RefreshCw, ShieldCheck, Trash2,
} from "lucide-react";
import { PageBody, PageHeader } from "../components/aura/AuraUI";
import { OntologyMappingSection } from "../components/aura/OntologyMappingSection";
import { StudioGuide } from "../components/aura/StudioGuide";
import {
  CausalRulesSection, LiveEndpointRow, LivingOntologySection,
  MappingsSection, VocabSection,
} from "../components/aura/studio/StudioSections";
import { SiTablesPanel } from "../components/aura/SiTablesPanel";
import { OntologyGraph } from "../components/aura/studio/SupplyDiagrams";
import { ModelHistoryBar } from "../components/aura/SupplyMemoryUI";
import { LineageView } from "../components/aura/studio/LineageView";
import {
  blankVocab, deriveCurrentValue, importMaisonLucieLive, loadVocab, saveVocab, withSupplyChainRulebook,
  type AppCredential, type AppField, type ArgusVocab,
} from "../lib/v4/argus-vocab-store";
import { discoverMcpEntities, listMcpTools, queryLiveSiRows, testSiConnection, type LiveEndpoint } from "../lib/v4/si-connector";
import { ConnectSources, hasLiteralSecret, type ConnectRequest } from "../components/aura/studio/ConnectSources";
import { loadStudioDraft, saveStudioDraft } from "../lib/v4/studio.functions";
import { applyProposals, attributeValues, proposeMappings, withSupplyChainModel, type Proposal } from "../lib/v4/supply-model";
import { MAISON_LUCIE_DEMO_DOMAIN } from "../lib/v4/supply-demo";
import { SupplyDemoLauncher } from "../components/aura/SupplyDemo";
import { IntegrationJourney } from "../components/aura/studio/IntegrationJourney";
import { audit, useAccess } from "../lib/security/use-access";

export const Route = createFileRoute("/cockpit/studio")({
  validateSearch: (search: Record<string, unknown>): { tab?: string; view?: string; objet?: string } => ({ ...(typeof search.tab === "string" ? { tab: search.tab } : {}), ...(typeof search.view === "string" ? { view: search.view } : {}), ...(typeof search.objet === "string" ? { objet: search.objet } : {}) }),
  component: StudioAuraPage,
});

type Tab = "sources" | "data" | "vocab" | "entities" | "capabilities" | "mapping" | "rules" | "ontology" | "cockpit";

// Parcours du Studio : 5 phases (menu) → pages (sous-menu) → sections de
// page (sous-sous-menu, ancres dans la page).
const PHASES: { label: string; tabs: [Tab, string][] }[] = [
  { label: "Connecter", tabs: [["sources", "Sources"], ["data", "Métadonnées & échantillons"]] },
  // Business Capabilities retirées de Supply : elles n'alimentaient ni les alertes ni les décisions.
  { label: "Modéliser", tabs: [["vocab", "Indicateurs & seuils"], ["entities", "Objets métier"]] },
  { label: "Mapper", tabs: [["mapping", "Mapping"]] },
  { label: "Raisonner", tabs: [["rules", "Règles & alertes"], ["ontology", "Ontologie vivante"]] },
  { label: "Publier", tabs: [["cockpit", "Vers le cockpit"]] },
];
const SECTIONS: Partial<Record<Tab, [string, string][]>> = {
  sources: [],
  data: [["st-actualiser", "Actualisation"], ["st-tables", "Tables lues"]],
  entities: [["st-modele", "Modèle de référence"], ["st-graphe", "Graphe"]],
  mapping: [],
  ontology: [["st-preparation", "Préparation"], ["st-valeurs", "Objets & valeurs"]],
  cockpit: [["st-synthese", "Synthèse"], ["st-faits", "Faits publiés"]],
};
const SUPPLY_MODEL_IDS = ["sc-fournisseur", "sc-article", "sc-stock", "sc-commande", "sc-expedition", "sc-prevision"];
type Light = "green" | "orange" | "grey";
function SectionNav({ items }: { items?: [string, string][] }) {
  if (!items?.length) return null;
  return <nav className="studio-subsub" aria-label="Sections de la page">{items.map(([id, label]) => <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{label}</button>)}</nav>;
}
const ALL_TABS = PHASES.flatMap(phase => phase.tabs.map(([key]) => key));



// Anciennes connexions fictives (SI « Maison Lumen », banc aura-poc-paris) :
// retirées du Studio, quel que soit le domaine enregistré.
const LEGACY_SOURCE = /lumen|aura-poc-paris|duckdns|nexerp|meridian/i;
function isLegacySource(a: AppCredential): boolean {
  const endpoint = a.liveEndpoint as { baseUrl?: string; apiBaseUrl?: string } | undefined;
  return LEGACY_SOURCE.test([a.label, a.endpoint, a.connectionHint, endpoint?.baseUrl, endpoint?.apiBaseUrl].filter(Boolean).join(" "));
}

function withoutLegacyLucie(v: ArgusVocab): ArgusVocab {
  const legacy = new Set(v.apps.filter(isLegacySource).map(a => a.id));
  if (legacy.size) {
    const legacyFields = new Set(v.fields.filter(f => legacy.has(f.appId)).map(f => f.id));
    v = {
      ...v,
      apps: v.apps.filter(a => !legacy.has(a.id)),
      fields: v.fields.filter(f => !legacy.has(f.appId)),
      mappings: v.mappings.filter(m => !legacy.has(m.appId) && !legacyFields.has(m.fieldId)),
      entityMappings: (v.entityMappings ?? []).filter(m => !legacy.has(m.appId) && !legacyFields.has(m.fieldId)),
      siTables: (v.siTables ?? []).filter(t => !legacy.has(t.appId)),
      capabilities: (v.capabilities ?? []).map(c => ({ ...c, appIds: c.appIds.filter(id => !legacy.has(id)) })),
    };
  }
  if (v.domaine === MAISON_LUCIE_DEMO_DOMAIN) return v;
  const removed = new Set(v.apps.filter(a => a.id.startsWith("ml-")).map(a => a.id));
  const apps = v.apps.filter(a => !removed.has(a.id));
  const fields = v.fields.filter(f => !removed.has(f.appId));
  const fieldIds = new Set(fields.map(f => f.id));
  const cleaned: ArgusVocab = {
    ...v,
    apps,
    fields,
    mappings: v.mappings.filter(m => !removed.has(m.appId) && fieldIds.has(m.fieldId)),
    entityMappings: (v.entityMappings ?? []).filter(m => !removed.has(m.appId) && fieldIds.has(m.fieldId)),
    siTables: (v.siTables ?? []).filter(s => !removed.has(s.appId)),
  };
  const legacyEntityNames = new Set(["Boutique flagship", "Direction merchandising", "Fournisseur"]);
  const entities = cleaned.entities ?? [];
  const staleLegacyOntology = apps.length === 0 && entities.length > 0 && entities.every(entity => legacyEntityNames.has(entity.name));
  return staleLegacyOntology ? blankVocab() : cleaned;
}

function persistenceVocab(v: ArgusVocab): ArgusVocab {
  return {
    ...v,
    // Secret saisi en clair : jamais enregistré. Référence {{env:…}} (variable
    // Vercel lue côté serveur) : conservée, elle ne contient aucun secret.
    apps: v.apps.map(({ liveEndpoint: _sessionCredential, ...app }) => ({
      ...app,
      ...(_sessionCredential && !hasLiteralSecret(_sessionCredential as LiveEndpoint) ? { liveEndpoint: _sessionCredential } : {}),
      secretConfigured: Boolean(_sessionCredential) || app.secretConfigured,
    })),
  };
}

// Nom lisible d'une source fichier : le nom du fichier sans extension
// ("demand-forecast.csv" → "demand-forecast"), jamais l'URL complète.
function fileTableName(url: string): string {
  if (url.startsWith("data:")) return "fichier";
  const last = url.split("?")[0].split("/").filter(Boolean).pop() ?? "fichier";
  return decodeURIComponent(last).replace(/\.[a-z0-9]+$/i, "") || "fichier";
}

function addSnapshotAndFields(vocab: ArgusVocab, app: AppCredential, table: string, columns: string[], rows: Record<string, string>[]): ArgusVocab {
  const snapshot = { id: crypto.randomUUID(), appId: app.id, table, columns, rows, fetchedAt: new Date().toISOString() };
  const existing = new Set(vocab.fields.filter(f => f.appId === app.id).map(f => f.name.toLowerCase()));
  const fields: AppField[] = columns
    .filter(c => !existing.has(`${table}.${c}`.toLowerCase()))
    .map(column => ({
      id: crypto.randomUUID(), appId: app.id, name: `${table}.${column}`, liveTable: table,
      sampleValues: rows.map(r => r[column]).filter(Boolean).slice(0, 6),
    }));
  return {
    ...vocab,
    fields: [...vocab.fields, ...fields],
    siTables: [...(vocab.siTables ?? []).filter(s => !(s.appId === app.id && s.table === table)), snapshot],
  };
}

function StudioAuraPage() {
  const search = useSearch({ from: "/cockpit/studio" });
  const requestedTab = ALL_TABS.includes(search.tab as Tab) ? search.tab as Tab : "sources";
  const [tab, setTab] = useState<Tab>(requestedTab);
  const access = useAccess();
  // Vue avancée : administrateur partout ; analyste sur les indicateurs, seuils et règles ; lecteur en lecture.
  const editable = access.can("sources.edit") || ((tab === "vocab" || tab === "rules") && access.can("thresholds.edit"));
  const auditedTab = useRef<Record<string, number>>({});
  // Navigation interne (liens du parcours) : l'onglet suit l'adresse.
  useEffect(() => { setTab(requestedTab); }, [requestedTab]);
  const [mapView, setMapView] = useState<"liste" | "lignage">(search.view === "lignage" ? "lignage" : "liste");
  const [lineageObject, setLineageObject] = useState(search.objet ?? "");
  useEffect(() => { if (search.view === "lignage") setMapView("lignage"); if (search.objet) setLineageObject(search.objet); }, [search.view, search.objet]);
  const [vocab, setVocab] = useState<ArgusVocab>(() => blankVocab());
  const [contextId, setContextId] = useState<string>();
  const [storage, setStorage] = useState<"loading" | "server" | "local">("loading");
  const [syncing, setSyncing] = useState(false);
  const [, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [mcpTools, setMcpTools] = useState<Array<{ name: string; description?: string }>>([]);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);

  useEffect(() => {
    let dead = false;
    const local = withoutLegacyLucie(withSupplyChainRulebook(loadVocab()));
    loadStudioDraft().then(({ context }) => {
      if (dead) return;
      const remote = context?.draft as Partial<ArgusVocab> | undefined;
      const raw = remote?.apps || remote?.fields || remote?.entities ? ({ ...blankVocab(), ...remote } as ArgusVocab) : local;
      const initial = withoutLegacyLucie(withSupplyChainRulebook(raw));
      setContextId(context?.id);
      setStorage("server");
      saveVocab(initial);
      setVocab(initial);
    }).catch(() => {
      if (dead) return;
      saveVocab(local);
      setVocab(local);
      setStorage("local");
    });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (storage !== "server" || !contextId) return;
    setSyncing(true);
    const timer = window.setTimeout(() => {
      saveStudioDraft({ data: {
        contextId,
        name: vocab.domaine || "SCRA Studio",
        sector: "Supply Chain",
        draft: persistenceVocab(vocab) as unknown as Record<string, unknown>,
      }}).then(() => setSyncing(false)).catch(() => { setStorage("local"); setSyncing(false); });
    }, 500);
    return () => window.clearTimeout(timer);
  }, [contextId, storage, vocab]);

  const update = (next: ArgusVocab) => {
    const t = Date.now(); if (t - (auditedTab.current[tab] ?? 0) > 30_000) { auditedTab.current[tab] = t; audit({ vocab: "seuils.modification", rules: "regles.modification", mapping: "mappings.modification", entities: "ontologie.modification", sources: "sources.modification" }[tab as string] ?? "studio.modification", tab); } const clean = withoutLegacyLucie(withSupplyChainRulebook(next)); saveVocab(persistenceVocab(clean)); setVocab(clean); };

  async function syncMaisonLucieDemo() {
    setDemoLoading(true);
    setDemoMessage(null);
    const result = await importMaisonLucieLive(vocab);
    setDemoLoading(false);
    if (!result.ok) {
      setDemoMessage(result.error);
      return;
    }
    update(result.vocab);
    setDemoMessage("Métadonnées et échantillons Maison Lucie actualisés depuis le SI de démonstration.");
  }
  async function testConnection(r: ConnectRequest): Promise<string> {
    if (r.access === "mcp") { const t = await listMcpTools({ data: { endpoint: r.endpoint as Extract<LiveEndpoint, { kind: "mcp" }> } }); if (!t.ok) throw new Error(t.error); return `Connexion réussie : ${t.tools.length} outil(s) exposé(s).`; }
    const t = await testSiConnection({ data: { endpoint: r.endpoint, table: r.resource } });
    if (!t.ok) throw new Error(t.error);
    return `Connexion réussie : ${t.columns} colonne(s) lue(s) sur « ${r.resource || "la première ressource découverte"} ».`;
  }

  async function connectRequest(r: ConnectRequest): Promise<string | null> {
    const app: AppCredential = {
      id: crypto.randomUUID(), label: r.label, type: r.type, connectionHint: r.access === "file" ? "Fichier CSV / JSON" : r.access === "mcp" ? "MCP Streamable HTTP" : r.access === "soap" ? "SOAP" : r.access === "graphql" ? "GraphQL" : r.endpoint.kind === "channel" ? `SDK · ${r.access}` : "REST / OData",
      secretConfigured: true, sourceStatus: "configured", enabled: true, endpoint: r.access === "file" ? r.resource : (r.endpoint as { baseUrl?: string; serviceUrl?: string; url?: string; apiBaseUrl?: string; serverUrl?: string }).baseUrl ?? (r.endpoint as { serviceUrl?: string }).serviceUrl ?? (r.endpoint as { url?: string }).url ?? (r.endpoint as { apiBaseUrl?: string }).apiBaseUrl ?? (r.endpoint as { serverUrl?: string }).serverUrl, authMode: r.authLabel,
      liveEndpoint: r.endpoint,
    };
    try {
      if (r.access === "mcp") {
        const t = await listMcpTools({ data: { endpoint: r.endpoint as Extract<LiveEndpoint, { kind: "mcp" }> } });
        if (!t.ok) return t.error;
        // Connecteur MCP générique : les ressources tabulaires découvertes (outils de catalogue et de requête, ressources JSON) sont proposées à l'import.
        const d = await discoverMcpEntities({ data: { endpoint: r.endpoint as Extract<LiveEndpoint, { kind: "mcp" }> } });
        setMcpTools(d.ok && d.entities.length ? d.entities.map(e => ({ name: e.name, description: `${e.columns.length} colonne(s) : ${e.columns.slice(0, 4).map(c => c.name).join(", ")}${e.columns.length > 4 ? "…" : ""}` })) : t.tools);
        update({ ...vocab, apps: [...vocab.apps, { ...app, sourceStatus: "connected", lastSyncAt: new Date().toISOString() }] });
        return null;
      }
      const tableName = r.access === "graphql" ? (r.resource.match(/\{\s*\w+\s*\{\s*(\w+)/)?.[1] ?? "graphql") : r.access === "file" ? fileTableName(r.resource) : r.endpoint.kind === "channel" && !r.resource ? (decodeURIComponent(new URL(r.endpoint.url).hash.slice(1)) || decodeURIComponent(new URL(r.endpoint.url).pathname.split("/").filter(Boolean).pop() ?? r.access)) : r.resource;
      const q = await queryLiveSiRows({ data: { endpoint: r.endpoint, table: r.resource, limit: 50 } });
      if (!q.ok) return q.error;
      const connected = { ...app, sourceStatus: "connected" as const, lastSyncAt: new Date().toISOString() };
      update(addSnapshotAndFields({ ...vocab, apps: [...vocab.apps, connected] }, connected, tableName, q.columns, q.rows));
      setTab("data");
      return null;
    } catch (e) { return e instanceof Error ? e.message : "Connexion impossible"; }
  }

  async function importMcpTool(name: string) {
    const app = [...vocab.apps].reverse().find(a => a.liveEndpoint?.kind === "mcp");
    if (!app?.liveEndpoint) return;
    setConnecting(true); setConnectError(null);
    const r = await queryLiveSiRows({ data: { endpoint: app.liveEndpoint, table: name, limit: 10 } });
    setConnecting(false);
    if (!r.ok) { setConnectError(r.error); return; }
    update(addSnapshotAndFields(vocab, app, name, r.columns, r.rows));
    setTab("data");
  }

  function removeApp(id: string) {
    const fieldIds = new Set(vocab.fields.filter(f => f.appId === id).map(f => f.id));
    update({
      ...vocab,
      apps: vocab.apps.filter(a => a.id !== id),
      fields: vocab.fields.filter(f => f.appId !== id),
      mappings: vocab.mappings.filter(m => m.appId !== id && !fieldIds.has(m.fieldId)),
      entityMappings: (vocab.entityMappings ?? []).filter(m => m.appId !== id && !fieldIds.has(m.fieldId)),
      siTables: (vocab.siTables ?? []).filter(s => s.appId !== id),
    });
  }


  const publishedFacts = useMemo(() => (vocab.entityMappings ?? []).map(mapping => {
    const app = vocab.apps.find(item => item.id === mapping.appId);
    const field = vocab.fields.find(item => item.id === mapping.fieldId);
    const entity = (vocab.entities ?? []).find(item => item.id === mapping.entityId);
    const attribute = entity?.attributes.find(item => item.id === mapping.attributeId);
    return {
      id: mapping.id,
      label: entity && attribute ? `${entity.name}.${attribute.name}` : field?.name ?? "Fait mappé",
      value: (() => { const obs = attributeValues(vocab, mapping.entityId, mapping.attributeId); return obs.count ? obs.count > 1 ? `${obs.values[0]} (+${obs.count - 1})` : obs.values[0] : field?.sampleValues?.[0] ?? "—"; })(),
      source: app?.label ?? "Source inconnue",
      master: mapping.isMaster,
    };
  }), [vocab]);

  const coverage = useMemo(() => {
    const attrs = (vocab.entities ?? []).flatMap(e => e.attributes);
    const mapped = new Set((vocab.entityMappings ?? []).map(m => `${m.entityId}:${m.attributeId}`));
    return { mapped: mapped.size, total: attrs.length, pct: attrs.length ? Math.round(mapped.size / attrs.length * 100) : 0 };
  }, [vocab]);

  const proposals: Proposal[] = useMemo(() => proposeMappings(vocab), [vocab]);
  const phaseLights: Light[] = useMemo(() => {
    const connected = vocab.apps.filter(a => a.sourceStatus === "connected").length;
    const sampled = (vocab.siTables ?? []).length;
    const entities = (vocab.entities ?? []).length;
    const kpiMapped = vocab.kpis.filter(k => vocab.mappings.some(m => m.kpiId === k.id)).length;
    const fed = vocab.kpis.filter(k => deriveCurrentValue(vocab, k.id) !== undefined).length;
    return [
      connected && sampled ? "green" : vocab.apps.length ? "orange" : "grey",
      entities && vocab.kpis.length ? "green" : vocab.kpis.length ? "orange" : "grey",
      kpiMapped === vocab.kpis.length && coverage.pct >= 80 ? "green" : kpiMapped || coverage.mapped ? "orange" : "grey",
      fed === vocab.kpis.length && vocab.kpis.length ? "green" : fed ? "orange" : "grey",
      fed && coverage.pct >= 80 ? "green" : fed || coverage.mapped ? "orange" : "grey",
    ];
  }, [vocab, coverage]);

  return <div className="studio-page">
    <PageHeader hero title="Studio" badge="Aura Supply Chain" actions={<StudioGuide vocab={vocab} onUpdate={update} onSection={key => setTab(({ apps: "sources", mappings: "mapping" } as Record<string, Tab>)[key] ?? (ALL_TABS.includes(key as Tab) ? key as Tab : "sources"))} />} />
    <PageBody width={1240}>
      <style>{css}</style>
      {!search.tab ? <IntegrationJourney vocab={vocab} onUpdate={update} /> : <>
      <p className="studio-back"><Link to="/cockpit/studio">← Parcours en 4 étapes</Link> · vue avancée</p>
      <div className="studio-status"><span><RadioTower size={13}/>{vocab.apps.filter(a => a.sourceStatus === "connected").length} source(s) connectée(s)</span><span><Database size={13}/>{vocab.fields.length} métadonnée(s)</span><span><Network size={13}/>{coverage.pct}% ontologie couverte</span><span><ShieldCheck size={13}/>{storage === "server" ? syncing ? "Synchronisation…" : "Persisté côté Studio" : storage === "local" ? "Persistance locale" : "Chargement…"}</span></div>
      <nav className="studio-steps" aria-label="Phases du Studio">
        {PHASES.map((phase, index) => {
          const active = phase.tabs.some(([key]) => key === tab);
          return <button key={phase.label} className={active ? "active" : ""} onClick={() => setTab(phase.tabs[0][0])}>
            <span className="step-num">{index + 1}</span><span className="step-label">{phase.label}</span><i className={`light ${phaseLights[index]}`} title={phaseLights[index] === "green" ? "Terminé" : phaseLights[index] === "orange" ? "En cours" : "À faire"} />
          </button>;
        })}
      </nav>
      <nav className="studio-tabs" aria-label="Pages de la phase">
        {(PHASES.find(phase => phase.tabs.some(([key]) => key === tab)) ?? PHASES[0]).tabs.map(([key, label]) => <button key={key} className={tab === key ? "active" : ""} onClick={() => setTab(key)}>{label}</button>)}
        {(tab === "vocab" || tab === "entities" || tab === "mapping" || tab === "rules") && <span style={{ marginLeft: "auto" }}><ModelHistoryBar vocab={vocab} ready={storage !== "loading"} onApply={update} /></span>}
      </nav>
      <SectionNav items={SECTIONS[tab]} />
      {!editable && <p className="studio-ro" role="note">Lecture seule pour votre rôle ({access.role}).</p>}
      <fieldset className="studio-fs" disabled={!editable}>

      {tab === "sources" && <section>
        <div className="heading"><div><h2 title="Les règles Supply Chain Aura sont déjà disponibles. Connectez ici les sources qui fourniront leurs valeurs, sans créer de mapping automatique.">Connecter une application</h2></div><div className="heading-actions"><button className="danger" onClick={() => { if (confirm("Vider toutes les sources, métadonnées et mappings du Studio ?")) update(blankVocab()); }}><Trash2 size={13}/>Repartir de zéro</button></div></div>
        <div className="demo-oneclick" id="st-demo"><div><b title="Installe les sources Maison Lucie, lit leurs données, charge le modèle objet, valide les mappings proposés (≥ 75 %) et publie les alertes réelles vers le cockpit.">Démo en un clic</b></div><SupplyDemoLauncher variant="studio" vocab={vocab} onApplied={update} onReset={update} /></div>
        <ConnectSources onTest={testConnection} onConnect={connectRequest} />
        <div className="connected-title" id="st-connectees"><b>Applications connectées</b><span>{vocab.apps.length}</span></div>
        <div className="source-grid">{vocab.apps.map(app => <article key={app.id}><div className="source-icon"><AppWindow size={17}/></div><div><b title={`${app.endpoint ?? app.connectionHint ?? ""}${app.authMode ? ` · ${app.authMode}` : ""}`}>{app.label}</b><span>{app.type}</span><small className={app.sourceStatus === "connected" ? "ok" : ""} title={app.demoCredentials?.length ? `${app.demoCredentials.length} identifiant(s) démo` : undefined}>{app.sourceStatus === "connected" ? "● Connectée" : "○ Configurée"}</small><LiveEndpointRow app={app} vocab={vocab} onUpdate={update}/></div><button onClick={() => removeApp(app.id)} title="Supprimer"><Trash2 size={13}/></button></article>)}</div>
        {!vocab.apps.length && <div className="empty">Aucune application connectée. Commence par une source REST/OAuth2 ou MCP.</div>}
        {demoMessage && <div className="demo-message">{demoMessage}</div>}
        <div className="connect-box">
          {connectError && <div className="error">{connectError}</div>}
          {!!mcpTools.length && <div className="tools"><b>Tools MCP découverts</b>{mcpTools.map(t => <button key={t.name} onClick={() => importMcpTool(t.name)}><span>{t.name}</span><small>{t.description}</small><ArrowRight size={12}/></button>)}</div>}
        </div>
      </section>}

      {tab === "data" && <section><div className="heading"><div><small>MÉTADONNÉES & ÉCHANTILLONS</small><h2>Observer ce que le SI expose réellement</h2><p>Les colonnes découvertes deviennent des champs sources ; leurs valeurs d’échantillon alimentent ensuite le moteur de mapping.</p></div>{vocab.apps.some(app => app.id.startsWith("ml-")) && <div className="heading-actions"><button className="demo-button" disabled={demoLoading} onClick={syncMaisonLucieDemo}><RefreshCw size={13}/>{demoLoading ? "Actualisation…" : "Actualiser les données Maison Lucie"}</button><a className="secondary-link" href="https://maison-lucie-si.vercel.app/" target="_blank" rel="noreferrer">Ouvrir Maison Lucie <ArrowRight size={12}/></a></div>}</div><div id="st-actualiser">{demoMessage ? <div className="demo-message">{demoMessage}</div> : <div className="demo-message">{(vocab.siTables ?? []).length} table(s) lue(s){(vocab.siTables ?? []).length ? ` · dernière lecture ${new Date(Math.max(...(vocab.siTables ?? []).map(t => Date.parse(t.fetchedAt)))).toLocaleString("fr-FR")}` : " — utilisez l’actualisation ou connectez une source."}</div>}</div><div id="st-tables"><SiTablesPanel vocab={vocab} onUpdate={update}/></div></section>}

      {tab === "vocab" && <section><div className="heading"><div><small>INDICATEURS & SEUILS</small><h2>Les grandeurs suivies par Aura Supply Chain</h2><p>Chaque indicateur porte son sens (au-dessus ou en dessous = alerte) et ses seuils ; les règles causales s'appuient sur ces seuils.</p></div></div><VocabSection vocab={vocab} onUpdate={update}/></section>}

      {tab === "entities" && <section><div className="heading"><div><small>OBJETS MÉTIER</small><h2>Le modèle cible : objets, attributs, relations</h2><p>Le vocabulaire qui structure les mappings et l'ontologie vivante.</p></div></div><div className="model-target" id="st-modele"><div><b>Modèle objet de référence Aura Supply Chain</b><span>Fournisseur, Article, Stock, Commande d’achat, Expédition, Prévision de demande et leurs relations. Structure seulement : les valeurs viendront de vos sources, après mapping.</span></div><button className="primary" onClick={() => update(withSupplyChainModel(vocab))} disabled={SUPPLY_MODEL_IDS.every(id => (vocab.entities ?? []).some(x => x.id === id))}><Network size={13}/>{SUPPLY_MODEL_IDS.every(id => (vocab.entities ?? []).some(x => x.id === id)) ? "Modèle chargé" : "Charger le modèle Supply Chain"}</button></div><div id="st-graphe"><OntologyGraph vocab={vocab} onUpdate={update} onOpenTab={key => { if (key === "mapping") setMapView("lignage"); if (ALL_TABS.includes(key as Tab)) setTab(key as Tab); }}/></div></section>}


      {tab === "mapping" && <section>
        {/* Vue principale : la couverture du mapping par objet ; un clic ouvre
            la liste courte des attributs à compléter (candidats classés), ou
            le Lignage filtré sur l'objet. Les propositions ≥ 75 % se valident
            d'un clic ; les indicateurs se branchent dans le repli du bas. */}
        <div className="heading"><div><h2 title="Le moteur combine similarité sémantique, métadonnées et échantillons avec une analyse LLM ; le branchement et la source MASTER restent validés humainement.">Couverture du mapping</h2></div>
          <div className="heading-actions">
            {proposals.length > 0 && <button className="primary" data-testid="validate-proposals" title={proposals.map(p => `${p.targetLabel} ← ${p.fieldName} (${Math.round(p.score * 100)} %)`).join("\n")} onClick={() => update(applyProposals(vocab, proposals))}><CheckCircle2 size={13}/>Valider les {proposals.length} propositions ≥ 75 %</button>}
            <div className="map-view-toggle" role="tablist" aria-label="Vue du mapping"><button role="tab" aria-selected={mapView === "liste"} className={mapView === "liste" ? "active" : ""} onClick={() => setMapView("liste")}>Couverture</button><button role="tab" aria-selected={mapView === "lignage"} className={mapView === "lignage" ? "active" : ""} onClick={() => setMapView("lignage")}>Lignage</button></div>
          </div></div>
        {mapView === "lignage"
          ? <div className="subsection" id="st-lignage"><LineageView key={lineageObject} vocab={vocab} onUpdate={update} initialObject={lineageObject}/></div>
          : <>
            <div className="subsection" id="st-map-attr"><OntologyMappingSection vocab={vocab} onUpdate={update} onLineage={id => { setLineageObject(id); setMapView("lignage"); }}/></div>
            <details className="subsection" id="st-map-kpi"><summary><b>Indicateurs ↔ champs sources ({vocab.mappings.length} branché(s) sur {vocab.kpis.length})</b></summary><MappingsSection vocab={vocab} onUpdate={update}/></details>
          </>}
      </section>}

      {tab === "rules" && <section><div className="heading"><div><small>RÈGLES & ALERTES</small><h2>Alertes et règles causales éditables</h2><p>Une alerte surveille un indicateur, une règle causale en croise plusieurs ; chacune ouvre une décision quand elle se déclenche. Seules les valeurs réellement mappées la font déclencher.</p></div></div><CausalRulesSection vocab={vocab} onUpdate={update}/></section>}

      {tab === "ontology" && <section><div className="heading"><div><small>ONTOLOGIE VIVANTE</small><h2>Objets, attributs, sources et couverture</h2><p>Vue consolidée du modèle cible et des mappings validés : provenance, source MASTER et couverture restent traçables avant publication.</p></div><strong className="coverage">{coverage.pct}% couvert</strong></div><div id="st-preparation"><LivingOntologySection vocab={vocab} onUpdate={update}/></div><div className="subsection" id="st-valeurs"><b>Objets & valeurs observées</b><p className="hint"><i className="light green"/> branché et alimenté · <i className="light orange"/> branché sans valeur lue · <i className="light grey"/> non branché</p></div><div className="ontology-grid">{(vocab.entities ?? []).map(entity => <article key={entity.id}><b>{entity.name}</b>{entity.description && <p className="entity-desc">{entity.description}</p>}{entity.attributes.map(attr => { const links=(vocab.entityMappings??[]).filter(m=>m.entityId===entity.id&&m.attributeId===attr.id); const obs = attributeValues(vocab, entity.id, attr.id); const light = !links.length ? "grey" : obs.count ? "green" : "orange"; return <div key={attr.id} className="attr-row"><span><i className={`light ${light}`}/>{attr.name}</span><div className="attr-values">{obs.count ? <><span className="vals">{obs.values.slice(0, 5).map((v, i) => <code key={i}>{v}</code>)}{obs.count > 5 && <small>+{obs.count - 5}</small>}</span><small>{obs.source} · {obs.count} valeur(s){links.some(l => l.isMaster) ? " · MASTER" : ""}</small></> : <small>{links.length ? `${links.map(l=>vocab.apps.find(a=>a.id===l.appId)?.label ?? "?").join(" + ")} · aucune valeur lue` : "non branché"}</small>}</div></div>; })}</article>)}</div>{!(vocab.entities ?? []).length && <div className="empty">Aucun objet métier : chargez le modèle Supply Chain (Modéliser → Objets métier), puis validez ses branchements dans Mapping.</div>}</section>}

      {tab === "cockpit" && <section><div className="heading"><div><small>PUBLICATION VERS SCRA</small><h2>Ce que le cockpit peut consommer maintenant</h2><p>Le cockpit lit le même vocabulaire : seules les données connectées et mappées deviennent des faits de pilotage.</p></div><Link className="primary-link" to="/cockpit/resilience" search={{ section: "cockpit" }}>Voir le cockpit <ArrowRight size={13}/></Link></div><div className="publish-grid" id="st-synthese"><article><Database size={18}/><b>{vocab.apps.filter(a=>a.enabled!==false).length}</b><span>sources actives</span></article><article><Link2 size={18}/><b>{publishedFacts.length}</b><span>faits publiables</span></article><article><Network size={18}/><b>{coverage.pct}%</b><span>couverture ontologique</span></article><article><CheckCircle2 size={18}/><b>{publishedFacts.filter(f=>f.value!=="—").length}</b><span>faits alimentés</span></article></div>{publishedFacts.length>0 ? <div className="readings" id="st-faits">{publishedFacts.map(f=><div key={f.id}><span>{f.label}</span><b>{f.value}</b><small>{f.source}{f.master ? " · MASTER" : ""}</small></div>)}</div> : <div className="empty">Aucun fait publié : connecte une source, découvre ses champs, crée les objets métier puis valide les mappings.</div>}<p className="publish-note">Les secrets saisis servent uniquement à la session de connexion et ne sont jamais enregistrés dans le navigateur ni dans le brouillon Studio.</p></section>}

      </fieldset>
      <footer className="studio-footer"><ShieldCheck size={13}/>Validation humaine avant publication</footer>
      </>}
    </PageBody>
  </div>;
}

const css = `
.studio-fs{border:0;padding:0;margin:0;min-width:0}.studio-ro{font-size:13px;color:#7a4a00;background:#fff7e6;border:1px solid #f3d08a;border-radius:8px;padding:6px 10px}
.studio-back{font-size:13px;color:#6b6f8a;margin:0 0 8px}.studio-back a{color:#4b3fa8;font-weight:600}
.studio-page{display:flex;flex:1;min-height:0;flex-direction:column;background:#fff}.studio-brand{padding:2px 4px}.studio-status{display:flex;gap:18px;flex-wrap:wrap;padding:10px 0 14px;border-bottom:1px solid #eee;color:#666;font-size:13px}.studio-status span{display:flex;align-items:center;gap:5px}.studio-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:14px 0 10px}.studio-steps button{display:flex;align-items:center;gap:8px;border:1px solid var(--v4-border,#e5e7eb);background:var(--v4-surface,#fff);border-radius:10px;padding:9px 11px;cursor:pointer;font:700 13px var(--font-sans);color:var(--v4-text2,#555);min-width:0}.studio-steps button.active{border-color:var(--v4-accent,#7c3aed);background:var(--v4-accent-bg,#f3efff);color:var(--v4-accent2,#6d28d9);box-shadow:0 0 0 3px color-mix(in srgb,var(--v4-accent,#7c3aed) 12%,transparent)}.step-num{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--v4-panel,#f3f4f6);font-size:13px;flex:none}.studio-steps button.active .step-num{background:var(--v4-accent,#7c3aed);color:#fff}.step-label{flex:1;text-align:left;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.light{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none;margin-right:5px;vertical-align:middle}.light.green{background:#16a34a;box-shadow:0 0 0 3px #16a34a22}.light.orange{background:#d97706;box-shadow:0 0 0 3px #d9770622}.light.grey{background:#cbd5e1}.map-view-toggle{display:inline-flex;gap:4px;margin:4px 0 12px;padding:3px;border:1px solid var(--v4-border,#e5e5e5);border-radius:999px}.map-view-toggle button{border:0;background:none;border-radius:999px;padding:5px 14px;font:700 13px var(--font-sans);color:var(--v4-text2,#555);cursor:pointer}.map-view-toggle button.active{background:var(--v4-accent,#7c3aed);color:#fff}
.studio-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:2px solid var(--aura-ink,#15121f);margin:0 0 10px;padding-bottom:10px}.studio-subsub{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;gap:4px 14px;margin:0 0 18px;padding:8px 0;background:var(--v4-surface,#fff);border-bottom:1px dashed var(--v4-border,#eee)}.studio-subsub button{border:0;background:none;padding:2px 0;font:650 13px var(--font-sans);color:var(--v4-text3,#777);cursor:pointer;border-bottom:2px solid transparent}.studio-subsub button:hover{color:var(--v4-accent2,#6d28d9);border-bottom-color:var(--v4-accent,#7c3aed)}.hint{font-size:13px;color:var(--v4-text3,#777);margin:0;display:flex;align-items:center;gap:4px;flex-wrap:wrap}.proposals{display:grid;gap:1px;background:#eee;border:1px solid #eee;border-radius:8px;overflow:hidden}.proposals>div{display:grid;grid-template-columns:14px 72px minmax(160px,1.2fr) 14px minmax(160px,1.2fr) minmax(120px,1fr) 44px auto;gap:8px;align-items:center;background:#fff;padding:8px 10px;font-size:13px}.proposals .kind{font-size:12.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:var(--v4-text3,#888)}.proposals code{font-size:13px;color:var(--v4-accent2,#6d28d9);overflow-wrap:anywhere}.proposals small{color:#888;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.proposals em{font-style:normal;font-weight:800;color:#15803d}.proposals button{border:1px solid var(--v4-accent-border,#ddd6fe);background:var(--v4-accent-bg,#f3efff);color:var(--v4-accent2,#6d28d9);border-radius:7px;padding:5px 9px;font:700 13px var(--font-sans);cursor:pointer}.entity-desc{font-size:13px;color:#888;margin:3px 0 6px}.attr-row>span{display:flex;align-items:center;font-weight:650}.attr-values{display:grid;gap:3px;min-width:0}.vals{display:flex;flex-wrap:wrap;gap:3px}.vals code{font-size:13px;background:var(--v4-panel,#f5f3ff);border-radius:4px;padding:1px 5px;color:var(--v4-text,#1f1147)}@media(max-width:900px){.studio-steps{grid-template-columns:repeat(2,minmax(0,1fr))}.proposals>div{grid-template-columns:14px 1fr;}.proposals>div>*:nth-child(n+3){grid-column:2}}.studio-phase{display:flex;flex-direction:column;gap:4px}.studio-phase>small{font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--v4-text3,#999)}.studio-phase>div{display:flex;gap:4px;flex-wrap:wrap}.studio-tabs button{border:1px solid var(--v4-border,#e5e5e5);background:var(--v4-surface,#fff);padding:6px 11px;border-radius:999px;font:650 13.5px var(--font-sans);color:var(--v4-text2,#555);white-space:nowrap;cursor:pointer}.subsection{margin-top:22px;display:flex;flex-direction:column;gap:10px}.subsection>b{font-size:13.5px;color:var(--v4-text,#111)}.studio-tabs button.active{color:var(--v4-accent2,#111);border-color:var(--v4-accent,#111);background:var(--v4-accent-bg,#f3f3f3)}.rule-grid{display:grid;gap:12px}.rule-card{border:1px solid var(--v4-border,#d8d8d8);border-radius:10px;padding:14px;background:#fff;display:grid;gap:10px}.rule-card-head{display:grid;grid-template-columns:38px minmax(180px,1fr) auto;gap:9px;align-items:center}.rule-card-head>span{font-weight:800;color:var(--v4-accent,#2b2b2b)}.rule-card-head>input,.rule-card textarea,.rule-thresholds input{border:1px solid var(--v4-border,#d8d8d8);border-radius:7px;padding:7px 9px;font:inherit}.rule-card textarea{min-height:62px;resize:vertical}.rule-card-head label{font-size:13px;font-weight:700;display:flex;align-items:center;gap:5px}.rule-thresholds{display:grid;gap:8px}.rule-thresholds>div{display:grid;grid-template-columns:minmax(180px,1.2fr) minmax(240px,1.5fr) 125px 125px 125px;gap:8px;align-items:center;background:var(--v4-panel,#f7f7f7);padding:9px;border-radius:8px;font-size:13px}.rule-thresholds select{border:1px solid var(--v4-border,#d8d8d8);border-radius:7px;padding:6px;font:inherit;min-width:0}.rule-value{font-weight:750}.rule-value.fed{color:#047857}.rule-value.unfed{color:#b45309}.rule-thresholds label{display:flex;align-items:center;gap:5px}.rule-thresholds input{width:72px;padding:5px}.rule-unfed{font-size:13px;color:var(--v4-text3,#777)}@media(max-width:760px){.rule-card-head,.rule-thresholds>div{grid-template-columns:1fr}}.heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.heading small{font-size:12.5px;letter-spacing:.1em;color:#999;font-weight:700}.heading h2{font-size:20px;margin:5px 0;color:#111;font-weight:650}.heading p{margin:0;font-size:13px;color:#888;max-width:760px;line-height:1.55}.heading-actions{display:flex;gap:7px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.demo-button,.secondary-link{display:inline-flex;align-items:center;gap:6px;border:1px solid #c7d2fe;background:#eef2ff;color:#4338ca;border-radius:8px;padding:8px 10px;font:700 13px var(--font-sans);text-decoration:none}.demo-button:disabled{opacity:.55;cursor:wait}.secondary-link{background:#fff;color:#555;border-color:#ddd}.demo-message{margin:0 0 14px;padding:10px 12px;border:1px solid #dbe4ff;border-radius:8px;background:#f8faff;color:#334155;font-size:13px}.demo-oneclick{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.1fr);gap:14px;align-items:start;border:1px solid #fed7aa;background:#fffaf3;border-radius:12px;padding:14px;margin-bottom:18px}.demo-oneclick>div:first-child{display:grid;gap:4px}.demo-oneclick>div:first-child b{font-size:14px;color:#111}.demo-oneclick>div:first-child span{font-size:13px;color:#666;line-height:1.5}@media(max-width:850px){.demo-oneclick{grid-template-columns:1fr}}.catalog-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:20px}.catalog-grid article{border:1px solid var(--v4-border,#e5e7eb);border-radius:8px;padding:12px;display:grid;grid-template-columns:36px minmax(0,1fr);gap:8px 10px;align-items:start;background:#fff;min-width:0}.catalog-grid article>button{grid-column:2;justify-self:start}.catalog-grid b,.catalog-grid span,.catalog-grid small{display:block}.catalog-grid b{font-size:13px}.catalog-grid span,.catalog-grid small{font-size:12.5px;color:#888}.catalog-grid button{white-space:nowrap;border:1px solid var(--v4-accent-border,#c9dcff);background:var(--v4-accent-bg,#edf5ff);color:var(--v4-accent2,#1764c0);border-radius:8px;padding:6px 10px;cursor:pointer;font:650 13px var(--font-sans)}.connected-title{display:flex;align-items:center;gap:8px;margin:4px 0 8px;font-size:13px}.connected-title span{background:#f1f3f5;border-radius:999px;padding:2px 7px;color:#777}.source-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1px;background:#eee;border:1px solid #eee}.source-grid article{display:grid;grid-template-columns:36px 1fr auto;gap:10px;padding:13px;background:#fff}.source-icon{width:34px;height:34px;display:grid;place-items:center;background:#f5f5f5;border-radius:8px}.source-grid b,.source-grid span,.source-grid small{display:block}.source-grid b{font-size:13.5px}.source-grid span{font-size:13px;color:#777;margin:2px 0}.source-grid small{font-size:12.5px;color:#aaa;overflow-wrap:anywhere}.source-grid small.ok{color:#087b56;font-weight:700}.source-grid article>button{border:0;background:transparent;color:#aaa}.empty{padding:20px;border:1px dashed #ddd;color:#999;font-size:13px}.connect-box{margin-top:18px;border-top:1px solid #eee;padding-top:18px}.protocols{display:flex;gap:4px;margin-bottom:12px}.protocols button{border:1px solid #ddd;background:#fff;border-radius:999px;padding:6px 10px;font:650 13px var(--font-sans);color:#777}.protocols button.active{background:var(--v4-accent,#7c3aed);color:#fff;border-color:var(--v4-accent,#7c3aed)}.form-grid{display:grid;grid-template-columns:repeat(3,minmax(150px,1fr));gap:7px;margin-bottom:10px}.form-grid input,.entity-add input{border:1px solid #ddd;border-radius:8px;padding:9px 10px;font:500 13px var(--font-sans)}.primary,.entity-add button,.primary-link{display:inline-flex;align-items:center;gap:6px;border:0;border-radius:8px;background:var(--aura-ink,#15121f);color:#fff;padding:9px 12px;font:650 13px var(--font-sans);text-decoration:none}.danger{display:inline-flex;align-items:center;gap:6px;border:1px solid #ddd;background:#fff;color:#777;border-radius:8px;padding:8px 10px;font:650 13px var(--font-sans)}.error{color:#a33;font-size:13px;margin-top:8px}.tools{display:grid;gap:1px;background:#eee;border:1px solid #eee;margin-top:14px}.tools>b{padding:10px;background:#fafafa;font-size:13px}.tools button{display:grid;grid-template-columns:1fr auto;gap:4px 10px;text-align:left;border:0;background:#fff;padding:10px}.tools button span{font-size:13px;font-weight:700}.tools button small{font-size:12.5px;color:#888;grid-column:1}.coverage{font-size:22px}.model-target{border:1px solid #e5e7eb;border-radius:10px;padding:14px;margin-bottom:16px;background:#fafafa}.model-target{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.model-target>div:first-child{display:grid;gap:3px;max-width:720px}.model-target b,.mapping-stage>b{font-size:13px;color:#111}.model-target span{font-size:13px;color:#777}.mapping-stage{display:grid;gap:10px}.entity-add{display:grid;grid-template-columns:1fr 2fr auto;gap:7px;margin-bottom:16px}.ontology-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px}.ontology-grid article{border:1px solid #e5e5e5;border-radius:10px;padding:13px}.ontology-grid article>b{font-size:13px}.ontology-grid article>div{display:grid;grid-template-columns:1fr 1.3fr;gap:8px;padding:7px 0;border-top:1px solid #f2f2f2;font-size:13px}.ontology-grid small{color:#777}.publish-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:#eee;border:1px solid #eee}.publish-grid article{background:#fff;padding:18px;display:grid;gap:5px}.publish-grid article b{font-size:22px}.publish-grid article span{font-size:13px;color:#888}.readings{margin-top:16px;border-top:1px solid #eee}.readings>div{display:grid;grid-template-columns:1fr 120px 80px;padding:9px 0;border-bottom:1px solid #eee;font-size:13px}.readings small{color:#777}.publish-note{font-size:13px;color:#888;margin-top:16px}.studio-footer{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:28px;padding-top:14px;border-top:1px solid #eee;color:#888;font-size:13px}.studio-footer a{color:#555;text-decoration:none}@media(max-width:850px){.heading-actions{justify-content:flex-start}.form-grid{grid-template-columns:1fr}.publish-grid{grid-template-columns:repeat(2,1fr)}.entity-add{grid-template-columns:1fr}.heading{flex-direction:column}}
`;