// StudioSections.tsx — sections riches du Studio d'Aura Supply Chain :
// vocabulaire métier et seuils, objets métier et relations, applications et
// identifiants, capabilities, échantillons, mapping indicateur ↔ champ
// (sémantique + IA), règles causales (éditeur, suggestions IA, graphe) et
// ontologie vivante. Rendues par l'unique Studio (/cockpit/studio), toutes
// lisent et écrivent le même vocabulaire que le Cockpit.
import { useDismiss } from "@/lib/ui/use-dismiss";
import { useRef, useEffect, useState } from "react";
import {
  kpiStatus, semanticMatchKpi, deriveCurrentValue, evaluateCausalRules, computeReadiness, buildCausalGraph,
  DEMO_PRESETS, importMaisonLucieLive, type DemoPreset,
  type ArgusVocab, type KpiDef, type KpiDirection, type AppCredential, type AppField, type MappingDef, type CausalRule, type CausalCondition, type RuleSeverity,
  type BusinessEntity, type EntityRelationship, type EntityAttribute, type RelationshipCardinality,
} from "../../../lib/v4/argus-vocab-store";
import { suggestVocabulaire, refineMappings, suggestCausalRules, suggestEntityModel, type SuggestedKpi } from "../../../lib/v4/argus-llm";
import { queryLiveSiTable } from "../../../lib/v4/si-connector";
import { SOURCE_CATALOG, CATALOG_SECTEURS, isConfirmed, themeForSecteur, type CatalogSource, type CatalogTheme } from "../../../lib/v4/source-catalog";
import { AuraIcon } from "../AuraUI";
import { isNumericField } from "../../../lib/v4/supply-model";
import { ruleScope } from "../../../lib/v4/rule-scope";
import { CausalFlowGraph } from "./SupplyDiagrams";
import { SiTablesPanel } from "../SiTablesPanel";
import { loadLang } from "../../../lib/v4/speech-client";
import {
  addKpiMapping, blankRule, duplicateRule, removeKpi, removeKpiMapping, removeRule, ruleKind, setRuleEnabled, updateKpi, updateKpiMapping, upsertRule,
} from "../../../lib/v4/studio-editing";

const ACCENT = "#2b2b2b";
const STATUS_COLOR = { ok: "#059669", alerte: "#D97706", critique: "#DC2626" } as const;

const inputStyle: React.CSSProperties = { padding: "7px 9px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13.5, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" };
const btnStyle: React.CSSProperties = { padding: "7px 14px", borderRadius: 8, border: "none", background: ACCENT, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const rowStyle: React.CSSProperties = { display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", padding: "10px 12px", borderRadius: 8, background: "var(--v4-bg)" };

// ── 1. Vocabulaire ──────────────────────────────────────────────────────────
export function VocabSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [label, setLabel] = useState("");
  const [unit, setUnit] = useState("%");
  const [direction, setDirection] = useState<KpiDirection>("au_dessus_alerte");
  const [seuilAlerte, setSeuilAlerte] = useState("");
  const [seuilCritique, setSeuilCritique] = useState("");
  const [domaine, setDomaine] = useState(vocab.domaine ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SuggestedKpi[]>([]);

  function add() {
    if (!label.trim() || seuilAlerte === "" || seuilCritique === "") return;
    const kpi: KpiDef = { id: crypto.randomUUID(), label: label.trim(), unit: unit.trim() || "—", direction, seuilAlerte: Number(seuilAlerte), seuilCritique: Number(seuilCritique) };
    onUpdate({ ...vocab, kpis: [...vocab.kpis, kpi] });
    setLabel(""); setSeuilAlerte(""); setSeuilCritique("");
  }
  function remove(id: string) {
    const kpi = vocab.kpis.find(k => k.id === id);
    if (kpi && !window.confirm(`Supprimer l'indicateur « ${kpi.label} », ses mappings et les conditions qui le citent ?`)) return;
    onUpdate(removeKpi(vocab, id));
  }
  function setOwner(id: string, owner: string) {
    onUpdate({ ...vocab, kpis: vocab.kpis.map(k => k.id === id ? { ...k, owner: owner || undefined } : k) });
  }
  function toggleAlert(id: string) {
    onUpdate({ ...vocab, kpis: vocab.kpis.map(k => k.id === id ? { ...k, alertEnabled: k.alertEnabled === false ? true : false } : k) });
  }
  function setThreshold(id: string, field: "seuilAlerte" | "seuilCritique", value: string) {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    onUpdate({ ...vocab, kpis: vocab.kpis.map(k => k.id === id ? { ...k, [field]: n } : k) });
  }

  async function runSuggest() {
    if (!domaine.trim()) return;
    setLoading(true); setError(null); setSuggestions([]);
    const r = await suggestVocabulaire({ data: { domaine: domaine.trim(), lang: loadLang() } });
    setLoading(false);
    if (!r.ok || !r.kpis) { setError(r.error ?? "Suggestion indisponible."); return; }
    setSuggestions(r.kpis);
    onUpdate({ ...vocab, domaine: domaine.trim() });
  }
  function acceptSuggestion(s: SuggestedKpi) {
    if (vocab.kpis.some(k => k.label === s.label)) return;
    const kpi: KpiDef = { id: crypto.randomUUID(), label: s.label, unit: s.unit, direction: s.direction, seuilAlerte: s.seuilAlerte, seuilCritique: s.seuilCritique, perimetre: s.perimetre, attributs: s.attributs };
    onUpdate({ ...vocab, kpis: [...vocab.kpis, kpi] });
  }

  const suggestionsByPerimetre = suggestions.reduce<Record<string, SuggestedKpi[]>>((acc, s) => {
    (acc[s.perimetre ?? "Autre"] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ ...rowStyle, marginBottom: 14 }}>
        <input value={domaine} onChange={e => setDomaine(e.target.value)} placeholder="Domaine métier (ex. Retail, Énergie…)" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button onClick={runSuggest} disabled={!domaine.trim() || loading} style={{ ...btnStyle, background: domaine.trim() ? ACCENT : "var(--v4-border)", cursor: domaine.trim() ? "pointer" : "default" }}>
          {loading ? "…" : "✦ Suggérer un vocabulaire métier"}
        </button>
      </div>
      {error && <div style={{ fontSize: 13.5, color: "#B45309", marginBottom: 12.5 }}>{error}</div>}
      {suggestions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {Object.entries(suggestionsByPerimetre).map(([perimetre, kpisS]) => (
            <div key={perimetre}>
              <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--v4-text3)", marginBottom: 5 }}>{perimetre}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {kpisS.map(s => {
                  const added = vocab.kpis.some(k => k.label === s.label);
                  return (
                    <button key={s.label} onClick={() => acceptSuggestion(s)} disabled={added}
                      title={`${s.unit} · alerte ${s.seuilAlerte} · critique ${s.seuilCritique}${s.attributs?.length ? ` · attributs : ${s.attributs.join(", ")}` : ""}`}
                      style={{ padding: "5px 10px", borderRadius: 999, border: "1px dashed var(--v4-border)", background: added ? "var(--v4-accent-bg)" : "var(--v4-surface)", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: added ? "default" : "pointer", fontFamily: "inherit" }}>
                      {added ? "✓ " : "+ "}{s.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {vocab.kpis.map(k => (
          <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--v4-border)" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input aria-label={`Libellé de ${k.label}`} value={k.label} onChange={e => onUpdate(updateKpi(vocab, k.id, { label: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, fontWeight: 700, padding: "4px 8px" }} />
                {k.perimetre && <span style={{ fontSize: 13, color: "var(--v4-text3)", whiteSpace: "nowrap" }}>· {k.perimetre}</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                <input aria-label={`Unité de ${k.label}`} value={k.unit} onChange={e => onUpdate(updateKpi(vocab, k.id, { unit: e.target.value }))}
                  style={{ width: 84, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }} />
                <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>alerte</span>
                <input type="number" aria-label={`Seuil d'alerte de ${k.label}`} value={k.seuilAlerte} onChange={e => setThreshold(k.id, "seuilAlerte", e.target.value)}
                  style={{ width: 64, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }} />
                <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>critique</span>
                <input type="number" aria-label={`Seuil critique de ${k.label}`} value={k.seuilCritique} onChange={e => setThreshold(k.id, "seuilCritique", e.target.value)}
                  style={{ width: 64, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }} />
                <select aria-label={`Sens de ${k.label}`} value={k.direction} onChange={e => onUpdate(updateKpi(vocab, k.id, { direction: e.target.value as KpiDirection }))}
                  style={{ padding: "2px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }}>
                  <option value="au_dessus_alerte">mauvais si trop haut</option>
                  <option value="en_dessous_alerte">mauvais si trop bas</option>
                </select>
              </div>
              {k.attributs && k.attributs.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                  {k.attributs.map(a => (
                    <span key={a} style={{ fontSize: 13, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "var(--v4-accent-bg)", color: "var(--v4-text2)" }}>{a}</span>
                  ))}
                </div>
              )}
            </div>
            <label title="Déclenche (ou non) le flux Comprendre → Impacter → Arbitrer et les règles causales — reste visible dans tous les cas" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v4-text3)", cursor: "pointer", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={k.alertEnabled !== false} onChange={() => toggleAlert(k.id)} /> alerte
            </label>
            <input value={k.owner ?? ""} onChange={e => setOwner(k.id, e.target.value)} placeholder="Propriétaire"
              style={{ ...inputStyle, width: 130 }} />
            <button onClick={() => remove(k.id)} aria-label={`Supprimer ${k.label}`} title="Supprimer" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 16 }}>×</button>
          </div>
        ))}
        {vocab.kpis.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucun indicateur défini.</div>}
      </div>
      <div style={rowStyle}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom de l'indicateur (ex. Capacité fournisseur)" aria-label="Nom du nouvel indicateur" style={{ ...inputStyle, width: 260 }} />
        <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="Unité" aria-label="Unité du nouvel indicateur" style={{ ...inputStyle, width: 90 }} />
        <select value={direction} onChange={e => setDirection(e.target.value as KpiDirection)} style={inputStyle}>
          <option value="au_dessus_alerte">Mauvais si trop haut</option>
          <option value="en_dessous_alerte">Mauvais si trop bas</option>
        </select>
        <input type="number" value={seuilAlerte} onChange={e => setSeuilAlerte(e.target.value)} placeholder="Seuil alerte" aria-label="Seuil d'alerte du nouvel indicateur" style={{ ...inputStyle, width: 116 }} />
        <input type="number" value={seuilCritique} onChange={e => setSeuilCritique(e.target.value)} placeholder="Seuil critique" aria-label="Seuil critique du nouvel indicateur" style={{ ...inputStyle, width: 124 }} />
        <button onClick={add} style={btnStyle}>+ Indicateur</button>
      </div>
    </div>
  );
}

// ── 2. Applications & credentials ───────────────────────────────────────────
// Popup de configuration des identifiants — une connexion à un SI est
// toujours une vraie connexion (endpoint HTTPS joignable, login réel) : pas
// de "mode démo" à part, juste des identifiants à renseigner une fois.
export function CredentialsModal({ app, onUpdate, vocab, onClose }: { app: AppCredential; onUpdate: (v: ArgusVocab) => void; vocab: ArgusVocab; onClose: () => void }) {
  const form = app.liveEndpoint && (app.liveEndpoint.kind ?? "form") === "form"
    ? app.liveEndpoint as Extract<NonNullable<AppCredential["liveEndpoint"]>, { kind?: "form" }>
    : null;
  const mcp = app.liveEndpoint?.kind === "mcp" ? app.liveEndpoint : null;
  const [protocol, setProtocol] = useState<"form" | "oauth2_client_credentials" | "mcp">(
    app.liveEndpoint?.kind === "oauth2_client_credentials" ? "oauth2_client_credentials" : mcp ? "mcp" : "form"
  );
  // Login-formulaire simple
  const [baseUrl, setBaseUrl] = useState(form?.baseUrl ?? "");
  const [user, setUser] = useState(form?.user ?? "");
  const [password, setPassword] = useState(form?.password ?? "");
  // MCP (Model Context Protocol) — serveur d'outils exposant les données du SI
  const [mcpUrl, setMcpUrl] = useState(mcp?.serverUrl ?? "");
  const [mcpToken, setMcpToken] = useState(mcp?.token ?? "");
  const [mcpTool, setMcpTool] = useState(mcp?.toolName ?? "");
  const [mcpProbe, setMcpProbe] = useState<string | null>(null);
  const [probing, setProbing] = useState(false);

  async function probeMcp() {
    if (!mcpUrl.trim()) return;
    setProbing(true); setMcpProbe(null);
    const { listMcpTools } = await import("../../../lib/v4/si-connector");
    const r = await listMcpTools({ data: { endpoint: { kind: "mcp", serverUrl: mcpUrl.trim(), token: mcpToken.trim() || undefined } } });
    setProbing(false);
    setMcpProbe(r.ok ? `${r.tools.length} outil(s) : ${r.tools.map(t => t.name).slice(0, 8).join(", ")}` : r.error);
  }
  // OAuth 2.0 Client Credentials (protocole du coffre-fort Aura SI Hub)
  const [tokenUrl, setTokenUrl] = useState(app.liveEndpoint?.kind === "oauth2_client_credentials" ? app.liveEndpoint.tokenUrl : "");
  const [clientId, setClientId] = useState(app.liveEndpoint?.kind === "oauth2_client_credentials" ? app.liveEndpoint.clientId : "");
  const [clientSecret, setClientSecret] = useState(app.liveEndpoint?.kind === "oauth2_client_credentials" ? app.liveEndpoint.clientSecret : "");
  const [apiBaseUrl, setApiBaseUrl] = useState(app.liveEndpoint?.kind === "oauth2_client_credentials" ? app.liveEndpoint.apiBaseUrl : "");

  const validForm = !!baseUrl.trim() && !!user.trim() && !!password.trim();
  const validOAuth2 = !!tokenUrl.trim() && !!clientId.trim() && !!clientSecret.trim() && !!apiBaseUrl.trim();
  const validMcp = !!mcpUrl.trim();
  const canSave = protocol === "form" ? validForm : protocol === "mcp" ? validMcp : validOAuth2;

  function save() {
    if (!canSave) return;
    const liveEndpoint: AppCredential["liveEndpoint"] = protocol === "form"
      ? { kind: "form", baseUrl: baseUrl.trim(), user: user.trim(), password }
      : protocol === "mcp"
        ? { kind: "mcp", serverUrl: mcpUrl.trim(), token: mcpToken.trim() || undefined, toolName: mcpTool.trim() || undefined }
        : { kind: "oauth2_client_credentials", tokenUrl: tokenUrl.trim(), clientId: clientId.trim(), clientSecret, apiBaseUrl: apiBaseUrl.trim() };
    onUpdate({ ...vocab, apps: vocab.apps.map(a => a.id === app.id ? { ...a, liveEndpoint } : a) });
    onClose();
  }
  function clear() {
    onUpdate({ ...vocab, apps: vocab.apps.map(a => a.id === app.id ? { ...a, liveEndpoint: undefined } : a) });
    onClose();
  }

  // Formulaire d'identifiants : croix ou Échap, pas de clic extérieur (saisie en cours).
  useDismiss(true, onClose);
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(20,18,40,0.35)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: "90vw", background: "var(--v4-surface)", borderRadius: 8, padding: "18px 20px", boxShadow: "0 20px 60px -12px rgba(20,18,40,0.35)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: "var(--v4-text)", flex: 1 }}>Identifiants — {app.label}</div>
          <button onClick={onClose} aria-label="Fermer" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 18, lineHeight: 1, padding: 2 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 13 }}>Secret conservé localement, transmis au seul SI concerné.</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["form", "oauth2_client_credentials", "mcp"] as const).map(p => (
            <button key={p} onClick={() => setProtocol(p)}
              style={{ flex: 1, padding: "6px 8px", borderRadius: 8, border: `1.5px solid ${protocol === p ? ACCENT : "var(--v4-border)"}`, background: protocol === p ? `${ACCENT}12` : "var(--v4-surface)", color: protocol === p ? ACCENT : "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {p === "form" ? "Login simple" : p === "mcp" ? "MCP" : "OAuth 2.0"}
            </button>
          ))}
        </div>
        {protocol === "mcp" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={mcpUrl} onChange={e => setMcpUrl(e.target.value)} placeholder="URL du serveur MCP (ex. https://si.exemple.com/mcp)" style={inputStyle} autoFocus />
            <input value={mcpToken} onChange={e => setMcpToken(e.target.value)} placeholder="Jeton d'accès (facultatif)" type="password" style={inputStyle} />
            <input value={mcpTool} onChange={e => setMcpTool(e.target.value)} placeholder="Outil de lecture (facultatif — sinon le nom de la table)" style={inputStyle} />
            <button onClick={probeMcp} disabled={!mcpUrl.trim() || probing}
              style={{ ...btnStyle, background: "none", border: `1px solid ${ACCENT}`, color: ACCENT, alignSelf: "flex-start" }}>
              {probing ? "Test…" : "Tester la connexion"}
            </button>
            {mcpProbe && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{mcpProbe}</div>}
          </div>
        ) : protocol === "form" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://mon-erp.exemple.com" style={inputStyle} autoFocus />
            <input value={user} onChange={e => setUser(e.target.value)} placeholder="Utilisateur" style={inputStyle} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Mot de passe" type="password" style={inputStyle} />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={tokenUrl} onChange={e => setTokenUrl(e.target.value)} placeholder="Token endpoint (ex. https://app.exemple.com/oauth/token)" style={inputStyle} autoFocus />
            <input value={apiBaseUrl} onChange={e => setApiBaseUrl(e.target.value)} placeholder="API base URL" style={inputStyle} />
            <input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Client ID" style={inputStyle} />
            <input value={clientSecret} onChange={e => setClientSecret(e.target.value)} placeholder="Client secret (depuis votre vault opérationnel)" type="password" style={inputStyle} />
          </div>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button onClick={save} disabled={!canSave} style={{ ...btnStyle, flex: 1, background: canSave ? ACCENT : "var(--v4-border)" }}>Enregistrer</button>
          {app.liveEndpoint && <button onClick={clear} style={{ fontSize: 13, fontWeight: 700, background: "none", border: "1px solid var(--v4-border)", borderRadius: 8, padding: "8px 14px", cursor: "pointer", color: "var(--v4-text3)", fontFamily: "inherit" }}>Retirer</button>}
          <button onClick={onClose} style={{ fontSize: 13, fontWeight: 700, background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontFamily: "inherit", padding: "8px 10px" }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

export function LiveEndpointRow({ app, onUpdate, vocab }: { app: AppCredential; onUpdate: (v: ArgusVocab) => void; vocab: ArgusVocab }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={app.liveEndpoint ? "Identifiants configurés" : "Configurer les identifiants"} title={app.liveEndpoint ? "Identifiants configurés" : "Configurer les identifiants"} style={{ fontSize: 13, fontWeight: 800, padding: "3px 9px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: app.liveEndpoint ? "#2b2b2b18" : "var(--v4-border)", color: app.liveEndpoint ? ACCENT : "var(--v4-text3)" }}>
        <><AuraIcon e="🔑" size={13} /> Identifiants{app.liveEndpoint ? " ✓" : ""}</>
      </button>
      {open && <CredentialsModal app={app} vocab={vocab} onUpdate={onUpdate} onClose={() => setOpen(false)} />}
    </>
  );
}

// Catalogue déclaratif issu de l'export "Aura SI Hub" fourni — un clic ajoute
// l'application dans le vocabulaire, prête pour "Connecter un vrai SI".
// Aucune valeur ici n'est vérifiée comme réellement joignable : c'est
// délibéré, voir source-catalog.ts.
export function SourceCatalogPicker({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [open, setOpen] = useState(false);
  const [secteur, setSecteur] = useState<CatalogSource["secteur"] | "Tous">("Tous");
  const [theme, setTheme] = useState<CatalogTheme | "Tous">("Tous");
  // Par défaut on ne montre que les applications confirmées en fonctionnement
  // (host Traefik réellement vu) — le choix complet du catalogue (86 sources,
  // dont certaines non vérifiées) reste accessible en décochant ce filtre.
  const [onlyConfirmed, setOnlyConfirmed] = useState(true);

  function addFromCatalog(s: CatalogSource) {
    if (vocab.apps.some(a => a.label === s.label)) return;
    const appId = crypto.randomUUID();
    // Identifiants réellement vérifiés — préchargés uniquement pour les
    // quelques apps où c'est confirmé (voir source-catalog.ts). Jamais
    // inventés pour les autres, qui restent à connecter via la pop-up.
    const liveEndpoint = s.baseUrl && s.defaultCredentials ? { baseUrl: s.baseUrl, ...s.defaultCredentials } : undefined;
    const app: AppCredential = { id: appId, label: s.label, type: s.secteur, connectionHint: s.baseUrl ?? "Host Traefik non confirmé", secretConfigured: !!liveEndpoint, enabled: true, liveEndpoint };
    // Les tables connues (vues sur le vrai init_db.py) sont préchargées comme
    // champs vides, prêtes pour "Rafraîchir via SI réel" une fois les
    // identifiants renseignés — pas une valeur inventée, juste le nom.
    const fields: AppField[] = (s.tables ?? []).map(t => ({ id: crypto.randomUUID(), appId, name: t, sampleValues: [], liveTable: t }));
    onUpdate({ ...vocab, apps: [...vocab.apps, app], fields: [...vocab.fields, ...fields] });
  }

  const filtered = SOURCE_CATALOG
    .filter(s => secteur === "Tous" || s.secteur === secteur)
    .filter(s => theme === "Tous" || themeForSecteur(s.secteur) === theme)
    .filter(s => !onlyConfirmed || isConfirmed(s));

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "10px 12px", marginBottom: 14 }}>
      <button onClick={() => setOpen(o => !o)} style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
        <span style={{ fontSize: 13.5, fontWeight: 800, color: ACCENT, flex: 1, textAlign: "left" }}>📚 Catalogue de sources ({SOURCE_CATALOG.length}) — réellement vues sur aura-poc-paris-v2, host/tables confirmés quand marqués, à connecter toi-même</span>
        <span style={{ color: "var(--v4-text3)", fontSize: 13 }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "var(--v4-text2)", cursor: "pointer" }}>
              <input type="checkbox" checked={onlyConfirmed} onChange={e => setOnlyConfirmed(e.target.checked)} />
              Confirmées uniquement (par défaut)
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {(["Tous", "Business", "Industrie"] as const).map(t => (
                <button key={t} onClick={() => setTheme(t)}
                  style={{ padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${theme === t ? ACCENT : "var(--v4-border)"}`, background: theme === t ? `${ACCENT}12` : "var(--v4-surface)", color: theme === t ? ACCENT : "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {t === "Tous" ? "Tous thèmes" : t}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
            {(["Tous", ...CATALOG_SECTEURS] as const).map(s => (
              <button key={s} onClick={() => setSecteur(s)}
                style={{ padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${secteur === s ? ACCENT : "var(--v4-border)"}`, background: secteur === s ? `${ACCENT}12` : "var(--v4-surface)", color: secteur === s ? ACCENT : "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 320, overflowY: "auto" }}>
            {filtered.map(s => {
              const added = vocab.apps.some(a => a.label === s.label);
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "var(--v4-bg)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>
                      {s.label}
                      {s.baseUrl && <span title="Host Traefik confirmé via docker inspect sur aura-poc-paris-v2" style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 800, padding: "1px 6px", borderRadius: 999, background: "#05966918", color: "#059669" }}>🛰 host confirmé</span>}
                      {s.tables && <span title={s.tables.join(", ")} style={{ marginLeft: 6, fontSize: 12.5, fontWeight: 700, color: "var(--v4-text3)" }}>{s.tables.length} tables connues</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{s.description}</div>
                  </div>
                  <button onClick={() => addFromCatalog(s)} disabled={added}
                    style={{ fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "none", background: added ? "var(--v4-border)" : ACCENT, color: added ? "var(--v4-text3)" : "#fff", cursor: added ? "default" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {added ? "✓ Ajoutée" : "+ Ajouter"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppsSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [label, setLabel] = useState("");
  const [type, setType] = useState("");
  const [hint, setHint] = useState("");
  const [secret, setSecret] = useState(false);

  function add() {
    if (!label.trim()) return;
    const app: AppCredential = { id: crypto.randomUUID(), label: label.trim(), type: type.trim() || "Application", connectionHint: hint.trim() || "—", secretConfigured: secret };
    onUpdate({ ...vocab, apps: [...vocab.apps, app] });
    setLabel(""); setType(""); setHint(""); setSecret(false);
  }
  function remove(id: string) {
    onUpdate({ ...vocab, apps: vocab.apps.filter(a => a.id !== id), fields: vocab.fields.filter(f => f.appId !== id), mappings: vocab.mappings.filter(m => vocab.fields.find(f => f.id === m.fieldId)?.appId !== id) });
  }
  function toggleSecret(id: string) {
    onUpdate({ ...vocab, apps: vocab.apps.map(a => a.id === id ? { ...a, secretConfigured: !a.secretConfigured } : a) });
  }
  // Connecter/déconnecter : réversible, garde les identifiants et mappings —
  // une app déconnectée ne fournit simplement plus de valeur (deriveCurrentValue).
  function toggleEnabled(id: string) {
    onUpdate({ ...vocab, apps: vocab.apps.map(a => a.id === id ? { ...a, enabled: a.enabled === false ? true : false } : a) });
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--v4-text3)", marginTop: 0, marginBottom: 14 }}>
        Applications sources et leurs connexions — configurez les identifiants d'une application pour l'alimenter en données réelles.
      </p>
      <SourceCatalogPicker vocab={vocab} onUpdate={onUpdate} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginBottom: 14 }}>
        {vocab.apps.map(a => (
          <div key={a.id} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 7, padding: "10px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", opacity: a.enabled === false ? 0.55 : 1, minWidth: 0 }}>
            <button onClick={() => remove(a.id)} style={{ position: "absolute", top: 8, right: 9, border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14, lineHeight: 1 }}>×</button>
            <div style={{ paddingRight: 16, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.label}>{a.label}</div>
              <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{a.type}</div>
              <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={a.connectionHint}>{a.connectionHint}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              <button onClick={() => toggleSecret(a.id)} style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: a.secretConfigured ? "#05966918" : "var(--v4-border)", color: a.secretConfigured ? "#059669" : "var(--v4-text3)" }}>
                <>{a.secretConfigured ? <><AuraIcon e="🔒" size={11} /> Configurée</> : <>⚠ Non configurée</>}</>
              </button>
              {/* "Activée/Suspendue" ci-dessous est un interrupteur LOCAL
                  (pause/reprise sans re-tester le réseau) — jamais "Connectée",
                  un mot qui prêtait à confusion avec une authentification
                  réussie (retour de test réel). Le statut de connexion RÉEL,
                  lui, vient uniquement de sourceStatus, posé exclusivement par
                  importMaisonLucieLive après un appel /api/data authentifié
                  qui a réussi — jamais par ce bouton. */}
              <button onClick={() => toggleEnabled(a.id)} title="Suspendre/reprendre l'alimentation des indicateurs depuis cette app, sans perdre sa config — ne teste pas la connexion réseau"
                style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, border: "none", cursor: "pointer", fontFamily: "inherit", background: a.enabled === false ? "var(--v4-border)" : `${ACCENT}18`, color: a.enabled === false ? "var(--v4-text3)" : ACCENT }}>
                {a.enabled === false ? "⏸ Suspendue" : "▶ Activée"}
              </button>
              <span title={a.lastSyncAt ? `Dernier import réussi : ${new Date(a.lastSyncAt).toLocaleString("fr-FR")}` : "Aucun import authentifié n'a encore réussi pour cette application"}
                style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 8px", borderRadius: 999, fontFamily: "inherit", background: a.sourceStatus === "connected" ? "#05966918" : "var(--v4-border)", color: a.sourceStatus === "connected" ? "#059669" : "var(--v4-text3)" }}>
                {a.sourceStatus === "connected" ? <><AuraIcon e="✅" size={11} /> Connexion vérifiée</> : "○ Non vérifiée"}
              </span>
            </div>
            <LiveEndpointRow app={a} vocab={vocab} onUpdate={onUpdate} />
          </div>
        ))}
        {vocab.apps.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucune application déclarée.</div>}
      </div>
      <div style={rowStyle}>
        <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex. SAP S/4HANA — FI/CO" style={{ ...inputStyle, width: 220 }} />
        <input value={type} onChange={e => setType(e.target.value)} placeholder="Type (ERP, CRM…)" style={{ ...inputStyle, width: 130 }} />
        <input value={hint} onChange={e => setHint(e.target.value)} placeholder="Ex. API REST, OAuth2" style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
        <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v4-text2)" }}>
          <input type="checkbox" checked={secret} onChange={e => setSecret(e.target.checked)} /> connexion configurée
        </label>
        <button onClick={add} style={btnStyle}>+ Application</button>
      </div>
    </div>
  );
}

// ── 3. Données échantillon ───────────────────────────────────────────────────
function RefreshFromSiButton({ field, app, vocab, onUpdate }: { field: AppField; app: AppCredential; vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [table, setTable] = useState(field.liveTable ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!app.liveEndpoint) return null;

  async function refresh() {
    if (!table.trim() || !app.liveEndpoint) return;
    setLoading(true); setError(null);
    const r = await queryLiveSiTable({ data: { endpoint: app.liveEndpoint, table: table.trim() } });
    setLoading(false);
    if (!r.ok) { setError(r.error); return; }
    onUpdate({
      ...vocab,
      fields: vocab.fields.map(f => f.id === field.id ? { ...f, liveTable: table.trim(), sampleValues: r.sample.sampleValues } : f),
    });
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input value={table} onChange={e => setTable(e.target.value)} placeholder="table (ex. materials)" style={{ ...inputStyle, width: 110, fontSize: 13, padding: "4px 7px" }} />
      <button onClick={refresh} disabled={!table.trim() || loading} title={error ?? undefined}
        style={{ fontSize: 13, fontWeight: 700, padding: "4px 8px", borderRadius: 6, border: "none", cursor: table.trim() ? "pointer" : "default", fontFamily: "inherit", background: error ? "#DC262618" : ACCENT, color: error ? "#DC2626" : "#fff" }}>
        {loading ? "…" : error ? "✕ Erreur" : "⟳ SI réel"}
      </button>
    </div>
  );
}

export function SampleDataSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [appId, setAppId] = useState(vocab.apps[0]?.id ?? "");
  const [name, setName] = useState("");
  const [samples, setSamples] = useState("");
  const [tab, setTab] = useState<"champs" | "si">("champs");

  useEffect(() => { if (!appId && vocab.apps[0]) setAppId(vocab.apps[0].id); }, [vocab.apps, appId]);

  function add() {
    if (!appId || !name.trim() || !samples.trim()) return;
    const field: AppField = { id: crypto.randomUUID(), appId, name: name.trim(), sampleValues: samples.split(",").map(s => s.trim()).filter(Boolean) };
    onUpdate({ ...vocab, fields: [...vocab.fields, field] });
    setName(""); setSamples("");
  }
  function remove(id: string) {
    onUpdate({
      ...vocab,
      fields: vocab.fields.filter(f => f.id !== id),
      mappings: vocab.mappings.filter(m => m.fieldId !== id),
      entityMappings: (vocab.entityMappings ?? []).filter(l => l.fieldId !== id),
    });
  }

  if (vocab.apps.length === 0) {
    return <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Déclarez d'abord au moins une application.</div>;
  }

  const tabs = [
    { key: "champs" as const, label: `Champs déclarés (${vocab.fields.length})` },
    { key: "si" as const, label: `Tables SI (${(vocab.siTables ?? []).length})` },
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "5px 12px", borderRadius: 999, border: `1.5px solid ${tab === t.key ? ACCENT : "var(--v4-border)"}`, background: tab === t.key ? `${ACCENT}12` : "var(--v4-surface)", color: tab === t.key ? ACCENT : "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "si" && <SiTablesPanel vocab={vocab} onUpdate={onUpdate} />}

      {tab === "champs" && (
      <div>
      <p style={{ fontSize: 13.5, color: "var(--v4-text3)", marginTop: 0, marginBottom: 14 }}>
        Un échantillon (3 à 6 valeurs) par champ — représentatif de ce qu'un vrai connecteur remonterait, saisi une fois par vous.
      </p>
      {vocab.apps.map(app => {

        const fields = vocab.fields.filter(f => f.appId === app.id);
        if (fields.length === 0) return null;
        return (
          <div key={app.id} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, marginBottom: 12 }}>{app.label}</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
                <thead><tr><th style={{ textAlign: "left", padding: "5px 8px", fontSize: 13, color: "var(--v4-text3)", textTransform: "uppercase" }}>Champ</th><th style={{ textAlign: "left", padding: "5px 8px", fontSize: 13, color: "var(--v4-text3)", textTransform: "uppercase" }}>Échantillon</th><th /><th /></tr></thead>
                <tbody>
                  {fields.map(f => {
                    const mapping = vocab.mappings.find(m => m.fieldId === f.id);
                    const kpi = mapping ? vocab.kpis.find(k => k.id === mapping.kpiId) : undefined;
                    return (
                      <tr key={f.id} style={{ borderTop: "1px solid var(--v4-border)" }}>
                        <td style={{ padding: "6px 8px", fontWeight: 700, color: "var(--v4-text)" }}>
                          {f.name}
                          {kpi
                            ? <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: "#059669" }}>→ {kpi.label}</div>
                            : <div style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: "var(--v4-text3)" }}>non mappé</div>}
                        </td>
                        <td style={{ padding: "6px 8px", color: "var(--v4-text2)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{f.sampleValues.join(" | ")}</td>
                        <td style={{ padding: "6px 8px" }}><RefreshFromSiButton field={f} app={app} vocab={vocab} onUpdate={onUpdate} /></td>
                        <td style={{ padding: "6px 8px" }}><button onClick={() => remove(f.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)" }}>×</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div style={rowStyle}>
        <select value={appId} onChange={e => setAppId(e.target.value)} style={inputStyle}>
          {vocab.apps.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
        </select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. CO-PA.marge_brute_pct" style={{ ...inputStyle, width: 220 }} />
        <input value={samples} onChange={e => setSamples(e.target.value)} placeholder="Valeurs, séparées par des virgules (ex. 18, 17.5, 19)" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button onClick={add} style={btnStyle}>+ Champ</button>
      </div>
      </div>
      )}
    </div>

  );
}

// ── 4. Mappings ───────────────────────────────────────────────────────────────
export function MappingsSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [kpiId, setKpiId] = useState(vocab.kpis[0]?.id ?? "");
  const [fieldId, setFieldId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiSuggested, setAiSuggested] = useState<Record<string, { confidence: number; rationale: string }>>({});

  useEffect(() => { if (!kpiId && vocab.kpis[0]) setKpiId(vocab.kpis[0].id); }, [vocab.kpis, kpiId]);

  const unmappedFields = vocab.fields.filter(f => !vocab.mappings.some(m => m.fieldId === f.id));
  const kpi = vocab.kpis.find(k => k.id === kpiId);
  // Une même colonne peut alimenter plusieurs indicateurs : seules celles
  // déjà branchées sur CET indicateur sont écartées, et seules les colonnes
  // numériques sont proposées (un identifiant ne donne jamais une valeur).
  const candidates = kpi ? vocab.fields
    .filter(f => isNumericField(f) && !vocab.mappings.some(m => m.kpiId === kpi.id && m.fieldId === f.id))
    .map(f => ({ field: f, match: semanticMatchKpi(kpi, f.name) }))
    .sort((a, b) => b.match.score - a.match.score)
    : [];

  function addMapping(fId: string, method: MappingDef["method"], confidence?: number, rationale?: string, attribut?: string) {
    const m: MappingDef = { id: crypto.randomUUID(), kpiId, fieldId: fId, appId: vocab.fields.find(f => f.id === fId)!.appId, method, confidence, rationale, attribut };
    onUpdate({ ...vocab, mappings: [...vocab.mappings, m] });
  }
  function remove(id: string) {
    onUpdate(removeKpiMapping(vocab, id));
  }
  function setCondition(id: string, ruleId: string, whenTriggered: boolean) {
    onUpdate({ ...vocab, mappings: vocab.mappings.map(m => m.id === id ? { ...m, condition: ruleId ? { ruleId, whenTriggered } : undefined } : m) });
  }

  async function runAiRefine() {
    setLoading(true); setError(null); setAiSuggested({});
    const candidateInputs = vocab.kpis.flatMap(k =>
      unmappedFields.map(f => ({ kpiId: k.id, kpiLabel: k.attributs?.length ? k.attributs.join(" / ") : k.label, fieldId: f.id, fieldName: f.name, appLabel: vocab.apps.find(a => a.id === f.appId)?.label ?? "?", semanticScore: semanticMatchKpi(k, f.name).score }))
        .filter(c => c.semanticScore > 0.05)
    );
    if (candidateInputs.length === 0) { setLoading(false); setError("Rien à rapprocher — ajoutez des indicateurs et des champs d'abord."); return; }
    const r = await refineMappings({ data: { candidates: candidateInputs } });
    setLoading(false);
    if (!r.ok || !r.suggestions) { setError(r.error ?? "Rapprochement indisponible."); return; }
    const map: Record<string, { confidence: number; rationale: string }> = {};
    r.suggestions.forEach(s => { map[`${s.kpiId}::${s.fieldId}`] = { confidence: s.confidence, rationale: s.rationale }; });
    setAiSuggested(map);
  }

  if (vocab.kpis.length === 0 || vocab.fields.length === 0) {
    return <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Définissez au moins un indicateur et un champ applicatif avant de mapper.</div>;
  }

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {vocab.mappings.map(m => {
          const kpi = vocab.kpis.find(k => k.id === m.kpiId);
          const field = vocab.fields.find(f => f.id === m.fieldId);
          const app = vocab.apps.find(a => a.id === m.appId);
          const sameKpiOthers = vocab.mappings.filter(x => x.kpiId === m.kpiId && x.id !== m.id);
          return (
            <div key={m.id} style={{ padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: ACCENT }}>{kpi?.label ?? "—"}{m.attribut && <span style={{ fontWeight: 500 }}> · {m.attribut}</span>}</span>
                <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>←</span>
                <select aria-label={`Champ source de ${kpi?.label ?? "l'indicateur"}`} value={m.fieldId} onChange={e => onUpdate(updateKpiMapping(vocab, m.id, { fieldId: e.target.value }))}
                  style={{ ...inputStyle, flex: 1, minWidth: 0, fontSize: 13, padding: "4px 6px" }}>
                  {!field && <option value={m.fieldId}>champ supprimé</option>}
                  {vocab.fields.map(f => <option key={f.id} value={f.id}>{f.name} ({vocab.apps.find(a => a.id === f.appId)?.label ?? "?"})</option>)}
                </select>
                <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--v4-accent-bg)", color: "var(--v4-text2)", whiteSpace: "nowrap" }}>{m.method}{m.confidence !== undefined ? ` · ${Math.round(m.confidence * 100)}%` : ""}</span>
                <button onClick={() => remove(m.id)} aria-label={`Supprimer le mapping ${kpi?.label ?? ""} ← ${field?.name ?? ""}`} title="Supprimer ce mapping" style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 16 }}>×</button>
              </div>
              {(vocab.causalRules.length > 0 || m.condition) && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingTop: 6, borderTop: "1px dashed var(--v4-border)" }}>
                  <span style={{ fontSize: 13, color: "var(--v4-text3)" }} title="Double-run legacy/nouveau SI : ce mapping n'est actif que sous cette condition — un autre mapping du même indicateur peut prendre le relais selon l'état de la règle.">
                    Actif si
                  </span>
                  <select value={m.condition?.ruleId ?? ""} onChange={e => setCondition(m.id, e.target.value, m.condition?.whenTriggered ?? true)}
                    style={{ ...inputStyle, fontSize: 13, padding: "3px 6px" }}>
                    <option value="">(toujours — pas de condition)</option>
                    {vocab.causalRules.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                  {m.condition && (
                    <select value={m.condition.whenTriggered ? "1" : "0"} onChange={e => setCondition(m.id, m.condition!.ruleId, e.target.value === "1")}
                      style={{ ...inputStyle, fontSize: 13, padding: "3px 6px" }}>
                      <option value="1">déclenchée</option>
                      <option value="0">non déclenchée</option>
                    </select>
                  )}
                  {sameKpiOthers.length > 0 && <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>· {sameKpiOthers.length} autre mapping{sameKpiOthers.length > 1 ? "s" : ""} sur ce même indicateur</span>}
                </div>
              )}
            </div>
          );
        })}
        {vocab.mappings.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucun mapping.</div>}
      </div>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>Ajouter un mapping — rapprochement sémantique</div>
        <button onClick={runAiRefine} disabled={loading} style={{ fontSize: 13, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: loading ? "default" : "pointer", fontFamily: "inherit" }}>
          {loading ? "…" : "✦ Affiner avec l'IA"}
        </button>
      </div>
      {error && <div style={{ fontSize: 13.5, color: "#B45309", marginBottom: 12 }}>{error}</div>}

      <select value={kpiId} onChange={e => setKpiId(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
        {vocab.kpis.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
      </select>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {candidates.slice(0, 6).map(({ field, match }) => {
          const ai = aiSuggested[`${kpiId}::${field.id}`];
          const pct = Math.round(match.score * 100);
          const barColor = pct >= 60 ? "#059669" : pct >= 30 ? "#D97706" : "var(--v4-border2)";
          return (
            <div key={field.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--v4-border)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5 }}>{field.name} <span style={{ color: "var(--v4-text3)" }}>({vocab.apps.find(a => a.id === field.appId)?.label})</span></div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <div style={{ width: 70, height: 4, borderRadius: 6, background: "var(--v4-bg)" }}>
                    <div style={{ width: `${pct}%`, height: 4, borderRadius: 6, background: barColor }} />
                  </div>
                  <span style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>{pct}% · {match.method} · via <b>{match.matchedOn}</b></span>
                </div>
              </div>
              {ai && <span title={ai.rationale} style={{ fontSize: 13, fontWeight: 700, color: ACCENT, whiteSpace: "nowrap" }}>✦ IA {Math.round(ai.confidence * 100)}%</span>}
              <button onClick={() => addMapping(field.id, ai ? "llm" : "semantique", ai?.confidence ?? match.score, ai?.rationale, match.matchedOn)}
                style={{ fontSize: 13, fontWeight: 700, padding: "5px 11px", borderRadius: 6, border: "none", background: ACCENT, color: "#fff", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Mapper
              </button>
            </div>
          );
        })}
        {candidates.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucune colonne numérique disponible pour cet indicateur.</div>}
      </div>

      <ManualMappingRow vocab={vocab} onAdd={(targetKpi, fieldId, attribut) => onUpdate(addKpiMapping(vocab, targetKpi, fieldId, "manuel", { attribut: attribut || undefined, rationale: "Mapping posé à la main dans le Studio." }))} />
    </div>
  );
}

// Mapping manuel — pas de suggestion, un choix direct du champ + une
// métadonnée libre (ex. un attribut récupéré des métadonnées de l'appli
// source que l'automatique n'a pas capté). Toujours disponible, même quand
// le champ voulu n'apparaît pas dans les 6 meilleures propositions ci-dessus.
function ManualMappingRow({ vocab, onAdd }: { vocab: ArgusVocab; onAdd: (kpiId: string, fieldId: string, attribut: string) => void }) {
  const [kpiId, setKpiId] = useState("");
  const [fieldId, setFieldId] = useState("");
  const [attribut, setAttribut] = useState("");
  const ready = Boolean(kpiId && fieldId);
  function submit() {
    if (!ready) return;
    onAdd(kpiId, fieldId, attribut.trim());
    setFieldId(""); setAttribut("");
  }
  return (
    <div style={{ marginTop: 12, borderTop: "1px solid var(--v4-border)", paddingTop: 12 }} id="st-map-manuel">
      <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)", marginBottom: 8 }}>Mapper manuellement</div>
      <p style={{ fontSize: 13, color: "var(--v4-text3)", margin: "0 0 8px" }}>Choisissez l'indicateur, puis la colonne source qui le mesure (ex. Capacité fournisseur ← supplierRiskAssessments.capacityRisk).</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <select aria-label="Indicateur à mapper" value={kpiId} onChange={e => setKpiId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 200 }}>
          <option value="">Choisir un indicateur…</option>
          {vocab.kpis.map(k => <option key={k.id} value={k.id}>{k.label}</option>)}
        </select>
        <select aria-label="Colonne source" value={fieldId} onChange={e => setFieldId(e.target.value)} style={{ ...inputStyle, flex: 1, minWidth: 240 }}>
          <option value="">Choisir une colonne source…</option>
          {vocab.fields.map(f => <option key={f.id} value={f.id}>{f.name} ({vocab.apps.find(a => a.id === f.appId)?.label})</option>)}
        </select>
        <input value={attribut} onChange={e => setAttribut(e.target.value)} aria-label="Attribut (optionnel)" placeholder="Attribut (optionnel)" style={{ ...inputStyle, width: 170 }} />
        <button onClick={submit} disabled={!ready} style={{ ...btnStyle, background: ready ? ACCENT : "var(--v4-border)" }}>Ajouter le mapping</button>
      </div>
    </div>
  );
}

// Score de préparation — 4 dimensions, pas un vrai indicateur métier, juste
// de quoi repérer un vocabulaire mal préparé avant qu'il n'alimente le chat.
export function ReadinessPanel({ vocab }: { vocab: ArgusVocab }) {
  if (vocab.kpis.length === 0) return null;
  const r = computeReadiness(vocab);
  const color = r.overall >= 80 ? "#059669" : r.overall >= 50 ? "#D97706" : "#DC2626";
  const dims = [
    { label: "Couverture (mappés)", value: r.coverage },
    { label: "Fraîcheur (valeur dérivable)", value: r.freshness },
    { label: "Confiance des mappings", value: r.mappingConfidence },
    { label: "Gouvernance (propriétaire)", value: r.governance },
  ];
  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color }}>{r.overall}<span style={{ fontSize: 14, color: "var(--v4-text3)" }}>/100</span></div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>Préparation du vocabulaire</div>
          <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Ce que Copilote Décideur peut réellement exploiter aujourd'hui.</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {dims.map(d => (
          <div key={d.label}>
            <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 3 }}>{d.label}</div>
            <div style={{ height: 6, borderRadius: 6, background: "var(--v4-bg)" }}>
              <div style={{ height: 6, borderRadius: 6, width: `${d.value}%`, background: d.value >= 80 ? "#059669" : d.value >= 50 ? "#D97706" : "#DC2626" }} />
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text2)", marginTop: 2 }}>{d.value}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 5. Ontologie vivante ─────────────────────────────────────────────────────
// "Ontologie minimale" = le vocabulaire métier capté (objets métier et leurs
// données : grandeurs suivies, attributs, états, référentiels) ; "vivante" = ce
// même schéma une fois porté par les vraies valeurs de ses golden sources
// (l'app mappée fait foi — jamais une valeur ressaisie ailleurs).
export function LivingOntologySection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null);

  const liveMappings = vocab.mappings.filter(m => {
    const field = vocab.fields.find(f => f.id === m.fieldId);
    const app = field ? vocab.apps.find(a => a.id === field.appId) : undefined;
    return !!(app?.liveEndpoint && field?.liveTable);
  });

  async function refreshAll() {
    setRefreshing(true); setRefreshMsg(null);
    let ok = 0, fail = 0;
    let next = vocab;
    for (const m of liveMappings) {
      const field = next.fields.find(f => f.id === m.fieldId)!;
      const app = next.apps.find(a => a.id === field.appId)!;
      const r = await queryLiveSiTable({ data: { endpoint: app.liveEndpoint!, table: field.liveTable! } });
      if (r.ok) { ok++; next = { ...next, fields: next.fields.map(f => f.id === field.id ? { ...f, sampleValues: r.sample.sampleValues } : f) }; }
      else fail++;
    }
    onUpdate(next);
    setRefreshing(false);
    setRefreshMsg(`${ok} champ${ok > 1 ? "s" : ""} rafraîchi${ok > 1 ? "s" : ""}${fail > 0 ? `, ${fail} échec${fail > 1 ? "s" : ""}` : ""}.`);
  }

  const entities = vocab.entities ?? [];

  return (
    <div>
      <ReadinessPanel vocab={vocab} />
      {entities.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--v4-text3)", marginBottom: 12 }}>Objets métier (modèle entités-relations)</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {entities.map(e => {
              const linkedKpis = vocab.kpis.filter(k => k.entityId === e.id);
              return (
                <div key={e.id} style={{ padding: "8px 12px", borderRadius: 8, background: "var(--v4-bg)", minWidth: 160 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: "var(--v4-text)" }}>{e.name}</div>
                  <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{e.attributes.length} attribut{e.attributes.length > 1 ? "s" : ""} · {linkedKpis.length} indicateur{linkedKpis.length !== 1 ? "s" : ""} rattaché{linkedKpis.length !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <p style={{ fontSize: 13.5, color: "var(--v4-text3)", margin: 0, flex: 1 }}>
          Ce que Copilote Décideur voit réellement — un indicateur du vocabulaire minimal, sa golden source, et la valeur qui en résulte aujourd'hui.
        </p>
        {liveMappings.length > 0 && (
          <button onClick={refreshAll} disabled={refreshing} style={{ fontSize: 13, fontWeight: 700, padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: "none", color: ACCENT, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            {refreshing ? "…" : `⟳ Rafraîchir tout (${liveMappings.length} source${liveMappings.length > 1 ? "s" : ""} live)`}
          </button>
        )}
      </div>
      {refreshMsg && <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 12.5 }}>{refreshMsg}</div>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--v4-border)" }}>
              {["Indicateur", "Propriétaire", "Golden source", "Valeur dérivée", "Statut"].map(h => (
                <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 13, fontWeight: 800, textTransform: "uppercase", color: "var(--v4-text3)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vocab.kpis.map(k => {
              const mapping = vocab.mappings.find(m => m.kpiId === k.id);
              const field = mapping ? vocab.fields.find(f => f.id === mapping.fieldId) : undefined;
              const app = field ? vocab.apps.find(a => a.id === field.appId) : undefined;
              const isLive = !!(app?.liveEndpoint && field?.liveTable);
              const value = deriveCurrentValue(vocab, k.id);
              const status = value !== undefined ? kpiStatus({ ...k, currentValue: value }) : kpiStatus(k);
              return (
                <tr key={k.id} style={{ borderBottom: "1px solid var(--v4-border)" }}>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{k.label}</td>
                  <td style={{ padding: "8px 10px", color: "var(--v4-text2)" }}>{k.owner ?? <span style={{ color: "var(--v4-text3)" }}>non assigné</span>}</td>
                  <td style={{ padding: "8px 10px", color: "var(--v4-text2)" }}>
                    {field ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {app?.label} — {field.name}
                        <span style={{ fontSize: 12.5, fontWeight: 800, padding: "1px 7px", borderRadius: 999, background: isLive ? "#05966918" : "var(--v4-accent-bg)", color: isLive ? "#059669" : "var(--v4-text3)" }}>
                          <>{isLive ? <><AuraIcon e="🛰" size={12} /> live</> : <><AuraIcon e="📋" size={12} /> échantillon</>}</>
                        </span>
                      </span>
                    ) : <span style={{ color: "var(--v4-text3)" }}>non mappé</span>}
                  </td>
                  <td style={{ padding: "8px 10px", fontWeight: 700 }}>{value !== undefined ? `${value} ${k.unit}` : "—"}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {value === undefined
                      ? <span style={{ fontSize: 13, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#94a3b818", color: "#64748b" }}>non alimenté</span>
                      : <span style={{ fontSize: 13, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: `${STATUS_COLOR[status]}18`, color: STATUS_COLOR[status] }}>{status === "ok" ? "normal" : status}</span>}
                  </td>
                </tr>
              );
            })}
            {vocab.kpis.length === 0 && <tr><td colSpan={5} style={{ padding: "14px 10px", color: "var(--v4-text3)" }}>Aucun indicateur défini.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 6. Règles causales ───────────────────────────────────────────────────────
// Une règle relie au moins 2 indicateurs — "si A ET B sont en alerte, c'est
// probablement Y" — jamais une simple alerte simple (ça, c'est déjà le
// vocabulaire). Évaluée en continu contre les valeurs réellement mappées.
// ── Entités & relations ──────────────────────────────────────────────────────
// Le modèle entités-relations : objets métier réels (Client, Fournisseur,
// Devis…), leurs attributs propres, et les relations entre eux — la couche
// sémantique qui manquait pour que le Copilote raisonne sur "quels objets"
// sont concernés, pas seulement "quelle valeur". Purement déclaratif : aucun
// calcul n'en dépend aujourd'hui, seul le rattachement d'un KPI à une entité
// (KpiDef.entityId, dans VocabularySection) crée un pont réel avec Argus.
export function EntitiesSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const entities = vocab.entities ?? [];
  const relationships = vocab.relationships ?? [];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [attrDraft, setAttrDraft] = useState<Record<string, string>>({});
  const [relFrom, setRelFrom] = useState("");
  const [relTo, setRelTo] = useState("");
  const [relLabel, setRelLabel] = useState("");
  const [relCard, setRelCard] = useState<RelationshipCardinality>("1-N");
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  // Génère un modèle de départ par IA (l'ontologie nominale du domaine) —
  // toujours un point de départ à compléter/ajuster/supprimer ensuite,
  // jamais un remplacement silencieux des entités déjà saisies à la main.
  async function generateWithAi() {
    if (!vocab.domaine?.trim()) return;
    setGenLoading(true); setGenError(null);
    const r = await suggestEntityModel({ data: { domaine: vocab.domaine } });
    setGenLoading(false);
    if (!r.ok || !r.entities) { setGenError(r.error ?? "Génération indisponible."); return; }
    const idByName = new Map<string, string>();
    const newEntities: BusinessEntity[] = r.entities.map(e => {
      const id = crypto.randomUUID();
      idByName.set(e.name, id);
      return { id, name: e.name, description: e.description || undefined, attributes: e.attributes.map(a => ({ id: crypto.randomUUID(), name: a, type: "text" })) };
    });
    const newRelationships: EntityRelationship[] = (r.relationships ?? [])
      .map((rel): EntityRelationship | null => {
        const fromId = idByName.get(rel.from), toId = idByName.get(rel.to);
        return fromId && toId ? { id: crypto.randomUUID(), fromEntityId: fromId, toEntityId: toId, label: rel.label, cardinality: rel.cardinality } : null;
      })
      .filter((rel): rel is EntityRelationship => !!rel);
    onUpdate({ ...vocab, entities: [...entities, ...newEntities], relationships: [...relationships, ...newRelationships] });
  }

  function addEntity() {
    if (!name.trim()) return;
    const e: BusinessEntity = { id: crypto.randomUUID(), name: name.trim(), description: description.trim() || undefined, attributes: [] };
    onUpdate({ ...vocab, entities: [...entities, e] });
    setName(""); setDescription("");
  }
  function removeEntity(id: string) {
    onUpdate({
      ...vocab,
      entities: entities.filter(e => e.id !== id),
      relationships: relationships.filter(r => r.fromEntityId !== id && r.toEntityId !== id),
      kpis: vocab.kpis.map(k => k.entityId === id ? { ...k, entityId: undefined } : k),
    });
  }
  function addAttribute(entityId: string) {
    const label = (attrDraft[entityId] ?? "").trim();
    if (!label) return;
    const attr: EntityAttribute = { id: crypto.randomUUID(), name: label, type: "text" };
    onUpdate({ ...vocab, entities: entities.map(e => e.id === entityId ? { ...e, attributes: [...e.attributes, attr] } : e) });
    setAttrDraft(prev => ({ ...prev, [entityId]: "" }));
  }
  function removeAttribute(entityId: string, attrId: string) {
    onUpdate({ ...vocab, entities: entities.map(e => e.id === entityId ? { ...e, attributes: e.attributes.filter(a => a.id !== attrId) } : e) });
  }
  function addRelationship() {
    if (!relFrom || !relTo || !relLabel.trim() || relFrom === relTo) return;
    const rel: EntityRelationship = { id: crypto.randomUUID(), fromEntityId: relFrom, toEntityId: relTo, label: relLabel.trim(), cardinality: relCard };
    onUpdate({ ...vocab, relationships: [...relationships, rel] });
    setRelLabel("");
  }
  function removeRelationship(id: string) {
    onUpdate({ ...vocab, relationships: relationships.filter(r => r.id !== id) });
  }
  function setKpiEntity(kpiId: string, entityId: string) {
    onUpdate({ ...vocab, kpis: vocab.kpis.map(k => k.id === kpiId ? { ...k, entityId: entityId || undefined } : k) });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14 }}>
        <p style={{ fontSize: 13.5, color: "var(--v4-text3)", margin: 0 }}>
          Objets métier réels, leurs données et leurs relations — le vocabulaire qui grounde le Copilote, pas seulement les grandeurs suivies.
        </p>
        <button onClick={generateWithAi} disabled={!vocab.domaine?.trim() || genLoading}
          title={vocab.domaine?.trim() ? undefined : "Renseignez d'abord un domaine dans Vocabulaire métier"}
          style={{ fontSize: 13, fontWeight: 700, color: vocab.domaine?.trim() ? ACCENT : "var(--v4-text3)", background: "none", border: "none", cursor: vocab.domaine?.trim() && !genLoading ? "pointer" : "default", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          {genLoading ? "…" : "✦ Générer par IA"}
        </button>
      </div>
      {genError && <div style={{ fontSize: 13.5, color: "#B45309", marginBottom: 12.5 }}>{genError}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 10, marginBottom: 16 }}>
        {entities.map(e => (
          <div key={e.id} style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)", flex: 1 }}>{e.name}</span>
              <button onClick={() => removeEntity(e.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14 }}>×</button>
            </div>
            {e.description && <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 2 }}>{e.description}</div>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
              {e.attributes.map(a => (
                <span key={a.id} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--v4-bg)", border: "1px solid var(--v4-border)", color: "var(--v4-text2)" }}>
                  {a.name}
                  <button onClick={() => removeAttribute(e.id, a.id)} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: 0 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5, marginTop: 8 }}>
              <input value={attrDraft[e.id] ?? ""} onChange={ev => setAttrDraft(prev => ({ ...prev, [e.id]: ev.target.value }))}
                onKeyDown={ev => { if (ev.key === "Enter") addAttribute(e.id); }}
                placeholder="+ attribut" style={{ ...inputStyle, flex: 1, fontSize: 13, padding: "4px 7px" }} />
            </div>
          </div>
        ))}
        {entities.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucune entité définie.</div>}
      </div>

      <div style={{ ...rowStyle, marginBottom: 16 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Client" style={{ ...inputStyle, width: 180 }} />
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Description courte (optionnel)" style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
        <button onClick={addEntity} disabled={!name.trim()} style={{ ...btnStyle, background: name.trim() ? ACCENT : "var(--v4-border)" }}>+ Entité</button>
      </div>

      {entities.length >= 2 && (
        <>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>Relations</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
            {relationships.map(r => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, padding: "6px 10px", borderRadius: 8, background: "var(--v4-bg)" }}>
                <span style={{ fontWeight: 700 }}>{entities.find(e => e.id === r.fromEntityId)?.name ?? "?"}</span>
                <span style={{ color: ACCENT, fontWeight: 700 }}>—{r.label}→</span>
                <span style={{ fontWeight: 700 }}>{entities.find(e => e.id === r.toEntityId)?.name ?? "?"}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)" }}>({r.cardinality})</span>
                <button onClick={() => removeRelationship(r.id)} style={{ marginLeft: "auto", border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14 }}>×</button>
              </div>
            ))}
            {relationships.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucune relation définie.</div>}
          </div>
          <div style={rowStyle}>
            <select value={relFrom} onChange={e => setRelFrom(e.target.value)} style={inputStyle}>
              <option value="">Entité source…</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <input value={relLabel} onChange={e => setRelLabel(e.target.value)} placeholder="Ex. passe" style={{ ...inputStyle, width: 110 }} />
            <select value={relTo} onChange={e => setRelTo(e.target.value)} style={inputStyle}>
              <option value="">Entité cible…</option>
              {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <select value={relCard} onChange={e => setRelCard(e.target.value as RelationshipCardinality)} style={inputStyle}>
              <option value="1-1">1-1</option>
              <option value="1-N">1-N</option>
              <option value="N-N">N-N</option>
            </select>
            <button onClick={addRelationship} disabled={!relFrom || !relTo || !relLabel.trim()} style={{ ...btnStyle, background: (!relFrom || !relTo || !relLabel.trim()) ? "var(--v4-border)" : ACCENT }}>+ Relation</button>
          </div>
        </>
      )}

      {entities.length > 0 && vocab.kpis.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 12 }}>Rattachement des indicateurs</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {vocab.kpis.map(k => (
              <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <span style={{ flex: 1, fontWeight: 600, color: "var(--v4-text)" }}>{k.label}</span>
                <select value={k.entityId ?? ""} onChange={e => setKpiEntity(k.id, e.target.value)} style={{ ...inputStyle, width: 180 }}>
                  <option value="">— aucune entité —</option>
                  {entities.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Graphe causal en 3 colonnes (KPI → Règles → Conclusion) — construit à
// partir de buildCausalGraph, donc reflète exactement ce que evaluateCausalRules
// vient de calculer (mêmes règles chaînées, même statut "déclenchée"). Aucune
// donnée fictive : une arête ici correspond toujours à une vraie CausalCondition.
export function CausalGraphView({ vocab }: { vocab: ArgusVocab }) {
  const { nodes, edges } = buildCausalGraph(vocab);
  const kpiNodes = nodes.filter(n => n.kind === "kpi");
  const ruleNodes = nodes.filter(n => n.kind === "rule");
  const conclusionNodes = nodes.filter(n => n.kind === "conclusion");

  if (nodes.length === 0) {
    return <div style={{ fontSize: 13.5, color: "var(--v4-text3)", marginBottom: 16 }}>Aucune règle à représenter.</div>;
  }

  const COL_W = 260;
  const ROW_H = 46;
  const rows = Math.max(kpiNodes.length, ruleNodes.length, conclusionNodes.length);
  const H = rows * ROW_H + 30;
  const cols = [kpiNodes, ruleNodes, conclusionNodes];

  function pos(colIdx: number, rowIdx: number) {
    return { x: colIdx * COL_W + COL_W / 2, y: rowIdx * ROW_H + ROW_H / 2 + 15 };
  }
  const nodeIndex = new Map<string, { col: number; row: number }>();
  cols.forEach((col, ci) => col.forEach((n, ri) => nodeIndex.set(n.id, { col: ci, row: ri })));

  // Toujours un hex — jamais une var CSS ici : elle sera concaténée avec un
  // suffixe alpha ("0f") pour le fond, ce qui n'est valide qu'avec un hex.
  function colorFor(n: typeof nodes[number]) {
    if (n.kind === "kpi") return n.status === "critique" ? "#DC2626" : n.status === "alerte" ? "#D97706" : "#059669";
    if (n.kind === "rule" || n.kind === "conclusion") return n.triggered ? "#DC2626" : "#767676";
    return "#767676";
  }

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "14px 12px", marginBottom: 16, overflowX: "auto" }}>
      <div style={{ display: "flex", gap: 0, marginBottom: 6, fontSize: 13, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".04em" }}>
        <span style={{ width: COL_W }}>Indicateurs</span>
        <span style={{ width: COL_W }}>Règles</span>
        <span style={{ width: COL_W }}>Conclusions</span>
      </div>
      <svg width={COL_W * 3} height={H} style={{ display: "block" }}>
        {edges.map((e, i) => {
          const a = nodeIndex.get(e.from), b = nodeIndex.get(e.to);
          if (!a || !b) return null;
          const p1 = pos(a.col, a.row), p2 = pos(b.col, b.row);
          const mx = (p1.x + p2.x) / 2;
          return <path key={i} d={`M ${p1.x + 90} ${p1.y} C ${mx} ${p1.y} ${mx} ${p2.y} ${p2.x - 90} ${p2.y}`} fill="none" stroke="var(--v4-border)" strokeWidth={1.4} opacity={0.7} />;
        })}
        {cols.flatMap((col, ci) => col.map((n, ri) => {
          const p = pos(ci, ri);
          const color = colorFor(n);
          const label = n.label.length > 30 ? n.label.slice(0, 30) + "…" : n.label;
          return (
            <g key={n.id}>
              <rect x={p.x - 90} y={p.y - 15} width={180} height={30} rx={7} fill={`${color}0f`} stroke={color} strokeWidth={1.3} />
              <text x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 11.5, fontWeight: 700, fill: color }}>{label}</text>
            </g>
          );
        }))}
      </svg>
    </div>
  );
}

// Sélecteur d'indicateurs pour une condition de règle causale — groupé par
// objet métier (entité) de l'ontologie minimale plutôt qu'une liste plate,
// pour qu'on choisisse "sur quel objet métier porte cette condition" avant
// "quel indicateur précisément", à l'image de la vue Alertes qui compte ses
// éléments par groupe. Un indicateur non rattaché à une entité reste
// sélectionnable (groupe "Sans objet métier") — jamais bloquant, mais
// visiblement moins structuré. Ne propose jamais rien hors de vocab.kpis :
// l'ontologie minimale reste la seule source possible d'une condition.
function OntologyKpiListbox({ vocab, selected, onToggle }: { vocab: ArgusVocab; selected: string[]; onToggle: (id: string) => void }) {
  const entities = vocab.entities ?? [];
  const groups = entities.map(e => ({ entity: e, kpis: vocab.kpis.filter(k => k.entityId === e.id) })).filter(g => g.kpis.length > 0);
  const orphans = vocab.kpis.filter(k => !k.entityId || !entities.some(e => e.id === k.entityId));

  function Row({ kpi }: { kpi: KpiDef }) {
    const isSel = selected.includes(kpi.id);
    return (
      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 8, cursor: "pointer", background: isSel ? `${ACCENT}12` : "transparent" }}>
        <input type="checkbox" checked={isSel} onChange={() => onToggle(kpi.id)} />
        <span style={{ fontSize: 13.5, fontWeight: isSel ? 700 : 500, color: isSel ? ACCENT : "var(--v4-text)" }}>{kpi.label}</span>
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--v4-text3)" }}>{kpi.unit}</span>
      </label>
    );
  }

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, maxHeight: 220, overflowY: "auto", padding: 6, marginTop: 8 }}>
      {groups.map(g => (
        <div key={g.entity.id} style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--v4-text3)", padding: "6px 8px 2px", display: "flex", alignItems: "center", gap: 12 }}>
            {g.entity.name}
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "0 6px", borderRadius: 999, background: "var(--v4-bg)", color: "var(--v4-text3)" }}>{g.kpis.length}</span>
          </div>
          {g.kpis.map(k => <Row key={k.id} kpi={k} />)}
        </div>
      ))}
      {orphans.length > 0 && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "var(--v4-text3)", padding: "6px 8px 2px", display: "flex", alignItems: "center", gap: 12 }}>
            Sans objet métier
            <span style={{ fontSize: 12.5, fontWeight: 700, padding: "0 6px", borderRadius: 999, background: "var(--v4-bg)", color: "var(--v4-text3)" }}>{orphans.length}</span>
          </div>
          {orphans.map(k => <Row key={k.id} kpi={k} />)}
        </div>
      )}
    </div>
  );
}

// Amorçage IA des règles causales quand le vocabulaire est encore vide :
// l'IA propose d'abord les indicateurs du domaine, puis les règles qui les
// relient. Les règles restent "à valider" — ce sont des hypothèses causales,
// jamais des faits, et elles n'exigent aucune donnée réelle pour exister.
function CausalSeedPanel({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [domaine, setDomaine] = useState(vocab.domaine ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (!domaine.trim()) return;
    setLoading(true); setError(null);
    const v = await suggestVocabulaire({ data: { domaine: domaine.trim(), lang: loadLang() } });
    if (!v.ok || !v.kpis?.length) { setLoading(false); setError(v.error ?? "Suggestion d'indicateurs indisponible."); return; }
    const kpis: KpiDef[] = v.kpis
      .filter(s => !vocab.kpis.some(k => k.label === s.label))
      .map(s => ({ id: crypto.randomUUID(), label: s.label, unit: s.unit, direction: s.direction, seuilAlerte: s.seuilAlerte, seuilCritique: s.seuilCritique, perimetre: s.perimetre, attributs: s.attributs }));
    const allKpis = [...vocab.kpis, ...kpis];

    const r = await suggestCausalRules({ data: { domaine: domaine.trim(), kpiLabels: allKpis.map(k => k.label), problematique: undefined } });
    setLoading(false);
    const rules: CausalRule[] = [];
    if (r.ok && r.rules) {
      for (const s of r.rules) {
        const conditions = s.conditions
          .map(c => { const kpi = allKpis.find(k => k.label === c.kpiLabel); return kpi ? { kpiId: kpi.id, minStatus: c.minStatus } : null; })
          .filter((c): c is { kpiId: string; minStatus: RuleSeverity } => c !== null);
        if (conditions.length < 2) continue;
        rules.push({ id: crypto.randomUUID(), label: s.label, conclusion: s.conclusion, severity: s.severity, origin: "llm", conditions, validation: "a_valider" });
      }
    }
    onUpdate({ ...vocab, domaine: domaine.trim(), kpis: allKpis, causalRules: [...vocab.causalRules, ...rules] });
    if (rules.length === 0) setError("Indicateurs générés, mais aucune règle exploitable — relancez « Suggérer selon le domaine ».");
  }

  return (
    <div>
      <p style={{ fontSize: 13.5, color: "var(--v4-text3)", marginTop: 0, marginBottom: 12, lineHeight: 1.6 }}>
        Une règle causale relie au moins 2 indicateurs. Votre vocabulaire n'en compte pas encore assez —
        l'IA peut proposer les indicateurs du domaine <b>puis</b> les règles qui les relient. Aucune donnée
        réelle n'est nécessaire : les règles générées sont des hypothèses, marquées « à valider ».
      </p>
      <div style={rowStyle}>
        <input value={domaine} onChange={e => setDomaine(e.target.value)} placeholder="Domaine métier (ex. Retail, Énergie…)" style={{ ...inputStyle, flex: 1, minWidth: 220 }} />
        <button onClick={run} disabled={!domaine.trim() || loading} style={{ ...btnStyle, background: domaine.trim() ? ACCENT : "var(--v4-border)" }}>
          {loading ? "…" : "✦ Générer indicateurs + règles causales"}
        </button>
      </div>
      {error && <div style={{ fontSize: 13.5, color: "#B45309", marginTop: 12.5 }}>{error}</div>}
    </div>
  );
}


export function CausalRulesSection({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"toutes" | "alertes" | "regles" | "a_valider" | "inactives">("toutes");
  // Une seule présentation à la fois : le graphe par défaut, la liste sur demande.
  const [view, setView] = useState<"graphe" | "liste">("liste");
  const graphRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (view === "graphe") window.setTimeout(() => graphRef.current?.scrollIntoView({ behavior: "auto", block: "start" }), 120); }, [view]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CausalRule | null>(null);

  const evaluated = evaluateCausalRules(vocab);
  const toValidateCount = vocab.causalRules.filter(r => r.validation === "a_valider").length;
  const counts = {
    alertes: vocab.causalRules.filter(r => r.conditions.length === 1).length,
    regles: vocab.causalRules.filter(r => r.conditions.length >= 2).length,
    inactives: vocab.causalRules.filter(r => r.alertEnabled === false).length,
  };
  const q = query.trim().toLowerCase();
  const visibleRules = vocab.causalRules.filter(r => !q || `${r.label} ${r.conclusion} ${(r.tags ?? []).join(" ")}`.toLowerCase().includes(q)).filter(r =>
    filter === "toutes" ? true
    : filter === "alertes" ? r.conditions.length === 1
    : filter === "regles" ? r.conditions.length >= 2
    : filter === "inactives" ? r.alertEnabled === false
    : r.validation === "a_valider");

  function setValidation(id: string, validation: "validee" | "a_valider") {
    onUpdate({ ...vocab, causalRules: vocab.causalRules.map(r => r.id === id ? { ...r, validation } : r) });
  }
  function startNew(kind: "alerte" | "regle") {
    const rule = blankRule();
    const first = vocab.kpis[0]?.id;
    const second = vocab.kpis[1]?.id;
    rule.conditions = kind === "alerte"
      ? (first ? [{ kpiId: first, minStatus: "alerte" }] : [])
      : [first, second].filter((x): x is string => Boolean(x)).map(kpiId => ({ kpiId, minStatus: "alerte" as RuleSeverity }));
    setEditing(rule);
  }
  function remove(rule: CausalRule) {
    if (!window.confirm(`Supprimer « ${rule.label} » ? Les conditions qui la citent seront retirées.`)) return;
    onUpdate(removeRule(vocab, rule.id));
    if (editing?.id === rule.id) setEditing(null);
  }

  async function runSuggest() {
    if (vocab.kpis.length < 2) return;
    setLoading(true); setError(null);
    const r = await suggestCausalRules({ data: { domaine: vocab.domaine ?? "généraliste", kpiLabels: vocab.kpis.map(k => k.label), problematique: undefined } });
    setLoading(false);
    if (!r.ok || !r.rules) { setError(r.error ?? "Suggestion indisponible."); return; }
    const newRules: CausalRule[] = [];
    for (const s of r.rules) {
      const conditions = s.conditions
        .map(c => { const kpi = vocab.kpis.find(k => k.label === c.kpiLabel); return kpi ? { kpiId: kpi.id, minStatus: c.minStatus } : null; })
        .filter((c): c is { kpiId: string; minStatus: RuleSeverity } => c !== null);
      if (conditions.length < 2) continue;
      newRules.push({ id: crypto.randomUUID(), label: s.label, conclusion: s.conclusion, severity: s.severity, origin: "llm", conditions, validation: "a_valider" });
    }
    if (newRules.length === 0) { setError("Aucune règle exploitable — le LLM n'a proposé que des indicateurs inconnus ou des règles à une seule condition."); return; }
    onUpdate({ ...vocab, causalRules: [...vocab.causalRules, ...newRules] });
  }

  if (vocab.kpis.length < 2) {
    return <CausalSeedPanel vocab={vocab} onUpdate={onUpdate} />;
  }

  const chip = (active: boolean): React.CSSProperties => ({ padding: "4px 10px", borderRadius: 999, border: `1.5px solid ${active ? ACCENT : "var(--v4-border)"}`, background: active ? `${ACCENT}12` : "var(--v4-surface)", color: active ? ACCENT : "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
  const small: React.CSSProperties = { fontSize: 13, fontWeight: 700, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text2)", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <p style={{ fontSize: 13.5, color: "var(--v4-text3)", margin: 0, flex: 1, minWidth: 260 }}>Une <b>alerte</b> surveille un seul indicateur ; une <b>règle causale</b> en relie au moins deux. Toutes se modifient, se dupliquent, se désactivent et se suppriment ici.</p>
        <button onClick={() => startNew("alerte")} style={btnStyle}>+ Nouvelle alerte</button>
        <button onClick={() => startNew("regle")} style={btnStyle}>+ Nouvelle règle causale</button>
        <button onClick={runSuggest} disabled={loading} style={{ ...small, color: ACCENT }}>{loading ? "…" : "✦ Suggérer selon le domaine"}</button>
      </div>
      {error && <div style={{ fontSize: 13.5, color: "#B45309", marginBottom: 12.5 }}>{error}</div>}

      {editing && (view === "graphe" || !vocab.causalRules.some(r => r.id === editing.id)) && (
        <RuleEditor vocab={vocab} rule={editing} onCancel={() => setEditing(null)} onSave={rule => { onUpdate(upsertRule(vocab, rule)); setEditing(null); }}
          onDelete={vocab.causalRules.some(r => r.id === editing.id) ? () => remove(editing) : undefined} />
      )}

      <div role="group" aria-label="Filtrer les règles" style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button aria-pressed={filter === "toutes"} onClick={() => setFilter("toutes")} style={chip(filter === "toutes")}>Toutes ({vocab.causalRules.length})</button>
        <button aria-pressed={filter === "alertes"} onClick={() => setFilter("alertes")} style={chip(filter === "alertes")}>Alertes ({counts.alertes})</button>
        <button aria-pressed={filter === "regles"} onClick={() => setFilter("regles")} style={chip(filter === "regles")}>Règles causales ({counts.regles})</button>
        <button aria-pressed={filter === "inactives"} onClick={() => setFilter("inactives")} style={chip(filter === "inactives")}>Désactivées ({counts.inactives})</button>
        <button aria-pressed={filter === "a_valider"} onClick={() => setFilter("a_valider")} style={chip(filter === "a_valider")}>À valider ({toValidateCount})</button>
        <input type="search" aria-label="Rechercher une règle" placeholder="Rechercher…" value={query} onChange={e => setQuery(e.target.value)} style={{ ...inputStyle, width: 170, padding: "4px 8px", fontSize: 13 }} />
        <span role="tablist" aria-label="Présentation des règles" style={{ marginLeft: "auto", display: "inline-flex", gap: 4 }}>
          <button role="tab" aria-selected={view === "graphe"} onClick={() => setView("graphe")} style={chip(view === "graphe")}>Graphe</button>
          <button role="tab" aria-selected={view === "liste"} onClick={() => setView("liste")} style={chip(view === "liste")}>Liste</button>
        </span>
      </div>

      {view === "graphe" && <div ref={graphRef} />}{view === "graphe" && <CausalFlowGraph vocab={vocab} onUpdate={onUpdate} visibleRuleIds={new Set(visibleRules.map(r => r.id))} onEditRule={id => {
        const rule = vocab.causalRules.find(r => r.id === id);
        if (!rule) return;
        setFilter("toutes");
        setEditing(structuredClone(rule));
        setTimeout(() => document.querySelector(`[data-rule-id="${CSS.escape(id)}"], form[aria-label="Éditeur de règle"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
      }} />}

      {view === "liste" && <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {visibleRules.map(rule => {
          if (editing?.id === rule.id) {
            return <RuleEditor key={rule.id} vocab={vocab} rule={editing} onCancel={() => setEditing(null)} onSave={next => { onUpdate(upsertRule(vocab, next)); setEditing(null); }} />;
          }
          const evaluation = evaluated.find(e => e.rule.id === rule.id);
          const triggered = evaluation?.triggered ?? false;
          const matches = evaluation?.matches ?? [];
          const color = STATUS_COLOR[rule.severity];
          const needsValidation = rule.validation === "a_valider";
          const enabled = rule.alertEnabled !== false;
          const kind = ruleKind(rule);
          return (
            <article key={rule.id} data-rule-id={rule.id} aria-label={rule.label} style={{ border: `1.5px solid ${needsValidation ? "#B45309" : triggered ? color : "var(--v4-border)"}`, borderRadius: 8, padding: "10px 12px", background: !enabled ? "var(--v4-bg)" : triggered ? `${color}0a` : "transparent", opacity: enabled ? 1 : 0.72 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--v4-text)", flex: 1, minWidth: 180 }}>{rule.label}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "var(--v4-accent-bg)", color: "var(--v4-text2)" }}>{kind === "alerte" ? "Alerte · 1 indicateur" : kind === "règle causale" ? `Règle causale · ${rule.conditions.length} conditions` : "Modèle sans condition"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: `${color}18`, color }}>{rule.severity === "critique" ? "critique" : "à surveiller"}</span>
                {needsValidation && <span style={{ fontSize: 12.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: "#B4530918", color: "#B45309" }}>à valider</span>}
                {(rule.tags ?? []).map(t => (
                  <span key={t} style={{ fontSize: 12.5, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "var(--v4-bg)", color: "var(--v4-text3)", border: "1px solid var(--v4-border)" }}>{t}</span>
                ))}
                {triggered && <span style={{ fontSize: 12.5, fontWeight: 800, padding: "2px 8px", borderRadius: 999, background: `${color}18`, color }}>déclenchée</span>}
                <label style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v4-text3)", cursor: "pointer", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={enabled} onChange={() => onUpdate(setRuleEnabled(vocab, rule.id, !enabled))} aria-label={`Activer ${rule.label}`} /> active
                </label>
                {needsValidation && <button onClick={() => setValidation(rule.id, "validee")} style={{ ...small, borderColor: "#059669", color: "#059669" }}>✓ Valider</button>}
                <button onClick={() => setEditing(structuredClone(rule))} style={small} aria-label={`Modifier ${rule.label}`}>Modifier</button>
                <button onClick={() => onUpdate(duplicateRule(vocab, rule.id))} style={small} aria-label={`Dupliquer ${rule.label}`}>Dupliquer</button>
                <button onClick={() => remove(rule)} style={{ ...small, color: "#B91C1C" }} aria-label={`Supprimer ${rule.label}`}>Supprimer</button>
              </div>
              <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 4 }}>
                {rule.conditions.length ? <>Si {rule.conditions.map(c => {
                  if (c.ruleId) return `[${vocab.causalRules.find(r => r.id === c.ruleId)?.label ?? "?"}] déclenchée`;
                  const kpi = vocab.kpis.find(k => k.id === c.kpiId);
                  return `${kpi?.label ?? "?"} ≥ ${c.minStatus} (${kpi ? `${kpi.direction === "au_dessus_alerte" ? "≥" : "≤"} ${c.minStatus === "critique" ? kpi.seuilCritique : kpi.seuilAlerte} ${kpi.unit}` : "?"})`;
                }).join(" ET ")}</> : "Aucune condition : modèle de décision, jamais déclenché tant qu'aucun indicateur n'est ajouté."}
              </div>
              {evaluation && rule.conditions.some(c => c.kpiId) && (
                <div style={{ fontSize: 12.5, color: evaluation.scope.kind === "incoherente" ? "#B91C1C" : "var(--v4-text3)", marginTop: 4 }}>
                  {evaluation.scope.kind === "incoherente" ? `Incohérente : ${evaluation.scope.summary}.` : `S'applique par : ${evaluation.scope.kind === "entite" ? evaluation.scope.entityName : "ensemble des données"}`}
                </div>
              )}
              {triggered && matches.length > 0 && (
                <div data-testid="rule-entities" style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 4 }}>
                  Entités concernées ({matches.length}) : {matches.slice(0, 6).map((m, i) => <span key={m.key}>{i ? ", " : ""}<b style={{ fontWeight: i === 0 ? 800 : 600 }}>{m.label}</b></span>)}{matches.length > 6 ? ` … (+${matches.length - 6})` : ""}
                </div>
              )}
              {rule.conclusion && <div style={{ fontSize: 13.5, color: "var(--v4-text2)", marginTop: 4 }}>{rule.conclusion}</div>}
              {!!rule.options?.length && <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 4 }}>Options : {rule.options.join(" · ")}</div>}
            </article>
          );
        })}
        {visibleRules.length === 0 && <div style={{ fontSize: 13.5, color: "var(--v4-text3)" }}>Aucune règle dans ce filtre.</div>}
      </div>}
    </div>
  );
}

// Éditeur complet d'une alerte ou d'une règle causale : libellé, gravité,
// conditions (indicateur + niveau, ou autre règle déclenchée), conclusion,
// question de décision, causes, options et étiquettes.
function RuleEditor({ vocab, rule, onSave, onCancel, onDelete }: { vocab: ArgusVocab; rule: CausalRule; onSave: (r: CausalRule) => void; onCancel: () => void; onDelete?: () => void }) {
  const [draft, setDraft] = useState<CausalRule>(rule);
  const [causes, setCauses] = useState((rule.causes ?? []).join("\n"));
  const [options, setOptions] = useState((rule.options ?? []).join("\n"));
  const [tags, setTags] = useState((rule.tags ?? []).join(", "));
  const set = (patch: Partial<CausalRule>) => setDraft(d => ({ ...d, ...patch }));
  const setCondition = (i: number, patch: CausalCondition) => set({ conditions: draft.conditions.map((c, j) => j === i ? patch : c) });
  const others = vocab.causalRules.filter(r => r.id !== draft.id);
  // Objet sur lequel toutes les conditions doivent être vraies ensemble,
  // déduit de l'ontologie ; sans relation entre les objets, pas d'enregistrement.
  const scope = ruleScope(vocab, draft.conditions);
  const valid = draft.label.trim().length > 0 && draft.conditions.every(c => c.ruleId || c.kpiId) && scope.kind !== "incoherente";
  const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12.5, fontWeight: 700, color: "var(--v4-text2)" };
  const kind = draft.conditions.length >= 2 ? "règle causale" : "alerte";
  return (
    <form aria-label="Éditeur de règle" onSubmit={e => { e.preventDefault(); if (valid) onSave({ ...draft, causes: causes.split("\n"), options: options.split("\n"), tags: tags ? tags.split(",") : undefined }); }}
      style={{ border: `1.5px solid ${ACCENT}`, borderRadius: 10, padding: 14, background: "var(--v4-surface)", display: "flex", flexDirection: "column", gap: 12, marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: ACCENT, textTransform: "uppercase", letterSpacing: ".04em" }}>{vocab.causalRules.some(r => r.id === draft.id) ? "Modifier" : "Créer"} · {kind}</div>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1fr)", gap: 10 }}>
        <label style={label}>Libellé<input name="label" value={draft.label} onChange={e => set({ label: e.target.value })} placeholder="Ex. Fournisseur saturé sur commande critique" style={inputStyle} /></label>
        <label style={label}>Gravité<select name="severity" value={draft.severity} onChange={e => set({ severity: e.target.value as RuleSeverity, displaySeverity: e.target.value === "critique" ? "critique" : draft.displaySeverity === "critique" ? "majeure" : draft.displaySeverity })} style={inputStyle}><option value="alerte">Alerte (à surveiller)</option><option value="critique">Critique</option></select></label>
      </div>
      <fieldset style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "8px 10px", margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        <legend style={{ fontSize: 12.5, fontWeight: 800, color: "var(--v4-text2)", padding: "0 4px" }}>Conditions (toutes doivent être vraies)</legend>
        {draft.conditions.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--v4-text3)", width: 28 }}>{i === 0 ? "SI" : "ET"}</span>
            <select aria-label={`Condition ${i + 1}`} value={c.ruleId ? `rule:${c.ruleId}` : `kpi:${c.kpiId ?? ""}`}
              onChange={e => { const [t, id] = e.target.value.split(/:(.*)/); setCondition(i, t === "rule" ? { ruleId: id } : { kpiId: id, minStatus: c.minStatus ?? "alerte" }); }}
              style={{ ...inputStyle, flex: 1, minWidth: 220 }}>
              <optgroup label="Indicateurs">{vocab.kpis.map(k => <option key={k.id} value={`kpi:${k.id}`}>{k.label} ({k.unit} · alerte {k.seuilAlerte}, critique {k.seuilCritique})</option>)}</optgroup>
              {others.length > 0 && <optgroup label="Autre règle déclenchée">{others.map(r => <option key={r.id} value={`rule:${r.id}`}>{r.label}</option>)}</optgroup>}
            </select>
            {!c.ruleId && (
              <select aria-label={`Niveau de la condition ${i + 1}`} value={c.minStatus ?? "alerte"} onChange={e => setCondition(i, { ...c, minStatus: e.target.value as RuleSeverity })} style={inputStyle}>
                <option value="alerte">au moins en alerte</option>
                <option value="critique">en critique</option>
              </select>
            )}
            <button type="button" aria-label={`Retirer la condition ${i + 1}`} onClick={() => set({ conditions: draft.conditions.filter((_, j) => j !== i) })} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 16 }}>×</button>
          </div>
        ))}
        <button type="button" onClick={() => set({ conditions: [...draft.conditions, { kpiId: vocab.kpis[0]?.id, minStatus: "alerte" }] })} style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 700, color: ACCENT, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>+ Ajouter une condition</button>
        {draft.conditions.some(c => c.kpiId) && (scope.kind === "incoherente"
          ? <div role="alert" data-testid="rule-scope" style={{ fontSize: 13, fontWeight: 700, color: "#B91C1C" }}>Incohérent : {scope.summary}. Ces conditions ne peuvent pas porter sur la même entité ; retirez-en une ou ajoutez la relation dans l'ontologie.</div>
          : <div data-testid="rule-scope" style={{ fontSize: 13, color: "var(--v4-text2)" }}>S'applique par : <b>{scope.kind === "entite" ? scope.summary : "ensemble des données"}</b></div>)}
        <small style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>Les seuils se règlent dans Modéliser → Indicateurs & seuils.</small>
      </fieldset>
      <label style={label}>Conclusion (ce que la règle signifie)<textarea name="conclusion" rows={2} value={draft.conclusion} onChange={e => set({ conclusion: e.target.value })} placeholder="Ex. Le fournisseur risque de ne pas honorer la commande : sécuriser un second source." style={{ ...inputStyle, resize: "vertical" }} /></label>
      <label style={label}>Question de décision<input name="decisionQuestion" value={draft.decisionQuestion ?? ""} onChange={e => set({ decisionQuestion: e.target.value })} placeholder="Ex. Sécuriser, remplacer, accélérer ou accepter le risque ?" style={inputStyle} /></label>
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 10 }}>
        <label style={label}>Causes (une par ligne)<textarea name="causes" rows={3} value={causes} onChange={e => setCauses(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} /></label>
        <label style={label}>Options de décision (une par ligne)<textarea name="options" rows={3} value={options} onChange={e => setOptions(e.target.value)} style={{ ...inputStyle, resize: "vertical" }} /></label>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ ...label, flex: 1, minWidth: 200 }}>Étiquettes (séparées par des virgules)<input name="tags" value={tags} onChange={e => setTags(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--v4-text2)", paddingBottom: 8 }}><input type="checkbox" checked={draft.alertEnabled !== false} onChange={e => set({ alertEnabled: e.target.checked })} /> Active</label>
        {onDelete && <button type="button" onClick={onDelete} style={{ ...btnStyle, background: "var(--v4-surface)", color: "#b91c1c", border: "1px solid var(--v4-border)" }}>Supprimer</button>}
        <button type="button" onClick={onCancel} style={{ ...btnStyle, background: "var(--v4-surface)", color: "var(--v4-text2)", border: "1px solid var(--v4-border)" }}>Annuler</button>
        <button type="submit" disabled={!valid} style={{ ...btnStyle, background: valid ? ACCENT : "var(--v4-border)" }}>Enregistrer</button>
      </div>
    </form>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
// Le Studio est un parcours, pas un menu : six étapes de paramétrage dans
// l'ordre où elles se conditionnent (on ne mappe pas avant d'avoir des champs),
// puis trois vues de lecture qui restituent le résultat.
const SECTIONS = [
  { key: "vocab", label: "Vocabulaire métier", icon: "📖", phase: "Définir le langage" },
  { key: "entities", label: "Entités & relations", icon: "🔷", phase: "Définir le langage" },
  { key: "apps", label: "Applications & connexions", icon: "🔌", phase: "Raccorder le SI" },
  { key: "capabilities", label: "Capabilities", icon: "🧩", phase: "Raccorder le SI" },
  { key: "data", label: "Données échantillon", icon: "📊", phase: "Raccorder le SI" },
  // Un seul mapping pour tous les objets métier — qu'ils portent un seuil
  // (grandeur suivie) ou non. Les deux anciennes étapes « Mappings » et
  // « Ontology Mapping » créaient une confusion : c'est le même geste,
  // rapprocher un champ source d'un objet métier validé.
  { key: "mappings", label: "Mapping des objets métier", icon: "🔗", phase: "Raccorder le SI" },
  { key: "rules", label: "Règles causales", icon: "⚡", readOnly: true, phase: "Faire raisonner" },
  { key: "ontology", label: "Ontologie vivante", icon: "🌐", readOnly: true, phase: "Faire raisonner" },
] as const;


type SectionKey = (typeof SECTIONS)[number]["key"];

const SECTION_SUBTITLE: Record<SectionKey, string> = {
  vocab: "Indicateurs, seuils, propriétaires",
  apps: "Applications sources et connexions",
  capabilities: "Capabilities L1→L4 et applications associées",
  entities: "Objets métier, attributs, relations",
  data: "Échantillons par champ applicatif",
  mappings: "Champ source → objet métier",
  rules: "Combinaisons signalant un risque composé",
  ontology: "Objets métier et données réelles",
};

/** Ce qui reste à faire, lu sur le vocabulaire — jamais saisi à la main. */
function journeySteps(vocab: ArgusVocab) {
  const done: Record<SectionKey, boolean> = {
    vocab: vocab.kpis.length > 0,
    apps: vocab.apps.length > 0,
    capabilities: (vocab.capabilities ?? []).length > 0,
    entities: (vocab.entities ?? []).length > 0,
    data: vocab.fields.length > 0,
    mappings: vocab.mappings.length > 0 || (vocab.entityMappings ?? []).length > 0,
    rules: vocab.causalRules.length > 0,
    ontology: false,
  };
  return SECTIONS.map(s => ({
    key: s.key, label: s.label, icon: s.icon,
    readOnly: "readOnly" in s ? s.readOnly : false,
    done: done[s.key],
    hint: SECTION_SUBTITLE[s.key],
    phase: s.phase,
  }));
}



// Bouton "démo" — un exemple sectoriel complet et cohérent (KPI → application
// → champ → mapping → règle causale) en un clic, pour voir Studio déjà
// rempli sans attendre un vrai raccordement SI. Reste 100% éditable après
// coup : c'est un point de départ, pas un mode figé.
export function DemoPresetPicker({ onPick }: { onPick: (preset: DemoPreset) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 8, border: `1.5px solid ${ACCENT}`, background: open ? ACCENT : "none", color: open ? "#fff" : ACCENT, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        <AuraIcon e="🎬" size={13} /> Démo sectorielle
      </button>
      {open && (
        <div onMouseLeave={() => setOpen(false)}
          style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 30, width: 300, background: "#fff", border: "1px solid #c4c4c4", borderRadius: 8, boxShadow: "0 16px 40px -12px rgba(20,18,40,0.25)", padding: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase", color: "#767676", padding: "6px 8px 8px" }}>Charger un exemple complet</div>
          {DEMO_PRESETS.map(p => (
            <button key={p.id} onClick={() => { onPick(p.id); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 9px", borderRadius: 8, border: "none", background: "transparent", fontFamily: "inherit", cursor: "pointer", marginBottom: 2 }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f7f7f7")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text)" }}>{p.label}</div>
              <div style={{ fontSize: 13, color: "#767676", marginTop: 1 }}>{p.description}</div>
            </button>
          ))}
          <div style={{ fontSize: 13, color: "#c4c4c4", padding: "6px 9px 2px", fontStyle: "italic" }}>Remplace le vocabulaire actuel. Modifiable ensuite.</div>
        </div>
      )}
    </div>
  );
}

// Bandeau de connexion live au SI Maison Lucie — le seul endroit où Studio
// interroge réellement le portail (voir importMaisonLucieLive dans
// argus-vocab-store.ts, qui appelle GET /api/catalog puis /api/data/<app>
// sur https://maison-lucie-si.vercel.app). N'apparaît que quand le
// vocabulaire chargé EST le référentiel Maison Lucie (app "ml-sap"
// présente) — les autres démos sectorielles n'ont rien à connecter ici.
// Tente une connexion automatique une fois si aucune valeur n'est encore
// arrivée, et propose toujours un bouton pour réessayer manuellement.
export function MaisonLucieConnectBanner({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [triedAuto, setTriedAuto] = useState(false);
  const isMaisonLumen = vocab.apps.some(a => a.id === "ml-sap");
  const hasLiveData = vocab.fields.some(f => f.id === "ml-f-s1-capacity-risk" && f.sampleValues.length > 0);

  async function connect() {
    setStatus("connecting");
    setError(null);
    const r = await importMaisonLucieLive(vocab);
    if (r.ok) { onUpdate(r.vocab); setStatus("connected"); }
    else { setError(r.error); setStatus("error"); }
  }

  useEffect(() => {
    if (isMaisonLumen && !hasLiveData && !triedAuto) {
      setTriedAuto(true);
      void connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMaisonLumen, hasLiveData, triedAuto]);

  if (!isMaisonLumen) return null;

  const connected = hasLiveData && status !== "connecting";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: 8, border: "1px solid var(--v4-border)", background: connected ? "#05966908" : status === "error" ? "#dc262608" : "var(--v4-panel)", marginBottom: 4 }}>
      <AuraIcon e={status === "connecting" ? "⏳" : connected ? "🔌" : "⚠"} size={14} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--v4-text2)" }}>
        {status === "connecting" && "Connexion au SI Maison Lucie (github.com/mambayelo-lab/maison-lucie-si) — GET /api/catalog puis /api/data/<app>…"}
        {connected && <span><strong style={{ color: "#059669" }}>Connecté</strong> — indicateurs importés en direct depuis le portail Maison Lucie.</span>}
        {status === "error" && <span><strong style={{ color: "#dc2626" }}>Import indisponible</strong> — {error} (attendu si ce bac à sable bloque la sortie réseau ; fonctionne depuis un navigateur qui atteint maison-lucie-si.vercel.app).</span>}
        {status === "idle" && !hasLiveData && "En attente de connexion au SI Maison Lucie."}
      </div>
      <button type="button" onClick={() => void connect()} disabled={status === "connecting"} style={{ fontSize: 13, fontWeight: 800, padding: "5px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "#fff", cursor: status === "connecting" ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
        {connected ? "↻ Rafraîchir" : "Réessayer"}
      </button>
    </div>
  );
}

