import { CopyButtons } from "./CopyButtons";
import { useDismiss } from "@/lib/ui/use-dismiss";
import { guardAgainstEngine } from "../../lib/v4/active-report";
import { routeQuestion } from "../../lib/integration/copilot-router";
import { loadCockpitSnapshot } from "../../lib/integration/cockpit";
import { currentLang } from "../../lib/i18n-dom";
import { Q } from "./KeywordText";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, FileText, MessageSquare, Send, Settings2, Sparkles } from "lucide-react";
import { askCopilot, suggestOntologyConfig } from "../../lib/v4/atelier-llm";
import type { OntologyConfigBridge, OntologySuggestion } from "./ControlTowerShell";
import { Markdown } from "./Markdown";
import { markGuideStep } from "../../lib/v4/supply-demo";
import { loadVocab } from "../../lib/v4/argus-vocab-store";
import { chartBlock, checkThresholds, planCopilotAnswer, stripChartBlocks, thresholdRequest, verifyGrounding, withThresholds, type CopilotPlan } from "../../lib/v4/copilot-answer";
import { InlineValueForm } from "./InlineValueForm";
import { persistSupplyVocab } from "./SupplyDemo";
import { useSupplyMemory } from "./SupplyMemoryUI";
import { EmailButton } from "./EmailDialog";
import { getActiveReport } from "../../lib/v4/active-report";

// CopilotPanel — volet LLM fixe à droite du shell Supply Chain Resilience
// Agent (Cockpit + Décision + Ontologie). Distinct du bouton flottant
// "Demander à Aura" retiré du rail de navigation : celui-ci ne flotte pas et
// reste visible par défaut. Un tour de dialogue simple (pas de streaming)
// est jugé suffisant pour ce lot.
//
// Deux modes, dans le MÊME panneau (pas un second panneau flottant) :
// - "Mode question" (comportement d'origine) : askCopilot, répond à une
//   question sur l'alerte/décision/objet affiché.
// - "Mode configuration" (nouveau) : n'apparaît que si `ontologyConfig` est
//   fourni par le shell (concrètement : uniquement sur la page Ontologie,
//   quand Fournisseur est l'objet affiché) — bouton "Suggérer des attributs
//   et sources" → suggestOntologyConfig, puis liste de suggestions
//   accepter/rejeter. Accepter une suggestion l'applique réellement via
//   `ontologyConfig.onAccept` (même mécanisme OntologyEdits/sessionStorage
//   que l'édition manuelle) — ce n'est pas un simple affichage inerte.
export type CopilotPastSession = { id: string; title: string; step: "comprendre" | "impacter" | "composer" | "decider" | "suivi"; updatedAt: string };
export type CopilotContext = {
  mode: "cockpit" | "decision";
  alertLabel?: string;
  alertSignal?: string;
  objectif?: string;
  contextRaw?: string;
  vocabSummary?: string;
  pastSessionsSummary?: string;
  pastSessions?: CopilotPastSession[];
  // Séries vérifiées par indicateur (une valeur par enregistrement source).
  series?: CopilotSeries[];
  // Indicateur concerné par l'alerte survolée, s'il y en a une.
  focusKpiLabel?: string;
  // Alerte en contexte (règle) : ouvre les cartes de choix ; effaçable.
  alertId?: string;
  onClearAlert?: () => void;
  onOpenDecision?: () => void;
};
export type CopilotSeries = { label: string; unit: string; alert: number; critical: number; source: string; points: { name: string; value: number; status: "ok" | "alerte" | "critique" }[] };

type Turn = { question: string; reply: string; error?: boolean; evidence: string[]; thresholdKpiId?: string; done?: string };
type SuggestionState = OntologySuggestion & { status: "pending" | "accepted" | "rejected" };

const DEFAULT_WIDTH = 420;
const MIN_WIDTH = 220;
const MAX_WIDTH = 680;

const STEP_LABEL: Record<CopilotPastSession["step"], string> = {
  comprendre: "Comprendre", impacter: "Impacter", composer: "Scénarios", decider: "Arbitrer", suivi: "Suivre",
};

export function CopilotPanel({ context, ontologyConfig, onResumeSession, collapsed }: {
  collapsed?: boolean; context: CopilotContext; ontologyConfig?: OntologyConfigBridge; onResumeSession?: (id: string) => void }) {
  const [open, setOpen] = useState(!collapsed);
  useDismiss(open, () => setOpen(false));
  // Replié par défaut quand l'espace doit revenir au contenu (ex. Décision).
  useEffect(() => { if (collapsed !== undefined) setOpen(!collapsed); }, [collapsed]);
  // Mobile et tablette (< 1280 px) : le copilote est un tiroir, fermé par défaut.
  useEffect(() => { if (typeof window !== "undefined" && window.matchMedia?.("(max-width: 1279px)").matches) setOpen(false); }, [collapsed]);
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const { decisions } = useSupplyMemory();
  const [panelMode, setPanelMode] = useState<"question" | "config">("question");
  const [suggestions, setSuggestions] = useState<SuggestionState[]>([]);
  const [suggestPending, setSuggestPending] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // Largeur du panneau — redimensionnable en glissant son bord gauche.
  // Pas de bibliothèque de resize existante ailleurs dans le code (grep sur
  // mousemove/col-resize) : simples écouteurs souris, nettoyés à la fin du
  // drag.
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [resizing, setResizing] = useState(false);
  const dragStart = useRef<{ x: number; width: number } | null>(null);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { x: e.clientX, width };
    setResizing(true);

    function onMouseMove(ev: MouseEvent) {
      if (!dragStart.current) return;
      // Le bord glissé est le bord GAUCHE du panneau situé à droite de
      // l'écran : glisser vers la gauche (dx négatif) doit l'élargir.
      const dx = ev.clientX - dragStart.current.x;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, dragStart.current.width - dx));
      setWidth(next);
    }
    function onMouseUp() {
      dragStart.current = null;
      setResizing(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, [width]);

  async function send() {
    const q = question.trim();
    if (!q || pending) return;
    markGuideStep("copilot");
    setPending(true);
    setQuestion("");
    // Réponse déterministe (valeurs observées + règles) : elle décide aussi
    // si un graphique aide. Mistral, s'il est configuré, la reformule.
    let plan: CopilotPlan | undefined;
    const vocabNow = (() => { try { return loadVocab(); } catch { return undefined; } })();
    try { plan = vocabNow ? planCopilotAnswer(vocabNow, q, { focusKpiLabel: context.focusKpiLabel, decisions }) : undefined; } catch { plan = undefined; }
    const chart = plan?.chart ? chartBlock(plan.chart) : "";
    // Valeur attendue (seuils) : petit formulaire dans le fil, sans passer par le modèle.
    const thr = vocabNow ? thresholdRequest(vocabNow, q, context.focusKpiLabel) : undefined;
    if (thr) {
      const cmp = thr.direction === "au_dessus_alerte" ? "≥" : "≤";
      setTurns(t => [...t, { question: q, reply: `Seuils de « ${thr.label} » : alerte ${cmp} ${thr.seuilAlerte.toLocaleString("fr-FR")} ${thr.unit}, critique ${cmp} ${thr.seuilCritique.toLocaleString("fr-FR")} ${thr.unit}. Ajustez-les ici :`, evidence: ["Rédaction : générateur déterministe"], thresholdKpiId: thr.id }]);
      setPending(false);
      return;
    }
    try {
      // Routage par intention : le copilote lit l'ontologie, les faits en cache, les règles
      // ou l'historique — jamais la source directement.
      const snap = loadCockpitSnapshot();
      const routed = routeQuestion(q, {
        ontology: context.vocabSummary,
        facts: snap ? snap.alerts.map(a => `${a.label} (${Object.entries(a.evidence.values).map(([k, v]) => `${k} : ${v}`).join(", ")}; source ${a.evidence.source}, au ${a.evidence.asOf})`).join("\n") : undefined,
        rules: vocabNow ? vocabNow.causalRules.map(r => r.label).join(" ; ") : undefined,
        history: [seriesSummary(context.series), snap ? Object.entries(snap.series).map(([k, pts]) => `${k} : ${pts.slice(-6).map(p => `${p.t} ${p.v}`).join(", ")}`).join("\n") : ""].filter(Boolean).join("\n") || undefined,
      });
      const facts = [plan?.facts, routed.context].filter(Boolean).join("\n") || undefined;
      const r = await askCopilot({ data: { question: q, lang: currentLang(), context: { mode: context.mode, alertLabel: context.alertLabel, alertSignal: context.alertSignal, objectif: context.objectif, contextRaw: context.contextRaw, vocabSummary: context.vocabSummary, pastSessionsSummary: context.pastSessionsSummary, seriesSummary: seriesSummary(context.series), facts, chartShown: Boolean(chart), intent: plan?.intent ?? routed.intent } } });
      const llm = r.llm !== false && !r.reply.startsWith("Je ne peux pas répondre");
      // Garde-fou : chaque chiffre et chaque règle cités par le modèle doivent
      // figurer dans les faits transmis ; sinon la réponse de référence s'affiche.
      const check = llm ? verifyGrounding(stripChartBlocks(r.reply), [facts ?? "", context.vocabSummary ?? "", seriesSummary(context.series) ?? "", context.alertLabel ?? "", context.alertSignal ?? "", q], vocabNow) : undefined;
      const rejected = llm && check && !check.ok && !!plan?.text;
      const text = llm && !rejected ? stripChartBlocks(r.reply) : plan?.text ?? factualFallback(context, q);
      const eg = llm && !rejected ? await guardAgainstEngine(text) : { text, rejected: false };
      const guard = eg.rejected ? ["Garde-fou : contradiction avec le moteur écartée"] : rejected ? [`Garde-fou : réponse du modèle écartée (${[...check!.unverified.map(n => n.toLocaleString("fr-FR")), ...check!.unknownRules.map(x => `règle « ${x} »`)].slice(0, 4).join(", ")} non vérifié)`] : llm ? ["Chiffres vérifiés"] : [];
      setTurns(t => [...t, { question: q, reply: `${eg.text}${chart}`, evidence: [...(plan?.evidence ?? []), llm && !rejected && !eg.rejected ? "Rédaction : Mistral" : "Rédaction : générateur déterministe", ...guard, ...evidenceFor(context)] }]);
    } catch {
      const text = plan?.text;
      setTurns(t => [...t, text
        ? { question: q, reply: `${text}${chart}`, evidence: [...(plan?.evidence ?? []), "Rédaction : générateur déterministe", ...evidenceFor(context)] }
        : { question: q, reply: "L'appel au modèle a échoué (réseau ou service indisponible). Réessayez plus tard.", error: true, evidence: [] }]);
    } finally {
      setPending(false);
    }
  }

  async function requestSuggestions() {
    if (!ontologyConfig || suggestPending) return;
    setSuggestPending(true);
    setSuggestError(null);
    try {
      const r = await suggestOntologyConfig({
        data: {
          objectName: ontologyConfig.objectName,
          existingAttributes: ontologyConfig.existingAttributes,
          sourceCards: ontologyConfig.sourceCards,
        },
      });
      if ("error" in r) {
        setSuggestError(r.error);
      } else if (r.suggestions.length === 0) {
        setSuggestError("Aucune suggestion exploitable renvoyée par le modèle.");
      } else {
        setSuggestions(r.suggestions.map(s => ({ ...s, status: "pending" as const })));
      }
    } catch {
      setSuggestError("L'appel au modèle a échoué (réseau ou service indisponible). C'est attendu si le sandbox bloque les appels sortants.");
    } finally {
      setSuggestPending(false);
    }
  }

  function acceptSuggestion(i: number) {
    const s = suggestions[i];
    if (!ontologyConfig || s.status !== "pending") return;
    ontologyConfig.onAccept(s);
    setSuggestions(list => list.map((x, idx) => idx === i ? { ...x, status: "accepted" } : x));
  }
  function rejectSuggestion(i: number) {
    setSuggestions(list => list.map((x, idx) => idx === i ? { ...x, status: "rejected" } : x));
  }

  if (!open) {
    return (
      <button className="cp-reopen" onClick={() => setOpen(true)} aria-label="Ouvrir le copilote Aura">
        <Sparkles size={16} /><span className="cp-reopen-label">Copilote</span>
        <style>{CSS}</style>
      </button>
    );
  }

  return (
    <>
    <div className="cp-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
    <aside className={`cp-panel${resizing ? " cp-resizing" : ""}`} aria-label="Copilote Aura" style={{ width, flexBasis: width }}>
      <div className="cp-resize-handle" onMouseDown={onHandleMouseDown} aria-hidden="true" title="Glisser pour redimensionner" />
      <header className="cp-head aura-hero-band aura-topbar-side">
        <span><Sparkles size={14} /> Copilote Aura</span>
        <button onClick={() => setOpen(false)} aria-label="Réduire le copilote"><ChevronRight size={16} /></button>
      </header>

      <div className="cp-context">
        <FileText size={11} />
        <span>{context.mode === "cockpit"
          ? (context.alertLabel ? `Contexte : ${context.alertLabel}` : "Contexte : vue Cockpit générale")
          : `Contexte : ${context.objectif || context.contextRaw || "aucune session ouverte"}`}</span>
        {context.mode === "cockpit" && context.alertId && context.onClearAlert && (
          <button type="button" className="cp-context-clear" onClick={context.onClearAlert} aria-label="Revenir à la vue générale" title="Revenir à la vue générale">×</button>
        )}
      </div>
      {context.mode === "cockpit" && context.alertId && context.onOpenDecision && panelMode === "question" && (
        // Une seule interface de décision : le parcours Décider, pré-rempli depuis l'alerte.
        <button type="button" className="cp-options-open" data-testid="copilot-decider" onClick={context.onOpenDecision}>Décider sur cette alerte →</button>
      )}

      {ontologyConfig && (
        <div className="cp-mode-toggle" role="tablist" aria-label="Mode du copilote">
          <button role="tab" aria-selected={panelMode === "question"} className={panelMode === "question" ? "active" : ""} onClick={() => setPanelMode("question")}>Mode question</button>
          <button role="tab" aria-selected={panelMode === "config"} className={panelMode === "config" ? "active" : ""} onClick={() => setPanelMode("config")}><Settings2 size={11} /> Mode configuration</button>
        </div>
      )}

      {panelMode === "config" && ontologyConfig ? (
        <div className="cp-config">
          <p className="cp-config-intro">Copilote de configuration — accélère le paramétrage de l'ontologie pour <strong>{ontologyConfig.objectName}</strong>. Les suggestions sont des points de départ : à accepter ou rejeter une par une, rien n'est appliqué automatiquement.</p>
          <button type="button" className="cp-suggest-btn" onClick={() => void requestSuggestions()} disabled={suggestPending}>
            <Sparkles size={13} /> {suggestPending ? "Génération en cours…" : "Suggérer des attributs et sources"}
          </button>
          {suggestError && <p className="cp-a cp-a-error">{suggestError}</p>}
          {suggestions.length > 0 && (
            <div className="cp-suggestions">
              {suggestions.map((s, i) => (
                <div key={`${s.attribut}-${i}`} className={`cp-suggestion ${s.status !== "pending" ? "cp-suggestion-done" : ""}`}>
                  <div className="cp-suggestion-top">
                    <strong>{s.attribut}</strong>
                    <span className="cp-badge">{ontologyConfig.sourceCards.find(c => c.id === s.applicationId)?.nom ?? s.applicationId}</span>
                  </div>
                  <p className="cp-suggestion-field">Champ deviné : <code>{s.champGuess}</code></p>
                  {s.alertesLiees.length > 0 && <p className="cp-suggestion-alerts">Alertes liées : {s.alertesLiees.join(", ")}</p>}
                  <p className="cp-suggestion-note">{s.note}</p>
                  {s.status === "pending" ? (
                    <div className="cp-mapping-actions">
                      <button type="button" onClick={() => acceptSuggestion(i)}>Accepter</button>
                      <button type="button" onClick={() => rejectSuggestion(i)}>Rejeter</button>
                    </div>
                  ) : (
                    <span className="cp-suggestion-status">{s.status === "accepted" ? "Ajouté au graphe" : "Rejeté"}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="cp-thread">
            {turns.length === 0 && (
              <p className="cp-empty"><MessageSquare size={13} /> Posez votre question.</p>
            )}
            {turns.map((t, i) => (
              <div key={i} className="cp-turn">
                <p className="cp-q"><Q>{t.question}</Q></p>
                <div className={t.error ? "cp-a cp-a-error" : "cp-a"}><Markdown>{t.reply}</Markdown></div>
                {!t.error && t.reply && <CopyButtons text={t.reply} />}
                {t.thresholdKpiId && !t.done && (() => {
                  const v = (() => { try { return loadVocab(); } catch { return undefined; } })();
                  const k = v?.kpis.find(x => x.id === t.thresholdKpiId);
                  if (!v || !k) return null;
                  return <InlineValueForm testId="copilot-threshold-form" submitLabel="Appliquer"
                    fields={[{ key: "alerte", label: "Seuil d'alerte", kind: "number", unit: k.unit, default: k.seuilAlerte }, { key: "critique", label: "Seuil critique", kind: "number", unit: k.unit, default: k.seuilCritique }]}
                    validate={x => checkThresholds(k, Number(x.alerte), Number(x.critique))}
                    onSubmit={x => { void persistSupplyVocab(withThresholds(v, k.id, Number(x.alerte), Number(x.critique))); setTurns(ts => ts.map((tt, j) => j === i ? { ...tt, done: `Seuils appliqués : alerte ${Number(x.alerte).toLocaleString("fr-FR")} ${k.unit}, critique ${Number(x.critique).toLocaleString("fr-FR")} ${k.unit}.` } : tt)); }} />;
                })()}
                {t.done && <p className="cp-a" role="status">{t.done}</p>}
                {t.evidence.length > 0 && (
                  <div className="cp-evidence">
                    {t.evidence.map(e => <span key={e} className="cp-badge">{e}</span>)}
                  </div>
                )}
                {!t.error && <div><EmailButton subject={`Aura — ${t.question}`.slice(0, 120)} body={`${t.question}\n\n${t.reply}`} pdf={getActiveReport()} /></div>}
              </div>
            ))}
            {pending && <p className="cp-pending">Aura réfléchit…</p>}
          </div>

          {context.pastSessions && context.pastSessions.length > 0 && (
            <div className="cp-replay">
              {context.pastSessions && context.pastSessions.length > 0 && (
                <>
                  <p className="cp-replay-label">Décisions déjà évaluées — rejouer ou reprendre :</p>
                  <div className="cp-replay-list">
                    {context.pastSessions.slice(0, 4).map(s => (
                      <button key={s.id} type="button" className="cp-replay-item" onClick={() => onResumeSession?.(s.id)}>
                        <span className="cp-replay-title">{s.title}</span>
                        <span className="cp-badge">{STEP_LABEL[s.step]}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      <form className={`cp-input${panelMode === "config" ? " cp-input-hidden" : ""}`} onSubmit={e => { e.preventDefault(); void send(); }}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Poser une question à Aura…"
          disabled={pending}
        />
        <button type="submit" disabled={pending || !question.trim()} aria-label="Envoyer"><Send size={14} /></button>
      </form>

      <style>{CSS}</style>
    </aside>
    </>
  );
}


const STATUS_FILL = { ok: "#16a34a", alerte: "#d97706", critique: "#dc2626" } as const;
const norm = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

function seriesSummary(series?: CopilotSeries[]): string | undefined {
  if (!series?.length) return undefined;
  return series.map(s => `${s.label} (${s.unit}, seuil alerte ${s.alert}, critique ${s.critical}, source ${s.source}) : ${s.points.map(p => `${p.name}=${p.value}${p.status !== "ok" ? ` [${p.status}]` : ""}`).join(", ")}`).join("\n");
}

// Réponse factuelle quand le modèle est indisponible : uniquement les valeurs
// vérifiées de Studio, sans interprétation.
function factualFallback(context: CopilotContext, question: string): string {
  const series = context.series?.filter(s => s.points.length) ?? [];
  if (!series.length) return "Le modèle est indisponible et aucune donnée Studio n'est raccordée : je ne peux rien affirmer.";
  const q = norm(question);
  const selected = series.find(s => norm(s.label).split(/\s+/).filter(w => w.length > 3).some(w => q.includes(w)))
    ?? series.find(s => s.points.some(p => p.status !== "ok")) ?? series[0];
  const hits = selected.points.filter(p => p.status !== "ok").sort((a, b) => (a.status === b.status ? 0 : a.status === "critique" ? -1 : 1));
  const lines = hits.slice(0, 8).map(p => `- **${p.name}** : ${p.value} ${selected.unit} (${p.status})`);
  return [
    "*Modèle indisponible — faits vérifiés issus de Studio, sans interprétation.*",
    `**${selected.label}** · ${hits.length} enregistrement(s) sur ${selected.points.length} au-delà du seuil (alerte ${selected.alert}, critique ${selected.critical} ${selected.unit}) :`,
    lines.length ? lines.join("\n") : "- aucun enregistrement au-delà du seuil",
    `Source : ${selected.source}.`,
  ].join("\n\n");
}

function evidenceFor(context: CopilotContext): string[] {
  const badges: string[] = [];
  if (context.mode === "cockpit" && context.alertLabel) badges.push("Contexte : alerte Supply Chain");
  if (context.mode === "decision" && (context.objectif || context.contextRaw)) badges.push("Hypothèses : contexte de décision");
  badges.push("Validation humaine requise");
  return badges;
}

const CSS = `
.cp-panel{flex:0 0 auto;min-width:0;display:flex;flex-direction:column;background:var(--v4-surface,#fff);border-left:0;box-shadow:inset 1px 0 0 var(--v4-border,#e8e5f8);height:100%;position:relative}
.cp-resize-handle{position:absolute;left:-4px;top:0;bottom:0;width:8px;cursor:col-resize;z-index:5;background:transparent}
.cp-resize-handle:hover{background:var(--v4-accent-border,#ded6fb)}
.cp-resizing .cp-resize-handle{background:var(--v4-accent,#7c3aed)}
.cp-resizing,.cp-resizing *{user-select:none}
.cp-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;font:700 14px var(--font-display,var(--font-sans));letter-spacing:-.005em;color:#fff}
.cp-head span svg{color:var(--aura-indigo-300,#a5a3f5)}
.cp-head span{display:flex;align-items:center;gap:6px}
.cp-head button{border:0;background:transparent;color:var(--aura-indigo-200,#c9c8fb);cursor:pointer;display:grid;place-items:center;border-radius:8px;transition:background .15s,color .15s}
.cp-head button:hover{background:rgb(255 255 255 / .1);color:#fff}
.cp-context{display:flex;align-items:flex-start;gap:6px;padding:10px 14px;font-size:12.5px;line-height:1.4;color:var(--v4-text2,#4c3d7a);border-bottom:1px solid var(--v4-border,#e8e5f8);background:var(--v4-panel,#faf9ff)}
.cp-context-clear{margin-left:auto;border:0;background:none;color:var(--v4-text3,#9585c4);cursor:pointer;font:700 15px/1 var(--font-sans);padding:0 2px}
.cp-options-open{margin:8px 14px 0;align-self:flex-start;border:1px solid var(--v4-accent-border,#c9bffd);background:var(--v4-surface,#fff);color:var(--v4-accent2,#6d28d9);border-radius:999px;padding:4px 11px;font:700 12.5px var(--font-sans);cursor:pointer}
.cp-thread{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:12px}
.cp-empty{display:flex;align-items:center;gap:6px;font-size:13px;color:var(--v4-text3,#9585c4);margin:0}
.cp-turn{display:flex;flex-direction:column;gap:5px}
.cp-q{margin:0;font-size:13px;font-weight:700;color:var(--v4-text,#1a1433);align-self:flex-end;background:var(--v4-accent-bg,#f0ecff);border-radius:8px;padding:6px 10px;max-width:92%}
.cp-a{margin:0;font-size:13px;line-height:1.55;color:var(--v4-text2,#4a4a4a)}\n.cp-a>div{margin:0}.cp-a .my-4{margin:10px 0}.cp-a svg{overflow:visible}
.cp-a-error{color:#b91c1c}
.cp-evidence{display:flex;flex-wrap:wrap;gap:4px}
.cp-badge{font-size:12px;font-weight:700;color:var(--v4-accent2,#6d28d9);background:var(--v4-accent-bg,#f0ecff);border-radius:6px;padding:2px 6px}
.cp-pending{font-size:13px;color:var(--v4-text3,#9585c4);margin:0}
.cp-replay{display:flex;flex-direction:column;gap:6px;padding:0 14px 10px;border-top:1px solid var(--v4-border,#cfcfcf);padding-top:10px}
.cp-replay-label{margin:0;font-size:12.5px;font-weight:700;color:var(--v4-text3,#8a8a8a)}
.cp-replay-list{display:flex;flex-direction:column;gap:5px}
.cp-replay-item{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid var(--v4-border,#cfcfcf);background:var(--v4-panel,#f5f5f5);color:var(--v4-text,#171717);border-radius:8px;padding:6px 9px;font:700 12.5px var(--font-sans);cursor:pointer;text-align:left}
.cp-replay-item:hover{border-color:var(--v4-accent,#2b2b2b)}
.cp-replay-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0}
.cp-new-analysis{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:0;background:var(--v4-accent,#7c3aed);color:#fff;border-radius:8px;padding:7px 10px;font:700 12.5px var(--font-sans);cursor:pointer}
.cp-input{display:flex;gap:6px;padding:10px 14px;border-top:1px solid var(--v4-border,#e8e5f8)}
.cp-input input{flex:1;border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:8px 10px;font:600 13px var(--font-sans);min-width:0}
.cp-input button{border:0;background:var(--v4-accent,#7c3aed);color:#fff;border-radius:8px;width:34px;display:grid;place-items:center;cursor:pointer}
.cp-input button:disabled{opacity:.5;cursor:not-allowed}
.cp-reopen{position:fixed;right:16px;bottom:16px;width:42px;height:42px;border-radius:999px;border:0;background:var(--v4-accent,#7c3aed);color:#fff;display:grid;place-items:center;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.28);z-index:20}
.cp-backdrop,.cp-reopen-label{display:none}
.cp-head button{min-width:32px}
@media(max-width:1279px){
  .cp-panel{position:fixed;top:0;right:0;bottom:0;height:100dvh;width:min(440px,100vw)!important;flex-basis:auto!important;z-index:220;box-shadow:-18px 0 50px rgba(20,12,50,.22)}
  .cp-resize-handle{display:none}
  .cp-backdrop{display:block;position:fixed;inset:0;z-index:215;background:rgba(15,12,30,.35)}
  .cp-head button{min-width:44px;min-height:44px}
  .cp-input button{width:44px}
  .cp-reopen{width:auto;height:48px;padding:0 16px;gap:6px;display:flex;align-items:center;font:800 13.5px var(--font-sans)}
  .cp-reopen-label{display:inline}
}

.cp-mode-toggle{display:flex;gap:4px;padding:8px 14px 0}
.cp-mode-toggle button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:4px;border:1px solid var(--v4-border,#e8e5f8);background:var(--v4-panel,#faf9ff);color:var(--v4-text3,#9585c4);border-radius:8px;padding:6px 4px;font:700 12.5px var(--font-sans);cursor:pointer}
.cp-mode-toggle button.active{background:var(--v4-accent,#7c3aed);color:#fff;border-color:#111111}
.cp-config{flex:1;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.cp-config-intro{margin:0;font-size:13px;line-height:1.5;color:var(--v4-text2,#4c3d7a)}
.cp-suggest-btn{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;border:0;background:var(--v4-accent,#7c3aed);color:#fff;border-radius:8px;padding:8px 12px;font:700 13px var(--font-sans);cursor:pointer}
.cp-suggest-btn:disabled{opacity:.6;cursor:not-allowed}
.cp-suggestions{display:flex;flex-direction:column;gap:8px}
.cp-suggestion{border:1px solid var(--v4-border,#e8e5f8);border-radius:8px;padding:9px 11px;background:var(--v4-panel,#faf9ff)}
.cp-suggestion-done{opacity:.6}
.cp-suggestion-top{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:13px;color:var(--v4-text,#1a1433)}
.cp-suggestion-field,.cp-suggestion-alerts,.cp-suggestion-note{margin:4px 0 0;font-size:12.5px;color:var(--v4-text3,#9585c4);line-height:1.4}
.cp-suggestion-status{display:inline-block;margin-top:6px;font-size:12px;font-weight:800;color:var(--v4-accent2,#6d28d9)}
.cp-mapping-actions{display:flex;gap:6px;margin-top:8px}
.cp-mapping-actions button{flex:1;border:1px solid var(--v4-border,#e8e5f8);background:#fff;color:var(--v4-text2,#4c3d7a);border-radius:8px;padding:5px 6px;font:700 12.5px var(--font-sans);cursor:pointer}
.cp-mapping-actions button:hover{border-color:var(--v4-accent,#7c3aed);color:var(--v4-accent2,#6d28d9)}
.cp-input-hidden{display:none}
`;
