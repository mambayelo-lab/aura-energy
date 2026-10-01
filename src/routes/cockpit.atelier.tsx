import { useDismiss } from "@/lib/ui/use-dismiss";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { audit, useAccess } from "@/lib/security/use-access";
import { KeywordText, Q } from "@/components/aura/KeywordText";
import { dropZoneProps, DOC_FORMATS_LABEL, DocStatusList } from "@/components/aura/DocumentDrop";
import { DOC_ACCEPT } from "@/lib/v4/doc-formats";
import type { DocResult } from "@/lib/v4/doc-extract";
import { useTelemetrie, RappelsRevue, PlanifierRevue } from "@/components/aura/PlatformKit";
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, Fragment } from "react";
import { analyzeSow, possibilisticCapacity } from "../lib/engine/sow";
import { goalSeek, type ComboEval as GoalComboEval } from "../lib/engine/goalseek";
import { filterGloballyVerified, traceBlockingBranch, culpritLevers, findMinimalRepairs, distinctExecutivePaths, globalVetoBreaches, type ObjectiveRef, type LeverCulprit } from "../lib/v4/goalseek-verify";
import { EXHAUSTIVE_LIMIT, memoLast, lookupCombo } from "../lib/v4/exhaustive-search";
import { evaluatorFor } from "../lib/v4/space-evaluator";
import { RequirementsPanel } from "../components/aura/TransformPanel";
import { computeLoResults } from "../lib/v4/decision-express";
import { makeDecisionReport, MiniReportButton, ModeSwitch, ParcoursStepBar, ReportButton, StepFollow, StepTabs } from "../components/aura/decider/DecisionParcours";
import { SolidityNote } from "../components/aura/decider/SolidityNote";
import { DecisionDialogue } from "../components/aura/decider/DecisionDialogue";
import { setActiveRanking, setActiveReport } from "../lib/v4/active-report";
import { rankOptions, validateOption } from "../lib/v4/decision-express";
import { ImpactTree } from "../components/aura/decider/ImpactTree";
import { SolutionExplorer } from "../components/aura/decider/SolutionExplorer";
import { liveKrValue, retainDecision } from "../lib/v4/decision-supply-link";
import { VoiceInput, appendDictation } from "../components/aura/VoiceInput";
import { CompagnonAura, type CompanionStep } from "../components/aura/CompagnonAura";
import { ArbitrageMinimal } from "../components/aura/ArbitrageMinimal";
import { CombinaisonsSuivies } from "../components/aura/CombinaisonsSuivies";
import { saveCombo, type OrdLevel as ComboOrdLevel } from "../lib/v4/combinaisons-store";
// Initiatives du plan d'action : dérivation déterministe depuis le scénario retenu
// portées par le scénario retenu (aucun LLM, aucun chiffre produit).
import { deriveInitiatives, INITIATIVE_NATURE_LABEL, type DerivedInitiative } from "../lib/v4/decider-initiatives";


import type {
  AtelierSession, AtelierCriterion, AtelierScenario, AtelierLevier, AtelierStep,
  ImportanceBadge, LeverType, QualitativeImpact, AtelierOptionDef, ElicitationData,
  AtelierLevierDef, ImpactOrigin, ActionPlanAction,
} from "../lib/v4/atelier-store";
import {
  loadSessions, saveSession, deleteSession, newSession, onSessionsChange, loadSession,
  importanceFromPoids, garbageCollectSessionData,
} from "../lib/v4/atelier-store";
import { addNotification } from "../lib/v4/notification-store";
import { ARCHITECTURE_PATTERNS, getArchitecturePattern, type ArchitecturePattern } from "../lib/v4/architecture-patterns";
import { getProfile, buildCompanyContext } from "../lib/v4/company-profile";
import { saveInitiative } from "../lib/v4/initiative-store";
import { aggregateNode, type ElementaryImpact, thesisWeights, compareASC } from "../lib/engine/lo/aggregation";
import { ORD } from "../lib/engine/lo/types";
import type { OrdinalLevel, Attitude, OrdinalImpact, RawCell } from "../lib/engine/lo/types";
import { DecisionChainDiagram, type ChainCrit, type ChainLev, type CritNode } from "../components/aura/DecisionChainDiagram";
import { AuraIcon, AuraLogo } from "../components/aura/AuraUI";
import { Button } from "../components/ui/button";
import { ComprendreArbreLeviers, leverColor } from "@/components/aura/ComprendreArbreLeviers";
import { AlertTriangle, ArrowRight, BarChart3, Check, ChevronRight, Crown, FileUp, Layers, Leaf, Lightbulb, Loader2, MoreHorizontal, ShieldCheck, Sparkles, Target, TrendingDown, TrendingUp, Upload } from "lucide-react";
import { PackIllustration } from "../components/aura/PackIllustration";
import { SECTOR_PACKS, findSectorCase, findPackBySector, packExpertContextBlock } from "../lib/v4/packs-sectoriels";
import { buildDemoElicitation, enrichDecisionDemoCase } from "../lib/v4/demo-enrichment";
import { CommentCaMarcheLink } from "../components/aura/CommentCaMarche";
import {
  CASE_TYPES, type CaseTypeId, matchCaseType, PESTEL_DIMS, PESTEL_OVERLAP_PATTERNS, OBJECTIF_HINT_BY_CASETYPE,
  RISK_SUGGESTIONS, DDP_SUGGESTIONS, STAKEHOLDER_SUGGESTIONS, CASE_TYPE_GENERATION_HINTS,
  buildArchPatternHint, inferFromText, QUESTION_BY_CASE, DEMO_FACTORIES,
} from "../lib/v4/atelier-cases";
import {
  PAIR_TO_TEXT, qualImpactToElementary, QUAL_IMPACT_LABELS, matchImpactScale,
  importanceToWeight, enumerateCombos, refusalText, outcomeDistributionGen, findCombosForOutcome,
  getLeafCriteria, leafsOf, updateCritDeep, removeCritDeep, addChildDeep, aggregateHierarchy,
  explainBackwardChildren, buildCascadeNodes, collectCascadeLeaves,
  type OutcomeCell, type OutcomeDistProgress, type ComboMatch, type BackwardEntry, type CascadeNode,
} from "../lib/v4/atelier-compute";

// Décider : réservé aux analystes et administrateurs (le lecteur consulte le cockpit).
function AtelierGate() {
  const access = useAccess();
  if (access.role === "lecteur") return <div style={{ padding: 32, fontSize: 13 }} role="note">Votre rôle (lecteur) permet de consulter le cockpit. Décider est réservé aux analystes et aux administrateurs.</div>;
  return <AtelierPage />;
}

export const Route = createFileRoute("/cockpit/atelier")({
  validateSearch: (s: Record<string, unknown>) => ({
    sessionId: typeof s.sessionId === "string" ? s.sessionId : undefined,
    alertId: typeof s.alertId === "string" ? s.alertId : undefined,
    // Porte d'entrée par finalité (accueil / site) : le vocabulaire du parcours
    // suit la finalité, le cheminement reste unique.
    finalite: typeof s.finalite === "string" ? s.finalite : undefined,
    demo: typeof s.demo === "string" ? s.demo : undefined,
    title: typeof s.title === "string" ? s.title : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Arbitrer une décision — Aura" },
      { name: "description", content: "Comparez des options qualitativement et recherchez les changements minimaux pour atteindre une cible." },
      { property: "og:title", content: "Arbitrer une décision — Aura" },
      { property: "og:description", content: "Comparez des options et recherchez une trajectoire vers votre cible, sans score compensatoire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AtelierGate,
});

// ─── Importance badge config ──────────────────────────────────────────────────
const IMPORTANCE_CONFIG: Record<ImportanceBadge, { color: string; bg: string; border: string }> = {
  Essentiel:   { color: "#6750a4", bg: "#ede9fe", border: "#c4b5fd" },
  Important:   { color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
  Secondaire:  { color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  Faible:      { color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
};

function ImportancePill({ badge }: { badge: ImportanceBadge }) {
  const cfg = IMPORTANCE_CONFIG[badge];
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 8,
      background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
      textTransform: "uppercase", letterSpacing: ".05em", flexShrink: 0,
    }}>{badge}</span>
  );
}

// ─── Lever type icon + color ──────────────────────────────────────────────────
const LEVER_ICONS: Record<LeverType, string> = {
  budget:    "💰",
  ressource: "👥",
  temps:     "⏱",
  risque:    "⚠",
  decision:  "🎯",
  technique: "⚙",
  autre:     "◈",
};

const LEVER_TYPE_COLORS: Record<LeverType, { color: string; bg: string; border: string }> = {
  budget:    { color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
  ressource: { color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" },
  temps:     { color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  risque:    { color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" },
  decision:  { color: "#6366f1", bg: "#eef2ff", border: "#a5b4fc" },
  technique: { color: "#0369a1", bg: "#e0f2fe", border: "#7dd3fc" },
  autre:     { color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
};

// ─── KR Sparkline ────────────────────────────────────────────────────────────
// ─── KR Trend badge ──────────────────────────────────────────────────────────
function krTrendInfo(mesures: Array<{ valeur: string }>) {
  if (mesures.length < 2) return null;
  const nums = mesures.map(m => parseFloat(m.valeur.replace(',', '.').replace(/[^0-9.e+\-]/g, '')) || 0);
  const first = nums[0], last = nums[nums.length - 1];
  const pct = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;
  if (pct > 15)  return { icon: '↑↑', label: `+${Math.round(pct)}%`, bg: '#d1fae5', color: '#065f46' };
  if (pct > 3)   return { icon: '↑',  label: `+${Math.round(pct)}%`, bg: '#ecfdf5', color: '#059669' };
  if (pct < -15) return { icon: '↓↓', label: `${Math.round(pct)}%`,  bg: '#fee2e2', color: '#991b1b' };
  if (pct < -3)  return { icon: '↓',  label: `${Math.round(pct)}%`,  bg: '#fff7ed', color: '#c2410c' };
  return { icon: '→', label: '~stable', bg: '#f3f4f6', color: '#6b7280' };
}

function KRTrendBadge({ mesures }: { mesures: Array<{ valeur: string }> }) {
  const t = krTrendInfo(mesures);
  if (!t) return (
    <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "#f3f4f6", color: "#9ca3af", fontWeight: 600 }}>— aucun historique</span>
  );
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, padding: "3px 9px", borderRadius: 8, background: t.bg, color: t.color, fontWeight: 800, flexShrink: 0, letterSpacing: ".01em" }}>
      <AuraIcon e={t.icon} size={16} />
      <span style={{ fontSize: 12, fontWeight: 700 }}>{t.label}</span>
    </span>
  );
}

// ─── (ancien KRSparkline supprimé — remplacé par KRTrendBadge) ──────────────

// ─── Moyen de mesure suggéré ─────────────────────────────────────────────────
function suggestMoyen(label: string): string {
  const l = label.toLowerCase();
  if (l.includes('irp') || l.includes('probabilité') || l.includes('sûreté')) return 'Rapport PSA annuel · audit sûreté ASN';
  if (l.includes('asn') || l.includes('conformité') || l.includes('réglementaire')) return 'Audit ASN trimestriel · GED conformité';
  if (l.includes('lcoe') || l.includes('€/mwh') || l.includes('coût de production')) return 'Tableau de bord SAP PM mensuel';
  if (l.includes('délai') || l.includes('calendrier') || l.includes('mois')) return 'Rapport PMO · planning Primavera P6';
  if (l.includes('trl') || l.includes('maturité') || l.includes('technolog')) return 'Évaluation TRL trimestrielle (R&D)';
  if (l.includes('flexibil') || l.includes('modular') || l.includes('mwe')) return 'Simulation Digital Twin réseau électrique';
  if (l.includes('social') || l.includes('opinion') || l.includes('acceptabilité') || l.includes('public')) return 'Sondage OpinionWay trimestriel';
  if (l.includes('emploi') || l.includes('rh') || l.includes('formation')) return 'Rapport RH semestriel · bilan social';
  if (l.includes('carbone') || l.includes('co2') || l.includes('émission')) return 'Bilan carbone annuel certifié';
  if (l.includes('budget') || l.includes('financ') || l.includes('capex')) return 'Reporting financier mensuel (ERP)';
  if (l.includes('client') || l.includes('satisfaction') || l.includes('nps')) return 'Enquête satisfaction trimestrielle';
  return 'Tableau de bord de suivi mensuel';
}

// ─── Chip component ───────────────────────────────────────────────────────────
function ChipList({ items, onAdd, onRemove, placeholder }: {
  items: string[];
  onAdd: (s: string) => void;
  onRemove: (s: string) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  function commit() {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft("");
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {items.map(item => (
        <span key={item} style={{
          display: "flex", alignItems: "center", gap: 4, fontSize: 13, padding: "3px 9px",
          borderRadius: 8, background: "var(--v4-surface)", border: "1px solid var(--v4-border)",
          color: "var(--v4-text2)",
        }}>
          {item}
          <button onClick={() => onRemove(item)} style={{
            background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)",
            fontSize: 13, padding: 0, lineHeight: 1, fontFamily: "inherit",
          }}>✕</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder={placeholder}
        style={{
          fontSize: 13, border: "1px dashed var(--v4-border)", borderRadius: 8,
          padding: "3px 10px", background: "transparent", color: "var(--v4-text)",
          outline: "none", minWidth: 100, fontFamily: "inherit",
        }}
      />
    </div>
  );
}

// ─── Radar SVG ────────────────────────────────────────────────────────────────
// Résultat de calcul, en lecture seule : un clic ouvre ses entrées (importance des critères).
function RadarChart({ criteria, size = 160, onEdit }: { criteria: AtelierCriterion[]; size?: number; onEdit?: () => void }) {
  const N = criteria.length;
  if (N < 3) return null;
  const cx = size / 2, cy = size / 2, R = size * 0.4;
  const angle = (i: number) => (i / N) * 2 * Math.PI - Math.PI / 2;
  const pt = (i: number, r: number) => [
    cx + r * Math.cos(angle(i)),
    cy + r * Math.sin(angle(i)),
  ] as [number, number];
  const maxP = Math.max(...criteria.map(c => c.poids), 1);
  const dataPts = criteria.map((c, i) => pt(i, (c.poids / maxP) * R));
  const labelR = R + size * 0.09;
  const PAD = 72;
  return (
    // Marge autour du radar pour des libellés lisibles (≥ 11 px), jamais coupés.
    <svg width="100%" viewBox={`${-PAD} -14 ${size + 2 * PAD} ${size + 28}`} style={{ maxWidth: size + 2 * PAD, cursor: onEdit ? "pointer" : undefined }}
      {...(onEdit ? { role: "button", tabIndex: 0, "aria-label": "Modifier l'importance des critères", onClick: onEdit, onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter") onEdit(); } } : {})}>
      {onEdit && <title>Cliquer pour modifier l'importance des critères</title>}
      {[0.25, 0.5, 0.75, 1].map(r => (
        <polygon key={r} points={criteria.map((_, i) => pt(i, r * R).join(",")).join(" ")}
          fill="none" stroke="var(--v4-border)" strokeWidth={0.8} />
      ))}
      {criteria.map((_, i) => {
        const [x2, y2] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="var(--v4-border)" strokeWidth={0.8} />;
      })}
      <polygon points={dataPts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="var(--v4-accent)" fillOpacity={0.18} stroke="var(--v4-accent)" strokeWidth={1.5} />
      {dataPts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={size * 0.02} fill="var(--v4-accent)" />)}
      {criteria.map((c, i) => {
        const [x, y] = pt(i, labelR);
        return (
          <text key={i} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fontSize={12} fill="var(--v4-text2)" fontFamily="system-ui, sans-serif">
            {c.label.length > 14 ? c.label.slice(0, 13) + "…" : c.label}<title>{c.label}</title>
          </text>
        );
      })}
    </svg>
  );
}

function RadarWithLevelSelector({ allCriteria, onEdit }: { allCriteria: AtelierCriterion[]; onEdit?: () => void }) {
  const [level, setLevel] = useState<"moe" | "mop" | "tpm">("tpm");
  function getCriteriaForLevel(): AtelierCriterion[] {
    if (level === "moe") return allCriteria;
    if (level === "mop") return allCriteria.flatMap(c => c.children?.length ? c.children : [c]);
    return getLeafCriteria(allCriteria);
  }
  const displayed = getCriteriaForLevel();
  const labels: Record<string, string> = { moe: "Objectifs", mop: "Dimensions", tpm: "Indicateurs" };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
      <div style={{ display: "flex", borderRadius: 6, border: "1px solid var(--v4-border)", overflow: "hidden" }}>
        {(["moe", "mop", "tpm"] as const).map(l => (
          <button key={l} onClick={() => setLevel(l)}
            style={{ padding: "2px 7px", border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 12, fontWeight: 700,
              background: level === l ? "var(--v4-accent,#7c3aed)" : "transparent",
              color: level === l ? "#fff" : "var(--v4-text3)", transition: "all .1s" }}>
            {labels[l]}
          </button>
        ))}
      </div>
      {displayed.length >= 3
        ? <RadarChart criteria={displayed} size={160} onEdit={onEdit} />
        : <div style={{ fontSize: 12, color: "var(--v4-text3)", padding: 12 }}>≥ 3 critères requis</div>
      }
    </div>
  );
}

// ─── Scatter Plot ─────────────────────────────────────────────────────────────
function ScatterPlot({ scenarios }: { scenarios: AtelierScenario[] }) {
  const W = 260, H = 200, pad = 30;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: "visible", maxWidth: W }}>
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="var(--v4-border)" strokeWidth={1} />
      <line x1={pad} y1={pad} x2={pad} y2={H - pad} stroke="var(--v4-border)" strokeWidth={1} />
      <text x={W / 2} y={H - 4} textAnchor="middle" fontSize={12} fill="var(--v4-text3)" fontFamily="system-ui">Faisabilité →</text>
      <text x={8} y={H / 2} textAnchor="middle" fontSize={12} fill="var(--v4-text3)" fontFamily="system-ui"
        transform={`rotate(-90,8,${H / 2})`}>Valeur →</text>
      {scenarios.map(s => {
        const x = pad + ((s.faisabilite / 100) * (W - 2 * pad));
        const y = (H - pad) - ((s.valeur / 100) * (H - 2 * pad));
        return (
          <g key={s.id}>
            <circle cx={x} cy={y} r={8} fill={s.color} fillOpacity={0.8} />
            <text x={x} y={y - 12} textAnchor="middle" fontSize={12} fill={s.color} fontWeight={700} fontFamily="system-ui">{s.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// Barre d'étapes : ParcoursStepBar (components/aura/decider/DecisionParcours).

// ─── Aura chat pane ───────────────────────────────────────────────────────────
interface AuraMsg { role: "aura" | "user"; text: string; }

function AuraChatPane({ session, msgs, setMsgs, loading, setLoading }: {
  session: AtelierSession | null;
  msgs: AuraMsg[];
  setMsgs: (m: AuraMsg[] | ((prev: AuraMsg[]) => AuraMsg[])) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  async function send() {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMsgs(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);
    try {
      const { askAtelierAura } = await import("../lib/v4/atelier-llm");
      const ctx = session ? `Décision: ${session.contextRaw.slice(0, 200)}. Étape actuelle: ${session.step}. Critères: ${session.criteria.map(c => c.label).join(", ")}` : "";
      const r = await askAtelierAura({ data: { userMessage: q, sessionContext: ctx } });
      setMsgs(prev => [...prev, { role: "aura", text: r.reply }]);
    } catch {
      setMsgs(prev => [...prev, { role: "aura", text: "Je ne peux pas répondre pour l'instant." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--v4-surface)", borderRight: "1px solid var(--v4-border)" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--v4-border)", flexShrink: 0 }}>
        <AuraLogo size="sm" product="Décider" />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "90%", padding: "8px 11px", borderRadius: m.role === "user" ? "12px 12px 2px 12px" : "12px 12px 12px 2px",
              background: m.role === "user" ? "var(--v4-accent)" : "var(--v4-bg)",
              color: m.role === "user" ? "#fff" : "var(--v4-text)",
              fontSize: 13, lineHeight: 1.55, border: m.role === "aura" ? "1px solid var(--v4-border)" : "none",
            }}>{m.text}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{ padding: "8px 14px", borderRadius: "8px 12px 12px 2px", background: "var(--v4-bg)", border: "1px solid var(--v4-border)", fontSize: 15.5, letterSpacing: 2 }}>
              <span style={{ animation: "atelier-dots 1.2s infinite" }}>···</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid var(--v4-border)", flexShrink: 0, display: "flex", gap: 8 }}>
        <textarea value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Posez une question à Aura…" rows={2}
          style={{
            flex: 1, resize: "none", border: "1px solid var(--v4-border)", borderRadius: 8,
            padding: "7px 10px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)",
            fontFamily: "inherit", outline: "none", lineHeight: 1.4,
          }} />
        <button onClick={send} disabled={loading || !input.trim()}
          style={{
            width: 34, height: 34, borderRadius: 8, border: "none", cursor: "pointer",
            background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, alignSelf: "flex-end",
            opacity: loading || !input.trim() ? 0.5 : 1, fontFamily: "inherit",
          }}>↑</button>
      </div>
    </div>
  );
}

// ─── Step 1: Comprendre (merged context + criteria) ───────────────────────────
// ─── Encart component ────────────────────────────────────────────────────────
function Encart({ icon, title, hint, children, headerRight, collapsible, defaultOpen = true }: { icon: string; title: string; hint: string; children: React.ReactNode; headerRight?: React.ReactNode; collapsible?: boolean; defaultOpen?: boolean }) {
  // Épuré : l'aide est une info-bulle ; un encart repliable s'ouvre à la demande.
  const [open, setOpen] = useState(!collapsible || defaultOpen);
  return (
    <div style={{
      border: "1.5px solid var(--v4-border)", borderRadius: 8,
      background: "var(--v4-surface)", overflow: "hidden",
    }}>
      <div style={{
        padding: "10px 14px 9px", borderBottom: open ? "1px solid var(--v4-border)" : "none",
        background: "var(--v4-bg)", display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          {collapsible
            ? <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} title={hint} style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}>{open ? "▾" : "▸"} {title}</button>
            : <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", letterSpacing: ".01em" }} title={hint}>{title}</div>}
        </div>
        {open && headerRight}
      </div>
      {open && <div style={{ padding: "12px 14px" }}>{children}</div>}
    </div>
  );
}

// Qualitative ordinal selector for criterion importance
// N=Aucune · L=Faible · M=Moyen · H=Haut  →  maps to Lo scale
const ORD_LEVELS = [
  { key: "N", label: "N", title: "Aucune — négligeable",        poids: 8,  importance: "Faible"as ImportanceBadge, color: "#9ca3af" },
  { key: "L", label: "L", title: "Faible — secondaire",      poids: 15, importance: "Secondaire"as ImportanceBadge, color: "#d97706" },
  { key: "M", label: "M", title: "Moyen — important",        poids: 25, importance: "Important"as ImportanceBadge, color: "#059669" },
  { key: "H", label: "H", title: "Haut — essentiel",         poids: 40, importance: "Essentiel"as ImportanceBadge, color: "#6750a4" },
];

// Une combinaison de leviers évaluée par le moteur : son couple (δ⁺, δ⁻) et le
// choix d'option retenu pour chaque levier.
type PossCombo = { gPlus: OrdinalLevel; dMinus: OrdinalLevel; combo: Record<string, string> };

function importanceToOrdKey(imp: ImportanceBadge): string {
  if (imp === "Essentiel")  return "H";
  if (imp === "Important")  return "M";
  if (imp === "Secondaire") return "L";
  return "N";
}

const LEVEL_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  MOE: { label: "Objectif",   bg: "#ede9fe", color: "#6750a4" },
  MOP: { label: "Dimension",  bg: "#dbeafe", color: "#1e40af" },
  TPM: { label: "Indicateur", bg: "#fef3c7", color: "#92400e" },
};

// ─── Calibration de l'importance par comparaison ─────────────────────────────
// Plutôt que de demander une importance dans l'abstrait, on pose des comparaisons
// deux à deux — plus faciles à juger. STRICTEMENT ORDINAL : on compte des
// victoires, on en tire un CLASSEMENT, puis on le reprojette sur les quatre
// niveaux d'importance. Aucune valeur cardinale n'est produite ni stockée : la
// thèse (ch. IV §3.3) pose que les préférences entre critères s'expriment sur la
// même échelle qualitative que les impacts, et met en garde (p.81) contre la
// conversion d'une pondération qualitative en échelle quantitative.
// Deux critères à égalité de victoires reçoivent la même importance.
function ImportanceCalibrator({ criteria, onApply, onClose }: {
  criteria: AtelierCriterion[];
  onApply: (importanceById: Record<string, ImportanceBadge>) => void;
  onClose: () => void;
}) {
  const pairs = useMemo(() => {
    const out: Array<[number, number]> = [];
    for (let a = 0; a < criteria.length; a++)
      for (let b = a + 1; b < criteria.length; b++) out.push([a, b]);
    return out;
  }, [criteria]);

  const [idx, setIdx] = useState(0);
  // score[i] : 1 victoire, 0.5 en cas d'égalité — sert uniquement à ordonner.
  const [scores, setScores] = useState<number[]>(() => criteria.map(() => 0));

  function answer(winner: "a" | "b" | "egal") {
    const [a, b] = pairs[idx];
    setScores(prev => {
      const next = [...prev];
      if (winner === "a") next[a] += 1;
      else if (winner === "b") next[b] += 1;
      else { next[a] += 0.5; next[b] += 0.5; }
      return next;
    });
    setIdx(i => i + 1);
  }

  const done = idx >= pairs.length;

  // Reprojection du classement sur les quatre niveaux ordinaux. Le maximum reçoit
  // toujours « Essentiel » — sinon le modèle n'aurait aucun objectif de tête.
  const proposed = useMemo(() => {
    if (!done) return {} as Record<string, ImportanceBadge>;
    const maxS = Math.max(...scores, 0);
    const out: Record<string, ImportanceBadge> = {};
    criteria.forEach((c, i) => {
      const s = scores[i];
      out[c.id] = maxS === 0 || s === maxS ? "Essentiel"
        : s >= maxS * 0.6 ? "Important"
        : s >= maxS * 0.3 ? "Secondaire" : "Faible";
    });
    return out;
  }, [done, scores, criteria]);

  if (!pairs.length) return null;

  const IMP_COLOR: Record<ImportanceBadge, string> = {
    Essentiel: "#6750a4", Important: "#1e40af", Secondaire: "#92400e", Faible: "var(--v4-text3)",
  };

  return (
    <div style={{ marginTop: 10, padding: "14px 16px", borderRadius: 8, border: "1.5px solid #6366f140", background: "#6366f106" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: "#6366f1" }}>⇄ Calibrer l'importance</span>
        <span style={{ fontSize: 12, color: "var(--v4-text3)", marginLeft: "auto" }}>
          {done ? "Terminé" : `${idx + 1} / ${pairs.length}`}
        </span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, fontFamily: "inherit" }}>✕</button>
      </div>

      {/* Progression */}
      <div style={{ height: 3, borderRadius: 6, background: "var(--v4-border)", marginBottom: 12, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${(Math.min(idx, pairs.length) / pairs.length) * 100}%`, background: "#6366f1", transition: "width .2s" }} />
      </div>

      {!done ? (
        <>
          <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 12 }}>
            Si vous ne pouviez en satisfaire qu'un seul, lequel compterait le plus ?
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "stretch", flexWrap: "wrap" }}>
            {(["a", "b"] as const).map(side => {
              const c = criteria[pairs[idx][side === "a" ? 0 : 1]];
              return (
                <button key={side} onClick={() => answer(side)}
                  style={{ flex: "1 1 200px", textAlign: "left", padding: "11px 13px", borderRadius: 8, cursor: "pointer",
                    border: "1.5px solid var(--v4-border)", background: "var(--v4-bg)", fontFamily: "inherit" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", lineHeight: 1.35 }}>{c.label}</div>
                  {c.description && <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 3, lineHeight: 1.4 }}>{c.description.slice(0, 90)}</div>}
                </button>
              );
            })}
          </div>
          <button onClick={() => answer("egal")}
            style={{ marginTop: 8, padding: "5px 12px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            Les deux comptent autant
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 8, lineHeight: 1.5 }}>
            Voici l'importance qui découle de vos réponses. Elle reste qualitative — aucun score n'a été calculé.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 11 }}>
            {criteria.map((c, i) => ({ c, s: scores[i] })).sort((x, y) => y.s - x.s).map(({ c }) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13 }}>
                <span style={{ fontSize: 12, fontWeight: 800, padding: "1px 7px", borderRadius: 6, color: "#fff", background: IMP_COLOR[proposed[c.id]], flexShrink: 0 }}>
                  {proposed[c.id]}
                </span>
                <span style={{ color: "var(--v4-text2)" }}>{c.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 7 }}>
            <button onClick={() => onApply(proposed)}
              style={{ padding: "7px 15px", borderRadius: 8, border: "none", background: "#6366f1", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Appliquer
            </button>
            <button onClick={() => { setScores(criteria.map(() => 0)); setIdx(0); }}
              style={{ padding: "7px 13px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Recommencer
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const IMP_TO_POIDS: Record<ImportanceBadge, number> = { Essentiel: 40, Important: 25, Secondaire: 15, Faible: 8 };

const IMP_PILLS: { badge: ImportanceBadge; label: string; color: string; bg: string; border: string }[] = [
  { badge: "Faible",     label: "Faible",     color: "#6b7280", bg: "#f3f4f6", border: "#d1d5db" },
  { badge: "Secondaire", label: "Secondaire", color: "#d97706", bg: "#fef3c7", border: "#fcd34d" },
  { badge: "Important",  label: "Important",  color: "#059669", bg: "#d1fae5", border: "#6ee7b7" },
  { badge: "Essentiel",  label: "Essentiel",  color: "#6750a4", bg: "#ede9fe", border: "#c4b5fd" },
];

// Vocabulary: depth 0 = "Objectif", depth 1 = "Critère", depth 2 = "Indicateur"
const DEPTH_META = [
  { label: "Objectif",    color: "#6750a4", bg: "#ede9fe", childLabel: "+ Critère",    childHint: "Ajouter un critère sous cet objectif" },
  { label: "Critère",     color: "#0369a1", bg: "#e0f2fe", childLabel: "+ Indicateur", childHint: "Ajouter un indicateur sous ce critère" },
  { label: "Indicateur",  color: "#059669", bg: "#d1fae5", childLabel: "",             childHint: "" },
];

const EXPERT_LABELS: Record<number, { label: string }> = {
  0: { label: "Objectif stratégique" },
  1: { label: "Dimension de performance" },
  2: { label: "Facteur observable" },
};

function CriterionNode({
  c, depth, onSetOrdinal, onUpdateLabel, onUpdateDesc, onRemove, onAddChild, expertMode = false,
}: {
  c: AtelierCriterion; depth: number;
  onSetOrdinal: (id: string, key: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateDesc: (id: string, desc: string) => void;
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
  expertMode?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [showOrigin, setShowOrigin] = useState(false);
  const meta = DEPTH_META[Math.min(depth, 2)];
  const hasChildren = !!c.children?.length;

  return (
    <div style={{ position: "relative", marginBottom: depth === 0 ? 10 : 0 }}>
      {depth > 0 && (
        <div style={{ position: "absolute", left: -16, top: 0, bottom: 0, width: 1, background: `${meta.color}40` }} />
      )}
      <div style={{
        marginLeft: depth * 20,
        borderRadius: 8,
        background: depth === 0 ? "var(--v4-bg)" : depth === 1 ? "var(--v4-surface)" : "var(--v4-bg)",
        border: `1px solid ${meta.color}30`,
        borderLeft: depth > 0 ? `3px solid ${meta.color}60` : `1px solid ${meta.color}30`,
        marginTop: depth > 0 ? 4 : 0,
      }}>
        {/* Header row: collapse toggle + badge + label + actions */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 6, padding: "9px 10px 4px" }}>
          {/* Collapse toggle */}
          {hasChildren ? (
            <button onClick={() => setCollapsed(v => !v)}
              style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: meta.color, fontSize: 13, padding: "1px 3px", fontFamily: "inherit", marginTop: 2, lineHeight: 1, opacity: 0.75 }}>
              {collapsed ? "▶" : "▼"}
            </button>
          ) : (
            <span style={{ width: 16, flexShrink: 0 }} />
          )}
          {/* Level badge */}
          <span style={{
            flexShrink: 0, marginTop: 2,
            fontSize: 12, fontWeight: 800, padding: "2px 6px", borderRadius: 6,
            background: meta.bg, color: meta.color, letterSpacing: ".04em", textTransform: "uppercase",
          }}>
            {meta.label}
          </span>
          {/* Expert label */}
          {expertMode && depth <= 2 && EXPERT_LABELS[depth] && (
            <span
              style={{ flexShrink: 0, marginTop: 1, fontSize: 12, fontWeight: 600, padding: "2px 7px", borderRadius: 6,
                background: depth === 0 ? "#6750a410" : depth === 1 ? "#0369a110" : "#05966910",
                color: depth === 0 ? "#6750a4" : depth === 1 ? "#0369a1" : "#059669",
                border: `1px solid ${depth === 0 ? "#6750a430" : depth === 1 ? "#0369a130" : "#05966930"}`,
                fontFamily: "inherit", letterSpacing: ".01em", whiteSpace: "nowrap" }}>
              {EXPERT_LABELS[depth].label}
            </span>
          )}
          {/* Label — editable */}
          <div contentEditable suppressContentEditableWarning
            onBlur={e => onUpdateLabel(c.id, e.currentTarget.textContent ?? c.label)}
            style={{ flex: 1, fontSize: depth === 0 ? 13 : 13, fontWeight: depth === 0 ? 700 : 600, color: "var(--v4-text)", outline: "none", lineHeight: 1.4 }}>
            {c.label}
          </div>
          {/* Add child */}
          {depth < 2 && meta.childLabel && (
            <button onClick={() => { onAddChild(c.id); setCollapsed(false); }} title={meta.childHint}
              style={{ flexShrink: 0, background: "transparent", border: `1px dashed ${meta.color}50`, cursor: "pointer", color: meta.color, fontSize: 12, padding: "2px 7px", borderRadius: 6, fontFamily: "inherit", whiteSpace: "nowrap", fontWeight: 600, marginTop: 2 }}>
              {meta.childLabel}
            </button>
          )}
          {/* Origine (besoin tracé) — révélée sur clic uniquement */}
          {depth === 0 && c.besoinTrace && (
            <button onClick={() => setShowOrigin(v => !v)} title="Voir l'origine de cette suggestion"
              style={{ flexShrink: 0, background: showOrigin ? "#6366f118" : "none", border: `1px solid ${showOrigin ? "#6366f150" : "transparent"}`, cursor: "pointer", color: "#6366f1", fontSize: 13, padding: "1px 6px", borderRadius: 8, fontFamily: "inherit", marginTop: 1, fontWeight: 700 }}>
              ⓘ
            </button>
          )}
          {/* Axe couvert par l'objectif — affiché seulement pour coût/risque (l'efficacité est le cas courant) */}
          {depth === 0 && (c.nature === "cout" || c.nature === "risque") && (
            <span title={c.nature === "cout" ? "Objectif de coût — ce que la solution consomme" : "Objectif de risque — ce que la solution menace"}
              style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, letterSpacing: ".03em", padding: "1px 6px", borderRadius: 8, marginTop: 2,
                background: c.nature === "cout" ? "#b4530912" : "#dc262612",
                color: c.nature === "cout" ? "#b45309" : "#dc2626",
                border: `1px solid ${c.nature === "cout" ? "#b4530930" : "#dc262630"}` }}>
              {c.nature === "cout" ? "coût" : "risque"}
            </span>
          )}
          {/* Indicateur exploratoire — TPM marqué comme piste à confirmer */}
          {depth === 2 && c.exploratoire && <LampBadge compact />}
          {/* Indicateur modélisable — rare, signale qu'un vrai modèle pourrait remplacer le jugement qualitatif */}
          {depth === 2 && c.modelisable && (
            <span title="Un modèle de comportement pourrait calculer cette valeur — en attendant, Aura l'évalue qualitativement" style={{ flexShrink: 0, fontSize: 12, color: "#0369a1", background: "#0369a112", border: "1px solid #0369a130", borderRadius: 8, padding: "1px 6px", fontWeight: 700, marginTop: 1 }}>
               modélisable
            </span>
          )}
          {/* Remove */}
          <button onClick={() => onRemove(c.id)}
            style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: "0 2px", fontFamily: "inherit", opacity: 0.35, marginTop: 1 }}>✕</button>
        </div>
        {depth === 0 && showOrigin && c.besoinTrace && (
          <div style={{ margin: "0 10px 8px", marginLeft: 54, padding: "7px 10px", borderRadius: 8, background: "#6366f108", border: "1px solid #6366f125", fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5, display: "flex", justifyContent: "space-between", gap: 12 }}>
            <span><strong style={{ color: "#6366f1" }}>↖ Besoin tracé — </strong><em>{c.besoinTrace}</em></span>
            <button onClick={() => setShowOrigin(false)} style={{ flexShrink: 0, background: "none", border: "none", cursor: "pointer", color: "#6366f1", fontSize: 13, fontFamily: "inherit", opacity: 0.6 }}>✕</button>
          </div>
        )}
        {/* Expandable body: description + importance */}
        {!collapsed && (
          <>
            <div style={{ padding: "0 10px 6px", marginLeft: 54 }}>
              <div contentEditable suppressContentEditableWarning
                onBlur={e => onUpdateDesc(c.id, e.currentTarget.textContent ?? c.description)}
                style={{ fontSize: 13, color: "var(--v4-text3)", outline: "none", lineHeight: 1.5, fontStyle: !c.description ? "italic" : "normal" }}>
                {c.description || "Ce que ce niveau mesure…"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px 8px", marginLeft: 50 }}>
              <span style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600 }}>Poids :</span>
              {IMP_PILLS.map(p => {
                const isActive = p.badge === c.importance;
                return (
                  <button key={p.badge}
                    onClick={() => onSetOrdinal(c.id, importanceToOrdKey(p.badge as ImportanceBadge))}
                    style={{
                      padding: "2px 8px", borderRadius: 6, cursor: "pointer", fontFamily: "inherit",
                      fontSize: 12, fontWeight: 700, border: `1px solid ${isActive ? p.border : "var(--v4-border)"}`,
                      background: isActive ? p.bg : "transparent",
                      color: isActive ? p.color : "var(--v4-text3)",
                      transition: "all .1s",
                    }}>
                    {p.label}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {/* Summary when collapsed + has children */}
        {collapsed && hasChildren && (
          <div style={{ padding: "2px 10px 7px", marginLeft: 54, fontSize: 13, color: meta.color, opacity: 0.7 }}>
            {c.children!.length} sous-élément{c.children!.length > 1 ? "s" : ""} — cliquer ▶ pour déplier
          </div>
        )}
      </div>
      {/* Children */}
      {hasChildren && !collapsed && (
        <div style={{ marginLeft: depth * 20 + 12, paddingLeft: 8, borderLeft: `1px solid ${meta.color}30`, marginTop: 2 }}>
          {c.children!.map(child => (
            <CriterionNode key={child.id} c={child} depth={depth + 1}
              onSetOrdinal={onSetOrdinal} onUpdateLabel={onUpdateLabel} onUpdateDesc={onUpdateDesc}
              onRemove={onRemove} onAddChild={onAddChild} expertMode={expertMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function CriteriaTree({ criteria, onSetOrdinal, onUpdateLabel, onUpdateDesc, onRemove, onAddChild, expertMode = false }: {
  criteria: AtelierCriterion[];
  onSetOrdinal: (id: string, key: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateDesc: (id: string, desc: string) => void;
  onRemove: (id: string) => void;
  onAddChild: (parentId: string) => void;
  expertMode?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {criteria.map(c => (
        <CriterionNode key={c.id} c={c} depth={0}
          onSetOrdinal={onSetOrdinal} onUpdateLabel={onUpdateLabel} onUpdateDesc={onUpdateDesc}
          onRemove={onRemove} onAddChild={onAddChild} expertMode={expertMode} />
      ))}
    </div>
  );
}

// ─── Criteria Objective Tree (mindmap view) ───────────────────────────────────
const OBJ_COLORS = ["#6750a4", "#0369a1", "#b45309", "#0891b2", "#15803d"];
const IMP_DOT: Record<string, string> = { Essentiel: "#6750a4", Important: "#0369a1", Secondaire: "#b45309", Faible: "#94a3b8" };

// Compact importance selector used inside the mindmap cards
const IMP_SEQ: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
const IMP_ORDKEY: Record<ImportanceBadge, string> = { Faible: "N", Secondaire: "L", Important: "M", Essentiel: "H" };

function MiniImpSelector({ value, color, onChange }: { value: ImportanceBadge; color: string; onChange: (b: ImportanceBadge) => void }) {
  return (
    <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
      {IMP_SEQ.map(b => {
        const active = b === value;
        return (
          <button key={b} onClick={() => onChange(b)}
            title={b}
            style={{
              flex: 1, height: 4, borderRadius: 6, border: "none", cursor: "pointer", padding: 0,
              background: active ? color : `${color}22`,
              transition: "all .12s",
            }} />
        );
      })}
    </div>
  );
}

function CriteriaObjectiveTree({ session, onAddChild, onRemove, onSetOrdinal, onUpdateLabel }: {
  session: AtelierSession;
  onAddChild: (parentId: string) => void;
  onRemove: (id: string) => void;
  onSetOrdinal: (id: string, key: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
}) {
  const topLevel = session.criteria;
  const leviers = session.leviersDef ?? [];
  const objective = session.title || "Objectif décisionnel";
  const totalCols = Math.max(topLevel.length, leviers.length, 1);
  const barWidth = `${Math.min(totalCols * 190, 960)}px`;

  return (
    <div style={{ overflowX: "auto", paddingBottom: 8 }}>

      {/* ── Objective node ── */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 0 }}>
        <div style={{
          background: "transparent",
          color: "var(--v4-text)", borderRadius: 0, padding: "4px 4px 8px",
          fontSize: 15, fontWeight: 700, maxWidth: 420, textAlign: "center",
          boxShadow: "none",
        }}>
          {objective}
        </div>
      </div>

      {/* ── Vertical stem → horizontal bar → criteria columns ── */}
      {topLevel.length > 0 && <>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div style={{ width: 2, height: 14, background: "var(--v4-border)" }} />
        </div>
        {topLevel.length > 1 && (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ height: 2, background: "var(--v4-border)", width: barWidth, maxWidth: "100%" }} />
          </div>
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-start" }}>
          {topLevel.map((crit, idx) => {
            const color = OBJ_COLORS[idx % OBJ_COLORS.length];
            const leaves = crit.children?.length ? crit.children : [];
            const poidsPct = Math.min(100, Math.max(0, crit.poids ?? 20));
            return (
              <div key={crit.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 130, maxWidth: 170 }}>
                <div style={{ width: 2, height: 14, background: color, opacity: 0.35 }} />
                {/* Criterion card */}
                <div style={{
                  borderTop: `2px solid ${color}`, borderLeft: "1px solid var(--v4-border)", borderRight: "1px solid var(--v4-border)", borderBottom: "1px solid var(--v4-border)", borderRadius: 6, padding: "8px 10px 6px",
                  background: "var(--v4-surface)", width: "100%", boxSizing: "border-box",
                  boxShadow: "none",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 5 }}>
                    <div
                      contentEditable suppressContentEditableWarning
                      onBlur={e => onUpdateLabel(crit.id, e.currentTarget.textContent ?? crit.label)}
                      style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--v4-text)", lineHeight: 1.3, outline: "none", cursor: "text" }}>
                      {crit.label}
                    </div>
                    <button onClick={() => onRemove(crit.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: 0, opacity: 0.4, lineHeight: 1, flexShrink: 0 }}>✕</button>
                  </div>
                  {/* Importance selector (mini bar) */}
                  <MiniImpSelector value={crit.importance} color={color}
                    onChange={b => onSetOrdinal(crit.id, IMP_ORDKEY[b])} />
                  {/* Weight bar + label */}
                  <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 5 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 6, background: `${color}20`, overflow: "hidden" }}>
                      <div style={{ width: `${poidsPct}%`, height: "100%", background: color, borderRadius: 6, transition: "width .2s" }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color, minWidth: 22, textAlign: "right" }}>{crit.importance.slice(0, 3)}</span>
                  </div>
                </div>
                {/* MOP + TPM levels */}
                {leaves.length > 0 && <div style={{ width: 2, height: 8, background: color, opacity: 0.28 }} />}
                {leaves.length > 0 && (
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                    {leaves.map(leaf => {
                      const tpms = leaf.children?.length ? leaf.children : [];
                      return (
                      <div key={leaf.id} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 1, height: 5, background: color, opacity: 0.22 }} />
                        {/* MOP card */}
                        <div style={{
                          width: "100%", boxSizing: "border-box",
                          border: `1.5px solid ${color}55`, borderRadius: 8,
                          padding: "5px 8px", background: "var(--v4-bg)",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                            <div style={{ width: 5, height: 5, borderRadius: "50%", background: IMP_DOT[leaf.importance] ?? color, flexShrink: 0 }} />
                            <div
                              contentEditable suppressContentEditableWarning
                              onBlur={e => onUpdateLabel(leaf.id, e.currentTarget.textContent ?? leaf.label)}
                              style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", flex: 1, lineHeight: 1.3, outline: "none", cursor: "text" }}>
                              {leaf.label}
                            </div>
                            <button onClick={() => onRemove(leaf.id)}
                              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 12, padding: 0, opacity: 0.35, lineHeight: 1, flexShrink: 0 }}>✕</button>
                          </div>
                          <MiniImpSelector value={leaf.importance} color={color}
                            onChange={b => onSetOrdinal(leaf.id, IMP_ORDKEY[b])} />
                        </div>
                        {/* TPM sub-level */}
                        {tpms.length > 0 && (
                          <div style={{ width: "calc(100% - 8px)", marginLeft: 8, display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                            {tpms.map(tpm => (
                              <div key={tpm.id} style={{ display: "flex", alignItems: "center" }}>
                                <div style={{ width: 1, height: "100%", minHeight: 14, background: `${color}30`, marginRight: 4, flexShrink: 0 }} />
                                <div style={{
                                  flex: 1, boxSizing: "border-box",
                                  border: `1px dashed ${color}30`, borderRadius: 6,
                                  padding: "3px 6px", background: "var(--v4-surface)",
                                  display: "flex", alignItems: "center", gap: 4,
                                }}>
                                  <div style={{ width: 4, height: 4, borderRadius: "50%", background: `${color}60`, flexShrink: 0 }} />
                                  <div
                                    contentEditable suppressContentEditableWarning
                                    onBlur={e => onUpdateLabel(tpm.id, e.currentTarget.textContent ?? tpm.label)}
                                    style={{ fontSize: 12, color: "var(--v4-text3)", flex: 1, lineHeight: 1.3, outline: "none", cursor: "text" }}>
                                    {tpm.label}
                                  </div>
                                  <button onClick={() => onRemove(tpm.id)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 12, padding: 0, opacity: 0.3, lineHeight: 1, flexShrink: 0 }}>✕</button>
                                </div>
                              </div>
                            ))}
                            <button onClick={() => onAddChild(leaf.id)}
                              style={{ marginTop: 1, fontSize: 12, padding: "1px 5px", borderRadius: 6, border: `1px dashed ${color}40`, background: "transparent", color, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>
                              + Indicateur
                            </button>
                          </div>
                        )}
                      </div>
                      );
                    })}
                    <button onClick={() => onAddChild(crit.id)}
                      style={{ marginTop: 1, fontSize: 12, padding: "2px 7px", borderRadius: 6, border: `1px dashed ${color}55`, background: "transparent", color, cursor: "pointer", fontFamily: "inherit", alignSelf: "flex-start" }}>
                      + Indicateur
                    </button>
                  </div>
                )}
                {leaves.length === 0 && (
                  <button onClick={() => onAddChild(crit.id)}
                    style={{ marginTop: 5, fontSize: 12, padding: "2px 7px", borderRadius: 6, border: `1px dashed ${color}55`, background: "transparent", color, cursor: "pointer", fontFamily: "inherit" }}>
                    + Indicateur
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </>}

    </div>
  );
}

// ─── Case type definitions ────────────────────────────────────────────────────
const PESTEL_DIMENSION_LABEL: Record<string, string> = { P: "Politique", E: "Économique", S: "Social", T: "Technologique", En: "Environnemental", L: "Légal" };
// ─── ContextMirror panel ──────────────────────────────────────────────────────
/** Statut d'un champ du recueil : confirmé (question dépassée), déduit (pas encore validé), ou inconnu. */
type MirrorFieldStatus = "confirmed" | "deduced" | "unknown";
function fieldStatus(value: string, stepIdx: number, activeStep: number): MirrorFieldStatus {
  if (!value.trim()) return "unknown";
  return stepIdx < activeStep ? "confirmed" : "deduced";
}
const MIRROR_STATUS_STYLE: Record<MirrorFieldStatus, { dot: string; label: string }> = {
  confirmed: { dot: "#059669", label: "Confirmé" },
  deduced: { dot: "#6b4cff", label: "Déduit par Aura — à confirmer" },
  unknown: { dot: "#9ca3af", label: "Encore inconnu" },
};
function MirrorRow({ label, value, status }: { label: string; value: string; status: MirrorFieldStatus }) {
  const s = MIRROR_STATUS_STYLE[status];
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</span>
        {status !== "unknown" && <span style={{ fontSize: 12, color: s.dot, fontWeight: 700, marginLeft: "auto" }}>{s.label}</span>}
      </div>
      <div style={{ fontSize: 12.5, color: status === "unknown" ? "var(--v4-text3)" : "var(--v4-text2)", lineHeight: 1.5, fontStyle: status === "unknown" ? "italic" : "normal", paddingLeft: 13 }}>
        {status === "unknown" ? "—" : value}
      </div>
    </div>
  );
}
interface ContextMirrorProps {
  context: string;
  objectif: string;
  exigences: string;
  leviers: string;
  risques: string[];
  caseType?: string;
  sector?: string;
  decideurs?: string;
  impactes?: string;
  /** Facteurs de contexte non maîtrisables (DIP) — reflet brut, jamais reformulé. */
  contraintes?: string;
  /** Dimensions PESTEL effectivement répondues (libellé → réponse). */
  pestelAnswered?: { label: string; answer: string }[];
  /** Questions discriminantes déjà répondues (question → libellé du choix). */
  discriminatingAnswered?: { question: string; answer: string }[];
  /** Étape active du recueil — pilote l'état confirmé/déduit de chaque catégorie. */
  activeStep?: number;
}
function ContextMirror({ context, objectif, exigences, leviers, risques, caseType, sector, decideurs, impactes, contraintes, pestelAnswered = [], discriminatingAnswered = [], activeStep = 0 }: ContextMirrorProps) {
  const hasAny = context.trim().length > 10 || objectif || exigences || leviers || risques.length > 0
    || Boolean(contraintes?.trim()) || pestelAnswered.length > 0 || discriminatingAnswered.length > 0;
  if (!hasAny) return (
    <div style={{ position: "sticky", top: 20, borderRadius: 8, border: "1.5px solid var(--v4-border)", background: "var(--v4-surface)", padding: "14px 16px", fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>
      ✦ Le miroir s'animera au fil de vos réponses…
    </div>
  );

  const partiesPrenantes = [decideurs, impactes].filter(Boolean).join(" · ");

  // Detect tensions
  const tensions: string[] = [];
  const ctx = (context + " " + objectif).toLowerCase();
  const risquesText = risques.join(" ").toLowerCase();
  if (/budget|coût|économi/.test(ctx) && /performance|qualité|efficac/.test(ctx)) tensions.push("Coût vs Performance");
  if (/vitesse|rapide|urgent|délai/.test(ctx) && /qualité|robuste|fiable/.test(ctx)) tensions.push("Rapidité vs Qualité");
  if (/risque|sécurité/.test(risquesText) && /croissance|expansion|invest/.test(ctx)) tensions.push("Sécurité vs Croissance");
  if (/centrali/.test(ctx) && /autonomi|décentrali/.test(ctx)) tensions.push("Centralisation vs Autonomie");

  const shortCtx = context.trim().length > 80 ? context.trim().slice(0, 80) + "…" : context.trim();
  const exigList = exigences ? splitItemsRespectingParens(exigences) : [];
  const levierList = leviers ? splitItemsRespectingParens(leviers) : [];

  return (
    <div className="aura-understanding" style={{ position: "sticky", top: 20, borderRadius: 8, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="aura-understanding-title" style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".04em" }}>✦ Ce qu’Aura comprend</div>

      {/* Les 6 catégories fixes du recueil — confirmé / déduit / inconnu */}
      <div style={{ display: "flex", flexDirection: "column", gap: 9, paddingBottom: 2, borderBottom: "1px dashed var(--v4-border)" }}>
        <MirrorRow label="Objectif" value={objectif} status={fieldStatus(objectif, 2, activeStep)} />
        <MirrorRow label="Contexte" value={shortCtx} status={fieldStatus(context, 1, activeStep)} />
        <MirrorRow label="Contraintes" value={exigences} status={fieldStatus(exigences, 3, activeStep)} />
        <MirrorRow label="Parties prenantes" value={partiesPrenantes} status={fieldStatus(partiesPrenantes, 3, activeStep)} />
        <MirrorRow label="Leviers" value={leviers} status={fieldStatus(leviers, 4, activeStep)} />
        <MirrorRow label="Facteurs externes" value={contraintes ?? ""} status={fieldStatus(contraintes ?? "", 4, activeStep)} />
      </div>

      {shortCtx && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Décision perçue</div>
          <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5, fontStyle: "italic" }}>"{shortCtx}"</div>
          {(caseType || sector) && (
            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {caseType && <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "var(--v4-accent-bg)", color: "var(--v4-accent)", fontWeight: 700 }}>{CASE_TYPES.find(c => c.id === caseType)?.label ?? caseType}</span>}
              {sector && <span style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "var(--v4-border)", color: "var(--v4-text2)" }}>{sector}</span>}
            </div>
          )}
        </div>
      )}

      {(decideurs || impactes) && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Qui est concerné, et pourquoi</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {decideurs && <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5 }}> <strong>{decideurs}</strong> tranche — c'est leur choix qui engage la suite.</div>}
            {impactes && <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5 }}> <strong>{impactes}</strong> vit le résultat au quotidien.</div>}
          </div>
        </div>
      )}


      {tensions.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Tensions détectées</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {tensions.map(t => <div key={t} style={{ fontSize: 13, color: "var(--v4-text2)", display: "flex", alignItems: "center", gap: 5 }}><span style={{ color: "var(--v4-accent)" }}></span>{t}</div>)}
          </div>
        </div>
      )}

      {exigList.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Exigences clés</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {exigList.map(e => <span key={e} style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "#fee2e230", border: "1px solid #dc262640", color: "#dc2626", fontWeight: 600 }}>{e}</span>)}
          </div>
        </div>
      )}

      {levierList.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Leviers identifiés</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {levierList.map(l => <span key={l} style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "#d1fae530", border: "1px solid #10b98140", color: "#059669", fontWeight: 600 }}>{l}</span>)}
          </div>
        </div>
      )}

      {contraintes?.trim() && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Contraintes de contexte</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {splitItemsRespectingParens(contraintes).map(c => <span key={c} style={{ fontSize: 12, padding: "2px 7px", borderRadius: 8, background: "#f3f4f630", border: "1px solid var(--v4-border)", color: "var(--v4-text2)", fontWeight: 600 }}>{c}</span>)}
          </div>
        </div>
      )}

      {discriminatingAnswered.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Précisions données</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {discriminatingAnswered.map(d => (
              <div key={d.question} style={{ fontSize: 12.5, color: "var(--v4-text2)", lineHeight: 1.45 }}>
                <span style={{ color: "var(--v4-text3)" }}><Q>{d.question}</Q></span> → <strong>{d.answer}</strong>
              </div>
            ))}
          </div>
        </div>
      )}

      {pestelAnswered.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 4 }}>Contexte externe (PESTEL)</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {pestelAnswered.map(p => (
              <div key={p.label} style={{ fontSize: 12.5, color: "var(--v4-text2)", lineHeight: 1.45 }}>
                <strong>{p.label}</strong> : {p.answer}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Elicitation Flow (5-step cascade / tiroir effect) ───────────────────────

// ── Glyphe ordinal ▁▃▅▇ ──────────────────────────────────────────────────────
// Signature graphique d'Aura : partout où un niveau Aucune/Faible/Modérée/Élevée
// s'écrit, il se DESSINE aussi — 4 crans, le niveau atteint est plein.
function OrdGlyph({ v, color = "#6b7280", size = 12 }: { v: OrdinalLevel; color?: string; size?: number }) {
  const w = size * 0.28, gap = size * 0.12;
  return (
    <svg width={(w + gap) * 4} height={size} style={{ verticalAlign: "middle", flexShrink: 0 }} aria-label={["Aucune", "Faible", "Modérée", "Élevée"][v]}>
      {[0, 1, 2, 3].map(i => {
        const h = size * (0.25 + i * 0.25);
        return <rect key={i} x={i * (w + gap)} y={size - h} width={w} height={h} rx={1}
          fill={i < v ? color : "none"} stroke={color} strokeWidth={0.8} opacity={i < v ? 1 : 0.35}
          style={{ transition: "fill .25s ease, stroke .25s ease, opacity .25s ease" }} />;
      })}
    </svg>
  );
}

//  Piste inattendue : l'option latérale de la Phase Exploration, éclairée
// comme une lampe — c'est l'effet « on n'y avait pas pensé » d'Aura.
function LampBadge({ compact = false }: { compact?: boolean }) {
  // Lampe : option ou indicateur inspirant / innovant proposé par Aura (ambre doux).
  return (
    <span data-testid="lampe-inspirante" role="img" aria-label="Option inspirante / innovante" title="Option inspirante / innovante — piste inattendue proposée par Aura, crédible, à explorer" style={{
      display: "inline-flex", alignItems: "center", gap: 3, fontSize: compact ? 13 : 12, fontWeight: 700,
      padding: compact ? "1px 4px" : "1px 7px", borderRadius: 6, flexShrink: 0, lineHeight: 1.2,
      color: "#b45309", background: "#fef3c7", border: "1px solid #fcd34d", boxShadow: "0 0 6px #f59e0b33",
    }}><Lightbulb size={compact ? 11 : 12} strokeWidth={2.2} aria-hidden="true" />{compact ? "" : " Piste inspirante"}</span>
  );
}

// Zones de texte du questionnaire Comprendre : hauteur qui suit le contenu —
// un texte pré-rempli par import de document (potentiellement long) ne doit
// jamais rester coincé dans une boîte à défilement de 2 lignes.
function autoGrowTextarea(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// Découpe un texte en éléments distincts sur virgule/point-virgule/point,
// mais JAMAIS à l'intérieur d'une parenthèse — une syntehèse Aura du type
// "Les overrides manuels (prix, prévisions) doivent être tracés." ne doit
// pas se retrouver coupée en deux puces "...(prix" / "prévisions)...".
function splitItemsRespectingParens(text: string): string[] {
  const items: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (depth === 0 && (c === "," || c === ";" || (c === "." && (i === text.length - 1 || text[i + 1] === " ")))) {
      items.push(text.slice(start, i));
      start = i + 1;
    }
  }
  items.push(text.slice(start));
  return items.map(s => s.trim()).filter(Boolean);
}

// ── Dictée vocale ────────────────────────────────────────────────────────────
// « Racontez votre décision » : le décideur parle, Aura transcrit et dépose le
// texte dans le champ. Transcription serveur (passerelle IA) → fonctionne sur
// tous les navigateurs, y compris Safari et Firefox.
function VoiceDictationButton({
  onTranscript,
  label = "Dicter",
  contextPrompt,
  question,
}: {
  onTranscript: (text: string) => void;
  label?: string;
  contextPrompt?: string;
  /** Question lue à voix haute par Aura avant la dictée. */
  question?: string;
}) {
  return (
    <VoiceInput
      compact
      label={label}
      question={question}
      confirm
      onText={onTranscript}
      contextPrompt={contextPrompt ?? "Décision d'entreprise, vocabulaire métier : critères, leviers, parties prenantes, scénarios, ROI, supply chain."}
    />
  );
}


// Divergence = une réponse déjà donnée que le brief relu ou un document
// contredit. Jamais résolue toute seule : affichée, subtile (repliée par
// défaut), tranchée par l'utilisateur (garder / utiliser la proposition), et
// la décision reste tracée dans elicitation.resolutions — jamais un
// écrasement silencieux. Même mécanisme que Cadrer (Architecturer).
// Note : la bannière "divergences" (proposer une valeur concurrente à
// trancher champ par champ) a été retirée — une nouvelle information (LLM,
// import de document) applique désormais directement sa valeur si le champ
// est vide, et ne touche jamais un champ déjà rempli par l'utilisateur.

function ElicitationFlow({ session, onUpdate, onGenerate, generating, openCompanionSignal = 0, embeddedSuggestions, embeddedDomainExpertise }: {
  session: AtelierSession;
  onUpdate: (patch: Partial<AtelierSession>) => void;
  onGenerate: () => void;
  generating: boolean;
  /** Incrémenté par la page hôte (vue Schéma) pour ouvrir le fil vocal au début. */
  openCompanionSignal?: number;
  /** Voir AtelierPage — suggestions de départ Supply Chain, mode embarqué uniquement. */
  embeddedSuggestions?: string[];
  /** Voir AtelierPage — cadrage expert Supply Chain Resilience, mode embarqué uniquement. */
  embeddedDomainExpertise?: string;
}) {
  const eli = session.elicitation ?? {};
  // Pack sectoriel actif (déduit de session.sector) — restreint les types de
  // décision proposés et propose un point de départ éditable pour le PESTEL.
  // Reste undefined pour toute session hors pack (aucune restriction).
  const activePack = findPackBySector(session.sector);
  // Nouvelle session : on saute l'écran de sélection du type de décision (grille de
  // cases) pour aller droit à la question qui compte — décrire la décision et le
  // résultat recherché. Le type est déduit automatiquement de ce récit (voir "Aura a
  // détecté" plus bas) ; un utilisateur qui revient en arrière peut toujours le
  // corriger explicitement via le bouton Retour.
  // eli.step vaut parfois 5 (marqueur historique « les 5 questions sont terminées »)
  // alors que les index d'étape valides sont 0-4 — sans ce plafond, revenir sur
  // Comprendre depuis une étape ultérieure affiche un panneau vide (aucune étape ne
  // correspond à l'index 5).
  // 3 questions : (1) décision, objectif, résultat, horizon ; (2) exigences,
  // parties prenantes, attitude ; (3) leviers et contraintes. Le type de
  // décision se choisit dans la question 1, les indicateurs et poids sur l'arbre.
  const [activeStep, setActiveStep] = useState<number>(() => { const s0 = Math.min(eli.step ?? 1, 4); return s0 <= 2 ? 1 : s0; });

  // Draft state for current step fields
  const [draftContext, setDraftContext] = useState(session.contextRaw ?? "");
  const [draftObjectif, setDraftObjectif] = useState(eli.objectif ?? "");
  const [draftHorizon, setDraftHorizon] = useState(eli.horizon ?? "");
  const [draftDecideurs, setDraftDecideurs] = useState(eli.decideurs ?? "");
  const [draftImpactes, setDraftImpactes] = useState(eli.impactes ?? "");
  const [draftResistances, setDraftResistances] = useState(eli.resistances ?? "");
  const [draftRisques, setDraftRisques] = useState<string[]>(eli.risques ?? []);
  const [draftPestelSelected, setDraftPestelSelected] = useState<string[]>(
    eli.pestelSelected && eli.pestelSelected.length > 0
      ? eli.pestelSelected
      : Object.keys(activePack?.pestelSeed ?? {}),
  );
  // Seed pack (enjeux structurels connus du secteur) uniquement là où
  // l'utilisateur n'a encore rien écrit — jamais un écrasement d'une réponse
  // déjà donnée, jamais présenté comme une donnée vérifiée.
  const [draftPestelAnswers, setDraftPestelAnswers] = useState<Record<string, string>>(
    eli.pestelAnswers && Object.keys(eli.pestelAnswers).length > 0
      ? eli.pestelAnswers
      : (activePack?.pestelSeed ?? {}),
  );
  const [draftExigencesNonNeg, setDraftExigencesNonNeg] = useState(eli.exigencesNonNeg ?? "");
  const [draftLeviersDDP, setDraftLeviersDDP] = useState(eli.leviersDDP ?? "");
  const [draftContraintesDIP, setDraftContraintesDIP] = useState(eli.contraintesDIP ?? "");

  // ── Divergences ──────────────────────────────────────────────────────────
  // Un document ou une relecture peut proposer une valeur différente de ce que
  // l'utilisateur a déjà répondu. On ne l'écrase jamais en silence : la
  // proposition attend d'être tranchée (gardée ou appliquée), et la décision
  // reste tracée — même logique que Cadrer (Architecturer).
  type ElicitField = { key: "objectif" | "horizon" | "decideurs" | "impactes" | "resistances" | "exigencesNonNeg" | "leviersDDP" | "contraintesDIP"; label: string; current: string; set: (v: string) => void };
  const elicFieldSetters: Record<ElicitField["key"], (v: string) => void> = {
    objectif: setDraftObjectif, horizon: setDraftHorizon, decideurs: setDraftDecideurs, impactes: setDraftImpactes,
    resistances: setDraftResistances, exigencesNonNeg: setDraftExigencesNonNeg, leviersDDP: setDraftLeviersDDP, contraintesDIP: setDraftContraintesDIP,
  };
  const elicFieldCurrent: Record<ElicitField["key"], string> = {
    objectif: draftObjectif, horizon: draftHorizon, decideurs: draftDecideurs, impactes: draftImpactes,
    resistances: draftResistances, exigencesNonNeg: draftExigencesNonNeg, leviersDDP: draftLeviersDDP, contraintesDIP: draftContraintesDIP,
  };
  const ELIC_FIELD_LABELS: Record<ElicitField["key"], string> = {
    objectif: "Objectif", horizon: "Horizon", decideurs: "Décideurs", impactes: "Parties impactées",
    resistances: "Résistances", exigencesNonNeg: "Exigences non négociables", leviersDDP: "Leviers", contraintesDIP: "Facteurs hors contrôle",
  };
  /** Applique une valeur déduite (LLM, import) uniquement si le champ est encore vide —
   *  une réponse déjà donnée par l'utilisateur n'est jamais écrasée en silence. */
  function applyOrConflict(key: ElicitField["key"], value: string | undefined) {
    const v = value?.trim();
    if (!v) return;
    if (!elicFieldCurrent[key].trim()) elicFieldSetters[key](v);
  }

  // Compagnon Aura — la même boucle « question posée / écoutée / reformulée /
  // validée » que partout ailleurs dans Aura, appliquée aux champs de CE
  // questionnaire. Le compagnon n'écrit que dans les champs ci-dessus : aucun
  // chiffre, aucune note, aucun calcul — l'algorithme qualitatif décide seul de
  // ce qu'il fait de ce contexte.
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionStart, setCompanionStart] = useState(0);
  // Ouverture pilotée par la vue Schéma : le fil vocal doit être atteignable
  // depuis l'écran d'entrée, pas seulement depuis la vue Formulaire.
  useEffect(() => {
    if (openCompanionSignal > 0) { setCompanionStart(0); setCompanionOpen(true); }
  }, [openCompanionSignal]);

  // Préconisation IA sur les questions de cadrage : une seule inférence, à la
  // demande, mémorisée — l'utilisateur n'a plus à déclencher quoi que ce soit
  // au préalable pour qu'Aura propose une lecture.
  const precoRef = useRef<Promise<Record<string, string | undefined>> | null>(null);
  const precoFor = async (key: "objectif" | "horizon" | "decideurs" | "impactes" | "resistances" | "exigencesNonNeg" | "leviersDDP" | "contraintesDIP"): Promise<string | null> => {
    const base = draftContext.trim();
    if (base.length < 20) return null;
    if (!precoRef.current) {
      precoRef.current = (async () => {
        try {
          const { inferElicitationFromDescription } = await import("../lib/v4/atelier-llm");
          const r = await inferElicitationFromDescription({ data: { description: base, caseType: session.caseType, domainExpertiseHint: [embeddedDomainExpertise, packExpertContextBlock(session.sector)].filter(Boolean).join("\n\n") } });
          const res = (r.ok && r.result ? r.result : {}) as Record<string, unknown>;
          const flat: Record<string, string | undefined> = {};
          for (const [k, v] of Object.entries(res)) {
            flat[k] = Array.isArray(v) ? v.filter(Boolean).join(", ") : typeof v === "string" ? v : undefined;
          }
          return flat;
        } catch { return {}; }
      })();
    }
    const all = await precoRef.current;
    return (all[key] ?? "").trim() || null;
  };

  // Chaque question porte la sous-étape du cadrage où sa réponse atterrit : le
  // fil vocal et l'anneau de progression avancent ensemble.
  type VoiceStep = CompanionStep & { wizard: number };
  const companionSteps: VoiceStep[] = [
    {
      wizard: 0, group: "Finalité de la décision",
      id: "casetype",
      question: "De quel type de décision s'agit-il ?",
      hint: "Un investissement à arbitrer, une stratégie à définir, un produit ou un système à concevoir, des risques à anticiper.",
      current: CASE_TYPES.find(c => c.id === session.caseType)?.label,
      apply: t => { const id = matchCaseType(t); if (id) onUpdate({ caseType: id }); },
    },
    {
      wizard: 1, group: "De quoi s'agit-il ?",
      id: "contexte",
      question: (QUESTION_BY_CASE[session.caseType ?? ""] ?? QUESTION_BY_CASE._default).question,
      hint: "Racontez la situation comme vous l'expliqueriez à un collègue.",
      current: draftContext,
      apply: t => setDraftContext(prev => { const next = appendDictation(prev, t); setAiInferred(inferFromText(next)); return next; }),
    },
    {
      wizard: 2, group: "Ce que vous voulez atteindre",
      id: "objectif",
      question: OBJECTIF_HINT_BY_CASETYPE[session.caseType ?? ""] ?? "Quel est votre objectif prioritaire et sur quel horizon ?",
      current: draftObjectif,
      apply: t => setDraftObjectif(prev => appendDictation(prev, t)),
      suggest: () => (draftObjectif.trim() ? null : precoFor("objectif")),
      suggestSource: "déduit de votre récit de la situation",
    },
    {
      wizard: 3, group: "Qui est concerné", id: "decideurs", question: "Qui décide, au final ?",
      current: draftDecideurs, apply: t => setDraftDecideurs(prev => appendDictation(prev, t)),
      // Déduction issue du contexte déjà raconté : proposée, jamais imposée.
      // Lecture locale immédiate si elle existe, sinon Aura la calcule ici même.
      suggest: () => draftDecideurs.trim() ? null : ((aiInferred.decideurs ?? []).join(", ") || precoFor("decideurs")),
      suggestSource: "déduit de votre récit de la situation",
    },
    {
      wizard: 3, group: "Qui est concerné", id: "impactes", question: "Qui est impacté par cette décision ?",
      current: draftImpactes, apply: t => setDraftImpactes(prev => appendDictation(prev, t)),
      suggest: () => draftImpactes.trim() ? null : ((aiInferred.impactes ?? []).join(", ") || precoFor("impactes")),
      suggestSource: "déduit de votre récit de la situation",
    },
    {
      wizard: 3, group: "Qui est concerné", id: "resistances", question: "Qui pourrait résister, et pourquoi ?",
      current: draftResistances, apply: t => setDraftResistances(prev => appendDictation(prev, t)),
      suggest: () => draftResistances.trim() ? null : ((aiInferred.resistances ?? []).join(", ") || precoFor("resistances")),
      suggestSource: "déduit de votre récit de la situation",
    },

    {
      wizard: 3, group: "Qui est concerné", id: "exigences", question: "Quelles exigences sont non négociables ?",
      current: draftExigencesNonNeg, apply: t => setDraftExigencesNonNeg(prev => appendDictation(prev, t)),
      suggest: () => (draftExigencesNonNeg.trim() ? null : precoFor("exigencesNonNeg")),
      suggestSource: "déduit de votre récit de la situation",
    },
    {
      wizard: 4, group: "Vos leviers, et ce qui vous échappe", id: "leviers", question: "Sur quoi pouvez-vous réellement agir ?",
      current: draftLeviersDDP, apply: t => setDraftLeviersDDP(prev => appendDictation(prev, t)),
      suggest: () => (draftLeviersDDP.trim() ? null : precoFor("leviersDDP")),
      suggestSource: "déduit de votre récit de la situation",
    },
    {
      wizard: 4, group: "Vos leviers, et ce qui vous échappe", id: "contraintes", question: "Qu'est-ce qui vous échappe, dans le contexte ?",
      current: draftContraintesDIP, apply: t => setDraftContraintesDIP(prev => appendDictation(prev, t)),
      suggest: () => (draftContraintesDIP.trim() ? null : precoFor("contraintesDIP")),
      suggestSource: "déduit de votre récit de la situation",
    },
    { wizard: 4, group: "Vos leviers, et ce qui vous échappe", id: "risques", question: "Quel risque d'exécution vous inquiète le plus ?", optional: true, apply: t => { const v = t.trim(); if (v) setDraftRisques(prev => prev.includes(v) ? prev : [...prev, v]); } },
  ];
  /** Première question du fil rattachée à une sous-étape donnée. */
  const firstStepOfWizard = (w: number) => {
    const i = companionSteps.findIndex(s => s.wizard === w);
    return i < 0 ? null : i;
  };



  const [aiInferred, setAiInferred] = useState<{ caseType?: string; sector?: string; horizon?: string; decideurs?: string[]; impactes?: string[]; resistances?: string[] }>({});

  const [docImporting, setDocImporting] = useState(false);
  const [docImportMsg, setDocImportMsg] = useState<string | null>(null);
  const [docResults, setDocResults] = useState<DocResult[]>([]);
  const [prefilling, setPrefilling] = useState(false);

  // Les zones de texte de ce questionnaire changent de valeur par bien plus de
  // voies qu'une simple frappe (clic sur une suggestion IA, import de document,
  // navigation entre étapes qui remonte le composant) — s'appuyer seulement sur
  // onChange/ref-au-montage laisse des cas non couverts où la hauteur ne suit
  // pas le contenu. Un seul passage après CHAQUE rendu, borné au conteneur de
  // ce flux, est la façon fiable de ne jamais laisser un texte tronqué ou
  // caché derrière une zone trop petite.
  const flowContainerRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    flowContainerRef.current?.querySelectorAll<HTMLTextAreaElement>("textarea").forEach(autoGrowTextarea);
  });

  const isComplete = session.criteria.length > 0 && session.modelValidated;
  const allCollapsed = isComplete;
  // Retour du modèle validé vers les questions (bouton Précédent) : on rouvre sur
  // la dernière question, d'où « ← Précédent » remonte pas à pas, réponses conservées.
  const wasValidated = useRef(!!session.modelValidated);
  useEffect(() => {
    if (wasValidated.current && !session.modelValidated) setActiveStep(4);
    wasValidated.current = !!session.modelValidated;
  }, [session.modelValidated]);

  const HORIZONS = ["< 3 mois", "3–12 mois", "1–3 ans", "> 3 ans"];

  // Suggestions for steps 3-4 based on caseType
  const riskSuggestions = RISK_SUGGESTIONS[session.caseType ?? ""] ?? [];
  const ddpSuggestions = DDP_SUGGESTIONS[session.caseType ?? ""] ?? { ddp: [], dip: [] };
  const stakeholderSuggestions = STAKEHOLDER_SUGGESTIONS[session.caseType ?? ""] ?? { decideurs: [], impactes: [], resistances: [] };

  function canAdvanceStep(step: number): boolean {
    if (step === 0) return true;
    if (step === 1) return draftContext.trim().length > 10 && !!draftObjectif.trim();
    if (step === 2) return !!draftObjectif.trim();
    if (step === 3) return !!draftDecideurs.trim();
    if (step === 4) return true; // risques optional
    return true;
  }

  // L'interview reste courte et générique — pas de sous-questionnaire sectoriel
  // (PESTEL) qui allongerait le parcours pour un cas particulier.
  const hasPestel = false;

  // Anti-redondance : les dimensions externes recouvrent souvent ce qui vient
  // d'être écrit (facteurs non maîtrisables, risques, exigences non
  // négociables, résistances). On ne repose pas la question — la dimension est
  // signalée comme déjà couverte.
  const pestelCovered = ((): Record<string, boolean> => {
    const hay = `${draftContraintesDIP} ${draftExigencesNonNeg} ${draftResistances} ${draftRisques.join(" ")}`.toLowerCase();
    const out: Record<string, boolean> = {};
    for (const [id, rx] of Object.entries(PESTEL_OVERLAP_PATTERNS)) out[id] = hay.trim().length > 5 && rx.test(hay);
    return out;
  })();



  // Réduit le nombre de questions restant à taper : dès que la description est
  // validée, l'IA propose objectif/horizon/décideurs/impactés/leviers/risques —
  // l'utilisateur arrive sur des champs déjà remplis à vérifier, pas vides.
  async function prefillFromDescription(text: string) {
    if (!text.trim() || text.trim().length < 15) return;
    setPrefilling(true);
    try {
      const { inferElicitationFromDescription } = await import("../lib/v4/atelier-llm");
      const r = await inferElicitationFromDescription({ data: { description: text, caseType: session.caseType, domainExpertiseHint: [embeddedDomainExpertise, packExpertContextBlock(session.sector)].filter(Boolean).join("\n\n") } });
      if (!r.ok || !r.result) return;
      const res = r.result;
      applyOrConflict("objectif", res.objectif);
      applyOrConflict("horizon", res.horizon);
      applyOrConflict("decideurs", res.decideurs);
      applyOrConflict("impactes", res.impactes);
      applyOrConflict("resistances", res.resistances);
      applyOrConflict("exigencesNonNeg", res.exigencesNonNeg);
      applyOrConflict("leviersDDP", res.leviersDDP);
      applyOrConflict("contraintesDIP", res.contraintesDIP);
      if (res.risques?.length) setDraftRisques(prev => [...new Set([...prev, ...res.risques!])]);
      if (res.sector) onUpdate({ sector: session.sector ?? res.sector });
    } finally {
      setPrefilling(false);
    }
  }

  function nextStep(step: number) {
    // Save current step data
    let patch: Partial<AtelierSession> = {};
    if (step === 1) {
      // Question 1 = anciennes questions 1 et 2 (décision + objectif et horizon).
      onUpdate({ contextRaw: draftContext, caseType: session.caseType ?? "strategique", elicitation: { ...eli, step: 3, objectif: draftObjectif, horizon: draftHorizon } });
      void prefillFromDescription(draftContext);
      setActiveStep(3);
      return;
    } else if (step === 2) {
      patch = { elicitation: { ...eli, step: 3, objectif: draftObjectif, horizon: draftHorizon } };
    } else if (step === 3) {
      patch = { elicitation: { ...eli, step: 4, decideurs: draftDecideurs, impactes: draftImpactes, resistances: draftResistances, exigencesNonNeg: draftExigencesNonNeg } };
    } else if (step === 4) {
      if (!hasPestel) {
        // Skip PESTEL for non-strategic case types — go straight to generation
        const eliPatch = { ...eli, step: 6, risques: draftRisques, leviersDDP: draftLeviersDDP, contraintesDIP: draftContraintesDIP };
        onUpdate({ elicitation: eliPatch });
        onGenerate();
        return;
      }
      patch = { elicitation: { ...eli, step: 5, risques: draftRisques, leviersDDP: draftLeviersDDP, contraintesDIP: draftContraintesDIP } };
    }
    onUpdate(patch);
    setActiveStep(step + 1);
  }

  // Retour à la question précédente : les réponses de l'écran courant sont
  // enregistrées (sans avancer) pour ne jamais rien perdre en revenant en arrière.
  function prevStep(step: number) {
    if (step <= 1) return;
    if (step === 3) { onUpdate({ elicitation: { ...eli, decideurs: draftDecideurs, impactes: draftImpactes, resistances: draftResistances, exigencesNonNeg: draftExigencesNonNeg, step: 1 } }); setActiveStep(1); return; }
    const draftPatch: Partial<ElicitationData> = step === 1 ? {}
      : step === 2 ? { objectif: draftObjectif, horizon: draftHorizon }
      : step === 3 ? { decideurs: draftDecideurs, impactes: draftImpactes, resistances: draftResistances, exigencesNonNeg: draftExigencesNonNeg }
      : { risques: draftRisques, leviersDDP: draftLeviersDDP, contraintesDIP: draftContraintesDIP };
    onUpdate({ ...(step === 1 ? { contextRaw: draftContext } : {}), elicitation: { ...eli, ...draftPatch, step: step - 1 } });
    setActiveStep(step - 1);
  }
  const prevButton = (step: number) => step > 1 ? (
    <button type="button" data-testid="comprendre-precedent" onClick={() => prevStep(step)}
      style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
      ← Précédent
    </button>
  ) : <span />;

  function collapseLabel(step: number): string {
    if (step === 0) {
      const ct = CASE_TYPES.find(c => c.id === session.caseType);
      return ct ? `${ct.icon} ${ct.label}` : "";
    }
    if (step === 1) {
      const t = session.contextRaw ?? "";
      return t.length > 60 ? t.slice(0, 60) + "…" : t;
    }
    if (step === 2) {
      const obj = eli.objectif ?? "";
      const hor = eli.horizon ?? "";
      return obj ? (hor ? `${obj.slice(0, 40)} · ${hor}` : obj.slice(0, 40)) : "";
    }
    if (step === 3) {
      const dec = eli.decideurs ?? "";
      const imp = eli.impactes ?? "";
      return dec ? (imp ? `${dec} · ${imp}` : dec) : "";
    }
    if (step === 4) {
      const r = eli.risques ?? [];
      return r.length ? r.slice(0, 3).join(", ") + (r.length > 3 ? " + …" : "") : "Aucun risque défini";
    }
    if (step === 5) {
      const sel = eli.pestelSelected ?? [];
      return sel.length ? sel.map(id => PESTEL_DIMS.find(d => d.id === id)?.label ?? id).join(", ") : "Aucune dimension sélectionnée";
    }
    return "";
  }

  // Les 6 questions génériques de l'interview (indépendantes du secteur) —
  // regroupées en écrans courts, une idée à la fois.
  const STEP_TITLES = [
    "Quelle décision devez-vous prendre ?",
    "Quelle décision, et pour quel résultat ?",
    "Quel résultat cherchez-vous à obtenir ?",
    "Qu'est-ce qui ne peut pas être compromis, et qui décide ?",
    "Sur quoi pouvez-vous agir, et qu'est-ce qui vous échappe ?",
  ];
  // Aide affichée sous chaque question et mots clés surlignés (surlignage doux).
  const STEP_HELP = [
    "Choisissez la nature de la décision : Aura adapte ensuite les questions et les critères.",
    "Formulez la décision, l'objectif visé et l'horizon ; Aura en déduit le type de décision et prépare l'arbre des indicateurs.",
    "Précisez le résultat attendu et l'horizon sur lequel il doit être atteint.",
    "Listez les exigences non négociables, les parties prenantes et votre attitude face au risque.",
    "Distinguez les leviers que vous maîtrisez des contraintes du contexte.",
  ];
  const STEP_KEYWORDS: string[][] = [
    ["décision"],
    ["décision", "obtenir"],
    ["résultat", "obtenir"],
    ["ne peut pas être compromis", "qui décide"],
    ["agir", "vous échappe"],
  ];
  const STEP_ICONS = ["", "", "", "", "", ""];
  const totalSteps = 3;
  const shownIndex = activeStep <= 2 ? 0 : activeStep === 3 ? 1 : 2; // question affichée (1 à 3)

  // If model is validated and criteria generated, show compact complete state
  if (allCollapsed) {
    return (
      <div style={{ borderRadius: 8, border: "1px solid #10b98130", background: "linear-gradient(135deg,#10b98108,#d1fae508)", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14 }}>✓</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Contexte complet</div>
            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 1 }}>
              {[0,1,2,3,4,5].map(s => collapseLabel(s)).filter(Boolean).slice(0,3).join(" · ")}
            </div>
          </div>
          <button type="button" data-testid="comprendre-revoir-questions" onClick={() => onUpdate({ modelValidated: false })}
            title="Revenir aux questions du cadrage — réponses et modèle conservés"
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text2)", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ← Revoir les questions
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={flowContainerRef} style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>
    {/* GAUCHE — formulaire */}
    <div style={{ display: "flex", flexDirection: "column", gap: 0, borderRadius: 8, border: "1.5px solid var(--v4-border)", background: "var(--v4-surface)", overflow: "hidden" }}>
      <style>{`
        @keyframes aura-comprendre-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .aura-comprendre-step { animation: aura-comprendre-in .25s ease; }
        @media (prefers-reduced-motion: reduce) { .aura-comprendre-step { animation: none; } }
      `}</style>
      {/* Anneau de progression du cadrage : un segment par sous-étape réelle du parcours */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px 6px" }}>
        <svg width={34} height={34} style={{ flexShrink: 0 }}>
          {Array.from({ length: totalSteps }, (_, i) => {
            const activeStep = shownIndex;
            const segAngle = 360 / totalSteps, gapA = 7;
            const a0 = -90 + i * segAngle + gapA / 2, a1 = -90 + (i + 1) * segAngle - gapA / 2;
            const r = 13, cx = 17, cy = 17;
            const p0 = [cx + r * Math.cos(a0 * Math.PI / 180), cy + r * Math.sin(a0 * Math.PI / 180)];
            const p1 = [cx + r * Math.cos(a1 * Math.PI / 180), cy + r * Math.sin(a1 * Math.PI / 180)];
            const donePart = i < activeStep, current = i === activeStep;
            return <path key={i} d={`M ${p0[0]} ${p0[1]} A ${r} ${r} 0 0 1 ${p1[0]} ${p1[1]}`} fill="none"
              stroke={donePart ? "#059669" : current ? "var(--v4-accent)" : "var(--v4-border)"}
              strokeWidth={current ? 4 : 3} strokeLinecap="round" />;
          })}
          <text x={17} y={17} textAnchor="middle" dominantBaseline="central" fontSize={13}>{STEP_ICONS[Math.min(activeStep, totalSteps - 1)]}</text>
        </svg>
        <div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--v4-text2)" }}>Question {shownIndex + 1} sur {totalSteps}</div>
        </div>
      </div>
      {/* Barre de progression linéaire — une question, une case qui se remplit */}
      <div style={{ display: "flex", gap: 3, padding: "0 16px 8px" }}>
        {Array.from({ length: totalSteps }, (_, i) => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 6, background: i <= shownIndex ? "var(--v4-accent)" : "var(--v4-border)", transition: "background .2s" }} />
        ))}
      </div>
      <CompagnonAura
        open={companionOpen}
        onClose={() => setCompanionOpen(false)}
        steps={companionSteps}
        startAt={companionStart}
        onStepChange={(_, s) => { const w = (s as VoiceStep).wizard; if (typeof w === "number") setActiveStep(w); }}
        title="Comprendre la décision"
        contextPrompt="Cadrage d'une décision d'entreprise : objectif, décideurs, parties impactées, résistances, exigences, leviers, contraintes, risques."
      />


      {[0, 1, 2, 3, 4].map(step => {
        const merged = step === 2 && activeStep === 1; // objectif et horizon dans la question 1
        const isActive = step === activeStep || merged;
        const isCompleted = step < activeStep;
        const isFuture = step > activeStep;
        const summary = collapseLabel(step);
        const title = STEP_TITLES[step];

        if (!isActive) return null;

        return (
          <div key={step} style={{ transition: "opacity .2s" }}>
            {/* Titre de la question courante — une seule question visible à la fois */}
            {!merged && <div style={{ padding: "4px 14px 14px" }}>
              <div className="aura-question-card" key={step} data-testid="comprendre-question">
                <div className="aura-question-step"><b>{shownIndex + 1}</b>Comprendre la décision</div>
                <h2 className="aura-question-title"><KeywordText text={title} keywords={STEP_KEYWORDS[step]} /></h2>
                <p className="aura-question-help"><KeywordText text={STEP_HELP[step]} keywords={["objectif", "horizon", "résultat attendu", "exigences", "parties prenantes", "leviers", "contraintes", "décision"]} /></p>
              </div>
            </div>}

            {/* Step body */}
            {isActive && (
              <div key={step} className="aura-comprendre-step" style={{ padding: "0 14px 14px" }}>
                {/* ─── Step 0: Case type ─────────────── */}
                {step === 0 && (
                  <>
                    {activePack?.decisionTypes && (
                      <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 12 }}>
                        Types de décision retenus pour le {activePack.label} — les plus pertinents pour ce secteur.
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 12 }}>
                      {(activePack?.decisionTypes ? CASE_TYPES.filter(ct => activePack.decisionTypes!.includes(ct.id)) : CASE_TYPES).filter(ct => !(session.sector === "Supply chain" && ct.id === "architecture")).map(ct => (
                        <button key={ct.id}
                          onClick={() => {
                            onUpdate({ caseType: ct.id });
                            if (ct.id !== "architecture") setTimeout(() => nextStep(0), 80);
                          }}
                          title={ct.hint}
                          style={{
                            display: "flex", flexDirection: "column", gap: 4,
                            padding: "10px 12px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                            border: `1.5px solid ${session.caseType === ct.id ? ct.border : "var(--v4-border)"}`,
                            background: session.caseType === ct.id ? ct.bg : "var(--v4-bg)",
                            transition: "border-color .15s, background .15s",
                            fontFamily: "inherit",
                          }}>
                          <span style={{ fontSize: 14 }}>{ct.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: session.caseType === ct.id ? ct.accent : "var(--v4-text)", lineHeight: 1.2 }}>{ct.label}</span>
                          <span style={{ fontSize: 12, color: session.caseType === ct.id ? ct.accent : "var(--v4-text3)", opacity: 0.8 }}>{activePack?.caseSubOverrides?.[ct.id] ?? ct.sub}</span>
                        </button>
                      ))}
                    </div>

                    {/* ── Sous-pattern Architecture (Entreprise / Applicative / Data / Infra) ── */}
                    {session.caseType === "architecture" && (
                      <div style={{ marginTop: 4, marginBottom: 14, padding: "12px 14px", borderRadius: 8, border: "1.5px solid #5eead4", background: "#f0fdfa" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f766e", marginBottom: 12.5 }}>
                          Quel type d'architecture arbitrez-vous ?
                          <span style={{ fontWeight: 400, color: "#0f766e", opacity: 0.75, marginLeft: 6, fontSize: 13 }}>— chaque type a son propre questionnaire et sa bibliothèque de critères de départ</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 7, marginBottom: session.archPattern ? 14 : 0 }}>
                          {ARCHITECTURE_PATTERNS.map(ap => (
                            <button key={ap.id} onClick={() => onUpdate({ archPattern: ap.id })}
                              style={{
                                display: "flex", flexDirection: "column", gap: 3, padding: "9px 10px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                                border: `1.5px solid ${session.archPattern === ap.id ? "#0f766e" : "var(--v4-border)"}`,
                                background: session.archPattern === ap.id ? "#ccfbf1" : "#fff",
                                fontFamily: "inherit",
                              }}>
                              <span style={{ fontSize: 13 }}>{ap.icon}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: session.archPattern === ap.id ? "#0f766e" : "var(--v4-text)", lineHeight: 1.2 }}>{ap.label}</span>
                              <span style={{ fontSize: 12, color: session.archPattern === ap.id ? "#0f766e" : "var(--v4-text3)", opacity: 0.85, lineHeight: 1.3 }}>{ap.tagline}</span>
                            </button>
                          ))}
                        </div>

                        {session.archPattern && (() => {
                          const pattern = getArchitecturePattern(session.archPattern)!;
                          const answers = session.archAnswers ?? {};
                          return (
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 12 }}>
                                {pattern.description}
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                {pattern.questionnaire.map(q => (
                                  <div key={q.id}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--v4-text2)", marginBottom: 3 }}>{q.text}</div>
                                    {q.choices ? (
                                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                                        {q.choices.map(c => (
                                          <button key={c} onClick={() => onUpdate({ archAnswers: { ...answers, [q.id]: c } })}
                                            style={{ padding: "3px 9px", borderRadius: 999, fontSize: 12, border: `1px solid ${answers[q.id] === c ? "#0f766e" : "var(--v4-border)"}`, background: answers[q.id] === c ? "#ccfbf1" : "transparent", color: answers[q.id] === c ? "#0f766e" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", fontWeight: answers[q.id] === c ? 700 : 400 }}>
                                            {answers[q.id] === c ? "✓ " : ""}{c}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <input className="aura-answer" value={answers[q.id] ?? ""} onChange={e => onUpdate({ archAnswers: { ...answers, [q.id]: e.target.value } })}
                                        placeholder={q.placeholder} style={{ width: "100%", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", fontFamily: "inherit", background: "var(--v4-surface)" }} />
                                    )}
                                  </div>
                                ))}
                              </div>
                              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
                                <button onClick={() => nextStep(0)}
                                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#0f766e", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                                  Continuer →
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* ── Secteur d'activité ── */}
                    {session.caseType && (
                      <div style={{ marginTop: 10, marginBottom: 10 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".05em" }}>Secteur d'activité (optionnel)</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                          {["Transport / Logistique", "Industrie / Manufacturing", "Finance / Investissement", "Santé / Pharma", "Immobilier", "Énergie / Utilities", "Technologie / Digital", "Retail / Distribution", "Secteur public", "Défense / Aéro", "Autre"].map(s => (
                            <button key={s} onClick={() => onUpdate({ sector: session.sector === s ? undefined : s })}
                              style={{ padding: "3px 10px", borderRadius: 8, fontSize: 12, border: `1px solid ${session.sector === s ? "var(--v4-accent)" : "var(--v4-border)"}`, background: session.sector === s ? "var(--v4-accent-bg)" : "transparent", color: session.sector === s ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", fontWeight: session.sector === s ? 700 : 400 }}>
                              {session.sector === s ? "✓ " : ""}{s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button onClick={() => nextStep(0)} disabled={!canAdvanceStep(0)}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canAdvanceStep(0) ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: canAdvanceStep(0) ? 1 : 0.45 }}>
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ─── Step 1: Decision context ─────── */}
                {step === 1 && (
                  <>
                    {/* ── Document import ── */}
                    <label className="aura-doc-drop" data-testid="doc-import" aria-busy={docImporting} style={{ marginBottom: 10, cursor: docImporting ? "progress" : "pointer" }} {...dropZoneProps()}>
                      <span className="aura-icon-pill">{docImporting ? <Loader2 className="animate-spin" /> : <FileUp />}</span>
                      <span style={{ flex: "1 1 220px", minWidth: 0, display: "flex", flexDirection: "column" }}>
                        <span className="aura-doc-title">{docImporting ? "Analyse en cours…" : "Importer un document"}</span>
                        <span className="aura-doc-formats">Pré-remplit les réponses · glisser-déposer ou cliquer · {DOC_FORMATS_LABEL}</span>
                      </span>
                      <span style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--v4-accent-border)", background: "#fff", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 12 }}><Upload size={14} />{docImporting ? "Analyse…" : "Parcourir"}</span>
                        <input type="file" disabled={docImporting} multiple accept={DOC_ACCEPT} style={{ display: "none" }}
                          onChange={async (e) => {
                            const files = Array.from(e.target.files ?? []);
                            if (!files.length) return;
                            setDocImporting(true);
                            setDocImportMsg(null);
                            try {
                              const { extractFiles } = await import("../lib/v4/doc-extract");
                              const results = await extractFiles(files);
                              setDocResults(prev => [...prev, ...results]);
                              const texts = results.filter(r => r.status !== "non lisible" && r.text.trim()).map(r => `--- ${r.name} ---\n${r.text.trim()}`);
                              if (!texts.length) throw new Error("empty");
                              const { parseElicitationFromDoc } = await import("../lib/v4/atelier-llm");
                              const parsed = await parseElicitationFromDoc({ data: { text: texts.join("\n\n").slice(0, 18000) } });
                              // Chaque champ n'est rempli que s'il est encore vide — une réponse déjà
                              // donnée par l'utilisateur n'est jamais écrasée par le document importé.
                              if (parsed.contextRaw && !draftContext.trim()) { setDraftContext(parsed.contextRaw); setAiInferred(inferFromText(parsed.contextRaw)); }
                              if (parsed.title) onUpdate({ title: parsed.title });
                              if (parsed.caseType && !session.caseType) onUpdate({ caseType: parsed.caseType });
                              if (parsed.sector && !session.sector) onUpdate({ sector: parsed.sector });
                              if (parsed.risques?.length) setDraftRisques(prev => [...new Set([...prev, ...parsed.risques!])]);
                              applyOrConflict("objectif", parsed.objectif);
                              applyOrConflict("horizon", parsed.horizon);
                              applyOrConflict("decideurs", parsed.decideurs);
                              applyOrConflict("impactes", parsed.impactes);
                              applyOrConflict("resistances", parsed.resistances);
                              applyOrConflict("exigencesNonNeg", parsed.exigencesNonNeg);
                              applyOrConflict("leviersDDP", parsed.leviersDDP);
                              applyOrConflict("contraintesDIP", parsed.contraintesDIP);
                              const documents = [...new Set([...(session.elicitation?.documents ?? []), ...results.filter(r => r.status !== "non lisible").map(r => r.name)])];
                              onUpdate({ elicitation: { ...(session.elicitation ?? {}), documents } });
                              setDocImportMsg(`✓ ${texts.length > 1 ? `${texts.length} documents pris` : "1 document pris"} en compte — vérifiez et ajustez chaque champ.`);
                              // Le redimensionnement est géré par le useLayoutEffect au niveau du
                              // flux (voir plus haut) : il se redéclenche après CE re-rendu aussi.
                            } catch {
                              setDocImportMsg("Aucun de ces fichiers n'a pu être lu (voir l'état de chaque fichier). Collez le contenu manuellement ci-dessous.");
                            } finally {
                              setDocImporting(false);
                              e.target.value = '';
                            }
                          }} />
                    </label>
                    <DocStatusList results={docResults} />
                    {docImportMsg && (
                      <div style={{ fontSize: 13, padding: "6px 10px", borderRadius: 6, marginBottom: 8, background: docImportMsg.startsWith("✓") ? "#d1fae5" : "#fee2e2", color: docImportMsg.startsWith("✓") ? "#065f46" : "#991b1b", border: `1px solid ${docImportMsg.startsWith("✓") ? "#6ee7b7" : "#fca5a5"}` }}>
                        {docImportMsg}
                      </div>
                    )}
                    {embeddedSuggestions && embeddedSuggestions.length > 0 && !draftContext.trim() && (
                      <div style={{ marginBottom: 10, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--v4-accent-border)", background: "var(--v4-accent-bg)" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 800, color: "var(--v4-accent2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>Suggestions de décision</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {embeddedSuggestions.map(s => (
                            <button key={s} type="button"
                              onClick={() => { setDraftContext(s); setAiInferred(inferFromText(s)); }}
                              style={{ textAlign: "left", border: "1px solid var(--v4-accent-border)", background: "var(--v4-surface)", color: "var(--v4-accent2)", borderRadius: 8, padding: "6px 10px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ flex: 1, fontSize: 13.5, color: "#1a1d4a" }} data-testid="decision-question"><Q>{(QUESTION_BY_CASE[session.caseType ?? ""] ?? QUESTION_BY_CASE._default).question}</Q></span>
                      <VoiceDictationButton question={(QUESTION_BY_CASE[session.caseType ?? ""] ?? QUESTION_BY_CASE._default).question}
                        onTranscript={(t) => {
                          setDraftContext(prev => {
                            const next = prev ? `${prev.trim()} ${t}` : t;
                            setAiInferred(inferFromText(next));
                            return next;
                          });
                        }}
                      />
                    </div>
                    <textarea className="aura-answer"
                      ref={autoGrowTextarea}
                      value={draftContext}
                      onChange={e => { setDraftContext(e.target.value); setAiInferred(inferFromText(e.target.value)); autoGrowTextarea(e.target); }}
                      placeholder={(QUESTION_BY_CASE[session.caseType ?? ""] ?? QUESTION_BY_CASE._default).placeholder}
                      rows={3}
                      style={{
                        width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8,
                        padding: "10px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)",
                        fontFamily: "inherit", outline: "none", lineHeight: 1.6, boxSizing: "border-box", overflow: "hidden",
                      }}
                      onFocus={e => (e.target.style.borderColor = "var(--v4-accent)")}
                      onBlur={e => (e.target.style.borderColor = "var(--v4-border)")}
                    />

                    {/* ── Aura a détecté (inférence IA) ── */}
                    {draftContext.trim().length > 10 && (
                      <div style={{ marginTop: 12, padding: "10px 12px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-bg)" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-accent)", marginBottom: 12 }}>✦ Aura a détecté</div>
                        {/* caseType cards */}
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Type de décision</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 10 }}>
                          {(activePack?.decisionTypes ? CASE_TYPES.filter(ct => activePack.decisionTypes!.includes(ct.id)) : CASE_TYPES).map(ct => {
                            const isInferred = aiInferred.caseType === ct.id && !session.caseType;
                            const isSelected = session.caseType === ct.id;
                            const isOther = !isInferred && !isSelected;
                            return (
                              <button key={ct.id}
                                onClick={() => { onUpdate({ caseType: ct.id }); setAiInferred(prev => ({ ...prev, caseType: undefined })); }}
                                style={{
                                  display: "flex", flexDirection: "column", gap: 2, padding: "7px 9px", borderRadius: 8, cursor: "pointer", textAlign: "left",
                                  border: `1.5px solid ${isInferred ? ct.border : isSelected ? ct.border : "var(--v4-border)"}`,
                                  background: isInferred ? ct.bg : isSelected ? ct.bg : "transparent",
                                  opacity: isOther ? 0.4 : 1,
                                  transition: "all .12s", fontFamily: "inherit",
                                }}>
                                <span style={{ fontSize: 13 }}>{ct.icon}</span>
                                <span style={{ fontSize: 12, fontWeight: 700, color: isInferred || isSelected ? ct.accent : "var(--v4-text)", lineHeight: 1.2 }}>{ct.label}</span>
                                {isInferred && <span style={{ fontSize: 12, color: ct.accent, fontWeight: 700 }}>✦ Aura suggère</span>}
                              </button>
                            );
                          })}
                        </div>
                        {/* Sector chips */}
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>Secteur</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 2 }}>
                          {["Transport / Logistique", "Industrie / Manufacturing", "Finance / Investissement", "Santé / Pharma", "Technologie / SaaS", "Énergie / Utilities", "Retail / Distribution"].map(s => {
                            const isInferred = aiInferred.sector === s && !session.sector;
                            const isSelected = session.sector === s;
                            const isOther = !isInferred && !isSelected;
                            return (
                              <button key={s} onClick={() => onUpdate({ sector: session.sector === s ? undefined : s })}
                                style={{ padding: "3px 9px", borderRadius: 8, fontSize: 12, border: `1px solid ${isInferred || isSelected ? "var(--v4-accent)" : "var(--v4-border)"}`, background: isInferred || isSelected ? "var(--v4-accent-bg)" : "transparent", color: isInferred || isSelected ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", fontWeight: isInferred || isSelected ? 700 : 400, opacity: isOther ? 0.4 : 1, transition: "all .12s" }}>
                                {isSelected ? "✓ " : isInferred ? "✦ " : ""}{s}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Type de décision : déduit (pré-sélectionné), modifiable ici plutôt qu'en question séparée. */}
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", marginTop: 4 }}>Type de décision
                      <select aria-label="Type de décision" value={session.caseType ?? "strategique"} onChange={e => onUpdate({ caseType: e.target.value })}
                        style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }}>
                        {CASE_TYPES.filter(ct => !(session.sector === "Supply chain" && ct.id === "architecture")).map(ct => <option key={ct.id} value={ct.id}>{ct.label}</option>)}
                      </select>
                    </label>
                  </>
                )}

                {/* ─── Step 2: Objectif & horizon ────── */}
                {step === 2 && (
                  <>
                    <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 8, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
                      <span style={{ flex: 1 }}>{OBJECTIF_HINT_BY_CASETYPE[session.caseType ?? ""] ?? "Quel est votre objectif prioritaire et sur quel horizon ?"}</span>
                      <VoiceDictationButton question={OBJECTIF_HINT_BY_CASETYPE[session.caseType ?? ""] ?? "Quel est votre objectif prioritaire et sur quel horizon ?"} onTranscript={t => setDraftObjectif(prev => appendDictation(prev, t))} />
                    </div>
                    {prefilling && (
                      <div style={{ fontSize: 12.5, color: "var(--v4-accent)", marginBottom: 8, fontWeight: 700 }}>✦ Aura relit votre description pour préremplir la suite…</div>
                    )}
                    <input className="aura-answer"
                      value={draftObjectif}
                      onChange={e => setDraftObjectif(e.target.value)}
                      placeholder="Ex : Réduire les coûts d'approvisionnement de 20%"
                      style={{
                        width: "100%", border: "1.5px solid var(--v4-border)", borderRadius: 8,
                        padding: "8px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)",
                        fontFamily: "inherit", outline: "none", marginBottom: 10, boxSizing: "border-box",
                      }}
                    />
                    <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 6, fontWeight: 600 }}>Horizon de décision :</div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                      {HORIZONS.map(h => {
                        const isInferred = aiInferred.horizon === h && !draftHorizon;
                        const isSelected = draftHorizon === h;
                        const isOther = !isInferred && !isSelected;
                        return (
                          <button key={h} onClick={() => setDraftHorizon(h === draftHorizon ? "" : h)}
                            style={{
                              padding: "5px 12px", borderRadius: 8, border: `1.5px solid ${isSelected ? "var(--v4-accent)" : isInferred ? "var(--v4-accent)" : "var(--v4-border)"}`,
                              background: isSelected ? "var(--v4-accent)" : isInferred ? "var(--v4-accent-bg)" : "transparent",
                              color: isSelected ? "#fff" : isInferred ? "var(--v4-accent)" : "var(--v4-text2)",
                              fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: isSelected || isInferred ? 700 : 400,
                              opacity: isOther ? 0.5 : 1,
                              transition: "all .12s",
                            }}>
                            {isInferred && !isSelected ? "✦ " : ""}{h}
                          </button>
                        );
                      })}
                    </div>
                    {merged && <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
                      <button data-testid="comprendre-suivant" onClick={() => nextStep(1)} disabled={!canAdvanceStep(1)}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canAdvanceStep(1) ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: canAdvanceStep(1) ? 1 : 0.45 }}>
                        Suivant →
                      </button>
                    </div>}
                    {!merged && <div style={{ display: "flex", justifyContent: "space-between" }}>
                      {prevButton(2)}
                      <button onClick={() => nextStep(2)} disabled={!canAdvanceStep(2)}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canAdvanceStep(2) ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: canAdvanceStep(2) ? 1 : 0.45 }}>
                        Suivant →
                      </button>
                    </div>}
                  </>
                )}

                {/* ─── Step 3: Parties prenantes ────── */}
                {step === 3 && (
                  <>
                    {/* Bloc A — Qui est concerné ? */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-text2)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}><Q keywords={["concerné"]}>Qui est concerné ?</Q></div>

                      {/* Qui décide ? */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1 }}><Q>Qui décide ?</Q></span>
                          <VoiceDictationButton question={"Qui décide ?"} onTranscript={t => setDraftDecideurs(prev => appendDictation(prev, t))} />
                        </div>
                        {(stakeholderSuggestions.decideurs.length > 0 || (aiInferred.decideurs ?? []).length > 0) && (
                          <div style={{ marginBottom: 5 }}>
                            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>✦ Suggestions IA pour ce type de décision :</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {stakeholderSuggestions.decideurs.map(s => {
                                const active = draftDecideurs.toLowerCase().includes(s.toLowerCase());
                                return (
                                  <button key={s} onClick={() => { if (!active) setDraftDecideurs(prev => prev ? `${prev}, ${s}` : s); }}
                                    style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${active ? "var(--v4-accent)" : "var(--v4-border)"}`, background: active ? "var(--v4-accent-bg)" : "transparent", color: active ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                    {active ? "✓ " : "+ "}{s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <textarea className="aura-answer"
                          ref={autoGrowTextarea}
                          value={draftDecideurs}
                          onChange={e => { setDraftDecideurs(e.target.value); autoGrowTextarea(e.target); }}
                          placeholder="Ex : DG, Comité de direction"
                          rows={1}
                          style={{ width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden" }}
                        />
                      </div>

                      {/* Qui est impacté ? */}
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1 }}><Q>Qui est impacté ?</Q></span>
                          <VoiceDictationButton question={"Qui est impacté ?"} onTranscript={t => setDraftImpactes(prev => appendDictation(prev, t))} />
                        </div>
                        {(stakeholderSuggestions.impactes.length > 0 || (aiInferred.impactes ?? []).length > 0) && (
                          <div style={{ marginBottom: 5 }}>
                            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>✦ Suggestions IA pour ce type de décision :</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {stakeholderSuggestions.impactes.map(s => {
                                const active = draftImpactes.toLowerCase().includes(s.toLowerCase());
                                return (
                                  <button key={s} onClick={() => { if (!active) setDraftImpactes(prev => prev ? `${prev}, ${s}` : s); }}
                                    style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${active ? "var(--v4-accent)" : "var(--v4-border)"}`, background: active ? "var(--v4-accent-bg)" : "transparent", color: active ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                    {active ? "✓ " : "+ "}{s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <textarea className="aura-answer"
                          ref={autoGrowTextarea}
                          value={draftImpactes}
                          onChange={e => { setDraftImpactes(e.target.value); autoGrowTextarea(e.target); }}
                          placeholder="Ex : Équipes opérationnelles, clients"
                          rows={1}
                          style={{ width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden" }}
                        />
                      </div>
                    </div>

                    {/* Séparateur Lignes rouges */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "12px 0" }}>
                      <div style={{ flex: 1, height: 2, background: "linear-gradient(90deg, #dc2626, #dc262630)" }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".06em", whiteSpace: "nowrap" }}> Lignes rouges</span>
                      <div style={{ flex: 1, height: 2, background: "linear-gradient(270deg, #dc2626, #dc262630)" }} />
                    </div>

                    {/* Bloc B — Lignes rouges */}
                    <div>
                      <div key="resist" style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4, fontWeight: 600, display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1 }}><Q keywords={["résister"]}>Qui pourrait résister ?</Q></span>
                          <VoiceDictationButton question={"Qui pourrait résister ?"} onTranscript={t => setDraftResistances(prev => appendDictation(prev, t))} />
                        </div>
                        {stakeholderSuggestions.resistances.length > 0 && (
                          <div style={{ marginBottom: 5 }}>
                            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>✦ Suggestions IA :</div>
                            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {stakeholderSuggestions.resistances.map(s => {
                                const active = draftResistances.toLowerCase().includes(s.toLowerCase());
                                return (
                                  <button key={s} onClick={() => { if (!active) setDraftResistances(prev => prev ? `${prev}, ${s}` : s); }}
                                    style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${active ? "#dc262660" : "var(--v4-border)"}`, background: active ? "#fee2e218" : "transparent", color: active ? "#dc2626" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                    {active ? "✓ " : "+ "}{s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <textarea className="aura-answer"
                          ref={autoGrowTextarea}
                          value={draftResistances}
                          onChange={e => { setDraftResistances(e.target.value); autoGrowTextarea(e.target); }}
                          placeholder="Ex : Partenaires historiques, syndicats"
                          rows={1}
                          style={{
                            width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8,
                            padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)",
                            fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden",
                          }}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", marginBottom: 3, display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ flex: 1 }}>Exigences non-négociables</span>
                          <VoiceDictationButton question={"Exigences non-négociables"} onTranscript={t => setDraftExigencesNonNeg(prev => appendDictation(prev, t))} />
                        </div>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 6, lineHeight: 1.45 }}>
                          Critères bloquants — un scénario qui les rate est éliminé. Ces seuils orienteront les objectifs "Essentiels" dans le modèle.
                        </div>
                        <textarea className="aura-answer"
                          ref={autoGrowTextarea}
                          value={draftExigencesNonNeg}
                          onChange={e => { setDraftExigencesNonNeg(e.target.value); autoGrowTextarea(e.target); }}
                          placeholder="Ex : Délai max 6 mois, budget < 500K€, conformité ISO 27001 obligatoire"
                          rows={1}
                          style={{ width: "100%", resize: "vertical", border: "1.5px solid #dc262640", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden" }}
                        />
                      </div>
                    </div>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", marginBottom: 10 }}>Attitude face au risque
                      <select aria-label="Attitude face au risque" value={session.attitude} onChange={e => onUpdate({ attitude: e.target.value as AtelierSession["attitude"] })}
                        style={{ border: "1px solid var(--v4-border)", borderRadius: 8, padding: "5px 8px", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }}>
                        <option value="Pessimiste">Prudente (pessimiste, par défaut)</option>
                        <option value="Optimiste">Optimiste</option>
                      </select>
                    </label>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
                      {prevButton(3)}
                      <button onClick={() => nextStep(3)} disabled={!canAdvanceStep(3)}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: canAdvanceStep(3) ? "pointer" : "not-allowed", fontFamily: "inherit", opacity: canAdvanceStep(3) ? 1 : 0.45 }}>
                        Suivant →
                      </button>
                    </div>
                  </>
                )}

                {/* ─── Step 4: Leviers & contraintes ── */}
                {step === 4 && (
                  <>
                    {/* ── DDPs : ce que le décideur contrôle ── */}
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 2, display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ flex: 1 }}><Q>Sur quoi pouvez-vous agir ?</Q></span>
                        <VoiceDictationButton question={"Sur quoi pouvez-vous agir ?"} onTranscript={t => setDraftLeviersDDP(prev => appendDictation(prev, t))} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 8, lineHeight: 1.45 }}>
                        Variables que vous contrôlez réellement — ce seront les leviers d'action du modèle.
                      </div>
                      {ddpSuggestions.ddp.length > 0 && (
                        <div style={{ marginBottom: 7 }}>
                          <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>Exemples pour ce type de décision :</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {ddpSuggestions.ddp.map(s => {
                              const active = draftLeviersDDP.toLowerCase().includes(s.toLowerCase());
                              return (
                                <button key={s} onClick={() => { if (!active) setDraftLeviersDDP(prev => prev ? `${prev}, ${s}` : s); }}
                                  style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${active ? "var(--v4-accent)" : "var(--v4-border)"}`, background: active ? "var(--v4-accent-bg)" : "transparent", color: active ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                  {active ? "✓ " : "+ "}{s}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <textarea className="aura-answer"
                        ref={autoGrowTextarea}
                        value={draftLeviersDDP}
                        onChange={e => { setDraftLeviersDDP(e.target.value); autoGrowTextarea(e.target); }}
                        placeholder={ddpSuggestions.ddp.length ? `Ex : ${ddpSuggestions.ddp.slice(0, 2).join(", ")}…` : "Ex : Budget alloué, choix technologique, ressources humaines affectées"}
                        rows={2}
                        style={{ width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden" }}
                      />
                    </div>

                    {/* ── Facteurs de contexte non maîtrisables ── */}
                    <div style={{ marginBottom: 14, paddingTop: 12, borderTop: "1px solid var(--v4-border)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 2, display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ flex: 1 }}>Facteurs de contexte non maîtrisables</span>
                        <VoiceDictationButton question={"Facteurs de contexte non maîtrisables"} onTranscript={t => setDraftContraintesDIP(prev => appendDictation(prev, t))} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 8, lineHeight: 1.45 }}>
                        Ce qui s'impose à vous et que vous ne pouvez pas modifier (réglementation, marché, disponibilité technologique). Ces facteurs informent l'analyse mais ne sont pas des leviers d'action.
                      </div>
                      {ddpSuggestions.dip.length > 0 && (
                        <div style={{ marginBottom: 7 }}>
                          <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>Exemples de facteurs de contexte :</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {ddpSuggestions.dip.map(s => {
                              const active = draftContraintesDIP.toLowerCase().includes(s.toLowerCase());
                              return (
                                <button key={s} onClick={() => { if (!active) setDraftContraintesDIP(prev => prev ? `${prev}, ${s}` : s); }}
                                  style={{ padding: "2px 8px", borderRadius: 8, fontSize: 12, border: `1px solid ${active ? "#dc262640" : "var(--v4-border)"}`, background: active ? "#fee2e218" : "transparent", color: active ? "#dc2626" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                  {active ? "✓ " : "+ "}{s}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <textarea className="aura-answer"
                        ref={autoGrowTextarea}
                        value={draftContraintesDIP}
                        onChange={e => { setDraftContraintesDIP(e.target.value); autoGrowTextarea(e.target); }}
                        placeholder={ddpSuggestions.dip.length ? `Ex : ${ddpSuggestions.dip.slice(0, 2).join(", ")}…` : "Ex : Normes applicables, prix de marché, délais fournisseurs imposés"}
                        rows={2}
                        style={{ width: "100%", resize: "vertical", border: "1.5px solid #dc262630", borderRadius: 8, padding: "7px 12px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", lineHeight: 1.5, overflow: "hidden" }}
                      />
                    </div>

                    {/* ── Risques d'exécution ── */}
                    <div style={{ paddingTop: 12, borderTop: "1px solid var(--v4-border)" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 2, display: "flex", alignItems: "center", gap: 12 }}>
                        <span style={{ flex: 1 }}>Risques d'exécution</span>
                        <VoiceDictationButton question={"Risques d'exécution"} label="Dicter un risque" onTranscript={t => { const v = t.trim(); if (v) setDraftRisques(prev => prev.includes(v) ? prev : [...prev, v]); }} />
                      </div>
                      <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 12 }}>Risques opérationnels pouvant compromettre la mise en œuvre.</div>
                      {riskSuggestions.length > 0 && (
                        <div style={{ marginBottom: 7 }}>
                          <div style={{ fontSize: 12, color: "var(--v4-text3)", marginBottom: 4 }}>Suggestions :</div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {riskSuggestions.map(r => {
                              const isAdded = draftRisques.includes(r);
                              return (
                                <button key={r} onClick={() => { if (!isAdded) setDraftRisques(prev => [...prev, r]); else setDraftRisques(prev => prev.filter(x => x !== r)); }}
                                  style={{ padding: "3px 9px", borderRadius: 8, fontSize: 12, border: `1px solid ${isAdded ? "var(--v4-accent)" : "var(--v4-border)"}`, background: isAdded ? "var(--v4-accent-bg)" : "transparent", color: isAdded ? "var(--v4-accent)" : "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                                  {isAdded ? "✓ " : "+ "}{r}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <ChipList
                        items={draftRisques}
                        onAdd={r => setDraftRisques(prev => [...prev, r])}
                        onRemove={r => setDraftRisques(prev => prev.filter(x => x !== r))}
                        placeholder="Ajouter un risque, Entrée…"
                      />
                    </div>

                    {/* ── Résumé pré-CTA ── */}
                    {(draftLeviersDDP.trim() || draftRisques.length > 0) && (
                      <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, border: "1.5px solid var(--v4-accent-border, var(--v4-accent))", background: "var(--v4-accent-bg)" }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-accent)", marginBottom: 12 }}>✓ Modèle qui sera construit</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          {session.caseType && (
                            <div style={{ fontSize: 12, color: "var(--v4-text2)" }}>• <strong>Type :</strong> {CASE_TYPES.find(c => c.id === session.caseType)?.label ?? session.caseType}</div>
                          )}
                          {session.sector && (
                            <div style={{ fontSize: 12, color: "var(--v4-text2)" }}>• <strong>Secteur :</strong> {session.sector}</div>
                          )}
                          {draftLeviersDDP.trim() && (
                            <div style={{ fontSize: 12, color: "var(--v4-text2)" }}>• <strong>Leviers :</strong> {splitItemsRespectingParens(draftLeviersDDP).length} détecté{splitItemsRespectingParens(draftLeviersDDP).length > 1 ? "s" : ""}</div>
                          )}
                          {draftRisques.length > 0 && (
                            <div style={{ fontSize: 12, color: "var(--v4-text2)" }}>• <strong>Risques :</strong> {draftRisques.length} identifié{draftRisques.length > 1 ? "s" : ""}</div>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 8, fontStyle: "italic", lineHeight: 1.45 }}>
                          Aura va structurer votre espace de décision en quelques secondes
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
                      {prevButton(4)}
                      <button onClick={() => nextStep(4)} disabled={generating}
                        style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: generating ? 0.6 : 1 }}>
                        {hasPestel ? "Suivant →" : (generating ? "Génération en cours…" : "Construire mon modèle de décision →")}
                      </button>
                    </div>
                  </>
                )}

                {/* ─── Step 5: PESTEL ──────────────── */}
                {step === 5 && (
                  <>
                    <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 10, lineHeight: 1.5 }}>
                      Cochez uniquement les dimensions qui ne sont pas déjà couvertes par ce que vous venez de renseigner.
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 12 }}>
                      {PESTEL_DIMS.map(dim => {
                        const isSelected = draftPestelSelected.includes(dim.id);
                        const covered = !!pestelCovered[dim.id] && !isSelected;
                        return (
                          <button key={dim.id}
                            onClick={() => {
                              if (isSelected) {
                                setDraftPestelSelected(prev => prev.filter(x => x !== dim.id));
                              } else {
                                setDraftPestelSelected(prev => [...prev, dim.id]);
                              }
                            }}
                            style={{
                              display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
                              padding: "7px 10px", borderRadius: 8, cursor: "pointer",
                              border: `1.5px solid ${isSelected ? "var(--v4-accent)" : "var(--v4-border)"}`,
                              background: isSelected ? "var(--v4-accent-bg)" : "var(--v4-bg)",
                              fontFamily: "inherit", textAlign: "left",
                              opacity: covered ? 0.5 : 1,
                              transition: "all .12s",
                            }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <AuraIcon e={dim.icon} size={12} />
                              <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? "var(--v4-accent)" : "var(--v4-text)" }}>{dim.label}</span>
                            </div>
                            <span style={{ fontSize: 12, color: "var(--v4-text3)", lineHeight: 1.3 }}>
                              {covered ? "Déjà couvert à l'étape précédente" : dim.hint}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {draftPestelSelected.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                        {draftPestelSelected.map(dimId => {
                          const dim = PESTEL_DIMS.find(d => d.id === dimId);
                          if (!dim) return null;
                          const alreadyCovered = !!pestelCovered[dim.id];
                          return (
                            <div key={dimId}>
                              <div style={{ fontSize: 12, color: "var(--v4-text2)", marginBottom: 4, lineHeight: 1.4 }}>
                                <Q>{dim.question}</Q>
                                {alreadyCovered && (
                                  <span style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginLeft: 12 }}>(déjà couvert par vos contraintes)</span>
                                )}
                                {!alreadyCovered && activePack?.pestelSeed?.[dim.id] && draftPestelAnswers[dimId] === activePack.pestelSeed[dim.id] && (
                                  <span style={{ fontSize: 12, color: "var(--v4-accent)", fontStyle: "italic", marginLeft: 12 }}>(point de départ {activePack.label} — à corriger ou compléter)</span>
                                )}
                              </div>

                              <textarea className="aura-answer"
                                ref={autoGrowTextarea}
                                value={draftPestelAnswers[dimId] ?? ""}
                                onChange={e => { setDraftPestelAnswers(prev => ({ ...prev, [dimId]: e.target.value })); autoGrowTextarea(e.target); }}
                                placeholder={dim.placeholder}
                                rows={2}
                                style={{
                                  width: "100%", resize: "vertical", border: "1.5px solid var(--v4-border)", borderRadius: 8,
                                  padding: "7px 10px", fontSize: 13, background: "var(--v4-bg)", color: "var(--v4-text)",
                                  fontFamily: "inherit", outline: "none", lineHeight: 1.5, boxSizing: "border-box", overflow: "hidden",
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => {
                          onUpdate({
                            elicitation: {
                              ...eli,
                              step: 6,
                              pestelSelected: draftPestelSelected,
                              pestelAnswers: draftPestelAnswers,
                            },
                          });
                          onGenerate();
                        }}
                        disabled={generating}
                        style={{
                          padding: "9px 20px", borderRadius: 8, border: "none",
                          background: "var(--v4-accent,#7c3aed)", color: "#fff",
                          fontSize: 13, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer",
                          fontFamily: "inherit", opacity: generating ? 0.6 : 1,
                        }}>
                        {generating ? "Génération en cours…" : "Construire mon modèle de décision →"}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
    {/* DROITE — miroir vivant */}
    <ContextMirror
      context={draftContext}
      objectif={draftObjectif}
      exigences={draftExigencesNonNeg}
      leviers={draftLeviersDDP}
      risques={draftRisques}
      caseType={session.caseType}
      sector={session.sector}
      decideurs={draftDecideurs}
      impactes={draftImpactes}
      contraintes={draftContraintesDIP}
      pestelAnswered={draftPestelSelected
        .filter(d => draftPestelAnswers[d]?.trim())
        .map(d => ({ label: PESTEL_DIMENSION_LABEL[d] ?? d, answer: draftPestelAnswers[d] }))}
      discriminatingAnswered={(session.discriminatingQuestions ?? [])
        .filter(q => (session.discriminatingAnswers ?? {})[q.id])
        .map(q => ({ question: q.question, answer: q.choices.find(c => c.id === (session.discriminatingAnswers ?? {})[q.id])?.label ?? "" }))
        .filter(d => d.answer)}
      activeStep={activeStep}
    />
    </div>
  );
}


function splitList(s?: string): string[] {
  return (s ?? "").split(/[,;]|(?:\bet\b)/i).map(x => x.trim()).filter(Boolean);
}

const AVATAR_GRADIENTS = [
  "linear-gradient(135deg,#2a78d6,#1a5aad)", "linear-gradient(135deg,#3a3a3a,#2b2b2b)",
  "linear-gradient(135deg,#1baf7a,#0d8a5e)", "linear-gradient(135deg,#eb6834,#c14e22)",
];
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "?";
}

function StepComprendre({ session, onUpdate, onNext, setAuraMsgs, setAuraLoading, embeddedSuggestions, embeddedDomainExpertise }: {
  session: AtelierSession;
  onUpdate: (patch: Partial<AtelierSession>) => void;
  onNext: () => void;
  setAuraMsgs: (m: AuraMsg[] | ((p: AuraMsg[]) => AuraMsg[])) => void;
  setAuraLoading: (v: boolean) => void;
  embeddedSuggestions?: string[];
  /** Voir AtelierPage — cadrage expert Supply Chain Resilience, mode embarqué uniquement. */
  embeddedDomainExpertise?: string;
}) {
  const [classifying, setClassifying] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingQuestions, setGeneratingQuestions] = useState(false);
  const [newOptId, setNewOptId] = useState<string | null>(null); // which lever is adding an option
  const [newOptText, setNewOptText] = useState("");
  const [originOptId, setOriginOptId] = useState<string | null>(null); // which option shows its justification
  const [expertMode, setExpertMode] = useState(true);
  const [treeView, setTreeView] = useState<"list" | "map">("list");
  const [calibrating, setCalibrating] = useState(false);
  /** Compteur d'ouverture du fil vocal guidé. */
  const [companionSignal, setCompanionSignal] = useState(0);

  const discriminatingQuestions = session.discriminatingQuestions ?? [];
  const discriminatingAnswers = session.discriminatingAnswers ?? {};
  // Contexte pack (secteur choisi) ajouté au même contexte déjà transmis à
  // tous les appels LLM existants — pas un chemin de génération séparé.
  const companyContext = buildCompanyContext(getProfile()) + packExpertContextBlock(session.sector);

  // Build enriched context by appending discriminating answers to the raw context
  function enrichedContext(): string {
    const answered = (session.discriminatingQuestions ?? [])
      .filter(q => discriminatingAnswers[q.id])
      .map(q => {
        const ch = q.choices.find(c => c.id === discriminatingAnswers[q.id]);
        return ch ? `${q.question} → ${ch.label}` : null;
      })
      .filter(Boolean);
    if (!answered.length) return session.contextRaw;
    return `${session.contextRaw}\n\nPrécisions du décideur :\n${answered.map(a => `• ${a}`).join("\n")}`;
  }

  const leviersDef = session.leviersDef ?? [];

  function buildElicitationContextLocal(): string {
    const e = session.elicitation;
    if (!e) return "";
    const parts: string[] = [];
    if (session.sector) parts.push(`Secteur d'activité : ${session.sector}`);
    if (e.objectif) parts.push(`Objectif prioritaire : ${e.objectif}`);
    if (e.horizon) parts.push(`Horizon : ${e.horizon}`);
    if (e.decideurs) parts.push(`Décideurs : ${e.decideurs}`);
    if (e.impactes) parts.push(`Parties impactées : ${e.impactes}`);
    if (e.resistances) parts.push(`Résistances potentielles : ${e.resistances}`);
    if (e.exigencesNonNeg) parts.push(`Exigences non-négociables (→ MOE Essentiels) : ${e.exigencesNonNeg}`);
    if (e.leviersDDP) parts.push(`Leviers actionnables identifiés par le décideur : ${e.leviersDDP}`);
    if (e.contraintesDIP) parts.push(`Contraintes de contexte hors contrôle (à NE PAS inclure comme leviers) : ${e.contraintesDIP}`);
    if (e.risques?.length) parts.push(`Risques d'exécution : ${e.risques.join(", ")}`);
    const pestelLabels: Record<string, string> = { P: "Politique", E: "Économique", S: "Social", T: "Technologique", En: "Environnemental", L: "Légal" };
    const pestelParts = (e.pestelSelected ?? [])
      .filter(d => e.pestelAnswers?.[d])
      .map(d => `${pestelLabels[d] ?? d} : ${e.pestelAnswers![d]}`);
    if (pestelParts.length) parts.push(`Contexte externe (PESTEL) :\n${pestelParts.map(p => `  • ${p}`).join("\n")}`);
    if (!parts.length) return "";
    return `\n\n--- Contexte élicité ---\n${parts.join("\n")}\n---`;
  }

  async function analyse(prebuiltCtx?: string) {
    const text = prebuiltCtx ?? session.contextRaw;
    if (!text.trim() || classifying) return;
    setClassifying(true);
    setAuraLoading(true);
    try {
      const { classifyDecision } = await import("../lib/v4/atelier-llm");
      const caseTypeHint = session.caseType ? CASE_TYPES.find(c => c.id === session.caseType)?.hint : undefined;
      const caseHint = CASE_TYPE_GENERATION_HINTS[session.caseType ?? ""] ?? "";
      const archHint = buildArchPatternHint(session.archPattern, session.archAnswers);
      const textWithHint = `${caseTypeHint ? `[Type de décision : ${caseTypeHint}]\n` : ""}${caseHint ? `[Instructions : ${caseHint}]\n\n` : ""}${archHint}${text}`;
      const r = await classifyDecision({ data: { text: textWithHint, companyContext, domainExpertiseHint: embeddedDomainExpertise } });
      onUpdate({ problemType: r.problemType, dimensions: r.dimensions, playbookId: r.playbookId ?? undefined });
      autoGenerateCriteria(textWithHint, r.problemType, r.dimensions);
    } catch { /* ignore */ } finally {
      setClassifying(false);
      setAuraLoading(false);
    }
  }

  async function autoGenerateCriteria(ctx: string, type: string, dims: string[]) {
    if (session.criteria.length > 0) return;
    setGenerating(true);
    try {
      const { generateFullModel } = await import("../lib/v4/atelier-llm");
      const { buildFallbackModel, ensureRichModel } = await import("../lib/v4/comprendre-fallback");
      const fbInput = { context: ctx, elicitation: session.elicitation as ElicitationData | undefined, supplyChain: !!embeddedDomainExpertise, sector: session.sector };
      // Modèle riche avant Impacter : réponse LLM complétée si trop pauvre, sinon
      // modèle de secours structuré (sans chiffre inventé) quand le LLM est indisponible.
      let model: import("../lib/v4/atelier-llm").GeneratedFullModel;
      try {
        model = ensureRichModel(await generateFullModel({ data: { context: ctx, problemType: type, dimensions: dims, companyContext, elicitation: session.elicitation as ElicitationData | undefined, domainExpertiseHint: embeddedDomainExpertise } }), fbInput);
      } catch {
        model = buildFallbackModel(fbInput);
        setAuraMsgs(prev => [...prev, { role: "aura" as const, text: "Analyse en ligne indisponible : Aura propose un modèle de référence structuré à partir de votre cadrage (objectifs, indicateurs, leviers et options, sans aucun chiffre inventé). Ajustez-le avant de passer à Impacter." }]);
      }
      const mapIndicator = (ind: import("../lib/v4/atelier-llm").GeneratedIndicator): import("../lib/v4/atelier-store").AtelierCriterion => ({
        id: ind.id, label: ind.label, description: ind.description, modelisable: ind.modelisable,
        importance: ind.importance, poids: IMP_TO_POIDS[ind.importance as ImportanceBadge] ?? 15,
        exploratoire: ind.exploratoire,
      });
      const mapCriterion = (crit: import("../lib/v4/atelier-llm").GeneratedCriterion): import("../lib/v4/atelier-store").AtelierCriterion => ({
        id: crit.id, label: crit.label, description: crit.description,
        importance: crit.importance, poids: IMP_TO_POIDS[crit.importance as ImportanceBadge] ?? 15,
        children: (crit.children ?? []).map(mapIndicator),
      });
      const criteria = model.criteria.map(obj => ({
        id: obj.id, label: obj.label, description: obj.description, besoinTrace: obj.besoinTrace, nature: obj.nature,
        importance: obj.importance, poids: IMP_TO_POIDS[obj.importance as ImportanceBadge] ?? 25,
        children: (obj.children ?? []).map(mapCriterion),
      }));
      const leviersDef = model.leviers.map(lev => ({
        id: lev.id, label: lev.label, type: lev.type,
        options: lev.options.map(opt => ({ id: opt.id, label: opt.label, exploratoire: opt.exploratoire, justification: opt.justification, incompatibleAvec: opt.incompatibleAvec, impacts: {} as Record<string, import("../lib/v4/atelier-store").QualitativeImpact> })),
      }));
      onUpdate({ criteria, leviersDef, discriminatingQuestions: [], discriminatingAnswers: {} });
    } catch {
      setAuraMsgs(prev => [...prev, { role: "aura" as const, text: "La génération du modèle a échoué (réponse indisponible ou incomplète). Réessayez, ou complétez les critères et leviers manuellement ci-dessous — aucun modèle générique n'a été substitué à votre demande." }]);
    } finally { setGenerating(false); }
  }

  async function generateAdaptiveQuestions(
    ctx: string, type: string,
    criteria: import("../lib/v4/atelier-store").AtelierCriterion[],
    leviersDef: import("../lib/v4/atelier-store").AtelierLevierDef[],
  ) {
    setGeneratingQuestions(true);
    try {
      const { generateDiscriminatingQuestions } = await import("../lib/v4/atelier-llm");
      function flatLabels(cs: import("../lib/v4/atelier-store").AtelierCriterion[]): string[] {
        return cs.flatMap(c => [c.label, ...flatLabels(c.children ?? [])]);
      }
      const qs = await generateDiscriminatingQuestions({
        data: {
          context: ctx,
          problemType: type,
          criteriaLabels: flatLabels(criteria),
          levierLabels: leviersDef.map(l => l.label),
          companyContext,
          domainExpertiseHint: embeddedDomainExpertise,
        },
      });
      onUpdate({ discriminatingQuestions: qs });
    } catch { /* silently ignore */ }
    finally { setGeneratingQuestions(false); }
  }

  // ── Criteria helpers (tree-aware) ─────────────────────────────────────────
  function setCritOrdinal(id: string, key: string) {
    const lvl = ORD_LEVELS.find(l => l.key === key)!;
    onUpdate({ criteria: updateCritDeep(session.criteria, id, c => ({ ...c, poids: lvl.poids, importance: lvl.importance, locked: true })) });
  }

  function updateCritLabel(id: string, label: string) {
    onUpdate({ criteria: updateCritDeep(session.criteria, id, c => ({ ...c, label, locked: true })) });
  }

  function updateCritDesc(id: string, description: string) {
    onUpdate({ criteria: updateCritDeep(session.criteria, id, c => ({ ...c, description })) });
  }

  function addCrit() {
    onUpdate({ criteria: [...session.criteria, { id: `c${Date.now()}`, label: "Nouveau critère", poids: 15, description: "", importance: "Secondaire" as ImportanceBadge, level: "MOE" as const }] });
  }

  function addChildCrit(parentId: string) {
    const child: AtelierCriterion = { id: `c${Date.now()}`, label: "Sous-critère", poids: 15, description: "", importance: "Secondaire" as ImportanceBadge, level: "TPM" as const };
    onUpdate({ criteria: addChildDeep(session.criteria, parentId, child) });
  }

  function removeCrit(id: string) {
    onUpdate({ criteria: removeCritDeep(session.criteria, id) });
  }

  // ── LevierDef helpers ─────────────────────────────────────────────────────
  function addLevier() {
    const lev: import("../lib/v4/atelier-store").AtelierLevierDef = {
      id: `ld${Date.now()}`, label: "Nouveau levier", type: "autre", options: [],
    };
    onUpdate({ leviersDef: [...leviersDef, lev] });
  }

  function updateLevier(id: string, patch: Partial<import("../lib/v4/atelier-store").AtelierLevierDef>) {
    onUpdate({ leviersDef: leviersDef.map(l => l.id === id ? { ...l, ...patch } : l) });
  }

  function removeLevier(id: string) {
    onUpdate({ leviersDef: leviersDef.filter(l => l.id !== id) });
  }

  function addOption(levId: string) {
    if (!newOptText.trim()) return;
    const newOpt: import("../lib/v4/atelier-store").AtelierOptionDef = {
      id: `opt_${levId}_${Date.now()}`, label: newOptText.trim(), impacts: {},
    };
    onUpdate({ leviersDef: leviersDef.map(l => l.id === levId ? { ...l, options: [...l.options, newOpt] } : l) });
    setNewOptText("");
    setNewOptId(null);
  }

  function removeOption(levId: string, optId: string) {
    onUpdate({ leviersDef: leviersDef.map(l => l.id === levId ? { ...l, options: l.options.filter(o => o.id !== optId) } : l) });
  }

  // Le modèle validé suffit : la description libre n'est qu'une des voies d'entrée
  // (l'autre étant l'entretien guidé, qui remplit directement critères et leviers).
  const canNext = (session.contextRaw ?? "").trim().length > 10
    || (!!session.modelValidated && session.criteria.length > 0);

  // Count model elements for validation banner
  function countNodesByLevel(criteria: AtelierCriterion[], depth = 0): { objectives: number; leafCriteria: number } {
    let objectives = 0, leafCriteria = 0;
    for (const c of criteria) {
      if (depth === 0) objectives++;
      if (!c.children?.length) leafCriteria++;
      else {
        const sub = countNodesByLevel(c.children, depth + 1);
        leafCriteria += sub.leafCriteria;
      }
    }
    return { objectives, leafCriteria };
  }
  const { objectives: countObjectives, leafCriteria: countLeafCriteria } = countNodesByLevel(session.criteria);
  const countLeviers = (session.leviersDef ?? []).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Le dialogue persistant est l'unique point d'entrée. Ce déclencheur
          technique lui permet d'ouvrir ici le recueil guidé sans dupliquer Aura. */}
      <button
        type="button"
        data-testid="understand-guided-flow"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => setCompanionSignal(n => n + 1)}
        style={{ display: "none" }}
      />

      <ElicitationFlow
        session={session}
        onUpdate={onUpdate}
        openCompanionSignal={companionSignal}
        embeddedSuggestions={embeddedSuggestions}
        embeddedDomainExpertise={embeddedDomainExpertise}
        onGenerate={() => {
          const elicitCtx = buildElicitationContextLocal();
          const text = (session.contextRaw || "") + elicitCtx;
          analyse(text);
        }}
        generating={generating || classifying}
      />

      {/* Model validation banner */}
      {session.criteria.length > 0 && !session.modelValidated && (
        <div style={{
          borderRadius: 8, border: "1.5px solid var(--v4-accent-border)", background: "var(--v4-accent-bg)",
          padding: "12px 16px", display: "flex", alignItems: "center", gap: 12,
        }}>
          <span style={{ fontSize: 15.5 }}></span>
          <div style={{ flex: 1 }}>
            <div data-testid="comprendre-modele-resume" style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-accent)" }}>
              Modèle généré — {countObjectives} objectif{countObjectives !== 1 ? "s" : ""} · {countLeafCriteria} indicateur{countLeafCriteria !== 1 ? "s" : ""} · {countLeviers} levier{countLeviers !== 1 ? "s" : ""}
            </div>
            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 2 }}>
              Vérifiez et ajustez ci-dessous, puis validez pour passer à l'évaluation des impacts.
            </div>
          </div>
          <button onClick={() => onUpdate({ modelValidated: true })}
            style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
            Valider ce modèle →
          </button>
        </div>
      )}

      {/* ── Arbre en premier : importance réglable + rapprochement leviers ↔ indicateurs ── */}
      {session.criteria.length > 0 && !generating && (
        <ComprendreArbreLeviers criteria={session.criteria} leviers={leviersDef} onSetOrdinal={setCritOrdinal} />
      )}

      {/* ── Synthèse IA de la problématique (après génération) ── */}
      {session.criteria.length > 0 && (() => {
        const e = session.elicitation;
        if (!e || !e.objectif) return null;
        const ct = CASE_TYPES.find(c => c.id === session.caseType);
        const decideurs = e.decideurs ? `${e.decideurs}` : "l'équipe décisionnaire";
        const impactes = e.impactes ? `, avec impact sur ${e.impactes}` : "";
        const horizon = e.horizon ? ` à l'horizon ${e.horizon}` : "";
        const exig = e.exigencesNonNeg ? ` Les exigences non-négociables sont : ${e.exigencesNonNeg}.` : "";
        const leviers = e.leviersDDP ? ` Les leviers d'action identifiés : ${e.leviersDDP}.` : "";
        const contexte = e.contraintesDIP ? ` Facteurs de contexte imposés : ${e.contraintesDIP}.` : "";
        const risques = e.risques?.length ? ` Risques identifiés : ${e.risques.join(", ")}.` : "";
        const modelSummary = `${session.criteria.length} objectifs · ${session.criteria.reduce((s, c) => s + (c.children?.length ?? 0), 0)} critères · ${session.leviersDef?.length ?? 0} leviers d'action`;
        const text = `Décision de type « ${ct?.label ?? session.caseType ?? "stratégique"} » — ${decideurs} arbitrent${horizon} : ${e.objectif}.${exig}${leviers}${contexte}${risques} Modèle Aura : ${modelSummary}.`;
        return (
          <div style={{ borderRadius: 8, border: "1px solid #2b2b2b28", background: "#2b2b2b06", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.7 }}>✦</span>
            <div style={{ flex: 1 }}>
              <details>
                <summary style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#6366f1", cursor: "pointer" }} title="Si cette formulation ne reflète pas exactement votre situation, ajustez les réponses du questionnaire ci-dessus puis régénérez le modèle.">Synthèse de la problématique</summary>
                <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.6, marginTop: 5 }}>{text}</div>
              </details>
            </div>
          </div>
        );
      })()}

      {/* ── Bandeau Facteurs de contexte non maîtrisables ── */}
      {(() => {
        const dipRaw = session.elicitation?.contraintesDIP;
        const dip = (typeof dipRaw === "string" ? dipRaw : Array.isArray(dipRaw) ? (dipRaw as string[]).join(", ") : "").trim();
        if (!dip || !session.criteria.length) return null;
        const items = splitItemsRespectingParens(dip);
        return (
          <div style={{ borderRadius: 8, border: "1px solid #dc262628", background: "#dc262605", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ fontSize: 13, flexShrink: 0, opacity: 0.7 }}>⊘</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#dc2626", marginBottom: 12 }}>Facteurs de contexte — non maîtrisables</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {items.map((c, i) => (
                  <span key={i} style={{ fontSize: 12, color: "var(--v4-text2)", background: "#dc262610", border: "1px solid #dc262620", borderRadius: 6, padding: "2px 7px" }}>
                    {c}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 5, fontStyle: "italic" }}>
                Ces facteurs s'imposent au décideur et ne figurent pas comme leviers d'évaluation.
              </div>
            </div>
          </div>
        );
      })()}

      {/* Row 2 — Indicateurs déduits */}
      <Encart icon="" title="Indicateurs déduits" hint="Objectifs → Critères → Indicateurs. Libellés et importance modifiables." collapsible defaultOpen={!session.criteria.length}
        headerRight={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", borderRadius: 6, border: "1px solid var(--v4-border)", overflow: "hidden" }}>
              {(["list", "map"] as const).map(v => (
                <button key={v} onClick={() => setTreeView(v)}
                  style={{
                    padding: "3px 10px", border: "none", fontFamily: "inherit",
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                    background: treeView === v ? "var(--v4-accent,#7c3aed)" : "transparent",
                    color: treeView === v ? "#fff" : "var(--v4-text3)",
                    transition: "all .12s",
                  }}>
                  {v === "list" ? "☰ Table" : " Arbre"}
                </button>
              ))}
            </div>
            {treeView === "list" && (
              <button onClick={() => setExpertMode(v => !v)}
                title={expertMode ? "Masquer les libellés détaillés" : "Afficher les libellés de niveau : Objectif stratégique / Dimension de performance / Facteur observable"}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6,
                  border: `1px solid ${expertMode ? "#6750a4" : "var(--v4-border)"}`,
                  background: expertMode ? "#6750a415" : "transparent",
                  color: expertMode ? "#6750a4" : "var(--v4-text3)",
                  fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700, transition: "all .15s" }}>
                Vue détaillée{expertMode ? " ✓" : ""}
              </button>
            )}
          </div>
        }>
        {generating ? (
          <div style={{ textAlign: "center", padding: 20, color: "var(--v4-text3)", fontSize: 13 }}>Génération en cours…</div>
        ) : session.criteria.length === 0 ? (
          <div style={{ padding: "12px 0", color: "var(--v4-text3)", fontSize: 13 }}>
            Aucun critère. Complétez le cadrage ci-dessus puis <strong style={{ color: "var(--v4-text2)" }}>Construire mon modèle de décision</strong>, ou ajoutez-les manuellement.
          </div>
        ) : treeView === "map" ? (
          <CriteriaObjectiveTree
            session={session}
            onAddChild={addChildCrit}
            onRemove={removeCrit}
            onSetOrdinal={setCritOrdinal}
            onUpdateLabel={updateCritLabel}
          />
        ) : (
          <CriteriaTree
            criteria={session.criteria}
            onSetOrdinal={setCritOrdinal}
            onUpdateLabel={updateCritLabel}
            onUpdateDesc={updateCritDesc}
            onRemove={removeCrit}
            onAddChild={addChildCrit}
            expertMode={expertMode}
          />
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={addCrit}
            style={{ padding: "6px 14px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            + Critère
          </button>
          {session.criteria.length > 0 && (
            <button onClick={async () => {
              setGenerating(true);
              try {
                const { generateFullModel } = await import("../lib/v4/atelier-llm");
                const { ensureRichModel } = await import("../lib/v4/comprendre-fallback");
                const model = ensureRichModel(await generateFullModel({ data: { context: session.contextEnriched ?? session.contextRaw, problemType: session.problemType ?? "", dimensions: session.dimensions ?? [], companyContext, domainExpertiseHint: embeddedDomainExpertise } }), { context: session.contextRaw, elicitation: session.elicitation as ElicitationData | undefined, supplyChain: !!embeddedDomainExpertise, sector: session.sector });
                const mapInd = (ind: import("../lib/v4/atelier-llm").GeneratedIndicator): AtelierCriterion => ({ id: ind.id, label: ind.label, description: ind.description, modelisable: ind.modelisable, importance: ind.importance, poids: IMP_TO_POIDS[ind.importance as ImportanceBadge] ?? 15, exploratoire: ind.exploratoire });
                const mapCrit = (crit: import("../lib/v4/atelier-llm").GeneratedCriterion): AtelierCriterion => ({ id: crit.id, label: crit.label, description: crit.description, importance: crit.importance, poids: IMP_TO_POIDS[crit.importance as ImportanceBadge] ?? 15, children: (crit.children ?? []).map(mapInd) });
                const criteria = model.criteria.map(obj => ({ id: obj.id, label: obj.label, description: obj.description, besoinTrace: obj.besoinTrace, nature: obj.nature, importance: obj.importance, poids: IMP_TO_POIDS[obj.importance as ImportanceBadge] ?? 25, children: (obj.children ?? []).map(mapCrit) }));
                const leviersDef = model.leviers.map(lev => ({ id: lev.id, label: lev.label, type: lev.type, options: lev.options.map(opt => ({ id: opt.id, label: opt.label, exploratoire: opt.exploratoire, justification: opt.justification, incompatibleAvec: opt.incompatibleAvec, impacts: {} as Record<string, import("../lib/v4/atelier-store").QualitativeImpact> })) }));
                onUpdate({ criteria, leviersDef });
              } catch { setAuraMsgs(prev => [...prev, { role: "aura" as const, text: "La régénération a échoué — votre modèle actuel est conservé tel quel." }]); }
              finally { setGenerating(false); }
            }}
              style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid var(--v4-accent-border)", background: "var(--v4-accent-bg)", color: "var(--v4-accent)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ✦ Regénérer le modèle complet
            </button>
          )}
          {session.criteria.length >= 2 && (
            <button onClick={() => setCalibrating(v => !v)}
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${calibrating ? "#6366f1" : "#6366f150"}`, background: calibrating ? "#6366f112" : "transparent", color: "#6366f1", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              ⇄ Calibrer l'importance
            </button>
          )}
          {session.criteria.length >= 2 && <div style={{ marginLeft: "auto" }}><RadarWithLevelSelector allCriteria={session.criteria} onEdit={() => setCalibrating(true)} /></div>}
        </div>
        {calibrating && session.criteria.length >= 2 && (
          <ImportanceCalibrator
            criteria={session.criteria}
            onClose={() => setCalibrating(false)}
            onApply={imp => {
              onUpdate({ criteria: session.criteria.map(c => imp[c.id]
                ? { ...c, importance: imp[c.id], poids: IMP_TO_POIDS[imp[c.id]] ?? c.poids, locked: true }
                : c) });
              setCalibrating(false);
            }}
          />
        )}
      </Encart>

      {/* Row 4 — Leviers & options */}
      <Encart icon="" title="Leviers & options déduits" hint="Variables d'action et leurs options — impacts évalués dans Arbitrer" collapsible defaultOpen={!leviersDef.length}>
        {leviersDef.length === 0 ? (
          <div style={{ color: "var(--v4-text3)", fontSize: 13, padding: "4px 0 8px" }}>
            Aucun levier. Ajoutez les paramètres clés de votre décision.
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(embeddedDomainExpertise ? [
                { label: "Stratégie de sourcing", type: "decision" as LeverType, options: ["Fournisseur actuel", "Double sourcing", "Fournisseur de secours qualifié"] },
                { label: "Stock de sécurité", type: "ressource" as LeverType, options: ["Inchangé", "Renforcé sur les références critiques", "Stock avancé près des clients"] },
                { label: "Mode de transport", type: "technique" as LeverType, options: ["Mode actuel", "Accéléré", "Itinéraire alternatif"] },
              ] : [
                { label: "Procédé de fabrication", type: "technique" as LeverType, options: ["Usinage CN", "Drapage + autoclave", "Fonderie"] },
                { label: "Budget alloué", type: "budget" as LeverType, options: ["< 10M€", "10–30M€", "> 30M€"] },
                { label: "Calendrier", type: "temps" as LeverType, options: ["12 mois", "24 mois", "36 mois"] },
              ]).map(ex => (
                <button key={ex.label} onClick={() => { const lid = `ld${Date.now()}`; onUpdate({ leviersDef: [...leviersDef, { id: lid, label: ex.label, type: ex.type, options: ex.options.map((o, i) => ({ id: `opt_${lid}_${i}`, label: o, impacts: {} })) }] }); }}
                  style={{ fontSize: 12, padding: "3px 9px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>
                  + {ex.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12 }}>
            {leviersDef.map((lev, li) => {
              const tc = { color: leverColor(li) };
              return (
                <div key={lev.id} data-testid="comprendre-levier" style={{ borderRadius: 12, border: `1px solid ${tc.color}40`, borderLeft: `4px solid ${tc.color}`, background: `linear-gradient(135deg, ${tc.color}0d, var(--v4-surface) 70%)`, overflow: "hidden", boxShadow: "none" }}>
                  {/* Header */}
                  <div style={{ padding: "8px 11px 7px", background: "transparent", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 7 }}>
                    <span aria-hidden style={{ width: 10, height: 10, borderRadius: 3, background: tc.color, flexShrink: 0 }} />
                    <AuraIcon e={LEVER_ICONS[lev.type]} size={14} />
                    <div contentEditable suppressContentEditableWarning
                      onBlur={e => updateLevier(lev.id, { label: e.currentTarget.textContent ?? lev.label })}
                      style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--v4-text)", outline: "none", lineHeight: 1.3 }}>
                      {lev.label}
                    </div>
                    <select value={lev.type} onChange={e => updateLevier(lev.id, { type: e.target.value as LeverType })}
                      style={{ fontSize: 12, border: "1px solid var(--v4-border)", borderRadius: 6, background: "transparent", color: "var(--v4-text3)", padding: "2px 3px", fontFamily: "inherit", cursor: "pointer", flexShrink: 0 }}>
                      {(["technique","budget","ressource","temps","risque","decision","autre"] as LeverType[]).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <button onClick={() => removeLevier(lev.id)}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: "0 1px", fontFamily: "inherit", opacity: 0.45, lineHeight: 1 }}>✕</button>
                  </div>
                  {/* Options as colored pills */}
                  <div style={{ padding: "8px 11px", display: "flex", flexWrap: "wrap", gap: 5, alignItems: "flex-start", minHeight: 42 }}>
                    {lev.options.map((opt, oi) => (
                      <span key={opt.id} data-testid="comprendre-option" style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 3 }}>
                        <span onClick={() => opt.justification && setOriginOptId(v => v === opt.id ? null : opt.id)} style={{
                          display: "inline-flex", alignItems: "center", gap: 4,
                          fontSize: 13.5, padding: "5px 11px", borderRadius: 9,
                          background: oi === 0 ? tc.color : `${tc.color}14`,
                          color: oi === 0 ? "#fff" : "var(--v4-text)",
                          border: `1px solid ${oi === 0 ? tc.color : `${tc.color}55`}`,
                          boxShadow: oi === 0 ? `0 4px 12px ${tc.color}40` : "none",
                          fontWeight: oi === 0 ? 700 : 550,
                          transition: "all .1s",
                          cursor: opt.justification ? "pointer" : "default",
                        }}>
                          {opt.exploratoire && <LampBadge compact />}
                          {opt.label}
                          {opt.justification && <span style={{ fontSize: 12, opacity: 0.7 }}>ⓘ</span>}
                          <button onClick={e => { e.stopPropagation(); removeOption(lev.id, opt.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: oi === 0 ? "rgba(255,255,255,.7)" : "var(--v4-text3)", fontSize: 12, padding: 0, lineHeight: 1, fontFamily: "inherit", opacity: 0.7 }}>✕</button>
                        </span>
                        {originOptId === opt.id && opt.justification && (
                          <span style={{ maxWidth: 260, padding: "5px 9px", borderRadius: 8, background: "#6366f108", border: "1px solid #6366f125", fontSize: 12, color: "var(--v4-text2)", lineHeight: 1.45, fontStyle: "italic" }}>
                            {opt.justification}
                          </span>
                        )}
                      </span>
                    ))}
                    {/* Add option inline */}
                    {newOptId === lev.id ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <input autoFocus value={newOptText} onChange={e => setNewOptText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") addOption(lev.id); if (e.key === "Escape") { setNewOptId(null); setNewOptText(""); }}}
                          placeholder="Option…"
                          style={{ fontSize: 13, border: "1px solid var(--v4-border)", borderRadius: 6, padding: "3px 8px", background: "var(--v4-bg)", color: "var(--v4-text)", fontFamily: "inherit", outline: "none", width: 100 }} />
                        <button onClick={() => addOption(lev.id)}
                          style={{ fontSize: 12, padding: "3px 8px", borderRadius: 6, border: "none", background: "var(--v4-text)", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                          OK
                        </button>
                      </span>
                    ) : (
                      <button onClick={() => { setNewOptId(lev.id); setNewOptText(""); }}
                        style={{ fontSize: 12, padding: "3px 9px", borderRadius: 6, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", opacity: 0.8 }}>
                        + option
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <button onClick={addLevier}
          style={{ marginTop: 10, padding: "5px 12px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          + Levier
        </button>
      </Encart>


      {/* Notes équipe */}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
        {session.criteria.length > 0 ? (
          <button type="button" data-testid="comprendre-precedent-modele"
            onClick={() => { onUpdate({ modelValidated: false }); if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" }); }}
            title="Revenir aux questions du cadrage — vos réponses et le modèle sont conservés"
            style={{ padding: "10px 18px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ← Précédent : questions
          </button>
        ) : <span />}
        <button onClick={onNext} disabled={!canNext}
          style={{
            padding: "10px 28px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: canNext ? "pointer" : "not-allowed", fontFamily: "inherit",
            opacity: canNext ? 1 : 0.45,
          }}>
          Impacter →
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Impacter — matrice option × critère ──────────────────────────────
// Cycle order for user click: ? → + → ++ → 0 → - → -- → ? (PS/NS scale, Lo thesis)
// "U" (Inconnu) est le point de départ : une cellule non renseignée est une ignorance, pas un effet neutre.
const IMPACT_CYCLE: QualitativeImpact[] = ["U", "+", "++", "0", "-", "--"];

function cycleNext(current: QualitativeImpact): QualitativeImpact {
  const i = IMPACT_CYCLE.indexOf(current);
  return IMPACT_CYCLE[(i + 1) % IMPACT_CYCLE.length];
}

function ImpactCell({ value, origin, onClick }: { value: QualitativeImpact; origin?: ImpactOrigin; onClick: () => void }) {
  const cfg = QUAL_IMPACT_LABELS[value];
  const isPos = ["++", "+", "L+"].includes(value);
  const isNeg = ["--", "-", "L-"].includes(value);
  const originTitle = origin === "aura-llm" ? "Hypothèse Aura (analyse) — confirmez ou corrigez d'un clic"
    : origin === "aura-heuristique" ? "Hypothèse Aura (heuristique locale) — confirmez ou corrigez d'un clic"
    : cfg.title;
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <button onClick={onClick} title={originTitle}
        style={{
          minWidth: 42, padding: "5px 9px", borderRadius: 8,
          border: origin ? "1.5px dashed #8b5cf6" : "none",
          background: isPos ? cfg.color + "22" : isNeg ? cfg.color + "22" : value === "U" ? cfg.color + "18" : "var(--v4-bg)",
          color: cfg.color, fontWeight: 800, fontSize: 13, cursor: "pointer",
          fontFamily: "inherit", transition: "all .1s",
          outline: !origin && value !== "0" ? `1.5px solid ${cfg.color}44` : "none",
        }}>
        {cfg.label}
      </button>
      {origin && (
        <span style={{ position: "absolute", top: -5, right: -4, fontSize: 12, color: "#8b5cf6", pointerEvents: "none" }}>✦</span>
      )}
    </span>
  );
}

function StepImpacter({ session, onUpdate, onNext, onBack, setAuraMsgs, setAuraLoading }: {
  session: AtelierSession;
  onUpdate: (patch: Partial<AtelierSession>) => void;
  onNext: () => void;
  onBack: () => void;
  setAuraMsgs: (m: AuraMsg[] | ((p: AuraMsg[]) => AuraMsg[])) => void;
  setAuraLoading: (v: boolean) => void;
}) {
  const [prefilling, setPrefilling] = useState(false);

  function updateImpact(levId: string, optId: string, critId: string, value: QualitativeImpact) {
    onUpdate({
      leviersDef: session.leviersDef.map(l =>
        l.id === levId
          ? { ...l, options: l.options.map(o => {
              if (o.id !== optId) return o;
              // Toute action humaine sur la cellule valide/remplace le jugement — l'origine Aura est levée.
              const { [critId]: _removed, ...restOrigins } = o.impactOrigins ?? {};
              return { ...o, impacts: { ...o.impacts, [critId]: value }, impactOrigins: restOrigins };
            })}
          : l
      ),
    });
  }

  function cycleImpact(levId: string, optId: string, critId: string) {
    const lev = session.leviersDef.find(l => l.id === levId);
    const opt = lev?.options.find(o => o.id === optId);
    const current = (opt?.impacts[critId] ?? "U") as QualitativeImpact;
    updateImpact(levId, optId, critId, cycleNext(current));
  }

  function localImpactHeuristic(
    levers: AtelierLevierDef[],
    criteria: Array<{ id: string; label: string; importance?: string }>,
  ): Record<string, Record<string, QualitativeImpact>> {
    const out: Record<string, Record<string, QualitativeImpact>> = {};
    for (const lev of levers) {
      const nOpts = lev.options.length;
      for (let oi = 0; oi < nOpts; oi++) {
        const opt = lev.options[oi];
        out[opt.id] = {};
        const ol = opt.label.toLowerCase();
        const isHigh = /renforcé|ambitieux|optimiste|élevé|accéléré|fort|maximal|complet|intensif|premium|total|intégr|global|étendu|large|expert|plus/.test(ol);
        const isLow = /minimal|prudent|réduit|faible|standard|conservat|limité|allégé|basique|simple|léger|retrait|moins/.test(ol);
        const posRatio = nOpts > 1 ? oi / (nOpts - 1) : 0.5;
        const polarity: 1 | 0 | -1 = isHigh ? 1 : isLow ? -1 : posRatio >= 0.6 ? 1 : posRatio <= 0.3 ? -1 : 0;

        for (const crit of criteria) {
          const cl = crit.label.toLowerCase();
          const lt = lev.type;
          let qi: QualitativeImpact = "0";

          // Budget lever: high budget = better performance, higher cost
          if (lt === "budget") {
            if (/coût|budget|investiss|financ|prix|opex|capex/.test(cl)) {
              qi = polarity === 1 ? "--" : polarity === -1 ? "++" : "-";
            } else {
              qi = polarity === 1 ? "+" : polarity === -1 ? "-" : "0";
            }
          // Time/speed lever: faster = worse quality, better time-to-market
          } else if (lt === "temps") {
            if (/qualité|robustesse|fiabilité|maturité|précision|rigueur/.test(cl)) {
              qi = polarity === 1 ? "--" : polarity === -1 ? "+" : "0";
            } else if (/délai|temps|rapidité|livraison|time/.test(cl)) {
              qi = polarity === 1 ? "++" : polarity === -1 ? "--" : "0";
            } else {
              qi = polarity === 1 ? "-" : polarity === -1 ? "+" : "0";
            }
          // Risk lever: higher coverage = less risk, more cost
          } else if (lt === "risque") {
            if (/risque|conformité|sécurité|fiabilité|sûreté/.test(cl)) {
              qi = polarity === 1 ? "++" : polarity === -1 ? "--" : "+";
            } else if (/coût|budget/.test(cl)) {
              qi = polarity === 1 ? "--" : polarity === -1 ? "++" : "-";
            } else {
              qi = polarity === 1 ? "+" : polarity === -1 ? "-" : "0";
            }
          // Resource lever: more resources = better quality/time, higher cost
          } else if (lt === "ressource") {
            if (/coût|budget/.test(cl)) {
              qi = polarity === 1 ? "--" : polarity === -1 ? "++" : "-";
            } else {
              qi = polarity === 1 ? "+" : polarity === -1 ? "-" : "0";
            }
          // Technical lever: more advanced = better perf, more complex/costly
          } else if (lt === "technique") {
            if (/coût|budget|complexité/.test(cl)) {
              qi = polarity === 1 ? "--" : polarity === -1 ? "+" : "0";
            } else if (/performance|qualité|capacité|fiabilité/.test(cl)) {
              qi = polarity === 1 ? "++" : polarity === -1 ? "-" : "+";
            } else {
              qi = polarity === 1 ? "+" : polarity === -1 ? "-" : "0";
            }
          // Decision/autre lever: generic positive correlation
          } else {
            qi = polarity === 1 ? "+" : polarity === -1 ? "-" : "0";
          }

          // Essential criteria get stronger impacts
          if (crit.importance === "Essentiel" && (qi === "+" || qi === "-")) {
            qi = qi === "+" ? "++" : "--";
          }

          out[opt.id][crit.id] = qi;
        }
      }
    }
    return out;
  }

  async function prefillWithAI() {
    setPrefilling(true);
    setAuraLoading(true);
    try {
      const leafCrit = getLeafCriteria(session.criteria).map(c => ({ id: c.id, label: c.label, importance: c.importance }));
      let rr: Record<string, Record<string, QualitativeImpact>> = {};
      let source: ImpactOrigin = "aura-heuristique";

      // Try LLM first
      try {
        const { suggestImpacts } = await import("../lib/v4/atelier-llm");
        const r = await suggestImpacts({
          data: {
            context: session.contextEnriched ?? session.contextRaw ?? "",
            levers: session.leviersDef.map(l => ({
              id: l.id, label: l.label,
              options: l.options.map(o => ({ id: o.id, label: o.label })),
            })),
            criteria: leafCrit.map(c => ({ id: c.id, label: c.label })),
          },
        }) as Record<string, Record<string, QualitativeImpact>>;
        // Only use LLM result if it has content
        const hasContent = Object.keys(r).length > 0 && Object.values(r).some(v => Object.keys(v).length > 0);
        if (hasContent) { rr = r; source = "aura-llm"; }
      } catch { /* fall through to heuristic */ }

      // Complète systématiquement les trous laissés par le LLM (option ou critère
      // non couvert) avec l'heuristique locale, afin d'atteindre une couverture
      // à 100% — chaque hypothèse reste marquée par sa source réelle (aura-llm
      // ou aura-heuristique), jamais fusionnée en une origine unique trompeuse.
      const heuristic = localImpactHeuristic(session.leviersDef, leafCrit);
      const merged: Record<string, Record<string, QualitativeImpact>> = {};
      const originByCell: Record<string, Record<string, ImpactOrigin>> = {};
      for (const lev of session.leviersDef) {
        for (const opt of lev.options) {
          merged[opt.id] = { ...heuristic[opt.id] };
          originByCell[opt.id] = {};
          for (const cid of Object.keys(merged[opt.id])) originByCell[opt.id][cid] = "aura-heuristique";
          const llmForOpt = rr[opt.id];
          if (llmForOpt) {
            for (const [cid, val] of Object.entries(llmForOpt)) {
              merged[opt.id][cid] = val;
              originByCell[opt.id][cid] = "aura-llm";
            }
          }
        }
      }
      rr = merged;

      // Les saisies humaines existantes ne sont JAMAIS écrasées par le préremplissage.
      let filled = 0, skipped = 0, filledLlm = 0, filledHeur = 0;
      onUpdate({
        leviersDef: session.leviersDef.map(l => ({
          ...l,
          options: l.options.map(o => {
            const suggested = rr[o.id] ?? {};
            const newImpacts = { ...o.impacts };
            const newOrigins = { ...(o.impactOrigins ?? {}) };
            for (const [critId, val] of Object.entries(suggested)) {
              if (o.impacts[critId] !== undefined && newOrigins[critId] === undefined) { skipped++; continue; }
              newImpacts[critId] = val;
              const cellSource = originByCell[o.id]?.[critId] ?? "aura-heuristique";
              newOrigins[critId] = cellSource;
              filled++;
              if (cellSource === "aura-llm") filledLlm++; else filledHeur++;
            }
            return { ...o, impacts: newImpacts, impactOrigins: newOrigins };
          }) as AtelierOptionDef[],
        })),
      });
      const detail = filledLlm > 0 && filledHeur > 0
        ? ` (${filledLlm} par analyse Aura, ${filledHeur} par heuristique locale)`
        : filledLlm > 0 ? " par analyse Aura" : " par heuristique locale Aura";
      setAuraMsgs(prev => [...prev, { role: "aura" as const, text: `${filled} hypothèse${filled > 1 ? "s" : ""} posée${filled > 1 ? "s" : ""}${detail} — couverture complète (marquée${filled > 1 ? "s" : ""} ✦)${skipped > 0 ? ` — ${skipped} cellule${skipped > 1 ? "s" : ""} déjà renseignée${skipped > 1 ? "s" : ""} par vous, non touchée${skipped > 1 ? "s" : ""}` : ""}. Confirmez ou corrigez chaque ✦ d'un clic : votre jugement remplace l'hypothèse.` }]);
    } catch {
      setAuraMsgs(prev => [...prev, { role: "aura" as const, text: "Pré-remplissage indisponible — saisissez manuellement." }]);
    } finally {
      setPrefilling(false);
      setAuraLoading(false);
    }
  }

  const hasLevers = session.leviersDef.length > 0;
  const hasCriteria = session.criteria.length > 0;
  const canNext = hasLevers && hasCriteria;
  const leafCriteria = getLeafCriteria(session.criteria);
  const [showRationale, setShowRationale] = useState(false);

  // ── Dicter la matrice : Aura demande l'effet, à l'oral, cellule par cellule ──
  // Aucun chiffre : la réponse parlée est ramenée à l'échelle ordinale du modèle.
  const [impCompanionOpen, setImpCompanionOpen] = useState(false);
  const [impOnlyEmpty, setImpOnlyEmpty] = useState(true);
  const impactSteps: CompanionStep[] = [];
  for (const lev of session.leviersDef) {
    for (const opt of lev.options) {
      for (const crit of leafCriteria) {
        const cur = (opt.impacts[crit.id] ?? "U") as QualitativeImpact;
        const isAura = !!opt.impactOrigins?.[crit.id];
        if (impOnlyEmpty && cur !== "U" && !isAura) continue;
        impactSteps.push({
          id: `${opt.id}__${crit.id}`,
          group: `${lev.label} · ${opt.label}`,
          question: `Effet de « ${opt.label} » sur « ${crit.label} » ?`,
          hint: "Très favorable, favorable, neutre, défavorable, très défavorable — ou « je ne sais pas ».",
          current: cur === "U" ? undefined : QUAL_IMPACT_LABELS[cur]?.title,
          suggest: isAura ? () => QUAL_IMPACT_LABELS[cur]?.title ?? null : undefined,
          suggestSource: isAura ? "hypothèse Aura, à confirmer" : undefined,
          apply: t => { const v = matchImpactScale(t); if (v) updateImpact(lev.id, opt.id, crit.id, v); },
        });
      }
    }
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
        <div style={{ flex: 1 }} />
        {impactSteps.length > 0 && (
          <button type="button" data-testid="impact-guided-flow" aria-hidden="true" tabIndex={-1}
            onClick={() => { setImpOnlyEmpty(true); setImpCompanionOpen(true); }} style={{ display: "none" }} />
        )}
        <button onClick={prefillWithAI} disabled={prefilling || !hasLevers}
          style={{
            padding: "5px 14px", borderRadius: 8, border: "1.5px solid var(--v4-accent-border)",
            background: "var(--v4-accent-bg)", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700,
            cursor: "pointer", fontFamily: "inherit", opacity: prefilling || !hasLevers ? 0.5 : 1,
          }}>
          {prefilling ? "Pré-remplissage…" : "✦ Pré-remplir avec Aura"}
        </button>
        <button type="button" onClick={() => setShowRationale(v => !v)} aria-expanded={showRationale} aria-label="Comment fonctionne le pré-remplissage Aura" title="Comment fonctionne le pré-remplissage Aura"
          style={{ width: 28, height: 28, borderRadius: 14, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-accent)", fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>?</button>
      </div>
      <CompagnonAura
        open={impCompanionOpen}
        onClose={() => setImpCompanionOpen(false)}
        steps={impactSteps}
        title="Évaluer les impacts"
        contextPrompt="Jugement qualitatif de l'effet d'une option sur un critère : très favorable, favorable, neutre, défavorable, très défavorable, inconnu." />
      {/* Rationnel du pré-remplissage : à la demande (bouton « ? »). */}
      {showRationale && <div style={{ marginBottom: 16, padding: "10px 13px", borderRadius: 8, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", borderLeft: "3px solid var(--v4-accent)" }}>
          <div style={{ fontSize: 12, color: "var(--v4-text3)", lineHeight: 1.6 }}>
            Un impact par option et par critère : cliquez une cellule pour cycler, ou dictez. 
            Aura infère les impacts en combinant trois signaux : le <strong style={{ color: "var(--v4-text2)" }}>type du levier</strong> (budget, temps, ressource, risque, technique…),
            la <strong style={{ color: "var(--v4-text2)" }}>position de l'option</strong> dans la gamme (minimal → renforcé),
            et le <strong style={{ color: "var(--v4-text2)" }}>libellé du critère</strong> (coût, qualité, délai, conformité…).
            Exemple : une option "Budget renforcé" sur un levier budgétaire sera supposée améliorer la performance (
            <span style={{ fontWeight: 800, color: "#059669" }}>+</span>) mais dégrader le coût (
            <span style={{ fontWeight: 800, color: "#dc2626" }}>−</span>).
            <span style={{ display: "block", marginTop: 4, fontStyle: "italic" }}>
              Ces valeurs sont des points de départ à réviser — votre connaissance du contexte prévaut toujours.
            </span>
          </div>
      </div>}

      {/* Legend */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {IMPACT_CYCLE.map(q => {
          const cfg = QUAL_IMPACT_LABELS[q];
          return (
            <div key={q} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--v4-text3)" }}>
              <span title={cfg.title} aria-label={cfg.title} style={{ padding: "1px 5px", borderRadius: 6, background: cfg.color + "22", color: cfg.color, fontWeight: 800, fontSize: 13 }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {!hasLevers || !hasCriteria ? (
        <div style={{ padding: "24px", textAlign: "center", color: "var(--v4-text3)", fontSize: 13, border: "1px dashed var(--v4-border)", borderRadius: 12 }}>
          {!hasCriteria ? "Définissez d'abord les critères dans Comprendre." : "Ajoutez des leviers avec options dans Comprendre."}
        </div>
      ) : (
        // max-height + overflow borne ce conteneur comme le contexte de défilement
        // réel de la table : un position:sticky top:0 sur les <th> exige un ancêtre
        // qui défile vraiment (la CSS force overflow-y à "auto" dès que overflow-x
        // n'est pas "visible", donc laisser ce conteneur sans hauteur bornée le
        // rendait scrollable en théorie mais jamais en pratique — la ligne d'en-tête
        // n'avait donc rien à quoi s'accrocher).
        <div style={{ overflow: "auto", maxHeight: "min(70vh, 640px)", borderRadius: 8, border: "1px solid var(--v4-border)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--v4-surface)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--v4-text3)", fontWeight: 600, borderBottom: "2px solid var(--v4-border)", minWidth: 160, position: "sticky", left: 0, top: 0, background: "var(--v4-surface)", zIndex: 2 }}>
                  Option
                </th>
                {leafCriteria.map(c => (
                  <th key={c.id} style={{ textAlign: "center", padding: "6px 8px", color: "var(--v4-text2)", fontWeight: 600, borderBottom: "2px solid var(--v4-border)", borderLeft: "1px solid var(--v4-border)", minWidth: 80, position: "sticky", top: 0, background: "var(--v4-surface)", zIndex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 2 }}>
                      <ImportancePill badge={c.importance} />
                    </div>
                    <div
                      title={[c.description, c.besoinTrace ? `Besoin tracé : ${c.besoinTrace}` : ""].filter(Boolean).join("\n\n") || "Aucune aide contextuelle renseignée pour cet indicateur."}
                      style={{ fontSize: 12, lineHeight: 1.2, color: "var(--v4-text)", cursor: (c.description || c.besoinTrace) ? "help" : "default", display: "inline-flex", alignItems: "center", gap: 3 }}>
                      {c.label.length > 14 ? c.label.slice(0, 13) + "…" : c.label}
                      {c.exploratoire && <LampBadge compact />}
                      {(c.description || c.besoinTrace) && <span style={{ fontSize: 12, opacity: 0.6 }}>ⓘ</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {session.leviersDef.map((lev, li) => (
                <Fragment key={lev.id}>
                  {/* Lever header row */}
                  <tr key={lev.id + "_hdr"} style={{ background: "var(--v4-accent-bg)" }}>
                    <td colSpan={leafCriteria.length + 1}
                      style={{ padding: "6px 12px", borderTop: li > 0 ? "2px solid var(--v4-accent-border)" : undefined }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }} title={`Levier de type "${lev.type}" — actionnez-le en choisissant l'une de ses options ci-dessous.`}>
                        <AuraIcon e={LEVER_ICONS[lev.type]} size={13} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-accent)", cursor: "help" }}>{lev.label}</span>
                        <span style={{ fontSize: 12, opacity: 0.6 }}>ⓘ</span>

                      </div>
                    </td>
                  </tr>
                  {/* Option rows */}
                  {lev.options.length === 0 ? (
                    <tr key={lev.id + "_empty"}>
                      <td colSpan={leafCriteria.length + 1} style={{ padding: "6px 24px", color: "var(--v4-text3)", fontSize: 12, fontStyle: "italic", borderBottom: "1px solid var(--v4-border)" }}>
                        Aucune option — ajoutez-en dans Comprendre.
                      </td>
                    </tr>
                  ) : (
                    lev.options.map((opt, oi) => (
                      <tr key={opt.id} style={{ background: oi % 2 === 0 ? "transparent" : "var(--v4-bg)" }}>
                        <td style={{ padding: "6px 12px 6px 24px", borderBottom: "1px solid var(--v4-border)", position: "sticky", left: 0, background: oi % 2 === 0 ? "var(--v4-surface)" : "var(--v4-bg)", zIndex: 1 }}>
                          <div title={opt.justification || undefined} style={{ fontSize: 13, color: "var(--v4-text)", fontWeight: 500, display: "flex", alignItems: "center", gap: 5, cursor: opt.justification ? "help" : "default" }}>{opt.label}{opt.exploratoire && <LampBadge compact />}{opt.justification && <span style={{ fontSize: 12, opacity: 0.6 }}>ⓘ</span>}{opt.exploratoire && !opt.validated && <button type="button" data-testid="validate-suggested" title="Option suggérée par Aura : hors classement tant qu'elle n'est pas validée" onClick={() => onUpdate(validateOption(session, opt.id))} style={{ fontSize: 12, padding: "1px 7px", borderRadius: 6, border: "1px solid #d9a441", background: "#fff4e0", color: "#8a5a00", cursor: "pointer", fontFamily: "inherit" }}>suggérée · valider</button>}</div>
                        </td>
                        {leafCriteria.map(c => (
                          <td key={c.id} style={{ textAlign: "center", padding: "5px 8px", borderBottom: "1px solid var(--v4-border)", borderLeft: "1px solid var(--v4-border)" }}>
                            <ImpactCell
                              value={(opt.impacts[c.id] ?? "U") as QualitativeImpact}
                              origin={opt.impactOrigins?.[c.id]}
                              onClick={() => cycleImpact(lev.id, opt.id, c.id)}
                            />
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}


      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <button onClick={onBack} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Comprendre
        </button>
        <button onClick={onNext} disabled={!canNext}
          style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: canNext ? 1 : 0.5 }}>
          Composer →
        </button>
        {/* Chemin d'or : tout accepter et avancer en un clic */}
        {canNext && (
          <button
            onClick={async () => {
              const hasImpacts = session.leviersDef.some(l => l.options.some(o => Object.keys(o.impacts).length > 0));
              if (!hasImpacts) await prefillWithAI();
              onNext();
            }}
            style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 8, border: "1.5px dashed #8b5cf6", background: "#8b5cf60d", color: "#7c3aed", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ✦ Continuer avec les propositions d'Aura
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 3: Composer — constructeur de scénarios ────────────────────────────

// Interprétation métier des couples bipolaires (qualitative_engine.py — PAIR_TO_TEXT)


const ORD_LABEL: Record<OrdinalLevel, string> = { 0: "N", 1: "L", 2: "M", 3: "H" };
const ORD_COLOR: Record<string, { bg: string; color: string }> = {
  H: { bg: "#d1fae5", color: "#065f46" },
  M: { bg: "#dbeafe", color: "#1e40af" },
  L: { bg: "#fef3c7", color: "#92400e" },
  N: { bg: "var(--v4-bg)", color: "var(--v4-text3)" },
};

// Displays aggregated ordinal result as PS/NS vocabulary — no mathematical notation
function OrdinalBadge({ level, dim }: { level: OrdinalLevel; dim: "g" | "d" }) {
  if (level === 0) return <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>—</span>;
  const isGain = dim === "g";
  const sym = level >= 3 ? (isGain ? "++" : "−−") : (isGain ? "+" : "−");
  const color = isGain
    ? (level >= 3 ? "#047857" : "#059669")
    : (level >= 3 ? "#991b1b" : "#ef4444");
  const bg = isGain
    ? (level >= 3 ? "#d1fae5" : "#ecfdf5")
    : (level >= 3 ? "#fee2e2" : "#fef2f2");
  return (
    <span style={{ fontSize: 13, padding: "1px 7px", borderRadius: 6, background: bg, color, fontWeight: 800, letterSpacing: ".02em" }}>
      {sym}
    </span>
  );
}


// ── Vue cascade à deux niveaux (exécutif / opérationnel) — même donnée ──────
// Niveau 1 : résultat global + niveau des MOE + phrase narrative + badge de
// vérification calculé en direct. Niveau 2 (déplié) : arbre complet MOE→MOP→
// TPM, chemin déterminant en trait épais/plein, branches libres en trait fin
// et estompé. Un seul clic bascule l'affichage — aucune autre donnée chargée.
function CascadeTreeView({
  title, criteria, scenario, optionIndex, attitudeCode, profile, nodeResult, color, goalThreshold,
}: {
  title: string;
  criteria: AtelierCriterion[];
  scenario: AtelierScenario;
  optionIndex: Record<string, AtelierOptionDef>;
  attitudeCode: Attitude;
  profile: "prudent" | "optimiste";
  nodeResult: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
  color: string;
  // Cible d'objectif choisie par l'utilisateur (« Fixer un objectif »). Quand
  // fournie, la lecture backward (Eq.6) est relue par rapport à CETTE cible
  // plutôt qu'au résultat propre du scénario — le chemin déterminant devient
  // « ce qu'il faudrait pour atteindre la cible », et chaque branche requise
  // se marque atteinte (couleur du scénario) ou manquante (rouge), y compris
  // sur un scénario qui n'atteint pas l'objectif.
  goalThreshold?: OrdinalLevel | null;
}) {
  const [expanded, setExpanded] = useState(false);
  // Un objectif vient d'être fixé : on déplie directement le détail pour que
  // les branches manquantes soient visibles sans clic supplémentaire.
  useEffect(() => { if (goalThreshold != null) setExpanded(true); }, [goalThreshold != null]);
  const ORD_FULL: Record<number, string> = { 0: "Aucune", 1: "Faible", 2: "Modérée", 3: "Élevée" };
  const GLYPH_COLOR = (g: OrdinalLevel) => (g >= 2 ? "#059669" : g === 1 ? "#10b981" : "#9ca3af");
  const RISK_COLOR = (d: OrdinalLevel) => (d === 0 ? "#059669" : d === 1 ? "#f59e0b" : "#dc2626");
  const MISS_COLOR = "#dc2626";

  const isGoalMode = goalThreshold != null;
  const threshold = goalThreshold ?? nodeResult.gPlus;
  const goalReached = isGoalMode ? nodeResult.gPlus >= threshold : null;
  const tree = useMemo(
    () => buildCascadeNodes(criteria, scenario, optionIndex, attitudeCode, profile, threshold, true),
    [criteria, scenario, optionIndex, attitudeCode, profile, threshold],
  );

  // ── Vérification en direct (pas codée en dur) : (1) chaque feuille requise
  // atteint bien individuellement le seuil τ — c'est exactement la garantie
  // de la lecture backward (Eq.6) ; (2) recomposer le nœud racine à partir de
  // CE MÊME arbre (aggregateNode sur les résultats/poids des enfants directs)
  // reproduit exactement le verdict global affiché. Si l'un des deux échoue,
  // le badge ne s'affiche pas — c'est un contrôle réel, pas un affichage figé.
  const verification = useMemo(() => {
    const requiredLeaves = collectCascadeLeaves(tree, true);
    const leavesHold = requiredLeaves.every(l => l.result.gPlus >= threshold);
    const childResults = tree.map(n => n.result);
    const childWeights = tree.map(n => n.weight);
    let rootMatches = false;
    try {
      const recomposed = aggregateNode(childResults.length ? childResults : [{ gPlus: 0, dMinus: 0 }], childWeights.length ? childWeights : [3]);
      rootMatches = recomposed.gPlus === nodeResult.gPlus && recomposed.dMinus === nodeResult.dMinus;
    } catch { rootMatches = false; }
    // En mode objectif, un scénario peut légitimement manquer la cible sur une
    // branche requise (c'est justement ce qu'on veut voir) — le badge « vérifié »
    // ne porte alors que sur la cohérence moteur (recomposition), pas sur
    // l'atteinte de la cible, affichée séparément.
    return { ok: isGoalMode ? rootMatches : (leavesHold && rootMatches), requiredLeafCount: requiredLeaves.length };
  }, [tree, threshold, nodeResult, isGoalMode]);

  // ── Narrative Niveau 1 : lue depuis l'arbre déjà construit (aucune donnée
  // supplémentaire) ─────────────────────────────────────────────────────
  const narrative = (() => {
    if (!tree.length) return "";
    const sorted = [...tree].sort((a, b) => Math.max(b.result.gPlus, b.result.dMinus) - Math.max(a.result.gPlus, a.result.dMinus));
    const top = sorted[0];
    const topIsRisk = top.result.dMinus >= top.result.gPlus && top.result.dMinus > 0;
    const second = sorted.find(t => t.crit.id !== top.crit.id && (t.result.gPlus > 0 || t.result.dMinus > 0));
    if (topIsRisk) return `Porté par ${second ? `« ${second.crit.label} »` : "l'ensemble des objectifs"}, freiné par « ${top.crit.label} ».`;
    if (top.result.gPlus > 0) return `Porté par « ${top.crit.label} »${second ? `, avec « ${second.crit.label} » en soutien` : ""}.`;
    return "Aucun objectif ne domine nettement ce verdict.";
  })();

  function NodeGlyph({ n, size = 12 }: { n: CascadeNode; size?: number }) {
    const c = n.result.dMinus > n.result.gPlus ? RISK_COLOR(n.result.dMinus) : GLYPH_COLOR(n.result.gPlus);
    const v = n.result.dMinus > n.result.gPlus ? n.result.dMinus : n.result.gPlus;
    return <OrdGlyph v={v} color={c} size={size} />;
  }

  // ── Rendu Niveau 2 : arbre top-down (traits + nœuds), chemin déterminant
  // en trait épais/plein, branches libres en trait fin/estompé ─────────────
  function TreeBranch({ n, depth }: { n: CascadeNode; depth: number }) {
    const leafCount = n.isLeaf ? 1 : collectCascadeLeaves([n], false).length;
    // Sous-branche libre avec beaucoup de feuilles : repliée par défaut en
    // résumé compact, dépliable à la demande (évite le mur de TPM illisible).
    const collapsible = !n.required && !n.isLeaf && leafCount > 4;
    const [unfolded, setUnfolded] = useState(false);
    const showChildren = !n.isLeaf && (!collapsible || unfolded);
    // En mode objectif, une branche requise peut manquer la cible τ — elle
    // reste alors dans le chemin déterminant (elle EST ce qu'il fallait
    // atteindre) mais se marque en rouge plutôt que dans la couleur du
    // scénario, distincte des branches libres (grises, atténuées).
    const missed = isGoalMode && n.required && n.result.gPlus < threshold;
    const opacity = n.required ? 1 : 0.42;
    const weight = n.required ? 700 : 400;
    const lineW = n.required ? 2.5 : 1;
    const lineColor = n.required ? (missed ? MISS_COLOR : color) : "var(--v4-border)";
    return (
      <div style={{ marginLeft: depth > 0 ? 16 : 0, position: "relative", paddingLeft: depth > 0 ? 14 : 0, marginTop: 4 }}>
        {depth > 0 && (
          <span style={{ position: "absolute", left: 0, top: 10, width: 12, height: lineW, background: lineColor, opacity: n.required ? 1 : 0.6 }} />
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 6, opacity }}>
          <span style={{ fontSize: 13, fontWeight: weight, color: missed ? MISS_COLOR : (n.required ? "var(--v4-text)" : "var(--v4-text3)") }}>{n.crit.label}</span>
          <NodeGlyph n={n} size={10} />
          {missed && <span style={{ fontSize: 12, fontWeight: 800, color: MISS_COLOR }}>✗ cible non atteinte</span>}
        </div>
        {showChildren && n.children.map(ch => <TreeBranch key={ch.crit.id} n={ch} depth={depth + 1} />)}
        {collapsible && !unfolded && (
          <div style={{ marginLeft: 16, paddingLeft: 14, position: "relative", marginTop: 4 }}>
            <span style={{ position: "absolute", left: 0, top: 10, width: 12, height: 1, background: "var(--v4-border)", opacity: 0.6 }} />
            <button onClick={() => setUnfolded(true)}
              style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", background: "none", border: "1px dashed var(--v4-border)", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}>
              {leafCount} critère{leafCount > 1 ? "s" : ""} non déterminant{leafCount > 1 ? "s" : ""} — dérouler
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ border: "1px solid var(--v4-border)", borderRadius: 8, background: "var(--v4-surface)", overflow: "hidden" }}>
      {/* Niveau 1 — exécutif */}
      <div onClick={() => setExpanded(e => !e)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".08em" }}>{title}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13 }}>
            <OrdGlyph v={nodeResult.gPlus} color={GLYPH_COLOR(nodeResult.gPlus)} size={11} />
            <span style={{ fontWeight: 700, color: GLYPH_COLOR(nodeResult.gPlus) }}>{ORD_FULL[nodeResult.gPlus]}</span>
            <span style={{ color: "var(--v4-text3)" }}>·</span>
            <OrdGlyph v={nodeResult.dMinus} color={RISK_COLOR(nodeResult.dMinus)} size={11} />
            <span style={{ fontWeight: 700, color: RISK_COLOR(nodeResult.dMinus) }}>{ORD_FULL[nodeResult.dMinus]}</span>
          </span>
          {isGoalMode && (
            <span title={goalReached ? "Ce scénario atteint la cible fixée." : "Ce scénario n'atteint pas la cible fixée — les branches rouges ci-dessous montrent ce qui manque."}
              style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: goalReached ? "#05966915" : "#dc262615", color: goalReached ? "#059669" : MISS_COLOR, border: `1px solid ${goalReached ? "#05966950" : "#dc262650"}` }}>
              {goalReached ? "✓ objectif atteint" : `✗ objectif non atteint (cible ≥ ${ORD_FULL[threshold]})`}
            </span>
          )}
          {verification.ok && (
            <span title={`Vérifié en direct : la recomposition du même arbre reproduit exactement le verdict global affiché.`}
              style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: "#05966915", color: "#059669", border: "1px solid #05966950" }}>
              ✓ vérifié
            </span>
          )}
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--v4-text3)", display: "flex", alignItems: "center", gap: 4 }}>
            {expanded ? "▲ replier" : "▼ voir le détail complet"}
          </span>
        </div>
        {narrative && <div style={{ fontSize: 13, color: "var(--v4-text2)", fontStyle: "italic", lineHeight: 1.45 }}>{narrative}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {tree.map(n => {
            const missedTop = isGoalMode && n.required && n.result.gPlus < threshold;
            return (
              <div key={n.crit.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 8px", borderRadius: 6, border: `1px solid ${n.required ? (missedTop ? MISS_COLOR : color) : "var(--v4-border)"}`, opacity: n.required ? 1 : 0.55 }}>
                <span style={{ fontSize: 13, fontWeight: n.required ? 700 : 500, color: missedTop ? MISS_COLOR : (n.required ? "var(--v4-text)" : "var(--v4-text3)") }}>{n.crit.label}</span>
                <NodeGlyph n={n} size={10} />
              </div>
            );
          })}
        </div>
      </div>
      {/* Niveau 2 — opérationnel : même arbre, entièrement déplié */}
      {expanded && (
        <div style={{ borderTop: "1px solid var(--v4-border)", padding: "12px 14px", background: "var(--v4-bg)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>Objectifs → dimensions → indicateurs{isGoalMode ? " — vs objectif fixé" : ""}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, textTransform: "none" }}>
              <span style={{ width: 14, height: 2.5, background: color, display: "inline-block" }} /> {isGoalMode ? "requis, atteint" : "chemin déterminant"}
            </span>
            {isGoalMode && (
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, textTransform: "none" }}>
                <span style={{ width: 14, height: 2.5, background: MISS_COLOR, display: "inline-block" }} /> requis, manquant
              </span>
            )}
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontWeight: 400, textTransform: "none" }}>
              <span style={{ width: 14, height: 1, background: "var(--v4-border)", display: "inline-block" }} /> libre (sans influence)
            </span>
          </div>
          {tree.map(n => <TreeBranch key={n.crit.id} n={n} depth={0} />)}
        </div>
      )}
    </div>
  );
}

const SCENARIO_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function StepComposer({ session, onUpdate, onNext, onBack }: {
  session: AtelierSession;
  onUpdate: (patch: Partial<AtelierSession>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const attitudeCode: Attitude = session.attitude === "Pessimiste" ? 1 : 2;
  const profile: "prudent" | "optimiste" = session.attitude === "Pessimiste" ? "prudent" : "optimiste";

  // Build option index
  const optionIndex: Record<string, AtelierOptionDef> = {};
  for (const lev of session.leviersDef) {
    for (const opt of lev.options) { optionIndex[opt.id] = opt; }
  }

  // Compute mini aggregate per scenario using hierarchy-aware aggregation
  function quickResult(sc: AtelierScenario) {
    if (!session.criteria.length || !session.leviersDef.length) return null;
    const weights = session.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const normW: OrdinalLevel[] = thesisWeights(weights);
    const stage1 = session.criteria.map(c =>
      aggregateHierarchy(c, sc, optionIndex, attitudeCode, profile)
    );
    try {
      return aggregateNode(stage1, normW.length ? normW : [3]);
    } catch { return null; }
  }

  function addScenario() {
    const id = `s${Date.now()}`;
    const color = SCENARIO_COLORS[session.scenarios.length % SCENARIO_COLORS.length];
    const leviers: AtelierLevier[] = session.leviersDef.map(lev => ({
      id: lev.id, label: lev.label, type: lev.type,
      valeur: lev.options[0]?.id ?? "",
    }));
    onUpdate({ scenarios: [...session.scenarios, { id, label: `Scénario ${session.scenarios.length + 1}`, color, description: "", leviers, scores: {}, valeur: 50, faisabilite: 60 }] });
  }

  // ── « Proposer d'abord, demander ensuite » : 3 scénarios contrastés ─────────
  // Ambitieux (option la plus porteuse de gains par levier), Prudent (option la
  // moins porteuse de risques), Équilibré (première option). Dédupliqués.
  // L'utilisateur modifie ou supprime — jamais de page blanche.
  const composerProposed = useRef(false);
  useEffect(() => {
    if (composerProposed.current || session.scenarios.length > 0) return;
    if (!session.leviersDef.length || !session.leviersDef.every(l => l.options.length > 0)) return;
    composerProposed.current = true;
    const leaves = getLeafCriteria(session.criteria);
    const gainScore = (o: AtelierOptionDef) => leaves.reduce((n, lf) => n + (o.impacts[lf.id] === "++" ? 2 : o.impacts[lf.id] === "+" ? 1 : 0), 0);
    const riskScore = (o: AtelierOptionDef) => leaves.reduce((n, lf) => n + (o.impacts[lf.id] === "--" ? 2 : o.impacts[lf.id] === "-" ? 1 : (o.impacts[lf.id] ?? "U") === "U" ? 1 : 0), 0);
    const pick = (score: (o: AtelierOptionDef) => number, best: "max" | "min") =>
      session.leviersDef.map(lev => {
        const sorted = [...lev.options].sort((a, b) => best === "max" ? score(b) - score(a) : score(a) - score(b));
        return { id: lev.id, label: lev.label, type: lev.type, valeur: sorted[0]?.id ?? "" };
      });
    const combos: Array<{ label: string; desc: string; leviers: AtelierLevier[] }> = [
      { label: "Ambitieux", desc: "Maximise le potentiel d'amélioration — proposé par Aura, à ajuster.", leviers: pick(gainScore, "max") },
      { label: "Prudent", desc: "Minimise les risques et les inconnues — proposé par Aura, à ajuster.", leviers: pick(riskScore, "min") },
      { label: "Équilibré", desc: "Configuration de référence — proposé par Aura, à ajuster.", leviers: session.leviersDef.map(lev => ({ id: lev.id, label: lev.label, type: lev.type, valeur: lev.options[0]?.id ?? "" })) },
    ];
    const seen = new Set<string>();
    const scenarios: AtelierScenario[] = [];
    combos.forEach((c, i) => {
      const key = c.leviers.map(l => l.valeur).join("|");
      if (seen.has(key)) return;
      seen.add(key);
      scenarios.push({ id: `sp${Date.now()}${i}`, label: c.label, color: SCENARIO_COLORS[scenarios.length % SCENARIO_COLORS.length], description: c.desc, leviers: c.leviers, scores: {}, valeur: 50, faisabilite: 60 });
    });
    if (scenarios.length >= 2) onUpdate({ scenarios });
  }, [session.leviersDef, session.scenarios.length]);

  function updateScenario(id: string, patch: Partial<AtelierScenario>) {
    onUpdate({ scenarios: session.scenarios.map(s => s.id === id ? { ...s, ...patch } : s) });
  }

  function selectOption(scId: string, levId: string, optId: string) {
    onUpdate({
      scenarios: session.scenarios.map(s =>
        s.id === scId ? { ...s, leviers: s.leviers.map(l => l.id === levId ? { ...l, valeur: optId } : l) } : s
      ),
    });
  }

  function removeScenario(id: string) {
    onUpdate({ scenarios: session.scenarios.filter(s => s.id !== id) });
  }

  const canNext = session.scenarios.length >= 2;

  // ── Nommer et qualifier les scénarios à la voix ──────────────────────────────
  const [compCompanionOpen, setCompCompanionOpen] = useState(false);
  const composerSteps: CompanionStep[] = session.scenarios.flatMap(sc => [
    {
      id: `${sc.id}-label`, group: sc.label,
      question: `Comment nommez-vous ce scénario ? (actuellement « ${sc.label} »)`,
      hint: "Un nom court, parlant pour le comité.",
      current: sc.label,
      apply: t => { const v = t.trim(); if (v) updateScenario(sc.id, { label: v.slice(0, 60) }); },
    },
    {
      id: `${sc.id}-desc`, group: sc.label, optional: true,
      question: `Que défend « ${sc.label} » ?`,
      hint: "La logique du scénario en une phrase.",
      current: sc.description,
      apply: t => { const v = t.trim(); if (v) updateScenario(sc.id, { description: v }); },
    },
  ]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--v4-text)", flex: 1 }}>Composer les scénarios</div>
        {composerSteps.length > 0 && (
          <button type="button" data-testid="composer-guided-flow" aria-hidden="true" tabIndex={-1}
            onClick={() => setCompCompanionOpen(true)} style={{ display: "none" }} />
        )}
        <button onClick={addScenario}
          style={{ padding: "5px 14px", borderRadius: 8, border: "1px solid var(--v4-accent-border)", background: "var(--v4-accent-bg)", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          + Scénario
        </button>
      </div>
      <CompagnonAura
        open={compCompanionOpen}
        onClose={() => setCompCompanionOpen(false)}
        steps={composerSteps}
        title="Composer les scénarios"
        contextPrompt="Nom et intention d'un scénario de décision d'entreprise." />
      <div style={{ fontSize: 13, color: "var(--v4-text2)", marginBottom: 18, lineHeight: 1.5 }}>
        Une option par levier. La synthèse se recalcule en direct.
      </div>


      {session.scenarios.length === 0 ? (
        <div style={{ padding: "32px", textAlign: "center", color: "var(--v4-text3)", fontSize: 13, border: "1px dashed var(--v4-border)", borderRadius: 12 }}>
          Aucun scénario. Cliquez <strong style={{ color: "var(--v4-text2)" }}>+ Scénario</strong> pour commencer.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14, alignItems: "start" }}>
          {session.scenarios.map(sc => {
            const result = quickResult(sc);
            const interp = result ? (PAIR_TO_TEXT[`${ORD_LABEL[result.gPlus]},${ORD_LABEL[result.dMinus]}`] ?? "") : "";
            return (
              <div key={sc.id} style={{ borderRadius: 6, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", overflow: "hidden", boxShadow: "none" }}>
                {/* Header */}
                <div style={{ padding: "10px 14px", background: "transparent", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: sc.color, flexShrink: 0, opacity: 0.8 }} />
                  <div contentEditable suppressContentEditableWarning
                    onBlur={e => updateScenario(sc.id, { label: e.currentTarget.textContent ?? sc.label })}
                    style={{ fontFamily: "var(--font-display)", fontSize: 13.5, fontWeight: 600, color: "var(--v4-text)", outline: "none", flex: 1 }}>
                    {sc.label}
                  </div>
                  {result && (
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      <OrdinalBadge level={result.gPlus} dim="g" />
                      <OrdinalBadge level={result.dMinus} dim="d" />
                      {interp && <span style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic" }}>{interp}</span>}
                    </div>
                  )}
                  <button onClick={() => removeScenario(sc.id)}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: "0 2px", opacity: 0.5, fontFamily: "inherit" }}>✕</button>
                </div>

                {/* Description */}
                <div style={{ padding: "6px 14px 0" }}>
                  <div contentEditable suppressContentEditableWarning
                    onBlur={e => updateScenario(sc.id, { description: e.currentTarget.textContent ?? sc.description })}
                    style={{ fontSize: 13, color: "var(--v4-text2)", outline: "none", lineHeight: 1.5, fontStyle: !sc.description ? "italic" : "normal" }}>
                    {sc.description || "Description optionnelle…"}
                  </div>
                </div>

                {/* Lever selections — grouped by type */}
                <div style={{ padding: "10px 14px 12px" }}>
                  {(() => {
                    const TYPE_LABELS: Record<string, string> = { budget: "Budget", ressource: "Ressources", temps: "Temps", risque: "Risque", decision: "Décision stratégique", technique: "Technique", autre: "Autres leviers" };
                    const groups: Record<string, typeof session.leviersDef> = {};
                    for (const lev of session.leviersDef) {
                      const g = lev.type ?? "autre";
                      if (!groups[g]) groups[g] = [];
                      groups[g].push(lev);
                    }
                    return Object.entries(groups).map(([type, levs]) => (
                      <div key={type} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                          <AuraIcon e={LEVER_ICONS[type as LeverType] ?? "◈"} size={12} />
                          <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--v4-text3)" }}>{TYPE_LABELS[type] ?? type}</span>
                          <div style={{ flex: 1, height: 1, background: "var(--v4-border)" }} />
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 6 }}>
                          {levs.map(lev => {
                            const selectedId = sc.leviers.find(l => l.id === lev.id)?.valeur ?? lev.options[0]?.id ?? "";
                            return (
                              <div key={lev.id} style={{ borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-bg)", padding: "6px 10px" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text2)", marginBottom: 5 }}>{lev.label}</div>
                                {lev.options.length === 0 ? (
                                  <span style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic" }}>Aucune option</span>
                                ) : (
                                  <select value={selectedId} onChange={e => selectOption(sc.id, lev.id, e.target.value)}
                                    style={{ width: "100%", padding: "4px 6px", borderRadius: 6, border: `1.5px solid ${sc.color}`, background: `${sc.color}0d`, color: sc.color, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", outline: "none" }}>
                                    {lev.options.map(opt => (
                                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}


      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
        <button onClick={onBack} style={{ padding: "9px 18px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Impacter
        </button>
        <button onClick={onNext} disabled={!canNext}
          style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: canNext ? 1 : 0.5 }}>
          Arbitrer →
        </button>
        {canNext && session.scenarios.some(s => ["Ambitieux", "Prudent", "Équilibré"].includes(s.label)) && (
          <button onClick={onNext}
            style={{ marginLeft: "auto", padding: "9px 18px", borderRadius: 8, border: "1.5px dashed #8b5cf6", background: "#8b5cf60d", color: "#7c3aed", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ✦ Continuer avec les propositions d'Aura
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step 4: Décider ──────────────────────────────────────────────────────────
// ── Lo aggregation shared between Composer and Decider ───────────────────────
// computeLoResults : partagé avec le parcours court (lib/v4/decision-express).

// Classement Lo : G⁺ décroissant, D⁻ croissant (ordre lexicographique bipolaire)
/**
 * Comparaison lexicographique bipolaire (thèse Lô, ch. IV §3.3, p. 83) —
 * purement ordinale : possibilité de détérioration la plus faible d'abord
 * (δ⁻ croissant), puis possibilité d'amélioration la plus forte (δ⁺).
 * Renvoie > 0 si a est préférée à b.
 */
function loCompare(
  a: { gPlus: OrdinalLevel; dMinus: OrdinalLevel },
  b: { gPlus: OrdinalLevel; dMinus: OrdinalLevel },
): number {
  return compareASC(a, b);
}

/** Compatibilité — sort key numérique jamais utilisé dans les formules. */
function loRank(r: { gPlus: OrdinalLevel; dMinus: OrdinalLevel }) {
  return loCompare(r, { gPlus: 0, dMinus: 0 });
}

// ── Chaîne de décision — Sankey interactif ───────────────────────────────────
// Ordinal bipolar scale {−−,−,0,+,++} → [0,25,50,75,100].
// "0" = neutre (milieu d'échelle), jamais le minimum.
const QI_TO_NUM: Record<string, number> = { "++": 100, "+": 75, "0": 50, "-": 25, "--": 0, "U": 50 };

function getLeafCriteriaChaine(cs: AtelierCriterion[]): AtelierCriterion[] {
  const out: AtelierCriterion[] = [];
  for (const c of cs) { if (c.children?.length) out.push(...getLeafCriteriaChaine(c.children)); else out.push(c); }
  return out;
}

// Retourne TOUS les critères à plat (MOE → MOP → TPM) avec préfixe de niveau
function buildCritTree(cs: AtelierCriterion[], weights: Record<string, number>): CritNode[] {
  function toNode(c: AtelierCriterion): CritNode {
    return {
      id: c.id,
      label: c.label,
      w: weights[c.id] ?? (c.poids ?? 20) / 100,
      importance: c.importance,
      description: c.description,
      children: c.children?.length ? c.children.map(toNode) : undefined,
    };
  }
  return cs.map(toNode);
}

function getAllCriteriaFlat(cs: AtelierCriterion[]): Array<AtelierCriterion & { _depth: number }> {
  const out: Array<AtelierCriterion & { _depth: number }> = [];
  function walk(nodes: AtelierCriterion[], depth: number) {
    for (const c of nodes) {
      out.push({ ...c, _depth: depth });
      if (c.children?.length) walk(c.children, depth + 1);
    }
  }
  walk(cs, 0);
  return out;
}

const LEVEL_PREFIX: Record<number, string> = { 0: "◉ ", 1: "◈ ", 2: "· " };
const LEVEL_IMPORTANCE: Record<number, "Critique" | "Important" | "Utile"> = { 0: "Critique", 1: "Important", 2: "Utile" };

function ChaineDecisionModal({ session, onClose, embedded, goalTargets: goalTargetsProp, goalTolerate: goalTolerateProp, onSetGoalTarget, applyOnMount, onApplied, onGoToObjectifTab, sharedSelectedOpts, onSharedSelectedOptsChange }: {
  session: AtelierSession; onClose: () => void; embedded?: boolean;
  goalTargets?: Record<string, number> | null;
  goalTolerate?: boolean;
  onSetGoalTarget?: (critId: string, level: number) => void;
  /** Combinaison de leviers à appliquer immédiatement (venant de « Partir de l'objectif ») — navigation croisée, aucun nouveau calcul. */
  applyOnMount?: Record<string, string> | null;
  onApplied?: () => void;
  onGoToObjectifTab?: () => void;
  /** Permet au parent (StepDecider) d'observer la configuration courante de la Chaîne, pour la
   *  refléter en live ailleurs (ex: marqueur "Votre configuration" sur le Front de Pareto). */
  sharedSelectedOpts?: Record<string, string>;
  onSharedSelectedOptsChange?: (v: Record<string, string>) => void;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  useDismiss(!embedded, onClose, modalRef);
  const leaves = getLeafCriteriaChaine(session.criteria);
  // ── Objectif partagé (même clé/état que le sélecteur d'Arbitrer et l'onglet
  // « Partir de l'objectif ») : une seule source de vérité pour goalTargets. ──
  const GOAL_KEY = `aura-goal-${session.id}`;
  const [localGoalTargets, setLocalGoalTargets] = useState<Record<string, number> | null>(() => {
    if (goalTargetsProp !== undefined) return goalTargetsProp;
    try { return JSON.parse(localStorage.getItem(GOAL_KEY) ?? "null"); } catch { return null; }
  });
  const goalTargets = goalTargetsProp !== undefined ? goalTargetsProp : localGoalTargets;
  const goalTolerate = goalTolerateProp ?? false;
  const setGoalTarget = (critId: string, level: number) => {
    if (onSetGoalTarget) { onSetGoalTarget(critId, level); return; }
    const next = { ...(goalTargets ?? {}), [critId]: level };
    setLocalGoalTargets(next);
    try { localStorage.setItem(GOAL_KEY, JSON.stringify(next)); } catch { /* stockage */ }
  };
  const [showChaineGoalPicker, setShowChaineGoalPicker] = useState(false);
  const [chaineSelectedCombo, setChaineSelectedCombo] = useState<string | null>(null); // "scenario:<id>" | "combo:<key>" | null (défaut)
  const allCritFlat = getAllCriteriaFlat(session.criteria);

  const [localSelectedOpts, setLocalSelectedOpts] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    for (const lev of session.leviersDef) {
      const scenLev = session.scenarios[0]?.leviers.find(l => l.id === lev.id);
      const selOpt = lev.options.find(o => o.id === (scenLev?.valeur ?? "")) ?? lev.options[0];
      m[lev.id] = selOpt?.label ?? "";
    }
    return m;
  });
  const selectedOpts = (sharedSelectedOpts && Object.keys(sharedSelectedOpts).length) ? sharedSelectedOpts : localSelectedOpts;
  const setSelectedOpts = (updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    const next = typeof updater === "function" ? (updater as (p: Record<string, string>) => Record<string, string>)(selectedOpts) : updater;
    setLocalSelectedOpts(next);
    if (onSharedSelectedOptsChange) onSharedSelectedOptsChange(next);
  };
  // Publie la configuration initiale au parent (pour le marqueur live dès l'ouverture de la Chaîne)
  useEffect(() => {
    if (onSharedSelectedOptsChange) onSharedSelectedOptsChange(selectedOpts);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Expanded MOE/MOP nodes (start with all MOE expanded, MOP collapsed)
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    new Set(session.criteria.map(c => c.id))
  );
  const toggleExpand = (id: string) =>
    setExpanded(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });

  const [attitude, setAttitude] = useState<Attitude>(session.attitude === "Pessimiste" ? 1 : 2); // attitude de la session par défaut
  const attitudeCode = attitude;
  const profile: "prudent" | "optimiste" = attitude === 1 ? "prudent" : "optimiste";

  // ── Qualitative score helpers ─────────────────────────────────────────────
  // Seuils aux mi-intervalles de l'échelle ordinale à 5 niveaux (0/25/50/75/100)
  function numToSym(n: number): string {
    return n >= 88 ? "++" : n >= 63 ? "+" : n >= 38 ? "0" : n >= 13 ? "−" : "−−";
  }
  function symStyle(n: number): { color: string; bg: string; border: string } {
    return n >= 88 ? { color: "#059669", bg: "#d1fae5", border: "#6ee7b7" }
      : n >= 63 ? { color: "#16a34a", bg: "#dcfce7", border: "#86efac" }
      : n >= 38 ? { color: "#d97706", bg: "#fef3c7", border: "#fcd34d" }
      : n >= 13 ? { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" }
      : { color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
  }

  // Build optionIndex and syntheticSc
  const optionIndex: Record<string, AtelierOptionDef> = {};
  for (const lev of session.leviersDef) {
    for (const opt of lev.options) { optionIndex[opt.id] = opt; }
  }
  const syntheticSc = {
    id: "chaine", label: "chaîne", color: "#6366f1",
    leviers: session.leviersDef.map(lev => ({
      id: lev.id, label: lev.label, type: lev.type,
      valeur: lev.options.find(o => o.label === selectedOpts[lev.id])?.id ?? "",
    })),
  } as AtelierScenario;

  // ── Exploration par objectif, directement dans la Vue globale ──────────────
  // Même moteur, même calcul de champ de combinaisons que l'onglet « Partir de
  // l'objectif » (voir StepDecider) — adapté ici pour piloter en direct l'arbre
  // de décomposition affiché plus bas (via selectedOpts).
  const chaineMoes = session.criteria;
  const chaineMops: AtelierCriterion[] = chaineMoes.flatMap(m => (m.children ?? []).filter(c => (c.children?.length ?? 0) > 0 || c.level === "MOP"));
  const chaineTargetable: AtelierCriterion[] = [...chaineMoes, ...chaineMops];
  const chaineWeights = chaineMoes.map(c => importanceToWeight(c.importance));
  const chaineMaxW = chaineWeights.length ? Math.max(...chaineWeights) : 3;
  const chaineNw: OrdinalLevel[] = thesisWeights(chaineWeights);
  // Espace EXHAUSTIF des configurations (jusqu'à EXHAUSTIVE_LIMIT = 10⁶), mémoïsé
  // par modèle : goal-seek et réparations parcourent toutes les solutions.
  const { combos: chaineRawCombos, total: chaineComboTotal, truncated: chaineTruncated } = enumerateCombos(session.leviersDef, EXHAUSTIVE_LIMIT);
  const chaineEvals: GoalComboEval[] = memoLast("chaineEvals", JSON.stringify([session.leviersDef, session.criteria, attitude]), () => chaineRawCombos.map((combo, ci) => {
    const ev = evaluatorFor(session.criteria, session.leviersDef, attitude === 1 ? "Pessimiste" : "Optimiste").evaluate(combo);
    const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
    for (const c of chaineMoes) perCrit[c.id] = ev.perNode[c.id];
    for (const mop of chaineMops) perCrit[mop.id] = ev.perNode[mop.id];
    const global = ev.global;
    return { key: `cg${ci}`, combo, perCrit, global };
  }));
  const chaineActiveTargets = chaineTargetable.filter(m => (goalTargets?.[m.id] ?? -1) > 0).map(m => ({ critId: m.id, min: goalTargets![m.id] as OrdinalLevel }));
  const chaineGoalActive = chaineActiveTargets.length > 0;
  const chaineObjectivesAll: ObjectiveRef[] = chaineTargetable.map(m => ({ id: m.id, label: m.label, importance: m.importance }));
  const chaineGsRaw = goalSeek(chaineEvals, chaineActiveTargets, { tolerateRisk: goalTolerate ? 1 : 0 });
  // Étape 1 — vérification Forward globale obligatoire : une combinaison n'est
  // « atteignante » que si elle ne dégrade aucun objectif Essentiel (veto),
  // même non ciblé — pas seulement les cibles explicitement choisies.
  const chaineGs = { ...chaineGsRaw, reaching: filterGloballyVerified(chaineGsRaw.reaching, chaineObjectivesAll) };
  const chaineCritLabel = (id: string) => chaineTargetable.find(m => m.id === id)?.label ?? id;
  // Scénarios existants qui atteignent la cible (marqués distinctement des combinaisons brutes)
  const chaineScenarioEval = (sc: AtelierScenario): GoalComboEval | null => {
    const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
    const stage1 = chaineMoes.map(c => { const r = aggregateHierarchy(c, sc, optionIndex, attitudeCode, profile); perCrit[c.id] = r; return r; });
    for (const mop of chaineMops) perCrit[mop.id] = aggregateHierarchy(mop, sc, optionIndex, attitudeCode, profile);
    let global: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
    try { global = aggregateNode(stage1, chaineNw.length ? chaineNw : [3]); } catch { global = { gPlus: 0, dMinus: 0 }; }
    return { key: `sc:${sc.id}`, combo: {}, perCrit, global };
  };
  const chaineScenarioReaches = (sc: AtelierScenario): boolean => {
    if (!chaineGoalActive) return false;
    const ev = chaineScenarioEval(sc);
    if (!ev) return false;
    return chaineActiveTargets.every(t => (ev.perCrit[t.critId]?.gPlus ?? 0) >= t.min && (ev.perCrit[t.critId]?.dMinus ?? 0) <= (goalTolerate ? 1 : 0));
  };
  // Applique une combinaison brute de leviers à l'arbre affiché (propagation directe)
  function applyCombo(combo: Record<string, string>) {
    const next: Record<string, string> = {};
    for (const lev of session.leviersDef) {
      const optId = combo[lev.id];
      const opt = lev.options.find(o => o.id === optId) ?? lev.options[0];
      next[lev.id] = opt?.label ?? "";
    }
    setSelectedOpts(next);
  }
  // Applique la combinaison venue de « Partir de l'objectif » dès l'arrivée sur cette vue.
  useEffect(() => {
    if (applyOnMount) {
      applyCombo(applyOnMount);
      onApplied?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyOnMount]);
  // Applique un scénario nommé du décideur à l'arbre affiché
  function applyScenario(sc: AtelierScenario) {
    const next: Record<string, string> = {};
    for (const lev of session.leviersDef) {
      const scenLev = sc.leviers.find(l => l.id === lev.id);
      const opt = lev.options.find(o => o.id === (scenLev?.valeur ?? "")) ?? lev.options[0];
      next[lev.id] = opt?.label ?? "";
    }
    setSelectedOpts(next);
  }
  function resetToDefaultScenario() {
    setChaineSelectedCombo(null);
    applyScenario(session.scenarios[0] ?? ({ leviers: [] } as unknown as AtelierScenario));
  }
  // Auto-bascule : dès qu'un objectif devient actif, afficher directement une
  // combinaison qui l'atteint (scénario nommé en priorité, sinon la meilleure
  // combinaison brute) — sans attendre un clic. Si rien ne l'atteint, on laisse
  // l'arbre affiché tel quel et le panneau explique le critère bloquant.
  useEffect(() => {
    if (!chaineGoalActive) return;
    // Ne pas re-forcer si le combo déjà affiché atteint toujours la cible.
    if (chaineSelectedCombo?.startsWith("scenario:")) {
      const sc = session.scenarios.find(s => `scenario:${s.id}` === chaineSelectedCombo);
      if (sc && chaineScenarioReaches(sc)) return;
    }
    if (chaineSelectedCombo?.startsWith("combo:")) {
      const key = chaineSelectedCombo.slice("combo:".length);
      if (chaineGs.reaching.some(c => c.key === key)) return;
    }
    const winningScenario = session.scenarios.find(sc => chaineScenarioReaches(sc));
    if (winningScenario) {
      setChaineSelectedCombo(`scenario:${winningScenario.id}`);
      applyScenario(winningScenario);
    } else if (chaineGs.reaching[0]) {
      setChaineSelectedCombo(`combo:${chaineGs.reaching[0].key}`);
      applyCombo(chaineGs.reaching[0].combo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(goalTargets), goalTolerate]);

  // Lo engine bipolar scoring
  function nodeBipolar(node: AtelierCriterion): OrdinalImpact {
    return aggregateHierarchy(node, syntheticSc, optionIndex, attitudeCode, profile);
  }

  // Overall live bipolar result
  const liveResult = ((): OrdinalImpact => {
    if (!session.criteria.length || !session.leviersDef.length) return { gPlus: 0, dMinus: 0 };
    const weights = session.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const normW: OrdinalLevel[] = thesisWeights(weights);
    const stage1 = session.criteria.map(c => nodeBipolar(c));
    try { return aggregateNode(stage1, normW.length ? normW : [3]); }
    catch { return { gPlus: 0, dMinus: 0 }; }
  })();

  // Bipolar label function
  function bipolarLabel(r: OrdinalImpact): { sym: string; text: string; color: string; bg: string; border: string } {
    if (r.gPlus > 0 && r.dMinus > 0) return { sym: "△", text: "Ambivalent — gain et risque identifiés", color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" };
    if (r.gPlus >= 3) return { sym: "++", text: "Très prometteuse — forte possibilité d'amélioration", color: "#059669", bg: "#d1fae5", border: "#6ee7b7" };
    if (r.gPlus >= 1) return { sym: "+",  text: "Prometteuse — possibilité d'amélioration", color: "#16a34a", bg: "#dcfce7", border: "#86efac" };
    if (r.dMinus >= 3) return { sym: "−−", text: "À rejeter — forte possibilité de dégradation", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
    if (r.dMinus >= 1) return { sym: "−",  text: "À surveiller — possibilité de dégradation", color: "#ea580c", bg: "#fff7ed", border: "#fdba74" };
    return { sym: "0",  text: "Neutre — aucun effet identifié", color: "#d97706", bg: "#fef3c7", border: "#fcd34d" };
  }
  const scoreLabel = bipolarLabel(liveResult);

  // Covered TPM leaves
  const coveredCritIds = new Set<string>();
  for (const lev of session.leviersDef) {
    const opt = lev.options.find(o => o.label === selectedOpts[lev.id]);
    if (!opt) continue;
    for (const [critId, qi] of Object.entries(opt.impacts)) {
      if ((QI_TO_NUM[qi as string] ?? 50) > 50) coveredCritIds.add(critId);
    }
  }
  const uncoveredEssential = leaves.filter(l => !coveredCritIds.has(l.id) && l.importance === "Essentiel");

  // Top lever by positive coverage
  const leverDeltas = session.leviersDef.map(lev => {
    let maxPositive = 0;
    for (const opt of lev.options) {
      const positiveCount = leaves.filter(l => (QI_TO_NUM[opt.impacts[l.id] ?? "0"] ?? 50) > 50).length;
      if (positiveCount > maxPositive) maxPositive = positiveCount;
    }
    return { lev, delta: maxPositive };
  }).sort((a, b) => b.delta - a.delta);
  const topLever = leverDeltas[0];

  // ── Criterion tree node ───────────────────────────────────────────────────
  function CritTreeNode({ node, depth }: { node: AtelierCriterion; depth: number }) {
    const hasChildren = !!node.children?.length;
    const isExpanded = expanded.has(node.id);
    const bipolar = nodeBipolar(node);
    const lbl = bipolarLabel(bipolar);
    const sym = lbl.sym;
    const ss = { color: lbl.color, bg: lbl.bg, border: lbl.border };
    const isLeaf = !hasChildren;

    // Which leviers impact this leaf
    const impactingLevs = isLeaf ? session.leviersDef.filter(lev => {
      const opt = lev.options.find(o => o.label === selectedOpts[lev.id]);
      return opt && (QI_TO_NUM[opt.impacts[node.id] ?? "0"] ?? 50) > 50;
    }) : [];

    const depthColors = ["#6366f1", "#8b5cf6", "#a78bfa"];
    const nodeColor = depthColors[depth] ?? "#94a3b8";
    const indent = depth * 18;

    return (
      <div>
        <div
          onClick={() => hasChildren && toggleExpand(node.id)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: `${isLeaf ? 6 : 8}px 14px`,
            paddingLeft: 14 + indent,
            borderBottom: "1px solid var(--v4-border)",
            cursor: hasChildren ? "pointer" : "default",
            background: isLeaf ? "transparent" : "var(--v4-surface)",
            transition: "background .1s",
          }}
          onMouseEnter={e => { if (!hasChildren) (e.currentTarget as HTMLDivElement).style.background = "var(--v4-surface)"; }}
          onMouseLeave={e => { if (!hasChildren) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
        >
          {/* Toggle / depth indicator */}
          <span style={{ fontSize: 13, color: nodeColor, width: 14, flexShrink: 0, textAlign: "center" }}>
            {hasChildren ? (isExpanded ? "▼" : "▶") : "·"}
          </span>

          {/* Level tag */}
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".06em", color: nodeColor,
            background: nodeColor + "18", borderRadius: 6, padding: "1px 5px", flexShrink: 0 }}>
            {depth === 0 ? "Objectif" : depth === 1 ? "Dimension" : "Indicateur"}
          </span>

          {/* Label */}
          <span style={{ flex: 1, fontSize: isLeaf ? 13 : 13, fontWeight: isLeaf ? 500 : 700,
            color: "var(--v4-text)", lineHeight: 1.3, display: "flex", alignItems: "center", gap: 5 }}>
            {node.label}
            {isLeaf && node.exploratoire && <LampBadge compact />}
          </span>

          {/* Importance */}
          <span style={{ fontSize: 12, color: "var(--v4-text3)", flexShrink: 0 }}>
            {node.importance ?? ""}
          </span>

          {/* Impacting levers (leaf only) */}
          {isLeaf && impactingLevs.length > 0 && (
            <div style={{ display: "flex", gap: 3, flexShrink: 0 }}>
              {impactingLevs.slice(0, 2).map(l => (
                <span key={l.id} style={{ fontSize: 12, padding: "1px 5px", borderRadius: 6,
                  background: "#6366f118", color: "#6366f1", fontWeight: 600 }}>
                  <AuraIcon e={LEVER_ICONS[l.type] ?? ""} size={11} /> {l.label.slice(0, 10)}
                </span>
              ))}
            </div>
          )}

          {/* Qualitative score badge */}
          <span style={{ fontSize: isLeaf ? 13 : 13, fontWeight: 900, padding: "2px 8px",
            borderRadius: 6, background: ss.bg, color: ss.color,
            border: `1px solid ${ss.border}`, flexShrink: 0, minWidth: 32, textAlign: "center",
            transition: "all .3s" }}>
            {sym}
          </span>
        </div>

        {/* Children */}
        {hasChildren && isExpanded && (
          <div>
            {node.children!.map(child => (
              <CritTreeNode key={child.id} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const inner = (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>

      {/* ── Bandeau de décision ─────────────────────────────────────────────── */}
      <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, background: "var(--v4-surface)" }}>
        <span style={{ fontSize: 13 }}></span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: "var(--v4-text)" }}>Vue Chaîne de décision</div>
          <div style={{ fontSize: 12, color: "var(--v4-text3)" }}>Une option par levier</div>
        </div>
        {topLever && (
          <div style={{ fontSize: 12, color: "#6366f1", background: "#6366f110", border: "1px solid #6366f130", borderRadius: 8, padding: "4px 10px" }}>
             Levier clé : <strong>{topLever.lev.label}</strong>
          </div>
        )}
        {/* Global score badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 8,
          background: scoreLabel.bg, border: `1.5px solid ${scoreLabel.border}` }}>
          <span style={{ fontSize: 15.5, fontWeight: 900, color: scoreLabel.color }}>{scoreLabel.sym}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: scoreLabel.color }}>{scoreLabel.text}</span>
        </div>
        {!embedded && (
          <button onClick={onClose} style={{ padding: "5px 12px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ← Retour
          </button>
        )}
      </div>

      {/* ── Strip bipolaire δ⁺ / δ⁻ ────────────────────────────────────────── */}
      <div style={{ padding: "8px 18px 10px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-bg)", flexShrink: 0, display: "flex", gap: 20, alignItems: "center" }}>
        {/* δ⁺ strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>Potentiel</span>
          {([1, 2, 3] as OrdinalLevel[]).map(level => (
            <div key={level} style={{ width: 16, height: 16, borderRadius: 6, transition: "background .3s",
              background: liveResult.gPlus >= level ? "#059669" : "var(--v4-border)" }} />
          ))}
          <span style={{ fontSize: 13, fontWeight: 800, color: "#059669", minWidth: 16 }}>{ORD_LABEL[liveResult.gPlus as OrdinalLevel]}</span>
        </div>
        <div style={{ width: 1, height: 24, background: "var(--v4-border)" }} />
        {/* δ⁻ strip */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#dc2626" }}>Risque</span>
          {([1, 2, 3] as OrdinalLevel[]).map(level => (
            <div key={level} style={{ width: 16, height: 16, borderRadius: 6, transition: "background .3s",
              background: liveResult.dMinus >= level ? "#dc2626" : "var(--v4-border)" }} />
          ))}
          <span style={{ fontSize: 13, fontWeight: 800, color: "#dc2626", minWidth: 16 }}>{ORD_LABEL[liveResult.dMinus as OrdinalLevel]}</span>
        </div>
        {/* Attitude toggle */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600 }}>Attitude :</span>
          {([{ a: 2 as Attitude, label: "Optimiste" }, { a: 1 as Attitude, label: "Prudent" }]).map(({ a, label }) => (
            <button key={a} onClick={() => setAttitude(a)}
              style={{ padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                border: attitude === a ? "1.5px solid #6366f1" : "1px solid var(--v4-border)",
                background: attitude === a ? "#6366f110" : "transparent",
                color: attitude === a ? "#6366f1" : "var(--v4-text3)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Objectif partagé : picker compact + combinaisons éligibles ──────── */}
      <div style={{ padding: "8px 18px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {!chaineGoalActive && (
            <span style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>
              Aucun objectif fixé.
            </span>
          )}
          {chaineGoalActive && (
            <button onClick={() => setShowChaineGoalPicker(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                border: "1.5px solid #6366f1", background: "#6366f110", color: "#6366f1" }}>
               Objectif ({chaineActiveTargets.length}) — ajuster
            </button>
          )}
          {onGoToObjectifTab && (
            <button onClick={onGoToObjectifTab}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1px dashed var(--v4-border)", background: "transparent", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              ◎ Réglage détaillé (par dimension, blocages, leviers à débloquer) →
            </button>
          )}
          {chaineGoalActive && (
            <>
              {chaineGs.reaching.length > 0 || session.scenarios.some(s => chaineScenarioReaches(s)) ? (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>✓ objectif atteignable — combinaison affichée ci-dessous</span>
              ) : (
                <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>⚠ aucune combinaison n'atteint cet objectif actuellement</span>
              )}
              <button onClick={resetToDefaultScenario}
                style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)" }}>
                ↺ revenir au scénario recommandé
              </button>
            </>
          )}
        </div>
        {showChaineGoalPicker && (
          <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic" }}>
              Cible minimale par objectif — partagée avec « Arbitrer » et l'onglet « Partir de l'objectif ».
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {chaineMoes.map(m => {
                const v = goalTargets?.[m.id] ?? -1;
                return (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", flex: "1 1 160px" }}>{m.label}</span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setGoalTarget(m.id, -1)}
                        style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${v === -1 ? "var(--v4-text3)" : "var(--v4-border)"}`, background: v === -1 ? "var(--v4-surface2)" : "transparent", color: "var(--v4-text3)" }}>indifférent</button>
                      {([1, 2, 3] as OrdinalLevel[]).map(lvl => (
                        <button key={lvl} onClick={() => setGoalTarget(m.id, lvl)}
                          title={`Au moins ${["", "Faible", "Modérée", "Élevée"][lvl]}`}
                          style={{ padding: "2px 7px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3, border: `1.5px solid ${v === lvl ? "var(--v4-accent)" : "var(--v4-border)"}`, background: v === lvl ? "var(--v4-accent)10" : "transparent" }}>
                          <OrdGlyph v={lvl} color={v === lvl ? "#6366f1" : "#9ca3af"} size={10} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: v === lvl ? "var(--v4-accent)" : "var(--v4-text3)" }}>≥ {["", "Faible", "Modérée", "Élevée"][lvl]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {chaineGoalActive && (
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {/* Scénarios nommés du décideur : marqués distinctement s'ils atteignent la cible */}
            {session.scenarios.length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {session.scenarios.map(sc => {
                  const reaches = chaineScenarioReaches(sc);
                  const isSel = chaineSelectedCombo === `scenario:${sc.id}`;
                  return (
                    <button key={sc.id} onClick={() => { setChaineSelectedCombo(`scenario:${sc.id}`); applyScenario(sc); }}
                      style={{ fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                        border: isSel ? "1.5px solid #6366f1" : reaches ? "1.5px solid #059669" : "1px solid var(--v4-border)",
                        background: isSel ? "#6366f110" : reaches ? "#05966912" : "transparent",
                        color: isSel ? "#6366f1" : reaches ? "#059669" : "var(--v4-text2)" }}>
                      {reaches ? "✓ " : ""}{sc.label}
                    </button>
                  );
                })}
              </div>
            )}
            {/* Combinaisons brutes éligibles (leviers non repris dans un scénario nommé) */}
            {chaineGs.reaching.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 12, color: "var(--v4-text3)" }}>
                  {chaineGs.reaching.length} combinaison{chaineGs.reaching.length > 1 ? "s" : ""} de leviers sur {chaineEvals.length} atteign{chaineGs.reaching.length > 1 ? "ent" : "t"} cet objectif{chaineTruncated ? ` — calcul refusé : ${refusalText(chaineComboTotal, session.leviersDef, EXHAUSTIVE_LIMIT)}` : " (recherche exhaustive)"} :
                </div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", maxHeight: 90, overflowY: "auto" }}>
                  {chaineGs.reaching.slice(0, 40).map(c => {
                    const isSel = chaineSelectedCombo === `combo:${c.key}`;
                    const comboText = Object.entries(c.combo).map(([lid, oid]) => `${session.leviersDef.find(l => l.id === lid)?.label ?? lid} : ${optionIndex[oid]?.label ?? oid}`).join(" · ");
                    return (
                      <button key={c.key} title={comboText} onClick={() => { setChaineSelectedCombo(`combo:${c.key}`); applyCombo(c.combo); }}
                        style={{ fontSize: 12, fontWeight: 600, padding: "3px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                          border: isSel ? "1.5px solid #6366f1" : "1px solid #059669", background: isSel ? "#6366f110" : "#05966912", color: isSel ? "#6366f1" : "#059669" }}>
                        combinaison #{c.key.replace("cg", "")}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ padding: "8px 10px", borderRadius: 8, background: "#fffbeb", border: "1px solid #fcd34d", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                  Aucune combinaison n'atteint cet objectif avec les leviers actuels.
                </div>
                {chaineGs.bottlenecks[0] && (
                  <div style={{ fontSize: 13, color: "var(--v4-text2)" }}>
                     Critère bloquant : <strong>« {chaineCritLabel(chaineGs.bottlenecks[0].critId)} »</strong> ({chaineGs.bottlenecks[0].blocked} combinaison{chaineGs.bottlenecks[0].blocked > 1 ? "s" : ""} bloquée{chaineGs.bottlenecks[0].blocked > 1 ? "s" : ""}).
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Vue schématique exécutive ───────────────────────────────────────── */}
      {session.leviersDef.length > 0 && session.criteria.length > 0 && (() => {
        const moeScores = session.criteria.map(moe => {
          const bp = nodeBipolar(moe);
          const lbl = bipolarLabel(bp);
          return { moe, gPlus: bp.gPlus, dMinus: bp.dMinus, sym: lbl.sym, ss: { color: lbl.color, bg: lbl.bg, border: lbl.border } };
        });
        // ── Tous les niveaux de la hiérarchie, pour le diagramme complet ──────
        // (même moteur : nodeBipolar est un simple appel récursif, aucun nouveau calcul)
        type ScoredCrit = { crit: AtelierCriterion; parentId: string; sym: string; ss: { color: string; bg: string; border: string } };
        const mopScores: ScoredCrit[] = [];
        const tpmScores: ScoredCrit[] = [];
        for (const moe of session.criteria) {
          for (const mop of moe.children ?? []) {
            const mbl = bipolarLabel(nodeBipolar(mop));
            mopScores.push({ crit: mop, parentId: moe.id, sym: mbl.sym, ss: { color: mbl.color, bg: mbl.bg, border: mbl.border } });
            for (const tpm of mop.children ?? []) {
              const tbl = bipolarLabel(nodeBipolar(tpm));
              tpmScores.push({ crit: tpm, parentId: mop.id, sym: tbl.sym, ss: { color: tbl.color, bg: tbl.bg, border: tbl.border } });
            }
          }
        }
        const ROW_H = 30, ROW_GAP = 5, CONNECTOR_W = 34;
        // Connecteur SVG générique entre deux colonnes de hauteurs différentes.
        function Connector({ leftCount, rightCount, links }: { leftCount: number; rightCount: number; links: Array<[number, number]> }) {
          const totalLeftH = leftCount * ROW_H + Math.max(0, leftCount - 1) * ROW_GAP;
          const totalRightH = rightCount * ROW_H + Math.max(0, rightCount - 1) * ROW_GAP;
          const svgH = Math.max(totalLeftH, totalRightH, ROW_H);
          const leftCenter = (i: number) => (ROW_H / 2) + i * (ROW_H + ROW_GAP) + (svgH - totalLeftH) / 2;
          const rightCenter = (i: number) => (ROW_H / 2) + i * (ROW_H + ROW_GAP) + (svgH - totalRightH) / 2;
          return (
            <svg width={CONNECTOR_W} height={svgH} style={{ flexShrink: 0 }} viewBox={`0 0 ${CONNECTOR_W} ${svgH}`}>
              {links.map(([li, ri], k) => {
                const y1 = leftCenter(li), y2 = rightCenter(ri);
                return <path key={k} d={`M0,${y1} C${CONNECTOR_W * 0.4},${y1} ${CONNECTOR_W * 0.6},${y2} ${CONNECTOR_W},${y2}`} fill="none" stroke="#6366f1" strokeWidth="1" strokeOpacity="0.25" />;
              })}
            </svg>
          );
        }
        // Colonne compacte réutilisable (TPM / MOP)
        function MiniCol({ title, items }: { title: string; items: ScoredCrit[] }) {
          return (
            <div style={{ display: "flex", flexDirection: "column", gap: ROW_GAP, minWidth: 118, maxWidth: 150 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, paddingLeft: 4 }}>{title}</div>
              {items.map(({ crit, sym, ss }) => (
                <div key={crit.id} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 5, padding: "0 7px", borderRadius: 6, border: `1.5px solid ${ss.border}`, background: ss.bg + "40" }}>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={crit.label}>{crit.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 900, color: ss.color, flexShrink: 0 }}>{sym}</span>
                </div>
              ))}
            </div>
          );
        }
        // Liens Leviers→TPM (impact réel de l'option choisie sur cet indicateur)
        const levTpmLinks: Array<[number, number]> = [];
        session.leviersDef.forEach((lev, li) => {
          const opt = lev.options.find(o => o.label === selectedOpts[lev.id]);
          tpmScores.forEach(({ crit }, ti) => {
            const hasImpact = opt ? (QI_TO_NUM[opt.impacts[crit.id] ?? "0"] ?? 50) > 50 : false;
            if (hasImpact) levTpmLinks.push([li, ti]);
          });
        });
        // Liens structurels TPM→MOP et MOP→MOE (toujours tracés : c'est la hiérarchie du modèle)
        const tpmMopLinks: Array<[number, number]> = tpmScores.map(({ parentId }, ti) => [ti, mopScores.findIndex(m => m.crit.id === parentId)]).filter(([, mi]) => mi >= 0) as Array<[number, number]>;
        const mopMoeLinks: Array<[number, number]> = mopScores.map(({ parentId }, mi) => [mi, moeScores.findIndex(m => m.moe.id === parentId)]).filter(([, oi]) => oi >= 0) as Array<[number, number]>;
        return (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface)", flexShrink: 0, overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "var(--v4-text3)", textTransform: "uppercase" }}>
                Vue schématique — Chaîne de décision
              </div>
              <div style={{ fontSize: 12, color: "var(--v4-text3)" }}>Leviers → Indicateurs → Dimensions → Objectifs → Décision</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 0, minWidth: 980 }}>

              {/* ── Col 1 : Leviers ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140, maxWidth: 170 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, paddingLeft: 4 }}>Leviers</div>
                {session.leviersDef.map(lev => {
                  const selOpt = lev.options.find(o => o.label === selectedOpts[lev.id]);
                  const levStage1 = session.criteria.map(c => aggregateHierarchy(c, syntheticSc, optionIndex, attitudeCode, profile));
                  const levWeights = session.criteria.map(c => importanceToWeight(c.importance));
                  const levMaxW = Math.max(...levWeights, 1);
                  const levNormW: OrdinalLevel[] = thesisWeights(levWeights);
                  let levBp: OrdinalImpact;
                  try { levBp = aggregateNode(levStage1, levNormW.length ? levNormW : [3]); } catch { levBp = { gPlus: 0, dMinus: 0 }; }
                  const ss = { color: bipolarLabel(levBp).color, bg: bipolarLabel(levBp).bg, border: bipolarLabel(levBp).border };
                  return (
                    <div key={lev.id} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 6, padding: "0 8px", borderRadius: 8, border: `1.5px solid ${ss.border}`, background: ss.bg + "40" }}>
                      <AuraIcon e={LEVER_ICONS[lev.type] ?? ""} size={12} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lev.label}</div>
                        <select
                          value={lev.options.find(o => o.label === selectedOpts[lev.id])?.id ?? ""}
                          onChange={e => {
                            const newOpt = lev.options.find(o => o.id === e.target.value);
                            if (newOpt) setSelectedOpts(prev => ({ ...prev, [lev.id]: newOpt.label }));
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 12, color: "var(--v4-text2)", background: "transparent", border: "none", padding: 0, marginTop: 1, maxWidth: "100%", cursor: "pointer" }}
                        >
                          {lev.options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                        </select>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 900, color: ss.color, flexShrink: 0 }}>{bipolarLabel(levBp).sym}</span>
                    </div>
                  );
                })}
              </div>

              <Connector leftCount={session.leviersDef.length} rightCount={tpmScores.length} links={levTpmLinks} />

              {/* ── Col 2 : Indicateurs (TPM) ── */}
              <MiniCol title="Indicateurs" items={tpmScores} />

              <Connector leftCount={tpmScores.length} rightCount={mopScores.length} links={tpmMopLinks} />

              {/* ── Col 3 : Dimensions (MOP) ── */}
              <MiniCol title="Dimensions" items={mopScores} />

              <Connector leftCount={mopScores.length} rightCount={moeScores.length} links={mopMoeLinks} />

              {/* ── Col 4 : MOEs ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2, paddingLeft: 4 }}>Objectifs</div>
                {moeScores.map(({ moe, sym, ss }) => (
                  <div key={moe.id} style={{ height: ROW_H, display: "flex", alignItems: "center", gap: 8, padding: "0 10px", borderRadius: 8, border: `1.5px solid ${ss.border}`, background: ss.bg + "55" }}>
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{moe.label}</span>
                    <span style={{ fontSize: 15.5, fontWeight: 900, color: ss.color, flexShrink: 0 }}>{sym}</span>
                  </div>
                ))}
              </div>

              {/* ── Arrow to final ── */}
              <div style={{ display: "flex", alignItems: "center", padding: "0 12px", flexShrink: 0 }}>
                <div style={{ height: 2, width: 32, background: `linear-gradient(90deg, var(--v4-border), ${scoreLabel.color})` }} />
                <div style={{ width: 0, height: 0, borderTop: "5px solid transparent", borderBottom: "5px solid transparent", borderLeft: `6px solid ${scoreLabel.color}` }} />
              </div>

              {/* ── Final decision box ── */}
              <div style={{ flexShrink: 0, minWidth: 150, padding: "14px 16px", borderRadius: 8, border: `2px solid ${scoreLabel.border}`, background: scoreLabel.bg, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, textAlign: "center" }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: scoreLabel.color, textTransform: "uppercase", letterSpacing: ".07em" }}>Décision</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: scoreLabel.color, lineHeight: 1 }}>{scoreLabel.sym}</div>
                <div style={{ fontSize: 12, color: scoreLabel.color, fontWeight: 700, lineHeight: 1.3 }}>{scoreLabel.text}</div>
                {/* ── Score explicite (les deux valeurs ordinales qui composent le symbole) ── */}
                {(() => {
                  const ORD: Record<number, string> = { 0: "Aucune", 1: "Faible", 2: "Modérée", 3: "Élevée" };
                  return (
                    <div style={{ display: "flex", gap: 6, width: "100%" }}>
                      <div style={{ flex: 1, padding: "4px 6px", borderRadius: 6, background: "#ffffffaa", border: "1px solid " + scoreLabel.border }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", textTransform: "uppercase", letterSpacing: ".05em" }}>Potentiel ↑</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>{ORD[liveResult.gPlus]}</div>
                      </div>
                      <div style={{ flex: 1, padding: "4px 6px", borderRadius: 6, background: "#ffffffaa", border: "1px solid " + scoreLabel.border }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: "#dc2626", textTransform: "uppercase", letterSpacing: ".05em" }}>Risque ↓</div>
                        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>{ORD[liveResult.dMinus]}</div>
                      </div>
                    </div>
                  );
                })()}
                {scoreLabel.sym === "△" && (
                  <div style={{ fontSize: 12, color: "#6d28d9", lineHeight: 1.4, background: "#faf5ff", borderRadius: 6, padding: "3px 6px" }}>
                    △ = un potentiel d'amélioration <strong>et</strong> un risque de dégradation coexistent — ni franchement bon, ni franchement mauvais.
                  </div>
                )}
                {uncoveredEssential.length > 0 && (
                  <div style={{ fontSize: 12, color: "#dc2626", background: "#fee2e2", borderRadius: 6, padding: "2px 6px", marginTop: 2 }}>
                    ⚠ {uncoveredEssential.length} critère{uncoveredEssential.length > 1 ? "s" : ""} non couvert{uncoveredEssential.length > 1 ? "s" : ""}
                  </div>
                )}
                {chaineGoalActive && (() => {
                  const reached = chaineActiveTargets.every(t => {
                    const crit = chaineTargetable.find(m => m.id === t.critId);
                    if (!crit) return false;
                    const r = nodeBipolar(crit);
                    return r.gPlus >= t.min && r.dMinus <= (goalTolerate ? 1 : 0);
                  });
                  return reached ? (
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#059669", background: "#d1fae5", borderRadius: 6, padding: "2px 7px", marginTop: 2 }}>
                      ✓ objectif atteint
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", background: "#fef3c7", borderRadius: 6, padding: "2px 7px", marginTop: 2 }}>
                      ✗ objectif non atteint
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 3 zones détail ─────────────────────────────────────────────────────── */}
      {session.leviersDef.length === 0 ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 31.5 }}></div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>Chaîne décisionnelle vide</div>
          <div style={{ fontSize: 13, color: "var(--v4-text3)", maxWidth: 360, lineHeight: 1.6 }}>
            Définissez des <strong>critères</strong> et des <strong>leviers</strong> dans l'étape Comprendre.
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "240px 1fr 196px", minHeight: 0, overflow: "hidden" }}>

          {/* ── Zone gauche : Leviers ───────────────────────────────────────── */}
          <div style={{ borderRight: "1px solid var(--v4-border)", overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "var(--v4-text3)", textTransform: "uppercase", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface)", flexShrink: 0 }}>
              Leviers &amp; Options
            </div>
            {session.leviersDef.map(lev => {
              const selOpt = selectedOpts[lev.id];
              return (
                <div key={lev.id} style={{ borderBottom: "1px solid var(--v4-border)", padding: "10px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <AuraIcon e={LEVER_ICONS[lev.type] ?? ""} size={14} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", lineHeight: 1.2 }}>{lev.label}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {lev.options.map(opt => {
                      const isSelected = selOpt === opt.label;
                      // Quick bipolar for this option if selected on this lever
                      const optSc = { ...syntheticSc, leviers: syntheticSc.leviers.map(l => l.id === lev.id ? { ...l, valeur: opt.id } : l) };
                      const optStage1 = session.criteria.map(c => aggregateHierarchy(c, optSc as AtelierScenario, optionIndex, attitudeCode, profile));
                      const optWeights = session.criteria.map(c => importanceToWeight(c.importance));
                      const optMaxW = Math.max(...optWeights, 1);
                      const optNormW: OrdinalLevel[] = thesisWeights(optWeights);
                      let optBp: OrdinalImpact;
                      try { optBp = aggregateNode(optStage1, optNormW.length ? optNormW : [3]); } catch { optBp = { gPlus: 0, dMinus: 0 }; }
                      const optLbl = bipolarLabel(optBp);
                      const optSym = optLbl.sym;
                      const optSs = { color: optLbl.color, bg: optLbl.bg, border: optLbl.border };
                      return (
                        <button key={opt.id} onClick={() => setSelectedOpts(prev => ({ ...prev, [lev.id]: opt.label }))}
                          style={{
                            display: "flex", alignItems: "center", gap: 7,
                            padding: "6px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                            textAlign: "left", border: isSelected ? "1.5px solid #6366f1" : "1px solid var(--v4-border)",
                            background: isSelected ? "#6366f110" : "var(--v4-bg)",
                            transition: "all .15s",
                          }}>
                          <div style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                            border: `2px solid ${isSelected ? "#6366f1" : "var(--v4-border)"}`,
                            background: isSelected ? "#6366f1" : "transparent",
                            display: "flex", alignItems: "center", justifyContent: "center" }}>
                            {isSelected && <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }} />}
                          </div>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isSelected ? "#6366f1" : "var(--v4-text2)", lineHeight: 1.3, display: "inline-flex", alignItems: "center", gap: 5 }}>{opt.label}{opt.exploratoire && <LampBadge compact />}</span>
                          <span style={{ fontSize: 13, fontWeight: 800, padding: "1px 6px", borderRadius: 6,
                            background: optSs.bg, color: optSs.color, border: `1px solid ${optSs.border}`, flexShrink: 0 }}>
                            {optSym}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Zone centrale : Arbre MOE/MOP/TPM ──────────────────────────── */}
          <div style={{ overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "var(--v4-text3)", textTransform: "uppercase", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface)", flexShrink: 0, display: "flex", alignItems: "center", gap: 12 }}>
              <span>Critères — objectifs / dimensions / indicateurs</span>
              <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--v4-text3)", fontWeight: 400, letterSpacing: 0 }}>
                {leaves.length} indicateurs · {session.criteria.length} objectifs majeurs
              </span>
            </div>
            {session.criteria.map(moe => (
              <CritTreeNode key={moe.id} node={moe} depth={0} />
            ))}
          </div>

          {/* ── Zone droite : Score par MOE ─────────────────────────────────── */}
          <div style={{ borderLeft: "1px solid var(--v4-border)", overflow: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "8px 14px", fontSize: 12, fontWeight: 800, letterSpacing: ".08em", color: "var(--v4-text3)", textTransform: "uppercase", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface)", flexShrink: 0 }}>
              Score par objectif
            </div>

            {/* Global score */}
            <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--v4-border)", background: scoreLabel.bg + "60" }}>
              <div style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600, marginBottom: 4 }}>Score global</div>
              <div style={{ fontSize: 19, fontWeight: 900, color: scoreLabel.color, lineHeight: 1 }}>{scoreLabel.sym}</div>
              <div style={{ fontSize: 12, color: scoreLabel.color, marginTop: 4, lineHeight: 1.3 }}>{scoreLabel.text}</div>
            </div>

            {/* Per-MOE scores */}
            <div style={{ flex: 1, overflow: "auto" }}>
              {session.criteria.map(moe => {
                const moeBp = nodeBipolar(moe);
                const moeLbl = bipolarLabel(moeBp);
                const ss = { color: moeLbl.color, bg: moeLbl.bg, border: moeLbl.border };
                // Bar width: gPlus drives positive bar, dMinus drives negative bar
                const barW = Math.max(5, Math.round((moeBp.gPlus / 3) * 100));
                return (
                  <div key={moe.id} style={{ padding: "10px 14px", borderBottom: "1px solid var(--v4-border)" }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text)", marginBottom: 6, lineHeight: 1.3 }}>{moe.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {/* Bar */}
                      <div style={{ flex: 1, height: 8, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden" }}>
                        <div style={{ width: `${barW}%`, height: "100%", borderRadius: 6,
                          background: ss.color, transition: "width .4s ease" }} />
                      </div>
                      {/* Symbol */}
                      <span style={{ fontSize: 13, fontWeight: 900, color: ss.color, minWidth: 24, textAlign: "right" }}>{moeLbl.sym}</span>
                    </div>
                    {/* MOP breakdown */}
                    {moe.children?.length ? (
                      <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 2 }}>
                        {moe.children.map(mop => {
                          const mopBp = nodeBipolar(mop);
                          const mopLbl = bipolarLabel(mopBp);
                          return (
                            <div key={mop.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--v4-text3)" }}>
                              <span style={{ width: 4, height: 4, borderRadius: "50%", background: mopLbl.color, flexShrink: 0 }} />
                              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mop.label}</span>
                              <span style={{ fontWeight: 800, color: mopLbl.color }}>{mopLbl.sym}</span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              {/* Top lever card */}
              {topLever && (
                <div style={{ margin: "10px 14px", padding: "10px 12px", borderRadius: 8, border: "1px solid #6366f130", background: "#6366f108" }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: "#6366f1", marginBottom: 4 }}> Levier le plus décisif</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 12 }}>{topLever.lev.label}</div>
                  <div style={{ fontSize: 12, color: "#059669", marginBottom: 2 }}>▲ {topLever.delta} critère{topLever.delta > 1 ? "s" : ""} couvert{topLever.delta > 1 ? "s" : ""}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Alerte bas de page ──────────────────────────────────────────────── */}
      {uncoveredEssential.length > 0 && (
        <div style={{ borderTop: "1px solid #fca5a5", background: "#fff1f2", padding: "7px 18px", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span style={{ fontSize: 13, color: "#991b1b" }}>
            <strong>Critères Essentiel sans couverture :</strong>{" "}
            {uncoveredEssential.map(l => l.label).join(", ")}
          </span>
        </div>
      )}
    </div>
  );

  if (embedded) return inner;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 200, display: "flex", alignItems: "stretch", justifyContent: "center", padding: "16px" }}>
      <div ref={modalRef} style={{ background: "var(--v4-bg)", borderRadius: 8, border: "1px solid var(--v4-border)", width: "100%", maxWidth: 1200, display: "flex", flexDirection: "column", boxShadow: "0 24px 80px rgba(0,0,0,.35)", overflow: "hidden" }}>
        {inner}
      </div>
    </div>
  );
}

// ── Plan d'action post-arbitrage ─────────────────────────────────────────────
const ACTION_PLAN_TYPES = [
  {
    id: "ops",
    icon: "",
    label: "Actions opérationnelles",
    desc: "Optimiser les processus et les opérations actuelles.",
    examples: "Ex : Plan d'achats, optimisation stocks, négociations…",
    color: "#0369a1",
    bg: "#e0f2fe",
    border: "#bae6fd",
  },
  {
    id: "org",
    icon: "",
    label: "Actions organisationnelles",
    desc: "Adapter l'organisation et les responsabilités.",
    examples: "Ex : Gouvernance, rôles, compétences, comités…",
    color: "#2b2b2b",
    bg: "#ededed",
    border: "#f2f2f2",
  },
  {
    id: "com",
    icon: "",
    label: "Actions commerciales",
    desc: "Développer l'offre et le positionnement marché.",
    examples: "Ex : Stratégie prix, contrats, partenariats, go-to-market…",
    color: "#b45309",
    bg: "#fef3c7",
    border: "#fcd34d",
  },
  {
    id: "transfo",
    icon: "",
    label: "Initiative de transformation",
    desc: "Modifier en profondeur le système d'entreprise (métiers & SI).",
    examples: "Ex : Digitalisation, nouveaux SI, intégrations, données…",
    color: "#059669",
    bg: "#d1fae5",
    border: "#6ee7b7",
    isTransfo: true,
  },
];

// Le plan d'action n'est plus un simple choix de catégorie : il expose les
// INITIATIVES réellement portées par le scénario retenu, dérivées du modèle
// (levier → option retenue → impacts ordinaux → besoins tracés), sans aucun
// appel LLM et sans aucun chiffre inventé. L'utilisateur coche ce qu'il engage,
// en gardant la traçabilité vers la décision d'origine.
function ActionPlanSection({ bestLabel, session, bestNr, best }: { bestLabel: string; scenarioId: string; session: AtelierSession; bestNr?: { gPlus: number; dMinus: number } | null; best?: AtelierScenario | null }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  // Dérivation déterministe : ce que le scénario engage réellement.
  const initiatives = useMemo(
    () => (best ? deriveInitiatives(session, best) : []),
    [session, best],
  );
  const retained = initiatives.filter(i => !excluded[i.id]);

  // AI-derived suggestion based on scenario profile
  const suggestion = (() => {
    const gp = bestNr?.gPlus ?? 0;
    const dm = bestNr?.dMinus ?? 0;
    if (gp >= 2 && dm <= 1) return { id: "transfo", reason: "Ce scénario présente un potentiel d'amélioration élevé avec un risque maîtrisé — une initiative de transformation structurée permettra de maximiser la valeur créée." };
    if (gp >= 1 && dm === 0) return { id: "org", reason: "Le scénario retenu est favorable et peu risqué — une réorganisation ciblée suffit à ancrer la décision dans les pratiques." };
    if (dm >= 2) return { id: "com", reason: "Le niveau de risque identifié appelle des actions commerciales rapides pour sécuriser les parties prenantes et le marché." };
    return { id: "ops", reason: "Ce scénario peut être déployé via des ajustements opérationnels progressifs, sans restructuration lourde." };
  })();
  const suggType = ACTION_PLAN_TYPES.find(t => t.id === suggestion.id);


  const IMPACT_CHIP: Record<string, { bg: string; fg: string }> = {
    "++": { bg: "#d1fae5", fg: "#065f46" }, "+": { bg: "#ecfdf5", fg: "#059669" },
    "-": { bg: "#fef3c7", fg: "#92400e" }, "--": { bg: "#fee2e2", fg: "#991b1b" },
    "U": { bg: "#f3f4f6", fg: "#6b7280" },
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* Aura AI suggestion */}
      <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, border: "1.5px solid #6366f133", background: "linear-gradient(135deg,#6366f108,#818cf808)", display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ fontSize: 14, flexShrink: 0 }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#6366f1", marginBottom: 2 }}>
            Aura recommande : <span style={{ color: suggType?.color ?? "#6366f1" }}>{suggType?.icon} {suggType?.label}</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.45 }}>{suggestion.reason}</div>
        </div>
        <button onClick={() => setSelected(suggestion.id)}
          style={{ flexShrink: 0, padding: "5px 10px", borderRadius: 8, border: `1px solid ${suggType?.color ?? "#6366f1"}44`, background: `${suggType?.color ?? "#6366f1"}10`, color: suggType?.color ?? "#6366f1", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
          Appliquer →
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 16 }}>
        {ACTION_PLAN_TYPES.map(t => (
          <button key={t.id} onClick={() => setSelected(t.id === selected ? null : t.id)}
            style={{
              textAlign: "left", padding: "12px 12px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              border: `${selected === t.id ? 2 : 1}px solid ${selected === t.id ? t.color : "var(--v4-border)"}`,
              background: selected === t.id ? t.bg : "var(--v4-bg)",
              transition: "all .15s", display: "flex", flexDirection: "column", gap: 6,
            }}>
            <AuraIcon e={t.icon} size={20} />
            <div style={{ fontSize: 13, fontWeight: 700, color: t.color, lineHeight: 1.3 }}>{t.label}</div>
            <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.4 }}>{t.desc}</div>
            <div style={{ fontSize: 12, color: "var(--v4-text3)", lineHeight: 1.4, marginTop: 2 }}>{t.examples}</div>
            <div style={{ marginTop: "auto", paddingTop: 6 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${selected === t.id ? t.color : "var(--v4-border)"}`, background: selected === t.id ? t.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {selected === t.id && <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Initiatives dérivées du scénario retenu ─────────────────────────── */}
      {initiatives.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>
                Ce que « {bestLabel} » engage réellement
              </div>
              <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 2, lineHeight: 1.45 }}>
                {initiatives.length} initiative{initiatives.length > 1 ? "s" : ""} déduite{initiatives.length > 1 ? "s" : ""} des leviers retenus. Rien n'est estimé : chaque ligne renvoie à un jugement de votre modèle.
              </div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--v4-accent)", whiteSpace: "nowrap" }}>
              {retained.length}/{initiatives.length} retenue{retained.length > 1 ? "s" : ""}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {initiatives.map(i => {
              const off = Boolean(excluded[i.id]);
              const open = expanded === i.id;
              return (
                <div key={i.id} style={{
                  borderRadius: 8, border: `1px solid ${off ? "var(--v4-border)" : "var(--v4-accent-border)"}`,
                  background: off ? "var(--v4-bg2)" : "var(--v4-bg)", opacity: off ? 0.55 : 1, transition: "opacity .15s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px" }}>
                    <input type="checkbox" checked={!off} aria-label={`Retenir ${i.titre}`}
                      onChange={() => setExcluded(p => ({ ...p, [i.id]: !off ? true : false }))}
                      style={{ marginTop: 2, accentColor: "var(--v4-accent)", cursor: "pointer", width: 14, height: 14, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{i.titre}</span>
                        {i.exploratoire && (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: "#2b2b2b14", color: "#2b2b2b" }}>
                            option latérale
                          </span>
                        )}
                        {i.aConfirmerCount > 0 && (
                          <span style={{ fontSize: 12, fontWeight: 700, padding: "1px 5px", borderRadius: 6, background: "#fef3c7", color: "#92400e" }}>
                            {i.aConfirmerCount} jugement{i.aConfirmerCount > 1 ? "s" : ""} à confirmer
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 3, lineHeight: 1.45 }}>
                        {INITIATIVE_NATURE_LABEL[i.nature]}
                        {i.objectifsEnJeu[0] ? ` · sert « ${i.objectifsEnJeu[0].label} »` : ""}
                      </div>
                      <div style={{ display: "flex", gap: 5, marginTop: 5, flexWrap: "wrap" }}>
                        {i.apports.length > 0 && <Chip c={IMPACT_CHIP["+"]!} t={`${i.apports.length} amélioration${i.apports.length > 1 ? "s" : ""}`} />}
                        {i.couts.length > 0 && <Chip c={IMPACT_CHIP["-"]!} t={`${i.couts.length} dégradation${i.couts.length > 1 ? "s" : ""}`} />}
                        {i.inconnues.length > 0 && <Chip c={IMPACT_CHIP["U"]!} t={`${i.inconnues.length} inconnue${i.inconnues.length > 1 ? "s" : ""}`} />}
                      </div>
                    </div>
                    <button onClick={() => setExpanded(open ? null : i.id)}
                      style={{ flexShrink: 0, padding: "3px 7px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                      {open ? "Réduire" : "Détail"}
                    </button>
                  </div>

                  {open && (
                    <div style={{ padding: "0 11px 10px 34px", display: "flex", flexDirection: "column", gap: 8 }}>
                      {i.justification && (
                        <div style={{ fontSize: 12.5, color: "var(--v4-text2)", lineHeight: 1.5, fontStyle: "italic" }}>
                          « {i.justification} »
                        </div>
                      )}
                      {([["Ce que ça améliore", i.apports], ["Ce que ça dégrade", i.couts], ["Ce qui reste inconnu", i.inconnues]] as const).map(([title, lines]) => lines.length > 0 && (
                        <div key={title}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: .3, marginBottom: 3 }}>{title}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            {lines.map(l => (
                              <div key={l.criterionId} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--v4-text2)" }}>
                                <span style={{ ...IMPACT_CHIP[l.impact], padding: "0 4px", borderRadius: 6, fontWeight: 800, fontSize: 12, minWidth: 18, textAlign: "center" }}>
                                  {l.impact === "U" ? "?" : l.impact}
                                </span>
                                <span>{l.label}</span>
                                <span style={{ fontSize: 12, color: "var(--v4-text3)" }}>{l.level} · {l.moeLabel}</span>
                                {l.aConfirmer && <span style={{ fontSize: 12, color: "#92400e" }}>à confirmer</span>}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {i.besoinsTraces.length > 0 && (
                        <div style={{ fontSize: 12.5, color: "var(--v4-text3)", lineHeight: 1.5 }}>
                          <strong style={{ color: "var(--v4-text2)" }}>Besoin d'origine :</strong> {i.besoinsTraces.join(" · ")}
                        </div>
                      )}
                      {i.indicateurs.length > 0 && (
                        <div style={{ fontSize: 12.5, color: "var(--v4-text3)", lineHeight: 1.5 }}>
                          <strong style={{ color: "var(--v4-text2)" }}>À observer :</strong> {i.indicateurs.join(" · ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {selected && (
        <div style={{ padding: "11px 14px", borderRadius: 8, background: "var(--v4-accent-bg)", border: "1px solid var(--v4-accent-border)", fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            Plan <strong style={{ color: "var(--v4-accent)" }}>{ACTION_PLAN_TYPES.find(t => t.id === selected)?.label}</strong> retenu pour le scénario <strong>« {bestLabel} »</strong>.
            {retained.length > 0 && (
              <> {retained.length} initiative{retained.length > 1 ? "s" : ""} retenue{retained.length > 1 ? "s" : ""} pour la mise en œuvre.</>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Petite pastille de comptage, utilisée par le plan d'action. */
function Chip({ c, t }: { c: { bg: string; fg: string }; t: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, padding: "1.5px 6px", borderRadius: 6, background: c.bg, color: c.fg }}>{t}</span>
  );
}


// ─── PlaygroundPanel — Explorer l'espace décisionnel ─────────────────────────
const ORD_AXIS_PG: Record<number, string> = { 0: "Aucune", 1: "Faible", 2: "Modérée", 3: "Élevée" };
const IMP_SEQ_PG: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
// CSS pour les jauges natives — injecté une seule fois
const GAUGE_STYLE = `
.aura-gauge{-webkit-appearance:none;appearance:none;width:100%;height:6px;border-radius:6px;outline:none;cursor:pointer;background:transparent}
.aura-gauge::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.25);cursor:pointer;transition:transform .12s,box-shadow .12s}
.aura-gauge::-moz-range-thumb{width:18px;height:18px;border-radius:50%;border:2.5px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.25);cursor:pointer}
.aura-gauge:hover::-webkit-slider-thumb{transform:scale(1.18);box-shadow:0 2px 10px rgba(0,0,0,.3)}
.aura-gauge::-webkit-slider-runnable-track{height:6px;border-radius:6px}
.aura-gauge::-moz-range-track{height:6px;border-radius:6px}
`;
const IMP_VAL_PG: Record<ImportanceBadge, number> = { Faible: 1, Secondaire: 2, Important: 3, Essentiel: 4 };
const IMP_COLOR_PG: Record<ImportanceBadge, { track: string; thumb: string; label: string }> = {
  Faible:     { track: "#d1d5db", thumb: "#6b7280", label: "#6b7280" },
  Secondaire: { track: "#fcd34d", thumb: "#d97706", label: "#92400e" },
  Important:  { track: "#6ee7b7", thumb: "#059669", label: "#065f46" },
  Essentiel:  { track: "#c4b5fd", thumb: "#6750a4", label: "#4c1d95" },
};
const IMPACT_COLOR_PG: Record<string, { bg: string; fg: string; bar: string }> = {
  "++": { bg: "#d1fae5", fg: "#065f46", bar: "#10b981" },
  "+":  { bg: "#ecfdf5", fg: "#059669", bar: "#34d399" },
  "0":  { bg: "#f3f4f6", fg: "#6b7280", bar: "#d1d5db" },
  "-":  { bg: "#fef3c7", fg: "#92400e", bar: "#fbbf24" },
  "--": { bg: "#fee2e2", fg: "#991b1b", bar: "#f87171" },
  "U":  { bg: "#f3f4f6", fg: "#9ca3af", bar: "#e5e7eb" },
};

function PlaygroundPanel({
  localCriteria, localLeviersDef, session, nodeResults, leafCriteria, promising, best,
  onCritChange, onLevierDefChange, onReset,
}: {
  localCriteria: AtelierCriterion[];
  localLeviersDef: AtelierLevierDef[];
  session: AtelierSession;
  nodeResults: Record<string, { gPlus: number; dMinus: number }>;
  leafCriteria: AtelierCriterion[];
  promising: AtelierScenario[];
  best: AtelierScenario | null;
  onCritChange: (id: string, imp: ImportanceBadge) => void;
  onLevierDefChange: (updater: (prev: AtelierLevierDef[]) => AtelierLevierDef[]) => void;
  onReset: () => void;
}) {
  const [tab, setTab] = useState<"poids" | "leviers" | "determinants">("poids");

  // Critères déterminants : plus grand écart de score entre scénarios
  const discriminants = (() => {
    if (!session.scenarios.length || !leafCriteria.length) return [];
    const impVal: Record<string, number> = { "++": 2, "+": 1, "0": 0, "-": -1, "--": -2, "U": 0 };
    return leafCriteria.map(leaf => {
      const values = session.scenarios.map(sc => {
        const lev = localLeviersDef.find(l => sc.leviers.some(sl => sl.id === l.id || sl.label === l.label));
        const opt = lev?.options.find(o => sc.leviers.some(sl => sl.valeur === o.id || sl.valeur === o.label));
        return impVal[opt?.impacts[leaf.id] ?? "0"] ?? 0;
      });
      const range = Math.max(...values) - Math.min(...values);
      const bestIdx = session.scenarios.findIndex(s => s.id === best?.id);
      const bestVal = bestIdx >= 0 ? values[bestIdx] : 0;
      return { leaf, range, bestVal, values };
    }).filter(d => d.range > 0).sort((a, b) => b.range - a.range).slice(0, 7);
  })();

  // Score live
  const bestNrLive = best ? (nodeResults[best.id] ?? { gPlus: 0, dMinus: 0 }) : null;

  // Valeurs numériques pour chaque scénario / critère
  const IMP_NUM: Record<string, number> = { "++": 2, "+": 1, "0": 0, "-": -1, "--": -2, "U": 0 };
  const impValMap: Record<number, { label: string; color: string; bg: string }> = {
    2:  { label: "++", color: "#065f46", bg: "#d1fae5" },
    1:  { label: "+",  color: "#059669", bg: "#ecfdf5" },
    0:  { label: "·",  color: "#9ca3af", bg: "#f3f4f6" },
    [-1]: { label: "−",  color: "#92400e", bg: "#fef3c7" },
    [-2]: { label: "−−", color: "#991b1b", bg: "#fee2e2" },
  };

  return (
    <>
      {/* Inject gauge CSS once */}
      <style>{GAUGE_STYLE}</style>
      <div style={{ border: "1.5px solid var(--v4-border)", borderRadius: 8, overflow: "hidden", background: "var(--v4-surface)" }}>

        {/* ── Header ── */}
        <div style={{ padding: "9px 12px 0", background: "var(--v4-bg)", borderBottom: "1px solid var(--v4-border)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}> Simulateur</span>
            {/* Score live compact */}
            {best && bestNrLive && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
                {/* Potentiel gauge */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600 }}>Potentiel</span>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ width: 5, height: 5 + i * 3, borderRadius: 6,
                        background: i <= bestNrLive.gPlus ? "#059669" : "var(--v4-border)",
                        transition: "background .25s" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: "#059669" }}>{ORD_AXIS_PG[bestNrLive.gPlus as OrdinalLevel]}</span>
                </div>
                {/* Risque gauge */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600 }}>Risque</span>
                  <div style={{ display: "flex", gap: 2, alignItems: "flex-end" }}>
                    {[1,2,3].map(i => (
                      <div key={i} style={{ width: 5, height: 5 + i * 3, borderRadius: 6,
                        background: i <= bestNrLive.dMinus ? (bestNrLive.dMinus >= 2 ? "#dc2626" : "#f59e0b") : "var(--v4-border)",
                        transition: "background .25s" }} />
                    ))}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 800, color: bestNrLive.dMinus >= 2 ? "#dc2626" : "#f59e0b" }}>{ORD_AXIS_PG[bestNrLive.dMinus as OrdinalLevel]}</span>
                </div>
                <button onClick={onReset} title="Réinitialiser"
                  style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>↺</button>
              </div>
            )}
          </div>
          {/* Tabs */}
          <div style={{ display: "flex" }}>
            {([
              { key: "poids",        icon: "", label: "Poids" },
              { key: "leviers",      icon: "",  label: "Leviers" },
              { key: "determinants", icon: "",  label: "Clés" },
            ] as const).map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                style={{ flex: 1, padding: "5px 4px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
                  color: tab === t.key ? "var(--v4-accent)" : "var(--v4-text3)",
                  borderBottom: tab === t.key ? "2px solid var(--v4-accent)" : "2px solid transparent",
                  marginBottom: -1, transition: "all .1s" }}>
                <AuraIcon e={t.icon} size={13} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "12px 12px 14px", maxHeight: 420, overflowY: "auto" }}>

          {/* ══ Tab Poids — vraies jauges à curseur ══ */}
          {tab === "poids" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", lineHeight: 1.5 }}>
                Glissez les jauges pour modifier l'importance de chaque critère. Le score Potentiel/Risque se met à jour.
              </p>
              {leafCriteria.map(c => {
                const imp = c.importance as ImportanceBadge;
                const val = IMP_VAL_PG[imp];         // 1-4
                const pct = ((val - 1) / 3) * 100;  // 0-100
                const col = IMP_COLOR_PG[imp];
                // gradient: fill à gauche du thumb, gris à droite
                const trackBg = `linear-gradient(to right, ${col.thumb} 0%, ${col.thumb} ${pct}%, #e2e8f0 ${pct}%, #e2e8f0 100%)`;
                return (
                  <div key={c.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={c.label}>{c.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "1px 7px", borderRadius: 8, marginLeft: 8, flexShrink: 0,
                        background: col.thumb + "22", color: col.thumb, border: `1px solid ${col.thumb}50`,
                        transition: "all .2s" }}>
                        {imp}
                      </span>
                    </div>
                    <input
                      type="range" min={1} max={4} step={1} value={val}
                      className="aura-gauge"
                      onChange={e => onCritChange(c.id, IMP_SEQ_PG[Number(e.target.value) - 1])}
                      style={{ background: trackBg }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--v4-text3)", marginTop: 3, letterSpacing: ".02em" }}>
                      <span>Faible</span><span>Secondaire</span><span>Important</span><span>Essentiel</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ Tab Leviers ══ */}
          {tab === "leviers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {localLeviersDef.map(lev => {
                const bestOptId = best?.leviers.find(l => l.id === lev.id || l.label === lev.label)?.valeur;
                const scByOpt: Record<string, AtelierScenario[]> = {};
                for (const sc of session.scenarios) {
                  const sl = sc.leviers.find(l => l.id === lev.id || l.label === lev.label);
                  if (sl) { if (!scByOpt[sl.valeur]) scByOpt[sl.valeur] = []; scByOpt[sl.valeur].push(sc); }
                }
                const tc = LEVER_TYPE_COLORS[lev.type as LeverType] ?? LEVER_TYPE_COLORS.autre;
                return (
                  <div key={lev.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
                      <AuraIcon e={LEVER_ICONS[lev.type as LeverType] ?? "◈"} size={13} />
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{lev.label}</span>
                      <span style={{ fontSize: 12, padding: "1px 5px", borderRadius: 8, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>{lev.type}</span>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {lev.options.map(opt => {
                        const isBest = bestOptId === opt.id || bestOptId === opt.label;
                        const impEntries = Object.entries(opt.impacts).filter(([,v]) => v !== "0" && v !== "U");
                        const usedBy = scByOpt[opt.id] ?? [];
                        return (
                          <div key={opt.id} style={{
                            borderRadius: 8, overflow: "hidden",
                            border: `${isBest ? 2 : 1}px solid ${isBest ? "var(--v4-accent)" : "var(--v4-border)"}`,
                            background: isBest ? "var(--v4-accent-bg)" : "var(--v4-surface2)",
                          }}>
                            <div style={{ padding: "6px 9px", display: "flex", alignItems: "center", gap: 5, borderBottom: impEntries.length ? "1px solid var(--v4-border)" : "none" }}>
                              {isBest && <span style={{ fontSize: 12, color: "var(--v4-accent)" }}>★</span>}
                              <span style={{ fontSize: 13, fontWeight: 700, color: isBest ? "var(--v4-accent)" : "var(--v4-text)", flex: 1 }}>{opt.label}</span>
                              {usedBy.map(sc => (
                                <span key={sc.id} style={{ fontSize: 12, fontWeight: 700, padding: "1px 4px", borderRadius: 6, background: sc.color+"20", color: sc.color }}>{sc.label.slice(0,6)}</span>
                              ))}
                            </div>
                            {impEntries.length > 0 && (
                              <div style={{ padding: "6px 9px", display: "flex", flexDirection: "column", gap: 3 }}>
                                {impEntries.map(([critId, imp]) => {
                                  const lbl = leafCriteria.find(l => l.id === critId)?.label ?? critId;
                                  const ic = IMPACT_COLOR_PG[imp] ?? IMPACT_COLOR_PG["0"];
                                  const isPos = imp === "++" || imp === "+";
                                  const barW = imp === "++" || imp === "--" ? 100 : 62;
                                  return (
                                    <div key={critId} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                      <span style={{ fontSize: 12, color: "var(--v4-text3)", width: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }} title={lbl}>{lbl}</span>
                                      {/* Mini bar centré */}
                                      <div style={{ flex: 1, height: 5, borderRadius: 6, background: "var(--v4-border)", position: "relative", overflow: "hidden" }}>
                                        <div style={{ position: "absolute", height: "100%", width: `${barW}%`, background: ic.bar, borderRadius: 6,
                                          left: isPos ? 0 : "auto", right: isPos ? "auto" : 0 }} />
                                      </div>
                                      <span style={{ fontSize: 12, fontWeight: 800, color: ic.fg, width: 16, textAlign: "right", flexShrink: 0 }}>{imp}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ══ Tab Critères clés ══ */}
          {tab === "determinants" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p style={{ margin: 0, fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", lineHeight: 1.5 }}>
                Critères qui créent le plus grand écart entre scénarios.
              </p>
              {discriminants.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>Pas assez d'écart détectable.</div>
              ) : discriminants.map(({ leaf, range, values }) => {
                const maxRange = discriminants[0].range || 1;
                const barPct = Math.round((range / (maxRange + 0.5)) * 100);
                return (
                  <div key={leaf.id} style={{ padding: "9px 10px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface2)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={leaf.label}>{leaf.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "var(--v4-accent)", flexShrink: 0, marginLeft: 12 }}>Δ+{range}</span>
                    </div>
                    {/* Barre discriminant */}
                    <div style={{ height: 5, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden", marginBottom: 8 }}>
                      <div style={{ height: "100%", width: `${barPct}%`, background: "linear-gradient(90deg,#6366f1,#a78bfa)", borderRadius: 6 }} />
                    </div>
                    {/* Scores par scénario */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {session.scenarios.map((sc, idx) => {
                        const v = values[idx] ?? 0;
                        const d = impValMap[v] ?? impValMap[0];
                        return (
                          <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", borderRadius: 6, background: d.bg, border: `1px solid ${sc.color}40` }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 600 }}>{sc.label.slice(0,8)}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: d.color }}>{d.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        <div style={{ marginTop: 20 }}>
        </div>
      </div>
    </>
  );
}

// ─── ⑤ Suivi ─────────────────────────────────────────────────────────────────
const MOE_COLORS_SUIVI = ["#6366f1","#059669","#d97706","#dc2626","#0369a1","#7c3aed","#0891b2","#65a30d"];

// ── Améliorer (moteur Sow, IPMU 2016) ────────────────────────────────────────
// Quelles coalitions de critères améliorer en priorité : worth (intégrale de
// intégrale qualitative + médiane) sous contrainte d'atteignabilité (capacité
// d'action réelle des leviers). Tout ordinal — validé sur les fixtures du papier.
const SOW_IMPACT_S: Record<string, number> = { "++": 3, "+": 2 };
const SOW_IMPACT_D: Record<string, number> = { "--": 3, "-": 2 };

function SowImprovePanel({ session }: { session: AtelierSession }) {
  const [open, setOpen] = useState(false);
  const [showAllQ, setShowAllQ] = useState(false);

  // ── Questions d'interaction (élicitation de la capacité μ) ─────────────────
  // Aura POSE la question, l'humain répond, la capacité se raffine :
  // « Améliorer X sans Y a-t-il de la valeur en soi ? »
  //   · Oui → critères indépendants, μ possibiliste inchangée
  //   · Non → SYNERGIE : la valeur n'émerge qu'ensemble — toute coalition
  //     contenant l'un SANS l'autre voit sa capacité plafonnée à Faible.
  // Réponses persistées par session (aura-sow-mu-<id>).
  const MU_KEY = `aura-sow-mu-${session.id}`;
  // Une réponse porte sa provenance : posée par l'humain, ou hypothèse Aura à confirmer
  // (même convention que le pré-remplissage de la matrice d'impacts).
  type MuAnswer = { val: "oui" | "non"; origin?: "aura" };
  const [muAnswers, setMuAnswers] = useState<Record<string, MuAnswer>>(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(MU_KEY) ?? "{}") as Record<string, unknown>;
      const norm: Record<string, MuAnswer> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === "string") norm[k] = { val: v as "oui" | "non" };      // ancien format
        else if (v && typeof v === "object") norm[k] = v as MuAnswer;
      }
      return norm;
    } catch { return {}; }
  });
  const persistMu = (next: Record<string, MuAnswer>) => {
    try { localStorage.setItem(MU_KEY, JSON.stringify(next)); } catch { /* stockage indisponible */ }
  };
  const answerMu = (key: string, val: "oui" | "non") => {
    setMuAnswers(prev => {
      const next = { ...prev, [key]: { val } }; // action humaine → l'hypothèse Aura est levée
      persistMu(next);
      return next;
    });
  };
  // ✦ Pré-remplissage Aura (heuristique) : deux critères sous le MÊME objectif (MOE)
  // servent la même finalité → synergie probable (« non, ensemble seulement ») ;
  // sous des objectifs différents → indépendance probable (« oui »).
  // Ne remplace JAMAIS une réponse humaine.
  const prefillMu = (qs: Array<{ key: string; a: number; b: number }>, rootOf: (i: number) => string) => {
    setMuAnswers(prev => {
      const next = { ...prev };
      for (const q of qs) {
        if (next[q.key] && !next[q.key].origin) continue;
        next[q.key] = { val: rootOf(q.a) === rootOf(q.b) ? "non" : "oui", origin: "aura" };
      }
      persistMu(next);
      return next;
    });
  };

  const analysis = useMemo(() => {
    const leaves = getLeafCriteria(session.criteria);
    if (leaves.length < 2 || leaves.length > 12 || !session.leviersDef.length) return null;
    const importances = leaves.map(l => importanceToWeight(l.importance));
    const sowActions = session.leviersDef.flatMap(lev => lev.options.map(opt => {
      const support: Record<number, number> = {};
      const distract: Record<number, number> = {};
      leaves.forEach((leaf, i) => {
        const v = opt.impacts[leaf.id];
        if (v && SOW_IMPACT_S[v]) support[i] = SOW_IMPACT_S[v];
        if (v && SOW_IMPACT_D[v]) distract[i] = SOW_IMPACT_D[v];
        // "U" et "0" n'alimentent pas la capacité d'action : on ne fonde pas
        // une ambition sur un effet inconnu ou nul.
      });
      return { id: opt.id, label: opt.label, group: lev.id, support, distract };
    }));

    // Questions proposées par Aura : paires parmi les 3 critères les plus importants.
    const ranked = leaves.map((l, i) => ({ l, i })).sort((a, b) => importanceToWeight(b.l.importance) - importanceToWeight(a.l.importance)).slice(0, 3);
    const questions: Array<{ key: string; a: number; b: number; aLabel: string; bLabel: string }> = [];
    for (let x = 0; x < ranked.length; x++) for (let y = x + 1; y < ranked.length; y++) {
      const [ida, idb] = [ranked[x].l.id, ranked[y].l.id].sort();
      questions.push({ key: `${ida}|${idb}`, a: ranked[x].i, b: ranked[y].i, aLabel: ranked[x].l.label, bLabel: ranked[y].l.label });
    }

    // Ancêtre MOE de chaque feuille (pour l'heuristique de pré-remplissage).
    const rootIds: string[] = [];
    const walk = (c: AtelierCriterion, root: string) => {
      if (!c.children?.length) { const idx = leaves.findIndex(l => l.id === c.id); if (idx >= 0) rootIds[idx] = root; return; }
      c.children.forEach(ch => walk(ch, root));
    };
    session.criteria.forEach(c => walk(c, c.id));

    // Capacité : possibiliste de base, raffinée par les réponses « Non » (synergies).
    // Les hypothèses Aura non confirmées participent au calcul (comme les impacts ✦).
    const baseMu = possibilisticCapacity(importances, 3);
    const synergies = questions.filter(q => muAnswers[q.key]?.val === "non");
    const mu = (mask: number) => {
      let v = baseMu(mask);
      for (const s of synergies) {
        const hasA = Boolean(mask & (1 << s.a));
        const hasB = Boolean(mask & (1 << s.b));
        if (hasA !== hasB) v = Math.min(v, 1); // l'un sans l'autre → capacité Faible
      }
      return v;
    };

    const att = session.attitude === "Pessimiste" ? "pessimiste" as const : "optimiste" as const;
    try {
      return { leaves, questions, rootIds, refined: synergies.length, result: analyzeSow({
        nCriteria: leaves.length, p0: leaves.map(() => 0),
        mu, maxL: 3,
        actions: sowActions, worthAttitude: att, achievAttitude: att,
      }) };
    } catch { return null; }
  }, [session.criteria, session.leviersDef, session.attitude, muAnswers]);

  if (!analysis || !analysis.result.optimal.length) return null;
  const { leaves, result, questions, rootIds, refined } = analysis;
  const answeredCount = questions.filter(q => muAnswers[q.key]).length;
  const auraAnswered = questions.filter(q => muAnswers[q.key]?.origin === "aura").length;
  const ordLbl = ["nul", "faible", "moyen", "fort"];
  const names = (crit: number[]) => crit.map(i => leaves[i]?.label ?? "?").join(" + ");
  // Épuré : les 3 premières coalitions ; le reste à la demande.
  const shown = open ? result.coalitions.slice(0, 12) : result.optimal.slice(0, 3);

  return (
    <div style={{ borderRadius: 8, border: "1.5px solid #0ea5e940", background: "var(--v4-surface)", overflow: "hidden" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #0ea5e930", background: "#0ea5e908", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <span title="Coalitions de critères dont l'amélioration apporte le plus, sans dépasser votre capacité d'action (moteur Sow, validé sur résultats publiés). Fondez vos OKR sur les coalitions « ambitieux & atteignable » : l'ambition y est exactement couverte par vos leviers." style={{ fontSize: 13, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: ".08em" }}>▲ Améliorer</span>
        {refined > 0 && (
          <span style={{ fontSize: 12, fontWeight: 700, color: "#0369a1", border: "1px solid #0ea5e960", borderRadius: 8, padding: "2px 8px" }}>
            μ raffinée par vos réponses ({refined} synergie{refined > 1 ? "s" : ""})
          </span>
        )}
        <button onClick={() => setOpen(o => !o)} style={{ marginLeft: "auto", fontSize: 12, padding: "3px 10px", borderRadius: 8, border: "1px solid #0ea5e960", background: "transparent", color: "#0369a1", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
          {open ? "Réduire" : `Toutes (${result.coalitions.length})`}
        </button>
      </div>

      {/* ── Aura vous pose la question — élicitation des interactions ── */}
      {questions.length > 0 && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-bg)" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#0369a1", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span title="Vos réponses raffinent le calcul.">? Questions <span style={{ fontWeight: 600, color: "var(--v4-text3)", textTransform: "none", letterSpacing: 0 }}>({answeredCount}/{questions.length}{auraAnswered > 0 ? ` · ${auraAnswered} à confirmer` : ""})</span></span>
            {answeredCount < questions.length && (
              <button onClick={() => prefillMu(questions, i => rootIds[i] ?? "")}
                style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0, border: "1.5px dashed #8b5cf6", background: "transparent", color: "#8b5cf6" }}>
                ✦ Pré-remplir avec Aura
              </button>
            )}
            <button type="button" onClick={() => setShowAllQ(v => !v)} aria-expanded={showAllQ} style={{ fontSize: 12, padding: "3px 8px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit", textTransform: "none", letterSpacing: 0 }}>{showAllQ ? "Réduire" : "Toutes"}</button>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {(showAllQ ? questions : questions.filter(q => !muAnswers[q.key]).slice(0, 1)).map(q => {
              const ans = muAnswers[q.key];
              return (
                <div key={q.key} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "5px 9px", borderRadius: 8, background: "var(--v4-surface)", border: ans?.origin === "aura" ? "1.5px dashed #8b5cf6" : `1px solid ${ans ? "#0ea5e950" : "var(--v4-border)"}` }}>
                  <span style={{ fontSize: 13, color: "var(--v4-text)", flex: "1 1 260px" }}>
                    Améliorer <strong>« {q.aLabel} »</strong> sans améliorer <strong>« {q.bLabel} »</strong> a-t-il de la valeur en soi ?
                  </span>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                    {ans?.origin === "aura" && <span style={{ fontSize: 12, color: "#8b5cf6", fontWeight: 700 }}>✦</span>}
                    {(["oui", "non"] as const).map(v => (
                      <button key={v} onClick={() => answerMu(q.key, v)}
                        title={ans?.origin === "aura" && ans.val === v ? "Hypothèse Aura — cliquez pour confirmer, ou choisissez l'autre réponse" : undefined}
                        style={{ fontSize: 12, fontWeight: 700, padding: "3px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                          border: ans?.val === v ? (ans.origin === "aura" ? "1.5px dashed #8b5cf6" : "1.5px solid #0284c7") : "1.5px solid var(--v4-border)",
                          background: ans?.val === v ? (ans.origin === "aura" ? "#8b5cf615" : "#0284c7") : "transparent",
                          color: ans?.val === v ? (ans.origin === "aura" ? "#8b5cf6" : "#fff") : "var(--v4-text3)" }}>
                        {v === "oui" ? "Oui, indépendants" : "Non, ensemble seulement"}
                      </button>
                    ))}
                  </div>
                  {ans?.val === "non" && (
                    <span style={{ fontSize: 12, color: ans.origin === "aura" ? "#8b5cf6" : "#0369a1", flexBasis: "100%" }}>
                      → Synergie {ans.origin === "aura" ? "supposée par Aura (hypothèse à confirmer)" : "enregistrée"} : une coalition qui améliore l'un sans l'autre est jugée de faible valeur.
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
        {shown.map((cl, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, flexWrap: "wrap",
            background: cl.verdict === "atteignable" ? "#0ea5e90d" : "var(--v4-bg)",
            border: `1px solid ${cl.verdict === "atteignable" ? "#0ea5e950" : "var(--v4-border)"}` }}>
            <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 6, flexShrink: 0,
              background: cl.verdict === "atteignable" ? "#0284c7" : cl.verdict === "hors-de-portee" ? "#dc2626" : "var(--v4-surface2)",
              color: cl.verdict === "atteignable" ? "#fff" : cl.verdict === "hors-de-portee" ? "#fff" : "var(--v4-text3)" }}>
              {cl.verdict === "atteignable" ? "✓" : cl.verdict === "hors-de-portee" ? "✕" : "–"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{names(cl.criteria)}</span>
            <span title={`${cl.verdict === "atteignable" ? "Ambitieux et atteignable" : cl.verdict === "hors-de-portee" ? "Hors de portée" : "Peu de valeur"} · apport ${ordLbl[cl.worth]} · capacité d'action ${ordLbl[cl.achievability]}`} style={{ fontSize: 12, color: "var(--v4-text3)", marginLeft: "auto" }}>ⓘ</span>
          </div>
        ))}
        {result.truncated && <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic" }}>Analyse restreinte aux coalitions de taille ≤ 4 (nombre de critères élevé).</div>}
      </div>
    </div>
  );
}

// ─── OKR : instantané figé + détection de dérive ────────────────────────────
// Principe : les OKR ne sont JAMAIS recalculés ni réécrits silencieusement.
// À la génération, on fige un instantané du modèle (critères de tête +
// hash des leviers). S'il diverge du modèle courant, on le signale (bandeau
// discret, sur Arbitrer ET Suivi) sans jamais imposer la mise à jour — la
// décision de régénérer, garder, ou ignorer reste entièrement à l'utilisateur.
interface OkrCriterionSnapshot { id: string; label: string; importance: string }
interface OkrMeta {
  scenarioId: string;
  scenarioLabel: string;
  validatedAt: string;
  criteriaSnapshot: OkrCriterionSnapshot[];
  leviersHash: string;
}
interface OkrDriftRow { kind: 'removed' | 'changed' | 'added'; id: string; label: string; detail: string }

function hashLeviers(leviersDef: AtelierLevierDef[]): string {
  const s = (leviersDef ?? []).map(l => `${l.id}:${l.label}:${(l.options ?? []).map(o => o.id + '|' + o.label).join(',')}`).sort().join(';');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h.toString(36);
}
function snapshotCriteria(criteria: AtelierCriterion[]): OkrCriterionSnapshot[] {
  return (criteria ?? []).map(c => ({ id: c.id, label: c.label, importance: c.importance }));
}
function loadOkrMeta(sessionId: string): OkrMeta | null {
  try { const raw = localStorage.getItem(`aura-okr-meta-${sessionId}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveOkrMeta(sessionId: string, meta: OkrMeta) {
  try { localStorage.setItem(`aura-okr-meta-${sessionId}`, JSON.stringify(meta)); } catch {}
}
function saveOkrDataToStorage(sessionId: string, data: unknown) {
  try { localStorage.setItem(`aura-okr-${sessionId}`, JSON.stringify(data)); } catch {}
}
function computeOkrDrift(criteria: AtelierCriterion[], leviersDef: AtelierLevierDef[], meta: OkrMeta | null): OkrDriftRow[] {
  if (!meta) return [];
  const current = criteria ?? [];
  const currentById = new Map(current.map(c => [c.id, c]));
  const snapById = new Map(meta.criteriaSnapshot.map(c => [c.id, c]));
  const rows: OkrDriftRow[] = [];
  for (const snap of meta.criteriaSnapshot) {
    const cur = currentById.get(snap.id);
    if (!cur) rows.push({ kind: 'removed', id: snap.id, label: snap.label, detail: "Ce critère a été supprimé du modèle." });
    else if (cur.label !== snap.label || cur.importance !== snap.importance)
      rows.push({ kind: 'changed', id: snap.id, label: cur.label, detail: cur.label !== snap.label ? `Libellé modifié (était « ${snap.label} »).` : `Importance modifiée (était ${snap.importance}, est ${cur.importance}).` });
  }
  for (const cur of current) {
    if (!snapById.has(cur.id)) rows.push({ kind: 'added', id: cur.id, label: cur.label, detail: "Nouveau critère non couvert par les OKR actuels." });
  }
  if (hashLeviers(leviersDef) !== meta.leviersHash) {
    rows.push({ kind: 'changed', id: '__leviers__', label: "Leviers d'action", detail: "Les leviers ou leurs options ont changé depuis la génération des OKR." });
  }
  return rows;
}

// Un seul badge qualitatif global, résumant la dérive — le détail (par
// critère) reste disponible mais uniquement au clic, jamais déplié d'office.
// "aligné" = rien à signaler, "à surveiller" = un seul décalage mineur,
// "dérive" = un critère disparu ou plusieurs décalages.
export type OkrDriftLevel = 'aligne' | 'a_surveiller' | 'derive';
export function summarizeOkrDriftLevel(drift: OkrDriftRow[]): OkrDriftLevel {
  if (drift.length === 0) return 'aligne';
  if (drift.some(r => r.kind === 'removed') || drift.length >= 3) return 'derive';
  return 'a_surveiller';
}
const OKR_DRIFT_LEVEL_LABEL: Record<OkrDriftLevel, string> = { aligne: "Aligné", a_surveiller: "À surveiller", derive: "Dérive" };
const OKR_DRIFT_LEVEL_COLOR: Record<OkrDriftLevel, string> = { aligne: "#059669", a_surveiller: "#b45309", derive: "#dc2626" };

// ── Bandeau de dérive OKR — réutilisé sur Arbitrer et sur Suivi ─────────────
function OkrDriftBanner({ meta, drift }: { meta: OkrMeta; drift: OkrDriftRow[] }) {
  const [dismissed, setDismissed] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  if (dismissed || drift.length === 0) return null;
  const pending = drift.filter(r => !acknowledged.has(r.id));
  if (pending.length === 0) return null;
  const dateStr = new Date(meta.validatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  const KIND_LABEL: Record<OkrDriftRow['kind'], string> = { removed: "Critère disparu", changed: "Modifié", added: "Nouveau critère" };
  const KIND_COLOR: Record<OkrDriftRow['kind'], string> = { removed: "#dc2626", changed: "#b45309", added: "#059669" };
  const level = summarizeOkrDriftLevel(pending);
  return (
    <div style={{ borderRadius: 8, border: "1px solid #f59e0b50", background: "#f59e0b0a", overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <span data-testid="okr-drift-badge" style={{ fontSize: 12.5, fontWeight: 800, padding: "3px 10px", borderRadius: 999, background: `${OKR_DRIFT_LEVEL_COLOR[level]}18`, color: OKR_DRIFT_LEVEL_COLOR[level], flexShrink: 0 }}>
          {OKR_DRIFT_LEVEL_LABEL[level]}
        </span>
        <span style={{ fontSize: 13, color: "var(--v4-text2)", flex: 1, minWidth: 200 }}>
          Depuis la validation des OKR (le {dateStr}).
        </span>
        <button onClick={() => setShowDetail(v => !v)}
          style={{ fontSize: 13, fontWeight: 700, color: "#b45309", background: "none", border: "1px solid #f59e0b60", borderRadius: 8, padding: "4px 10px", cursor: "pointer", fontFamily: "inherit" }}>
          {showDetail ? "▲ Masquer le détail" : "Voir le détail →"}
        </button>
        <button onClick={() => setDismissed(true)}
          style={{ fontSize: 13, color: "var(--v4-text3)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
          Plus tard
        </button>
      </div>
      {showDetail && (
        <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {pending.map(row => (
            <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: "var(--v4-surface)", border: "1px solid var(--v4-border)" }}>
              <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 7px", borderRadius: 8, background: `${KIND_COLOR[row.kind]}15`, color: KIND_COLOR[row.kind], flexShrink: 0 }}>{KIND_LABEL[row.kind]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{row.label}</div>
                <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{row.detail}</div>
              </div>
              <button onClick={() => setAcknowledged(s => new Set(s).add(row.id))}
                style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text2)", background: "var(--v4-bg)", border: "1px solid var(--v4-border)", borderRadius: 6, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                Garder l'ancien
              </button>
            </div>
          ))}
          <div style={{ fontSize: 12, color: "var(--v4-text3)", fontStyle: "italic", marginTop: 2 }}>
            « Garder l'ancien » masque ce décalage précis. Pour régénérer les OKR avec le modèle actuel, utilisez « ✦ Régénérer les OKR » dans l'onglet OKR d'Arbitrer.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vue Executive : résumé lisible pour un comité, dérivé sans aucun nouveau
// calcul des mêmes données que la Expert (recommandation, scénarios,
// goal-seek). Ne réévalue jamais le modèle Lo — se contente de mettre en
// forme ce qui a déjà été calculé par les mêmes fonctions du moteur.
const EXEC_ORD_LABEL = ["Aucune", "Faible", "Modérée", "Élevée"];
// Pilules qualitatives compactes (mockups « Comparaison qualitative ») — même
// vocabulaire Aucune/Faible/Modérée/Élevée, jamais de nombre brut affiché.
// Palette de teintes « on/off » pour les barres exécutives (Forward/Backward) —
// pas de token shadcn assez proche du mint/rose de la maquette de référence,
// donc littéraux centralisés ici plutôt que dispersés dans le JSX.
const EXEC_TINT = {
  mintOn: "#0fb889", mintOff: "#e3e8f5",
  roseOn: "#ff4f6d", roseOff: "#e8eaf4",
  violetSoft: "#f1efff", violetText: "#5938ff",
  crownSoft: "#f1efff", crownText: "#5534ff",
  okSoft: "#13b985", warnSoft: "#fff6d8", warnText: "#d29a21",
} as const;

// Avatar circulaire « lettre » (Scénario A/B/C…) — remplace le libellé texte nu
// par le rond violet clair + lettre de la maquette de référence.
function ExecAvatar({ letter, small = false }: { letter: string; small?: boolean }) {
  const size = small ? 30 : 38;
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        background: EXEC_TINT.violetSoft, color: EXEC_TINT.violetText,
        fontWeight: 800, fontSize: small ? 13 : 14,
      }}
    >
      {letter}
    </span>
  );
}

// Icône de verdict circulaire (25px) — remplace les glyphes texte par le rond
// coloré de la maquette : coche = admissible/meilleur, couronne = recommandé,
// avertissement = non admissible / point de vigilance. Purement présentationnel :
// la donnée réelle (admissible / isReco / verdict) est décidée par l'appelant.
function ExecVerdictIcon({ kind }: { kind: "ok" | "crown" | "warning" }) {
  const style =
    kind === "ok" ? { background: EXEC_TINT.okSoft, color: "#fff" }
    : kind === "crown" ? { background: EXEC_TINT.crownSoft, color: EXEC_TINT.crownText }
    : { background: EXEC_TINT.warnSoft, color: EXEC_TINT.warnText };
  return (
    <span
      aria-hidden
      style={{
        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, ...style,
      }}
    >
      {kind === "ok" ? <Check className="h-3 w-3" /> : kind === "crown" ? <Crown className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
    </span>
  );
}

// Rangée de barres arrondies (mini-scale / long-scale de la maquette) pour
// représenter un niveau ordinal 0-3 — remplace OrdGlyph dans la Vue Executive
// uniquement (OrdGlyph reste utilisé ailleurs, non touché ici). Même donnée
// (v: OrdinalLevel 0-3), rendu différent.
function ExecBarScale({ v, tone = "mint", long = false }: { v: OrdinalLevel; tone?: "mint" | "rose"; long?: boolean }) {
  const on = tone === "mint" ? EXEC_TINT.mintOn : EXEC_TINT.roseOn;
  const off = tone === "mint" ? EXEC_TINT.mintOff : EXEC_TINT.roseOff;
  const barStyle = long
    ? { width: 18, height: 7, borderRadius: 6 }
    : { width: 8, height: 13, borderRadius: 6 };
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }} aria-label={EXEC_ORD_LABEL[v]}>
      {[0, 1, 2, 3].map(i => (
        <i key={i} style={{ ...barStyle, background: i < v ? on : off, display: "block" }} />
      ))}
    </span>
  );
}

function ExecPill({ v, kind }: { v: OrdinalLevel; kind: "gain" | "risque" }) {
  const color = kind === "gain"
    ? (v >= 2 ? "#059669" : v === 1 ? "#10b981" : "#9ca3af")
    : (v === 0 ? "#059669" : v === 1 ? "#f59e0b" : "#dc2626");
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "1px 7px", borderRadius: 999, background: `${color}14`, border: `1px solid ${color}40`, color, fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" }}>
      <OrdGlyph v={v} color={color} size={9} />{EXEC_ORD_LABEL[v]}
    </span>
  );
}
function ExecutiveView({
  session, best, retained, isOverridden, promising, nodeResults, okrMeta,
  goalTargets, goalTargetable, goalEvals, goalTolerate,
  levelCells, setGoalTarget, setGoalTolerate, onOpenExpertTab, onRetainScenario,
}: {
  session: AtelierSession;
  best: AtelierScenario | null;
  retained?: AtelierScenario | null; // option retenue (choix manuel), sinon = best
  isOverridden?: boolean;
  promising: AtelierScenario[];
  nodeResults: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }>;
  okrMeta: OkrMeta | null;
  goalTargets: Record<string, number> | null;
  goalTargetable: AtelierCriterion[];
  goalEvals: GoalComboEval[];
  goalTolerate: boolean;
  /** levelCells[scenarioId][nodeId] — même remontée MOE/MOP/TPM que Vue globale, calculée une seule fois par computeLoResults. */
  levelCells: Record<string, Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }>>;
  setGoalTarget?: (critId: string, level: number) => void;
  setGoalTolerate?: (v: boolean) => void;
  onOpenExpertTab?: (tab: "scenarios" | "objectif") => void;
  /** Bascule l'option retenue (même mécanisme que le bouton "Retenir comme option" de la Carte). */
  onRetainScenario?: (id: string | null) => void;
}) {
  // La vue Executive suit l'option retenue par l'utilisateur quand elle diffère
  // de la recommandation Aura — même convention que la Carte / OKR (cardScenario).
  // On garde une trace de la recommandation algorithmique brute (avant override)
  // pour pouvoir la comparer au choix réellement affiché ci-dessous.
  const algoBest = best;
  best = retained ?? best;
  const bestNr = best ? (nodeResults[best.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }) : null;
  const RISK_COLOR = (d: OrdinalLevel) => (d === 0 ? "#059669" : d === 1 ? "#f59e0b" : "#dc2626");
  const GAIN_COLOR = (g: OrdinalLevel) => (g >= 2 ? "#059669" : g === 1 ? "#10b981" : "#9ca3af");

  // Backward goal-seek : cible → blocages → changements minimaux → vérification.
  // Même appel goalSeek que l'onglet « Partir de l'objectif » — pas de recalcul parallèle.
  const activeTargets = goalTargetable
    .filter(m => (goalTargets?.[m.id] ?? -1) > 0)
    .map(m => ({ critId: m.id, min: (goalTargets![m.id] as OrdinalLevel) }));
  const hasGoal = activeTargets.length > 0;
  const execObjectivesAll: ObjectiveRef[] = goalTargetable.map(m => ({ id: m.id, label: m.label, importance: m.importance }));
  const gsRaw = hasGoal ? goalSeek(goalEvals, activeTargets, { tolerateRisk: goalTolerate ? 1 : 0 }) : null;
  // Étape 1 — même vérification Forward globale que l'onglet Expert (pas de
  // recalcul, juste un filtre additif sur reaching).
  const gs = gsRaw ? { ...gsRaw, reaching: filterGloballyVerified(gsRaw.reaching, execObjectivesAll) } : null;
  const moeLabel = (id: string) => goalTargetable.find(m => m.id === id)?.label ?? id;

  // Étape 4 — réduction à 3-5 chemins exécutifs distincts (déduplication par
  // set de leviers changés, pas juste par libellé). Réutilise les réparations
  // minimales de l'étape 3 quand la cible n'est pas atteignable ; sinon,
  // déduplique les combinaisons déjà atteignantes (étape 1) par set de
  // leviers qui s'écartent de la référence — c'est le fallback "aujourd'hui".
  const execOptionIndex: Record<string, AtelierOptionDef> = {};
  for (const lev of session.leviersDef) for (const opt of lev.options) execOptionIndex[opt.id] = opt;
  const execBaseCombo: Record<string, string> = Object.fromEntries(session.leviersDef.map(l => [l.id, l.options[0]?.id ?? ""]));
  const execAttCode: Attitude = session.attitude === "Pessimiste" ? 1 : 2;
  const execProf: "prudent" | "optimiste" = session.attitude === "Pessimiste" ? "prudent" : "optimiste";
  let execMode: "minimal-repair" | "reaching-fallback" | "none" = "none";
  let execRepairs: ReturnType<typeof findMinimalRepairs> = [];
  // Obstacles réels (étape 2 : goulot précis + leviers responsables) — utilisés
  // par le fallback « cible non entièrement atteignable » de la vue Executive.
  const execBlockers: LeverCulprit[] = [];
  const execBlockedTargets: { critId: string; leafLabel: string }[] = [];
  if (hasGoal && gs) {
    if (gs.reaching.length === 0 && session.leviersDef.length > 0) {
      const unmet = activeTargets.filter(t => {
        const p = goalEvals[0]?.perCrit[t.critId];
        return !p || p.gPlus < t.min || p.dMinus > (goalTolerate ? 1 : 0);
      });
      const candidateLeverIds = new Set<string>();
      for (const t of unmet) {
        const topNode = goalTargetable.find(m => m.id === t.critId);
        if (!topNode) continue;
        const pseudoSc: AtelierScenario = { id: "_er", label: "", color: "", description: "", leviers: Object.entries(execBaseCombo).map(([lid, oid]) => ({ id: lid, label: lid, valeur: oid, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
        const trace = traceBlockingBranch(topNode, pseudoSc, execOptionIndex, execAttCode, execProf);
        execBlockedTargets.push({ critId: t.critId, leafLabel: trace.leafLabel });
        for (const c of culpritLevers(trace.leafId, session.leviersDef, execBaseCombo)) {
          candidateLeverIds.add(c.leverId);
          if (!execBlockers.some(b => b.leverId === c.leverId)) execBlockers.push(c);
        }
      }
      if (candidateLeverIds.size > 0) {
        const evaluate = (combo: Record<string, string>) => {
          const found = lookupCombo(goalEvals, combo);
          if (found) return found;
          return { perCrit: {}, global: { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel } };
        };
        execRepairs = findMinimalRepairs({
          baseCombo: execBaseCombo,
          candidateLeverIds: [...candidateLeverIds],
          leviersDef: session.leviersDef,
          evaluate,
          activeTargets,
          tolerateRisk: goalTolerate ? 1 : 0,
          allObjectives: execObjectivesAll,
        });
      }
      execMode = execRepairs.length > 0 ? "minimal-repair" : "none";
    } else if (gs.reaching.length > 0) {
      execMode = "reaching-fallback";
      execRepairs = gs.reaching.slice(0, 20).map(c => ({
        key: c.key,
        combo: c.combo,
        changes: Object.entries(c.combo)
          .filter(([lid, oid]) => oid !== execBaseCombo[lid])
          .map(([lid, oid]) => {
            const lev = session.leviersDef.find(l => l.id === lid);
            return {
              leverId: lid,
              leverLabel: lev?.label ?? lid,
              fromOptionLabel: lev?.options.find(o => o.id === execBaseCombo[lid])?.label ?? "",
              toOptionId: oid,
              toOptionLabel: lev?.options.find(o => o.id === oid)?.label ?? oid,
            };
          }),
      }));
    }
  }
  const execDistinctPaths = distinctExecutivePaths(execRepairs, 5);

  // Top 3 leviers du scénario recommandé (ordre de la définition — pas de tri
  // qui introduirait un jugement non porté par le moteur).
  const top3Leviers = (best?.leviers ?? []).slice(0, 3);

  // ── Sous-onglet Forward / Backward — bascule locale à la Vue Executive.
  // Par défaut : Backward si une cible est déjà posée (l'utilisateur explore
  // déjà « depuis l'objectif »), sinon Forward (comparaison des scénarios).
  const [execTab, setExecTab] = useState<"forward" | "backward">(hasGoal ? "backward" : "forward");

  // ── Décomposition par critère (MOE + MOP réels) pour CHAQUE scénario — même
  // liste de nœuds que goalTargetable (aucun nœud inventé), lue dans levelCells
  // (déjà calculé par computeLoResults, jamais recalculé ici).
  function scenarioBreakdown(sc: AtelierScenario) {
    const flat = goalTargetable.map(n => ({
      id: n.id, label: n.label,
      r: levelCells[sc.id]?.[n.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel },
    }));
    const improving = flat.filter(n => n.r.gPlus >= 2).sort((a, b) => b.r.gPlus - a.r.gPlus).slice(0, 3);
    const degrading = flat.filter(n => n.r.dMinus >= 1).sort((a, b) => b.r.dMinus - a.r.dMinus).slice(0, 3);
    const shown = new Set([...improving, ...degrading].map(n => n.id));
    const rest = flat.filter(n => !shown.has(n.id)).slice(0, 4);
    const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
    for (const n of flat) perCrit[n.id] = n.r;
    const veto = globalVetoBreaches(perCrit, execObjectivesAll);
    return { improving, degrading, rest, admissible: veto.length === 0, veto };
  }
  const bestBreakdown = best ? scenarioBreakdown(best) : null;

  // ── Comparaison choix actuel vs recommandation Aura brute — même comparaison
  // lexicographique bipolaire (loCompare, thèse Lo §IV) que celle qui a produit
  // `promising`/`best` plus haut ; aucune règle de comparaison nouvelle inventée ici.
  const algoBestNr = algoBest ? (nodeResults[algoBest.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }) : null;
  const algoBestBreakdown = algoBest ? scenarioBreakdown(algoBest) : null;
  const recoDiffersFromChosen = !!algoBest && !!best && algoBest.id !== best.id;
  const recoIsGenuinelyBetter = recoDiffersFromChosen && !!algoBestNr && !!bestNr
    && !!algoBestBreakdown?.admissible
    && loCompare(algoBestNr, bestNr) > 0;
  // Critères qui distinguent la recommandation du choix actuel — mêmes nœuds
  // MOE/MOP que scenarioBreakdown, lus dans levelCells (aucun recalcul).
  const decisiveCriteria = (algoBest && best) ? goalTargetable
    .map(n => ({
      id: n.id, label: n.label,
      a: levelCells[algoBest.id]?.[n.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel },
      b: levelCells[best.id]?.[n.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel },
    }))
    .filter(n => n.a.gPlus !== n.b.gPlus || n.a.dMinus !== n.b.dMinus)
    .sort((x, y) => loCompare(x.a, x.b) === loCompare(y.a, y.b) ? 0 : (loCompare(x.a, x.b) > loCompare(y.a, y.b) ? -1 : 1))
    : [];
  const recoReason = (() => {
    if (!recoIsGenuinelyBetter || !algoBestNr || !bestNr) return "";
    if (algoBestNr.gPlus !== bestNr.gPlus) return `un potentiel d'amélioration supérieur (${EXEC_ORD_LABEL[algoBestNr.gPlus]} contre ${EXEC_ORD_LABEL[bestNr.gPlus]})`;
    return `un risque de dégradation moindre (${EXEC_ORD_LABEL[algoBestNr.dMinus]} contre ${EXEC_ORD_LABEL[bestNr.dMinus]})`;
  })();

  // ── Verdict par scénario — comparaison purement relative au scénario
  // recommandé (best), jamais de libellé inventé hors des 4 issues Lo.
  function scenarioVerdict(sc: AtelierScenario, admissible: boolean): { label: string; color: string } {
    if (!admissible) return { label: "Non admissible", color: "#dc2626" };
    const nr = nodeResults[sc.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
    if (sc.id === algoBest?.id) return { label: "Recommandé par Aura", color: "#059669" };
    if (retained && sc.id === retained.id) return { label: "Option retenue", color: "#0369a1" };
    if (algoBestNr && nr.dMinus > algoBestNr.dMinus) return { label: "Plus risqué", color: "#dc2626" };
    if (algoBestNr && nr.gPlus < algoBestNr.gPlus) return { label: "Gain moindre", color: "#f59e0b" };
    return { label: "Bon équilibre", color: "#0369a1" };
  }

  // ── Projection perCrit d'une combinaison de leviers (Backward) — réutilise
  // aggregateHierarchy/aggregateNode déjà importés, jamais de recalcul du
  // moteur protégé (mêmes fonctions que computeLoResults / l'onglet Objectif).
  function projectCombo(combo: Record<string, string>) {
    const pseudoSc: AtelierScenario = { id: "_proj", label: "", color: "", description: "", leviers: Object.entries(combo).map(([lid, oid]) => ({ id: lid, label: lid, valeur: oid, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
    const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
    const stage1 = session.criteria.map(c => { const r = aggregateHierarchy(c, pseudoSc, execOptionIndex, execAttCode, execProf); perCrit[c.id] = r; return r; });
    for (const mop of goalTargetable) if (!(mop.id in perCrit)) perCrit[mop.id] = aggregateHierarchy(mop, pseudoSc, execOptionIndex, execAttCode, execProf);
    const weights = session.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const normW: OrdinalLevel[] = thesisWeights(weights);
    let global: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
    try { global = aggregateNode(stage1, normW.length ? normW : [3]); } catch { global = { gPlus: 0, dMinus: 0 }; }
    return { perCrit, global };
  }
  const bestPath = execDistinctPaths[0] ?? null;
  const bestPathReached = execMode !== "none" && !!bestPath;
  const bestPathProjection = bestPathReached && bestPath ? projectCombo(bestPath.combo) : null;
  // Niveau réellement atteignable par cible, au sein du champ des possibles déjà
  // évalué (goalEvals) — jamais un chiffre inventé pour le fallback « non atteignable ».
  const achievableByTarget = activeTargets.map(t => ({
    ...t,
    achieved: goalEvals.length ? Math.max(0, ...goalEvals.map(c => c.perCrit[t.critId]?.gPlus ?? 0)) as OrdinalLevel : (0 as OrdinalLevel),
  }));

  return (
    <div className="flex w-full min-w-0 flex-col gap-5 bg-background p-3 text-foreground sm:p-5" data-testid="executive-view">
      {!best ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Aucune recommandation disponible pour le moment — ajoutez au moins deux scénarios dans Composer.
        </div>
      ) : (
        <>
          <div className="flex flex-col justify-between gap-3 pb-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="font-sans text-xl font-semibold sm:text-2xl">Arbitrer</h2>
              <p className="mt-1 text-sm text-muted-foreground">Comparer, viser, décider.</p>
            </div>
            <div className="inline-flex w-fit rounded-full bg-[#f0edff] p-1">
              <Button variant={execTab === "forward" ? "default" : "ghost"} size="sm" onClick={() => setExecTab("forward")} data-testid="exec-tab-forward">
                Comparer
              </Button>
              <Button variant={execTab === "backward" ? "default" : "ghost"} size="sm" onClick={() => setExecTab("backward")} data-testid="exec-tab-backward">
                <Target className="mr-1 h-3.5 w-3.5" /> Atteindre une cible
              </Button>
            </div>
          </div>

          {execTab === "forward" ? (
            <div className="exec-view mx-auto w-full max-w-[1240px] text-[#10145d]">
              <section className="mt-3 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid min-w-0 gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,280px),1fr))" }}>
                  {session.scenarios.map((s, idx) => {
                    const bd = scenarioBreakdown(s);
                    const nr = nodeResults[s.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
                    const isReco = s.id === algoBest?.id;
                    const isChosen = retained ? s.id === retained.id : isReco;
                    return (
                      <article
                        key={s.id}
                        className={`flex min-w-0 flex-col rounded-2xl border border-transparent bg-white p-3 shadow-[0_12px_32px_rgba(53,55,125,0.055)] ${
                          isChosen ? "ring-2 ring-[#d9d1ff]" : ""
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <ExecAvatar letter={String.fromCharCode(65 + idx)} small />
                          <div className="min-w-0 flex-1">
                            <h3 className="break-words text-sm font-bold text-[#151867]">{s.label}</h3>
                            <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[#7278ad]">{s.description || "Option évaluée"}</p>
                          </div>
                          {isReco && <ExecVerdictIcon kind="crown" />}
                        </div>

                        <section className="relative mt-3 rounded-xl border border-[#eef0f7] p-3">
                          <div className="flex items-center gap-2 text-xs font-semibold text-[#1e226f]">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#eafaf5] text-[#0aac7d]">◒</span>
                            Résultat global
                          </div>
                          <div className="mt-2"><ExecBarScale v={nr.gPlus} tone="mint" long /></div>
                          <span className="mt-2 inline-flex rounded-lg bg-[#fff5d6] px-2 py-1 text-[12.5px] font-semibold text-[#a96f10]">{EXEC_ORD_LABEL[nr.gPlus]}</span>
                        </section>

                        <section className="mt-2 rounded-xl bg-[#effcf7] p-3">
                          <h4 className="flex items-center gap-2 text-[13px] font-bold text-[#2b2b2b]">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#d9f7ea] font-bold text-[#04a873]">↑</span>
                            Ce que ça améliore
                          </h4>
                          {bd.improving.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {bd.improving.map(n => (
                                <li key={n.id} className="flex items-start gap-2 text-[12.5px] leading-4 text-[#7278a9]">
                                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#ddf8ee] text-[12px] text-[#0bad79]">✓</span>
                                  <span className="min-w-0 flex-1 break-words">{n.label}</span>
                                  <b className="shrink-0 text-[#078967]">{EXEC_ORD_LABEL[n.r.gPlus]}</b>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="mt-2 text-[12.5px] text-[#8990bd]">Aucune amélioration notable.</p>}
                        </section>

                        <section className="mt-2 rounded-xl bg-[#fff1f3] p-3">
                          <h4 className="flex items-center gap-2 text-[13px] font-bold text-[#bd2747]">
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#ffe0e5] font-bold text-[#e63755]">↓</span>
                            Ce que ça dégrade
                          </h4>
                          {bd.degrading.length > 0 ? (
                            <ul className="mt-2 space-y-1.5">
                              {bd.degrading.map(n => (
                                <li key={n.id} className="flex items-start gap-2 text-[12.5px] leading-4 text-[#7278a9]">
                                  <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[#ffe2e7] text-[12px] text-[#e74159]">!</span>
                                  <span className="min-w-0 flex-1 break-words">{n.label}</span>
                                  <b className="shrink-0 text-[#c33f58]">{EXEC_ORD_LABEL[n.r.dMinus]}</b>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="mt-2 text-[12.5px] text-[#8990bd]">Aucune dégradation notable.</p>}
                        </section>

                        {bd.rest.length > 0 && (
                          <section className="mt-2 rounded-xl border border-[#eef0f7] p-3">
                            <h4 className="text-[12.5px] font-bold text-[#1e226f]">Autres dimensions</h4>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {bd.rest.map(n => (
                                <span key={n.id} className="rounded-lg bg-[#f6f5ff] px-2 py-1 text-[12px] text-[#596093]">{n.label}</span>
                              ))}
                            </div>
                          </section>
                        )}

                        <button
                          type="button"
                          onClick={() => onRetainScenario?.(s.id === retained?.id ? null : s.id)}
                          className={`mt-auto flex min-h-10 w-full items-center gap-2 rounded-xl px-3 pt-2 text-left text-[13px] font-bold ${
                            bd.admissible ? "bg-[#eaf9f3] text-[#0a735c]" : "bg-[#fff7df] text-[#a96f10]"
                          }`}
                        >
                          <ExecVerdictIcon kind={bd.admissible ? (isReco ? "crown" : "ok") : "warning"} />
                          {bd.admissible ? (isChosen ? "Option retenue" : "Admissible") : `Non admissible · ${bd.veto.length} veto`}
                          <span className="ml-auto text-lg font-normal">›</span>
                        </button>
                      </article>
                    );
                  })}
                </div>

                <aside className="h-fit rounded-2xl bg-white p-4 shadow-[0_14px_36px_rgba(53,55,125,0.07)]">
                  <h2 className="text-sm font-bold text-[#151867]">Notre recommandation</h2>
                  <div className="mt-3 rounded-xl bg-[#f3f0ff] p-3">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e8e2ff] text-[#5530ff]"><Crown className="h-4 w-4" /></span>
                      <div className="min-w-0">
                        <strong className="block break-words text-sm text-[#151867]">{algoBest?.label ?? best.label}</strong>
                        <span className="mt-0.5 block text-[12.5px] text-[#6b72a7]">Meilleur compromis identifié</span>
                      </div>
                    </div>
                  </div>
                  <p className="mx-0.5 mt-4 text-xs leading-5 text-[#59619b]">
                    {algoBest?.description || (algoBestBreakdown?.improving.length
                      ? `${algoBestBreakdown.improving.slice(0, 2).map(n => n.label).join(" et ")} progressent avec le compromis le plus favorable parmi les options évaluées.`
                      : "Cette option présente le profil qualitatif le plus favorable parmi les scénarios évalués.")}
                  </p>
                  <div className="my-4 border-t border-[#eef0f7]" />
                  <ul className="space-y-2.5">
                    {(algoBestBreakdown?.improving ?? []).slice(0, 2).map(n => (
                      <li key={n.id} className="flex items-center gap-2 text-[13px] text-[#59619b]">
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#5c36ff] text-[12px] text-white">✓</span>
                        {n.label} · {EXEC_ORD_LABEL[n.r.gPlus]}
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-[13px] text-[#59619b]">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#5c36ff] text-[12px] text-white">✓</span>
                      {algoBestBreakdown?.admissible ? "Exigences essentielles respectées" : "Vigilance requise avant décision"}
                    </li>
                  </ul>

                  {recoDiffersFromChosen && (
                    <div className="mt-4 rounded-xl bg-[#fff7df] p-3 text-[12.5px] leading-4 text-[#8d6518]">
                      Option actuellement retenue : <strong>{best.label}</strong>.
                      {recoIsGenuinelyBetter && algoBest && (
                        <Button size="sm" className="mt-2 w-full" onClick={() => onRetainScenario?.(algoBest.id)}>Retenir la recommandation</Button>
                      )}
                    </div>
                  )}

                  <Button className="mt-4 w-full bg-[#5c35ff] text-[13px] text-white hover:bg-[#4d2be8]" onClick={() => setExecTab("backward")}>
                    Explorer une meilleure trajectoire <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" className="mt-2 w-full border-[#6b4dff] text-[13px] text-[#5338e8]" onClick={() => onOpenExpertTab?.("scenarios")}>
                    Affiner les hypothèses
                  </Button>
                  <button type="button" onClick={() => setExecTab("backward")} className="mt-3 grid w-full grid-cols-[36px_1fr_28px] items-center gap-2 rounded-xl bg-gradient-to-br from-[#f2f0ff] to-[#fbfaff] p-3 text-left">
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#603bff]"><Sparkles className="h-4 w-4" /></span>
                    <span>
                      <strong className="block text-[12.5px] text-[#151867]">Et si on allait plus loin ?</strong>
                      <small className="mt-0.5 block text-[12px] leading-3 text-[#7278a7]">Explorez des variantes et identifiez le plus petit mouvement utile.</small>
                    </span>
                    <span className="grid h-7 w-7 place-items-center rounded-full bg-white text-[#5b37ff]">→</span>
                  </button>
                </aside>
              </section>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-[1180px] space-y-8 py-2">
              <section>
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f0edff] text-[#5938ff]"><Target className="h-5 w-5" /></span>
                  <div>
                    <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a5cff]">1 · Fixer l’ambition</p>
                    <h3 className="mt-1 text-xl font-bold text-[#10145d]"><Q keywords={["résultat", "atteindre"]}>Quel résultat voulez-vous atteindre ?</Q></h3>
                    <p className="mt-1 text-xs text-[#6870b2]">Choisissez uniquement les dimensions qui comptent pour cette cible.</p>
                  </div>
                </div>
                <div className="mt-5 divide-y divide-[#eceefa]">
                  {session.criteria.map(m => (
                    <div key={m.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-sm font-semibold text-[#1d226a]">{m.label}</span>
                      <div className="flex flex-wrap gap-1.5">{[-1,1,2,3].map(lvl => (
                        <Button
                          key={lvl}
                          variant="ghost"
                          size="sm"
                          className={`rounded-full px-3 text-[13px] ${(goalTargets?.[m.id] ?? -1) === lvl ? "bg-[#5c35ff] text-white hover:bg-[#5c35ff] hover:text-white" : "bg-[#f6f5ff] text-[#6870b2]"}`}
                          onClick={() => setGoalTarget?.(m.id, lvl)}
                          disabled={!setGoalTarget}
                        >
                          {lvl === -1 ? "Non ciblé" : EXEC_ORD_LABEL[lvl]}
                        </Button>
                      ))}</div>
                    </div>
                  ))}
                </div>
                <label className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#fff7df] px-3 py-2 text-[13px] font-medium text-[#8d6518]">
                  <input type="checkbox" checked={goalTolerate} disabled={!setGoalTolerate} onChange={e => setGoalTolerate?.(e.target.checked)} />
                  Autoriser une dégradation faible
                </label>
              </section>

              {!hasGoal ? (
                <section className="py-12 text-center">
                  <p className="text-sm font-semibold text-[#353b85]">Choisissez au moins une ambition pour lancer le raisonnement Backward.</p>
                  <p className="mt-1 text-xs text-[#8990bd]">Aura n’explorera que les branches qui bloquent réellement cette cible.</p>
                </section>
              ) : bestPathReached && bestPath && bestPathProjection ? (
                <>
                  <section className="rounded-3xl bg-gradient-to-br from-[#5a35ff] to-[#765cff] p-6 text-white shadow-[0_18px_42px_rgba(90,53,255,0.22)] sm:p-8">
                    <p className="text-[12.5px] font-extrabold uppercase tracking-[0.14em] text-white/70">2 · Trajectoire trouvée</p>
                    <div className="mt-2 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">Le plus petit mouvement utile</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-white/75">Aura a remonté les blocages, identifié les leviers modifiables puis vérifié cette configuration par le Forward global.</p>
                      </div>
                      <div className="flex gap-3">
                        <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold">Amélioration · {EXEC_ORD_LABEL[bestPathProjection.global.gPlus]}</span>
                        <span className="rounded-full bg-white/15 px-3 py-2 text-xs font-bold">Dégradation · {EXEC_ORD_LABEL[bestPathProjection.global.dMinus]}</span>
                      </div>
                    </div>
                  </section>

                  <section className="grid gap-0 md:grid-cols-3 md:divide-x md:divide-[#e6e8f5]">
                    <div className="py-4 md:pr-6">
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a5cff]">Cible</p>
                      <div className="mt-3 space-y-2">
                        {activeTargets.map(t => <p key={t.critId} className="text-xs text-[#59619b]"><strong className="text-[#151867]">{moeLabel(t.critId)}</strong> · {EXEC_ORD_LABEL[t.min]}</p>)}
                      </div>
                    </div>
                    <div className="py-4 md:px-6">
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a5cff]">Mouvement minimal</p>
                      <div className="mt-3 space-y-2">
                        {bestPath.changes.length > 0 ? bestPath.changes.map((chg, i) => (
                          <div key={chg.leverId} className="flex gap-2 text-xs text-[#59619b]"><span className="font-bold text-[#5a35ff]">{i + 1}</span><span>{chg.leverLabel} → <strong className="text-[#151867]">{chg.toOptionLabel}</strong></span></div>
                        )) : <p className="text-xs text-[#59619b]">La configuration actuelle atteint déjà la cible.</p>}
                      </div>
                    </div>
                    <div className="py-4 md:pl-6">
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#0a8f6a]">Vérification Forward</p>
                      <div className="mt-3 flex items-start gap-2 text-xs leading-5 text-[#3f477f]">
                        <ExecVerdictIcon kind="ok" />
                        <span>La trajectoire respecte l’ensemble des objectifs essentiels.</span>
                      </div>
                    </div>
                  </section>

                  {(gs?.bottlenecks ?? []).length > 0 && (
                    <section className="bg-[#fff9e9] px-5 py-4">
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#a96f10]">Ce qui limite encore</p>
                      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
                        {gs!.bottlenecks.slice(0, 3).map(b => <p key={b.critId} className="text-xs text-[#8d6518]"><strong>{moeLabel(b.critId)}</strong> · {b.blocked} voie{b.blocked > 1 ? "s" : ""} écartée{b.blocked > 1 ? "s" : ""}</p>)}
                      </div>
                    </section>
                  )}

                  <section>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#7a5cff]">3 · Comparer</p>
                        <h3 className="mt-1 text-lg font-bold text-[#10145d]"><Q keywords={["scénarios", "se situent"]}>Comment les scénarios actuels se situent-ils ?</Q></h3>
                      </div>
                      <Button variant="ghost" size="sm" className="text-[#5938ff]" onClick={() => onOpenExpertTab?.("objectif")}>Voir le diagnostic expert</Button>
                    </div>
                    <div className="mt-4 divide-y divide-[#eceefa]">
                      {session.scenarios.map((s, idx) => {
                        const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
                        for (const t of activeTargets) perCrit[t.critId] = levelCells[s.id]?.[t.critId] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
                        const met = activeTargets.filter(t => perCrit[t.critId].gPlus >= t.min && perCrit[t.critId].dMinus <= (goalTolerate ? 1 : 0));
                        const tag = met.length === activeTargets.length ? { label: "Atteint la cible", cls: "bg-[#eafbf5] text-[#078967]" } : met.length >= activeTargets.length - 1 && activeTargets.some(t => perCrit[t.critId].gPlus === t.min - 1) ? { label: "Presque", cls: "bg-[#fff7df] text-[#a96f10]" } : { label: "Insuffisant", cls: "bg-[#f3f4fa] text-[#7379a7]" };
                        return <div key={s.id} className="flex items-center gap-3 py-3"><ExecAvatar letter={String.fromCharCode(65 + idx)} small /><span className="min-w-0 flex-1 text-sm font-semibold text-[#151867]">{s.label}</span><span className={`rounded-full px-3 py-1 text-[12.5px] font-bold ${tag.cls}`}>{tag.label}</span></div>;
                      })}
                    </div>
                  </section>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => onOpenExpertTab?.("objectif")}>Modifier la cible en détail</Button>
                    <Button size="sm" onClick={() => setExecTab("forward")}>Comparer les options</Button>
                  </div>
                </>
              ) : (
                <section className="py-6">
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#fff7df] text-[#d29a21]"><AlertTriangle className="h-5 w-5" /></span>
                    <div>
                      <p className="text-[12.5px] font-extrabold uppercase tracking-[0.12em] text-[#a96f10]">Diagnostic Backward</p>
                      <h3 className="mt-1 text-xl font-bold text-[#10145d]">La cible dépasse le champ des options actuelles</h3>
                      <p className="mt-2 text-xs leading-5 text-[#6870b2]">Aura ne force pas une solution artificielle : elle montre le meilleur niveau atteignable et les blocages à lever.</p>
                    </div>
                  </div>
                  <div className="mt-6 grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold text-[#151867]">Meilleur niveau atteignable</p>
                      <div className="mt-2 divide-y divide-[#eceefa]">{achievableByTarget.map(t => <p key={t.critId} className="py-2 text-sm text-[#59619b]"><strong>{moeLabel(t.critId)}</strong> · {EXEC_ORD_LABEL[t.achieved]}</p>)}</div>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#151867]">Blocages exacts</p>
                      <p className="mt-2 text-sm leading-6 text-[#59619b]">{execBlockedTargets.length > 0 ? execBlockedTargets.map(b => b.leafLabel).join(", ") : "Aucun levier du modèle ne couvre la cible."}</p>
                    </div>
                  </div>
                  <Button className="mt-6" size="sm" onClick={() => onOpenExpertTab?.("objectif")}>Explorer les leviers à débloquer <ArrowRight /></Button>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Ancien tableau de bord de Suivre (OKR, plan d'action, preuves) : conservé, onglet « Tableau de bord ».
function StepSuivi({ session, onUpdate, onBack }: { session: AtelierSession; onUpdate: (patch: Partial<AtelierSession>) => void; onBack: () => void }) {
  type KRActionS = { label: string; responsable: string; horizon: string; risque: string };
  type KRMesureS = { date: string; valeur: string; note?: string };
  type KRData = {
    tracking: Record<string, { valeur: string; statut: 'pending' | 'progress' | 'done'; moyen?: string }>;
    history: Record<string, KRMesureS[]>;
    actions: Record<string, KRActionS[]>;
  };

  // Dossier d'exigences (techniques) — réservé aux décisions qui produisent
  // réellement des exigences à instruire : architecture d'entreprise,
  // conception préliminaire, développement de nouveaux produits. Ailleurs
  // (stratégie, risques, décision opérationnelle...), le pilotage se fait
  // uniquement par les OKR — Aura n'ajoute pas de complexité de
  // transformation digitale/architecture qui n'a pas sa place dans ces
  // parcours.
  const [reqOpen, setReqOpen] = useState(false);
  const REQUIREMENTS_CASE_TYPES = ["nouveau_produit", "conception_complexe", "architecture"];
  const isProductPattern = REQUIREMENTS_CASE_TYPES.includes(session.caseType ?? "");

  // Suivre ne porte que sur l'analyse actuellement ouverte : pas de sélecteur
  // d'autres décisions ici (ce choix existe déjà dans la barre du haut / la
  // liste de gauche) — on ne réaffiche jamais la liste des décisions passées.
  const [krData, setKrData] = useState<KRData>(() => {
    try {
      return {
        tracking: JSON.parse(localStorage.getItem(`aura-kr-tracking-${session.id}`) ?? '{}'),
        history:  JSON.parse(localStorage.getItem(`aura-kr-history-${session.id}`) ?? '{}'),
        actions:  JSON.parse(localStorage.getItem(`aura-kr-actions-${session.id}`) ?? '{}'),
      };
    } catch { return { tracking: {}, history: {}, actions: {} }; }
  });
  const [krMesureOpen, setKrMesureOpen] = useState<string | null>(null);
  const [krMesureDraft, setKrMesureDraft] = useState({ valeur: '', note: '', date: new Date().toISOString().slice(0, 10) });

  const viewedSession = session;
  const viewedData = krData;

  function updateKRS(sid: string, krId: string, patch: Partial<{ valeur: string; statut: 'pending' | 'progress' | 'done'; moyen: string }>) {
    setKrData(cur => {
      const existing = cur.tracking[krId] ?? { valeur: '', statut: 'pending' as const };
      const tracking = { ...cur.tracking, [krId]: { ...existing, ...patch } };
      try { localStorage.setItem(`aura-kr-tracking-${sid}`, JSON.stringify(tracking)); } catch {}
      return { ...cur, tracking };
    });
  }

  function addMesureS(sid: string, krId: string, mesure: KRMesureS) {
    setKrData(cur => {
      const history = { ...cur.history, [krId]: [...(cur.history[krId] ?? []), mesure].sort((a, b) => a.date.localeCompare(b.date)) };
      try { localStorage.setItem(`aura-kr-history-${sid}`, JSON.stringify(history)); } catch {}
      return { ...cur, history };
    });
  }

  function deleteMesureS(sid: string, krId: string, idx: number) {
    setKrData(cur => {
      const history = { ...cur.history, [krId]: (cur.history[krId] ?? []).filter((_, j) => j !== idx) };
      try { localStorage.setItem(`aura-kr-history-${sid}`, JSON.stringify(history)); } catch {}
      return { ...cur, history };
    });
  }

  function exportCSV() {
    const rows = ['Objectif,KR,Date,Valeur,Note'];
    session.criteria.forEach(moe => {
      (moe.children?.length ? moe.children : []).forEach(mop => {
        const krId = `${moe.id}__${mop.id}`;
        const mesures = krData.history[krId] ?? [];
        if (mesures.length === 0) rows.push(`"${moe.label}","${mop.label}",,,""`);
        else mesures.forEach(m => rows.push(`"${moe.label}","${mop.label}","${m.date}","${m.valeur}","${m.note ?? ''}"`));
      });
    });
    audit("export", "CSV");
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `aura-suivi-${session.id}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  const scColors: Record<string, { bg: string; color: string }> = {
    pending:  { bg: '#f3f4f6', color: '#6b7280' },
    progress: { bg: '#fef3c7', color: '#92400e' },
    done:     { bg: '#d1fae5', color: '#065f46' },
  };

  // ── Point d'avancement à la voix : un KR après l'autre ────────────────────────
  const [suiviCompanionOpen, setSuiviCompanionOpen] = useState(false);
  const suiviSteps: CompanionStep[] = viewedSession.criteria.flatMap(moe =>
    (moe.children?.length ? moe.children : []).map(mop => {
      const krId = `${moe.id}__${mop.id}`;
      const tr = viewedData.tracking[krId];
      return {
        id: krId, group: moe.label, optional: true,
        question: `Où en est « ${mop.label} » ?`,
        hint: "L'état d'avancement, puis un mot sur ce qui bloque ou avance.",
        current: tr?.valeur,
        apply: (t: string) => {
          const v = t.trim(); if (!v) return;
          const q = v.toLowerCase();
          const statut: 'pending' | 'progress' | 'done' =
            /(atteint|terminé|fini|bouclé|livré|fait)/.test(q) ? 'done'
              : /(pas commencé|rien|à faire|non démarré|en attente)/.test(q) ? 'pending' : 'progress';
          updateKRS(session.id, krId, { valeur: v.slice(0, 120), statut });
          addMesureS(session.id, krId, { date: new Date().toISOString().slice(0, 10), valeur: v.slice(0, 120), note: "Point vocal Aura" });
        },
      };
    })
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, paddingBottom: 32 }}>
      <CompagnonAura
        open={suiviCompanionOpen}
        onClose={() => setSuiviCompanionOpen(false)}
        steps={suiviSteps}
        title="Point d'avancement"
        contextPrompt="Suivi d'exécution : avancement d'un résultat clé, obstacles, prochaine étape." />

      {/* ── Barre de navigation : sélecteur d'initiative ──────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)", display: "flex", alignItems: "center", gap: 8, flex: 1, flexWrap: "wrap" }}>
            Tableau de bord · Suivi OKR
            <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: isProductPattern ? "#7c3aed12" : "#0ea5e912", color: isProductPattern ? "#7c3aed" : "#0369a1", border: `1px solid ${isProductPattern ? "#7c3aed40" : "#0ea5e940"}` }}>
              Parcours : {isProductPattern ? "Produit & offre → exigences" : "Pilotage par OKR"}
            </span>
          </div>
          {suiviSteps.length > 0 && (
            <button type="button" data-testid="suivi-guided-flow" aria-hidden="true" tabIndex={-1}
              onClick={() => setSuiviCompanionOpen(true)} style={{ display: "none" }} />
          )}
          {isProductPattern && (
            <button onClick={() => setReqOpen(o => !o)}
              style={{ padding: "5px 11px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
               Dossier d'exigences ★
            </button>
          )}
          <button onClick={exportCSV}

            style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text2)", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
             CSV
          </button>
          <button onClick={onBack}
            style={{ padding: "5px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text3)", fontSize: 12, cursor: "pointer" }}>
            ← Arbitrer
          </button>
        </div>
        {(() => {
          const meta = loadOkrMeta(session.id);
          if (!meta) return null;
          const drift = computeOkrDrift(session.criteria, session.leviersDef, meta);
          return <OkrDriftBanner meta={meta} drift={drift} />;
        })()}
        {/* Comme l'ancien Suivre : le tableau de bord d'abord ; « Améliorer » (moteur Sow) à la demande. */}
        <details data-testid="sow-improve" style={{ order: 99 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 800, color: "#0369a1" }}>▲ Améliorer : objectifs ambitieux et atteignables</summary>
          <SowImprovePanel session={session} />
        </details>
        {/* Registre des combinaisons nommées : leviers, verdict d'origine, commentaires, évolution */}
        <CombinaisonsSuivies sessionId={session.id} scope="initiative" />
        {reqOpen && <RequirementsPanel session={session} onClose={() => setReqOpen(false)} />}
      </div>

      {/* ══ Plan d'action de la décision (unique, éditable, généré par IA) ══ */}
      <ActionPlanPanel session={session} onUpdate={onUpdate} />

      {/* ══ Suivi de l'exécution — toujours celui de cette décision ═══════ */}
      {(() => {
        const s = viewedSession;
        const data = viewedData;
        const summaryByMoe = s.criteria.map((moe, mi) => {
          const mops = moe.children?.length ? moe.children : [];
          const done = mops.filter(mop => data.tracking[`${moe.id}__${mop.id}`]?.statut === 'done').length;
          const progress = mops.filter(mop => data.tracking[`${moe.id}__${mop.id}`]?.statut === 'progress').length;
          const pct = mops.length > 0 ? Math.round(((done + progress * 0.5) / mops.length) * 100) : 0;
          return { moe, mi, mops, done, progress, pct, color: MOE_COLORS_SUIVI[mi % MOE_COLORS_SUIVI.length] };
        });
        const totalKR = summaryByMoe.reduce((s2, m) => s2 + m.mops.length, 0);
        const totalDone = summaryByMoe.reduce((s2, m) => s2 + m.done, 0);
        const totalProg = summaryByMoe.reduce((s2, m) => s2 + m.progress, 0);
        const globalPct2 = summaryByMoe.length > 0 ? Math.round(summaryByMoe.reduce((s2, m) => s2 + m.pct, 0) / summaryByMoe.length) : 0;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Résumé initiative */}
            <div style={{ display: "flex", gap: 14, alignItems: "center", padding: "12px 16px", borderRadius: 8, background: "var(--v4-surface)", border: "1.5px solid var(--v4-border)" }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: globalPct2 >= 70 ? "#059669" : globalPct2 >= 40 ? "#d97706" : "#6366f1" }}>{globalPct2}<span style={{ fontSize: 13 }}>%</span></div>
                <div style={{ fontSize: 12, color: "var(--v4-text3)", fontWeight: 700, textTransform: "uppercase", marginTop: 2 }}>Avancement</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 12 }}>{s.title}</div>
                <div style={{ height: 6, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden", marginBottom: 5 }}>
                  <div style={{ height: "100%", width: `${globalPct2}%`, borderRadius: 6, transition: "width .5s",
                    background: globalPct2 >= 70 ? "#059669" : globalPct2 >= 40 ? "#d97706" : "#6366f1" }} />
                </div>
                <div style={{ display: "flex", gap: 16, fontSize: 13 }}>
                  <span><strong style={{ color: "#059669" }}>{totalDone}</strong> <span style={{ color: "var(--v4-text3)" }}>atteints</span></span>
                  <span><strong style={{ color: "#d97706" }}>{totalProg}</strong> <span style={{ color: "var(--v4-text3)" }}>en cours</span></span>
                  <span><strong style={{ color: "var(--v4-text3)" }}>{totalKR - totalDone - totalProg}</strong> <span style={{ color: "var(--v4-text3)" }}>non démarrés</span></span>
                </div>
              </div>
            </div>

            {/* ── Timeline de la décision : la mémoire décisionnelle en un dessin ── */}
            {(() => {
              const auraHyp = s.leviersDef.reduce((n, lev) => n + lev.options.reduce((m, o) => m + Object.keys(o.impactOrigins ?? {}).length, 0), 0);
              const unknowns = (() => {
                const lf = getLeafCriteria(s.criteria);
                return s.leviersDef.reduce((n, lev) => n + lev.options.reduce((m, o) => m + lf.filter(c2 => (o.impacts[c2.id] ?? "U") === "U").length, 0), 0);
              })();
              const allKr = summaryByMoe.flatMap(({ moe, mops }) => mops.map(mop => data.tracking[`${moe.id}__${mop.id}`]?.statut ?? "pending"));
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 0, padding: "10px 16px", borderRadius: 8, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", overflowX: "auto" }}>
                  {[
                    { icon: "●", color: "#059669", label: "Décision", sub: s.updatedAt ? new Date(s.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }) : "" },
                    { icon: "✦", color: auraHyp + unknowns > 0 ? "#8b5cf6" : "#9ca3af", label: `${auraHyp} hypothèse${auraHyp > 1 ? "s" : ""} · ${unknowns} inconnue${unknowns > 1 ? "s" : ""}`, sub: "à surveiller" },
                  ].map((st, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
                      {i > 0 && <div style={{ width: 34, height: 1.5, background: "var(--v4-border)", margin: "0 8px" }} />}
                      <span style={{ fontSize: 13, color: st.color, marginRight: 12 }}>{st.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text)" }}>{st.label}</div>
                        <div style={{ fontSize: 12, color: "var(--v4-text3)" }}>{st.sub}</div>
                      </div>
                    </div>
                  ))}
                  <div style={{ width: 34, height: 1.5, background: "var(--v4-border)", margin: "0 8px", flexShrink: 0 }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
                    {allKr.map((st2, i) => (
                      <span key={i} title={st2} style={{ width: 9, height: 9, borderRadius: "50%", background: st2 === "done" ? "#059669" : st2 === "progress" ? "#d97706" : "var(--v4-border)" }} />
                    ))}
                    <span style={{ fontSize: 12, color: "var(--v4-text3)", marginLeft: 5 }}>KR</span>
                  </div>
                </div>
              );
            })()}

            {/* Résumé par objectif */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${summaryByMoe.length > 3 ? 150 : 180}px, 1fr))`, gap: 10 }}>
              {summaryByMoe.map(({ moe, mi, mops, done, progress, pct, color }) => (
                <div key={moe.id} style={{ borderRadius: 8, border: `1.5px solid ${color}25`, padding: "10px 12px", background: `${color}06` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color, textTransform: "uppercase", letterSpacing: ".06em", background: `${color}15`, padding: "2px 6px", borderRadius: 12 }}>O{mi + 1}</span>
                    <span style={{ fontSize: 15.5, fontWeight: 900, color: pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : color }}>{pct}%</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--v4-text)", marginBottom: 8, lineHeight: 1.3 }}>{moe.label}</div>
                  <div style={{ height: 5, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden", marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${pct}%`, background: pct >= 80 ? "#059669" : pct >= 50 ? "#d97706" : color, borderRadius: 6, transition: "width .5s" }} />
                  </div>
                  <div style={{ fontSize: 12, color: "var(--v4-text3)" }}>{done}/{mops.length} atteints · {progress} en cours</div>
                </div>
              ))}
            </div>

            {/* Détail par KR */}
            {s.criteria.map((moe, mi) => {
              const moeColor = MOE_COLORS_SUIVI[mi % MOE_COLORS_SUIVI.length];
              const mops = moe.children?.length ? moe.children : [];
              return (
                <div key={moe.id} style={{ borderRadius: 8, border: `1.5px solid ${moeColor}30`, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: `${moeColor}0d`, borderBottom: `1px solid ${moeColor}20`, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: moeColor, background: `${moeColor}15`, padding: "2px 7px", borderRadius: 12 }}>O{mi + 1}</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", flex: 1 }}>{moe.label}</div>
                  </div>
                  {mops.map((mop, ki) => {
                    const krId = `${moe.id}__${mop.id}`;
                    const tracking = data.tracking[krId] ?? { valeur: '', statut: 'pending' as const };
                    const history = data.history[krId] ?? [];
                    const actions = data.actions[krId] ?? [];
                    const sc = scColors[tracking.statut];
                    const trendNums = history.map(m => parseFloat(m.valeur.replace(',', '.').replace(/[^0-9.e+\-]/g, '')) || 0);
                    const trendDir = trendNums.length >= 2
                      ? (trendNums[trendNums.length - 1] > trendNums[0] ? '↑' : trendNums[trendNums.length - 1] < trendNums[0] ? '↓' : '→')
                      : null;
                    const trendColor = trendDir === '↑' ? '#059669' : trendDir === '↓' ? '#dc2626' : '#9ca3af';
                    return (
                      <div key={mop.id} style={{ borderTop: `1px solid ${moeColor}15`, background: ki % 2 === 0 ? "var(--v4-bg)" : `${moeColor}03` }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px" }}>
                          <span style={{ fontSize: 12, fontWeight: 800, color: moeColor, background: `${moeColor}12`, padding: "2px 6px", borderRadius: 6, flexShrink: 0, marginTop: 2 }}>KR{mi + 1}.{ki + 1}</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", lineHeight: 1.3 }}>{mop.label}</div>
                            <div style={{ fontSize: 12, color: "var(--v4-text3)", marginTop: 2 }}> {tracking.moyen || suggestMoyen(mop.label)}</div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                            <KRTrendBadge mesures={history} />
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {trendNums.length >= 2 && (() => {
                                const mn = Math.min(...trendNums), mx = Math.max(...trendNums);
                                const nrm = (v: number) => mx === mn ? 7 : 13 - ((v - mn) / (mx - mn)) * 12;
                                const pts = trendNums.slice(-8).map((v, i, arr) => `${(i / Math.max(arr.length - 1, 1)) * 44 + 2},${nrm(v) + 1}`).join(" ");
                                return (
                                  <svg width={48} height={16} style={{ flexShrink: 0 }}>
                                    <polyline points={pts} fill="none" stroke={trendColor} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                                    <circle cx={pts.split(" ").pop()!.split(",")[0]} cy={pts.split(" ").pop()!.split(",")[1]} r={2.2} fill={trendColor} />
                                  </svg>
                                );
                              })()}
                              {trendDir && <span style={{ fontSize: 13, fontWeight: 800, color: trendColor }}>{trendDir}</span>}
                              <input value={tracking.valeur} onChange={e => updateKRS(s.id, krId, { valeur: e.target.value })} placeholder="—"
                                style={{ width: 80, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)", textAlign: "right" }} />
                              <select value={tracking.statut} onChange={e => updateKRS(s.id, krId, { statut: e.target.value as 'pending' | 'progress' | 'done' })}
                                style={{ padding: "3px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 12, fontFamily: "inherit", background: sc.bg, color: sc.color, fontWeight: 600, cursor: "pointer" }}>
                                <option value="pending">○ Non démarré</option>
                                <option value="progress">◑ En cours</option>
                                <option value="done">● Atteint</option>
                              </select>
                            </div>
                          </div>
                        </div>
                        {history.length > 0 && (
                          <div style={{ padding: "0 14px 8px", overflowX: "auto" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                              <thead>
                                <tr style={{ borderBottom: `1px solid ${moeColor}20` }}>
                                  {['Période','Valeur constatée','Note',''].map((h, i) => (
                                    <th key={i} style={{ padding: "3px 8px", textAlign: "left", color: "var(--v4-text3)", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", whiteSpace: "nowrap" }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((m, hi) => (
                                  <tr key={hi} style={{ borderBottom: `1px solid ${moeColor}10`, background: hi % 2 === 0 ? "transparent" : `${moeColor}04` }}>
                                    <td style={{ padding: "4px 8px", color: "var(--v4-text2)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{m.date}</td>
                                    <td style={{ padding: "4px 8px", fontWeight: 700, color: moeColor }}>{m.valeur}</td>
                                    <td style={{ padding: "4px 8px", color: "var(--v4-text3)", maxWidth: 200 }}>{m.note ?? '—'}</td>
                                    <td style={{ padding: "4px 4px", textAlign: "right" }}>
                                      <button onClick={() => deleteMesureS(s.id, krId, hi)}
                                        style={{ border: "none", background: "none", cursor: "pointer", color: "#dc262650", fontSize: 13, padding: "1px 4px", borderRadius: 12 }}>×</button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        <div style={{ padding: "0 14px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                          <button onClick={() => { setKrMesureOpen(krMesureOpen === krId ? null : krId); setKrMesureDraft({ valeur: tracking.valeur, note: '', date: new Date().toISOString().slice(0, 10) }); }}
                            style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${moeColor}40`, background: "var(--v4-surface)", color: moeColor, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                            + Enregistrer une mesure
                          </button>
                          {actions.length > 0 && <span style={{ fontSize: 12, color: "#6366f1", fontWeight: 600 }}>✦ {actions.length} action{actions.length > 1 ? 's' : ''}</span>}
                        </div>
                        {/* Actions du Plan d'action (généré par IA en haut de Suivre) qui se
                            rattachent à CE KR précis — jamais dans le bloc du haut, une seule
                            fois, ici, éditables au même titre que dans le panneau d'origine. */}
                        <KRActionPlanRows session={s} onUpdate={onUpdate} krId={krId} />
                        {krMesureOpen === krId && (
                          <div style={{ margin: "0 14px 10px", borderRadius: 8, background: `${moeColor}07`, border: `1px solid ${moeColor}20`, padding: "10px" }}>
                            <div style={{ fontSize: 12, fontWeight: 800, color: moeColor, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Nouvelle mesure — {mop.label}</div>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" }}>Date</label>
                                <input type="date" value={krMesureDraft.date} onChange={e => setKrMesureDraft(d => ({ ...d, date: e.target.value }))}
                                  style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)", width: 130 }} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" }}>Valeur constatée</label>
                                <input value={krMesureDraft.valeur} onChange={e => setKrMesureDraft(d => ({ ...d, valeur: e.target.value }))}
                                  placeholder={tracking.valeur || "ex. 87 %"}
                                  style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }} />
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 2 }}>
                                <label style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" }}>Note (période, source…)</label>
                                <input value={krMesureDraft.note} onChange={e => setKrMesureDraft(d => ({ ...d, note: e.target.value }))}
                                  placeholder="ex. Audit ASN Q3 2025"
                                  style={{ padding: "3px 7px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-surface)", color: "var(--v4-text)" }} />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button disabled={!krMesureDraft.valeur.trim() || !krMesureDraft.date}
                                onClick={() => { addMesureS(s.id, krId, { date: krMesureDraft.date, valeur: krMesureDraft.valeur.trim(), note: krMesureDraft.note.trim() || undefined }); updateKRS(s.id, krId, { valeur: krMesureDraft.valeur.trim() }); setKrMesureOpen(null); }}
                                style={{ padding: "4px 12px", borderRadius: 6, border: "none", background: !krMesureDraft.valeur.trim() ? "var(--v4-surface)" : moeColor, color: !krMesureDraft.valeur.trim() ? "var(--v4-text3)" : "#fff", fontSize: 12, fontWeight: 700, cursor: krMesureDraft.valeur.trim() ? "pointer" : "not-allowed" }}>
                                Enregistrer
                              </button>
                              <button onClick={() => setKrMesureOpen(null)}
                                style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", color: "var(--v4-text3)", fontSize: 12, cursor: "pointer" }}>
                                Annuler
                              </button>
                            </div>
                          </div>
                        )}
                        {actions.length > 0 && (
                          <div style={{ margin: "0 14px 10px", display: "flex", flexDirection: "column", gap: 3 }}>
                            {actions.map((a, ai) => (
                              <div key={ai} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, padding: "3px 0", borderTop: ai === 0 ? `1px solid ${moeColor}15` : undefined }}>
                                <span style={{ color: "#6366f1", fontWeight: 700, flexShrink: 0 }}>✦</span>
                                <span style={{ flex: 1, color: "var(--v4-text2)" }}>{a.label}</span>
                                <span style={{ padding: "1px 5px", borderRadius: 6, background: "#ede9fe", color: "#6d28d9", fontWeight: 700, whiteSpace: "nowrap" }}>{a.responsable}</span>
                                <span style={{ padding: "1px 5px", borderRadius: 6, background: "#f0fdf4", color: "#065f46", fontWeight: 700, whiteSpace: "nowrap" }}>{a.horizon}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}

// ─── Plan d'action de la décision — un seul plan, celui de l'alternative retenue ──
// Essentiel de Suivre : quoi faire, qui, quand, où ça en est. Éditable à la main,
// et générable via l'IA à partir de l'alternative retenue (ou recommandée par défaut).
// Libellés/couleurs de statut partagés entre le panneau Plan d'action (haut de
// Suivre) et l'affichage des actions rattachées, sous chaque KR.
const ACTION_STATUT_LABEL: Record<ActionPlanAction["status"], string> = { todo: "○ À faire", progress: "◑ En cours", done: "● Fait" };
const ACTION_STATUT_COLOR: Record<ActionPlanAction["status"], { bg: string; color: string }> = {
  todo: { bg: "#f3f4f6", color: "#6b7280" }, progress: { bg: "#fef3c7", color: "#92400e" }, done: { bg: "#d1fae5", color: "#065f46" },
};
/** Une ligne d'action éditable — utilisée aussi bien pour les actions non
 *  rattachées (panneau du haut) que pour celles affichées sous leur KR. */
function ActionPlanActionRow({ action, onChange, onRemove }: {
  action: ActionPlanAction;
  onChange: (patch: Partial<ActionPlanAction>) => void;
  onRemove: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 140px 110px 130px 24px", gap: 6, alignItems: "center" }}>
      <input value={action.label} onChange={e => onChange({ label: e.target.value })} placeholder="Action à mener"
        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)" }} />
      <input value={action.owner} onChange={e => onChange({ owner: e.target.value })} placeholder="Responsable"
        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)" }} />
      <input value={action.dueDate} onChange={e => onChange({ dueDate: e.target.value })} placeholder="Échéance"
        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 13, fontFamily: "inherit", background: "var(--v4-bg)", color: "var(--v4-text)" }} />
      <select value={action.status} onChange={e => onChange({ status: e.target.value as ActionPlanAction["status"] })}
        style={{ padding: "5px 6px", borderRadius: 6, border: "1px solid var(--v4-border)", fontSize: 12.5, fontFamily: "inherit", fontWeight: 700, cursor: "pointer", background: ACTION_STATUT_COLOR[action.status].bg, color: ACTION_STATUT_COLOR[action.status].color }}>
        {(["todo", "progress", "done"] as const).map(st => <option key={st} value={st}>{ACTION_STATUT_LABEL[st]}</option>)}
      </select>
      <button onClick={onRemove} title="Supprimer"
        style={{ border: "none", background: "none", cursor: "pointer", color: "#dc262680", fontSize: 13, padding: 2 }}>×</button>
    </div>
  );
}
/** Actions du plan rattachées à un KR précis — affichées sous ce KR dans le
 *  détail par KR de Suivre (jamais au sommet, jamais un doublon de la liste
 *  du panneau Plan d'action, qui ne montre que les actions non rattachées). */
function KRActionPlanRows({ session, onUpdate, krId }: { session: AtelierSession; onUpdate: (patch: Partial<AtelierSession>) => void; krId: string }) {
  const plan = session.actionPlan ?? { actions: [] };
  const rows = plan.actions.filter(a => a.krId === krId);
  if (rows.length === 0) return null;
  function patchAction(id: string, patch: Partial<ActionPlanAction>) {
    onUpdate({ actionPlan: { ...plan, actions: plan.actions.map(a => a.id === id ? { ...a, ...patch } : a) } });
  }
  function remove(id: string) {
    onUpdate({ actionPlan: { ...plan, actions: plan.actions.filter(a => a.id !== id) } });
  }
  return (
    <div style={{ margin: "0 14px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: "#6366f1", textTransform: "uppercase", letterSpacing: ".05em" }}>✦ Plan d'action — {rows.length} action{rows.length > 1 ? "s" : ""}</div>
      {rows.map(a => (
        <ActionPlanActionRow key={a.id} action={a} onChange={patch => patchAction(a.id, patch)} onRemove={() => remove(a.id)} />
      ))}
    </div>
  );
}
function ActionPlanPanel({ session, onUpdate }: { session: AtelierSession; onUpdate: (patch: Partial<AtelierSession>) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Alternative pilote : celle retenue explicitement par l'utilisateur, sinon
  // la mieux notée (valeur + faisabilité) — jamais un choix inventé hors du modèle.
  const chosenScenario = (() => {
    if (session.retainedScenarioId) {
      const found = session.scenarios.find(sc => sc.id === session.retainedScenarioId);
      if (found) return found;
    }
    if (session.scenarios.length === 0) return null;
    return [...session.scenarios].sort((a, b) => (b.valeur * 0.6 + b.faisabilite * 0.4) - (a.valeur * 0.6 + a.faisabilite * 0.4))[0];
  })();
  const isRecommended = !!chosenScenario && chosenScenario.id !== session.retainedScenarioId;

  const plan = session.actionPlan ?? { actions: [] };

  function setPlan(patch: Partial<NonNullable<AtelierSession["actionPlan"]>>) {
    onUpdate({ actionPlan: { ...plan, ...patch } });
  }

  async function generate() {
    if (!chosenScenario) { setError("Ajoutez au moins un scénario dans Composer avant de générer un plan d'action."); return; }
    setLoading(true); setError(null);
    try {
      const { generateActionPlan } = await import("../lib/v4/atelier-llm");
      const leviersResume = chosenScenario.leviers.map(l => l.label).join(", ");
      const krs = session.criteria.flatMap(moe =>
        (moe.children?.length ? moe.children : []).map(mop => ({
          id: `${moe.id}__${mop.id}`, objectif: moe.label, keyResult: mop.label,
        })));
      const res = await generateActionPlan({
        data: {
          decisionTitle: session.title,
          contextRaw: session.contextRaw || session.contextEnriched || "",
          scenarioLabel: chosenScenario.label,
          scenarioDescription: chosenScenario.description,
          leviersResume,
          objectif: session.elicitation?.objectif || undefined,
          exigencesNonNeg: session.elicitation?.exigencesNonNeg || undefined,
          krs,
        },
      });
      if (res.actions.length === 0) { setError("L'IA n'a pas pu générer de plan — réessayez ou ajoutez les actions à la main."); return; }
      setPlan({ actions: res.actions, scenarioId: chosenScenario.id, generatedAt: new Date().toISOString() });
    } catch (e) {
      setError((e as Error).message || "L'IA n'a pas pu générer de plan — réessayez ou ajoutez les actions à la main.");
    } finally { setLoading(false); }
  }

  // Ensemble des KR réels de la session — sert à distinguer une action
  // "rattachée" (affichée sous son KR, dans le détail par KR de Suivre) d'une
  // action "non rattachée" (affichée ici, seule, jamais dupliquée aux deux endroits).
  const validKrIds = new Set(
    session.criteria.flatMap(moe => (moe.children?.length ? moe.children : []).map(mop => `${moe.id}__${mop.id}`)),
  );
  const unassigned = plan.actions.filter(a => !a.krId || !validKrIds.has(a.krId));
  const assignedCount = plan.actions.length - unassigned.length;

  function updateAction(id: string, patch: Partial<ActionPlanAction>) {
    setPlan({ actions: plan.actions.map(a => a.id === id ? { ...a, ...patch } : a) });
  }
  function removeAction(id: string) {
    setPlan({ actions: plan.actions.filter(a => a.id !== id) });
  }
  function addAction() {
    setPlan({ actions: [...plan.actions, { id: `a_${Date.now()}`, label: "", owner: "", dueDate: "", status: "todo" }] });
  }

  const doneCount = plan.actions.filter(a => a.status === "done").length;
  const progCount = plan.actions.filter(a => a.status === "progress").length;
  const pct = plan.actions.length > 0 ? Math.round(((doneCount + progCount * 0.5) / plan.actions.length) * 100) : 0;

  return (
    <div style={{ borderRadius: 8, border: "1.5px solid var(--v4-accent-border)", background: "var(--v4-surface)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", background: "var(--v4-accent-bg)", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>Plan d'action</div>
          <div style={{ fontSize: 12.5, color: "var(--v4-text3)", marginTop: 2 }}>
            Alternative {isRecommended ? "recommandée par Aura" : "retenue"} :{" "}
            <strong style={{ color: "var(--v4-text2)" }}>{chosenScenario?.label ?? "—"}</strong>
            {/* Le détail (libellé/responsable/échéance/statut) de chaque action rattachée
                à un KR vit désormais sous ce KR, dans le détail par KR ci-dessous — pas
                ici, pour éviter de dupliquer un même plan à deux endroits de Suivre. */}
            {assignedCount > 0 && <> · {assignedCount} action{assignedCount > 1 ? "s" : ""} affichée{assignedCount > 1 ? "s" : ""} sous {assignedCount > 1 ? "leurs KR" : "son KR"} ci-dessous</>}
          </div>
        </div>
        {plan.actions.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 70, height: 6, borderRadius: 6, background: "var(--v4-border)", overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, borderRadius: 6, background: pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#6366f1", transition: "width .4s" }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 800, color: pct >= 70 ? "#059669" : pct >= 40 ? "#d97706" : "#6366f1" }}>{pct}%</span>
          </div>
        )}
        <button onClick={generate} disabled={loading}
          style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: loading ? "wait" : "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          ✦ {plan.actions.length > 0 ? "Régénérer avec l'IA" : "Générer le plan d'action avec l'IA"}
          {loading && <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
        </button>
      </div>

      {error && <div style={{ padding: "8px 16px", fontSize: 13, color: "#DC2626" }}>{error}</div>}

      <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
        {plan.actions.length === 0 && !loading && (
          <div style={{ fontSize: 13, color: "var(--v4-text3)", padding: "6px 0" }}>
            Aucune action pour l'instant — générez un plan avec l'IA ou ajoutez une action à la main.
          </div>
        )}
        {unassigned.length > 0 && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".05em" }}>
            {assignedCount > 0 ? "Non rattachées à un KR" : "Actions"}
          </div>
        )}
        {unassigned.map(a => (
          <ActionPlanActionRow key={a.id} action={a} onChange={patch => updateAction(a.id, patch)} onRemove={() => removeAction(a.id)} />
        ))}
        <button onClick={addAction}
          style={{ alignSelf: "flex-start", marginTop: 4, padding: "4px 10px", borderRadius: 6, border: "1px dashed var(--v4-border)", background: "none", color: "var(--v4-text3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          + Ajouter une action
        </button>
      </div>
    </div>
  );
}

// ─── KR Actions Panel — propose AI actions to achieve a Key Result ───────────
function KRActionsPanel({ decisionTitle, objective, kr, context }: {
  decisionTitle: string;
  objective: string;
  kr: { id: string; label: string; kpi: string; baseline: string; target: string; deadline: string };
  context?: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actions, setActions] = useState<Array<{ id: string; label: string; who: string; when: string; effort: string; impact: string }> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (actions) { setOpen(o => !o); return; }
    setOpen(true);
    setLoading(true);
    setError(null);
    try {
      const { generateKRActionsForKR } = await import("../lib/v4/atelier-llm");
      const res = await generateKRActionsForKR({ data: { decisionTitle, objective, kr, context } });
      setActions(res.actions);
    } catch (e) {
      setError((e as Error).message || "L'IA n'a pas pu générer de proposition — réessayez ou continuez manuellement");
    }
    finally { setLoading(false); }
  }

  const EFFORT_COLOR: Record<string, string> = { Faible: "#059669", Moyen: "#d97706", Élevé: "#dc2626" };
  const EFFORT_BG: Record<string, string> = { Faible: "#d1fae5", Moyen: "#fef3c7", Élevé: "#fee2e2" };

  return (
    <div style={{ marginTop: 8 }}>
      <button onClick={load} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--v4-accent-border)", background: open ? "var(--v4-accent-bg)" : "transparent", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 5 }}>
        ✦ {actions ? (open ? "Masquer les actions" : "Voir les actions IA") : "Proposer des actions IA"}
        {loading && <span style={{ display: "inline-block", width: 8, height: 8, border: "1.5px solid var(--v4-accent)", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />}
      </button>
      {open && !loading && error && (
        <div style={{ marginTop: 8, fontSize: 13, color: "#DC2626" }}>{error}</div>
      )}
      {open && !loading && actions && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {actions.length === 0 && <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Aucune action générée.</div>}
          {actions.map((a, i) => (
            <div key={a.id} style={{ display: "grid", gridTemplateColumns: "18px 1fr auto", gap: "0 8px", alignItems: "start", padding: "7px 10px", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)" }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-accent)", paddingTop: 1 }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", lineHeight: 1.4, marginBottom: 3 }}>{a.label}</div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 6, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", color: "var(--v4-text3)" }}> {a.who}</span>
                  <span style={{ fontSize: 12, padding: "1px 6px", borderRadius: 6, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", color: "var(--v4-text3)" }}>⏱ {a.when}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end" }}>
                <span style={{ fontSize: 12, padding: "1px 5px", borderRadius: 6, background: EFFORT_BG[a.effort] ?? "#f3f4f6", color: EFFORT_COLOR[a.effort] ?? "#374151", fontWeight: 700 }}>Effort {a.effort}</span>
                <span style={{ fontSize: 12, padding: "1px 5px", borderRadius: 6, background: EFFORT_BG[a.impact] ?? "#f3f4f6", color: EFFORT_COLOR[a.impact] ?? "#374151", fontWeight: 700 }}>Impact {a.impact}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StepDecider({ session, onUpdate, onBack, setAuraMsgs, setAuraLoading }: {
  session: AtelierSession;
  onUpdate: (patch: Partial<AtelierSession>) => void;
  onBack: () => void;
  setAuraMsgs: (m: AuraMsg[] | ((p: AuraMsg[]) => AuraMsg[])) => void;
  setAuraLoading: (v: boolean) => void;
}) {
  const [reco, setReco] = useState(session.auraRecommendation ?? "");
  const [generating, setGenerating] = useState(false);
  // Le moment de fierté : le Decision Record vient d'être exporté.
  const [recordExported, setRecordExported] = useState(false);
  // Panneau « Partir de l'objectif » : cibles ordinales par MOE + tolérance de risque
  const [goalTargets, setGoalTargets] = useState<Record<string, number> | null>(null);
  const [goalTolerate, setGoalTolerate] = useState(false);
  // Réglage détaillé du souhait (par objectif / sous-objectif) : replié par défaut,
  // le choix d'ambition en un clic suffit dans la majorité des cas.
  const [goalFine, setGoalFine] = useState(false);
  // Champ des alternatives : par défaut, on ne montre que les options éligibles.
  const [goalOnlyOk, setGoalOnlyOk] = useState(true);
  // Combinaison choisie dans « Partir de l'objectif », à appliquer en Vue globale/Chaîne
  // au moment du saut d'onglet (navigation croisée entre vues, aucun nouveau calcul).
  const [appliedCombo, setAppliedCombo] = useState<Record<string, string> | null>(null);
  // Sélecteur d'objectif compact, ouvert directement depuis la carte décisionnelle
  // (vue par défaut) — évite d'imposer un changement d'onglet pour fixer une cible.
  const [showGoalPicker, setShowGoalPicker] = useState(false);
  // Fixe une cible d'objectif pour un critère et la persiste — même clé de
  // stockage que l'onglet « Partir de l'objectif », pour que les deux entrées
  // (sélecteur compact ici, panneau détaillé là-bas) partagent le même état.
  function setGoalTarget(critId: string, level: number) {
    const next = { ...(goalTargets ?? {}), [critId]: level };
    setGoalTargets(next);
    try { localStorage.setItem(`aura-goal-${session.id}`, JSON.stringify(next)); } catch { /* stockage */ }
  }
  // Prototype « petits multiples par MOE » — replié par défaut, présenté comme
  // complémentaire à la carte décisionnelle (pas un remplacement).
  const [showSmallMultiples, setShowSmallMultiples] = useState(false);
  const [showRobustesse, setShowRobustesse] = useState(false);
  const [showCarteMenu, setShowCarteMenu] = useState(false);
  // Brique 3+4 : ajuster poids/impacts en direct depuis la Carte, sans quitter
  // Arbitrer — réutilise exactement le mécanisme du Simulateur existant
  // (setLocalCritImportance / cycleLocalImpact), qui pilote déjà tout
  // (graphique, distribution, scénarios) via localCriteria/localLeviersDef.
  const [showLiveTweak, setShowLiveTweak] = useState(false);
  const [liveTweakTab, setLiveTweakTab] = useState<"poids" | "impacts">("poids");
  const [showTrancherHelp, setShowTrancherHelp] = useState(false);
  const [showMatrixDetail, setShowMatrixDetail] = useState(false);
  const [showTieCompare, setShowTieCompare] = useState(false);
  // Principes de lecture experte : pédagogie générique (pas spécifique à cette
  // décision) — repliée par défaut pour désencombrer la Vue Expert (cf. audit
  // "trop de texte" — collapse plutôt que suppression, le contenu reste
  // accessible à la demande).
  const [expertPrinciplesOpen, setExpertPrinciplesOpen] = useState(false);
  // Configuration courante de la Chaîne, partagée avec le Front de Pareto (marqueur live)
  const [chaineSelectedOpts, setChaineSelectedOpts] = useState<Record<string, string>>({});
  // Navigateur de combinaisons équivalentes — quand on clique un point du
  // graphique, plusieurs combinaisons de leviers peuvent y aboutir. On les
  // parcourt une à une ; chaque combinaison affichée se projette en direct
  // sur la Vue Chaîne (même mécanisme que le marqueur "Votre configuration").
  const [pointBrowser, setPointBrowser] = useState<{ gPlus: OrdinalLevel; dMinus: OrdinalLevel; exactTotal: number; matches: ComboMatch[]; scannedAll: boolean; index: number } | null>(null);
  // Scénario "mis" dans la Carte par l'utilisateur (null = recommandation Aura par défaut).
  // Initialisé depuis session.retainedScenarioId pour survivre à la navigation entre étapes ;
  // toute sélection est aussi persistée dans la session (cf. setRetainedScenario ci-dessous).
  const [cardScenarioId, setCardScenarioIdState] = useState<string | null>(() => session.retainedScenarioId ?? null);
  const setCardScenarioId = (id: string | null) => {
    setCardScenarioIdState(id);
    onUpdate({ retainedScenarioId: id ?? undefined });
  };
  // Dépliage de l'histogramme : on part du résultat global d'une solution et on
  // descend Objectif → Dimension → Indicateur (mêmes libellés que Comprendre /
  // Impacter / Composer). Clés : `scId` puis `scId:critId`.
  const [histoOpen, setHistoOpen] = useState<Set<string>>(new Set());
  // Charge cognitive : l'explicabilité fine et la légende du treillis restent
  // disponibles, mais repliées — le décideur voit d'abord le verdict.
  const [whyVerdictOpen, setWhyVerdictOpen] = useState(false);
  // Le détail par solution (histogramme complet) reste replié par défaut :
  // la carte du treillis dit déjà tout ce qu'il faut pour trancher.
  const [resultatOpen, setResultatOpen] = useState(false);
  const [mapHelpOpen, setMapHelpOpen] = useState(false);
  const [nextInfoOpen, setNextInfoOpen] = useState(false);
  const toggleHisto = (k: string) => setHistoOpen(prev => {
    const n = new Set(prev);
    if (n.has(k)) n.delete(k); else n.add(k);
    return n;
  });

  const [whyScoreOpen, setWhyScoreOpen] = useState(false);
  type SelectedCombo = { combo: Record<string, string>; gPlus: OrdinalLevel; dMinus: OrdinalLevel; isUserScenario: string | null; scenarioId?: string };
  const [selectedCombo, setSelectedCombo] = useState<SelectedCombo | null>(null);
  const [tieChoiceId, setTieChoiceId] = useState<string | null>(null); // scénario en cours de départage manuel (formulaire ouvert)
  const [tieRationale, setTieRationale] = useState("");
  const [validated, setValidated] = useState(() => {
    try { return !!localStorage.getItem(`aura-okr-${session.id}`); } catch { return false; }
  });
  const [showWeights, setShowWeights] = useState(false);
  const [showImpacts, setShowImpacts] = useState(false);
  const [shared, setShared] = useState(session.shared ?? false);
  const [okrData, setOkrData] = useState<import("../lib/v4/atelier-llm").GeneratedOKR | null>(() => {
    try { const raw = localStorage.getItem(`aura-okr-${session.id}`); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [okrMeta, setOkrMeta] = useState<OkrMeta | null>(() => loadOkrMeta(session.id));
  const [okrLoading, setOkrLoading] = useState(false);
  const [okrError, setOkrError] = useState<string | null>(null);
  const [confirmOkrRegen, setConfirmOkrRegen] = useState(false);
  const navigate = useNavigate();

  // KR tracking — valeur actuelle + statut par KR, persisté en localStorage
  const [krTracking, setKrTracking] = useState<Record<string, { valeur: string; statut: 'pending' | 'progress' | 'done'; moyen?: string }>>(() => {
    try { return JSON.parse(localStorage.getItem(`aura-kr-tracking-${session.id}`) ?? '{}'); } catch { return {}; }
  });
  function updateKR(krId: string, patch: Partial<{ valeur: string; statut: 'pending' | 'progress' | 'done'; moyen: string }>) {
    setKrTracking(prev => {
      const existing = prev[krId] ?? { valeur: '', statut: 'pending' as const };
      const next = { ...prev, [krId]: { ...existing, ...patch } };
      try { localStorage.setItem(`aura-kr-tracking-${session.id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // KR action plan — AI-generated actions per KR, persisted in localStorage
  type KRAction = { label: string; responsable: string; horizon: string; risque: string };
  type KRMesure = { date: string; valeur: string; note?: string };
  const [krHistory, setKrHistory] = useState<Record<string, KRMesure[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`aura-kr-history-${session.id}`) ?? '{}'); } catch { return {}; }
  });
  const [krMesureOpen, setKrMesureOpen] = useState<string | null>(null);
  const [krMesureDraft, setKrMesureDraft] = useState<{ valeur: string; note: string; date: string }>({ valeur: '', note: '', date: new Date().toISOString().slice(0, 10) });
  const [krResponsable, setKrResponsable] = useState<Record<string, string>>({});
  // Un seul niveau de repli, fermé par défaut : au premier coup d'œil, on ne
  // voit que l'objectif, le libellé du KR, un badge de statut et la tendance —
  // le détail (moyen de mesure, responsable, valeur/historique, actions) ne
  // s'affiche qu'au clic, pour réduire la densité de texte de la vue OKR.
  const [expandedKr, setExpandedKr] = useState<Set<string>>(new Set());
  const [expandedObj, setExpandedObj] = useState<Set<string>>(new Set());
  const toggleExpandedKr = (id: string) => setExpandedKr(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const toggleExpandedObj = (id: string) => setExpandedObj(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function addMesure(krId: string, mesure: KRMesure) {
    setKrHistory(prev => {
      const next = { ...prev, [krId]: [...(prev[krId] ?? []), mesure].sort((a, b) => a.date.localeCompare(b.date)) };
      try { localStorage.setItem(`aura-kr-history-${session.id}`, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  const [krActions, setKrActions] = useState<Record<string, KRAction[]>>(() => {
    try { return JSON.parse(localStorage.getItem(`aura-kr-actions-${session.id}`) ?? '{}'); } catch { return {}; }
  });
  const [krActionsLoading, setKrActionsLoading] = useState(false);
  const [krActionsError, setKrActionsError] = useState<string | null>(null);

  async function generateKRActionsHandler() {
    if (krActionsLoading) return;
    setKrActionsLoading(true);
    setKrActionsError(null);
    try {
      const krs: Array<{ krId: string; objectif: string; keyResult: string }> = [];
      localCriteria.forEach(moe => {
        const mops = moe.children?.length ? moe.children : [];
        mops.forEach(mop => {
          krs.push({ krId: `${moe.id}__${mop.id}`, objectif: moe.label, keyResult: mop.label });
        });
      });
      if (krs.length === 0) {
        setKrActionsError("Aucun Key Result à traiter — vos objectifs n'ont pas de dimensions en dessous. Ajoutez des dimensions dans Comprendre pour générer un plan d'actions.");
        return;
      }
      const { generateKRActions } = await import("../lib/v4/atelier-llm");
      const results = await generateKRActions({
        data: {
          decisionContext: session.contextRaw ?? session.title,
          bestScenario: cardScenario?.label ?? promising[0]?.label ?? '',
          krs,
        },
      });
      const map: Record<string, KRAction[]> = {};
      results.forEach(r => { map[r.krId] = r.actions; });
      const totalActions = Object.values(map).reduce((n, a) => n + a.length, 0);
      if (totalActions === 0) {
        setKrActionsError("Aura n'a pas pu générer d'actions cette fois (service indisponible ou réponse invalide) — réessayez.");
      }
      setKrActions(map);
      try { localStorage.setItem(`aura-kr-actions-${session.id}`, JSON.stringify(map)); } catch {}
    } catch {
      setKrActionsError("La génération a échoué (erreur réseau ou service indisponible) — réessayez.");
    } finally {
      setKrActionsLoading(false);
    }
  }

  // Live simulation state — local copies of criteria (weights) and lever impacts
  const [localCriteria, setLocalCriteria] = useState(() => session.criteria);
  const [localLeviersDef, setLocalLeviersDef] = useState(() => session.leviersDef);
  const localSession = { ...session, criteria: localCriteria, leviersDef: localLeviersDef };


  const leafCriteria = getLeafCriteria(localCriteria);

  function setLocalCritImportance(id: string, imp: ImportanceBadge) {
    setLocalCriteria(prev => updateCritDeep(prev, id, c => ({ ...c, importance: imp })));
  }

  const IMPACT_CYCLE: QualitativeImpact[] = ["U", "+", "++", "0", "-", "--"];
  function cycleLocalImpact(optId: string, critId: string) {
    setLocalLeviersDef(prev => prev.map(lev => ({
      ...lev,
      options: lev.options.map(opt => {
        if (opt.id !== optId) return opt;
        const cur = (opt.impacts[critId] ?? "U") as QualitativeImpact;
        const idx = IMPACT_CYCLE.indexOf(cur);
        return { ...opt, impacts: { ...opt.impacts, [critId]: IMPACT_CYCLE[(idx + 1) % IMPACT_CYCLE.length] } };
      }),
    })));
  }

  const { cellResults, nodeResults, normWeights, optionIndex, levelCells } = computeLoResults(localSession);

  // ── Champ des possibles : combinaisons de leviers, plafonnées ───────────────
  // Protège l'UI contre l'explosion combinatoire (des centaines de milliers/millions
  // de combinaisons possibles avec de nombreux leviers) : on réutilise le même cap
  // (enumerateCombos, EXHAUSTIVE_LIMIT = 10⁶) que l'onglet « Partir de l'objectif » et la
  // Chaîne : l'espace est parcouru EN ENTIER tant qu'il tient dans cette limite. `combosTotal`/`combosTruncated` sont affichés à l'utilisateur.
  // Mémoïsé car le coût croît avec le nombre de leviers — reconstruit sinon à CHAQUE rendu.
  const { combos: allPossibleCombosRaw, total: combosTotal, truncated: combosTruncated } = useMemo(() => {
    const base = enumerateCombos(localSession.leviersDef, EXHAUSTIVE_LIMIT);
    // Au-delà de la limite, aucune combinaison n'est énumérée (refus
    // explicite, jamais d'échantillon) ; les scénarios composés par
    // l'utilisateur restent affichés. Sans ça, « les
    // meilleures solutions » resterait une affirmation sur un sous-espace
    // arbitraire — jamais garantie d'être au moins aussi bonne qu'un
    // scénario concret déjà sous les yeux de l'utilisateur sur le même écran.
    const seen = new Set(base.combos.map(c => JSON.stringify(c)));
    const extra: Record<string, string>[] = [];
    for (const sc of localSession.scenarios) {
      const combo: Record<string, string> = {};
      for (const l of sc.leviers) combo[l.id] = l.valeur;
      const key = JSON.stringify(combo);
      if (!seen.has(key)) { seen.add(key); extra.push(combo); }
    }
    return { ...base, combos: [...base.combos, ...extra] };
  }, [localSession.leviersDef, localSession.scenarios]);
  const allPossibleCombos: PossCombo[] = useMemo(() => {
    if (!allPossibleCombosRaw.length) return [];
    const attCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
    const prof: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const weights = localSession.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const nw: OrdinalLevel[] = thesisWeights(weights);
    const evaluator = evaluatorFor(localSession.criteria, localSession.leviersDef, localSession.attitude);
    return allPossibleCombosRaw.map(combo => {
      const ev = evaluator.evaluate(combo);
      return { gPlus: ev.global.gPlus, dMinus: ev.global.dMinus, combo };
    });
  }, [allPossibleCombosRaw, localSession.criteria, localSession.attitude, optionIndex]);
  // ── « Partir de l'objectif » : évaluation par critère, mémoïsée ─────────────
  // Même champ des possibles que la Carte (allPossibleCombosRaw : espace
  // entier ou refus explicite + scénarios réellement composés, donc l'exploration par objectif
  // voit TOUJOURS les scénarios de l'utilisateur). Calculé ici et non dans le
  // rendu de l'onglet : sinon 512 agrégations hiérarchiques à chaque frappe.
  const goalMops: AtelierCriterion[] = useMemo(
    () => localSession.criteria.flatMap(m => (m.children ?? []).filter(c => (c.children?.length ?? 0) > 0 || c.level === "MOP")),
    [localSession.criteria],
  );
  const goalTargetable: AtelierCriterion[] = useMemo(
    () => [...localSession.criteria, ...goalMops],
    [localSession.criteria, goalMops],
  );
  const goalEvals: GoalComboEval[] = useMemo(() => {
    if (!allPossibleCombosRaw.length || !localSession.criteria.length) return [];
    const attCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
    const prof: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const weights = localSession.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const nw: OrdinalLevel[] = thesisWeights(weights);
    const evaluator = evaluatorFor(localSession.criteria, localSession.leviersDef, localSession.attitude);
    return allPossibleCombosRaw.map((combo, ci) => {
      const ev = evaluator.evaluate(combo);
      const perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }> = {};
      for (const c of localSession.criteria) perCrit[c.id] = ev.perNode[c.id];
      for (const mop of goalMops) perCrit[mop.id] = ev.perNode[mop.id];
      const global = ev.global;
      return { key: `g${ci}`, combo, perCrit, global };
    });
  }, [allPossibleCombosRaw, localSession.criteria, localSession.attitude, goalMops, optionIndex]);
  // Distribution EXACTE (jamais estimée) des issues (δ⁺,δ⁻) possibles sur TOUT
  // l'espace combinatoire — au plus 16 cellules à afficher, quelle que soit la
  // taille réelle de l'espace. Calculée par blocs (générateur) hors du rendu :
  // la page ne gèle jamais, même pour un espace effectif de plusieurs millions
  // de combinaisons — elle affiche une progression et converge vers le compte
  // exact final, sans plafond ni échantillon.
  const EMPTY_DIST: OutcomeDistProgress = { cells: [], rawTotal: 0, effectiveTotal: 0, computed: 0, done: true };
  const [outcomeDist, setOutcomeDist] = useState<OutcomeDistProgress>(EMPTY_DIST);
  useEffect(() => {
    if (!localSession.leviersDef.length || !localSession.criteria.length) { setOutcomeDist(EMPTY_DIST); return; }
    const attCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
    const prof: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    let cancelled = false;
    let timer: number | undefined;
    const gen = outcomeDistributionGen(localSession.leviersDef, localSession.criteria, optionIndex, attCode, prof);
    function step() {
      if (cancelled) return;
      const { value, done } = gen.next();
      if (value) setOutcomeDist(value);
      if (!done) timer = window.setTimeout(step, 0);
    }
    timer = window.setTimeout(step, 0);
    return () => { cancelled = true; if (timer) window.clearTimeout(timer); };
    // optionIndex est délibérément absent des deps : il est recalculé à chaque
    // rendu (nouvelle référence à chaque appel de computeLoResults) mais son
    // contenu ne dépend que de localSession.leviersDef, déjà listé ci-dessous.
    // Le garder en dépendance relançait le générateur à chaque rendu déclenché
    // par son propre setOutcomeDist(progress partiel) — la distribution ne
    // convergeait jamais au-delà du premier segment sur un grand espace
    // combinatoire (ex. 39 000 combinaisons → restait bloquée à 500/1 296).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSession.leviersDef, localSession.criteria, localSession.attitude]);

  // Marqueur "Votre configuration (Chaîne)" — dérivé des selectedOpts live de la Vue Chaîne,
  // un seul point calculé à la demande (jamais d'itération sur l'espace brut).
  const chaineLiveNr: { gPlus: OrdinalLevel; dMinus: OrdinalLevel } | null = useMemo(() => {
    if (!localSession.leviersDef.length || !Object.keys(chaineSelectedOpts).length) return null;
    const combo: Record<string, string> = {};
    for (const lev of localSession.leviersDef) {
      const opt = lev.options.find(o => o.label === chaineSelectedOpts[lev.id]);
      if (opt) combo[lev.id] = opt.id;
    }
    if (Object.keys(combo).length !== localSession.leviersDef.length) return null;
    const attCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
    const prof: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const weights = localSession.criteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const nw: OrdinalLevel[] = thesisWeights(weights);
    const pseudoSc: AtelierScenario = { id: "_chaine_live", label: "", color: "", description: "", leviers: Object.entries(combo).map(([lid, vid]) => ({ id: lid, label: lid, valeur: vid, type: "autre" as const })), scores: {}, valeur: 0, faisabilite: 0 };
    const stage1 = localSession.criteria.map(c => aggregateHierarchy(c, pseudoSc, optionIndex, attCode, prof));
    try { const r = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], nw.length ? nw : [3]); return { gPlus: r.gPlus as OrdinalLevel, dMinus: r.dMinus as OrdinalLevel }; }
    catch { return null; }
  }, [chaineSelectedOpts, localSession.leviersDef, localSession.criteria, localSession.attitude, optionIndex]);

  function printDecision() {
    if (typeof window === 'undefined') return;
    const bestScenario = promising[0] ?? null;
    const rejecteds = localSession.scenarios.filter(s => s.id !== bestScenario?.id);
    const statusLabels: Record<string, string> = { pending: 'Non démarré', progress: 'En cours', done: 'Atteint' };
    const statusColors: Record<string, string> = { pending: '#6b7280', progress: '#d97706', done: '#059669' };

    const configLines = bestScenario?.leviers.map(l => {
      const def = localLeviersDef.find(d => d.id === l.id || d.label === l.label);
      const opt = def?.options.find(o => o.id === l.valeur || o.label === l.valeur);
      return `<li><strong>${l.label}</strong> : ${opt?.label ?? l.valeur}</li>`;
    }).join('') ?? '';

    const rejectedLines = rejecteds.map(s => {
      const nr = nodeResults[s.id] ?? { gPlus: 0, dMinus: 0 };
      const reason = nr.dMinus > nr.gPlus
        ? `Risque de détérioration ${['nul','faible','modéré','élevé'][nr.dMinus]} supérieur au potentiel ${['nul','faible','modéré','élevé'][nr.gPlus]}.`
        : `Potentiel d'amélioration insuffisant face à la recommandation retenue.`;
      return `<li><strong>${s.label}</strong> — ${reason}</li>`;
    }).join('');

    const okrLines = localCriteria.map((moe, mi) => {
      const mopChildren = moe.children?.length ? moe.children : [];
      const leaves = mopChildren.flatMap(m => m.children?.length ? m.children : [m]);
      const posLeaves = leaves.filter(l => (cellResults[bestScenario?.id ?? '']?.[l.id]?.gPlus ?? 0) >= 1);
      const negLeaves = leaves.filter(l => (cellResults[bestScenario?.id ?? '']?.[l.id]?.dMinus ?? 0) >= 1);
      const atouts = posLeaves.map(l => l.label).slice(0, 3);
      const vigilances = negLeaves.map(l => l.label).slice(0, 2);

      const mopList = mopChildren.map((mop, ki) => {
        const krId = `${moe.id}__${mop.id}`;
        const tracking = krTracking[krId] ?? { valeur: '', statut: 'pending' };
        const actions = (krActions[krId] ?? []).map(a =>
          `<tr><td style="padding:3px 6px;font-size:12.5px">${a.label}</td><td style="padding:3px 6px;font-size:12.5px;color:#6366f1">${a.responsable}</td><td style="padding:3px 6px;font-size:12.5px">${a.horizon}</td><td style="padding:3px 6px;font-size:12.5px;color:#dc2626">${a.risque}</td></tr>`
        ).join('');
        const actionsTable = actions ? `<table style="width:100%;border-collapse:collapse;margin-top:6px;background:#f8fafc;border-radius:6px"><thead><tr style="background:#e0e7ff"><th style="padding:3px 6px;font-size:12px;text-align:left">Action</th><th style="padding:3px 6px;font-size:12px;text-align:left">Resp.</th><th style="padding:3px 6px;font-size:12px;text-align:left">Horizon</th><th style="padding:3px 6px;font-size:12px;text-align:left">Risque</th></tr></thead><tbody>${actions}</tbody></table>` : '';
        return `<div style="margin-bottom:8px;padding:8px 10px;border-radius:6px;border:1px solid #e5e7eb">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:12px;font-weight:800;background:#e0e7ff;color:#4338ca;padding:1px 6px;border-radius:6px">KR${mi+1}.${ki+1}</span>
            <span style="font-size:13px;font-weight:600">${mop.label}</span>
            <span style="margin-left:auto;font-size:12px;color:${statusColors[tracking.statut]};font-weight:700">${statusLabels[tracking.statut]}${tracking.valeur ? ' · ' + tracking.valeur : ''}</span>
          </div>
          ${actionsTable}
        </div>`;
      }).join('');

      return `<section style="margin-bottom:20px;padding:14px 16px;border-radius:8px;border:1.5px solid #c7d2fe;background:#f5f3ff">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
          <span style="font-size:12px;font-weight:800;background:#6366f1;color:#fff;padding:2px 7px;border-radius:6px">O${mi+1}</span>
          <strong style="color:#312e81;font-size:13px">${moe.label}</strong>
        </div>
        ${atouts.length > 0 ? `<div style="font-size:12.5px;color:#065f46;margin-bottom:4px">✓ Atouts : ${atouts.join(', ')}</div>` : ''}
        ${vigilances.length > 0 ? `<div style="font-size:12.5px;color:#92400e;margin-bottom:8px">⚠ Vigilances : ${vigilances.join(', ')}</div>` : ''}
        ${mopList}
      </section>`;
    }).join('');

    // ── Decision Record : provenances et inconnues restantes ──
    const ORD_FR = ['Aucune', 'Faible', 'Modérée', 'Élevée'];
    const auraCells = localLeviersDef.flatMap(l => l.options.flatMap(o =>
      Object.entries(o.impactOrigins ?? {}).map(([cid, org]) => ({
        opt: o.label, lev: l.label,
        crit: getLeafCriteria(localCriteria).find(c => c.id === cid)?.label ?? cid,
        org: org === 'aura-llm' ? 'analyse Aura' : 'heuristique Aura',
      }))));
    const provenanceSection = auraCells.length > 0
      ? `<h2>Provenance des jugements</h2>
         <p style="font-size:13px;color:#7c3aed;font-weight:600">✦ Cette décision repose sur ${auraCells.length} hypothèse${auraCells.length > 1 ? 's' : ''} posée${auraCells.length > 1 ? 's' : ''} par Aura et non encore confirmée${auraCells.length > 1 ? 's' : ''} par un expert :</p>
         <ul>${auraCells.slice(0, 12).map(c => `<li>${c.crit} — option « ${c.opt} » (${c.lev}) · <em>hypothèse ${c.org}</em></li>`).join('')}</ul>
         <p style="font-size:12.5px;color:#6b7280">Tout le reste de la matrice relève du jugement humain, ou a été confirmé.</p>`
      : `<h2>Provenance des jugements</h2><p style="font-size:13px;color:#065f46">✓ Chaque impact de la matrice relève du jugement humain, ou a été confirmé.</p>`;
    const unknownSection = nextInfo.length > 0
      ? `<h2>Inconnues restantes au moment de la décision</h2>
         <ul>${nextInfo.map(ins => `<li>${ins.decisive ? '<strong style="color:#7c3aed">[DÉCISIF]</strong> ' : ''}${ins.leaf.label} — effet de « ${ins.optLabel} » (${ins.levLabel}), scénario ${ins.sc.label}${ins.decisive ? ` · selon sa valeur, ${ins.sc.label} passe devant ou derrière ${ins.other.label}` : ''}</li>`).join('')}</ul>`
      : '';
    // Dossier d'exigences (si instruit)
    const exigSection = (() => {
      try {
        const ex = JSON.parse(localStorage.getItem(`aura-exigences-${session.id}`) ?? "null") as
          Array<{ type: string; texte: string; prio: string }> | null;
        if (!ex?.length) return "";
        const byType = (ty: string) => ex.filter(e => e.type === ty).map(e => `<li><strong>[${e.prio}]</strong> ${e.texte}</li>`).join("");
        return `<h2>Dossier d'exigences — produit / offre</h2>
          ${["Fonctionnelle", "Non fonctionnelle", "Contrainte"].map(ty => {
            const items = byType(ty);
            return items ? `<p style="font-size:12.5px;color:#6b7280">${ty}s :</p><ul>${items}</ul>` : "";
          }).join("")}`;
      } catch { return ""; }
    })();

    const tieSection = isTie
      ? `<div class="reco-box" style="border-color:#f59e0b;background:#fffbeb">
          <div style="font-size:12px;font-weight:800;color:#b45309;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">◆ Scénarios non discriminés</div>
          <div class="reco-title" style="color:#92400e">${promising.map(s => s.label).join(' · ')}</div>
          <div class="reco-sub">Ces ${promising.length} scénarios présentent le même profil ordinal (potentiel ${ORD_FR[nodeResults[promising[0].id]?.gPlus ?? 0]} · risque ${ORD_FR[nodeResults[promising[0].id]?.dMinus ?? 0]}). Le modèle et les connaissances disponibles à la date de ce document ne permettent pas de les distinguer. Tout départage est un choix hors modèle et doit être motivé ci-dessous.</div>
        </div>`
      : '';

    const w = window.open('', '_blank', 'width=960,height=800');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Decision Record — ${session.title}</title>
<style>
  *{box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;margin:0;padding:32px 48px;color:#111;max-width:960px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin:0 0 4px}
  h2{font-size:13px;font-weight:700;margin:28px 0 10px;border-bottom:2px solid #e5e7eb;padding-bottom:6px;color:#374151;text-transform:uppercase;letter-spacing:.04em}
  .badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:13px;font-weight:700;background:#dcfce7;color:#065f46}
  .meta{font-size:13px;color:#6b7280;margin:0 0 20px;line-height:1.7}
  .context-box{padding:12px 16px;border-radius:8px;background:#f8fafc;border:1px solid #e5e7eb;font-size:13px;color:#374151;line-height:1.6;margin-bottom:20px}
  .reco-box{border:2px solid #10b981;border-radius:8px;padding:16px 20px;background:#f0fdf4;margin-bottom:20px}
  .reco-title{font-size:20px;font-weight:900;color:#065f46;margin:0 0 6px}
  .reco-sub{font-size:13px;color:#374151;line-height:1.6;margin-bottom:10px}
  .metrics{display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .metric{background:#fff;border:1px solid #d1fae5;border-radius:8px;padding:10px 14px}
  .metric-label{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#6b7280;margin-bottom:4px}
  .metric-val{font-size:17px;font-weight:800}
  ul{margin:0;padding-left:20px} li{margin-bottom:5px;font-size:13px}
  .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12.5px;color:#9ca3af;display:flex;justify-content:space-between}
  @media print{body{padding:20px}button{display:none}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
  <div><div style="font-size:12.5px;font-weight:800;color:#6366f1;text-transform:uppercase;letter-spacing:.14em;margin-bottom:2px">Decision Record</div><h1>${session.title || 'Décision Aura'}</h1></div>
  <button onclick="window.print()" style="padding:8px 16px;border-radius:8px;border:none;background:#6366f1;color:#fff;font-size:13px;cursor:pointer;font-weight:600"> Imprimer / PDF</button>
</div>
<p class="meta">Arbitrage multicritère ordinal (modèle Lo) · Attitude ${session.attitude} · Établi le ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})} à ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}${session.elicitation?.decideurs ? ' · Décideurs : ' + session.elicitation.decideurs : ''}${session.elicitation?.impactes ? ' · Impactés : ' + session.elicitation.impactes : ''}</p>
${session.contextRaw ? `<div class="context-box"><strong>Contexte décisionnel :</strong> ${session.contextRaw}</div>` : ''}
${tieSection}
${bestScenario && !isTie ? `
<div class="reco-box">
  <div style="font-size:12px;font-weight:800;color:#059669;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">✦ Recommandation Aura</div>
  <div class="reco-title">${bestScenario.label}</div>
  <div class="reco-sub">${bestScenario.description || 'Scénario retenu par analyse multicritère ordinale.'}</div>
  ${reco ? `<div class="reco-sub" style="border-top:1px solid #d1fae5;padding-top:8px"><strong>Motivation :</strong> ${reco.replace(/\*\*([^*]+)\*\*/g, '$1')}</div>` : ''}
  <div class="metrics">
    <div class="metric"><div class="metric-label">Potentiel d'amélioration</div><div class="metric-val" style="color:${(nodeResults[bestScenario.id]?.gPlus ?? 0) >= 2 ? '#059669' : '#9ca3af'}">${['Aucune','Faible','Modérée','Élevée'][nodeResults[bestScenario.id]?.gPlus ?? 0]}</div></div>
    <div class="metric"><div class="metric-label">Risque de détérioration</div><div class="metric-val" style="color:${(nodeResults[bestScenario.id]?.dMinus ?? 0) === 0 ? '#059669' : (nodeResults[bestScenario.id]?.dMinus ?? 0) === 1 ? '#f59e0b' : '#dc2626'}">${['Aucune','Faible','Modérée','Élevée'][nodeResults[bestScenario.id]?.dMinus ?? 0]}</div></div>
  </div>
</div>
<h2>Configuration retenue</h2>
<ul>${configLines}</ul>
${rejecteds.length > 0 ? `<h2>Alternatives écartées</h2><ul>${rejectedLines}</ul>` : ''}` : isTie ? '' : '<p>Aucun scénario retenu.</p>'}
${provenanceSection}
${unknownSection}
<h2>OKR — Objectifs, Résultats clés & Plan d'actions</h2>
${okrLines}
${exigSection}
<div class="footer"><span>Généré par Aura Decision Zen</span><span>${new Date().toLocaleString('fr-FR')}</span></div>
</body></html>`);
    w.document.close();
    setRecordExported(true);
  }

  // Scénarios prometteurs = rang Lo maximal (peut être plusieurs en cas d'égalité)
  const promising: typeof session.scenarios = (() => {
    if (!localSession.scenarios.length) return [];
    const ranked = [...localSession.scenarios].sort((a, b) =>
      loCompare(
        nodeResults[b.id] ?? { gPlus: 0, dMinus: 0 },
        nodeResults[a.id] ?? { gPlus: 0, dMinus: 0 }
      )
    );
    const topNr = nodeResults[ranked[0].id] ?? { gPlus: 0, dMinus: 0 };
    return ranked.filter(s => loCompare(nodeResults[s.id] ?? { gPlus: 0, dMinus: 0 }, topNr) === 0);
  })();
  const best = promising[0] ?? null; // gardé pour compatibilité interne
  // Scénario affiché dans la Carte : celui que l'utilisateur y a "mis" (bouton dédié sur le
  // Front de Pareto / la liste de scénarios), sinon la recommandation Aura par défaut.
  const cardScenario = cardScenarioId ? (localSession.scenarios.find(s => s.id === cardScenarioId) ?? best) : best;
  const isCardOverridden = !!cardScenarioId && cardScenario?.id !== best?.id;
  // Garde scientifique : plusieurs scénarios au même rang Lo = non-discrimination.
  // Aura ne départage jamais arbitrairement — il l'affiche et montre ce qu'il faudrait apprendre.
  const isTie = promising.length > 1;

  useEffect(() => {
    if (!reco && session.scenarios.length > 0) autoReco();
  }, []);

  async function autoReco() {
    setGenerating(true);
    setAuraLoading(true);
    try {
      const { motivateRecommendation } = await import("../lib/v4/atelier-llm");
      const r = await motivateRecommendation({ data: {
        context: session.contextEnriched ?? session.contextRaw,
        scenarios: session.scenarios.map(s => {
          const nr = nodeResults[s.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
          return { label: s.label, potentiel: ORD_FULL[nr.gPlus], risque: ORD_FULL[nr.dMinus] };
        }),
        bestLabel: isTie ? `Non discriminés : ${promising.map(s => s.label).join(" / ")}` : (best?.label ?? "—"),
      }});
      setReco(r.recommendation);
      onUpdate({ auraRecommendation: r.recommendation });
      setAuraMsgs(prev => [...prev, { role: "aura" as const, text: `Analyse complète. Attitude ${session.attitude} appliquée.` }]);
    } catch {
      const nr = best ? nodeResults[best.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel } : { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
      const fallback = isTie
        ? `Les scénarios ${promising.map(s => `"${s.label}"`).join(" et ")} ne sont pas discriminés par le modèle et les connaissances disponibles à ce stade. Renseignez les impacts inconnus ou examinez l'onglet Écarts pour identifier ce qui pourrait les départager.`
        : `En attitude ${session.attitude}, le scénario "${best?.label}" présente le meilleur profil gain-risque parmi les alternatives analysées.`;
      setReco(fallback);
      onUpdate({ auraRecommendation: fallback });
    } finally {
      setGenerating(false);
      setAuraLoading(false);
    }
  }

  async function validate() {
    // La décision réellement actée est l'option retenue par l'utilisateur (cardScenario),
    // qui vaut la recommandation Aura (best) tant qu'aucun choix manuel n'a été fait.
    const retenu = cardScenario;
    if (!retenu) return;
    const id = `init-${Date.now()}`;
    const now = new Date().toISOString();
    saveInitiative({
      id, alertId: session.alertId ?? `atelier-${session.id}`,
      alertLabel: session.alertLabel ?? session.title,
      alertDomain: "Atelier",
      scenarioId: retenu.id, scenarioLabel: retenu.label,
      scenarioDescription: retenu.description,
      impact_eur: "—", levels: {},
      leviers: retenu.leviers.map(l => ({ label: l.label, valeur: l.valeur, impact: l.impact ?? "0", level: 50, scores: { cout: 50, delai: 50, qualite: 50, risque: 50, valeur: 50, faisabilite: 50 }, valeurDelta: 0, faisabiliteDelta: 0 })),
      validatedAt: now, status: "en_cours" as const,
      planChecked: retenu.leviers.map(() => false),
    });
    addNotification({
      type: "decision_validated",
      title: `Décision validée — ${retenu.label}`,
      body: `Scénario "${retenu.label}" retenu pour : ${session.title}`,
      alertId: session.alertId,
      data: {},
    });
    setValidated(true);
    if (okrData) {
      setConfirmOkrRegen(true);
    } else {
      generateOKRForDecision();
    }
  }

  // Les boutons "→ Suivi" doivent garantir que la décision est réellement
  // validée (Initiative sauvegardée, notification, OKR déclenchés) avant de
  // naviguer — auparavant certains ne faisaient que changer l'étape, sans
  // rien enregistrer, ce qui laissait croire à tort que la décision était
  // actée.
  async function goToSuivi() {
    if (!validated) await validate();
    onUpdate({ step: "suivi" });
  }

  async function generateOKRForDecision() {
    // Les OKR se déduisent de l'option retenue (cardScenario) — la recommandation Aura
    // (best) tant qu'aucun choix manuel n'a été documenté.
    const retenu = cardScenario;
    if (!retenu) return;
    setOkrLoading(true);
    setOkrError(null);
    try {
      const { generateOKR } = await import("../lib/v4/atelier-llm");
      const companyCtx = buildCompanyContext(getProfile());
      const atoutLabels = cardAtouts.map(a => a.leaf.label);
      const levierLabels = retenu.leviers.map(l => l.label);
      const result = await generateOKR({
        data: {
          decisionTitle: session.title,
          scenarioLabel: retenu.label,
          scenarioDescription: retenu.description ?? "",
          problemType: session.problemType ?? "Décision stratégique",
          atouts: atoutLabels,
          leviers: levierLabels,
          companyContext: companyCtx || undefined,
        },
      });
      setOkrData(result);
      saveOkrDataToStorage(session.id, result);
      const meta: OkrMeta = {
        scenarioId: retenu.id, scenarioLabel: retenu.label,
        validatedAt: new Date().toISOString(),
        criteriaSnapshot: snapshotCriteria(localSession.criteria),
        leviersHash: hashLeviers(localSession.leviersDef),
      };
      saveOkrMeta(session.id, meta);
      setOkrMeta(meta);
    } catch (e) {
      setOkrError((e as Error).message || "L'IA n'a pas pu générer de proposition — réessayez ou continuez manuellement");
    } finally {
      setOkrLoading(false);
    }
  }

  // Les OKR restent modifiables manuellement à tout moment, indépendamment
  // du mécanisme de dérive — l'édition ne le déclenche jamais elle-même.
  function updateOkrObjective(objId: string, patch: Partial<{ objective: string; horizon: string }>) {
    if (!okrData) return;
    const next = { ...okrData, objectives: okrData.objectives.map(o => o.id === objId ? { ...o, ...patch } : o) };
    setOkrData(next);
    saveOkrDataToStorage(session.id, next);
  }
  function updateOkrKeyResult(objId: string, krId: string, patch: Partial<{ label: string; kpi: string; baseline: string; target: string; deadline: string }>) {
    if (!okrData) return;
    const next = { ...okrData, objectives: okrData.objectives.map(o => o.id === objId ? { ...o, keyResults: o.keyResults.map(kr => kr.id === krId ? { ...kr, ...patch } : kr) } : o) };
    setOkrData(next);
    saveOkrDataToStorage(session.id, next);
  }

  // ── Helpers locaux ────────────────────────────────────────────────────────
  type CritPath = { ancestors: AtelierCriterion[]; leaf: AtelierCriterion };
  function getCritPaths(criteria: AtelierCriterion[], ancs: AtelierCriterion[] = []): CritPath[] {
    const out: CritPath[] = [];
    for (const c of criteria) {
      if (c.children?.length) out.push(...getCritPaths(c.children, [...ancs, c]));
      else out.push({ ancestors: ancs, leaf: c });
    }
    return out;
  }
  const critPaths = getCritPaths(localCriteria);

  const ORD_FULL: Record<number, string> = { 0: "Aucune", 1: "Faible", 2: "Modérée", 3: "Élevée" };
  const ORD_AXIS: Record<number, string> = { 0: "Aucune", 1: "Faible", 2: "Modérée", 3: "Élevée" };

  function impDisplay(imp: { gPlus: number; dMinus: number }) {
    if (imp.gPlus >= 2) return { short: "++", label: "Forte amélioration", color: "#059669", bg: "#d1fae5" };
    if (imp.gPlus === 1) return { short: "+",  label: "Amélioration",       color: "#10b981", bg: "#ecfdf5" };
    if (imp.dMinus >= 2) return { short: "--", label: "Forte détérioration",color: "#dc2626", bg: "#fee2e2" };
    if (imp.dMinus === 1) return { short: "−", label: "Dégradation",        color: "#f59e0b", bg: "#fef3c7" };
    return { short: "0", label: "Neutre", color: "#9ca3af", bg: "var(--v4-surface)" };
  }

  const MOE_COLORS = ["#6750a4", "#0369a1", "#b45309", "#0891b2", "#15803d"];
  const moeColorMap = new Map<string, string>();
  localCriteria.forEach((c, i) => moeColorMap.set(c.id, MOE_COLORS[i % MOE_COLORS.length]));

  const bestNr = best ? (nodeResults[best.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }) : null;

  // ── Objectif actif (« Partir de l'objectif ») — dérivé une seule fois ici et
  // réutilisé partout (carte décisionnelle, cascade backward, résumé des
  // scénarios) : une SEULE source de vérité pour goalTargets/goalTolerate,
  // jamais recalculée différemment d'un bloc à l'autre.
  const activeGoalTargets: [string, number][] = goalTargets
    ? Object.entries(goalTargets).filter(([, v]) => (v ?? -1) > 0)
    : [];
  const goalActive = activeGoalTargets.length > 0;
  const goalTolLevel = (goalTolerate ? 1 : 0) as OrdinalLevel;
  const goalCritById: Record<string, AtelierCriterion> = {};
  localCriteria.forEach(m => { goalCritById[m.id] = m; (m.children ?? []).forEach(mop => { goalCritById[mop.id] = mop; }); });
  const goalAttCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
  const goalProf: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
  const eligibleScenarioIds = new Set(
    goalActive
      ? localSession.scenarios.filter(sc =>
          activeGoalTargets.every(([critId, min]) => {
            const crit = goalCritById[critId];
            if (!crit) return true;
            const r = aggregateHierarchy(crit, sc, optionIndex, goalAttCode, goalProf);
            return r.gPlus >= min && r.dMinus <= goalTolLevel;
          })
        ).map(sc => sc.id)
      : []
  );
  // Cible « globale » utilisée pour la lecture backward de la cascade : le plus
  // exigeant des niveaux fixés parmi les MOE de premier niveau (les cibles MOP
  // restent gérées séparément par l'onglet dédié). Reste `null` si aucune MOE
  // de premier niveau n'a de cible — la cascade retombe alors sur son
  // comportement d'origine (seuil = résultat propre du scénario).
  const goalTopThreshold: OrdinalLevel | null = (() => {
    const topLevels = localCriteria
      .map(m => goalTargets?.[m.id])
      .filter((v): v is number => (v ?? -1) > 0);
    return topLevels.length ? (Math.max(...topLevels) as OrdinalLevel) : null;
  })();

  // ── Indicateur de noyade : le verdict global est-il porté par UN SEUL critère ?
  // Propriété assumée du min/max (le prudent autorise le veto), mais elle doit
  // être VISIBLE : une noyade silencieuse coûte la confiance du décideur.
  const drowning = (() => {
    if (!best || !bestNr || localCriteria.length < 2) return null;
    const ws = localCriteria.map(c => importanceToWeight(c.importance));
    const maxW = ws.length ? Math.max(...ws) : 3;
    const nw = thesisWeights(ws as OrdinalLevel[]);
    const cells = localCriteria.map((c, i) => ({
      c,
      g: Math.max(3 - nw[i], cellResults[best.id]?.[c.id]?.gPlus ?? 0), // max(¬ωᵢ, δ⁺ᵢ)
      d: Math.min(nw[i], cellResults[best.id]?.[c.id]?.dMinus ?? 0),    // min(ωᵢ, δ⁻ᵢ)
    }));
    const riskCarriers = bestNr.dMinus > 0 ? cells.filter(x => x.d === bestNr.dMinus) : [];
    const minG = Math.min(...cells.map(y => y.g));
    const gainCaps = cells.filter(x => x.g === minG);
    return {
      risk: riskCarriers.length === 1 ? riskCarriers[0].c.label : null,
      cap: bestNr.gPlus < 3 && gainCaps.length === 1 ? gainCaps[0].c.label : null,
    };
  })();

  // ── Jauge de complétude : le verdict vaut ce que valent les entrées ─────────
  const completeness = (() => {
    const leaves2 = getLeafCriteria(localCriteria);
    let filled = 0, unknown = 0, total = 0;
    for (const lev of localLeviersDef) for (const opt of lev.options) for (const lf of leaves2) {
      total++;
      const v = opt.impacts[lf.id];
      if (v === undefined || v === "U") unknown++; else filled++;
    }
    return { filled, unknown, total };
  })();

  // ── Robustesse à l'attitude : la recommandation tient-elle en Prudent ET en
  // Optimiste ? (même moteur, l'autre profil — aucun nouvel opérateur) ────────
  const attitudeRobust = (() => {
    if (!best || localSession.scenarios.length < 2) return null;
    const otherAt: Attitude = localSession.attitude === "Pessimiste" ? 2 : 1;
    const otherProf = localSession.attitude === "Pessimiste" ? "optimiste" as const : "prudent" as const;
    const weights = localCriteria.map(c => importanceToWeight(c.importance));
    const maxW = weights.length ? Math.max(...weights) : 3;
    const nw: OrdinalLevel[] = thesisWeights(weights);
    const results = localSession.scenarios.map(sc => {
      const stage1 = localCriteria.map(c => aggregateHierarchy(c, sc, optionIndex, otherAt, otherProf));
      try { return { sc, nr: aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], nw.length ? nw : [3]) }; }
      catch { return { sc, nr: { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel } }; }
    });
    results.sort((a, b) => loCompare(b.nr, a.nr));
    const top = results[0];
    const tie2 = results.filter(r => loCompare(r.nr, top.nr) === 0);
    return { stable: tie2.some(r => r.sc.id === best.id), otherLabel: localSession.attitude === "Pessimiste" ? "Optimiste" : "Prudente", otherBest: top.sc.label };
  })();

  // Atouts clés : TPM où le best scénario a gPlus >= 1
  const atouts = best ? critPaths
    .map(({ leaf }) => ({ leaf, imp: cellResults[best.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 } }))
    .filter(x => x.imp.gPlus >= 1)
    .sort((a, b) => b.imp.gPlus - a.imp.gPlus)
    .slice(0, 4) : [];

  // Points de vigilance : TPM où le best a dMinus >= 1
  const vigilance = best ? critPaths
    .map(({ leaf }) => ({ leaf, imp: cellResults[best.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 } }))
    .filter(x => x.imp.dMinus >= 1)
    .sort((a, b) => b.imp.dMinus - a.imp.dMinus)
    .slice(0, 3) : [];

  // Variantes "atouts/vigilance" pour le scénario actif de la Carte (peut différer de `best`
  // si l'utilisateur y a mis un autre scénario — cf. cardScenario plus haut).
  const cardNr = cardScenario ? (nodeResults[cardScenario.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }) : null;
  const cardAtouts = cardScenario ? critPaths
    .map(({ leaf }) => ({ leaf, imp: cellResults[cardScenario.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 } }))
    .filter(x => x.imp.gPlus >= 1)
    .sort((a, b) => b.imp.gPlus - a.imp.gPlus)
    .slice(0, 4) : [];
  const cardVigilance = cardScenario ? critPaths
    .map(({ leaf }) => ({ leaf, imp: cellResults[cardScenario.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 } }))
    .filter(x => x.imp.dMinus >= 1)
    .sort((a, b) => b.imp.dMinus - a.imp.dMinus)
    .slice(0, 3) : [];

  // Sensibilité : find TPM where rank-2 scenario does strictly better than best
  const rank2 = best ? ([...localSession.scenarios]
    .sort((a, b) => loCompare(nodeResults[b.id] ?? { gPlus: 0, dMinus: 0 }, nodeResults[a.id] ?? { gPlus: 0, dMinus: 0 }))
    .find(s => s.id !== best.id)) ?? null : null;

  const sensitivityRows = (best && rank2) ? critPaths
    .filter(({ leaf }) => {
      const bi = cellResults[best.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
      const r2i = cellResults[rank2.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
      return r2i.gPlus > bi.gPlus || r2i.dMinus < bi.dMinus;
    })
    .slice(0, 3)
    .map(({ leaf }) => {
      const bi = cellResults[best.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
      const r2i = cellResults[rank2.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
      const axis = r2i.gPlus > bi.gPlus ? "amélioration" : "risque réduit";
      return { leaf, axis, r2label: rank2.label };
    }) : [];

  // --- MOE Essentiel Screening (display-only — does NOT affect algorithm/ranking) ---
  // A scenario is "Inadmissible" if any Essentiel MOE has aggregate dMinus > gPlus + threshold.
  const moeEssentiels = localCriteria.filter(c => c.importance === "Essentiel");
  // Dépistage ordinal : un MOE Essentiel est bloquant si son agrégat Lo
  // (moteur, pas une moyenne) présente un risque strictement supérieur au gain.
  const inadmissibleMap = new Map<string, string[]>();
  for (const sc of localSession.scenarios) {
    const failing: string[] = [];
    for (const moe of moeEssentiels) {
      const r = cellResults[sc.id]?.[moe.id];
      if (r && r.dMinus > r.gPlus) failing.push(moe.label);
    }
    if (failing.length) inadmissibleMap.set(sc.id, failing);
  }


  // --- Orphan TPM detection: TPM leaves with no lever impact at all ---
  const allLeaves = getLeafCriteria(localCriteria);
  const orphanTPMs = allLeaves.filter(leaf =>
    !localSession.leviersDef.some(lev =>
      lev.options.some(opt => opt.impacts[leaf.id] && opt.impacts[leaf.id] !== "0" && opt.impacts[leaf.id] !== "U")
    )
  );

  // ── Le prochain renseignement à obtenir ─────────────────────────────────────
  // Pour chaque impact inconnu (U ou jamais renseigné) des scénarios de tête,
  // on simule sa résolution (hypothèse haute "++" vs basse "--") DANS LE MOTEUR
  // ORDINAL et on regarde si le rang Lo vis-à-vis du scénario concurrent change.
  // Si oui → ce renseignement est décisif : c'est lui qu'il faut instruire avant de décider.
  type InfoInsight = { sc: AtelierScenario; other: AtelierScenario; levLabel: string; optLabel: string; leaf: AtelierCriterion; origin?: ImpactOrigin; decisive: boolean };
  const nextInfo: InfoInsight[] = (() => {
    const topSet = isTie ? promising : ([best, rank2].filter(Boolean) as AtelierScenario[]);
    if (topSet.length < 2) return [];
    const attitudeCode: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
    const profile: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const simulate = (sc: AtelierScenario, optId: string, leafId: string, hyp: QualitativeImpact) => {
      const opt = optionIndex[optId];
      const patched = { ...optionIndex, [optId]: { ...opt, impacts: { ...opt.impacts, [leafId]: hyp } } };
      const stage1 = localCriteria.map(c => aggregateHierarchy(c, sc, patched, attitudeCode, profile));
      try { return aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], normWeights.length ? normWeights : [3]); }
      catch { return { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }; }
    };
    const out: InfoInsight[] = [];
    let budget = 24; // borne le nombre de simulations pour rester instantané
    for (const sc of topSet) {
      const other = topSet.find(o => o.id !== sc.id)!;
      for (const lev of sc.leviers) {
        const opt = optionIndex[lev.valeur];
        if (!opt) continue;
        for (const leaf of allLeaves) {
          const v = opt.impacts[leaf.id];
          if (v !== "U" && v !== undefined) continue;
          if (budget-- <= 0) { out.push({ sc, other, levLabel: lev.label, optLabel: opt.label, leaf, origin: opt.impactOrigins?.[leaf.id], decisive: false }); continue; }
          const otherNr = nodeResults[other.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
          const cmpPlus = loCompare(simulate(sc, opt.id, leaf.id, "++"), otherNr);
          const cmpMinus = loCompare(simulate(sc, opt.id, leaf.id, "--"), otherNr);
          const decisive = Math.sign(cmpPlus) !== Math.sign(cmpMinus);
          out.push({ sc, other, levLabel: lev.label, optLabel: opt.label, leaf, origin: opt.impactOrigins?.[leaf.id], decisive });
        }
      }
    }
    const impRank: Record<ImportanceBadge, number> = { Essentiel: 0, Important: 1, Secondaire: 2, Faible: 3 };
    return out
      .sort((a, b) => Number(b.decisive) - Number(a.decisive) || impRank[a.leaf.importance] - impRank[b.leaf.importance])
      .slice(0, 8);
  })();
  const auraProposedCount = localSession.leviersDef.reduce((n, lev) =>
    n + lev.options.reduce((m, o) => m + Object.keys(o.impactOrigins ?? {}).length, 0), 0);

  // ── Arbitrer à la voix : le scénario retenu et sa justification ──────────────
  const [arbCompanionOpen, setArbCompanionOpen] = useState(false);
  const arbitrerSteps: CompanionStep[] = [
    {
      id: "arb-choice", group: "Arbitrage",
      question: "Quel scénario retenez-vous ?",
      hint: session.scenarios.map(s => s.label).join(" · "),
      current: session.scenarios.find(s => s.id === session.tieBreak?.scenarioId)?.label,
      apply: t => {
        const q = t.toLowerCase();
        const hit = session.scenarios.find(s => q.includes(s.label.toLowerCase()))
          ?? session.scenarios.find(s => s.label.toLowerCase().split(/\s+/).some(w => w.length > 3 && q.includes(w)));
        if (hit) onUpdate({ tieBreak: { scenarioId: hit.id, rationale: session.tieBreak?.rationale ?? "", date: new Date().toISOString() } });
      },
    },
    {
      id: "arb-why", group: "Arbitrage",
      question: "Sur quoi fondez-vous cet arbitrage ?",
      hint: "Le critère qui a tranché, et ce que vous acceptez de céder.",
      current: session.tieBreak?.rationale,
      apply: t => {
        const v = t.trim(); if (!v) return;
        setTieRationale(v);
        const sid = session.tieBreak?.scenarioId ?? best?.id;
        if (sid) onUpdate({ tieBreak: { scenarioId: sid, rationale: v, date: new Date().toISOString() } });
      },
    },
    {
      id: "arb-reserve", group: "Arbitrage", optional: true,
      question: "Quelles réserves ou conditions posez-vous ?",
      hint: "Ce qui devrait faire rouvrir la décision.",
      apply: t => {
        const v = t.trim(); if (!v) return;
        const sid = session.tieBreak?.scenarioId ?? best?.id;
        const prev = session.tieBreak?.rationale ?? "";
        if (sid) onUpdate({ tieBreak: { scenarioId: sid, rationale: `${prev}${prev ? "\n" : ""}Réserve : ${v}`, date: new Date().toISOString() } });
      },
    },
  ];

  return (

    <div className="aura-expert-surface grid grid-cols-1 items-start gap-4">
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 0 }}>
      <CompagnonAura
        open={arbCompanionOpen}
        onClose={() => setArbCompanionOpen(false)}
        steps={arbitrerSteps}
        title="Arbitrer"
        contextPrompt="Arbitrage d'une décision : scénario retenu, critère décisif, concessions acceptées, réserves." />

      <div className="aura-expert-polish space-y-5">
      <style>{`
        .aura-expert-polish{padding:6px 4px 8px;background:radial-gradient(circle at 82% 0%,rgba(102,75,255,.07),transparent 25%)}
        .aura-expert-principles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));padding:16px 0}
        .aura-expert-principles>div{padding:0 18px}.aura-expert-principles>div+div{border-left:1px solid #e8e7f2}
        .aura-expert-principles span{display:block;font-size:12px;font-weight:850;letter-spacing:.12em;color:#7a5cff;text-transform:uppercase}
        .aura-expert-principles strong{display:block;margin-top:5px;font-size:13px;color:#17194f}.aura-expert-principles p{margin:3px 0 0;font-size:12px;line-height:1.45;color:#8185a6}
        @media(max-width:780px){.aura-expert-principles{grid-template-columns:1fr 1fr;row-gap:16px}.aura-expert-principles>div:nth-child(3){border-left:0}.aura-expert-principles>div{padding:0 12px}}
        .aura-expert-polish button{transition:background-color .15s ease, border-color .15s ease, color .15s ease, opacity .15s ease, box-shadow .15s ease, transform .1s ease}
        .aura-expert-polish [data-collapsible]{transition:background-color .15s ease}
        /* ── Échelle d'espacement unifiée (8/12/16/24) et traitement de carte
           cohérent avec la vue Executive — appliqués via classes utilitaires
           pour ne pas dupliquer les styles inline existants. ── */
        .aura-expert-polish{--e-1:8px;--e-2:12px;--e-3:16px;--e-4:24px}
        .aura-e-card{
          border:1px solid var(--v4-border);
          border-radius:8px;
          background:var(--v4-bg);
          box-shadow:0 2px 10px rgba(23,25,79,.04);
          transition:box-shadow .18s ease, border-color .18s ease, transform .12s ease;
        }
        .aura-e-card:hover{box-shadow:0 6px 18px rgba(23,25,79,.08)}
        .aura-e-heading{
          font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;
          color:var(--v4-text3);margin:0 0 6px;
        }
        .aura-e-fade{animation:aura-e-fadein .22s ease both}
        @keyframes aura-e-fadein{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:translateY(0)}}
        .aura-e-pill{transition:background-color .15s ease,color .15s ease,border-color .15s ease,transform .1s ease}
        .aura-e-pill:hover{transform:translateY(-1px)}
        .aura-e-secondary{color:var(--v4-text3);font-size:12.5px}
      `}</style>
      {/* ── Header : Exporter PDF / Partager / Valider vivent maintenant dans
          l'en-tête d'ArbitrageMinimal (prop `actions`, Zone 2 ci-dessous) —
          plus de ligne dédiée ici, la page démarre plus haut. ── */}

      <div style={{ display: "none", borderTop: "1px solid #e8e7f2", borderBottom: expertPrinciplesOpen ? "none" : "1px solid #e8e7f2" }}>
        <button data-collapsible onClick={() => setExpertPrinciplesOpen(o => !o)}
          style={{ width: "100%", textAlign: "left", padding: "8px 4px", background: "transparent", border: "none",
            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, letterSpacing: ".04em",
            color: "#7a5cff", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13.5 }}>{expertPrinciplesOpen ? "▾" : "▸"}</span> Principes de lecture experte
        </button>
        {expertPrinciplesOpen && (
          <section className="aura-expert-principles aura-e-fade" aria-label="Principes de lecture experte">
            <div><span>Espace de décision</span><strong>16 profils ordinaux</strong><p>Quatre niveaux d’amélioration croisés à quatre niveaux de dégradation.</p></div>
            <div><span>Lecture bipolaire</span><strong>δ+ et δ− séparés</strong><p>Un gain ne masque jamais une dégradation : aucune moyenne compensatoire.</p></div>
            <div><span>Premier filtre</span><strong>Frontière de Pareto</strong><p>Les options dominées s’effacent avant tout arbitrage de priorité.</p></div>
            <div><span>Verdict</span><strong>Puis ordre lexicographique</strong><p>Le potentiel prime, puis la maîtrise de la dégradation selon l’attitude.</p></div>
          </section>
        )}
      </div>

      {/* ── Le moment de fierté : décision documentée ── */}
      {recordExported && (
        <div style={{ borderRadius: 8, border: "1.5px solid #05966950", background: "#05966908", padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 16.5 }}>✓</span>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#065f46" }}>Votre décision est documentée.</div>
            <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 2 }}>
              Le Decision Record est prêt — partagez-le avec vos parties prenantes : il porte la décision, ses raisons, ses hypothèses et ce qui la ferait changer.
            </div>
          </div>
          <button onClick={printDecision} style={{ fontSize: 13, fontWeight: 700, padding: "6px 13px", borderRadius: 8, border: "1px solid #05966960", background: "transparent", color: "#065f46", cursor: "pointer", fontFamily: "inherit" }}>Rouvrir</button>
          <button onClick={() => goToSuivi()} style={{ fontSize: 13, fontWeight: 700, padding: "6px 13px", borderRadius: 8, border: "none", background: "#059669", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>Passer au Suivi →</button>
          <button onClick={() => setRecordExported(false)} style={{ fontSize: 13.5, border: "none", background: "none", color: "var(--v4-text3)", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
      )}

      {/* ── ZONE 1 : ancienne carte quadrant + "têtes de liste" — remplacée par le
          moteur unique de recommandation d'ArbitrageMinimal (Zone 2 ci-dessous).
          Masquée plutôt que supprimée pour ne prendre aucun risque sur l'équilibre
          JSX de ce fichier ; son contenu n'est plus maintenu. ── */}
      <div style={{ display: "none", flexWrap: "wrap", gap: 12, alignItems: "flex-start" }}>
        <style>{`.aura-z1-left{flex:1 1 460px;min-width:0}.aura-z1-right{flex:1 1 340px;max-width:100%}@media(min-width:1024px){.aura-z1-right{flex:0 0 380px}}`}</style>

      {/* ── LEFT COLUMN : Carte + Atouts/Vigilances ── */}
      <div className="aura-z1-left" style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── Carte décisionnelle qualitative — vue principale, toujours visible ── */}
      {session.scenarios.length >= 2 && (() => {
        // ── Géométrie : un TREILLIS, pas un plan continu ──────────────────────
        // L'échelle est ordinale : 4 niveaux × 4 niveaux = 16 profils, ni plus,
        // ni moins. On ne place donc plus les options sur des coordonnées
        // continues (qui suggèrent une distance inexistante, contraire à
        // l'axiome A3) mais AU CENTRE d'une case du treillis. Chaque case a la
        // même taille : aucune case n'est « deux fois » une autre.
        const W = 560, H = 372;
        const PAD = { top: 26, right: 22, bottom: 52, left: 74 };
        const innerW = W - PAD.left - PAD.right;
        const innerH = H - PAD.top - PAD.bottom;
        const cw = innerW / 4, ch = innerH / 4;
        // Orientation décideur : l'AMÉLIORATION monte (ordonnée), la
        // DÉGRADATION s'étend vers la droite (abscisse). La cible est donc le
        // coin HAUT-GAUCHE : « le plus haut possible, le plus à gauche
        // possible ». C'est la lecture spontanée d'un comité (« monter sans
        // dériver ») et elle évite l'axe inversé, source d'erreurs de lecture.
        function xPos(dm: number) { return PAD.left + (dm + 0.5) * cw; }
        function yPos(gp: number) { return PAD.top + innerH - (gp + 0.5) * ch; }
        const midX = PAD.left + innerW / 2;
        const midY = PAD.top + innerH / 2;


        // ── Palette exécutive : DEUX couleurs seulement ────────────────────────
        // Indigo = potentiel d'amélioration. Ambre = risque de dégradation.
        // Le feu tricolore (vert/rouge/bleu/jaune) noyait la lecture : un COMEX
        // doit voir en un coup d'œil « où c'est bon » (indigo) et « où ça coince »
        // (ambre), le reste en gris neutre. Aucun sens n'est ajouté ni retiré.
        const IND = "#6366f1", IND_DK = "#4338ca", AMB = "#b45309", AMB_L = "#f59e0b", NEU = "#9ca3af";
        // ── Zones de lecture : la PARTITION RÉELLE du treillis ─────────────────
        // Les quatre quadrants « moitié/moitié » mentaient : le quadrant
        // « prometteur mais risqué » (δ⁺ ≥ M et δ⁻ ≥ M) est vide par
        // construction — le moteur ne peut jamais y placer une option. On
        // partitionne donc sur ce que le moteur produit vraiment :
        //   Sans effet          : (0,0)                  → coin bas-gauche
        //   Apport net          : δ⁻ = 0 et δ⁺ > 0       → colonne de gauche
        //   Apport sous réserve : δ⁺ > 0 et δ⁻ > 0
        //   Exposition          : δ⁺ = 0 et δ⁻ > 0       → ligne du bas
        const quadrants = [
          { x: PAD.left,      y: PAD.top + innerH - ch, w: cw,     h: ch,     fill: "#f8fafc", label: "Sans effet",          labelColor: "#94a3b8", anchor: "start" as const, lx: PAD.left + 6,      ly: PAD.top + innerH - 6 },
          { x: PAD.left,      y: PAD.top,               w: cw,     h: 3 * ch, fill: "#eef0ff", label: "Apport net",          labelColor: IND_DK,    anchor: "start" as const, lx: PAD.left + 6,      ly: PAD.top + 13 },
          { x: PAD.left + cw, y: PAD.top,               w: 3 * cw, h: 3 * ch, fill: "#fbfaf6", label: "Apport sous réserve", labelColor: AMB,       anchor: "end" as const,   lx: W - PAD.right - 6, ly: PAD.top + 13 },
          { x: PAD.left + cw, y: PAD.top + innerH - ch, w: 3 * cw, h: ch,     fill: "#f4f3f1", label: "Exposition",          labelColor: "#a1a1aa", anchor: "end" as const,   lx: W - PAD.right - 6, ly: PAD.top + innerH - 6 },
        ];


        // ── Le graphique ne montre QUE des scénarios réellement composés par
        // l'utilisateur — jamais un argmax calculé sur un échantillon de
        // combinaisons auto-générées. C'est plus lent à explorer mais toujours
        // exact : chaque point est évalué directement par le moteur, sans
        // dépendre d'un échantillonnage de l'espace combinatoire qui peut
        // biaiser ou même contredire ce qu'on voit à l'écran. Le champ des
        // possibles (nuage de points + « meilleures solutions ici ») a été
        // retiré pour cette raison — l'énumération des combinaisons reste
        // utilisée ailleurs (Partir de l'objectif, Vue Chaîne) où c'est un
        // vrai calcul de recherche, pas un affichage de synthèse.
        const scWithNr = localSession.scenarios.map(sc => ({ sc, nr: nodeResults[sc.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel } }));
        const paretoSet = scWithNr.filter(({ sc: scA, nr: a }) =>
          !scWithNr.some(({ sc: scB, nr: b }) => scB.id !== scA.id && b.gPlus >= a.gPlus && b.dMinus <= a.dMinus && (b.gPlus > a.gPlus || b.dMinus < a.dMinus))
        );
        const paretoIds = new Set(paretoSet.map(p => p.sc.id));
        // Écart au front, en MARCHES du treillis : nombre minimal de crans
        // ordinaux (potentiel à gagner + risque à céder) séparant un profil de
        // la frontière. Ce n'est pas une distance : les marches se comptent, ne
        // se mesurent pas (axiome A3).
        function stepsToFront(nr: { gPlus: OrdinalLevel; dMinus: OrdinalLevel }) {
          return paretoSet.reduce((m, p) =>
            Math.min(m, Math.max(0, p.nr.gPlus - nr.gPlus) + Math.max(0, nr.dMinus - p.nr.dMinus)), 99);
        }

        // Escalier du front, lu de gauche à droite : on part du risque le plus
        // faible et on descend en amélioration à mesure que le risque monte.
        const paretoSorted = [...paretoSet].sort((a, b) => a.nr.dMinus - b.nr.dMinus || b.nr.gPlus - a.nr.gPlus);
        let paretoPath = "";
        if (paretoSorted.length >= 1) {
          const pts = paretoSorted.map(p => ({ x: xPos(p.nr.dMinus), y: yPos(p.nr.gPlus) }));
          paretoPath = `M ${PAD.left} ${pts[0].y}`;
          pts.forEach((pt, i) => { if (i > 0) paretoPath += ` V ${pt.y} H ${pt.x}`; else paretoPath += ` H ${pt.x}`; });
          paretoPath += ` V ${PAD.top + innerH}`;
        }

        const seen: Record<string, number> = {};

        function validateComboAsScenario() {
          if (!selectedCombo) return;
          const SC_COLORS = ["#6366f1","#0ea5e9","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"];
          const newSc: AtelierScenario = {
            id: `sc-combo-${Date.now()}`,
            label: `Combinaison optimale`,
            color: SC_COLORS[localSession.scenarios.length % SC_COLORS.length],
            description: `Combinaison identifiée parmi les ${allPossibleCombos.length} possibles.`,
            leviers: Object.entries(selectedCombo.combo).map(([lid, vid]) => {
              const levDef = localSession.leviersDef.find(l => l.id === lid);
              return { id: lid, label: levDef?.label ?? lid, valeur: vid, type: levDef?.type ?? "autre" as const };
            }),
            scores: {}, valeur: 0, faisabilite: 0,
          };
          onUpdate({ scenarios: [...localSession.scenarios, newSc] });
          setSelectedCombo(null);
        }

        // ── Éligibilité au regard de l'objectif courant (« Partir de l'objectif ») ──
        // activeGoalTargets / goalActive / eligibleScenarioIds sont calculés une
        // seule fois au niveau du composant (source unique de vérité), réutilisés
        // ici tels quels.
        const attCodeSc: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
        const profSc: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";

        // Projette une combinaison sur la Vue Chaîne : même mécanisme que le
        // marqueur "Votre configuration", pour un rendu visuel immédiat
        // (schéma Leviers→TPM→MOP→MOE→Décision) plutôt qu'une liste de texte.
        function applyComboToChaine(combo: Record<string, string>) {
          const next: Record<string, string> = {};
          for (const [levId, optId] of Object.entries(combo)) {
            const lev = localSession.leviersDef.find(l => l.id === levId);
            const opt = lev?.options.find(o => o.id === optId);
            if (lev && opt) next[levId] = opt.label;
          }
          setChaineSelectedOpts(next);
        }
        function openPointBrowser(gPlus: OrdinalLevel, dMinus: OrdinalLevel, exactTotal: number) {
          const { matches, scannedAll } = findCombosForOutcome(localSession.leviersDef, localCriteria, optionIndex, attCodeSc, profSc, gPlus, dMinus, 60);
          setPointBrowser({ gPlus, dMinus, exactTotal, matches, scannedAll, index: 0 });
          if (matches[0]) applyComboToChaine(matches[0].combo);
        }
        function browsePoint(delta: number) {
          setPointBrowser(prev => {
            if (!prev || prev.matches.length === 0) return prev;
            const index = (prev.index + delta + prev.matches.length) % prev.matches.length;
            applyComboToChaine(prev.matches[index].combo);
            return { ...prev, index };
          });
        }
        function browsePointRandom() {
          setPointBrowser(prev => {
            if (!prev || prev.matches.length < 2) return prev;
            let index = prev.index;
            while (index === prev.index) index = Math.floor(Math.random() * prev.matches.length);
            applyComboToChaine(prev.matches[index].combo);
            return { ...prev, index };
          });
        }

        // ── Détail par critère (fusionné) : pour chaque MOE, un mini graphe
        // « tornade/papillon » avec une barre bidirectionnelle par scénario —
        // même idiome visuel que TornadoBlock (D'où vient le verdict), mais
        // décliné par critère × scénario plutôt que par critère pour un seul
        // scénario. Rend visible LE critère précis qui fait gagner ou perdre
        // un scénario, sans jamais recourir à un score numérique/une jauge.
        const targetByIdCard: Record<string, number> = Object.fromEntries(activeGoalTargets);
        const critDetailRows = localCriteria.map(crit => {
          const cells = localSession.scenarios.map(sc => ({
            sc,
            r: aggregateHierarchy(crit, sc, optionIndex, attCodeSc, profSc),
          }));
          const target = goalActive ? targetByIdCard[crit.id] : undefined;
          return { crit, cells, target };
        });
        // Critère limitant par scénario (le « veto » qui plafonne son score global) —
        // calculé une fois par scénario sur l'ensemble des MOE de la carte.
        const limitingByScenario = new Map<string, string>();
        localSession.scenarios.forEach(sc => {
          const cells = localCriteria.map(crit => ({ crit, r: aggregateHierarchy(crit, sc, optionIndex, attCodeSc, profSc) }));
          if (!cells.length) return;
          let worst = cells[0];
          for (const c of cells.slice(1)) {
            if (c.r.gPlus < worst.r.gPlus || (c.r.gPlus === worst.r.gPlus && c.r.dMinus > worst.r.dMinus)) worst = c;
          }
          limitingByScenario.set(sc.id, worst.crit.id);
        });
        const BAR_MAX = 58; // demi-largeur max (px) de chaque côté du zéro

        return (
          <div className="aura-lattice-shell" style={{ border: "none", borderTop: "1px solid var(--v4-border)", borderRadius: 0, background: "transparent", overflow: "visible", boxShadow: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px 0", flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>Carte décisionnelle qualitative</div>
              <button onClick={() => setShowGoalPicker(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, border: `1px solid ${goalActive ? "var(--v4-text)" : "var(--v4-border)"}`, background: "transparent", color: goalActive ? "var(--v4-text)" : "var(--v4-text2)", fontSize: 13, fontWeight: goalActive ? 700 : 600, cursor: "pointer", fontFamily: "inherit" }}>
                {goalActive
                  ? ` ${eligibleScenarioIds.size} scénario${eligibleScenarioIds.size > 1 ? "s" : ""} gagnant${eligibleScenarioIds.size > 1 ? "s" : ""} pour cet objectif`
                  : " Fixer un objectif →"}
              </button>
              {/* Accès direct à l'exploration complète — la trouver ne doit pas
                  dépendre de l'ouverture du menu « ⋯ Options ». */}
              <button onClick={() => document.getElementById('arbitrer-synthese')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ◎ Partir de l'objectif →
              </button>
              <div style={{ marginLeft: "auto", position: "relative" }}>
                <button onClick={() => setShowCarteMenu(v => !v)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 9px", borderRadius: 6, border: "1px solid var(--v4-border)", background: showCarteMenu ? "var(--v4-accent)15" : "transparent", color: "var(--v4-text2)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ⋯ Options
                </button>
                {showCarteMenu && (
                  <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 5, minWidth: 240, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,.1)", padding: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                    <button onClick={() => { document.getElementById('arbitrer-synthese')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); setShowCarteMenu(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 6, border: "none", background: "transparent", color: "var(--v4-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      ◎ Réglage détaillé (MOP, blocages, leviers à débloquer)
                    </button>
                    {localCriteria.length >= 1 && (
                      <button onClick={() => { setShowSmallMultiples(v => !v); setShowCarteMenu(false); }}
                        style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 6, border: "none", background: showSmallMultiples ? "var(--v4-accent)15" : "transparent", color: showSmallMultiples ? "var(--v4-accent)" : "var(--v4-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                        {showSmallMultiples ? "✓" : "▶"} Détail par critère
                      </button>
                    )}
                    <div style={{ height: 1, background: "var(--v4-border)", margin: "2px 4px" }} />
                    <button onClick={() => { setShowLiveTweak(v => !v); setShowCarteMenu(false); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 9px", borderRadius: 6, border: "none", background: showLiveTweak ? "var(--v4-accent)15" : "transparent", color: showLiveTweak ? "var(--v4-accent)" : "var(--v4-text)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                      {showLiveTweak ? "✓" : ""} Ajuster poids & impacts en direct
                    </button>
                  </div>
                )}
              </div>
            </div>
            {showLiveTweak && (
              <div style={{ margin: "6px 12px 0", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)", overflow: "hidden" }}>
                <div style={{ display: "flex", borderBottom: "1px solid var(--v4-border)" }}>
                  {(["poids", "impacts"] as const).map(t => (
                    <button key={t} onClick={() => setLiveTweakTab(t)}
                      style={{ flex: 1, padding: "7px 10px", border: "none", background: liveTweakTab === t ? "var(--v4-surface)" : "transparent", color: liveTweakTab === t ? "var(--v4-accent)" : "var(--v4-text3)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", borderBottom: liveTweakTab === t ? "2px solid var(--v4-accent)" : "2px solid transparent" }}>
                      {t === "poids" ? " Poids des objectifs" : " Impacts des options"}
                    </button>
                  ))}
                </div>
                {liveTweakTab === "poids" ? (
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ fontSize: 12.5, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 2 }}>
                      Recalcul immédiat à chaque changement d'importance.
                    </div>
                    {localCriteria.map(crit => (
                      <div key={crit.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", flex: "1 1 160px" }}>{crit.label}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          {(["Secondaire", "Important", "Essentiel"] as ImportanceBadge[]).map(imp => (
                            <button key={imp} onClick={() => setLocalCritImportance(crit.id, imp)}
                              style={{ fontSize: 12.5, fontWeight: 700, padding: "3px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${crit.importance === imp ? "var(--v4-accent)" : "var(--v4-border)"}`, background: crit.importance === imp ? "var(--v4-accent)15" : "transparent", color: crit.importance === imp ? "var(--v4-accent)" : "var(--v4-text3)" }}>
                              {imp}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                    <div style={{ fontSize: 12.5, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 2 }}>
                      Cliquez une cellule pour faire tourner son impact ({IMPACT_CYCLE.join(" → ")}) — même mécanisme que l'étape Impacter, appliqué ici sans changer de page.
                    </div>
                    {localSession.leviersDef.map(lev => (
                      <div key={lev.id}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 4 }}>{lev.label}</div>
                        {lev.options.map(opt => (
                          <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, color: "var(--v4-text2)", minWidth: 110 }}>{opt.label}</span>
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                              {leafCriteria.map(lf => {
                                const val = (opt.impacts[lf.id] ?? "U") as QualitativeImpact;
                                const IMPACT_STYLE: Record<string, { bg: string; color: string }> = {
                                  "U": { bg: "#f5f3ff", color: "#8b5cf6" }, "0": { bg: "var(--v4-surface)", color: "#9ca3af" },
                                  "+": { bg: "#ecfdf5", color: "#10b981" }, "++": { bg: "#d1fae5", color: "#059669" },
                                  "-": { bg: "#fef3c7", color: "#f59e0b" }, "--": { bg: "#fee2e2", color: "#dc2626" },
                                };
                                const st = IMPACT_STYLE[val] ?? IMPACT_STYLE["0"];
                                return (
                                  <button key={lf.id} onClick={() => cycleLocalImpact(opt.id, lf.id)}
                                    title={lf.label}
                                    style={{ fontSize: 12.5, fontWeight: 800, padding: "2px 6px", borderRadius: 6, border: "none", background: st.bg, color: st.color, cursor: "pointer", fontFamily: "inherit", minWidth: 22 }}>
                                    {val}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {combosTruncated && <div role="alert" data-testid="space-refused" style={{ margin: "6px 12px 0", fontSize: 13, color: "#a85d0f" }}>Calcul refusé : {refusalText(combosTotal, localSession.leviersDef, EXHAUSTIVE_LIMIT)}</div>}
            {showGoalPicker && (
              <div style={{ margin: "6px 12px 0", padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic" }}>
                  Cible minimale par objectif — les scénarios ci-dessous et dans le résumé se marquent aussitôt comme gagnants ou non. Réglage détaillé (par dimension, blocages, leviers à débloquer) dans l'onglet <strong>Partir de l'objectif</strong>.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {localCriteria.map(m => {
                    const v = goalTargets?.[m.id] ?? -1;
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", flex: "1 1 160px" }}>{m.label}</span>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button onClick={() => setGoalTarget(m.id, -1)}
                            style={{ fontSize: 13, fontWeight: 700, padding: "2px 8px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", border: `1.5px solid ${v === -1 ? "var(--v4-text3)" : "var(--v4-border)"}`, background: v === -1 ? "var(--v4-surface2)" : "transparent", color: "var(--v4-text3)" }}>indifférent</button>
                          {([1, 2, 3] as OrdinalLevel[]).map(lvl => (
                            <button key={lvl} onClick={() => setGoalTarget(m.id, lvl)}
                              title={`Au moins ${["", "Faible", "Modérée", "Élevée"][lvl]}`}
                              style={{ padding: "2px 7px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 3, border: `1.5px solid ${v === lvl ? "var(--v4-accent)" : "var(--v4-border)"}`, background: v === lvl ? "var(--v4-accent)10" : "transparent" }}>
                              <OrdGlyph v={lvl} color={v === lvl ? "#6366f1" : "#9ca3af"} size={10} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: v === lvl ? "var(--v4-accent)" : "var(--v4-text3)" }}>≥ {["", "Faible", "Modérée", "Élevée"][lvl]}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {goalActive && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#059669" }}>
                    ✓ {eligibleScenarioIds.size} scénario{eligibleScenarioIds.size > 1 ? "s" : ""} gagnant{eligibleScenarioIds.size > 1 ? "s" : ""} sur {localSession.scenarios.length} — cercle pointillé vert ci-dessous.
                  </div>
                )}
              </div>
            )}
            <div style={{ padding: "3px 12px 0" }}>
              <span
                title="Le scénario recommandé est celui qui maximise le potentiel d'amélioration ; à potentiel égal, le risque le plus faible départage."
                style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: "#065f46", cursor: "help" }}>
                ★ Scénario recommandé
                <span style={{ fontWeight: 400, color: "var(--v4-text3)", fontStyle: "italic" }}>— potentiel maximal ; à égalité, risque le plus faible</span>
              </span>
            </div>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", padding: "6px 12px 12px" }}>
            <div style={{ flex: "1 1 460px", minWidth: 0 }}>
            {(() => {
              // ── Restitution refondue (BORA v1.0) ─────────────────────────────
              // Défauts corrigés : (1) faux continuum — les options flottaient sur
              // des coordonnées continues alors que seuls 16 profils existent ;
              // (2) empilement invisible — plusieurs options sur un même profil
              // étaient décalées par un jitter qui les sortait de leur case ;
              // (3) verdict non expliqué — le recommandé pouvait tomber en zone
              // « à éviter » sans que le motif (limite de l'espace d'options)
              // soit dit ; (4) densité des issues concurrente des options.
              // Aucun calcul du moteur n'est modifié : seule la lecture change.
              const scByCell = new Map<string, typeof scWithNr>();
              scWithNr.forEach(e => {
                const k = `${e.nr.gPlus},${e.nr.dMinus}`;
                const arr = scByCell.get(k) ?? [];
                arr.push(e); scByCell.set(k, arr);
              });
              const countByCell = new Map<string, number>(outcomeDist.cells.map(c => [`${c.gPlus},${c.dMinus}`, c.count]));
              const maxCount = Math.max(1, ...outcomeDist.cells.map(c => c.count));
              const lattice = ([0, 1, 2, 3] as OrdinalLevel[]).flatMap(g => ([0, 1, 2, 3] as OrdinalLevel[]).map(d => ({ g, d })));
              const bestNr = best ? nodeResults[best.id] : null;
              const trunc = (s: string, n = 15) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

              return (
                <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ fontFamily: "inherit", display: "block" }}>
                  <defs>
                    <clipPath id="chart-clip2"><rect x={PAD.left} y={PAD.top} width={innerW} height={innerH} /></clipPath>
                    <pattern id="aura-void" width={6} height={6} patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                      <line x1={0} y1={0} x2={0} y2={6} stroke="#0f172a" strokeOpacity={0.045} strokeWidth={2} />
                    </pattern>
                  </defs>

                  {/* Zones de lecture — aide à la lecture, jamais un calcul. */}
                  {quadrants.map((q, i) => <rect key={i} x={q.x} y={q.y} width={q.w} height={q.h} fill={q.fill} />)}
                  {quadrants.map((q, i) => (
                    <text key={`ql-${i}`} x={q.lx} y={q.ly} textAnchor={q.anchor} fontSize={12} fontWeight={800}
                      letterSpacing=".1em" fill={q.labelColor} opacity={0.85}>{q.label.toUpperCase()}</text>
                  ))}

                  {/* Front de dominance : la frontière au-delà de laquelle aucune
                      de vos options ne va — la seule ligne du graphique. */}
                  {paretoPath && <path d={`${paretoPath} H ${PAD.left} Z`} fill={IND} fillOpacity={0.05} clipPath="url(#chart-clip2)" />}
                  {paretoPath && <path d={paretoPath} fill="none" stroke={IND} strokeWidth={1.4} strokeDasharray="5 3" opacity={0.65} clipPath="url(#chart-clip2)" />}

                  {/* ── Les 16 cases du treillis ──────────────────────────────── */}
                  {lattice.map(({ g, d }) => {
                    const k = `${g},${d}`;
                    const occ = scByCell.get(k) ?? [];
                    const count = countByCell.get(k) ?? 0;
                    const x = PAD.left + d * cw, y = PAD.top + innerH - (g + 1) * ch;
                    const cx = xPos(d), cy = yPos(g);
                    const isActive = pointBrowser?.gPlus === g && pointBrowser?.dMinus === d;
                    const holdsBest = !!bestNr && bestNr.gPlus === g && bestNr.dMinus === d;
                    const unreachable = count === 0 && occ.length === 0;
                    return (
                      <g key={k} style={{ cursor: "pointer" }} onClick={() => openPointBrowser(g, d, count)}>
                        <title>{`Potentiel ${ORD_AXIS[g]} · risque ${ORD_AXIS[d]} — ${unreachable ? "profil possible qu'aucune combinaison n'atteint" : `${count.toLocaleString("fr-FR")} combinaison(s) y aboutissent`}${occ.length ? ` · ${occ.length} de vos options` : ""}`}</title>
                        <rect x={x + 2} y={y + 2} width={cw - 4} height={ch - 4} rx={9}
                          fill={unreachable ? "url(#aura-void)" : `${IND}${Math.round(6 + 16 * Math.sqrt(count / maxCount)).toString(16).padStart(2, "0")}`}
                          stroke={isActive ? IND : holdsBest ? IND_DK : "#0f172a12"}
                          strokeWidth={isActive || holdsBest ? 1.8 : 1}
                          strokeDasharray={unreachable && !isActive ? "3 3" : undefined} />
                        {/* Nombre de SOLUTIONS qui aboutissent à ce profil : pastille en
                            coin HAUT-droit (jamais bas-droit, où les libellés de scénarios
                            empilés et le « +N » finissent par la recouvrir dans une case
                            occupée) — la lecture reste possible même quand tout le reste
                            de la case est plein. */}
                        {count > 0 && (
                          <g style={{ pointerEvents: "none" }}>
                            <rect x={x + cw - 5 - Math.max(28, 12 + String(count).length * 7)} y={y + 7}
                              width={Math.max(28, 12 + String(count).length * 7)} height={18} rx={9}
                              fill="#ffffff" fillOpacity={0.95} stroke={IND} strokeOpacity={0.4} strokeWidth={1} />
                            <text x={x + cw - 12} y={y + 20} textAnchor="end" fontSize={11} fontWeight={800}
                              fill={IND_DK}>
                              {count >= 1000 ? `${Math.round(count / 100) / 10}k` : count}
                            </text>
                          </g>
                        )}

                        {/* Profil inatteignable : marqueur discret. Répéter un
                            libellé dans 14 cases saturerait la lecture — la
                            trame et le point creux suffisent, l'explication
                            arrive au survol et au clic. */}
                        {unreachable && (
                          <circle cx={cx} cy={cy} r={3.2} fill="none" stroke="#94a3b8" strokeWidth={1.1} opacity={0.7}
                            style={{ pointerEvents: "none" }} />
                        )}
                        {/* Options logées dans la case — empilées, jamais décalées
                            hors de leur profil. Quand la pastille de comptage occupe le
                            haut-droit (count > 0), le bloc de libellés descend d'autant
                            pour ne jamais s'y superposer. */}
                        {(() => { const blockCenter = count > 0 ? cy + 8 : cy; return occ.slice(0, 2).map((e, i) => {
                          const isBest = best?.id === e.sc.id;
                          const isPareto = paretoIds.has(e.sc.id);
                          const isIneligible = goalActive && !eligibleScenarioIds.has(e.sc.id);
                          const label = trunc(e.sc.label, occ.length > 1 ? 12 : 15);
                          // La pastille recommandée porte une étoile : on lui
                          // réserve la place, sinon le libellé passe dessous.
                          const pw = Math.min(cw - 8, 26 + label.length * 5.4 + (isBest ? 12 : 0));

                          const rows = Math.min(occ.length, 2);
                          const py = blockCenter - (rows * 20 + (rows - 1) * 3) / 2 + i * 23;
                          return (
                            <g key={e.sc.id} opacity={isIneligible ? 0.4 : 1}
                              onClick={(ev) => { ev.stopPropagation(); const cm: Record<string, string> = {}; e.sc.leviers.forEach(l => { cm[l.id] = l.valeur; }); setSelectedCombo({ combo: cm, gPlus: e.nr.gPlus, dMinus: e.nr.dMinus, isUserScenario: e.sc.label, scenarioId: e.sc.id }); }}>
                              <rect x={cx - pw / 2} y={py} width={pw} height={20} rx={10}
                                fill={isBest ? IND_DK : isPareto ? "#ffffff" : "#f1f5f9"}
                                stroke={isBest ? IND_DK : isPareto ? IND : "#cbd5e1"} strokeWidth={isPareto ? 1.5 : 1} />
                              <circle cx={cx - pw / 2 + 10} cy={py + 10} r={3.2} fill={isBest ? "#ffffff" : (e.sc.color ?? IND)} />
                              <text x={cx - pw / 2 + 17} y={py + 13.5} fontSize={12} fontWeight={isBest ? 800 : 700}
                                fill={isBest ? "#ffffff" : isPareto ? IND_DK : "#475569"} style={{ pointerEvents: "none" }}>{label}</text>
                              {isBest && <text x={cx + pw / 2 - 8} y={py + 14} textAnchor="middle" fontSize={12} fill="#ffffff" style={{ pointerEvents: "none" }}>★</text>}
                              {cardScenario?.id === e.sc.id && <rect x={cx - pw / 2 - 3} y={py - 3} width={pw + 6} height={26} rx={13} fill="none" stroke={IND} strokeWidth={1.4} strokeDasharray="2 2" />}
                              {goalActive && eligibleScenarioIds.has(e.sc.id) && (
                                <text x={cx - pw / 2 - 5} y={py + 14} textAnchor="end" fontSize={12} fontWeight={900} fill={IND_DK}>✓</text>
                              )}
                            </g>
                          );
                        }); })()}
                        {occ.length > 2 && (
                          <text x={cx} y={(count > 0 ? cy + 8 : cy) + 26} textAnchor="middle" fontSize={12} fontWeight={700} fill="#64748b"
                            style={{ pointerEvents: "none" }}>+{occ.length - 2} option{occ.length - 2 > 1 ? "s" : ""} même profil</text>
                        )}
                      </g>
                    );
                  })}

                  {/* Configuration en cours d'exploration (Vue Chaîne) */}
                  {chaineLiveNr && (
                    <g pointerEvents="none">
                      <circle cx={xPos(chaineLiveNr.dMinus)} cy={yPos(chaineLiveNr.gPlus)} r={ch / 2 - 6}
                        fill="none" stroke={IND} strokeWidth={2} strokeDasharray="4 3" opacity={0.8}
                        style={{ transition: "cx .3s ease, cy .3s ease" }} />
                    </g>
                  )}

                  {/* Axes : graduations ordinales au centre des cases. */}
                  <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} stroke="#0f172a26" strokeWidth={1.2} />
                  <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="#0f172a26" strokeWidth={1.2} />
                  {([0, 1, 2, 3] as OrdinalLevel[]).map(v => (
                    <text key={`ay-${v}`} x={PAD.left - 8} y={yPos(v) + 3.5} textAnchor="end" fontSize={12} fontWeight={600} fill="#64748b">{ORD_AXIS[v]}</text>
                  ))}
                  {([0, 1, 2, 3] as OrdinalLevel[]).map(v => (
                    <text key={`ax-${v}`} x={xPos(v)} y={PAD.top + innerH + 15} textAnchor="middle" fontSize={12} fontWeight={600} fill="#64748b">{ORD_AXIS[v]}</text>
                  ))}
                  <text x={14} y={PAD.top + innerH / 2} textAnchor="middle" fontSize={12} fill={IND_DK} fontWeight={800}
                    letterSpacing=".04em" transform={`rotate(-90,14,${PAD.top + innerH / 2})`}>Amélioration ↑</text>
                  <text x={PAD.left + innerW / 2} y={H - 6} textAnchor="middle" fontSize={12} fill={AMB} fontWeight={800} letterSpacing=".04em">Dégradation →</text>
                  {/* Repère de lecture : où est la cible, dit une fois pour toutes. */}
                  <text x={W - PAD.right} y={PAD.top - 10} textAnchor="end" fontSize={12} fontWeight={800} letterSpacing=".08em" fill={IND_DK} opacity={0.55}>CIBLE ◤ HAUT-GAUCHE</text>
                  <text x={PAD.left} y={PAD.top - 10} fontSize={12} fontWeight={800} letterSpacing=".1em" fill="#94a3b8">
                    {outcomeDist.rawTotal > 0
                      ? `${outcomeDist.rawTotal.toLocaleString("fr-FR")} COMBINAISONS → ${outcomeDist.cells.length} PROFIL${outcomeDist.cells.length > 1 ? "S" : ""} ATTEINT${outcomeDist.cells.length > 1 ? "S" : ""} SUR 16`
                      : `TREILLIS ORDINAL — 16 PROFILS, ${scByCell.size} OCCUPÉ${scByCell.size > 1 ? "S" : ""} PAR VOS OPTIONS`}
                  </text>

                </svg>
              );
            })()}

            {/* ── Lecture du verdict : ce que la carte dit, en une phrase ────── */}
            {best && (() => {
              const bn = nodeResults[best.id];
              if (!bn) return null;
              const risky = bn.dMinus >= 2;
              const safer = paretoSet.filter(p => p.sc.id !== best.id && p.nr.dMinus < bn.dMinus)
                .sort((a, b) => a.nr.dMinus - b.nr.dMinus)[0];
              // Les deux verdicts n'ont pas le même critère : la frontière est
              // une dominance de Pareto (aucune option meilleure sur les deux
              // pôles) ; la recommandation est lexicographique (le potentiel
              // prime). Quand ils divergent, il faut le dire — sinon la carte
              // paraît se contredire.
              const bestIsPareto = paretoIds.has(best.id);
              const otherPareto = paretoSet.filter(p => p.sc.id !== best.id);
              // Critère qui annule le potentiel (argument du min de l'Éq. 9) :
              // l'information la plus actionnable de toute la carte.
              const limCrit = bn.gPlus === 0
                ? localCriteria.find(c => c.id === limitingByScenario.get(best.id))
                : undefined;
              const limR = limCrit ? aggregateHierarchy(limCrit, best, optionIndex, attCodeSc, profSc) : undefined;
              return (
                <div style={{ marginTop: "var(--e-2)", borderRadius: 0, borderLeft: risky ? "2px solid var(--v4-accent)" : "2px solid var(--v4-border)", background: "transparent", padding: "var(--e-2) var(--e-3)", boxShadow: "none" }}>
                  <div className="aura-e-heading" style={{ marginBottom: 4 }}>Lecture du verdict</div>
                  <div style={{ fontSize: 13.5, color: "var(--v4-text)", marginTop: 4, lineHeight: 1.55, fontWeight: 500 }}>
                    <strong>{best.label}</strong> — potentiel {ORD_FULL[bn.gPlus]}, risque {ORD_FULL[bn.dMinus]}.
                    {" "}{paretoSet.length === 1
                      ? "Elle domine toutes les autres options."
                      : `${paretoSet.length} options non dominées : le potentiel prime, puis le risque.`}
                  </div>
                  {limCrit && limR && (
                    <div style={{ fontSize: 13, color: AMB, marginTop: 5, lineHeight: 1.5 }}>
                      Potentiel plafonné par <strong>« {limCrit.label} »</strong> — c'est là qu'il faut agir.
                    </div>
                  )}
                  {!bestIsPareto && otherPareto[0] && (
                    <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 5, lineHeight: 1.5 }}>
                      « {otherPareto[0].sc.label} » est sur le front, mais le potentiel passe avant le risque.
                    </div>
                  )}
                  {risky && (
                    <div style={{ fontSize: 13, color: AMB, marginTop: 5, lineHeight: 1.5 }}>
                      Zone exposée. {safer
                        ? <>« {safer.sc.label} » réduit le risque à {ORD_FULL[safer.nr.dMinus]} mais perd du potentiel : l'arbitrage vous revient.</>
                        : <>Aucune option ne fait mieux sur le risque : il faut le couvrir.</>}
                    </div>
                  )}

                </div>
              );
            })()}

            {/* ── Explicabilité : les trois choses qu'un comité demande toujours ──
                (1) le critère PIVOT — celui qui départage réellement le
                recommandé de son challenger ; (2) le SEUIL DE BASCULE — ce qui
                devrait changer pour que le verdict change ; (3) l'ÉCART AU FRONT
                — en marches du treillis, jamais en distance métrique (axiome A3 :
                une marche n'a pas de longueur, elle a un sens). */}
            {best && (() => {
              const bn = nodeResults[best.id];
              if (!bn) return null;
              const impR: Record<string, number> = { Essentiel: 0, Important: 1, Secondaire: 2, Faible: 3 };
              const chal = scWithNr.filter(e => e.sc.id !== best.id)
                .sort((a, b) => loCompare(b.nr, a.nr))[0];
              const pivot = chal ? localCriteria
                .map(c => ({
                  c,
                  a: aggregateHierarchy(c, best, optionIndex, attCodeSc, profSc),
                  b: aggregateHierarchy(c, chal.sc, optionIndex, attCodeSc, profSc),
                }))
                .filter(r => r.a.gPlus !== r.b.gPlus || r.a.dMinus !== r.b.dMinus)
                .sort((x, y) => (impR[x.c.importance ?? "Secondaire"] ?? 2) - (impR[y.c.importance ?? "Secondaire"] ?? 2))[0] : undefined;
              const flip = chal
                ? (chal.nr.gPlus < bn.gPlus
                  ? <>si <strong>{chal.sc.label}</strong> atteignait un potentiel {ORD_FULL[bn.gPlus]} (aujourd'hui {ORD_FULL[chal.nr.gPlus]}), le verdict basculerait.</>
                  : chal.nr.dMinus > bn.dMinus
                    ? <>si le risque de <strong>{chal.sc.label}</strong> redescendait à {ORD_FULL[bn.dMinus]} (aujourd'hui {ORD_FULL[chal.nr.dMinus]}), le verdict basculerait.</>
                    : <>aucun changement d'un seul cran ne fait basculer le verdict : il est stable.</>)
                : null;
              return (
                <div style={{ marginTop: 8, borderRadius: 8, border: "none", background: "#faf9ff", padding: "10px 14px" }}>
                  <button onClick={() => setWhyVerdictOpen(v => !v)}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 800, color: IND_DK }}>
                    {whyVerdictOpen ? "▾" : "▸"} Pourquoi ce verdict ?
                  </button>
                  {whyVerdictOpen && (
                  <div style={{ marginTop: 8, display: "grid", gap: 8, gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))" }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--v4-text3)" }}>Critère pivot</div>
                    <div style={{ fontSize: 13, color: "var(--v4-text)", marginTop: 4, lineHeight: 1.5 }}>
                      {pivot
                        ? <>« <strong>{pivot.c.label}</strong> » — c'est ce critère qui tranche.</>
                        : <>Aucun critère ne sépare les options.</>}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--v4-text3)" }}>Seuil de bascule</div>
                    <div style={{ fontSize: 13, color: AMB, marginTop: 4, lineHeight: 1.5 }}>{flip ?? "—"}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--v4-text3)" }}>Écart au front</div>
                    <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 4, lineHeight: 1.5 }}>
                      {paretoIds.has(best.id)
                        ? <>{best.label} est <strong>sur le front</strong>.</>
                        : <>{best.label} est à <strong>{stepsToFront(bn)} marche(s)</strong> du front.</>}
                    </div>
                  </div>
                  </div>
                  )}
                </div>
              );
            })()}


            {/* ── Histogramme par solution, dépliable ───────────────────────────
                Une ligne par solution (ensemble d'options sur les leviers), deux
                barres SEGMENTÉES en crans : potentiel à gauche, risque à droite.
                Segments, jamais une longueur continue — la barre compte des crans,
                elle ne mesure pas.
                Zoom : « ⌄ » déplie le résultat global vers ses Objectifs, puis
                Dimensions, puis Indicateurs — les mêmes libellés que Comprendre,
                Impacter et Composer. Chaque niveau est recalculé par le moteur
                (remontée ordinale), jamais moyenné.
                Cliquer le libellé sélectionne la solution : elle est cerclée sur
                le treillis ci-dessus. */}
            <div style={{ marginTop: 10, borderRadius: 0, borderTop: "1px solid var(--v4-border)", background: "transparent", boxShadow: "none", padding: "12px 0 0" }}>
              <button onClick={() => setResultatOpen(v => !v)}
                style={{ display: "flex", width: "100%", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: resultatOpen ? 8 : 0, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: IND_DK }}>{resultatOpen ? "▾" : "▸"} Résultat par solution</span>
                <span style={{ fontSize: 13, color: "var(--v4-text3)" }}>
                  {resultatOpen ? "Cliquez un nom pour le situer sur la carte · « ⌄ » pour détailler" : `${localSession.scenarios.length} solution${localSession.scenarios.length > 1 ? "s" : ""} — détail chiffré par critère`}
                </span>
              </button>
              {resultatOpen && <>
              {/* Légende permanente, alignée sur les barres : trois crans, jamais une mesure continue. */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 6px 6px", borderBottom: "1px solid var(--v4-border)", marginBottom: 6 }}>
                <span style={{ width: 16, flex: "0 0 auto" }} />
                <span style={{ width: 6, flex: "0 0 auto" }} />
                <span style={{ flex: "1 1 110px", minWidth: 0, fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--v4-text3)" }}>Solution</span>
                <span style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>
                  {["Faible", "Modérée", "Élevée"].map(l => (
                    <span key={l} style={{ width: 26, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--v4-text3)" }}>{l}</span>
                  ))}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: IND_DK, flex: "0 0 auto", minWidth: 52 }}>Potentiel δ⁺</span>
                <span style={{ display: "flex", gap: 3, flex: "0 0 auto" }}>
                  {["Faible", "Modérée", "Élevée"].map(l => (
                    <span key={l} style={{ width: 26, textAlign: "center", fontSize: 12, fontWeight: 700, color: "var(--v4-text3)" }}>{l}</span>
                  ))}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 800, color: AMB, flex: "0 0 auto", minWidth: 52 }}>Risque δ⁻</span>
              </div>
              {(() => {
                // Une ligne générique : barres segmentées + libellé + chevron.
                const Bars = ({ nr }: { nr: { gPlus: number; dMinus: number } }) => (
                  <>
                    <span style={{ display: "flex", gap: 3, flex: "0 0 auto" }} title={`Potentiel ${ORD_FULL[nr.gPlus]}`}>
                      {[1, 2, 3].map(i => (
                        <span key={i} style={{ width: 26, height: 14, borderRadius: 6, background: nr.gPlus >= i ? IND : "#e5e7eb" }} />
                      ))}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: IND_DK, flex: "0 0 auto", minWidth: 52 }}>{ORD_FULL[nr.gPlus]}</span>
                    <span style={{ display: "flex", gap: 3, flex: "0 0 auto" }} title={`Risque ${ORD_FULL[nr.dMinus]}`}>
                      {[1, 2, 3].map(i => (
                        <span key={i} style={{ width: 26, height: 14, borderRadius: 6, background: nr.dMinus >= i ? AMB_L : "#e5e7eb" }} />
                      ))}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: AMB, flex: "0 0 auto", minWidth: 52 }}>{ORD_FULL[nr.dMinus]}</span>
                  </>
                );


                // Descente récursive dans la hiérarchie du modèle.
                const renderCrit = (sc: AtelierScenario, crit: AtelierCriterion, depth: number): React.ReactNode => {
                  const r = aggregateHierarchy(crit, sc, optionIndex, attCodeSc, profSc);
                  const kids = crit.children ?? [];
                  const key = `${sc.id}:${crit.id}`;
                  const open = histoOpen.has(key);
                  const badge = LEVEL_BADGE[crit.level ?? "MOE"] ?? LEVEL_BADGE.MOE;
                  return (
                    <div key={key}>
                      <div style={{
                        display: "flex", alignItems: "center", gap: 8, padding: "3px 6px",
                        marginLeft: 12 + depth * 14, borderLeft: "1px solid var(--v4-border)", paddingLeft: 8,
                      }}>
                        <button onClick={() => kids.length && toggleHisto(key)}
                          aria-label={open ? "Replier" : "Déplier"}
                          style={{
                            width: 15, height: 15, flex: "0 0 auto", borderRadius: 6, cursor: kids.length ? "pointer" : "default",
                            border: "none", background: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 800,
                            color: kids.length ? IND : "transparent",
                          }}>{open ? "⌃" : "⌄"}</button>
                        <span style={{
                          flex: "0 0 auto", fontSize: 12, fontWeight: 800, padding: "1px 5px", borderRadius: 6,
                          background: badge.bg, color: badge.color,
                        }}>{badge.label}</span>
                        <span style={{ flex: "1 1 90px", minWidth: 0, fontSize: 13, color: "var(--v4-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {crit.label}{crit.importance ? ` · ${crit.importance}` : ""}
                        </span>
                        <Bars nr={r} />
                      </div>
                      {open && kids.map(k => renderCrit(sc, k, depth + 1))}
                    </div>
                  );
                };

                return [...scWithNr]
                  .sort((a, b) => loCompare(b.nr, a.nr))
                  .map(({ sc, nr }) => {
                    const sel = cardScenarioId === sc.id;
                    const isBest = best?.id === sc.id;
                    const open = histoOpen.has(sc.id);
                    return (
                      <div key={sc.id} style={{
                        marginBottom: 3, borderRadius: 8,
                        border: sel ? `1.5px solid ${IND}` : "1px solid transparent",
                        background: sel ? `${IND}0e` : "transparent",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px" }}>
                          <button onClick={() => toggleHisto(sc.id)}
                            aria-label={open ? "Replier le détail" : "Détailler par Objectif"}
                            title={open ? "Replier" : "Détailler : Objectifs → Dimensions → Indicateurs"}
                            style={{
                              width: 16, height: 16, flex: "0 0 auto", border: `1px solid ${IND}55`, borderRadius: 6,
                              background: open ? `${IND}18` : "transparent", color: IND, cursor: "pointer",
                              fontFamily: "inherit", fontSize: 12.5, fontWeight: 800, lineHeight: 1,
                            }}>{open ? "⌃" : "⌄"}</button>
                          <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.color ?? IND, flex: "0 0 auto" }} />
                          <button onClick={() => setCardScenarioId(sel ? null : sc.id)}
                            style={{
                              flex: "1 1 110px", minWidth: 0, textAlign: "left", border: "none", background: "none",
                              padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                              fontWeight: isBest ? 800 : 600, color: "var(--v4-text)",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{isBest ? "★ " : ""}{sc.label}</button>
                          <Bars nr={nr} />
                          {paretoIds.has(sc.id) && (
                            <span style={{ fontSize: 12.5, fontWeight: 800, color: IND, border: `1px solid ${IND}`, borderRadius: 999, padding: "1px 5px", flex: "0 0 auto" }}>front</span>
                          )}
                        </div>
                        {open && (
                          <div style={{ paddingBottom: 5 }}>
                            {localCriteria.map(c => renderCrit(sc, c, 0))}
                          </div>
                        )}
                      </div>
                    );
                  });
              })()}
              <div style={{ display: "flex", gap: 12, marginTop: 6, fontSize: 13, color: "var(--v4-text3)", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 10, borderRadius: 6, background: IND }} /> Potentiel δ⁺</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 10, borderRadius: 6, background: AMB_L }} /> Risque δ⁻</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 14, height: 10, borderRadius: 6, background: "#e5e7eb" }} /> cran non atteint</span>
                <span>Cible : barres indigo longues, barres ambre courtes.</span>
              </div>
              </>}
            </div>

            {/* ── « Il existe mieux » — l'utilisateur compose ce qu'il veut, mais
                  il voit ce que l'espace des possibles contient de strictement
                  meilleur. Aucune nouveauté théorique : même moteur (remontée
                  ordinale bipolaire), même ordre de comparaison (loCompare), même
                  espace déjà énuméré (allPossibleCombos). On ne trie jamais par
                  score : on ne retient QUE ce qui est strictement supérieur dans
                  l'ordre du moteur — un dominé ne remonte jamais par compensation.
                  Et on dit quel impact doit bouger : les leviers à changer, puis
                  les objectifs qui gagnent (δ⁺ ↑ ou δ⁻ ↓), jamais un écart chiffré. */}
            {allPossibleCombos.length > 1 && (
              <div style={{ marginTop: 10, borderRadius: 8, border: `1px solid ${IND}44`, background: `${IND}07`, padding: "10px 12px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase", color: IND_DK }}><Q keywords={["mieux"]}>Il existe mieux ?</Q></div>
                  <span style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>
                    {allPossibleCombos.length} solutions explorées
                  </span>

                </div>
                {(() => {
                  const optLabel = (levId: string, optId: string) =>
                    localLeviersDef.find(l => l.id === levId)?.options.find(o => o.id === optId)?.label ?? optId;
                  const levLabel = (levId: string) => localLeviersDef.find(l => l.id === levId)?.label ?? levId;

                  return [...scWithNr]
                    .sort((a, b) => loCompare(b.nr, a.nr))
                    .map(({ sc, nr }) => {
                      const own: Record<string, string> = {};
                      for (const l of sc.leviers) own[l.id] = l.valeur;
                      const ownKey = JSON.stringify(own);
                      // Strictement meilleures, au sens du moteur uniquement.
                      const better = allPossibleCombos.filter(p =>
                        JSON.stringify(p.combo) !== ownKey && loCompare(p, nr) > 0);
                      if (!better.length) {
                        return (
                          <div key={sc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 6px", fontSize: 13 }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.color ?? IND, flex: "0 0 auto" }} />
                            <span style={{ flex: "1 1 auto", minWidth: 0, fontWeight: 600, color: "var(--v4-text)" }}>{sc.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: "#059669" }}>Rien de mieux dans l'espace exploré</span>
                          </div>
                        );
                      }
                      // Le meilleur au sens du moteur ; à égalité, celui qui demande
                      // le MOINS de changements de leviers (moindre coût de bascule).
                      const diffCount = (c: Record<string, string>) =>
                        Object.keys(c).filter(k => c[k] !== own[k]).length;
                      const top = [...better].sort((a, b) => loCompare(b, a) || diffCount(a.combo) - diffCount(b.combo))[0];
                      const changes = Object.keys(top.combo)
                        .filter(k => top.combo[k] !== own[k])
                        .map(k => ({ lev: levLabel(k), from: own[k] ? optLabel(k, own[k]) : "—", to: optLabel(k, top.combo[k]) }));
                      // Quels impacts bougent : par objectif, δ⁺ gagné ou δ⁻ relâché.
                      const pseudoSc: AtelierScenario = {
                        id: "_better", label: "", color: "", description: "",
                        leviers: Object.entries(top.combo).map(([lid, vid]) => ({ id: lid, label: lid, valeur: vid, type: "autre" as const })),
                        scores: {}, valeur: 0, faisabilite: 0,
                      };
                      const moved = localCriteria.map(c => {
                        const a = aggregateHierarchy(c, sc, optionIndex, attCodeSc, profSc);
                        const b = aggregateHierarchy(c, pseudoSc, optionIndex, attCodeSc, profSc);
                        return { c, a, b };
                      }).filter(x => x.b.gPlus > x.a.gPlus || x.b.dMinus < x.a.dMinus);
                      return (
                        <div key={sc.id} style={{ marginBottom: 6, padding: "7px 8px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: sc.color ?? IND, flex: "0 0 auto" }} />
                            <span style={{ flex: "1 1 120px", minWidth: 0, fontSize: 13, fontWeight: 600, color: "var(--v4-text)" }}>{sc.label}</span>
                            <span style={{ fontSize: 13, fontWeight: 800, color: AMB }}>
                              {better.length} solution{better.length > 1 ? "s" : ""} strictement meilleure{better.length > 1 ? "s" : ""}
                            </span>
                            <button onClick={() => { setAppliedCombo(top.combo); document.getElementById('arbitrer-synthese')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
                              style={{
                                flex: "0 0 auto", padding: "3px 9px", borderRadius: 999, cursor: "pointer", fontFamily: "inherit",
                                fontSize: 13, fontWeight: 800, border: `1px solid ${IND}`, background: IND, color: "#fff",
                              }}>Voir la meilleure</button>
                          </div>
                          <div style={{ marginTop: 5, fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.55 }}>
                            <strong>Passer de</strong> potentiel {ORD_FULL[nr.gPlus]} / risque {ORD_FULL[nr.dMinus]}{" "}
                            <strong>à</strong> potentiel {ORD_FULL[top.gPlus]} / risque {ORD_FULL[top.dMinus]} demande{" "}
                            {changes.length ? changes.map((c, i) => (
                              <span key={c.lev + i}>
                                {i > 0 ? " · " : ""}<strong>{c.lev}</strong> : {c.from} → {c.to}
                              </span>
                            )) : "aucun changement de levier"}.
                          </div>
                          {moved.length > 0 && (
                            <div style={{ marginTop: 3, fontSize: 13, color: "var(--v4-text3)" }}>
                              Impacts qui bougent : {moved.map((m, i) => (
                                <span key={m.c.id}>
                                  {i > 0 ? " · " : ""}<strong>{m.c.label}</strong>{" "}
                                  {m.b.gPlus > m.a.gPlus ? `potentiel ${ORD_FULL[m.a.gPlus]} → ${ORD_FULL[m.b.gPlus]}` : ""}
                                  {m.b.gPlus > m.a.gPlus && m.b.dMinus < m.a.dMinus ? ", " : ""}
                                  {m.b.dMinus < m.a.dMinus ? `risque ${ORD_FULL[m.a.dMinus]} → ${ORD_FULL[m.b.dMinus]}` : ""}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    });
                })()}
                <button onClick={() => document.getElementById('arbitrer-synthese')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{ marginTop: 4, background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: IND_DK }}>
                  ◎ Partir d'un objectif →
                </button>

              </div>
            )}






            {/* Légende — trois statuts, une seule couleur d'accent. */}
            <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: IND_DK, fontWeight: 800 }}>
                <svg width={22} height={12}><rect x={0.7} y={0.7} width={20.6} height={10.6} rx={5.3} fill={IND_DK} /></svg>
                Recommandé
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: IND, fontWeight: 700 }}>
                <svg width={22} height={12}><rect x={0.7} y={0.7} width={20.6} height={10.6} rx={5.3} fill="#fff" stroke={IND} strokeWidth={1.4} /></svg>
                Non dominé
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748b" }}>
                <svg width={22} height={12}><rect x={0.7} y={0.7} width={20.6} height={10.6} rx={5.3} fill="#f1f5f9" stroke="#cbd5e1" /></svg>
                Dominé
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "#64748b" }}>
                <svg width={16} height={8}><line x1={0} y1={4} x2={16} y2={4} stroke={IND} strokeWidth={1.5} strokeDasharray="4 2" /></svg>
                Frontière de dominance
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v4-text3)" }}>
                <svg width={14} height={12}><rect x={0.5} y={0.5} width={13} height={11} rx={3} fill="none" stroke="#94a3b8" strokeDasharray="3 3" /></svg>
                Profil hors de portée
              </div>
              {outcomeDist.rawTotal > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, color: "var(--v4-text3)" }}>
                  <svg width={14} height={12}><rect x={0.5} y={0.5} width={13} height={11} rx={3} fill={IND} opacity={0.16} /></svg>
                  {outcomeDist.done ? "Densité des issues possibles (chiffre en coin de case)" : "Calcul exact en cours…"}
                </div>
              )}
            </div>
            <div style={{ marginTop: 4 }}>
              <button onClick={() => setMapHelpOpen(v => !v)}
                style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "var(--v4-text3)" }}>
                {mapHelpOpen ? "▾" : "▸"} Comment lire cette carte
              </button>
              {mapHelpOpen && (
                <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 4, lineHeight: 1.5 }}>
                  4 crans (Aucune · Faible · Modérée · Élevée) sur chaque pôle : 16 profils. Aucune distance, aucune moyenne. Le chiffre en coin de case = nombre de solutions qui y aboutissent ; cliquez pour les parcourir.
                </div>
              )}
            </div>




            {/* Navigateur de combinaisons équivalentes — un point cliqué peut
                correspondre à plusieurs combinaisons de leviers ; chacune se
                projette en direct sur la Vue Chaîne ci-dessous (schéma
                Leviers→TPM→MOP→MOE→Décision) pour un repère visuel immédiat,
                plutôt qu'une liste de texte à décrypter. */}
            {pointBrowser && (
              <div style={{ marginTop: 10, borderRadius: 8, border: "1.5px solid #6366f1", background: "linear-gradient(135deg,#6366f10a,#8b5cf608)", position: "relative", overflow: "hidden" }}>
                <button onClick={() => setPointBrowser(null)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "var(--v4-text3)" }}>×</button>
                <div style={{ padding: "10px 14px 8px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14 }}></span>
                  <span style={{ fontSize: 12.5, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "#4338ca" }}>Point exploré</span>
                  <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#eef0ff", color: "#4338ca", fontWeight: 700 }}>↑ Potentiel {ORD_FULL[pointBrowser.gPlus]}</span>
                  <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#fdf6e8", color: "#b45309", fontWeight: 700 }}>↓ Risque {ORD_FULL[pointBrowser.dMinus]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4338ca" }}>
                    {pointBrowser.exactTotal.toLocaleString('fr-FR')} combinaison{pointBrowser.exactTotal > 1 ? "s" : ""} donnent exactement ce résultat
                  </span>
                </div>
                {pointBrowser.matches.length === 0 ? (
                  <div style={{ padding: "0 14px 12px", fontSize: 13, color: "var(--v4-text3)", lineHeight: 1.55 }}>
                    {/* Profil non atteint : ce vide est une information, pas une erreur. */}
                    <strong>Aucune combinaison n'atteint ce profil.</strong> Sur les 16 profils possibles
                    (Aucune · Faible · Modérée · Élevée en potentiel × idem en risque), celui-ci reste hors de portée
                    de vos leviers actuels.{pointBrowser.gPlus >= 2 && pointBrowser.dMinus <= 1
                      ? " C'est le vide le plus coûteux : personne n'apporte beaucoup sans risquer beaucoup — il faut une option de plus, ou un plan de couverture du risque."
                      : ""}
                  </div>
                ) : (
                  <>
                    <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <button onClick={() => browsePoint(-1)} disabled={pointBrowser.matches.length < 2}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #6366f150", background: "var(--v4-surface)", color: "#6366f1", cursor: pointBrowser.matches.length < 2 ? "default" : "pointer", fontFamily: "inherit", opacity: pointBrowser.matches.length < 2 ? 0.4 : 1, fontSize: 13.5 }}>◀</button>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#4338ca", textAlign: "center" }}>
                        exemple {pointBrowser.index + 1} sur {pointBrowser.matches.length}{!pointBrowser.scannedAll ? " explorés" : ""}
                      </span>
                      <button onClick={() => browsePoint(1)} disabled={pointBrowser.matches.length < 2}
                        style={{ width: 26, height: 26, borderRadius: "50%", border: "1px solid #6366f150", background: "var(--v4-surface)", color: "#6366f1", cursor: pointBrowser.matches.length < 2 ? "default" : "pointer", fontFamily: "inherit", opacity: pointBrowser.matches.length < 2 ? 0.4 : 1, fontSize: 13.5 }}>▶</button>
                      {pointBrowser.matches.length > 1 && (
                        <button onClick={browsePointRandom}
                          title="Tirer un autre exemple au hasard parmi ceux explorés"
                          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, border: "1px dashed #6366f160", background: "var(--v4-surface)", color: "#6366f1", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
                           Au hasard
                        </button>
                      )}
                      {!pointBrowser.scannedAll && (
                        <span style={{ fontSize: 12.5, color: "var(--v4-text3)", fontStyle: "italic" }}>
                          ({pointBrowser.exactTotal.toLocaleString('fr-FR')} au total — {pointBrowser.matches.length} exemples jouables ici, le compte ci-dessus reste exact)
                        </span>
                      )}
                    </div>
                    <div style={{ padding: "0 14px 8px", fontSize: 13, color: "var(--v4-text2)" }}>
                      → Configuration appliquée à la <strong>Vue Chaîne</strong> ci-dessous (onglet « Vue globale ») — le schéma et le score se mettent à jour en direct.
                    </div>
                    <div style={{ padding: "0 14px 12px", display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {Object.entries(pointBrowser.matches[pointBrowser.index].combo).map(([levId, optId]) => {
                        const lev = localSession.leviersDef.find(l => l.id === levId);
                        const opt = lev?.options.find(o => o.id === optId);
                        const tc = LEVER_TYPE_COLORS[(lev?.type as LeverType) ?? "autre"] ?? LEVER_TYPE_COLORS.autre;
                        return (
                          <span key={levId} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, padding: "3px 9px", borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color, fontWeight: 600, transition: "all .15s" }}>
                            {lev?.label ?? levId} : <strong>{opt?.label ?? optId}</strong>
                          </span>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}
            {/* Panneau de détail — combinaison sélectionnée */}
            {selectedCombo && (
              <div style={{ marginTop: 10, padding: "12px 14px", borderRadius: 8, border: "1.5px solid var(--v4-accent)", background: "var(--v4-surface)", position: "relative" }}>
                <button onClick={() => setSelectedCombo(null)} style={{ position: "absolute", top: 8, right: 10, background: "none", border: "none", cursor: "pointer", fontSize: 13.5, color: "var(--v4-text3)" }}>×</button>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--v4-accent)" }}>Combinaison sélectionnée</span>
                  <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontWeight: 700 }}>Potentiel {ORD_FULL[selectedCombo.gPlus]}</span>
                  <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#fee2e2", color: "#dc2626", fontWeight: 700 }}>Risque {ORD_FULL[selectedCombo.dMinus]}</span>
                  {selectedCombo.isUserScenario
                    ? <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#ede9fe", color: "#6d28d9", fontWeight: 700 }}>✓ Scénario : {selectedCombo.isUserScenario}</span>
                    : <span style={{ fontSize: 13, padding: "2px 7px", borderRadius: 6, background: "#fef3c7", color: "#92400e", fontWeight: 700 }}> Hors scénarios définis</span>
                  }
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {localSession.leviersDef.map(lev => {
                    const vid = selectedCombo.combo[lev.id];
                    const optDef = lev.options.find(o => o.id === vid);
                    const tc = LEVER_TYPE_COLORS[lev.type as LeverType] ?? LEVER_TYPE_COLORS.autre;
                    return (
                      <div key={lev.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 6, background: tc.bg, border: `1px solid ${tc.border}` }}>
                        <AuraIcon e={LEVER_ICONS[lev.type as LeverType] ?? "◈"} size={11} />
                        <span style={{ fontSize: 13, color: "var(--v4-text3)", fontWeight: 600 }}>{lev.label} :</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: tc.color }}>{optDef?.label ?? vid}</span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!selectedCombo.isUserScenario && (
                    <button onClick={validateComboAsScenario}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      + Ajouter comme scénario dans Composer
                    </button>
                  )}
                  <button onClick={() => {
                    const suggestion = selectedCombo.isUserScenario ?? `Combinaison ${new Date().toLocaleDateString("fr-FR")}`;
                    const name = window.prompt("Nom de la combinaison à suivre :", suggestion);
                    if (name === null) return;
                    saveCombo({
                      sessionId: localSession.id,
                      sessionTitle: localSession.title,
                      name,
                      leviers: localSession.leviersDef.map(lev => {
                        const vid = selectedCombo.combo[lev.id];
                        return { leverId: lev.id, leverLabel: lev.label, optionId: vid, optionLabel: lev.options.find(o => o.id === vid)?.label ?? vid };
                      }),
                      verdict: {
                        gPlus: selectedCombo.gPlus as ComboOrdLevel,
                        dMinus: selectedCombo.dMinus as ComboOrdLevel,
                        ...(selectedCombo.isUserScenario ? { scenarioLabel: selectedCombo.isUserScenario } : {}),
                      },
                    });
                    addNotification({ type: "plan_step", title: "Combinaison suivie", body: `« ${name} » est enregistrée dans Suivi.` });
                  }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid var(--v4-accent)", background: "transparent", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    ◷ Suivre cette combinaison
                  </button>
                  {selectedCombo.scenarioId && (
                    <button onClick={() => setCardScenarioId(cardScenarioId === selectedCombo.scenarioId ? null : selectedCombo.scenarioId!)}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #6366f1", background: cardScenarioId === selectedCombo.scenarioId ? "#6366f1" : "transparent", color: cardScenarioId === selectedCombo.scenarioId ? "#fff" : "#6366f1", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      {cardScenarioId === selectedCombo.scenarioId ? "✓ Dans la Carte" : "◈ Mettre dans la Carte"}
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
            {/* ── Détail par critère : barres bidirectionnelles (tornade/papillon),
                une par scénario, dans le même idiome que TornadoBlock — jamais
                de score numérique ni de jauge circulaire. ── */}
            {showSmallMultiples && localCriteria.length >= 1 && (
              <div style={{ flex: "1 1 380px", minWidth: 0, borderLeft: "1px solid var(--v4-border)", paddingLeft: 14 }}>
                <div style={{ fontSize: 13, color: "var(--v4-text3)", fontStyle: "italic", marginBottom: 12 }}>
                  Pour chaque objectif, une barre par scénario : risque de dégradation à gauche, potentiel d'amélioration à droite. Fond rouge : critère limitant du scénario (celui qui plafonne son score global). {goalActive && "Cadre pointillé rouge : sous la cible fixée dans « Partir de l'objectif »."}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {critDetailRows.map(({ crit, cells, target }) => (
                    <div key={crit.id}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{crit.label}</span>
                        {target != null && (
                          <span style={{ fontSize: 13, fontWeight: 600, color: "#6366f1" }}>cible ≥ {["", "Faible", "Modérée", "Élevée"][target]}</span>
                        )}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {cells.map(({ sc, r }) => {
                          const isLimiting = limitingByScenario.get(sc.id) === crit.id;
                          const missesTarget = target != null && (r.gPlus < target || r.dMinus > goalTolLevel);
                          return (
                            <div key={sc.id} title={`${crit.label} — ${sc.label} : potentiel ${ORD_FULL[r.gPlus]}, risque ${ORD_FULL[r.dMinus]}`}
                              style={{
                                display: "grid", gridTemplateColumns: "84px 1fr", alignItems: "center", gap: 6,
                                padding: "2px 3px", borderRadius: 6,
                                background: isLimiting ? "#dc262614" : "transparent",
                                outline: missesTarget ? "1.5px dashed #dc2626" : "none", outlineOffset: -1,
                              }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                                <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sc.label}</span>
                              </span>
                              <div style={{ display: "grid", gridTemplateColumns: `${BAR_MAX}px 1fr ${BAR_MAX}px`, alignItems: "center" }}>
                                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                                  <div style={{ width: `${(r.dMinus / 3) * BAR_MAX}px`, height: 8, background: "#dc2626", borderRadius: "6px 0 0 3px", opacity: isLimiting ? 1 : 0.8 }} />
                                </div>
                                <div style={{ width: 1, height: 12, background: "var(--v4-border)" }} />
                                <div style={{ width: `${(r.gPlus / 3) * BAR_MAX}px`, height: 8, background: "#059669", borderRadius: "0 3px 3px 0", opacity: isLimiting ? 1 : 0.8 }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--v4-text3)", marginTop: 6, padding: "0 3px" }}>
                  <span style={{ color: "#dc2626" }}>N · L · M · H ← risque</span>
                  <span style={{ color: "#059669" }}>potentiel → N · L · M · H</span>
                </div>
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280" }}>
                    <span style={{ width: 10, height: 10, borderRadius: 6, background: "#dc262614", border: "1px solid #dc262640" }} />
                    Critère limitant (plafonne le score du scénario)
                  </div>
                  {goalActive && (
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: "#6b7280" }}>
                      <span style={{ width: 10, height: 10, borderRadius: 6, border: "1.5px dashed #dc2626" }} />
                      Sous la cible fixée
                    </div>
                  )}
                </div>
              </div>
            )}
            </div>
          </div>
        );
      })()}

      {/* Atouts + Vigilances côte à côte sous le graphe */}
      {(atouts.length > 0 || vigilance.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: atouts.length && vigilance.length ? "1fr 1fr" : "1fr", gap: 10 }}>
          {atouts.length > 0 && (
            <div style={{ border: "1px solid #bbf7d0", borderRadius: 8, overflow: "hidden", background: "#f0fdf4" }}>
              <div style={{ padding: "7px 10px 6px", borderBottom: "1px solid #bbf7d0", fontSize: 13, fontWeight: 700, color: "#065f46" }}>✦ Atouts clés</div>
              <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {atouts.map(({ leaf, imp }) => {
                  const d = impDisplay(imp);
                  return (
                    <div key={leaf.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, padding: "1px 5px", borderRadius: 6, background: d.bg, color: d.color, flexShrink: 0 }}>{d.short}</span>
                      <span style={{ fontSize: 13, color: "#065f46", lineHeight: 1.3 }}>{leaf.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {vigilance.length > 0 && (
            <div style={{ border: "1px solid #fcd34d", borderRadius: 8, overflow: "hidden", background: "#fffbeb" }}>
              <div style={{ padding: "7px 10px 6px", borderBottom: "1px solid #fcd34d", fontSize: 13, fontWeight: 700, color: "#92400e" }}>⚠ Vigilances</div>
              <div style={{ padding: "7px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {vigilance.map(({ leaf, imp }) => (
                  <div key={leaf.id} style={{ fontSize: 13, color: "#92400e", lineHeight: 1.3 }}>
                    <span style={{ fontWeight: 700 }}>· {leaf.label}</span> — {impDisplay(imp).label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      </div>{/* end left column */}

      {/* ── RIGHT COLUMN : Reco card only ── */}
      <div className="aura-z1-right" style={{ display: "flex", flexDirection: "column", gap: 8 }}>

      {/* ── Non-discrimination : Aura ne départage pas arbitrairement.
             Ex aequo — même grammaire visuelle que la carte : indigo = potentiel,
             ambre = risque, niveaux lus en points ordinaux (jamais en barres,
             une barre suggère une distance que l'échelle ordinale n'autorise pas). */}
      {isTie && bestNr && best && (
        <div style={{ border: "1px solid #6366f133", borderRadius: 8, overflow: "hidden", background: "var(--v4-surface)" }}>
          <div style={{ padding: "11px 14px 10px", borderBottom: "1px solid #6366f120", background: "#6366f107" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#4338ca", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Têtes de liste — ex aequo</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {promising.map(s => {
                const nr = nodeResults[s.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
                const dots = (lvl: number, color: string) => (
                  <span style={{ display: "inline-flex", gap: 2.5, alignItems: "center" }}>
                    {[1, 2, 3].map(i => (
                      <span key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: i <= lvl ? color : "#e5e7eb" }} />
                    ))}
                  </span>
                );
                return (
                  <div key={s.id} style={{ padding: "8px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)" }}>
                    <div style={{ fontSize: 13.5, fontWeight: 900, color: "var(--v4-text)", marginBottom: 12 }}>{s.label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {dots(nr.gPlus, "#4338ca")}
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#4338ca" }}>↑ {ORD_FULL[nr.gPlus]}</span>
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        {dots(nr.dMinus, "#b45309")}
                        <span style={{ fontSize: 13, fontWeight: 800, color: "#b45309" }}>↓ {ORD_FULL[nr.dMinus]}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--v4-text)", lineHeight: 1.65 }}>
            {promising.length} scénarios trouvés avec le même profil ordinal
            (potentiel <strong>{ORD_FULL[bestNr.gPlus]}</strong> · risque <strong>{ORD_FULL[bestNr.dMinus]}</strong>).
          </div>
          {promising.length === 2 && (
            <div style={{ padding: "0 14px 10px" }}>
              <button onClick={() => setShowTieCompare(v => !v)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "1px solid var(--v4-border)", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", padding: "6px 10px", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, width: "100%", justifyContent: "center" }}>
                {showTieCompare ? "▾ Masquer la comparaison" : `▸ Comparer ${promising[0].label} vs ${promising[1].label} en détail`}
              </button>
              {showTieCompare && (() => {
                const [scA, scB] = promising;
                const diffRows = critPaths.filter(({ leaf }) => {
                  const a = cellResults[scA.id]?.[leaf.id];
                  const b = cellResults[scB.id]?.[leaf.id];
                  if (!a || !b) return false;
                  return a.gPlus !== b.gPlus || a.dMinus !== b.dMinus;
                });
                return (
                  <div style={{ marginTop: 8, border: "1px solid var(--v4-border)", borderRadius: 8, overflow: "hidden" }}>
                    {diffRows.length === 0 ? (
                      <div style={{ padding: "12px 14px", fontSize: 13, color: "var(--v4-text2)", textAlign: "center" }}>
                        Aucun indicateur ne distingue ces deux scénarios — ils sont strictement identiques sur tous les critères modélisés.
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", borderBottom: "1px solid var(--v4-border)" }}>
                          <div style={{ padding: "8px 10px", fontSize: 13, fontWeight: 800, color: scA.color, textAlign: "center", borderRight: "1px solid var(--v4-border)" }}>{scA.label}</div>
                          <div style={{ padding: "8px 10px", fontSize: 13, fontWeight: 800, color: scB.color, textAlign: "center" }}>{scB.label}</div>
                        </div>
                        {diffRows.map(({ leaf }) => {
                          const a = cellResults[scA.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
                          const b = cellResults[scB.id]?.[leaf.id] ?? { gPlus: 0, dMinus: 0 };
                          const da = impDisplay(a), db = impDisplay(b);
                          return (
                            <div key={leaf.id} style={{ borderBottom: "1px solid var(--v4-border)" }}>
                              <div style={{ padding: "5px 10px 2px", fontSize: 13, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".04em" }}>{leaf.label}</div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                                <div style={{ padding: "3px 10px 7px", textAlign: "center", borderRight: "1px solid var(--v4-border)" }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: da.bg, color: da.color }}>{da.short} {da.label}</span>
                                </div>
                                <div style={{ padding: "3px 10px 7px", textAlign: "center" }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: db.bg, color: db.color }}>{db.short} {db.label}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div style={{ padding: "6px 10px", fontSize: 13, color: "var(--v4-text3)", textAlign: "center" }}>
                          {diffRows.length} indicateur{diffRows.length > 1 ? "s" : ""} sur {critPaths.length} distingue{diffRows.length > 1 ? "nt" : ""} ces deux scénarios
                        </div>
                      </>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
          <div style={{ padding: "10px 14px", borderTop: "1px solid var(--v4-border)", background: "var(--v4-bg)" }}>
            <button onClick={() => setShowTrancherHelp(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 800, color: "#b45309", textTransform: "uppercase", letterSpacing: ".06em", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              {showTrancherHelp ? "▾" : "▸"} Pour pouvoir trancher
            </button>
            {showTrancherHelp && (
              <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.7, marginTop: 12 }}>
                · Renseignez les impacts <strong>inconnus (?)</strong> dans l'étape Impacter<br />
                · Examinez l'onglet <strong>Écarts</strong> : quels critères séparent réellement ces scénarios ?<br />
                · Ajustez les <strong>importances</strong> dans le Simulateur si un critère mérite d'être décisif<br />
                · Ou choisissez ci-dessous, hors modèle, en documentant pourquoi
              </div>
            )}
          </div>
          {localSession.tieBreak && promising.some(s => s.id === localSession.tieBreak!.scenarioId) ? (
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--v4-border)", background: "#6366f10c" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#6366f1", marginBottom: 3 }}>
                ✓ Choix documenté : {localSession.scenarios.find(s => s.id === localSession.tieBreak!.scenarioId)?.label}
              </div>
              <div style={{ fontSize: 13, color: "var(--v4-text2)", fontStyle: "italic", lineHeight: 1.5 }}>« {localSession.tieBreak.rationale} »</div>
              <button onClick={() => onUpdate({ tieBreak: undefined })}
                style={{ marginTop: 6, background: "none", border: "none", color: "var(--v4-text3)", fontSize: 13, textDecoration: "underline", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                Annuler ce choix
              </button>
            </div>
          ) : (
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--v4-border)" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Choisir parmi les meilleurs scénarios trouvés</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {promising.map(s => (
                  <div key={s.id}>
                    <button onClick={() => { setTieChoiceId(tieChoiceId === s.id ? null : s.id); setTieRationale(""); }}
                      style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, border: `1.5px solid ${tieChoiceId === s.id ? s.color : "var(--v4-border)"}`, background: tieChoiceId === s.id ? `${s.color}0d` : "var(--v4-surface)", cursor: "pointer", fontFamily: "inherit", width: "100%", textAlign: "left" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", flex: 1 }}>{s.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: s.color }}>Choisir →</span>
                    </button>
                    {tieChoiceId === s.id && (
                      <div style={{ marginTop: 5, padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)" }}>
                        <div style={{ fontSize: 13, color: "var(--v4-text3)", marginBottom: 5 }}>Pourquoi ce scénario plutôt que {promising.filter(p => p.id !== s.id).map(p => p.label).join(" / ")} ? (obligatoire — préférence, contrainte externe, information non modélisée…)</div>
                        <textarea value={tieRationale} onChange={e => setTieRationale(e.target.value)} rows={2}
                          placeholder="Ex. : contrainte de trésorerie court terme qui rend ce scénario préférable malgré l'égalité de profil ordinal."
                          style={{ width: "100%", fontFamily: "inherit", fontSize: 13, padding: "6px 8px", borderRadius: 6, border: "1px solid var(--v4-border)", resize: "vertical" }} />
                        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                          <button disabled={!tieRationale.trim()} onClick={() => {
                            onUpdate({ tieBreak: { scenarioId: s.id, rationale: tieRationale.trim(), date: new Date().toISOString() } });
                            setTieChoiceId(null); setTieRationale("");
                          }} style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: tieRationale.trim() ? s.color : "var(--v4-border)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: tieRationale.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                            ✓ Confirmer ce choix
                          </button>
                          <button onClick={() => { setTieChoiceId(null); setTieRationale(""); }}
                            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                            Annuler
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Décision retenue par choix documenté (hors modèle, parmi des scénarios non discriminés) ── */}
      {isTie && localSession.tieBreak && promising.some(s => s.id === localSession.tieBreak!.scenarioId) && (() => {
        const chosen = localSession.scenarios.find(s => s.id === localSession.tieBreak!.scenarioId)!;
        const chosenNr = nodeResults[chosen.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel };
        return (
          <div style={{ border: `2px solid ${chosen.color}`, borderRadius: 8, overflow: "hidden", background: "var(--v4-surface)" }}>
            <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${chosen.color}30`, background: `${chosen.color}08` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: chosen.color, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>Décision retenue — choix documenté</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: "var(--v4-text)" }}>{chosen.label}</div>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: `${chosen.color}15`, color: chosen.color, border: `1px solid ${chosen.color}40` }}>Hors modèle — assumé</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderBottom: "1px solid var(--v4-border)" }}>
              <div style={{ padding: "10px 14px", borderRight: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: chosenNr.gPlus >= 2 ? "#059669" : chosenNr.gPlus === 1 ? "#10b981" : "#9ca3af" }}>
                  {chosenNr.gPlus === 0 ? "·" : chosenNr.gPlus >= 3 ? "++" : "+"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>Potentiel d'amélioration</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: chosenNr.gPlus >= 2 ? "#059669" : chosenNr.gPlus === 1 ? "#10b981" : "#9ca3af" }}>{ORD_FULL[chosenNr.gPlus]}</div>
                </div>
              </div>
              <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: chosenNr.dMinus === 0 ? "#059669" : chosenNr.dMinus === 1 ? "#f59e0b" : "#dc2626" }}>
                  {chosenNr.dMinus === 0 ? "·" : chosenNr.dMinus >= 3 ? "−−" : "−"}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>Risque de détérioration</div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: chosenNr.dMinus === 0 ? "#059669" : chosenNr.dMinus === 1 ? "#f59e0b" : "#dc2626" }}>{ORD_FULL[chosenNr.dMinus]}</div>
                </div>
              </div>
            </div>
            <div style={{ padding: "10px 14px", fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.6, fontStyle: "italic", borderBottom: "1px solid var(--v4-border)" }}>
              « {localSession.tieBreak.rationale} »
            </div>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--v4-border)" }}>
              {(() => {
                const attCodeT: Attitude = localSession.attitude === "Pessimiste" ? 1 : 2;
                const profT: "prudent" | "optimiste" = localSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
                return (
                  <CascadeTreeView
                    title="Cascade — choix documenté"
                    criteria={localCriteria}
                    scenario={chosen}
                    optionIndex={optionIndex}
                    attitudeCode={attCodeT}
                    profile={profT}
                    nodeResult={chosenNr}
                    color={chosen.color}
                  />
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* ── Recommandation Aura / Carte (scénario choisi par l'utilisateur, sinon la reco Aura) ── */}
      {cardScenario && cardNr && !isTie ? (
        <div style={{ border: `1.5px solid ${cardScenario.color}80`, borderRadius: 8, overflow: "hidden", background: "var(--v4-surface)" }}>
          {/* En-tête badge */}
          <div style={{ padding: "10px 14px 8px", borderBottom: `1px solid ${cardScenario.color}25`, background: `${cardScenario.color}06` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: cardScenario.color, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 4 }}>
                {isCardOverridden ? "Scénario mis dans la Carte" : "Recommandation Aura"}
              </div>
              {isCardOverridden && (
                <button onClick={() => setCardScenarioId(null)}
                  style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                  ↺ Revenir à la recommandation Aura
                </button>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: "var(--v4-text)" }}>{cardScenario.label}</div>
              <span style={{ fontSize: 13, fontWeight: 800, padding: "3px 8px", borderRadius: 8, background: `${cardScenario.color}15`, color: cardScenario.color, border: `1px solid ${cardScenario.color}40` }}>
                {isCardOverridden ? "Choisi manuellement" : "Scénario recommandé"}
              </span>
              {!isCardOverridden && !isTie && best && rank2 && (() => {
                const bestNrR = nodeResults[best.id] ?? { gPlus: 0, dMinus: 0 };
                const r2NrR = nodeResults[rank2.id] ?? { gPlus: 0, dMinus: 0 };
                const gapR = (bestNrR.gPlus - r2NrR.gPlus) + (r2NrR.dMinus - bestNrR.dMinus);
                const stableR = gapR >= 2;
                if (stableR) return null; // signal seulement quand la reco est fragile
                return (
                  <button onClick={() => setShowRobustesse(v => !v)}
                    title="Recommandation fragile — cliquer pour voir ce qui la ferait basculer"
                    style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 18, height: 18, borderRadius: "50%", border: "1px solid #f59e0b60", background: showRobustesse ? "#f59e0b18" : "transparent", color: "#b45309", fontSize: 13, lineHeight: 1, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                    ⚠
                  </button>
                );
              })()}
            </div>
            <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 4, lineHeight: 1.4 }}>{cardScenario.description}</div>
            {showRobustesse && !isCardOverridden && !isTie && best && rank2 && (
              <div style={{ marginTop: 6, padding: "8px 10px", borderRadius: 8, background: "var(--v4-bg)", border: "1px solid var(--v4-border)", display: "flex", flexDirection: "column", gap: 4, maxWidth: 360 }}>
                <div style={{ fontSize: 13, color: "var(--v4-text2)", lineHeight: 1.45 }}>
                  {sensitivityRows.length > 0
                    ? <>Ça basculerait si <strong>{sensitivityRows[0].leaf.label}</strong> progresse en <strong>{sensitivityRows[0].axis}</strong> — {sensitivityRows[0].r2label} rejoindrait alors le groupe de tête.</>
                    : <>La recommandation ne tient qu'à une inconnue non renseignée ou à un changement de pondération plus large — aucun critère du challenger ne fait déjà mieux.</>}
                </div>
                <button onClick={() => document.getElementById('arbitrer-synthese')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  style={{ alignSelf: "flex-start", fontSize: 13, fontWeight: 700, color: "var(--v4-accent)", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  Voir l'analyse de sensibilité →
                </button>
              </div>
            )}
          </div>
          {/* Métriques */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderBottom: "1px solid var(--v4-border)" }}>
            <div style={{ padding: "10px 14px", borderRight: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: cardNr.gPlus >= 2 ? "#059669" : cardNr.gPlus === 1 ? "#10b981" : "#9ca3af", transition: "color .25s ease" }}>
                {cardNr.gPlus === 0 ? "·" : cardNr.gPlus >= 3 ? "++" : "+"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>Potentiel d'amélioration</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: cardNr.gPlus >= 2 ? "#059669" : cardNr.gPlus === 1 ? "#10b981" : "#9ca3af", display: "flex", alignItems: "center", gap: 12 }}>{ORD_FULL[cardNr.gPlus]} <OrdGlyph v={cardNr.gPlus} color={cardNr.gPlus >= 2 ? "#059669" : cardNr.gPlus === 1 ? "#10b981" : "#9ca3af"} size={12} /></div>
              </div>
            </div>
            <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, color: cardNr.dMinus === 0 ? "#059669" : cardNr.dMinus === 1 ? "#f59e0b" : "#dc2626", transition: "color .25s ease" }}>
                {cardNr.dMinus === 0 ? "·" : cardNr.dMinus >= 3 ? "−−" : "−"}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 2 }}>Risque de détérioration</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: cardNr.dMinus === 0 ? "#059669" : cardNr.dMinus === 1 ? "#f59e0b" : "#dc2626", display: "flex", alignItems: "center", gap: 12 }}>{ORD_FULL[cardNr.dMinus]} <OrdGlyph v={cardNr.dMinus} color={cardNr.dMinus === 0 ? "#059669" : cardNr.dMinus === 1 ? "#f59e0b" : "#dc2626"} size={12} /></div>
              </div>
            </div>
          </div>
          {/* Verdict en langage naturel : le couple (δ⁺, δ⁻) se lit sans légende */}
          <div style={{ padding: "7px 14px", borderBottom: isCardOverridden ? "none" : "1px solid var(--v4-border)", fontSize: 13, fontStyle: "italic", color: "var(--v4-text2)", lineHeight: 1.5 }}>
            {(() => {
              const g = ["ne présente aucune possibilité identifiée d'améliorer la mission",
                "n'améliore que faiblement la mission",
                "peut améliorer modérément la mission",
                "peut fortement améliorer la mission"][cardNr.gPlus];
              const d = ["sans possibilité identifiée de la dégrader",
                "avec une faible possibilité de la dégrader",
                "et porte une possibilité modérée de la dégrader",
                "et porte une forte possibilité de la dégrader"][cardNr.dMinus];
              const prefix = localSession.attitude === "Pessimiste" ? "Même en lecture prudente, ce scénario " : "Au mieux, ce scénario ";
              return `${prefix}${g}, ${d}.`;
            })()}
          </div>
          {/* ── "Pourquoi ce score ?" — replié par défaut : atouts/vigilances, transparence min/max, robustesse ── */}
          {!isCardOverridden && (
          <>
          <div style={{ padding: "6px 14px", borderBottom: "1px solid var(--v4-border)" }}>
            <button onClick={() => setWhyScoreOpen(v => !v)}
              style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, fontWeight: 700, color: cardScenario.color, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              {whyScoreOpen ? "▾" : "▸"} Pourquoi ce score ?
            </button>
            {/* Une ligne de valeur, visible même replié : le critère qui fixe le score,
                donc le seul endroit où agir change le verdict. */}
            {(drowning?.cap || drowning?.risk) && (
              <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 3, lineHeight: 1.5 }}>
                {drowning.cap
                  ? <>Ce qui fixe le score : <strong>« {drowning.cap} »</strong> plafonne le potentiel — agir ailleurs ne changera rien.</>
                  : <>Ce qui fixe le score : <strong>« {drowning.risk} »</strong> porte seul le risque — c'est le point à traiter.</>}
              </div>
            )}
          </div>
          {whyScoreOpen && (
          <>
          {(cardAtouts.length > 0 || cardVigilance.length > 0) && (
            <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--v4-border)", display: "flex", flexDirection: "column", gap: 8 }}>
              {cardAtouts.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: cardScenario.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Atouts clés de ce scénario</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {cardAtouts.map(({ leaf, imp }) => (
                      <div key={leaf.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <OrdGlyph v={imp.gPlus} color="#059669" size={10} />
                        <span style={{ fontSize: 13, color: "var(--v4-text2)" }}>{leaf.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {cardVigilance.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 4, textTransform: "uppercase", letterSpacing: ".06em" }}>Points de vigilance</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {cardVigilance.map(({ leaf, imp }) => (
                      <div key={leaf.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <OrdGlyph v={imp.dMinus} color="#dc2626" size={10} />
                        <span style={{ fontSize: 13, color: "#92400e" }}>{leaf.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {/* Transparence min/max : quel critère porte le verdict global ? */}
          {drowning && (drowning.risk || drowning.cap) && (
            <div style={{ padding: "7px 14px", borderBottom: "1px solid var(--v4-border)", background: "#fffbeb", display: "flex", flexDirection: "column", gap: 3 }}>
              {drowning.risk && (
                <div style={{ fontSize: 13, color: "#92400e", lineHeight: 1.5 }}>
                  ⚠ Le risque global est <strong>entièrement porté par « {drowning.risk} »</strong> — les autres critères n'y contribuent pas.
                </div>
              )}
              {drowning.cap && (
                <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.5 }}>
                  ◔ Le potentiel global est <strong>plafonné par « {drowning.cap} »</strong> — améliorer les autres critères n'élèvera pas le verdict.
                </div>
              )}
            </div>
          )}
          {/* ── Complétude & robustesse d'attitude ── */}
          <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            {completeness.total > 0 && (() => {
              const pct = completeness.filled / completeness.total;
              const R = 9, C = 2 * Math.PI * R;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="Le verdict vaut ce que valent les entrées : cellules renseignées / total (inconnues et non renseignées exclues).">
                  <svg width={24} height={24}>
                    <circle cx={12} cy={12} r={R} fill="none" stroke="var(--v4-border)" strokeWidth={3.5} />
                    <circle cx={12} cy={12} r={R} fill="none" stroke={pct > 0.75 ? "#059669" : pct > 0.4 ? "#f59e0b" : "#dc2626"} strokeWidth={3.5}
                      strokeDasharray={`${C * pct} ${C}`} strokeLinecap="round" transform="rotate(-90 12 12)" />
                  </svg>
                  <span style={{ fontSize: 13, color: "var(--v4-text2)" }}>Évaluation renseignée <strong>{completeness.filled}/{completeness.total}</strong>{completeness.unknown > 0 ? ` · ${completeness.unknown} inconnue${completeness.unknown > 1 ? "s" : ""}` : ""}</span>
                </div>
              );
            })()}
            {attitudeRobust && (
              <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 9px", borderRadius: 8,
                background: attitudeRobust.stable ? "#d1fae5" : "#fef3c7", color: attitudeRobust.stable ? "#065f46" : "#92400e" }}
                title="Le même moteur, recalculé dans l'autre attitude du décideur.">
                {attitudeRobust.stable
                  ? `✓ Tient aussi en attitude ${attitudeRobust.otherLabel}`
                  : `⚠ En ${attitudeRobust.otherLabel} : « ${attitudeRobust.otherBest} » passe devant`}
              </span>
            )}
          </div>
          </>
          )}
          </>
          )}
          {/* Texte Aura — structuré */}
          <div style={{ padding: "10px 14px" }}>
            {generating ? (
              <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>Analyse en cours…</div>
            ) : reco ? (
              <div style={{ fontSize: 13, color: "var(--v4-text)", lineHeight: 1.65 }}>
                {(() => {
                  const sentences = reco.replace(/\*\*([^*]+)\*\*/g, "$1").split(/(?<=\.)\s+/).filter(Boolean);
                  const paragraphs: string[][] = [];
                  for (let i = 0; i < sentences.length; i += 2) paragraphs.push(sentences.slice(i, i + 2));
                  return paragraphs.map((group, pi) => (
                    <p key={pi} style={{ margin: 0, marginBottom: pi < paragraphs.length - 1 ? 10 : 0 }}>
                      {group.join(" ")}
                    </p>
                  ));
                })()}
              </div>
            ) : (
              <button onClick={autoReco} style={{ fontSize: 13, padding: "5px 12px", borderRadius: 6, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                ✦ Générer l'analyse Aura
              </button>
            )}
          </div>
          {/* Configuration retenue — chips groupés par type de levier, plus scannables qu'une liste */}
          {cardScenario.leviers.length > 0 && (
            <div style={{ padding: "10px 14px", borderTop: `1px solid ${cardScenario.color}20`, background: `${cardScenario.color}05` }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-accent)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>Configuration retenue — {cardScenario.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {cardScenario.leviers.map(lev => {
                  const def = localLeviersDef.find(d => d.id === lev.id || d.label === lev.label);
                  const optDef = def?.options.find(o => o.id === lev.valeur || o.label === lev.valeur);
                  const tc = LEVER_TYPE_COLORS[lev.type as LeverType] ?? LEVER_TYPE_COLORS.autre;
                  return (
                    <div key={lev.id} style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 8, background: tc.bg, border: `1px solid ${tc.border}` }}>
                      <AuraIcon e={LEVER_ICONS[lev.type as LeverType] ?? "◈"} size={12} />
                      <span style={{ fontSize: 13, color: "var(--v4-text3)", fontWeight: 600 }}>{lev.label} :</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: tc.color }}>{optDef?.label ?? lev.valeur}</span>
                    </div>
                  );
                })}
              </div>
              {(() => {
                const chosenOptIds = cardScenario.leviers.map(lev => {
                  const def = localLeviersDef.find(d => d.id === lev.id || d.label === lev.label);
                  return def?.options.find(o => o.id === lev.valeur || o.label === lev.valeur);
                }).filter(Boolean) as typeof localLeviersDef[number]["options"];
                const conflicts = chosenOptIds.flatMap(o =>
                  (o.incompatibleAvec ?? []).filter(id => chosenOptIds.some(o2 => o2.id === id)).map(id => ({ a: o, bId: id }))
                );
                if (!conflicts.length) return null;
                return (
                  <div style={{ marginTop: 6, padding: "6px 9px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 13, color: "#b91c1c", lineHeight: 1.5 }}>
                    ⚠ Couplage incohérent détecté : « {conflicts[0].a.label} » est structurellement incompatible avec l'option choisie « {chosenOptIds.find(o => o.id === conflicts[0].bId)?.label ?? conflicts[0].bId} ».
                  </div>
                );
              })()}
              {session.elicitation?.decideurs && (
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--v4-text3)", lineHeight: 1.5 }}>
                  <span style={{ fontWeight: 700 }}>Décideurs : </span>{session.elicitation.decideurs}
                  {session.elicitation.impactes && <><br /><span style={{ fontWeight: 700 }}>Impactés : </span>{session.elicitation.impactes}</>}
                </div>
              )}
            </div>
          )}
        </div>
      ) : !isTie ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Empty state guide */}
          <div style={{ padding: "14px 16px", borderRadius: 8, background: "var(--v4-surface)", border: "1.5px dashed var(--v4-border)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--v4-text2)" }}>
              {session.scenarios.length < 2
                ? ` ${session.scenarios.length === 0 ? "Aucun scénario" : "1 scénario"} — il en faut au moins 2 pour arbitrer`
                : "Aucun scénario évaluable"}
            </div>
            <div style={{ fontSize: 13, color: "var(--v4-text3)", lineHeight: 1.6 }}>
              Créez au moins 2 scénarios dans <strong>Composer</strong> en choisissant une option par levier. Aura calculera automatiquement les scores Lo MCD-E et identifiera le scénario optimal.
            </div>
            <button onClick={onBack} style={{ alignSelf: "flex-start", padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 4 }}>
              → Aller à Composer
            </button>
          </div>
          {/* Criteria tree preview */}
          {session.criteria.length > 0 && (
            <div style={{ borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-surface)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--v4-border)", background: "var(--v4-surface2)", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13.5 }}></span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text2)" }}>Critères qui seront évalués</span>
                <span style={{ fontSize: 13, color: "var(--v4-text3)", marginLeft: "auto" }}>{getLeafCriteria(session.criteria).length} indicateurs</span>
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                {session.criteria.map(moe => (
                  <div key={moe.id}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", marginBottom: 3 }}>
                      {moe.label}
                      <ImportancePill badge={moe.importance} />
                    </div>
                    {moe.children?.map(mop => (
                      <div key={mop.id} style={{ marginLeft: 14, marginBottom: 4 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text2)", marginBottom: 2 }}>
                          ↳ {mop.label}
                          <ImportancePill badge={mop.importance} />
                        </div>
                        {mop.children?.map(tpm => (
                          <div key={tpm.id} style={{ marginLeft: 14, fontSize: 13, color: "var(--v4-text3)", paddingBottom: 1 }}>
                            · {tpm.label}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}

      </div>{/* end right column */}
      </div>{/* end Zone 1 grid */}

      {/* ── BANNIÈRE EXECUTIVE — masquée : redondante avec la recommandation
          d'ArbitrageMinimal (Zone 2) juste en dessous. ── */}
      <div style={{ display: "none" }}>
      {isTie && (
        <div style={{ marginTop: 8, borderRadius: 8, border: "1.5px solid #f59e0b60", background: "#f59e0b0a", padding: "10px 16px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: "#b45309" }}>◆ Non discriminés</span>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: "var(--v4-text)" }}>{promising.map(s => s.label).join(" · ")}</span>
          <span style={{ fontSize: 13, color: "var(--v4-text2)" }}>Départage impossible en l'état — voir « Pour pouvoir trancher ».</span>
        </div>
      )}
      {best && !isTie && (() => {
        const topAtout = atouts[0];
        const topVigilance = vigilance[0];
        return (
          <div style={{ marginTop: 8, borderRadius: 8, border: `1.5px solid ${best.color}40`, background: `${best.color}08`, padding: "10px 16px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: "0 0 auto" }}>
              <span style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em", color: best.color }}>✦ Recommandation</span>
              <span style={{ fontSize: 13.5, fontWeight: 900, color: best.color }}>{best.label}</span>
            </div>
            {topAtout && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, borderLeft: `1.5px solid ${best.color}30`, paddingLeft: 14, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "1px 6px", borderRadius: 6, background: "#d1fae5", color: "#065f46", flexShrink: 0 }}>Force</span>
                <span style={{ fontSize: 13, color: "var(--v4-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topAtout.leaf.label}</span>
              </div>
            )}
            {topVigilance && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, borderLeft: "1.5px solid #fcd34d", paddingLeft: 14, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "1px 6px", borderRadius: 6, background: "#fef3c7", color: "#92400e", flexShrink: 0 }}>Vigilance</span>
                <span style={{ fontSize: 13, color: "var(--v4-text2)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topVigilance.leaf.label}</span>
              </div>
            )}
            <button
              onClick={() => goToSuivi()}
              style={{ marginLeft: "auto", flexShrink: 0, padding: "6px 14px", borderRadius: 8, border: "none", background: best.color, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}
            >
              Valider → Suivi
            </button>
          </div>
        );
      })()}

      {/* ── LE PROCHAIN RENSEIGNEMENT À OBTENIR ── */}
      {nextInfo.length > 0 && (
        <div style={{ marginTop: 8, borderRadius: 8, border: "1.5px solid #8b5cf640", background: "var(--v4-surface)", overflow: "hidden" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid #2b2b2b30", background: "#2b2b2b08", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: "#7c3aed", textTransform: "uppercase", letterSpacing: ".08em" }}>⌕ À instruire en priorité</span>
            <span style={{ fontSize: 13, color: "var(--v4-text3)" }} title="Pour chaque impact inconnu des scénarios de tête, Aura simule sa résolution (hypothèse haute vs basse) et recalcule le résultat.">
              <strong style={{ color: "#7c3aed" }}>décisif</strong> = peut changer le classement <span style={{ opacity: .6 }}>ⓘ</span>
            </span>
            {auraProposedCount > 0 && (
              <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#8b5cf6", border: "1px dashed #8b5cf6", borderRadius: 8, padding: "2px 8px" }}>✦ {auraProposedCount} hypothèse{auraProposedCount > 1 ? "s" : ""} à confirmer</span>
            )}
          </div>
          <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 6 }}>
            {(nextInfoOpen ? nextInfo : nextInfo.slice(0, 3)).map((ins, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: ins.decisive ? "#8b5cf60d" : "var(--v4-bg)", border: `1px solid ${ins.decisive ? "#8b5cf650" : "var(--v4-border)"}`, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 800, padding: "2px 7px", borderRadius: 6, background: ins.decisive ? "#8b5cf6" : "var(--v4-surface2)", color: ins.decisive ? "#fff" : "var(--v4-text3)", flexShrink: 0 }}>
                  {ins.decisive ? "DÉCISIF" : "à instruire"}
                </span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>{ins.leaf.label}</span>
                <span style={{ fontSize: 13, color: "var(--v4-text2)" }}>
                  « <strong>{ins.optLabel}</strong> » — <strong style={{ color: ins.sc.color }}>{ins.sc.label}</strong>
                </span>
              </div>
            ))}
            {nextInfo.length > 3 && (
              <button onClick={() => setNextInfoOpen(v => !v)}
                style={{ alignSelf: "flex-start", background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700, color: "#7c3aed" }}>
                {nextInfoOpen ? "▾ Réduire" : `▸ ${nextInfo.length - 3} de plus`}
              </button>
            )}

          </div>
        </div>
      )}
      </div>{/* end bannière executive masquée */}
      </div>

      {/* ── ZONE 2 : Arbitrer — écran unique, sans bascule Exécutif/Expert ni onglets multiples ── */}
      <div id="arbitrer-synthese" className="mt-2 w-full min-w-0 overflow-visible">
        {best ? (() => {
          const retenuId = cardScenario?.id
            ?? localSession.tieBreak?.scenarioId
            ?? [...localSession.scenarios].sort((a, b) => loCompare(
              nodeResults[b.id] ?? { gPlus: 0, dMinus: 0 },
              nodeResults[a.id] ?? { gPlus: 0, dMinus: 0 },
            ))[0]?.id;
          const cellsOf = retenuId ? levelCells[retenuId] ?? {} : {};
          const toChaine = (c: AtelierCriterion, depth: number): import("../components/aura/ChaineObjectifs").ChaineNode => ({
            id: c.id,
            label: c.label,
            niveau: depth === 0 ? "MOE" : depth === 1 ? "MOP" : "TPM",
            importance: c.importance,
            plus: (cellsOf[c.id]?.gPlus ?? 0) as 0 | 1 | 2 | 3,
            minus: (cellsOf[c.id]?.dMinus ?? 0) as 0 | 1 | 2 | 3,
            children: (c.children ?? []).map(k => toChaine(k, depth + 1)),
          });
          return (
            <ArbitrageMinimal
              onCompleteImpacts={() => onUpdate({ step: "impacter" })}
              title={localSession.title || "Arbitrage"}
              scenarios={localSession.scenarios.map(s => ({ id: s.id, label: s.label, color: s.color }))}
              criteria={localSession.criteria.map(c => ({ id: c.id, label: c.label, weight: importanceToWeight(c.importance) }))}
              cells={cellResults}
              session={localSession}
              retenuId={retenuId}
              rationale={cardScenarioId ? undefined : localSession.tieBreak?.rationale}
              chaine={localSession.criteria.map(c => toChaine(c, 0))}
              decisionRecord={localSession.decisionRecord}
              onSign={record => onUpdate({ decisionRecord: record })}
              actions={<>
                <button onClick={printDecision}
                  style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  Exporter PDF
                </button>
                <MiniReportButton session={localSession} className="" style={{ padding: "6px 11px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }} />
                <button onClick={() => { const next = !shared; setShared(next); onUpdate({ shared: next }); }}
                  style={{ padding: "6px 11px", borderRadius: 8, border: `1px solid ${shared ? "#6366f1" : "var(--v4-border)"}`, background: shared ? "#6366f110" : "transparent", color: shared ? "#6366f1" : "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit", fontWeight: shared ? 600 : 400 }}>
                  {shared ? "Partagée" : "Partager"}
                </button>
                {validated ? (
                  <div style={{ padding: "6px 12px", borderRadius: 8, background: "#10b981", color: "#fff", fontSize: 13, fontWeight: 700 }}>✓ Décision validée</div>
                ) : (
                  <button onClick={validate} disabled={!best}
                    style={{ padding: "6px 13px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", opacity: best ? 1 : 0.45 }}>
                    ✓ Valider
                  </button>
                )}
              </>}
            />
          );
        })() : (
          <div style={{ padding: "24px", textAlign: "center", color: "var(--v4-text3)", fontSize: 13 }}>
            L'analyse approfondie sera disponible dès qu'un scénario recommandé sera identifié.
          </div>
        )}
        {/* Supply : ce que Décider sait faire et que les outils classiques ne font pas (encart discret). */}
        {best && (localSession.alertId || /supply/i.test(localSession.sector ?? "")) && <SolidityNote session={localSession} />}
        </div>{/* end Zone 2 */}

      {/* ── Légende impacts + bouton retour ── */}
      <div style={{ display: "flex", gap: "var(--e-2)", alignItems: "center", flexWrap: "wrap", paddingTop: "var(--e-1)", borderTop: "1px solid var(--v4-border)" }}>
        <button onClick={onBack} className="aura-e-pill" style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          ← Retour à l'étape précédente
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" }}>Légende</span>
          {[{ short: "++", label: "Forte amélioration", color: "#059669", bg: "#d1fae5" }, { short: "+", label: "Amélioration", color: "#10b981", bg: "#ecfdf5" }, { short: "0", label: "Effet évalué neutre", color: "#9ca3af", bg: "var(--v4-surface)" }, { short: "−", label: "Dégradation", color: "#f59e0b", bg: "#fef3c7" }, { short: "--", label: "Forte dégradation", color: "#dc2626", bg: "#fee2e2" }, { short: "?", label: "Inconnu — info insuffisante", color: "#8b5cf6", bg: "#f5f3ff" }].map(l => (
            <span key={l.short} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 13 }}>
              <span title={l.label} aria-label={l.label} style={{ fontWeight: 800, padding: "1px 5px", borderRadius: 6, background: l.bg, color: l.color }}>{l.short}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Confirmation régénération OKR ── */}
      {confirmOkrRegen && (
        <div style={{ borderRadius: 8, border: "1.5px solid #f59e0b55", background: "#fef3c710", padding: "14px 18px", display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 16.5 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#d97706" }}>Scénario retenu modifié</div>
            <div style={{ fontSize: 13, color: "var(--v4-text2)", marginTop: 3 }}>
              Des OKR ont déjà été générés. Régénérer les OKR pour le nouveau scénario retenu ?
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button onClick={() => setConfirmOkrRegen(false)}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              Conserver
            </button>
            <button onClick={() => { setConfirmOkrRegen(false); setOkrData(null); generateOKRForDecision(); }}
              style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "#d97706", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Régénérer →
            </button>
          </div>
        </div>
      )}


    </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
type MobileTab = "document" | "aura" | "sessions";

// ─── Comment / Annotation System ─────────────────────────────────────────────
interface AuraAnnotation {
  id: string;
  sessionId: string;
  sessionTitle: string;
  step: string;
  text: string;
  author: string;
  createdAt: string;
  status: "pending" | "accepted" | "rejected";
  replies: Array<{ author: string; text: string; createdAt: string }>;
}

const ANNOT_KEY = "aura_annotations_v1";

function loadAnnotations(): AuraAnnotation[] {
  try { return JSON.parse(localStorage.getItem(ANNOT_KEY) ?? "[]"); } catch { return []; }
}
function saveAnnotations(list: AuraAnnotation[]) {
  localStorage.setItem(ANNOT_KEY, JSON.stringify(list));
}

function AnnotationPanel({
  sessionId, sessionTitle, currentStep, onClose,
}: { sessionId: string; sessionTitle: string; currentStep: string; onClose: () => void }) {
  const [annotations, setAnnotations] = useState<AuraAnnotation[]>(() => loadAnnotations());
  const [draft, setDraft] = useState("");
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [replyOpen, setReplyOpen] = useState<string | null>(null);
  const [authorName] = useState<string>(() => {
    try { const p = JSON.parse(localStorage.getItem("aura_user_profile_v1") ?? "{}"); return p.name ?? "Utilisateur"; } catch { return "Utilisateur"; }
  });
  const panelRef = useRef<HTMLDivElement>(null);
  useDismiss(true, onClose, panelRef);

  const refresh = () => setAnnotations(loadAnnotations());

  function addAnnotation() {
    if (!draft.trim()) return;
    const all = loadAnnotations();
    const a: AuraAnnotation = {
      id: `ann-${Date.now()}`,
      sessionId, sessionTitle, step: currentStep,
      text: draft.trim(), author: authorName,
      createdAt: new Date().toISOString(),
      status: "pending", replies: [],
    };
    saveAnnotations([a, ...all]);
    setDraft("");
    refresh();
  }

  function setStatus(id: string, status: AuraAnnotation["status"]) {
    const all = loadAnnotations().map(a => a.id === id ? { ...a, status } : a);
    saveAnnotations(all); refresh();
  }

  function addReply(id: string) {
    const text = (replyDraft[id] ?? "").trim();
    if (!text) return;
    const all = loadAnnotations().map(a => a.id === id ? {
      ...a, replies: [...a.replies, { author: authorName, text, createdAt: new Date().toISOString() }],
    } : a);
    saveAnnotations(all);
    setReplyDraft(d => ({ ...d, [id]: "" }));
    setReplyOpen(null);
    refresh();
  }

  function deleteAnnotation(id: string) {
    saveAnnotations(loadAnnotations().filter(a => a.id !== id));
    refresh();
  }

  const STATUS_LABEL: Record<string, string> = { pending: "En attente", accepted: "Accepté ✓", rejected: "Refusé ✗" };
  const STATUS_COLOR: Record<string, string> = { pending: "#92400e", accepted: "#065f46", rejected: "#991b1b" };
  const STATUS_BG: Record<string, string> = { pending: "#fef3c7", accepted: "#d1fae5", rejected: "#fee2e2" };

  const myAnnotations = annotations.filter(a => a.author === authorName);
  const othersAnnotations = annotations.filter(a => a.author !== authorName);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 200, display: "flex", justifyContent: "flex-end",
    }}>
      <div style={{ position: "absolute", inset: 0, background: "rgba(15,11,26,.35)", backdropFilter: "blur(3px)" }} />
      <div ref={panelRef} style={{
        position: "relative", width: 400, maxWidth: "92vw", height: "100vh",
        background: "var(--v4-surface)", borderLeft: "1px solid var(--v4-border)",
        display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.14)",
      }}>
        {/* Header */}
        <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)" }}>Annotations</div>
            <div style={{ fontSize: 13, color: "var(--v4-text3)", marginTop: 1 }}>{sessionTitle} · {currentStep}</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 14, lineHeight: 1, padding: 4, fontFamily: "inherit" }}>✕</button>
        </div>

        {/* New annotation */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--v4-border)" }}>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Ajouter une annotation, suggestion ou question…"
            rows={3}
            style={{ width: "100%", resize: "vertical", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-bg)", color: "var(--v4-text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
            onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addAnnotation(); }}
          />
          <button onClick={addAnnotation} disabled={!draft.trim()} style={{ marginTop: 6, padding: "5px 14px", borderRadius: 8, border: "none", background: draft.trim() ? "var(--v4-accent)" : "var(--v4-border)", color: draft.trim() ? "#fff" : "var(--v4-text3)", fontSize: 13, fontWeight: 700, cursor: draft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
            Publier
          </button>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {annotations.length === 0 && (
            <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--v4-text3)", fontSize: 13 }}>Aucune annotation pour cette session.</div>
          )}
          {annotations.map(a => {
            const isMine = a.author === authorName;
            return (
              <div key={a.id} style={{ padding: "10px 16px", borderBottom: "1px solid var(--v4-border)" }}>
                {/* Author + date + status */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--v4-accent-bg)", border: "1.5px solid var(--v4-accent-border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "var(--v4-accent)", flexShrink: 0 }}>
                    {a.author.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)" }}>{a.author}</span>
                  <span style={{ fontSize: 12, color: "var(--v4-text3)" }}>{new Date(a.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, padding: "2px 7px", borderRadius: 8, background: STATUS_BG[a.status], color: STATUS_COLOR[a.status] }}>
                    {STATUS_LABEL[a.status]}
                  </span>
                  {isMine && (
                    <button onClick={() => deleteAnnotation(a.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, lineHeight: 1, padding: "0 2px", fontFamily: "inherit" }} title="Supprimer">×</button>
                  )}
                </div>
                {/* Context breadcrumb */}
                <div style={{ fontSize: 12, color: "var(--v4-accent)", marginBottom: 5, background: "var(--v4-accent-bg)", display: "inline-block", padding: "1px 6px", borderRadius: 12 }}>
                  {a.step}
                </div>
                {/* Text */}
                <div style={{ fontSize: 13, color: "var(--v4-text)", lineHeight: 1.5, marginBottom: 12 }}>{a.text}</div>

                {/* Action buttons — shown to others, not the author */}
                {!isMine && (
                  <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                    <button onClick={() => setStatus(a.id, "accepted")} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #6ee7b7", background: a.status === "accepted" ? "#d1fae5" : "transparent", color: "#065f46", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✓ Accepter</button>
                    <button onClick={() => setStatus(a.id, "rejected")} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: a.status === "rejected" ? "#fee2e2" : "transparent", color: "#991b1b", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>✗ Refuser</button>
                    <button onClick={() => setReplyOpen(replyOpen === a.id ? null : a.id)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}> Répondre</button>
                  </div>
                )}
                {isMine && (
                  <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
                    <button onClick={() => setReplyOpen(replyOpen === a.id ? null : a.id)} style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid var(--v4-border)", background: "transparent", color: "var(--v4-text3)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}> Répondre</button>
                  </div>
                )}

                {/* Replies */}
                {a.replies.length > 0 && (
                  <div style={{ marginLeft: 12, borderLeft: "2px solid var(--v4-border)", paddingLeft: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                    {a.replies.map((r, i) => (
                      <div key={i} style={{ fontSize: 13, color: "var(--v4-text2)" }}>
                        <span style={{ fontWeight: 700, color: "var(--v4-text)" }}>{r.author}</span>
                        <span style={{ fontSize: 12, color: "var(--v4-text3)", marginLeft: 5 }}>{new Date(r.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</span>
                        <div style={{ marginTop: 2 }}>{r.text}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply input */}
                {replyOpen === a.id && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      value={replyDraft[a.id] ?? ""}
                      onChange={e => setReplyDraft(d => ({ ...d, [a.id]: e.target.value }))}
                      placeholder="Votre réponse…"
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "var(--v4-bg)", color: "var(--v4-text)", fontSize: 13, fontFamily: "inherit", outline: "none" }}
                      onKeyDown={e => { if (e.key === "Enter") addReply(a.id); }}
                    />
                    <button onClick={() => addReply(a.id)} style={{ marginTop: 4, padding: "3px 10px", borderRadius: 6, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Envoyer</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Parcours de démarrage — Décider ──────────────────────────────────────
// Même principe que Copilote Décideur (cockpit.copilote-decideur.tsx) :
// une checklist qui se coche à partir de l'usage réel, jamais d'un
// tutoriel cliqué à vide, mémorisée par session pour ne pas ressurgir sur
// une analyse déjà avancée.
const DECIDER_ONBOARDING_KEY = "aura-v4-decider-onboarding";
interface DeciderOnboardingState { decrire: boolean; modele: boolean; scenario: boolean; arbitrer: boolean; dismissed: boolean }
function loadDeciderOnboarding(): DeciderOnboardingState {
  try { return { decrire: false, modele: false, scenario: false, arbitrer: false, dismissed: false, ...JSON.parse(localStorage.getItem(DECIDER_ONBOARDING_KEY) ?? "{}") }; }
  catch { return { decrire: false, modele: false, scenario: false, arbitrer: false, dismissed: false }; }
}
function saveDeciderOnboarding(s: DeciderOnboardingState) { try { localStorage.setItem(DECIDER_ONBOARDING_KEY, JSON.stringify(s)); } catch { /* stockage indisponible */ } }
const DECIDER_ONBOARDING_STEPS: { key: keyof Omit<DeciderOnboardingState, "dismissed">; label: string; detail: string }[] = [
  { key: "decrire", label: "Décrire une décision", detail: "En quelques phrases — l'IA en déduit le type et les critères" },
  { key: "modele", label: "Voir le modèle généré", detail: "Objectifs, critères et indicateurs déduits de votre description" },
  { key: "scenario", label: "Composer un scénario", detail: "Choisir une combinaison de leviers à comparer" },
  { key: "arbitrer", label: "Arbitrer", detail: "Obtenir un verdict qualitatif justifié, jamais un score inventé" },
];
function DeciderOnboardingChecklist({ state, onDismiss }: { state: DeciderOnboardingState; onDismiss: () => void }) {
  const done = DECIDER_ONBOARDING_STEPS.filter(s => state[s.key]).length;
  return (
    <div style={{ background: "transparent", border: "none", borderTop: "1px solid var(--v4-border)", borderBottom: "1px solid var(--v4-border)", borderRadius: 0, padding: "16px 4px", marginBottom: 18, position: "relative", boxShadow: "none" }}>
      <button onClick={onDismiss} title="Masquer le parcours de démarrage" aria-label="Masquer"
        style={{ position: "absolute", top: 10, right: 12, border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13 }}>×</button>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "var(--v4-text)" }}>Parcours de démarrage</div>
        <div style={{ fontSize: 13, color: "var(--v4-text3)" }}>{done} / {DECIDER_ONBOARDING_STEPS.length}</div>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "var(--v4-bg)", overflow: "hidden", marginBottom: 14 }}>
        <div style={{ height: "100%", width: `${(done / DECIDER_ONBOARDING_STEPS.length) * 100}%`, background: "var(--v4-accent)", transition: "width .3s ease" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        {DECIDER_ONBOARDING_STEPS.map((s, i) => {
          const ok = state[s.key];
          return (
            <div key={s.key} style={{ display: "flex", gap: 9, alignItems: "flex-start", opacity: ok ? 0.6 : 1 }}>
              <div style={{ width: 20, height: 20, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 800, background: ok ? "#059669" : "var(--v4-bg)", color: ok ? "#fff" : "var(--v4-text3)", border: ok ? "none" : "1.5px solid var(--v4-border)" }}>
                {ok ? "✓" : i + 1}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", textDecoration: ok ? "line-through" : "none" }}>{s.label}</div>
                <div style={{ fontSize: 12.5, color: "var(--v4-text3)" }}>{s.detail}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function consumePendingAuraContext(): string {
  if (typeof window === "undefined") return "";
  try {
    const items = JSON.parse(localStorage.getItem("aura.pendingContext.v1") || "[]") as Array<{ text?: string; fileName?: string }>;
    if (!items.length) return "";
    localStorage.removeItem("aura.pendingContext.v1");
    return items.filter(item => item.text?.trim()).map(item => item.fileName ? `Source — ${item.fileName}\n${item.text}` : item.text).join("\n\n");
  } catch { return ""; }
}

// AtelierPage sert deux usages : (1) la route /cockpit/atelier elle-même,
// où la session active vient de l'URL (?sessionId=...) via le routeur ; (2)
// embarquée dans ControlTowerShell (mode « Décision » de la Control Tower),
// où elle n'a pas sa propre URL et reçoit la session active depuis l'état du
// composant parent. `embeddedSetSessionId` étant fourni (même si
// `embeddedSessionId` vaut `undefined`, ex. aucune session encore choisie)
// signale ce second usage ; à défaut, le comportement est strictement celui
// d'avant, piloté par `useSearch`.
// `embeddedSuggestions` — additif, optionnel : liste de questions de départ
// affichées au-dessus de la question Comprendre quand le parcours est
// embarqué (mode « Décision » de la Control Tower / Supply Chain Resilience
// Agent) et qu'aucun contexte n'a encore été saisi. Omis (route
// /cockpit/atelier normale), aucun changement de comportement.
// `embeddedDomainExpertise` — additif, optionnel, même patron que
// `embeddedSuggestions` : cadrage expert Supply Chain Resilience (texte
// libre) transmis aux fonctions LLM du Comprendre (inférence d'élicitation,
// classification, génération du modèle MOE/MOP/TPM/leviers, questions
// discriminantes) UNIQUEMENT quand fourni par le shell Supply Chain
// Resilience Agent. Omis (route /cockpit/atelier normale, ou tout autre
// usage embarqué qui ne le passe pas), les fonctions LLM reçoivent
// `domainExpertiseHint: undefined` et produisent un prompt strictement
// identique à avant l'introduction de ce paramètre.
export function AtelierPage({ embeddedSessionId, embeddedSetSessionId, embeddedSuggestions, embeddedDomainExpertise, embeddedDefaultSector }: { embeddedSessionId?: string; embeddedSetSessionId?: (id: string | undefined) => void; embeddedSuggestions?: string[]; embeddedDomainExpertise?: string; embeddedDefaultSector?: string } = {}) {
  // Pilotage : trace d'usage de l'espace Décider (adoption, pas de donnée métier).
  useTelemetrie("decider");
  const isEmbedded = typeof embeddedSetSessionId === "function";
  // En usage normal (route /cockpit/atelier), `strict: true` (le défaut, via
  // `from`) et `strict: false` renvoient exactement les mêmes valeurs — la
  // route est alors le seul match avec ces clés de recherche. En usage
  // embarqué (dans ControlTowerShell, sous /cockpit/resilience), cette route
  // n'est PAS active : `useSearch({ from: "/cockpit/atelier" })` lèverait une
  // invariant error ("Could not find an active match"). `strict: false` lit
  // la recherche fusionnée de tout l'arbre de routes actif sans l'exiger, ce
  // qui rend AtelierPage montable hors de sa route sans toucher à son usage
  // normal.
  const search = useSearch({ strict: false }) as {
    sessionId?: string; alertId?: string; finalite?: string; demo?: string; title?: string;
  };

  // L'état initial doit être identique en SSR et dans le navigateur. Les
  // sessions locales sont chargées après l'hydratation pour éviter que React
  // reconstruise entièrement la page Arbitrer.
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sessions, setSessions] = useState<AtelierSession[]>([]);
  const [activeId, setActiveIdRaw] = useState<string | undefined>(undefined);
  // Les changements de session déclenchés depuis l'intérieur d'AtelierPage
  // (nouvelle analyse, clic sur une session, sélecteur…) passent par ce
  // wrapper : en mode embarqué, il répercute le choix vers le parent (la
  // Control Tower) au lieu de dépendre de l'URL de la route.
  const setActiveId = useCallback((id: string | undefined) => {
    setActiveIdRaw(id);
    if (isEmbedded) embeddedSetSessionId?.(id);
  }, [isEmbedded, embeddedSetSessionId]);

  useEffect(() => {
    try {
      garbageCollectSessionData();
      let all = loadSessions();
      if (all.length === 0) {
        const created = newSession({ contextRaw: "" });
        saveSession(created);
        all = [created];
      }
      setSessions(all);
      setActiveIdRaw(isEmbedded ? (embeddedSessionId ?? all[0]?.id) : (search.sessionId ?? all[0]?.id));
    } catch {
      setSessions([]);
      setActiveIdRaw(undefined);
    }
  }, [search.sessionId, isEmbedded, embeddedSessionId]);

  // Porte d'entrée par finalité : ?finalite=produit|strategie|risques|decision
  // crée une session pré-typée — les écrans sont partagés, le vocabulaire suit.
  const finaliteApplied = useRef(false);
  useEffect(() => {
    if (finaliteApplied.current || !search.finalite) return;
    finaliteApplied.current = true;
    const FINALITE_CASE: Record<string, string | undefined> = {
      produit: "nouveau_produit", offre: "nouveau_produit",
      strategie: "strategique", risques: "risque", decision: undefined,
    };
    const caseType = FINALITE_CASE[search.finalite];
    const s = newSession({ contextRaw: consumePendingAuraContext(), title: search.title });
    // La porte d'entrée a déjà typé la décision : Comprendre démarre directement
    // à « La décision à arbitrer » — pas de question redondante.
    const typed = caseType ? { ...s, caseType, elicitation: { step: 1 } } : s;
    saveSession(typed);
    setSessions(loadSessions());
    setActiveId(typed.id);
  }, [search.finalite]);

  // Onboarding : ?demo=<nom> ouvre un exemple complet en un clic —
  // personne ne rencontre Aura devant un formulaire vide.
  // Démo intégrée : telereleve (investissement) ; les autres démos (supply,
  // énergie, stratégie, choix de solution) viennent des packs sectoriels.
  const demoApplied = useRef(false);
  useEffect(() => {
    if (demoApplied.current || !search.demo || !DEMO_FACTORIES[search.demo]) return;
    demoApplied.current = true;
    const DEMO_ID = `demo-${search.demo}`;
    if (!loadSessions().some(x => x.id === DEMO_ID)) {
      saveSession({ ...DEMO_FACTORIES[search.demo](newSession({ contextRaw: "" })), id: DEMO_ID });
    }
    setSessions(loadSessions());
    setActiveId(DEMO_ID);
  }, [search.demo]);

  // Packs sectoriels et cas de conception : le lien de la Galerie crée une
  // copie complète et enrichie, puis l'ouvre sur sa session dédiée.
  const sectorDemoApplied = useRef(false);
  useEffect(() => {
    if (sectorDemoApplied.current || !search.demo || !findSectorCase(search.demo)) return;
    sectorDemoApplied.current = true;
    createSectorCase(search.demo);
  }, [search.demo]);

  const [auraMsgs, setAuraMsgs] = useState<AuraMsg[]>([
    { role: "aura", text: "Bienvenue dans l'Atelier d'analyse. Décrivez votre décision ou chargez une session existante." },
  ]);
  const [auraLoading, setAuraLoading] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("document");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [revueOpen, setRevueOpen] = useState(false);
  const [annotationCount, setAnnotationCount] = useState(0);
  useEffect(() => {
    const update = () => { try { setAnnotationCount((JSON.parse(localStorage.getItem("aura_annotations_v1") ?? "[]") as unknown[]).length); } catch { /* */ } };
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  useEffect(() => onSessionsChange(() => setSessions(loadSessions())), []);

  const session = sessions.find(s => s.id === activeId) ?? sessions[0];

  const [deciderOnboarding, setDeciderOnboarding] = useState<DeciderOnboardingState>({ decrire: false, modele: false, scenario: false, arbitrer: false, dismissed: false });
  useEffect(() => { setDeciderOnboarding(loadDeciderOnboarding()); }, []);
  function markDeciderOnboarding(step: keyof Omit<DeciderOnboardingState, "dismissed">) {
    setDeciderOnboarding(prev => {
      if (prev[step]) return prev;
      const next = { ...prev, [step]: true };
      saveDeciderOnboarding(next);
      return next;
    });
  }
  useEffect(() => { if (session?.contextRaw?.trim() && session.contextRaw.trim().length > 10) markDeciderOnboarding("decrire"); }, [session?.contextRaw]);
  useEffect(() => { if ((session?.criteria?.length ?? 0) > 0) markDeciderOnboarding("modele"); }, [session?.criteria?.length]);
  useEffect(() => { if ((session?.scenarios?.length ?? 0) > 0) markDeciderOnboarding("scenario"); }, [session?.scenarios?.length]);
  // Mode « Décider vite » (dialogue, par défaut) ou « Détail » (parcours complet) : même modèle.
  const [deciderMode, setDeciderModeState] = useState<"dialogue" | "detail">(() => { try { return localStorage.getItem("aura-decider-mode") === "detail" ? "detail" : "dialogue"; } catch { return "dialogue"; } });
  const setDeciderMode = (m: "dialogue" | "detail") => { setDeciderModeState(m); try { localStorage.setItem("aura-decider-mode", m); } catch { /* stockage indisponible */ } };
  useEffect(() => { if (session?.step === "decider" || session?.step === "suivi") markDeciderOnboarding("arbitrer"); }, [session?.step]);
  // Le rapport de la décision ouverte peut être joint aux e-mails des copilotes.
  useEffect(() => {
    if (!session) { setActiveReport(undefined); return; }
    setActiveReport(() => makeDecisionReport(session));
    try { const r = rankOptions(session); setActiveRanking(r.length >= 2 ? { winner: r[0].label, options: r.map(o => o.label) } : undefined); } catch { setActiveRanking(undefined); }
    return () => { setActiveReport(undefined); setActiveRanking(undefined); };
  }, [session]);

  const [pickSession, setPickSession] = useState(false);
  function createNew() {
    const s = newSession({ contextRaw: "", sector: embeddedDefaultSector });
    saveSession(s);
    setActiveId(s.id);
    setSessions(loadSessions());
    setAuraMsgs([{ role: "aura", text: "Nouvelle session créée. Décrivez votre décision pour commencer." }]);
    setMobileTab("document");
    setSidebarCollapsed(false);
    setRenamingSessionId(s.id);
    setRenameDraft("");
  }

  // ── Packs sectoriels ────────────────────────────────────────────────
  // Trois décisions déjà structurées avec le vocabulaire du secteur. L'utilisateur
  // corrige un modèle au lieu de l'écrire : le cadrage passe de la séance à la
  // dizaine de minutes. Aucune valeur n'est une mesure réelle — jugements de
  // cadrage, ordinaux, tous éditables.
  function createSectorCase(key: string) {
    const found = findSectorCase(key);
    if (!found) return;
    const k = enrichDecisionDemoCase(found.c);
    const base = newSession({ contextRaw: k.contextRaw, criteria: k.criteria, scenarios: k.scenarios });
    const withStep: AtelierSession = {
      ...base, title: k.title, step: "decider" as const, caseType: k.caseType,
      modelValidated: true, sector: found.sector, leviersDef: k.leviersDef,
      elicitation: buildDemoElicitation(k),
    };
    saveSession(withStep);
    window.location.href = `/cockpit/atelier?sessionId=${withStep.id}`;
  }

  // Fusionne toujours contre la dernière version PERSISTÉE de la session, pas
  // contre la variable `session` fermée dans le rendu qui a créé cette
  // fonction. Sans ça, deux mises à jour proches dans le temps (un clic
  // utilisateur, puis une inférence LLM qui répond un peu plus tard) partent
  // chacune d'un instantané `session` différent : la seconde écrase
  // silencieusement ce que la première venait d'écrire (ex. le type de
  // décision "oublié" après un aller-retour, ou le panneau "Ce qu'Aura
  // comprend" qui revient en arrière pendant que l'utilisateur tape).
  function updateSession(patch: Partial<AtelierSession>) {
    if (!activeId) return;
    const current = loadSessions().find(s => s.id === activeId) ?? session;
    if (!current) return;
    saveSession({ ...current, ...patch });
    setSessions(loadSessions());
  }

  function goStep(step: AtelierStep) {
    updateSession({ step });
  }

  const stepProps = session ? { session, onUpdate: updateSession, setAuraMsgs, setAuraLoading, embeddedSuggestions: isEmbedded ? embeddedSuggestions : undefined, embeddedDomainExpertise: isEmbedded ? embeddedDomainExpertise : undefined } : null;

  // ── Attitude pill (persistent in header) ──────────────────────────────────

  const stepDotColor: Record<AtelierStep, string> = {
    comprendre: "#6366f1",
    impacter: "#0ea5e9",
    composer: "#f59e0b",
    decider: "#10b981",
    suivi: "#059669",
  };

  return (
    <div style={{
      display: "flex", height: isEmbedded ? "100%" : "100vh", overflow: "hidden",
      background: "var(--v4-surface)", backgroundImage: "radial-gradient(#7c3aed0f 1px, transparent 1px)", backgroundSize: "26px 26px",
    }}>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div onClick={() => setMobileSidebarOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 199 }} />
      )}
      {/* Left sidebar */}
      <aside className={`atelier-sidebar${mobileSidebarOpen ? " atelier-sidebar--open" : ""}`}
        style={{ width: sidebarCollapsed ? 48 : 200, flexShrink: 0, borderRight: "1px solid var(--v4-border)", display: "flex", flexDirection: "column", position: "sticky", top: 0, height: isEmbedded ? "100%" : "100vh", overflow: "hidden", background: "var(--v4-surface)", transition: "width .2s", zIndex: 200 }}>
        {/* Brand */}
        <div style={{ padding: sidebarCollapsed ? "14px 0" : "14px 12px", borderBottom: "1px solid var(--v4-border)", display: "flex", alignItems: "center", justifyContent: sidebarCollapsed ? "center" : "space-between" }}>
          {!sidebarCollapsed && (
            <a href="/cockpit/home" style={{ textDecoration: "none" }}>
              <AuraLogo size="sm" product="Décider" />
            </a>
          )}
          {sidebarCollapsed && <a href="/cockpit/home" style={{ textDecoration: "none", fontSize: 14 }}>◎</a>}
          <button onClick={() => setSidebarCollapsed(p => !p)}
            style={{ border: "none", background: "none", cursor: "pointer", color: "var(--v4-text3)", fontSize: 13, padding: "2px 4px", flexShrink: 0 }}>
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Retour toujours visible vers le Copilote Décideur — l'arbitrage est
            ouvert depuis là (bouton "Ouvrir l'arbitrage" sur une carte de
            décision) ; ce lien garantit qu'on peut toujours y revenir, sans
            dépendre de l'historique du navigateur. */}
        <a href="/cockpit/copilote-decideur"
          style={{ display: "flex", alignItems: "center", gap: sidebarCollapsed ? 0 : 6, justifyContent: sidebarCollapsed ? "center" : "flex-start", padding: sidebarCollapsed ? "9px 0" : "9px 12px", textDecoration: "none", color: "var(--v4-accent)", fontSize: 13, fontWeight: 700, borderBottom: "1px solid var(--v4-border)" }}
          title="Retour au Copilote Décideur">
          <span style={{ fontSize: 13 }}>←</span>
          {!sidebarCollapsed && <span>Copilote Décideur</span>}
        </a>

        {/* + Nouvelle analyse */}
        {!sidebarCollapsed && (
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--v4-border)" }}>
            <button onClick={createNew} style={{ width: "100%", padding: "7px 12px", border: "none", borderRadius: 8, background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              + Nouvelle analyse
            </button>
          </div>
        )}

        {/* Sessions list */}
        <div style={{ flex: 1, overflowY: "auto", padding: sidebarCollapsed ? "10px 4px" : "10px 8px" }}>
          {!sidebarCollapsed && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--v4-text3)", textTransform: "uppercase" as const, letterSpacing: "0.08em", padding: "4px 6px 8px" }}>Études décisionnelles</div>}
          {sessions.map(s => {
            const isActive = s.id === (activeId ?? sessions[0]?.id);
            const dotColor = stepDotColor[s.step] ?? "#6366f1";
            const isRenaming = renamingSessionId === s.id;
            return (
              <div key={s.id}
                onClick={() => !isRenaming && setActiveId(s.id)}
                onDoubleClick={() => { if (!sidebarCollapsed) { setRenamingSessionId(s.id); setRenameDraft(s.title || "Nouvelle analyse"); } }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: sidebarCollapsed ? "6px 0" : "6px 10px",
                  borderRadius: 8, cursor: "pointer",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                  borderLeft: isActive ? `3px solid var(--v4-accent)` : "3px solid transparent",
                  background: isActive ? "var(--v4-bg)" : "transparent",
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--v4-bg)"; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                {!sidebarCollapsed && (
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isRenaming ? (
                      <input
                        autoFocus
                        value={renameDraft}
                        placeholder="Nom de la décision…"
                        onClick={e => e.stopPropagation()}
                        onChange={e => setRenameDraft(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Enter") {
                            const title = renameDraft.trim();
                            if (title) { saveSession({ ...s, title }); setSessions(loadSessions()); }
                            setRenamingSessionId(null);
                          } else if (e.key === "Escape") {
                            setRenamingSessionId(null);
                          }
                        }}
                        onBlur={() => {
                          const title = renameDraft.trim();
                          if (title) { saveSession({ ...s, title }); setSessions(loadSessions()); }
                          setRenamingSessionId(null);
                        }}
                        style={{ width: "100%", fontSize: 13, fontWeight: 600, color: "var(--v4-text)", border: "1px solid var(--v4-accent)", borderRadius: 6, padding: "1px 4px", fontFamily: "inherit", background: "var(--v4-surface)" }}
                      />
                    ) : (
                      <div title="Double-cliquer pour renommer" style={{ fontSize: 13, fontWeight: 600, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title || "Nouvelle analyse"}</div>
                    )}
                    <div style={{ fontSize: 12, color: "var(--v4-text3)", display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ textTransform: "capitalize" as const }}>{s.step}</span>
                      <span>·</span>
                      <span title={`Créée le ${new Date(s.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}>
                        {new Date(s.updatedAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      </span>
                      {!isRenaming && (
                        <button
                          onClick={e => { e.stopPropagation(); setRenamingSessionId(s.id); setRenameDraft(s.title || ""); }}
                          title="Renommer"
                          style={{ marginLeft: "auto", border: "none", background: "none", color: "var(--v4-text3)", cursor: "pointer", fontSize: 12.5, padding: "0 2px", fontFamily: "inherit", opacity: 0.7 }}>
                          ✎
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Les démos sont désormais des packs visuels dans une galerie dédiée :
              un accès unique remplace les longues listes concurrentes. */}
          {!sidebarCollapsed && (
            <a href="/cockpit/demos" style={{
              display: "flex", alignItems: "center", gap: 10, marginTop: 14, padding: "11px 12px",
              borderRadius: 8, textDecoration: "none", color: "var(--v4-text)",
              background: "transparent", border: "1px solid var(--v4-border)",
              boxShadow: "none"
            }}>
              <span style={{ width: 30, height: 30, borderRadius: 8, display: "grid", placeItems: "center", background: "var(--v4-bg)", fontSize: 13, color: "var(--v4-accent)" }}>◆</span>
              <span style={{ flex: 1 }}>
                <strong style={{ display: "block", fontSize: 13 }}>Packs de démonstration</strong>
                <small style={{ display: "block", marginTop: 2, color: "var(--v4-text3)", fontSize: 13 }}>Cas prêts à explorer</small>
              </span>
              <span>→</span>
            </a>
          )}

          {/* Section Outils retirée : Argus, Playbooks, Turbo EA et Architecturer
              sortent de la navigation — Aura, c'est un seul parcours : la décision.
              Les routes restent accessibles par lien direct. */}
        </div>

        {/* Bottom */}
        <div style={{ padding: sidebarCollapsed ? "8px 4px" : "8px 8px", borderTop: "1px solid var(--v4-border)" }}>
          {/* Onboarding de l'application : script pédagogique lu à voix haute,
              fermeture par la croix, Échap ou clic à l'extérieur. */}
          <div style={{ marginBottom: 8 }}>
            <CommentCaMarcheLink app="decider" collapsed={sidebarCollapsed} />
          </div>
          {[
            { icon: "↓", label: "Import", href: "#" },
            { icon: "↑", label: "Export", href: "#" },
            { icon: "", label: "Paramètres", href: "#" },
          ].map(link => (
            <a key={link.label} href={link.href}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: sidebarCollapsed ? "8px 0" : "7px 10px", borderRadius: 8, textDecoration: "none", color: "var(--v4-text3)", fontSize: 13, fontWeight: 500, justifyContent: sidebarCollapsed ? "center" : "flex-start" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "var(--v4-bg)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}>
              <span style={{ fontSize: 13, flexShrink: 0 }}>{link.icon}</span>
              {!sidebarCollapsed && <span>{link.label}</span>}
            </a>
          ))}
        </div>
      </aside>

      {/* Main content column */}
      <div className="atelier-main" style={{ flex: 1, minWidth: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
        {/* Rappel de revue de décision — bandeau normal, dans le flux (ne recouvre plus la barre du haut).
            Invisible tant qu'aucune décision n'arrive à son horizon de revue. */}
        <div style={{ padding: "0 28px" }}><RappelsRevue space="decider" /></div>
        {/* Topbar: attitude pill + nouvelle session */}
        <div className={`atelier-topbar${isEmbedded ? "" : " aura-hero-band atelier-topbar-hero"}`} style={{
          position: "sticky", top: 0, zIndex: 10,
          background: "var(--v4-surface)", borderBottom: "1px solid var(--v4-border)", overflow: "visible",
          padding: "8px 24px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8,
        }}>
          {/* Hamburger — mobile only */}
          <button className="atelier-hamburger" onClick={() => setMobileSidebarOpen(p => !p)}
            style={{ display: "none", border: "none", background: "none", cursor: "pointer", color: "var(--v4-text)", fontSize: 15.5, padding: "2px 4px", flexShrink: 0 }}>☰</button>
          <div className="atelier-topbar-title" style={{ flex: "1 1 220px", minWidth: 160, fontSize: 13, fontWeight: 700, color: "var(--v4-text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 12 }}>
            {session && renamingSessionId === session.id ? (
              <input
                autoFocus
                value={renameDraft}
                placeholder="Nom de la décision…"
                onChange={e => setRenameDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const title = renameDraft.trim();
                    if (title) updateSession({ title });
                    setRenamingSessionId(null);
                  } else if (e.key === "Escape") setRenamingSessionId(null);
                }}
                onBlur={() => {
                  const title = renameDraft.trim();
                  if (title) updateSession({ title });
                  setRenamingSessionId(null);
                }}
                style={{ fontSize: 13, fontWeight: 700, color: "var(--v4-text)", border: "1px solid var(--v4-accent)", borderRadius: 6, padding: "2px 6px", fontFamily: "inherit", background: "var(--v4-bg)", minWidth: 180 }}
              />
            ) : (
              <>
                <span>{session?.title || "Nouvelle analyse"}</span>
                {session && (
                  <button
                    onClick={() => { setRenamingSessionId(session.id); setRenameDraft(session.title || ""); }}
                    title="Renommer cette décision"
                    style={{ border: "none", background: "none", color: "var(--v4-text3)", cursor: "pointer", fontSize: 13, padding: "0 2px", fontFamily: "inherit", opacity: 0.7, flexShrink: 0 }}>
                    ✎
                  </button>
                )}
              </>
            )}
            {session?.alertLabel && (
              <span style={{ marginLeft: 8, fontSize: 12, padding: "2px 8px", borderRadius: 8, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>
                 {session.alertLabel.slice(0, 30)}
              </span>
            )}
          </div>
          {/* Épuré : la liste des décisions s'ouvre à la demande. */}
          {pickSession ? <select autoFocus value={activeId ?? ""} onChange={event => { setActiveId(event.target.value); setPickSession(false); }} onBlur={() => setPickSession(false)}
            aria-label="Choisir une décision" className="atelier-topbar-select"
            style={{ maxWidth: 190, padding: "5px 9px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "#fff", color: "var(--v4-text2)", fontSize: 12.5, fontFamily: "inherit" }}>
            {sessions.map(item => <option key={item.id} value={item.id}>{item.title || "Décision sans titre"}</option>)}
          </select> : <button type="button" onClick={() => setPickSession(true)} aria-label="Choisir une décision" title="Choisir une autre décision"
            style={{ padding: "5px 10px", borderRadius: 8, border: "1px solid var(--v4-border)", background: "#fff", color: "var(--v4-text2)", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>⇄ {sessions.length}</button>}
          <button onClick={createNew} data-testid="atelier-new-decision"
            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "var(--aura-ink,#15121f)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 6px rgba(0,0,0,0.12)", whiteSpace: "nowrap" }}>
            + Nouvelle décision
          </button>
          <AtelierOutilsMenu
            attitude={session?.attitude}
            onAttitude={att => updateSession({ attitude: att })}
            annotationCount={annotationCount}
            annotationsOpen={annotationPanelOpen}
            onAnnotations={() => setAnnotationPanelOpen(v => !v)}
            onRevue={() => setRevueOpen(true)}
          />
          <PlanifierRevue space="decider" titreDefaut={session?.title} sansBouton ouvert={revueOpen} onOuvertChange={setRevueOpen} />
        </div>
        {annotationPanelOpen && session && (
          <AnnotationPanel
            sessionId={session.id}
            sessionTitle={session.title || "Sans titre"}
            currentStep={session.step}
            onClose={() => { setAnnotationPanelOpen(false); setAnnotationCount(loadAnnotations().length); }}
          />
        )}

        {/* Content */}
        <div className="atelier-content" style={{ maxWidth: 1100, margin: "0 auto", padding: "14px 28px 24px", width: "100%" }}>
          {session && stepProps ? (
            <>
              {/* Parcours commun à Décider autonome et à Décider depuis Supply :
                  Comprendre → Impacter → Explorer / Résultat → Suivre. */}
              <ModeSwitch mode={deciderMode} onChange={setDeciderMode} />
              {deciderMode === "dialogue" ? (<>
                <ParcoursStepBar session={session} onGo={st => { setDeciderMode("detail"); goStep(st); }} />
                <DecisionDialogue key={`dlg-${session.id}`} session={session} onUpdate={updateSession}
                  onDetail={() => { setDeciderMode("detail"); updateSession({ step: "comprendre" }); }}
                  onFollow={id => { void retainDecision(session, id).then(followUp => { updateSession({ retainedScenarioId: id, followUp, step: "suivi" }); setDeciderMode("detail"); }); }}
                  onReport={() => { void makeDecisionReport(session).then(({ filename, bytes }) => { audit("export", filename); const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" })); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }); }} />
              </>) : <>
              <ParcoursStepBar session={session} onGo={goStep} />
              <div style={{ marginTop: 10 }}>
                {session.step === "comprendre" && (
                  <StepComprendre key={session.id} {...stepProps} onNext={() => updateSession({ step: "impacter" })} />
                )}
                {(session.step === "impacter" || session.step === "composer") && (
                  <StepTabs key={`imp-${session.id}`} label="Vue d'Impacter" initial={session.step === "composer" ? "scenarios" : "matrice"}
                    tabs={[
                      { id: "matrice", label: "Matrice", render: () => <StepImpacter key={`i-${session.id}`} {...stepProps} onNext={() => updateSession({ step: "decider" })} onBack={() => updateSession({ step: "comprendre" })} /> },
                      { id: "arbre", label: "Arbre", render: () => <ImpactTree session={session} onUpdate={updateSession} /> },
                      { id: "scenarios", label: "Scénarios", render: () => <StepComposer key={`c-${session.id}`} {...stepProps} onNext={() => updateSession({ step: "decider" })} onBack={() => updateSession({ step: "impacter" })} /> },
                    ]}
                    footer={session.alertId ? <button type="button" className="dp-link" disabled={session.scenarios.length < 1} onClick={() => updateSession({ step: "decider" })}>Voir le résultat →</button> : undefined} />
                )}
                {session.step === "decider" && (
                  <StepTabs key={`dec-${session.id}`} label="Vue du résultat" initial="resultat"
                    tabs={[
                      { id: "resultat", label: "Résultat", render: () => <StepDecider key={session.id} {...stepProps} onBack={() => updateSession({ step: "impacter" })} /> },
                      { id: "explorer", label: "Explorer les solutions", render: () => <SolutionExplorer session={session} onUpdate={updateSession}
                        onRetain={(id, patch) => { const next = { ...session, ...(patch ?? {}) }; void retainDecision(next, id).then(followUp => updateSession({ ...(patch ?? {}), retainedScenarioId: id, followUp, step: "suivi" })); }} /> },
                    ]} />
                )}
                {session.step === "suivi" && (
                  <StepTabs key={`suivi-${session.id}`} label="Vue du suivi" initial="tableau" footer={<><ReportButton session={session} /> <MiniReportButton session={session} /></>}
                    tabs={[
                      { id: "tableau", label: "Tableau de bord", render: () => <StepSuivi key={session.id} session={session} onUpdate={updateSession} onBack={() => updateSession({ step: "decider" })} /> },
                      { id: "kr", label: "Résultats clés (mesure)", render: () => <StepFollow session={session} onUpdate={updateSession} liveValue={liveKrValue}
                        onStart={id => { void retainDecision(session, id).then(followUp => updateSession({ retainedScenarioId: id, followUp })); }}
                        onRevise={() => updateSession({ previousFollowUps: [...(session.previousFollowUps ?? []), ...(session.followUp ? [session.followUp] : [])], followUp: undefined, step: "impacter" })} /> },
                    ]} />
                )}
              </div>
              </>}
            </>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 320, gap: 14, background: "var(--v4-surface)", border: "1px solid var(--v4-border)", borderRadius: 8, padding: "40px 20px" }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: "var(--v4-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17.5 }}>
                <AuraIcon e="🧭" size={20} />
              </div>
              <div style={{ color: "var(--v4-text2)", fontSize: 13, fontWeight: 600 }}>Aucune analyse en cours</div>
              <div style={{ color: "var(--v4-text3)", fontSize: 13, maxWidth: 320, textAlign: "center", lineHeight: 1.5 }}>
                Démarrez une nouvelle décision à arbitrer, ou ouvrez l’un des packs prêts à l’emploi depuis « Packs & démos ».
              </div>
              <button onClick={createNew} style={{ padding: "9px 22px", borderRadius: 8, border: "none", background: "var(--v4-accent,#7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                + Nouvelle analyse
              </button>
            </div>
          )}
        </div>
        <style>{`
          @keyframes atelier-dots {
            0%,80%,100%{opacity:0} 40%{opacity:1}
          }
          /* Le dialogue global porte désormais la navigation. L'ancien rail
             reste dans le composant pour préserver ses commandes, mais ne
             consomme plus d'espace ni ne crée une troisième colonne. */
          .atelier-sidebar { display: none !important; }
          .atelier-hamburger { display: none !important; }
          @media print {
            .v4-shell > nav, .v4-shell > .v4-mobile-topbar { display: none !important; }
          }
          .comprendre-grid { grid-template-columns: 1fr 1fr; }

          /* ── Tablet (≤ 900px) ─────────────────────────────────────── */
          @media (max-width: 900px) {
            .comprendre-grid { grid-template-columns: 1fr !important; }
            .atelier-content { padding: 16px 16px !important; }
            .atelier-topbar  { padding: 8px 16px !important; }
          }

          /* ── Mobile (≤ 640px) ─────────────────────────────────────── */
          @media (max-width: 640px) {
            /* Sidebar becomes a fixed drawer */
            .atelier-sidebar {
              position: fixed !important;
              left: -220px !important;
              top: 0 !important;
              height: 100vh !important;
              width: 200px !important;
              transition: left .25s ease !important;
              z-index: 200 !important;
            }
            .atelier-sidebar--open {
              left: 0 !important;
            }
            /* Main takes full width */
            .atelier-main { width: 100% !important; min-width: 0 !important; }
            .atelier-topbar { padding: 8px 12px !important; gap: 8px !important; position: static !important; }
            .atelier-topbar-title { flex: 1 1 100% !important; white-space: normal !important; min-width: 0 !important; }
            .atelier-topbar-title > span:first-child { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
            .atelier-topbar-select { flex: 1 1 140px; max-width: none !important; min-width: 0; }
            .atelier-hamburger { display: flex !important; }
            .atelier-content { padding: 14px 12px !important; }

            /* Barre d'étapes : passe à la ligne (jamais de défilement caché) */
            .atelier-stepbar {
              flex-wrap: wrap !important;
              justify-content: flex-start !important;
              gap: 4px !important;
              padding: 6px 0 10px !important;
            }
            .atelier-stepbar > div > button { padding: 8px 10px !important; min-height: 40px; }
            .atelier-stepbar > div > span:last-child:not(:first-child) { display: none !important; }

            /* Stack layout rows */
            .atelier-analyse-row { flex-direction: column !important; }
            .atelier-scenarios-grid { grid-template-columns: 1fr !important; }

            /* Tables scrollable */
            .atelier-table-wrap { overflow-x: auto !important; }

            /* Suivi: stack cards */
            .atelier-suivi-grid { grid-template-columns: 1fr !important; }
            .atelier-suivi-pills { flex-wrap: wrap !important; }

            /* OKR cards: full width */
            .atelier-okr-grid { grid-template-columns: 1fr !important; }

            /* Reduce font sizes slightly */
            .atelier-content h2 { font-size: 18px !important; }
          }
        `}</style>
      </div>
    </div>
  );
}

// Menu « ⋯ » de la barre d'outils de l'atelier : regroupe l'attitude
// (Pessimiste/Optimiste), les annotations et la programmation de revue.
// Accessible : bouton aria-haspopup/aria-expanded, rôle menu, fermeture au
// clic extérieur et à Échap (focus rendu au bouton).
function AtelierOutilsMenu({ attitude, onAttitude, annotationCount, annotationsOpen, onAnnotations, onRevue }: {
  attitude?: "Pessimiste" | "Optimiste";
  onAttitude: (a: "Pessimiste" | "Optimiste") => void;
  annotationCount: number; annotationsOpen: boolean;
  onAnnotations: () => void; onRevue: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); btnRef.current?.focus(); } };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    rootRef.current?.querySelector<HTMLElement>("[role=menuitemradio],[role=menuitem]")?.focus();
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={rootRef} className="aura-tools-menu">
      <button ref={btnRef} type="button" className="aura-tools-trigger" aria-haspopup="menu" aria-expanded={open}
        aria-label="Plus d'outils" title="Plus d'outils" onClick={() => setOpen(v => !v)}>
        ⋯{annotationCount > 0 && <span className="aura-tools-badge">{annotationCount}</span>}
      </button>
      {open && (
        <div role="menu" aria-label="Outils de la décision" className="aura-tools-panel">
          {attitude && <>
            <div className="aura-tools-label">Attitude face au risque</div>
            {(["Pessimiste", "Optimiste"] as const).map(att => (
              <button key={att} type="button" role="menuitemradio" aria-checked={attitude === att}
                onClick={() => { onAttitude(att); setOpen(false); }}>
                <span aria-hidden="true" className="aura-tools-check">{attitude === att ? "●" : "○"}</span>{att}
              </button>
            ))}
            <hr />
          </>}
          <button type="button" role="menuitem" aria-pressed={annotationsOpen} onClick={() => { onAnnotations(); setOpen(false); }}>
            <span aria-hidden="true" className="aura-tools-check">✎</span>Annotations{annotationCount > 0 && <span className="aura-tools-badge">{annotationCount}</span>}
          </button>
          <button type="button" role="menuitem" onClick={() => { onRevue(); setOpen(false); }}>
            <span aria-hidden="true" className="aura-tools-check">◷</span>Programmer la revue
          </button>
        </div>
      )}
    </div>
  );
}
