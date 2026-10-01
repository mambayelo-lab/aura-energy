// Studio : un seul parcours en 4 étapes pour connecter le SI de n'importe quelle entreprise.
// 1. Cartographier (questionnaire) · 2. Connecter (identifiants côté serveur, test)
// 3. Vérifier (couverture, correspondances, écarts) · 4. Régler les alertes.
// Aucune donnée codée en dur : tout vient du questionnaire importé, des métadonnées
// lues par les connecteurs et des validations. L'exemple Maison Lucie est étiqueté démo.
import { useDismiss } from "@/lib/ui/use-dismiss";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, FileSpreadsheet, FileText, Footprints, Info, PlugZap, RefreshCw, Upload, X, Zap } from "lucide-react";
import { loadStandardSi } from "../../../lib/v4/supply-standard";
import type { ArgusVocab } from "../../../lib/v4/argus-vocab-store";
import { CausalRulesSection, LivingOntologySection } from "./StudioSections";
import { OntologyGraph } from "./SupplyDiagrams";
import { effectiveAcv, isActive, importQuestionnaire, maisonLucieExample, maisonLucieScaleExample, maisonLucieChannelsExample, maisonLucieMcpExample, pickFilledSheet, Q_COLUMNS, Q_NOTICE, Q_ONTOLOGY, questionnaireSheets, rowsFromSheet, OBJECT_OF_GROUP, DEFAULT_ALERT_SETTINGS, DEFAULT_OPTIONS, type BindingGroup, type ImportedSetup } from "../../../lib/integration/questionnaire";
import { readCsv, readXlsx, writeDocx, writeXlsx } from "../../../lib/integration/office";
import { KIND_LABELS, ACCESS_MODES, type SourceConfig } from "../../../lib/integration/types";
import { DEFAULT_BUDGET } from "../../../lib/integration/budget";
import { AUTO_THRESHOLD, type FieldProposal } from "../../../lib/integration/discovery";
import { bridgeToVocab, ENTITY_OF_GROUP, type Profiles } from "../../../lib/integration/vocab-bridge";
import { saveCockpitSnapshot } from "../../../lib/integration/cockpit";
import { audit, useAccess } from "../../../lib/security/use-access";
import { ACV_TOLERANCE_LABEL } from "../../../lib/integration/ownership";
import { MAISON_LUCIE_PORTAL } from "../../../lib/v4/maison-lucie-live";
import { DocStatusList } from "../DocumentDrop";
import { DOC_ACCEPT } from "../../../lib/v4/doc-formats";
import type { DocResult } from "../../../lib/v4/doc-extract";
import { A_CONFIRMER, landscapeFromDiagram, landscapeToQuestionnaire, mergeLandscapes, questionnaireSheetFrom, type Landscape } from "../../../lib/integration/landscape";
import { discoverIntegration, saveIntegrationSetup, syncIntegration, testIntegrationSource, type IntegrationView } from "../../../lib/integration/integration.functions";

type TestState = { status: "vert" | "orange" | "rouge"; message: string; latencyMs: number; calls?: number; rows?: number; maxCalls?: number };
const KEY = "aura.integration.v1";
const GROUPS: BindingGroup[] = ["suppliers", "products", "facilities", "stock", "shipments", "orders", "sales"];
const STEPS = ["Cartographier", "Connecter", "Vérifier", "Régler les alertes"] as const;
/** Mode démo « Démo Maison Lucie en un clic » : les étapes du parcours enchaînées sur le SI de démonstration
 *  (identifiants de démo inclus). Ne s'applique pas au SI d'un client : pour lui, le mode normal est « Pas à pas ». */
const ONE_CLICK = [
  ["questionnaire", "Questionnaire Maison Lucie importé"], ["connexion", "Connexion aux sources"], ["metadonnees", "Métadonnées et échantillons"],
  ["mapping", "Mapping proposé et accepté au-dessus du seuil"], ["synchro", "Synchronisation sous budget"], ["alertes", "Alertes et résilience calculées"], ["cockpit", "Ouverture du cockpit"],
] as const;
/** Seuil d'acceptation automatique des correspondances « à valider » en mode démo (Démo Maison Lucie en un clic). */
const ONE_CLICK_THRESHOLD = 0.6;
type OneClick = { step: number; status: "running" | "done" | "error"; detail: Record<string, string>; error?: string };

function download(name: string, bytes: Uint8Array, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
const Tip = ({ text }: { text: string }) => <span className="ij-tip" title={text} aria-label={text}><Info size={13} /></span>;
const envName = (s: SourceConfig) => String((s.params.bearer ?? s.params.dsn ?? "") as string).replace(/^\{\{env:|\}\}$/g, "");

export function IntegrationJourney({ vocab, onUpdate }: { vocab: ArgusVocab; onUpdate: (v: ArgusVocab) => void }) {
  const [setup, setSetup] = useState<ImportedSetup | null>(null);
  const [profiles, setProfiles] = useState<Profiles>({});
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const [view, setView] = useState<IntegrationView | null>(null);
  const [published, setPublished] = useState(false);
  const [step, setStep] = useState(0);
  const [vtab, setVtab] = useState<"couverture" | "mapping" | "ontologie" | "ecarts">("couverture");
  const [sampleKey, setSampleKey] = useState<string | null>(null);
  useDismiss(!!sampleKey, () => setSampleKey(null));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const schemaRef = useRef<HTMLInputElement>(null);
  const [landscape, setLandscape] = useState<Landscape | null>(null);
  const [schemaDocs, setSchemaDocs] = useState<DocResult[]>([]);
  const access = useAccess();
  const canSrc = access.can("sources.edit"), canMap = access.can("mappings.edit"), canTh = access.can("thresholds.edit");
  const loaded = useRef(false);
  const navigate = useNavigate();
  const [oneClick, setOneClick] = useState<OneClick | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (s?.setup) { setSetup(s.setup); setProfiles(s.profiles ?? {}); setTests(s.tests ?? {}); setView(s.view ?? null); setPublished(!!s.published); setStep(s.step ?? 0); }
    } catch { /* stockage indisponible */ }
    loaded.current = true;
  }, []);
  useEffect(() => {
    if (!loaded.current) return;
    try { localStorage.setItem(KEY, JSON.stringify({ setup, profiles, tests, view, published, step })); } catch { /* stockage indisponible */ }
  }, [setup, profiles, tests, view, published, step]);

  const errors = setup?.issues.filter(i => i.level === "erreur") ?? [];
  const activeIds = useMemo(() => new Set((setup?.sources ?? []).filter(isActive).map(s => s.id)), [setup]);
  const allProposals = setup?.proposals ?? [];
  // Correspondances des sources désactivées : suspendues (conservées, hors calcul).
  const proposals = useMemo(() => allProposals.filter(p => activeIds.has(p.sourceId)), [allProposals, activeIds]);
  const inactiveLabels = new Set((setup?.sources ?? []).filter(s => !isActive(s)).map(s => s.label));
  const liveAlerts = (view?.alerts ?? []).filter(a => !inactiveLabels.has(a.evidence.source));
  const eff = setup ? effectiveAcv(setup) : null;
  const allTested = !!setup && setup.sources.length > 0 && setup.sources.every(s => tests[s.id] && tests[s.id].status !== "rouge");
  const done = [!!setup && !errors.length, allTested && proposals.length > 0, !!view, published];

  const lastAudit = useRef<Record<string, number>>({});
  function auditOnce(key: string, action: string, target: string) { const t = Date.now(); if (t - (lastAudit.current[key] ?? 0) > 30_000) { lastAudit.current[key] = t; audit(action, target); } }
  function setAcv(i: number, patch: Partial<ImportedSetup["acv"]["attributes"][number]>) {
    if (!setup || !canMap) return;
    const attributes = setup.acv.attributes.map((a, k) => (k === i ? { ...a, ...patch } : a));
    audit("mappings.maitre", `${attributes[i].attribute} : maître ${attributes[i].master ?? "hérité"}`);
    applySetup({ ...setup, acv: { ...setup.acv, attributes } }, true);
  }
  function setSourceStatus(id: string, status: "active" | "inactive" | "obsolete") {
    if (!setup || !canSrc) return;
    const next = { ...setup, sources: setup.sources.map(x => (x.id === id ? { ...x, status, enabled: status === "active" } : x)) };
    audit("sources.etat", `${setup.sources.find(x => x.id === id)?.label ?? id} → ${status}`);
    applySetup(next, true);
    onUpdate(bridgeToVocab(vocab, next, profiles, next.proposals ?? []));
  }
  function applySetup(next: ImportedSetup, keep = false) {
    setSetup(next);
    if (!keep) { setProfiles({}); setTests({}); setView(null); setPublished(false); }
    saveIntegrationSetup({ data: { setup: next } }).catch(() => { /* conservée localement */ });
  }
  function importRows(rows: ReturnType<typeof rowsFromSheet>, tokenRef?: () => string) {
    // Référence par défaut : AURA_<APPLICATION>_TOKEN, à définir dans les variables du serveur.
    const s = importQuestionnaire(rows, { tokenRef: tokenRef ?? (app => `{{env:AURA_${app.normalize("NFD").replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_TOKEN}}`) });
    applySetup(s);
    setStep(0);
  }
  async function onFile(f: File) {
    setError(null);
    try {
      const buf = await f.arrayBuffer();
      if (/\.csv$/i.test(f.name)) importRows(rowsFromSheet(readCsv(new TextDecoder().decode(buf))));
      else { const sheet = pickFilledSheet(await readXlsx(buf)); if (!sheet) throw new Error("Aucune feuille « Objet métier » reconnue dans ce fichier."); importRows(sheet.rows); }
    } catch (e) { setError((e as Error).message); }
  }
  // Raccourci : un schéma du SI (image, PDF, draw.io, BPMN, ArchiMate, Visio…) pré-remplit la cartographie.
  async function onSchema(files: File[]) {
    if (!files.length) return;
    setError(null); setBusy("Lecture du schéma…");
    try {
      const { extractFiles } = await import("../../../lib/v4/doc-extract");
      const rs = await extractFiles(files, m => setBusy(m));
      setSchemaDocs(rs);
      const ls: Landscape[] = rs.filter(r => r.diagram?.nodes.length).map(r => landscapeFromDiagram(r.diagram!));
      const free = rs.filter(r => r.status !== "non lisible" && !r.diagram?.nodes.length && r.text.trim());
      if (free.length) {
        setBusy("Déduction des applications et des flux…");
        const { deduceLandscape } = await import("../../../lib/integration/landscape.functions");
        ls.push(await deduceLandscape({ data: { text: free.map(r => `[${r.name}]\n${r.text}`).join("\n\n") } }));
      }
      if (!ls.length) { setLandscape(null); setError("Aucun fichier lisible : voir l'état de chaque fichier."); return; }
      setLandscape(mergeLandscapes(ls));
    } catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }
  async function downloadPrefilled() { if (landscape) download("Cartographie pré-remplie.xlsx", await writeXlsx(questionnaireSheetFrom(landscape)), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }
  async function downloadXlsx() { download("Cartographie des sources Supply.xlsx", await writeXlsx(questionnaireSheets()), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"); }
  async function downloadDocx() {
    const rows = [[...Q_COLUMNS].slice(0, 11), ...Q_ONTOLOGY.map(a => [a.objet, a.attribut, a.description, "", "", "", "", "", a.key ? "oui" : "", "", ""])];
    download("Cartographie des sources Supply.docx", await writeDocx("Cartographie des sources Supply", Q_NOTICE, [{ title: "Questionnaire", rows }]), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  }

  function updateSource(id: string, patch: (s: SourceConfig) => SourceConfig) {
    if (!setup || !canSrc) return;
    auditOnce(`sources.modification:${id}`, "sources.modification", setup.sources.find(x => x.id === id)?.label ?? id);
    applySetup({ ...setup, sources: setup.sources.map(s => (s.id === id ? patch(s) : s)) }, true);
  }

  async function testAll() {
    if (!setup) return;
    setBusy("Test des connexions…"); setError(null);
    const next: Record<string, TestState> = {};
    for (const s of setup.sources) {
      try {
        const r = await testIntegrationSource({ data: { source: s } });
        next[s.id] = { status: !r.ok ? "rouge" : r.latencyMs > 2000 ? "orange" : "vert", message: r.message, latencyMs: r.latencyMs, calls: r.budget.calls, rows: r.budget.rows, maxCalls: r.budget.maxCalls };
      } catch (e) { next[s.id] = { status: "rouge", message: (e as Error).message, latencyMs: 0 }; }
      setTests({ ...next });
    }
    // Métadonnées réelles + échantillon limité → correspondances proposées.
    setBusy("Lecture des métadonnées et d'un échantillon…");
    const d = await discoverIntegration({ data: { setup, sampleRows: 50 } });
    setBusy(null);
    if (!d.ok) { setError(d.error); return; }
    const parsed = JSON.parse(d.json) as { proposals: FieldProposal[]; profiles: Profiles };
    for (const p of Object.values(parsed.profiles)) if (p.metadata === "échantillon JSON" && next[p.source]?.status === "vert") next[p.source] = { ...next[p.source], status: "vert" };
    setTests({ ...next });
    setProfiles(parsed.profiles);
    const withProps = { ...setup, proposals: parsed.proposals };
    applySetup(withProps, true);
    onUpdate(bridgeToVocab(vocab, withProps, parsed.profiles, parsed.proposals, Object.fromEntries(Object.entries(next).map(([k, v]) => [k, v.status !== "rouge"]))));
    if (Object.values(next).every(t => t.status !== "rouge")) setStep(2);
  }

  function setProposal(p: FieldProposal, patch: Partial<FieldProposal>) {
    if (!setup || !canMap) return;
    audit("mappings.modification", `${p.label} ← ${patch.column ?? p.column ?? "—"}`, { statut: patch.status ?? p.status });
    const list = proposals.map(x => (x.attributeId === p.attributeId && x.sourceId === p.sourceId ? { ...x, ...patch } : x));
    applySetup({ ...setup, proposals: list }, true);
    onUpdate(bridgeToVocab(vocab, { ...setup, proposals: list }, profiles, list));
  }

  async function syncNow() {
    if (!setup) return;
    setBusy("Mise à jour sous budget…"); setError(null);
    const r = await syncIntegration({ data: { setup, mode: view ? "incremental" : "full" } });
    setBusy(null);
    if (!r.ok) { setError(r.error); return; }
    setView(JSON.parse(r.viewJson) as IntegrationView);
    setPublished(false);
  }
  function publish() {
    if (!view) return;
    saveCockpitSnapshot({ asOf: view.asOf, alerts: liveAlerts, series: view.series, publishedAt: new Date().toISOString() });
    setPublished(true);
    audit("regles.publication", `${liveAlerts.length} alerte(s) publiée(s)`);
  }

  // ── Démo Maison Lucie en un clic (mode démo uniquement) : enchaîne questionnaire → connexion → métadonnées → mapping → synchronisation → alertes → cockpit.
  async function runOneClick() {
    if (!canSrc) return;
    const detail: Record<string, string> = {};
    const at = (i: number, text?: string) => { if (text) detail[ONE_CLICK[i][0]] = text; setOneClick({ step: i, status: "running", detail: { ...detail } }); };
    const fail = (i: number, why: string) => { setOneClick({ step: i, status: "error", detail: { ...detail }, error: `${ONE_CLICK[i][1]} : ${why}` }); setBusy(null); };
    setError(null); audit("studio.demo-un-clic", "Démo Maison Lucie");
    // 1. Questionnaire.
    at(0);
    const s0 = importQuestionnaire(maisonLucieExample(MAISON_LUCIE_PORTAL), { tokenRef: () => "{{env:LUCIE_GATEWAY_TOKEN}}" });
    const bad = s0.issues.filter(i => i.level === "erreur");
    if (bad.length) return fail(0, bad[0].message);
    applySetup(s0); setStep(0);
    at(1, `${s0.summary.applications} applications, ${s0.summary.renseignees} lignes`);
    // 2. Connexion : chaque source testée, arrêt à la première en échec.
    const t: Record<string, TestState> = {};
    for (const src of s0.sources) {
      try {
        const r = await testIntegrationSource({ data: { source: src } });
        t[src.id] = { status: !r.ok ? "rouge" : r.latencyMs > 2000 ? "orange" : "vert", message: r.message, latencyMs: r.latencyMs, calls: r.budget.calls, rows: r.budget.rows, maxCalls: r.budget.maxCalls };
        if (!r.ok) { setTests({ ...t }); return fail(1, `${src.label} : ${r.message}`); }
      } catch (e) { return fail(1, `${src.label} : ${(e as Error).message}`); }
      setTests({ ...t });
    }
    at(2, `${s0.sources.length} sources connectées`);
    // 3. Métadonnées et échantillons.
    const d = await discoverIntegration({ data: { setup: s0, sampleRows: 50 } }).catch(e => ({ ok: false as const, error: (e as Error).message }));
    if (!d.ok) return fail(2, d.error);
    const parsed = JSON.parse(d.json) as { proposals: FieldProposal[]; profiles: Profiles };
    setProfiles(parsed.profiles);
    at(3, `${Object.keys(parsed.profiles).length} tables profilées`);
    // 4. Mapping : les propositions au-dessus du seuil sont acceptées ; les autres restent « à valider ».
    const accepted = parsed.proposals.map(p => (p.status === "à valider" && p.score >= ONE_CLICK_THRESHOLD ? { ...p, status: "validée" as const } : p));
    const s1 = { ...s0, proposals: accepted };
    applySetup(s1, true);
    const ok = accepted.filter(p => p.status === "validée").length, pending = accepted.filter(p => p.status === "à valider").length;
    at(4, `${ok} correspondances acceptées${pending ? `, ${pending} à valider` : ""}`);
    // 5. Synchronisation sous budget.
    const r = await syncIntegration({ data: { setup: s1, mode: "full" } }).catch(e => ({ ok: false as const, error: (e as Error).message }));
    if (!r.ok) return fail(4, r.error);
    const v = JSON.parse(r.viewJson) as IntegrationView;
    setView(v);
    at(5, `${v.runs.length} lectures, ${v.alerts.length} alerte(s) d'intégration`);
    // 6. Alertes et résilience : instantané du cockpit, puis objets standard et indicateurs calculés.
    saveCockpitSnapshot({ asOf: v.asOf, alerts: v.alerts, series: v.series, publishedAt: new Date().toISOString() });
    setPublished(true);
    const bridged = bridgeToVocab(vocab, s1, parsed.profiles, accepted, Object.fromEntries(Object.entries(t).map(([k, x]) => [k, x.status !== "rouge"])));
    const std = await loadStandardSi(bridged, { base: MAISON_LUCIE_PORTAL, onStep: (_s, text) => at(5, text) }).catch(e => ({ ok: false as const, step: "lecture" as const, error: (e as Error).message }));
    if (!std.ok) return fail(5, `${std.step} : ${std.error}`);
    onUpdate(std.vocab);
    setStep(3);
    at(6, `${std.tables} tables standard, ${std.mappings} correspondances, ${std.calls} appels`);
    // 7. Cockpit.
    setOneClick({ step: 6, status: "done", detail: { ...detail } });
    void navigate({ to: "/cockpit/resilience", search: { section: "cockpit" } as never });
  }

  const coverage = useMemo(() => GROUPS.map(g => {
    const attrs = Q_ONTOLOGY.filter(a => a.binding?.startsWith(`${g}.`));
    const ok = attrs.filter(a => proposals.some(p => p.attributeId === a.binding && p.column && (p.status === "validée" || p.status === "corrigée")));
    const pending = proposals.filter(p => p.attributeId.startsWith(`${g}.`) && p.status === "à valider").length;
    return { g, label: OBJECT_OF_GROUP[g], pct: attrs.length ? Math.round((ok.length / attrs.length) * 100) : 0, ok: ok.length, total: attrs.length, pending, declared: !!setup?.objects.some(o => o.group === g) };
  }), [proposals, setup]);
  const sourceScores = useMemo(() => (setup?.sources ?? []).map(s => {
    const reps = (view?.reports ?? []).filter(r => r.system === s.id || r.system.startsWith(`${s.id}.`) || r.system.startsWith(`${s.id} `));
    return { s, pct: reps.length ? Math.round(reps.reduce((a, r) => a + r.pct, 0) / reps.length * 10) / 10 : null, orphans: reps.reduce((a, r) => a + r.orphans.length, 0) };
  }), [setup, view]);
  const label = (id: string) => setup?.sources.find(s => s.id === id)?.label ?? id;

  return (
    <div className="ij">
      <section className={`ij-modes${setup ? " compact" : ""}`} aria-label="Choisir un mode">
        <article className="ij-mode-card" data-testid="mode-step">
          <h3><Footprints size={16} /> Pas à pas <small className="ij-mode-tag">votre SI</small></h3>
          <p>Le mode normal pour connecter les applications d'un client : Cartographier, Connecter (ses propres identifiants), Vérifier, Régler les alertes. Vous validez chaque étape.</p>
          <button className="ij-link" onClick={() => { setOneClick(null); setStep(0); document.querySelector(".ij-progress")?.scrollIntoView({ behavior: "smooth" }); }}>Commencer pas à pas <ArrowRight size={14} /></button>
        </article>
        <article className="ij-mode-card demo" data-testid="mode-one-click">
          <h3><Zap size={16} /> Démo Maison Lucie en un clic <small className="ij-mode-tag demo">mode démo</small></h3>
          <p>Charge le SI de démonstration Maison Lucie (données synthétiques, identifiants de démo inclus) : questionnaire, connexion, mapping, synchronisation, alertes, puis le cockpit. Ce raccourci ne s'applique pas au SI d'un client : un vrai SI se connecte pas à pas.</p>
          <button className="ij-primary" disabled={!canSrc || oneClick?.status === "running"} onClick={() => void runOneClick()}>{oneClick?.status === "running" ? "En cours…" : "Charger la démo Maison Lucie"}</button>
        </article>
      </section>
      {oneClick && <section className="ij-oneclick" aria-label="Démo Maison Lucie en un clic" data-testid="one-click-progress">
        <div className="ij-oc-bar" role="progressbar" aria-valuemin={0} aria-valuemax={ONE_CLICK.length} aria-valuenow={oneClick.status === "done" ? ONE_CLICK.length : oneClick.step}><span style={{ width: `${Math.round(((oneClick.status === "done" ? ONE_CLICK.length : oneClick.step) / ONE_CLICK.length) * 100)}%` }} /></div>
        <ol>{ONE_CLICK.map(([k, l], i) => { const st = oneClick.status === "done" || i < oneClick.step ? "fait" : i === oneClick.step ? (oneClick.status === "error" ? "échec" : "en cours") : "à venir"; return <li key={k} data-state={st}><span className="ij-oc-dot">{st === "fait" ? <Check size={12} /> : st === "échec" ? <X size={12} /> : i + 1}</span>{l}{oneClick.detail[k] && <small> · {oneClick.detail[k]}</small>}</li>; })}</ol>
        {oneClick.error && <p className="ij-error" role="alert">Arrêt à l'étape « {oneClick.error} ». Corrigez puis relancez, ou poursuivez pas à pas.</p>}
      </section>}
      <ol className="ij-progress" aria-label="Progression du Studio">
        {STEPS.map((name, i) => (
          <li key={name}><button type="button" aria-current={step === i ? "step" : undefined} data-done={done[i] || undefined} onClick={() => setStep(i)}>
            <span className="ij-num">{done[i] ? <Check size={14} /> : i + 1}</span>{name}
          </button></li>
        ))}
      </ol>
      {busy && <p className="ij-busy" role="status"><RefreshCw size={14} className="spin" /> {busy}</p>}
      {error && <p className="ij-error" role="alert">{error}</p>}

      {step === 0 && <section className="ij-step" aria-label="Cartographier">
        <header><h2>Cartographier les sources</h2><p>Faites remplir le questionnaire avec le client : pour chaque objet métier, quelles applications appeler et comment y accéder.</p></header>
        <div className="ij-actions">
          {!canSrc && <p className="ij-ro" role="note">Lecture seule : votre rôle ({access.role}) consulte le Studio ; les sources et les correspondances sont réservées aux administrateurs.</p>}
          <button className="ij-primary" disabled={!canSrc} onClick={() => fileRef.current?.click()}><Upload size={15} /> Importer le questionnaire rempli</button>
          <input ref={fileRef} type="file" accept=".xlsx,.csv" hidden data-testid="ij-file" onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }} />
          <button className="ij-link" data-testid="ij-schema" disabled={!canSrc} onClick={() => schemaRef.current?.click()} title="Image, PDF, draw.io, BPMN, ArchiMate, Visio, SVG, PowerPoint ou archive .zip : Aura en déduit les applications et les flux, puis un questionnaire pré-rempli à valider."><Upload size={14} /> Partir d'un schéma du SI</button>
          <input ref={schemaRef} type="file" multiple accept={DOC_ACCEPT} hidden data-testid="ij-schema-file" onChange={e => { const f = Array.from(e.target.files ?? []); e.target.value = ""; void onSchema(f); }} />
          <button className="ij-link" onClick={downloadXlsx}><FileSpreadsheet size={14} /> Modèle Excel</button>
          <button className="ij-link" onClick={downloadDocx}><FileText size={14} /> Version Word pour atelier</button>
          <button className="ij-link" data-testid="ij-demo" disabled={!canSrc} onClick={() => importRows(maisonLucieExample(MAISON_LUCIE_PORTAL), () => "{{env:LUCIE_GATEWAY_TOKEN}}")} title="Remplit le questionnaire avec l'exemple Maison Lucie (SI de démonstration, 9 applications).">Exemple Maison Lucie (démo)</button>
          <button className="ij-link" data-testid="ij-demo-scale" disabled={!canSrc} onClick={() => importRows(maisonLucieScaleExample(MAISON_LUCIE_PORTAL), () => "{{env:LUCIE_GATEWAY_TOKEN}}")} title="Mêmes 9 applications en taille « scale » : des millions de lignes, lues sous budget (les extractions lourdes attendent les heures creuses).">Maison Lucie · volumétrie</button>
          <button className="ij-link" data-testid="ij-demo-channels" disabled={!canSrc} onClick={() => importRows(maisonLucieChannelsExample(MAISON_LUCIE_PORTAL), () => "{{env:LUCIE_GATEWAY_TOKEN}}")} title="Mêmes 9 applications, chacune par un autre canal qu'elle expose réellement : OData v4 (ERP), SFTP (PIM, APS), SOAP (WMS, SRM, QMS), AMQP (TMS), Salesforce (OMS), SQL (lac). Les données lues sont identiques.">Maison Lucie · autres canaux</button>
          <button className="ij-link" data-testid="ij-demo-mcp" disabled={!canSrc} onClick={() => importRows(maisonLucieMcpExample(MAISON_LUCIE_PORTAL), () => "{{env:LUCIE_GATEWAY_TOKEN}}")} title="Les 9 applications lues par le serveur MCP de Maison Lucie (connecteur MCP générique : outils et ressources découverts).">Maison Lucie · MCP</button>
        </div>
        <DocStatusList results={schemaDocs} />
        {landscape && <div className="ij-check" aria-label="Cartographie déduite du schéma" data-testid="ij-landscape">
          <p><b>{landscape.apps.length}</b> applications · <b>{landscape.flows.length}</b> flux · déduits {landscape.origin === "schéma" ? "du schéma" : landscape.origin === "texte" ? "du texte" : "par Aura (modèle de langage)"}. Ce qui est marqué « {A_CONFIRMER} » est déduit, pas lu.</p>
          {landscape.notes.map(n => <p key={n} className="ij-warn">{n}</p>)}
          <table className="ij-table"><thead><tr><th>Application</th><th>Type</th><th>Objets portés</th><th>État</th></tr></thead>
            <tbody>{landscape.apps.map(a => <tr key={a.name}><td>{a.name}</td><td>{a.kind ?? "—"}</td><td>{a.objects.join(", ") || "—"}</td><td>{a.confirm ? <span className="ij-warn">{A_CONFIRMER}</span> : "lu dans le schéma"}</td></tr>)}</tbody></table>
          {landscape.flows.length > 0 && <table className="ij-table"><thead><tr><th>Flux</th><th>Objets</th><th>État</th></tr></thead>
            <tbody>{landscape.flows.map((f, i) => <tr key={i}><td>{f.from} → {f.to}{f.label ? ` (${f.label})` : ""}</td><td>{f.objects.join(", ") || "—"}</td><td>{f.confirm ? <span className="ij-warn">{A_CONFIRMER}</span> : "lu dans le schéma"}</td></tr>)}</tbody></table>}
          {landscape.apps.length > 0 && <div className="ij-actions">
            <button className="ij-primary" disabled={!canSrc} onClick={() => importRows(landscapeToQuestionnaire(landscape))}>Utiliser comme questionnaire <ArrowRight size={14} /></button>
            <button className="ij-link" onClick={downloadPrefilled}><FileSpreadsheet size={14} /> Questionnaire pré-rempli (Excel)</button>
          </div>}
        </div>}
        {setup && <div className="ij-check" aria-label="Contrôle d'import">
          <p><b>{setup.summary.applications}</b> applications · <b>{setup.summary.renseignees}</b> lignes renseignées · <b>{setup.summary.attributsMultiSources}</b> attributs multi-sources · <b>{setup.objects.length}</b> objets avec un maître</p>
          {setup.issues.length === 0 ? <p className="ij-ok"><Check size={14} /> Import complet : sources, correspondances à proposer et maître par attribut créés.</p>
            : <ul>{setup.issues.map((i, k) => <li key={k} className={i.level === "erreur" ? "ij-err" : "ij-warn"}>{i.line ? `Ligne ${i.line} · ` : ""}{i.message}</li>)}</ul>}
          {!errors.length && <button className="ij-primary" onClick={() => setStep(1)}>Continuer <ArrowRight size={14} /></button>}
        </div>}
      </section>}

      {step === 1 && setup && <section className="ij-step" aria-label="Connecter">
        <header><h2>Connecter</h2><p>Indiquez, pour chaque source, la variable d'environnement du serveur qui contient son identifiant, puis testez. Aura lit ensuite les métadonnées et un petit échantillon.</p></header>
        <button className="ij-primary" onClick={testAll} disabled={!!busy || !canSrc}><PlugZap size={15} /> Tester les connexions</button>
        {ACCESS_MODES.map(mode => {
          const list = setup.sources.filter(s => (s.accessMode ?? "api") === mode.id);
          if (!list.length) return null;
          return <div key={mode.id} className="ij-mode"><h3>{mode.label} <Tip text={mode.hint} /></h3>
            {list.map(s => {
              const t = tests[s.id], b = { ...DEFAULT_BUDGET, ...(s.budget ?? {}) };
              return <article key={s.id} className="ij-source" data-status={t?.status ?? "gris"} data-inactive={!isActive(s) || undefined}>
                <div className="ij-source-head"><i className="ij-dot" aria-label={t ? `État ${t.status}` : "Non testée"} /><select className="ij-state" aria-label={`État de ${s.label}`} value={s.status ?? "active"} disabled={!canSrc} onChange={e => setSourceStatus(s.id, e.target.value as "active" | "inactive" | "obsolete")}><option value="active">Active</option><option value="inactive">Inactive</option><option value="obsolete">Obsolète</option></select>
                  <input className="ij-name" aria-label={`Nom de la source ${s.label}`} value={s.label} disabled={!canSrc} onChange={e => updateSource(s.id, x => ({ ...x, label: e.target.value }))} /><small>{KIND_LABELS[s.kind] ?? s.kind}</small>
                  <label className="ij-secret">Variable serveur <Tip text="Nom de la variable d'environnement (Vercel → Settings → Environment Variables) qui contient le jeton ou le mot de passe. Le navigateur ne voit jamais sa valeur." />
                    <input value={envName(s)} aria-label={`Variable serveur de ${s.label}`} onChange={e => { const n = e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""); updateSource(s.id, x => ({ ...x, params: { ...x.params, ...(x.params.dsn !== undefined ? { dsn: `{{env:${n}}}` } : { bearer: `{{env:${n}}}` }) } })); }} /></label>
                </div>
                {Object.values(profiles).filter(p => p.source === s.id).map(p => <button key={p.entity} className="ij-link" onClick={() => setSampleKey(`${p.source}|${p.entity}`)}>Échantillon et métadonnées · {p.entity}</button>)}
                {t && <p className="ij-test">{t.message} · {t.latencyMs} ms{t.calls !== undefined ? ` · ${t.calls} appel(s) aujourd'hui / plafond ${t.maxCalls}` : ""}</p>}
                <details className="ij-policy"><summary>Politique de sollicitation</summary>
                  <fieldset className="ij-policy-grid" disabled={!canSrc}>
                    {s.params.baseUrl !== undefined && <label className="ij-wide">Adresse<input value={String(s.params.baseUrl)} onChange={e => updateSource(s.id, x => ({ ...x, params: { ...x.params, baseUrl: e.target.value.trim() } }))} /></label>}
                    <label>Mode d'accès<select value={s.accessMode ?? "api"} onChange={e => updateSource(s.id, x => ({ ...x, accessMode: e.target.value as SourceConfig["accessMode"] }))}>{ACCESS_MODES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
                    <label>Fraîcheur<select value={s.schedule?.everyMinutes ?? 180} onChange={e => updateSource(s.id, x => ({ ...x, schedule: { everyMinutes: Number(e.target.value) } }))}><option value={60}>1 h</option><option value={180}>3 h (journée)</option><option value={1440}>1 j (nuit)</option></select></label>
                    <label>Requêtes / min<input type="number" min={1} value={b.maxRequestsPerMinute} onChange={e => updateSource(s.id, x => ({ ...x, budget: { ...x.budget, maxRequestsPerMinute: Number(e.target.value) } }))} /></label>
                    <label>Lignes / appel<input type="number" min={100} step={100} value={b.maxRowsPerCall} onChange={e => updateSource(s.id, x => ({ ...x, budget: { ...x.budget, maxRowsPerCall: Number(e.target.value) } }))} /></label>
                    <label>Heures creuses<span className="ij-hours"><input type="number" min={0} max={23} value={b.offPeak.startHour} onChange={e => updateSource(s.id, x => ({ ...x, budget: { ...x.budget, offPeak: { ...b.offPeak, startHour: Number(e.target.value) } } }))} />–<input type="number" min={0} max={24} value={b.offPeak.endHour} onChange={e => updateSource(s.id, x => ({ ...x, budget: { ...x.budget, offPeak: { ...b.offPeak, endHour: Number(e.target.value) } } }))} /> h</span></label>
                    <label className="ij-relax"><input type="checkbox" checked={!!s.budget?.explicitRelax} onChange={e => updateSource(s.id, x => ({ ...x, budget: { ...x.budget, explicitRelax: e.target.checked } }))} /> Assouplir au-delà des plafonds Aura <Tip text="Sans cette case, Aura applique toujours le plus prudent entre votre réglage et ses plafonds : 1 requête à la fois, 30 requêtes/min, 5 000 lignes/appel, extractions lourdes de 22 h à 6 h." /></label>
                  </fieldset>
                </details>
              </article>;
            })}
          </div>;
        })}
        {allTested && proposals.length > 0 && <button className="ij-link" onClick={() => setStep(2)}>Vérifier les correspondances <ArrowRight size={14} /></button>}
      </section>}

      {step === 2 && setup && <section className="ij-step" aria-label="Vérifier">
        <header><h2>Vérifier</h2><p>Couverture, mapping des champs avec leur score, ontologie vivante et écarts entre sources.</p></header>
        <button className="ij-primary" onClick={syncNow} disabled={!!busy || !proposals.length || !canTh}><RefreshCw size={15} /> Mettre à jour maintenant</button>
        <div className="ij-tabs" role="tablist" aria-label="Vues de vérification">
          {([["couverture", "Couverture"], ["mapping", "Mapping"], ["ontologie", "Ontologie vivante"], ["ecarts", "Écarts entre sources"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={vtab === k} onClick={() => setVtab(k)}>{l}{k === "mapping" && proposals.some(p => p.status === "à valider") ? ` (${proposals.filter(p => p.status === "à valider").length})` : k === "ecarts" && view ? ` (${view.divergenceCount})` : ""}</button>)}
        </div>

        {vtab === "couverture" && <div className="ij-panel" role="tabpanel" aria-label="Couverture">
          <h3>Par objet</h3>
          <div className="ij-coverage" aria-label="Couverture par objet">
            {coverage.filter(c => c.declared).map(c => <div key={c.g} className="ij-cov"><span>{c.label}</span><div className="ij-bar"><i style={{ width: `${c.pct}%` }} /></div><b>{c.pct} %</b>{c.pending > 0 && <small>{c.pending} à valider</small>}</div>)}
          </div>
          <h3>Par source</h3>
          {view ? <div className="ij-coverage" aria-label="Score par source">
            {sourceScores.map(({ s, pct, orphans }) => <div key={s.id} className="ij-cov" title={`${orphans} clé(s) non rapprochée(s)`}><span>{s.label}</span><div className="ij-bar"><i style={{ width: `${pct ?? 0}%` }} /></div><b>{pct ?? "—"}{pct !== null ? " %" : ""}</b></div>)}
            <span className="ij-chip">Écarts entre sources <b>{view.divergenceCount}</b></span>
          </div> : <p className="ij-hint">Scores de rapprochement par source après « Mettre à jour maintenant ».</p>}
          {view && <div className="ij-stored" aria-label="Stocké dans Aura"><b>Stocké dans Aura</b> : {view.counts.suppliers} fournisseurs, {view.counts.products} articles, {view.counts.sites} sites (référentiels légers) · {view.counts.stockouts} positions en alerte · {view.alerts.length} alerte(s) avec preuve · {Object.values(view.series).reduce((a, x) => a + x.length, 0)} points d'indicateurs · aucune ligne brute ni client individuel. <small>Persistance : {view.persistence}.</small></div>}
          {view && view.runs.some(r => r.error) && <div className="ij-runs" aria-label="Journal des relevés"><b>Journal des relevés</b><ul>{view.runs.filter(r => r.error).slice(0, 8).map((r, k) => <li key={k}>{label(r.sourceId)} · {r.step} : {r.deferred ? "reporté aux heures creuses (budget)" : r.error}{r.rowsRead ? ` · ${r.rowsRead.toLocaleString("fr-FR")} lignes lues` : ""}</li>)}</ul></div>}
          {view && <p className="ij-usage">{Object.entries(view.usage).map(([id, u]) => `${label(id)} : ${u.calls}/${u.maxCalls} appels, ${u.rows.toLocaleString("fr-FR")} lignes`).join(" · ")}</p>}
        </div>}

        {vtab === "mapping" && <div className="ij-panel" role="tabpanel" aria-label="Mapping">
          {GROUPS.filter(g => proposals.some(p => p.attributeId.startsWith(`${g}.`))).map(g => {
            const list = proposals.filter(p => p.attributeId.startsWith(`${g}.`));
            const key = `${list[0].sourceId}|${list[0].entity}`, prof = profiles[key];
            return <div key={g} className="ij-props">
              <div className="ij-props-head"><b>{OBJECT_OF_GROUP[g]}</b> · {label(list[0].sourceId)} · {list[0].entity} <small>{prof?.metadata}</small> <button className="ij-link" onClick={() => setSampleKey(key)}>Échantillon et métadonnées</button><Link className="ij-link" to="/cockpit/studio" search={{ tab: "mapping", view: "lignage", objet: ENTITY_OF_GROUP[g] }}>Lignage</Link><span className="ij-count">{list.filter(p => p.status === "validée" || p.status === "corrigée").length}/{list.length}</span></div>
              <table><thead><tr><th>Attribut Aura</th><th>Champ source</th><th>Confiance</th><th>Échantillon</th><th /></tr></thead><tbody>
                {list.map(p => { const col = prof?.columns.find(c => c.name === p.column); const pc = Math.round(p.score * 100); return <tr key={p.attributeId} data-status={p.status}>
                  <td>{p.label}</td>
                  <td><select disabled={!canMap} aria-label={`Champ source de ${OBJECT_OF_GROUP[g]} · ${p.label}`} value={p.column ?? ""} onChange={e => setProposal(p, { column: e.target.value || null, status: e.target.value ? "corrigée" : "refusée" })}>
                    <option value="">—</option>{(prof?.columns ?? []).map(c => <option key={c.name} value={c.name}>{c.name}</option>)}</select></td>
                  <td><span className="ij-score" title={p.parts ? `nom ${p.parts.nom} · type ${p.parts.type} · profil ${p.parts.profil}${p.parts.indice !== null ? ` · indice ${p.parts.indice}` : ""}` : ""}><i data-level={pc >= 80 ? "haut" : pc >= 60 ? "moyen" : "bas"} style={{ width: `${p.column ? pc : 0}%` }} /></span> <small>{p.column ? `${pc} %` : "—"} · {p.status}</small></td>
                  <td className="ij-samples">{(col?.samples ?? []).slice(0, 3).map((v, i) => <code key={i}>{v}</code>)}</td>
                  <td className="ij-row-actions">{canMap && <>{p.status !== "validée" && p.column && <button aria-label={`Valider ${p.label}`} title="Valider" onClick={() => setProposal(p, { status: "validée" })}><Check size={13} /></button>}<button aria-label={`Corriger ${p.label}`} title="Corriger : choisir un autre champ" onClick={e => (e.currentTarget.closest("tr")?.querySelector("select") as HTMLSelectElement | null)?.focus()}>✎</button>{p.status !== "refusée" && <button aria-label={`Refuser ${p.label}`} title="Refuser" onClick={() => setProposal(p, { status: "refusée", column: null })}><X size={13} /></button>}</>}</td>
                </tr>; })}
              </tbody></table>
            </div>;
          })}
          <p className="ij-hint">Validées d'office au-dessus de {Math.round(AUTO_THRESHOLD * 100)} % ; en dessous, rien n'est appliqué sans votre validation. <Link to="/cockpit/studio" search={{ tab: "mapping", view: "lignage" }}>Vue lignage</Link></p>
        </div>}

        {vtab === "ontologie" && <div className="ij-panel" role="tabpanel" aria-label="Ontologie vivante">
          {/* Graphe dépliable par objet : chaque attribut montre source, valeur, fraîcheur ou « à mapper », sur les données réelles. */}
          <OntologyGraph vocab={vocab} onUpdate={onUpdate} />
          <details><summary>Préparation du vocabulaire (indicateurs)</summary><LivingOntologySection vocab={vocab} onUpdate={onUpdate} /></details>
        </div>}

        {vtab === "ecarts" && <div className="ij-panel" role="tabpanel" aria-label="Écarts entre sources">
          <h3>Maître par attribut et tolérance</h3>
          <table className="ij-table" aria-label="Maîtres et tolérances"><thead><tr><th>Objet · attribut</th><th>Application maître</th><th>Autres sources</th><th>Tolérance</th></tr></thead><tbody>
            {setup.acv.attributes.map((at, i) => <tr key={`${at.domain}.${at.attribute}`}><td>{at.domain === "supplier" ? "Fournisseur" : at.domain === "product" ? "Article" : "Site"} · {at.attribute}</td>
              <td><select disabled={!canMap} aria-label={`Maître de ${at.attribute}`} value={at.master ?? ""} onChange={e => setAcv(i, { master: e.target.value || undefined, consumers: setup.sources.map(x => x.id).filter(id => id !== e.target.value && (at.consumers.includes(id) || id === at.master)) })}><option value="">hérité du domaine</option>{setup.sources.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></td>
              <td>{at.consumers.map(label).join(", ") || "—"}{(() => { const f = eff?.fallbacks.find(x => x.attribute === `${at.domain}.${at.attribute}`); return f ? <span className="ij-fallback"> · maître désactivé : {f.to ? `repli sur ${label(f.to)}` : "non couvert"}</span> : null; })()}</td>
              <td><select disabled={!canMap} aria-label={`Tolérance de ${at.attribute}`} value={at.tolerance?.kind ?? "exact"} onChange={e => setAcv(i, { tolerance: e.target.value === "pct" ? { kind: "pct", value: 5 } : e.target.value === "days" ? { kind: "days", value: 2 } : { kind: e.target.value as "exact" | "forme" } })}>{Object.entries(ACV_TOLERANCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
                {(at.tolerance?.kind === "pct" || at.tolerance?.kind === "days") && <input className="ij-num-in" type="number" min={0} disabled={!canMap} aria-label={`Valeur de tolérance de ${at.attribute}`} value={at.tolerance.value} onChange={e => setAcv(i, { tolerance: { ...(at.tolerance as { kind: "pct" | "days"; value: number }), value: Number(e.target.value) } })} />}</td></tr>)}
          </tbody></table>
          <h3>Écarts constatés</h3>
          {!view ? <p className="ij-hint">Les écarts apparaissent après « Mettre à jour maintenant ».</p> : view.divergences.length === 0 ? <p className="ij-ok"><Check size={14} /> Aucun écart au-delà des tolérances.</p> :
            <table className="ij-table"><thead><tr><th>Attribut</th><th>Objet</th><th>Maître</th><th>Autres sources</th><th>Nature</th><th>Choix humain</th></tr></thead><tbody>
              {view.divergences.map((d, k) => <tr key={k}><td>{d.attribute}</td><td>{d.idOr}</td><td>{label(d.master.system)} : <b>{d.master.value}</b></td><td>{d.others.map(o => `${label(o.system)} : ${o.value}`).join(" · ")}</td><td>{d.kind === "fond" ? "écart de fond" : "écart de forme"} · <b>écart à vérifier</b></td><td><DivergenceChoice id={`${d.attribute}|${d.idOr}`} /></td></tr>)}
            </tbody></table>}
        </div>}
        {view && <button className="ij-link" onClick={() => setStep(3)}>Régler les alertes <ArrowRight size={14} /></button>}
      </section>}

      {step === 3 && setup && <section className="ij-step" aria-label="Régler les alertes">
        <header><h2>Régler les alertes</h2><p>Seuils des alertes calculées sur les sources, puis règles causales du cockpit.</p></header>
        <button className="ij-primary" onClick={publish} disabled={!view || !canTh}>Publier au cockpit</button>
        {published && <p className="ij-ok"><Check size={14} /> {liveAlerts.length} alerte(s) publiée(s). <Link to="/cockpit/resilience" search={{ section: "cockpit" }}>Voir le cockpit <ArrowRight size={12} /></Link></p>}
        <fieldset className="ij-settings" disabled={!canTh}>
          {(() => { const a = setup.alertSettings ?? DEFAULT_ALERT_SETTINGS; const set = (patch: Partial<typeof a>) => { auditOnce("seuils", "seuils.modification", Object.keys(patch).join(", ")); applySetup({ ...setup, alertSettings: { ...a, ...patch } }, true); }; return <>
            <label>Retard fournisseur au-delà de<input type="number" min={1} max={100} value={a.lateRatePct} onChange={e => set({ lateRatePct: Number(e.target.value) })} /> %</label>
            <label>Minimum d'expéditions échues<input type="number" min={1} value={a.minShipments} onChange={e => set({ minShipments: Number(e.target.value) })} /></label>
            <label>Statuts « en attente de stock »<input value={a.backorderStatuses.join(", ")} onChange={e => set({ backorderStatuses: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} /></label>
            {(["rupture", "retard", "risque-fournisseur", "ecart-sources"] as const).map(k => <label key={k} className="ij-wide">Options proposées · {k === "rupture" ? "ruptures" : k === "retard" ? "retards fournisseur" : k === "risque-fournisseur" ? "risque fournisseur" : "écarts entre sources"}<input value={(a.options?.[k] ?? DEFAULT_OPTIONS[k]).join(", ")} onChange={e => set({ options: { ...(a.options ?? {}), [k]: e.target.value.split(",").map(x => x.trim()).filter(Boolean) } })} /></label>)}
            <label>Fenêtre de ventes<input type="number" min={7} value={a.velocityDays} onChange={e => set({ velocityDays: Number(e.target.value) })} /> jours</label>
          </>; })()}
        </fieldset>
        {view && <ul className="ij-alerts">{liveAlerts.map(a => <li key={a.id} data-sev={a.severity}><b>{a.label}</b><small>{Object.entries(a.evidence.values).slice(0, 4).map(([k, v]) => `${k.replace(/_/g, " ")} : ${v}`).join(" · ")}</small></li>)}</ul>}
        <p className="ij-hint">Indicateurs et seuils du cockpit : <Link to="/cockpit/studio" search={{ tab: "vocab" }}>modifier</Link>.</p>
        <details className="ij-rules"><summary>Règles causales du cockpit</summary><CausalRulesSection vocab={vocab} onUpdate={onUpdate} /></details>
      </section>}

      {sampleKey && profiles[sampleKey] && <div className="ij-modal" role="dialog" aria-label="Échantillon et métadonnées" onClick={() => setSampleKey(null)}><div onClick={e => e.stopPropagation()}>
        <header><b>{label(profiles[sampleKey].source)} · {profiles[sampleKey].entity}</b><small>Métadonnées : {profiles[sampleKey].metadata}</small><button aria-label="Fermer" onClick={() => setSampleKey(null)}><X size={15} /></button></header>
        <table className="ij-table"><thead><tr><th>Champ</th><th>Type</th><th>Remplissage</th><th>Valeurs distinctes</th><th>Échantillon</th></tr></thead><tbody>
          {profiles[sampleKey].columns.map(c => <tr key={c.name}><td><code>{c.name}</code></td><td>{c.declaredType ?? c.type}</td><td>{Math.round((1 - c.nullRate) * 100)} %</td><td>{Math.round(c.distinctRatio * 100)} %{c.unique ? " · unique" : ""}</td><td className="ij-samples">{c.samples.slice(0, 3).map((v, i) => <code key={i}>{v}</code>)}</td></tr>)}
        </tbody></table>
      </div></div>}
      <details className="ij-advanced"><summary>Avancé</summary>
        <p>Vues détaillées : <Link to="/cockpit/studio" search={{ tab: "sources" }}>connexions manuelles</Link> · <Link to="/cockpit/studio" search={{ tab: "data" }}>métadonnées & échantillons</Link> · <Link to="/cockpit/studio" search={{ tab: "vocab" }}>indicateurs & seuils</Link> · <Link to="/cockpit/studio" search={{ tab: "cockpit" }}>faits publiés</Link></p>
      </details>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
.ij-modes{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:12px;margin:0 0 14px}
.ij-mode-card{border:1.5px solid #d9d6f5;border-radius:12px;padding:14px;background:#fff;display:flex;flex-direction:column;gap:8px}
.ij-mode-card h3{margin:0;font-size:15px;display:flex;gap:6px;align-items:center;color:#1a1433}
.ij-mode-card p{margin:0;font-size:13px;color:#3b3f68;line-height:1.45}
.ij-mode-card button{align-self:flex-start}
.ij-modes.compact .ij-mode-card p{display:none}
.ij-mode-card.demo{border-style:dashed;background:#fbfbff}
.ij-mode-tag{font-size:12px;font-weight:600;padding:1px 7px;border-radius:999px;background:#e8f7ef;color:#0d7a54}
.ij-mode-tag.demo{background:#fff4e0;color:#8a5a00}
.ij-oneclick{border:1px solid #d9d6f5;border-radius:12px;padding:12px 14px;margin:0 0 14px;background:#fbfbff}
.ij-oc-bar{height:6px;border-radius:999px;background:#ecebf8;overflow:hidden;margin-bottom:10px}
.ij-oc-bar span{display:block;height:100%;background:#4743E6;transition:width .3s}
.ij-oneclick ol{list-style:none;margin:0;padding:0;display:grid;gap:5px}
.ij-oneclick li{display:flex;gap:8px;align-items:center;font-size:13px;color:#3b3f68}
.ij-oneclick li small{color:#6b6f8a}
.ij-oc-dot{width:20px;height:20px;border-radius:50%;display:inline-grid;place-items:center;font-size:11px;background:#ecebf8;color:#4c3d7a;flex:none}
.ij-oneclick li[data-state="fait"] .ij-oc-dot{background:#0d7a54;color:#fff}
.ij-oneclick li[data-state="en cours"] .ij-oc-dot{background:#4743E6;color:#fff}
.ij-oneclick li[data-state="échec"] .ij-oc-dot{background:#c0392b;color:#fff}
.ij{display:flex;flex-direction:column;gap:14px;font-size:14px;color:var(--aura-ink,#15121f)}
.ij-progress{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;list-style:none;margin:0;padding:0}
.ij-progress button{width:100%;display:flex;align-items:center;gap:8px;padding:10px 12px;border:1px solid #e3e1ee;border-radius:10px;background:#fff;font-weight:600;color:#3b3f5c;cursor:pointer;text-align:left}
.ij-progress button[aria-current=step]{border-color:#6d4bdf;box-shadow:0 0 0 2px #ece6ff;color:#2a1d73}
.ij-num{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:#f0edf9;color:#4b3fa8;font-size:12px;flex:none}
.ij-progress button[data-done] .ij-num{background:#1f9d63;color:#fff}
.ij-step{display:flex;flex-direction:column;gap:12px;align-items:flex-start;padding:18px;border:1px solid #e9e7f2;border-radius:14px;background:#fff}
.ij-step header h2{font-size:20px;margin:0 0 4px}.ij-step header p{margin:0;color:#5b5f7a;max-width:760px}
.ij-primary{display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:10px;border:0;background:#5b3fd6;color:#fff;font-weight:700;cursor:pointer}
.ij-primary:disabled{opacity:.5;cursor:default}
.ij-link{display:inline-flex;align-items:center;gap:6px;border:0;background:none;color:#4b3fa8;font-weight:600;cursor:pointer;padding:6px 4px}
.ij-actions{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.ij-check{width:100%;display:flex;flex-direction:column;gap:6px;padding:12px;border-radius:10px;background:#f8f7fc}
.ij-check p{margin:0}.ij-check ul{margin:0;padding-left:18px}
.ij-err{color:#b42318}.ij-warn{color:#9a6700}.ij-ok{color:#177245;display:flex;gap:6px;align-items:center;margin:0}
.ij-busy{display:flex;gap:6px;align-items:center;color:#4b3fa8;margin:0}.ij-error{color:#b42318;margin:0}
.spin{animation:ijspin 1s linear infinite}@keyframes ijspin{to{transform:rotate(360deg)}}
.ij-mode{width:100%}.ij-mode h3{font-size:13px;text-transform:uppercase;letter-spacing:.04em;color:#6b6f8a;margin:8px 0 6px;display:flex;gap:6px;align-items:center}
.ij-source{border:1px solid #ebe9f3;border-radius:10px;padding:10px 12px;margin-bottom:8px;background:#fff}
.ij-source-head{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}.ij-source-head small{color:#6b6f8a}
.ij-dot{width:10px;height:10px;border-radius:50%;background:#c9c7d6;flex:none}
.ij-source[data-status=vert] .ij-dot{background:#1f9d63}.ij-source[data-status=orange] .ij-dot{background:#e59f0f}.ij-source[data-status=rouge] .ij-dot{background:#d92d20}
.ij-secret{margin-left:auto;display:flex;align-items:center;gap:6px;font-size:12px;color:#5b5f7a}.ij-secret input{width:210px;padding:5px 8px;border:1px solid #dcd9ea;border-radius:7px;font-family:ui-monospace,monospace;font-size:12px}
.ij-test{margin:6px 0 0;font-size:12px;color:#5b5f7a}
.ij-policy summary{cursor:pointer;font-size:12px;color:#4b3fa8;margin-top:6px}
.ij-policy-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:8px;margin-top:8px}
.ij-policy-grid label{display:flex;flex-direction:column;gap:3px;font-size:12px;color:#5b5f7a}.ij-policy-grid input,.ij-policy-grid select{padding:5px 7px;border:1px solid #dcd9ea;border-radius:7px}
.ij-hours{display:flex;align-items:center;gap:4px}.ij-hours input{width:56px}.ij-relax{flex-direction:row!important;align-items:center}
.ij-tip{display:inline-flex;color:#8a8ea8;cursor:help}
.ij-coverage{width:100%;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:8px}
.ij-cov{display:grid;grid-template-columns:110px 1fr 48px;align-items:center;gap:8px;padding:8px 10px;border:1px solid #eeecf5;border-radius:9px}
.ij-cov small{grid-column:1/-1;color:#9a6700}
.ij-bar{height:8px;border-radius:5px;background:#efedf7;overflow:hidden}.ij-bar i{display:block;height:100%;background:#6d4bdf}
.ij-scores{display:flex;flex-wrap:wrap;gap:6px}.ij-chip{padding:5px 10px;border-radius:999px;background:#f3f1fb;font-size:12px}
.ij-divs{margin:0;padding-left:18px;font-size:12px;color:#9a3412}
.ij-props{width:100%;border:1px solid #eeecf5;border-radius:10px;padding:8px 10px}
.ij-props summary{cursor:pointer;display:flex;gap:8px;align-items:center}.ij-props summary small{color:#6b6f8a}.ij-count{margin-left:auto;font-weight:700;color:#4b3fa8}
.ij-props table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}.ij-props th{text-align:left;font-size:11px;color:#6b6f8a;font-weight:600;padding:4px}
.ij-props td{padding:4px;border-top:1px solid #f2f1f7}.ij-props select{max-width:220px;padding:4px 6px;border:1px solid #dcd9ea;border-radius:6px}
.ij-props tr[data-status="à valider"] td:first-child{box-shadow:inset 3px 0 0 #e59f0f}.ij-props tr[data-status="refusée"]{opacity:.55}
.ij-row-actions button{border:1px solid #dcd9ea;background:#fff;border-radius:6px;padding:3px 6px;margin-right:4px;cursor:pointer}
.ij-hint,.ij-usage,.ij-visuals{font-size:12px;color:#6b6f8a;margin:4px 0 0}
.ij-stored{font-size:13px;padding:10px 12px;border-radius:10px;background:#f6fbf8;width:100%}
.ij-settings{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px;width:100%}
.ij-settings label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:#5b5f7a}.ij-settings input{padding:6px 8px;border:1px solid #dcd9ea;border-radius:7px}
.ij-alerts{list-style:none;margin:0;padding:0;width:100%;display:flex;flex-direction:column;gap:6px}
.ij-alerts li{display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:9px;border-left:4px solid #e59f0f;background:#fffaf0}.ij-alerts li[data-sev=critique]{border-left-color:#d92d20;background:#fff5f4}
.ij-alerts small{color:#5b5f7a}
.ij-rules,.ij-advanced{width:100%}.ij-rules summary,.ij-advanced summary{cursor:pointer;color:#4b3fa8;font-weight:600}
.ij-advanced p{font-size:13px;color:#5b5f7a}
.ij-onto{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:8px}.ij-onto details{border:1px solid #eeecf5;border-radius:9px;padding:8px}.ij-onto-row{display:grid;grid-template-columns:1fr;gap:2px;padding:4px 0;border-top:1px solid #f2f1f7;font-size:13px}.ij-onto-row small{color:#6b6f8a}.ij-dot[data-on]{background:#1f9d63}
.ij-graph svg{width:100%;height:auto;border:1px solid #eeecf5;border-radius:12px;background:#fbfaff}.ij-leg{display:inline-block;width:9px;height:9px;border-radius:50%;margin:0 3px 0 8px}
.ij-ro{background:#fff7e6;border:1px solid #f3d08a;border-radius:8px;padding:8px 10px;font-size:13px;color:#7a4a00;margin:0}.ij-name{font-weight:700;border:1px solid transparent;border-radius:6px;padding:2px 6px;font-size:14px;min-width:180px}.ij-name:hover,.ij-name:focus{border-color:#dcd9ea}.ij-wide{grid-column:1/-1}.ij-num-in{width:64px;margin-left:6px;padding:4px 6px;border:1px solid #dcd9ea;border-radius:6px}fieldset.ij-policy-grid,fieldset.ij-settings{border:0;padding:0;margin:8px 0 0;min-width:0}
.ij-state{padding:3px 6px;border:1px solid #dcd9ea;border-radius:6px;font-size:12px}.ij-source[data-inactive] {opacity:.6}.ij-fallback{color:#9a5b00;font-size:12px}
.ij-runs{font-size:12.5px;background:#fbf8ff;border:1px solid #ece6ff;border-radius:8px;padding:8px 10px}.ij-runs ul{margin:4px 0 0;padding-left:18px}
.ij-tabs{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid #e3e1ee;width:100%}.ij-tabs button{border:0;background:none;padding:8px 12px;font-weight:600;color:#5b5f7a;cursor:pointer;border-bottom:3px solid transparent}.ij-tabs button[aria-selected=true]{color:#2a1d73;border-bottom-color:#6d4bdf}
.ij-panel{width:100%;display:flex;flex-direction:column;gap:10px}.ij-panel h3{font-size:13px;margin:4px 0 0;color:#6b6f8a}
.ij-props-head{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.ij-props-head small{color:#6b6f8a}
.ij-score{display:inline-block;width:70px;height:7px;border-radius:4px;background:#efedf7;overflow:hidden;vertical-align:middle}.ij-score i{display:block;height:100%}.ij-score i[data-level=haut]{background:#1f9d63}.ij-score i[data-level=moyen]{background:#e59f0f}.ij-score i[data-level=bas]{background:#d92d20}
.ij-samples code{display:inline-block;margin:1px 3px 1px 0;padding:1px 5px;border-radius:4px;background:#f3f1fb;font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ij-table{width:100%;border-collapse:collapse;font-size:13px}.ij-table th{text-align:left;font-size:11px;color:#6b6f8a;padding:4px}.ij-table td{padding:4px;border-top:1px solid #f2f1f7;vertical-align:top}
.ij-modal{position:fixed;inset:0;background:rgba(20,18,40,.35);display:grid;place-items:center;z-index:60}.ij-modal>div{background:#fff;border-radius:12px;padding:14px;max-width:900px;width:92vw;max-height:80vh;overflow:auto}
.ij-modal header{display:flex;gap:10px;align-items:center;margin-bottom:8px}.ij-modal header small{color:#6b6f8a}.ij-modal header button{margin-left:auto;border:0;background:none;cursor:pointer}
@media (max-width:720px){.ij-progress{grid-template-columns:repeat(2,1fr)}.ij-secret{margin-left:0}.ij-secret input{width:100%}.ij-cov{grid-template-columns:90px 1fr 44px}}
`;

/** Aura ne réécrit jamais une valeur source : l'écart est signalé, l'humain tranche (choix tracé localement). */
const DIV_KEY = "aura-integration-divergence-choices";
function DivergenceChoice({ id }: { id: string }) {
  const read = () => { try { return (JSON.parse(localStorage.getItem(DIV_KEY) ?? "{}") as Record<string, string>)[id] ?? ""; } catch { return ""; } };
  const [v, setV] = useState<string>(read);
  const set = (x: string) => { setV(x); try { const all = JSON.parse(localStorage.getItem(DIV_KEY) ?? "{}") as Record<string, string>; all[id] = x; localStorage.setItem(DIV_KEY, JSON.stringify(all)); } catch { /* stockage indisponible */ } };
  return <select aria-label="Décision sur l'écart" data-testid="divergence-choice" value={v} onChange={e => set(e.target.value)}>
    <option value="">À trancher</option>
    <option value="maitre">Le maître fait foi</option>
    <option value="autre">L'autre source est juste : corriger à la source</option>
    <option value="proprietaire">Remonter au propriétaire de la donnée</option>
  </select>;
}
