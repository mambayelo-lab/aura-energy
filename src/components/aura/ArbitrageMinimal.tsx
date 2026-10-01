import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight,
  CircleDot, GitBranch, HelpCircle, Play, RefreshCcw, ShieldCheck, SlidersHorizontal, Sparkles, Target,
} from "lucide-react";
import {
  bipolarCompare, dominanceReport, rankUnder, robustnessReport,
  type ArbCells, type ArbCriterion, type ArbScenario,
} from "../../lib/v4/arbitrage-analytics";
import { loadSessions, type AtelierCriterion, type AtelierOptionDef, type AtelierScenario, type AtelierSession } from "../../lib/v4/atelier-store";
import { aggregateHierarchy, importanceToWeight } from "../../lib/v4/atelier-compute";
import { EXHAUSTIVE_LIMIT } from "../../lib/v4/exhaustive-search";
import { COMPLETENESS_MIN, impactCompleteness, impactsToComplete, suggestedOptionIds, withoutSuggestedOptions } from "../../lib/v4/decision-express";
import { computeOutcomeLattice, evaluateCombo as evaluateComboLib, lexCompare, scenarioFromCombo as scenarioFromComboLib } from "../../lib/v4/arbitrage-lattice";
import type { Attitude, OrdinalImpact, OrdinalLevel } from "../../lib/engine/lo/types";
import {
  culpritLevers, findMinimalRepairs, findMinimalRepairsReport, globalVetoBreaches, traceBlockingBranch,
} from "../../lib/v4/goalseek-verify";
import { explainAlternative } from "../../lib/v4/atelier-llm";

const LEVEL = ["N", "L", "M", "H"] as const;
const LEVEL_LONG = ["Nul", "Faible", "Moyen", "Haut"] as const;
const IMPACT_LABEL: Record<string, string> = { "++": "++", "+": "+", "0": "0", "-": "−", "--": "−−", U: "?" };

// Onglets d'Arbitrer : "Expliquer" (chaîne de décision) a été fusionné dans
// "Évaluer" — c'est explicitement documenté ailleurs dans ce fichier comme
// "les mêmes calculs, une autre vue", donc il n'apporte rien à isoler dans
// un onglet séparé. Cela ramène 4 onglets à 3, sans rien retirer : la chaîne
// reste accessible en un clic, repliée par défaut pour ne pas alourdir la
// première vue.
type View = "evaluer" | "tester" | "decision";
type AlternativeExplanation = { forces: string[]; risques: string[]; autres: string[] };
type Props = {
  onCompleteImpacts?: () => void;
  scenarios: ArbScenario[];
  criteria: ArbCriterion[];
  cells: ArbCells;
  title: string;
  retenuId?: string;
  rationale?: string;
  participants?: string[];
  completude?: string;
  chaine?: unknown[];
  /** Session complète de l'atelier — passée directement par la page Décider quand disponible,
   *  pour garantir que Backward/Tester/Expliquer/le treillis lisent exactement la session en cours
   *  d'édition, plutôt qu'une reconstruction par correspondance de titre (repli ci-dessous, conservé
   *  pour les intégrations qui ne peuvent pas encore la transmettre). */
  session?: AtelierSession;
  /** Actions de page (Exporter PDF, Partager, Valider…) — rendues dans l'en-tête d'Arbitrer plutôt
   *  que dans une barre séparée au-dessus, pour ne pas dupliquer une ligne d'espace vertical. */
  actions?: React.ReactNode;
  /** Fiche de décision déjà signée pour cette session, si elle existe. */
  decisionRecord?: { scenarioId: string; conditions: string[]; preuves: string[]; hypotheses: string[]; fallbackScenarioId?: string; signedAt: string };
  /** Persiste la fiche de décision signée — jamais appelé automatiquement, uniquement sur clic explicite. */
  onSign?: (record: { scenarioId: string; conditions: string[]; preuves: string[]; hypotheses: string[]; fallbackScenarioId?: string; signedAt: string }) => void;
};
type BackwardEval = {
  perCrit: Record<string, { gPlus: OrdinalLevel; dMinus: OrdinalLevel }>;
  global: { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
};
type RepairWithEval = { repair: ReturnType<typeof findMinimalRepairs>[number]; evaluation: BackwardEval; vetoes: string[] };
type BackwardModel = {
  target: AtelierCriterion;
  base: BackwardEval;
  traceLabels: string[];
  blockerLeaf: string;
  culprits: ReturnType<typeof culpritLevers>;
  repairs: RepairWithEval[];
  /** false si la recherche exhaustive a atteint EXHAUSTIVE_LIMIT (résultat dans les limites de recherche). */
  repairsComplete: boolean;
  reachedAlready: boolean;
  /** Quand aucune réparation n'atteint la cible : la limite réelle — meilleur effort
   *  combiné sur les leviers identifiés, rejoué par le même calcul (jamais fabriqué). */
  limit: { evaluation: BackwardEval; vetoes: string[]; leversUsed: string[] } | null;
  /** Combien de combinaisons (sur le total exploré) atteignent la cible, et laquelle
   *  Aura recommande parmi celles qui l'atteignent sans créer de nouveau point bloquant. */
  scan: {
    totalCombinations: number; exhaustive: boolean; reaching: number; reachingAdmissible: number;
    distinctAdmissibleSets: number;
    best: { changes: { leverLabel: string; optionLabel: string }[]; global: BackwardEval["global"] } | null;
    /** Jusqu'à 6 alternatives distinctes (par set de leviers changés) qui atteignent la
     *  cible sans nouveau point bloquant, triées de la meilleure à la moins bonne. */
    alternatives: { changes: { leverLabel: string; optionLabel: string }[]; global: BackwardEval["global"] }[];
    /** Le meilleur niveau atteignable sur le point visé, en restant admissible, même
     *  au-delà de ce qui a été demandé — et ce qui bloque d'aller plus loin, le cas échéant. */
    ceiling: { gPlus: OrdinalLevel; dMinus: OrdinalLevel; blockerLeaf: string; leversInvolved: string[] } | null;
  } | null;
};
function findCriterion(nodes: AtelierCriterion[], id: string): AtelierCriterion | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findCriterion(node.children ?? [], id);
    if (child) return child;
  }
  return undefined;
}
function safeCell(cells: ArbCells, scenarioId: string, criterionId: string): OrdinalImpact {
  return cells[scenarioId]?.[criterionId] ?? { gPlus: 0, dMinus: 0 };
}
function copyCells(source: ArbCells): ArbCells {
  return Object.fromEntries(Object.entries(source).map(([sid, perCrit]) => [sid,
    Object.fromEntries(Object.entries(perCrit).map(([cid, v]) => [cid, { gPlus: v.gPlus, dMinus: v.dMinus }]))]));
}
function importanceLabel(level: number) {
  return level >= 3 ? "Critique" : level === 2 ? "Élevée" : level === 1 ? "Moyenne" : "Faible";
}
function findPath(nodes: AtelierCriterion[], id: string, path: AtelierCriterion[] = []): AtelierCriterion[] | null {
  for (const node of nodes) {
    const next = [...path, node];
    if (node.id === id) return next;
    const nested = findPath(node.children ?? [], id, next);
    if (nested) return nested;
  }
  return null;
}
// Évaluation forward d'une configuration et treillis : module pur partagé
// (src/lib/v4/arbitrage-lattice.ts), testé contre une énumération indépendante.
const scenarioFromCombo = scenarioFromComboLib;
function evaluateCombo(session: AtelierSession, scenario: AtelierScenario, combo: Record<string, string>): BackwardEval {
  return evaluateComboLib(session, scenario, combo);
}
/** Petite bulle d'aide cliquable (fonctionne au tactile, contrairement à un simple
 *  title au survol) — pour les quelques notions qui ne se devinent pas d'elles-mêmes. */
function HelpTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return <span className="am-help" ref={ref}>
    <button type="button" className="am-help-btn" aria-label="Aide" title={text} aria-expanded={open} onClick={() => setOpen(v => !v)}><HelpCircle size={14}/></button>
    {open && <span className="am-help-pop" role="tooltip">{text}</span>}
  </span>;
}
function LevelPair({ value }: { value: OrdinalImpact }) {
  return <span className="am-pair"><b className="plus">↑ {LEVEL_LONG[value.gPlus]}</b><b className="minus">↓ {LEVEL_LONG[value.dMinus]}</b></span>;
}
/** Barres de potentiel/risque — un classement se lit d'un coup d'œil, pas seulement en toutes lettres. */
function LevelBars({ value }: { value: OrdinalImpact }) {
  return <span className="am-bars">
    <span className="am-bars-row"><small>Potentiel</small><span className="am-bars-track">{[0,1,2,3].map(i=><i key={i} className={i<=value.gPlus?"on plus":""}/>)}</span><b className="plus">{LEVEL_LONG[value.gPlus]}</b></span>
    <span className="am-bars-row"><small>Risque</small><span className="am-bars-track">{[0,1,2,3].map(i=><i key={i} className={i<=value.dMinus?"on minus":""}/>)}</span><b className="minus">{LEVEL_LONG[value.dMinus]}</b></span>
  </span>;
}
/** Règle visuelle Nul→Haut avec repères Actuel / Visé / Plafond réel — se lit
 *  d'un coup d'œil, sans avoir à comparer trois chiffres dans du texte. */
function LevelRuler({ current, target, ceiling }: { current: OrdinalLevel; target: OrdinalLevel; ceiling?: OrdinalLevel }) {
  return <div className="am-ruler">
    <div className="am-ruler-track">
      {[0,1,2,3].map(i => <div key={i} className={`am-ruler-seg ${i<=current?"cur":""}`}>
        {i===current && <b className="mk mk-cur" title="Niveau actuel">●</b>}
        {i===target && i!==current && <b className="mk mk-tgt" title="Niveau visé">◆</b>}
        {i===target && i===current && <b className="mk mk-tgt-on-cur" title="Niveau visé">◆</b>}
        {ceiling!==undefined && i===ceiling && i!==target && i!==current && <b className="mk mk-ceil" title="Plafond réel">▲</b>}
      </div>)}
    </div>
    <div className="am-ruler-labels">{LEVEL_LONG.map(l=><span key={l}>{l}</span>)}</div>
    <div className="am-ruler-legend"><span><i className="dot cur"/>Actuel</span><span><i className="dot tgt"/>Visé</span>{ceiling!==undefined && <span><i className="dot ceil"/>Plafond réel<HelpTip text="Le meilleur niveau vraiment atteignable sur ce point avec les leviers du modèle, sans jamais créer de point bloquant ailleurs — même si vous visiez plus haut."/></span>}</div>
  </div>;
}
function bipolarTone(v: OrdinalImpact): { sym: string; color: string; bg: string; border: string } {
  if (v.gPlus > 0 && v.dMinus > 0) return { sym: "△", color: "#7c3aed", bg: "#ede9fe", border: "#c4b5fd" };
  if (v.gPlus >= 3) return { sym: "++", color: "#059669", bg: "#d1fae5", border: "#6ee7b7" };
  if (v.gPlus >= 1) return { sym: "+", color: "#16a34a", bg: "#dcfce7", border: "#86efac" };
  if (v.dMinus >= 3) return { sym: "−−", color: "#dc2626", bg: "#fee2e2", border: "#fca5a5" };
  if (v.dMinus >= 1) return { sym: "−", color: "#ea580c", bg: "#fff7ed", border: "#fdba74" };
  return { sym: "0", color: "#d97706", bg: "#fef3c7", border: "#fcd34d" };
}
const SK_ROW_H = 30, SK_GAP = 5, SK_CONNECTOR_W = 30;
function SankeyConnector({ leftCount, rightCount, links }: { leftCount: number; rightCount: number; links: Array<[number, number]> }) {
  const totalLeftH = leftCount * SK_ROW_H + Math.max(0, leftCount - 1) * SK_GAP;
  const totalRightH = rightCount * SK_ROW_H + Math.max(0, rightCount - 1) * SK_GAP;
  const svgH = Math.max(totalLeftH, totalRightH, SK_ROW_H);
  const leftCenter = (i: number) => SK_ROW_H / 2 + i * (SK_ROW_H + SK_GAP) + (svgH - totalLeftH) / 2;
  const rightCenter = (i: number) => SK_ROW_H / 2 + i * (SK_ROW_H + SK_GAP) + (svgH - totalRightH) / 2;
  return <svg width={SK_CONNECTOR_W} height={svgH} className="am-sk-connector" viewBox={`0 0 ${SK_CONNECTOR_W} ${svgH}`}>
    {links.map(([li, ri], k) => { const y1 = leftCenter(li), y2 = rightCenter(ri);
      return <path key={k} d={`M0,${y1} C${SK_CONNECTOR_W * 0.4},${y1} ${SK_CONNECTOR_W * 0.6},${y2} ${SK_CONNECTOR_W},${y2}`} fill="none" stroke="#6d5ce8" strokeWidth={1.6} strokeOpacity={0.55}/>; })}
  </svg>;
}
function SankeyCol({ title, items, input }: { title: string; items: { id: string; label: string; sub?: string; value: OrdinalImpact }[]; input?: boolean }) {
  return <div className="am-sk-col">
    <div className="am-sk-col-title">{title}</div>
    {items.map(it => { const tone = bipolarTone(it.value);
      return input
        ? <div key={it.id} className="am-sk-node input"><span><strong>{it.label}</strong>{it.sub && <small>{it.sub}</small>}</span></div>
        : <div key={it.id} className="am-sk-node" style={{ borderColor: tone.border, background: tone.bg }} title={it.sub}>
          <span>{it.label}</span><b style={{ color: tone.color }}>{tone.sym}</b>
        </div>; })}
  </div>;
}
type SankeyData = {
  leviers: { id: string; label: string; optionLabel: string }[];
  tpm: { id: string; label: string; value: OrdinalImpact }[];
  mop: { id: string; label: string; value: OrdinalImpact }[];
  moe: { id: string; label: string; value: OrdinalImpact }[];
  levTpmLinks: Array<[number, number]>; tpmMopLinks: Array<[number, number]>; mopMoeLinks: Array<[number, number]>;
};
function SankeyChain({ data, resultLabel, result }: { data: SankeyData; resultLabel: string; result: OrdinalImpact }) {
  const resultTone = bipolarTone(result);
  return <div className="am-sk-wrap">
    <SankeyCol title="Leviers" input items={data.leviers.map(l => ({ id: l.id, label: l.label, sub: l.optionLabel, value: { gPlus: 0, dMinus: 0 } as OrdinalImpact }))}/>
    <SankeyConnector leftCount={data.leviers.length} rightCount={data.tpm.length} links={data.levTpmLinks}/>
    <SankeyCol title="Indicateurs" items={data.tpm}/>
    <SankeyConnector leftCount={data.tpm.length} rightCount={data.mop.length} links={data.tpmMopLinks}/>
    <SankeyCol title="Dimensions" items={data.mop}/>
    <SankeyConnector leftCount={data.mop.length} rightCount={data.moe.length} links={data.mopMoeLinks}/>
    <SankeyCol title="Objectifs" items={data.moe}/>
    <SankeyConnector leftCount={data.moe.length} rightCount={1} links={data.moe.map((_, i) => [i, 0] as [number, number])}/>
    <div className="am-sk-col am-sk-result">
      <div className="am-sk-col-title">Résultat</div>
      <div className="am-sk-node result" style={{ borderColor: resultTone.border, background: resultTone.bg }}>
        <span>{resultLabel}</span><b style={{ color: resultTone.color }}>{resultTone.sym}</b>
      </div>
    </div>
  </div>;
}
/** Traduit les niveaux ordinaux d'une configuration en critères nommés — un lecteur ne sait pas lire un H ou un M isolé. */
function topImpacts(criteria: ArbCriterion[], perCrit: (criterionId: string) => OrdinalImpact) {
  const rows = criteria.map(c => ({ c, v: perCrit(c.id) }));
  const improves = rows.filter(r => r.v.gPlus >= 2).sort((a, b) => (b.c.weight - a.c.weight) || (b.v.gPlus - a.v.gPlus)).slice(0, 3).map(r => r.c.label);
  const degrades = rows.filter(r => r.v.dMinus >= 2).sort((a, b) => (b.c.weight - a.c.weight) || (b.v.dMinus - a.v.dMinus)).slice(0, 3).map(r => r.c.label);
  return { improves, degrades };
}

export function ArbitrageMinimal({ scenarios, criteria, cells, title, retenuId, rationale, session: sessionProp, actions, decisionRecord, onSign, onCompleteImpacts }: Props) {
  const [view, setView] = useState<View>("evaluer");
  // Repli historique : si l'appelant ne transmet pas encore la session complète
  // (ex. intégrations tierces via ArbitrageAdvanced), on la retrouve par
  // correspondance de titre/scénarios — moins fiable, jamais utilisé si sessionProp est fourni.
  const [fallbackSession, setFallbackSession] = useState<AtelierSession | null>(null);
  const activeSession = sessionProp ?? fallbackSession;
  const rawActiveSession = activeSession;
  const ranked = useMemo(() => rankUnder(scenarios, criteria, cells), [scenarios, criteria, cells]);
  // Options suggérées par Aura (non validées) : hors recommandation. Matrice trop
  // incomplète : aucune recommandation, seulement ce qu'il reste à renseigner.
  const suggestedIds = useMemo(() => activeSession ? suggestedOptionIds(activeSession) : new Set<string>(), [activeSession]);
  const completeness = useMemo(() => activeSession ? impactCompleteness(activeSession) : null, [activeSession]);
  const excludedScenario = (id: string) => !!activeSession?.scenarios.find(x => x.id === id)?.leviers.some(l => suggestedIds.has(l.valeur));
  const auraWinner = ranked.find(r => !excludedScenario(r.sc.id))?.sc;
  const focus = scenarios.find(s => s.id === retenuId) ?? auraWinner ?? scenarios[0];
  const challenger = ranked.find(r => r.sc.id !== focus?.id)?.sc;
  const dom = useMemo(() => dominanceReport(scenarios, criteria, cells), [scenarios, criteria, cells]);
  const robust = useMemo(() => robustnessReport(scenarios, criteria, cells), [scenarios, criteria, cells]);
  const resultById = useMemo(() => Object.fromEntries(ranked.map(r => [r.sc.id, r.result])) as Record<string, OrdinalImpact>, [ranked]);

  const scenarioSignature = scenarios.map(s => s.id).sort().join("|");
  useEffect(() => {
    if (sessionProp) return;
    const sessions = loadSessions();
    const match = sessions.find(s =>
      (s.title === title && scenarios.some(sc => s.scenarios.some(full => full.id === sc.id))) ||
      scenarios.filter(sc => s.scenarios.some(full => full.id === sc.id)).length >= Math.min(2, scenarios.length),
    );
    setFallbackSession(match ?? null);
  }, [title, scenarioSignature, scenarios, sessionProp]);

  const focusResult = focus ? resultById[focus.id] ?? { gPlus: 0, dMinus: 0 } : { gPlus: 0, dMinus: 0 };
  // Vérification des exigences non négociables pour CHAQUE scénario nommé — le classement
  // ordinal brut (rankUnder) ne filtre aucun veto, donc sans ce contrôle, un scénario qui
  // dégrade un critère Essentiel au-delà du seuil toléré pourrait être présenté comme
  // « Recommandation Aura » avec un badge « Contraintes respectées » mensonger.
  const scenarioBreaches = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!activeSession) return out;
    const allObjectives = activeSession.criteria.map(c => ({ id: c.id, label: c.label, importance: c.importance }));
    for (const sc of activeSession.scenarios) {
      const baseCombo = Object.fromEntries(activeSession.leviersDef.map(def => [def.id, sc.leviers.find(l => l.id === def.id)?.valeur ?? def.options[0]?.id ?? ""]));
      const ev = evaluateCombo(activeSession, sc, baseCombo);
      out[sc.id] = globalVetoBreaches(ev.perCrit, allObjectives).map(b => b.label);
    }
    return out;
  }, [activeSession]);
  const focusBreaches = focus ? scenarioBreaches[focus.id] ?? [] : [];
  const pair = useMemo(() => {
    if (!focus || !challenger) return undefined;
    return dom.pairs.find(p => p.aId === focus.id && p.bId === challenger.id);
  }, [dom, focus, challenger]);
  const discriminants = useMemo(() => {
    if (!focus || !challenger) return [];
    return criteria.map(c => {
      const a = safeCell(cells, focus.id, c.id); const b = safeCell(cells, challenger.id, c.id);
      return { c, a, b, cmp: bipolarCompare(a, b) };
    }).filter(x => x.cmp !== 0).sort((a, b) => b.c.weight - a.c.weight).slice(0, 4);
  }, [criteria, cells, focus, challenger]);

  // Moteur unique de recommandation : le meilleur compromis n'est pas
  // nécessairement l'un des scénarios nommés par le décideur — Aura explore
  // aussi les combinaisons de leviers non retenues comme scénario à part
  // entière, et ne recommande le résultat composé QUE s'il domine réellement
  // (jamais un score, toujours le même comparateur ordinal bipolaire que le
  // reste d'Aura) et sans violer d'exigence non négociable. La composition
  // exacte des leviers est toujours montrée — jamais une boîte noire.
  const composed = useMemo(() => {
    const activeSession = rawActiveSession ? withoutSuggestedOptions(rawActiveSession) : null;
    if (!activeSession || !activeSession.leviersDef.length) return null;
    const baseScenario = activeSession.scenarios.find(s => s.id === focus?.id) ?? activeSession.scenarios[0];
    if (!baseScenario) return null;
    const leviersDef = activeSession.leviersDef;
    const allObjectives = activeSession.criteria.map(c => ({ id: c.id, label: c.label, importance: c.importance }));
    const totalCombinations = leviersDef.reduce((acc, l) => acc * Math.max(1, l.options.length), 1);
    // Le décideur veut voir le calcul réel, pas un échantillon — on énumère tout
    // l'espace des combinaisons, avec un plafond de sécurité qui ne s'applique
    // qu'aux cas dégénérés (des dizaines de leviers à options multiples).
    const CAP = 200000;
    let best: { combo: Record<string, string>; global: BackwardEval["global"]; perCrit: BackwardEval["perCrit"] } | null = null;
    let count = 0;
    let admissible = 0;
    // Le treillis n'a que 16 issues possibles (4 niveaux d'amélioration × 4 de
    // dégradation) — inutile de tracer chaque combinaison individuellement, on
    // compte combien de combinaisons admissibles atterrissent dans chaque case.
    const grid: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    // Grille "brute" : compte TOUTE combinaison qui atterrit dans une case, qu'elle
    // ait ou non un point bloquant. Sert uniquement à distinguer, à l'affichage,
    // "aucune combinaison n'atteint ce résultat" (vraiment 0, y compris bloquées)
    // de "des combinaisons y atterrissent mais sont toutes bloquées" — un scénario
    // nommé (badge) peut très bien atteindre une case qui n'a aucune combinaison
    // SANS point bloquant : sans cette grille séparée, la case s'affichait rayée
    // ("aucune combinaison") tout en portant le badge du scénario, contradiction.
    const gridAny: number[][] = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
    // Garantie de couverture du treillis : quand l'espace dépasse CAP, l'énumération
    // ci-dessous s'arrête après les CAP premières combinaisons dans l'ordre
    // lexicographique des leviers. Rien ne garantit que cet ordre visite au moins
    // une combinaison par case avant de buter sur le plafond — une case bel et
    // bien atteignable pourrait n'être découverte qu'après le CAP-ième essai, et
    // s'afficherait alors, à tort, rayée/vide ("aucune combinaison n'atteint ce
    // résultat"). On fait donc d'abord une passe dédiée, uniquement à la
    // recherche de l'existence : elle s'arrête dès qu'une combinaison admissible
    // a été trouvée pour chacune des 16 cases (ou, à défaut, à un plafond de
    // sécurité plus large), sans jamais calculer de compte exact. La passe
    // suivante (comptage capé, inchangée) donne ensuite les chiffres/estimations
    // affichés — le pire cas possible est alors une case dont le chiffre affiché
    // est un minorant garanti (≥1 réel) plutôt qu'un compte exact, jamais une
    // case faussement vide.
    const reachable: boolean[][] = Array.from({ length: 4 }, () => [false, false, false, false]);
    const reachableAny: boolean[][] = Array.from({ length: 4 }, () => [false, false, false, false]);
    if (totalCombinations > CAP) {
      const REACH_CAP = Math.max(CAP * 10, 2_000_000);
      let reachFound = 0;
      let reachAnyFound = 0;
      let rCount = 0;
      function recReach(idx: number, combo: Record<string, string>) {
        if ((reachFound >= 16 && reachAnyFound >= 16) || rCount >= REACH_CAP) return;
        if (idx === leviersDef.length) {
          rCount++;
          const ev = evaluateCombo(activeSession!, baseScenario, combo);
          if (!reachableAny[ev.global.gPlus][ev.global.dMinus]) {
            reachableAny[ev.global.gPlus][ev.global.dMinus] = true;
            reachAnyFound++;
          }
          if (globalVetoBreaches(ev.perCrit, allObjectives).length > 0) return;
          if (!reachable[ev.global.gPlus][ev.global.dMinus]) {
            reachable[ev.global.gPlus][ev.global.dMinus] = true;
            reachFound++;
          }
          return;
        }
        for (const opt of leviersDef[idx].options) {
          combo[leviersDef[idx].id] = opt.id;
          recReach(idx + 1, combo);
          if ((reachFound >= 16 && reachAnyFound >= 16) || rCount >= REACH_CAP) return;
        }
      }
      recReach(0, {});
    }
    const lattice = computeOutcomeLattice(activeSession, baseScenario, CAP);
    for (let g = 0; g < 4; g++) for (let d = 0; d < 4; d++) { grid[g][d] = lattice.grid[g][d]; gridAny[g][d] = lattice.gridAny[g][d]; }
    count = lattice.totalTested;
    admissible = lattice.admissible;
    best = lattice.best;
    // Filet de sécurité : une case marquée atteignable par la passe dédiée mais
    // encore à zéro après le comptage capé obtient un minorant garanti (≥1) —
    // jamais un chiffre inventé, juste le fait qu'une combinaison réelle existe.
    // La même garantie s'applique à la grille brute (gridAny), sinon une case
    // découverte "atteignable avec point bloquant" au-delà du CAP resterait à 0
    // et retomberait dans le même piège que celui qu'on corrige ici.
    for (let g = 0; g < 4; g++) for (let d = 0; d < 4; d++) {
      if (reachable[g][d] && grid[g][d] === 0) grid[g][d] = 1;
      if (reachableAny[g][d] && gridAny[g][d] === 0) gridAny[g][d] = 1;
      if (grid[g][d] > 0 && gridAny[g][d] === 0) gridAny[g][d] = grid[g][d];
    }
    // Garantie de cohérence badge ↔ case : un scénario NOMMÉ est évalué ailleurs
    // (cellResults/nodeResults, sur ses propres leviers réels tels qu'enregistrés)
    // pour placer son badge dans la carte — cette lecture directe peut différer de
    // l'énumération ci-dessus si le scénario a des leviers absents du modèle actuel
    // (levier ajouté après coup, jamais renseigné pour ce scénario) : l'énumération
    // choisit toujours UNE option pour chaque levier, alors qu'un levier non
    // renseigné ne contribue aucun impact à l'évaluation directe — un résultat que
    // l'énumération ne peut alors jamais reproduire. Sans ce filet, la case
    // correspondante s'affichait rayée (ni chiffre, ni triangle) tout en portant le
    // badge du scénario, une contradiction visuelle. On force donc un minorant (≥1)
    // sur la case réellement atteinte par CHAQUE scénario nommé, dans gridAny
    // toujours, et dans grid (résultat "propre") si ce scénario ne viole aucune
    // exigence non négociable — jamais un chiffre inventé pour les autres cases.
    for (const r of ranked) {
      const g = r.result.gPlus, d = r.result.dMinus;
      if (gridAny[g][d] === 0) gridAny[g][d] = 1;
      if (grid[g][d] === 0 && (scenarioBreaches[r.sc.id]?.length ?? 0) === 0) grid[g][d] = 1;
    }
    if (!best) return null;
    const winner: { combo: Record<string, string>; global: BackwardEval["global"]; perCrit: BackwardEval["perCrit"] } = best;
    const matchesScenario = activeSession.scenarios.find(sc =>
      leviersDef.every(lev => (sc.leviers.find(l => l.id === lev.id)?.valeur ?? "") === winner.combo[lev.id]));
    return {
      global: winner.global,
      perCrit: winner.perCrit,
      matchesScenarioId: matchesScenario?.id ?? null,
      exhaustive: lattice.exhaustive,
      totalTested: count,
      totalCombinations,
      admissible,
      grid,
      gridAny,
      changes: leviersDef.map(lev => ({
        leverLabel: lev.label,
        optionLabel: lev.options.find(o => o.id === winner.combo[lev.id])?.label ?? "",
      })),
    };
  }, [activeSession, focus?.id, ranked, scenarioBreaches]);
  /** Le composé ne devient LA recommandation que s'il domine strictement le meilleur scénario nommé. */
  /** Le composé l'emporte s'il domine réellement le scénario nommé — OU si ce dernier viole une
   *  exigence non négociable : un veto élimine l'option quel que soit son résultat ordinal brut,
   *  jamais compensé par ailleurs. Le composé, lui, est garanti admissible (voir `composed` ci-dessus). */
  const composedWins = !!composed && !composed.matchesScenarioId && (focusBreaches.length > 0 || bipolarCompare(composed.global as OrdinalImpact, focusResult as OrdinalImpact) > 0);

  // Classement — mélange scénarios nommés (« Décideur ») et meilleures combinaisons
  // trouvées par Aura (« Aura ») dans le MÊME classement ordinal, jamais deux listes
  // séparées. Nom court = les options qui composent la configuration, jamais un mot
  // inventé hors du modèle.
  type ConfigRow = { id: string; label: string; origin: "aura" | "user"; global: BackwardEval["global"]; changes: { leverLabel: string; optionLabel: string }[]; perCrit: (criterionId: string) => OrdinalImpact };
  const ranking = useMemo<ConfigRow[]>(() => {
    const rows: ConfigRow[] = ranked.map(r => ({
      id: r.sc.id, label: r.sc.label, origin: "user" as const,
      global: r.result as BackwardEval["global"],
      changes: [],
      perCrit: (cid: string) => safeCell(cells, r.sc.id, cid),
    }));
    if (composed && composedWins) {
      rows.push({
        id: "aura-composed", label: composed.changes.map(c => c.optionLabel).slice(0, 2).join(" · ") || "Configuration composée",
        origin: "aura", global: composed.global, changes: composed.changes,
        perCrit: (cid: string) => (composed.perCrit[cid] ?? { gPlus: 0, dMinus: 0 }) as OrdinalImpact,
      });
    }
    return rows.sort((a, b) => bipolarCompare(b.global as OrdinalImpact, a.global as OrdinalImpact)).slice(0, 5);
  }, [ranked, composed, composedWins, cells]);

  const fullScenario = useMemo(() => activeSession?.scenarios.find(s => s.id === focus?.id), [activeSession, focus?.id]);
  const explanation = useMemo(() => {
    if (!activeSession || !fullScenario) return [];
    return activeSession.leviersDef.map(def => {
      const selectedId = fullScenario.leviers.find(l => l.id === def.id)?.valeur;
      const option = def.options.find(o => o.id === selectedId) ?? def.options[0];
      const impacts = Object.entries(option?.impacts ?? {}).filter(([, impact]) => impact !== "0").slice(0, 6).map(([criterionId, impact]) => ({
        criterionId, impact, path: findPath(activeSession.criteria, criterionId)?.map(c => c.label) ?? [criterionId],
      }));
      return { lever: def.label, option: option?.label ?? "Option non renseignée", impacts };
    }).filter(x => x.impacts.length > 0);
  }, [activeSession, fullScenario]);

  // Chaîne de décision (Sankey) : reprend la lecture historique de l'écran
  // Décider — Leviers → Indicateurs (TPM) → Dimensions (MOP) → Objectifs (MOE)
  // → Résultat — avec le même moteur d'agrégation que le reste d'Arbitrer
  // (aucun nouveau calcul, seulement une autre vue du même résultat).
  const sankey = useMemo(() => {
    if (!activeSession || !fullScenario) return null;
    const optionIndex: Record<string, AtelierOptionDef> = {};
    for (const lev of activeSession.leviersDef) for (const opt of lev.options) optionIndex[opt.id] = opt;
    const attitudeCode: Attitude = activeSession.attitude === "Pessimiste" ? 1 : 2;
    const profile: "prudent" | "optimiste" = activeSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const moe = activeSession.criteria;
    type ScoredCrit = { id: string; label: string; parentId: string; value: OrdinalImpact };
    const mop: ScoredCrit[] = [];
    const tpm: ScoredCrit[] = [];
    for (const m of moe) for (const mo of m.children ?? []) {
      mop.push({ id: mo.id, label: mo.label, parentId: m.id, value: aggregateHierarchy(mo, fullScenario, optionIndex, attitudeCode, profile) });
      for (const t of mo.children ?? []) tpm.push({ id: t.id, label: t.label, parentId: mo.id, value: aggregateHierarchy(t, fullScenario, optionIndex, attitudeCode, profile) });
    }
    const moeScored = moe.map(m => ({ id: m.id, label: m.label, value: aggregateHierarchy(m, fullScenario, optionIndex, attitudeCode, profile) }));
    const leviers = activeSession.leviersDef.map(def => {
      const selectedId = fullScenario.leviers.find(l => l.id === def.id)?.valeur;
      const option = def.options.find(o => o.id === selectedId) ?? def.options[0];
      return { id: def.id, label: def.label, optionLabel: option?.label ?? "Option non renseignée", option };
    });
    // Un lien Levier→TPM existe si l'option choisie porte un effet non neutre sur cet indicateur.
    const levTpmLinks: Array<[number, number]> = [];
    leviers.forEach((lev, li) => tpm.forEach((t, ti) => {
      const impact = lev.option?.impacts[t.id];
      if (impact && impact !== "0") levTpmLinks.push([li, ti]);
    }));
    const tpmMopLinks: Array<[number, number]> = tpm.map((t, ti) => [ti, mop.findIndex(m => m.id === t.parentId)]).filter(([, mi]) => mi >= 0) as Array<[number, number]>;
    const mopMoeLinks: Array<[number, number]> = mop.map((m, mi) => [mi, moeScored.findIndex(o => o.id === m.parentId)]).filter(([, oi]) => oi >= 0) as Array<[number, number]>;
    return { leviers, tpm, mop, moe: moeScored, levTpmLinks, tpmMopLinks, mopMoeLinks };
  }, [activeSession, fullScenario]);

  const [backwardOpen, setBackwardOpen] = useState(false);
  const [targetCriterionId, setTargetCriterionId] = useState(criteria[0]?.id ?? "");
  const [targetLevel, setTargetLevel] = useState<OrdinalLevel>(3);
  const [riskTolerance, setRiskTolerance] = useState<OrdinalLevel>(1);
  const defaultTargetId = useMemo(() => {
    if (!focus) return criteria[0]?.id ?? "";
    return [...criteria].sort((a,b)=>b.weight-a.weight).find(c => {
      const v = safeCell(cells, focus.id, c.id); return v.gPlus < 3 || v.dMinus > 1;
    })?.id ?? criteria[0]?.id ?? "";
  }, [criteria, cells, focus]);
  useEffect(() => { if (!criteria.some(c => c.id === targetCriterionId)) setTargetCriterionId(defaultTargetId); }, [criteria, targetCriterionId, defaultTargetId]);

  const backward = useMemo<BackwardModel | null>(() => {
    if (!activeSession || !focus || !targetCriterionId) return null;
    const scenario = activeSession.scenarios.find(s => s.id === focus.id);
    const target = findCriterion(activeSession.criteria, targetCriterionId);
    if (!scenario || !target) return null;
    const baseCombo = Object.fromEntries(activeSession.leviersDef.map(def => [def.id,
      scenario.leviers.find(l => l.id === def.id)?.valeur ?? def.options[0]?.id ?? ""]));
    const base = evaluateCombo(activeSession, scenario, baseCombo);
    const current = base.perCrit[target.id] ?? { gPlus: 0, dMinus: 0 };
    const reachedAlready = current.gPlus >= targetLevel && current.dMinus <= riskTolerance;
    const optionIndex = Object.fromEntries(activeSession.leviersDef.flatMap(l => l.options.map(o => [o.id, o])));
    const attitudeCode: Attitude = activeSession.attitude === "Pessimiste" ? 1 : 2;
    const profile: "prudent" | "optimiste" = activeSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const trace = traceBlockingBranch(target, scenario, optionIndex, attitudeCode, profile);
    const culprits = reachedAlready ? [] : culpritLevers(trace.leafId, activeSession.leviersDef, baseCombo);
    const allObjectives = activeSession.criteria.map(c => ({ id: c.id, label: c.label, importance: c.importance }));
    // Recherche EXHAUSTIVE (tous les leviers, toutes leurs options), par nombre
    // de leviers changés croissant (extension d'Aura, évaluée par les éq. (1)-(9) de la thèse Lô).
    const repairReport = reachedAlready ? null : findMinimalRepairsReport({
      baseCombo,
      leviersDef: activeSession.leviersDef,
      evaluate: combo => evaluateCombo(activeSession, scenario, combo),
      activeTargets: [{ critId: target.id, min: targetLevel }],
      tolerateRisk: riskTolerance,
      allObjectives,
    });
    const repairs = (repairReport?.repairs ?? []).map(repair => {
      const evaluation = evaluateCombo(activeSession, scenario, repair.combo);
      return { repair, evaluation, vetoes: globalVetoBreaches(evaluation.perCrit, allObjectives).map(v => v.label) };
    });
    // Aucune réparation ne satisfait la cible : quel est le mieux qu'on puisse
    // réellement obtenir avec les leviers identifiés ? Meilleur effort combiné
    // (chaque culprit poussé sur sa meilleure option connue), rejoué (jamais
    // une estimation fabriquée, toujours le résultat réel de l'évaluation).
    let limit: BackwardModel["limit"] = null;
    if (!reachedAlready && repairs.length === 0 && culprits.length > 0) {
      const bestEffortCombo = { ...baseCombo };
      culprits.forEach(c => { if (c.betterOptions[0]) bestEffortCombo[c.leverId] = c.betterOptions[0].optionId; });
      const evaluation = evaluateCombo(activeSession, scenario, bestEffortCombo);
      limit = {
        evaluation,
        vetoes: globalVetoBreaches(evaluation.perCrit, allObjectives).map(v => v.label),
        leversUsed: culprits.map(c => c.leverLabel),
      };
    }
    // Combien de combinaisons, parmi TOUTES celles du modèle (pas seulement les
    // leviers déjà repérés comme responsables), atteignent la cible — et laquelle
    // Aura recommande parmi celles qui l'atteignent sans créer de nouveau point
    // bloquant. Même énumération exhaustive que la carte qualitative d'Évaluer,
    // avec un filtre différent (atteint la cible, pas "meilleur potentiel global").
    let scan: BackwardModel["scan"] = null;
    // Énumération exhaustive coûteuse (jusqu'à CAP=200000 évaluations complètes) —
    // ne la lance que si le panneau "viser un résultat précis" est réellement
    // ouvert. Repliement par défaut, donc calculée sans ça à chaque changement de
    // scénario/critère/cible rendait Arbitrer lourd même quand ce panneau n'était
    // jamais consulté (le calcul tournait pour rien, à chaque mount ou changement
    // de focus). Le reste du modèle (base, culprits, réparations minimales) reste
    // lui bon marché et continue d'être calculé immédiatement.
    if (backwardOpen && activeSession.leviersDef.length > 0) {
      const CAP = EXHAUSTIVE_LIMIT;
      let count = 0, reaching = 0, reachingAdmissible = 0;
      let best: { combo: Record<string, string>; global: BackwardEval["global"]; size: number } | null = null;
      // Une alternative par SET de leviers changés (pas par combinaison brute) — sinon
      // deux combinaisons qui ne diffèrent que par une option jamais vue par l'utilisateur
      // compteraient comme deux choix distincts alors qu'elles se ressemblent.
      const bySet = new Map<string, { combo: Record<string, string>; global: BackwardEval["global"] }>();
      // Plafond réel sur le point visé : le meilleur niveau atteignable en restant
      // admissible, même au-delà de ce qui a été demandé — et sur quoi ça bute si
      // ce plafond n'est pas "Haut".
      let ceilingBest: { combo: Record<string, string>; gPlus: OrdinalLevel; dMinus: OrdinalLevel } | null = null;
      const leviersDef = activeSession.leviersDef;
      function rec(idx: number, combo: Record<string, string>) {
        if (count >= CAP) return;
        if (idx === leviersDef.length) {
          count++;
          const ev = evaluateCombo(activeSession!, scenario!, combo);
          const admissible = globalVetoBreaches(ev.perCrit, allObjectives).length === 0;
          const tGPlus = ev.perCrit[target!.id]?.gPlus ?? 0, tDMinus = ev.perCrit[target!.id]?.dMinus ?? 0;
          if (admissible && (!ceilingBest || tGPlus > ceilingBest.gPlus || (tGPlus === ceilingBest.gPlus && tDMinus < ceilingBest.dMinus))) {
            ceilingBest = { combo: { ...combo }, gPlus: tGPlus, dMinus: tDMinus };
          }
          const meets = tGPlus >= targetLevel && tDMinus <= riskTolerance;
          if (meets) {
            reaching++;
            if (admissible) {
              reachingAdmissible++;
              // « Plus petit changement » (coût = nombre de leviers
              // changés) ; à nombre égal, meilleur couple (δ⁺, δ⁻) global.
              const size = leviersDef.filter(lev => combo[lev.id] !== baseCombo[lev.id]).length;
              if (!best || size < best.size || (size === best.size && lexCompare(ev.global, best.global) > 0)) best = { combo: { ...combo }, global: ev.global, size };
              const setKey = leviersDef.filter(lev => combo[lev.id] !== baseCombo[lev.id]).map(lev => lev.id).sort().join(",");
              const prior = bySet.get(setKey);
              if (!prior || bipolarCompare(ev.global, prior.global) > 0) bySet.set(setKey, { combo: { ...combo }, global: ev.global });
            }
          }
          return;
        }
        for (const opt of leviersDef[idx].options) {
          combo[leviersDef[idx].id] = opt.id;
          rec(idx + 1, combo);
          if (count >= CAP) return;
        }
      }
      rec(0, {});
      const toChanges = (combo: Record<string, string>) => leviersDef
        .filter(lev => combo[lev.id] !== baseCombo[lev.id])
        .map(lev => ({ leverLabel: lev.label, optionLabel: lev.options.find(o => o.id === combo[lev.id])?.label ?? "" }));
      const setSize = (combo: Record<string, string>) => leviersDef.filter(lev => combo[lev.id] !== baseCombo[lev.id]).length;
      const distinctSets = [...bySet.values()].sort((a, b) => (setSize(a.combo) - setSize(b.combo)) || lexCompare(b.global, a.global));
      let ceiling: NonNullable<BackwardModel["scan"]>["ceiling"] = null;
      if (ceilingBest) {
        const cb = ceilingBest as { combo: Record<string, string>; gPlus: OrdinalLevel; dMinus: OrdinalLevel };
        let blockerLeaf = "", leversInvolved: string[] = [];
        if (cb.gPlus < 3) {
          const ceilingScenario = scenarioFromCombo(activeSession, scenario!, cb.combo);
          const optionIndex = Object.fromEntries(leviersDef.flatMap(l => l.options.map(o => [o.id, o])));
          const attitudeCode: Attitude = activeSession.attitude === "Pessimiste" ? 1 : 2;
          const profile: "prudent" | "optimiste" = activeSession.attitude === "Pessimiste" ? "prudent" : "optimiste";
          const trace = traceBlockingBranch(target!, ceilingScenario, optionIndex, attitudeCode, profile);
          blockerLeaf = trace.leafLabel;
          leversInvolved = culpritLevers(trace.leafId, leviersDef, cb.combo).map(c => c.leverLabel);
        }
        ceiling = { gPlus: cb.gPlus, dMinus: cb.dMinus, blockerLeaf, leversInvolved };
      }
      scan = {
        totalCombinations: count, exhaustive: count < CAP || count >= leviersDef.reduce((a, l) => a * Math.max(1, l.options.length), 1), reaching, reachingAdmissible,
        distinctAdmissibleSets: bySet.size,
        best: best ? { global: (best as { global: BackwardEval["global"] }).global, changes: toChanges((best as { combo: Record<string, string> }).combo) } : null,
        alternatives: distinctSets.slice(0, 6).map(a => ({ global: a.global, changes: toChanges(a.combo) })),
        ceiling,
      };
    }
    return { target, base, traceLabels: trace.path.map(p => p.label), blockerLeaf: trace.leafLabel, culprits, repairs,
      repairsComplete: repairReport?.complete ?? true, reachedAlready, limit, scan };
  }, [activeSession, focus, targetCriterionId, targetLevel, riskTolerance, backwardOpen]);

  // Chaîne de décision repliée par défaut — fusionnée dans Évaluer (voir plus haut).
  const [chainOpen, setChainOpen] = useState(false);
  // Explications IA par alternative, générées uniquement à la demande (une par
  // clic, jamais pour tout le classement) — voir explainAlternative dans atelier-llm.ts.
  const [explainState, setExplainState] = useState<Record<string, { loading: boolean; data?: AlternativeExplanation; error?: boolean }>>({});
  async function requestExplanation(row: ConfigRow) {
    if (explainState[row.id]?.loading || explainState[row.id]?.data) return;
    setExplainState(s => ({ ...s, [row.id]: { loading: true } }));
    const { improves, degrades } = topImpacts(criteria, row.perCrit);
    try {
      const res = await explainAlternative({ data: {
        context: title,
        label: row.label,
        potentiel: LEVEL_LONG[(row.global as OrdinalImpact).gPlus],
        risque: LEVEL_LONG[(row.global as OrdinalImpact).dMinus],
        improves, degrades,
        changes: row.changes.map(c => `${c.leverLabel} → ${c.optionLabel}`),
      } });
      setExplainState(s => ({ ...s, [row.id]: { loading: false, data: res } }));
    } catch {
      setExplainState(s => ({ ...s, [row.id]: { loading: false, error: true } }));
    }
  }

  const [simScenarioId, setSimScenarioId] = useState(focus?.id ?? scenarios[0]?.id ?? "");
  const [simCriterionId, setSimCriterionId] = useState(criteria[0]?.id ?? "");
  const [simPlus, setSimPlus] = useState<string>("N");
  const [simMinus, setSimMinus] = useState<string>("N");
  const [simResult, setSimResult] = useState<{ winner?: ArbScenario; cells?: ArbCells; unknown?: boolean } | null>(null);
  useEffect(() => {
    if (focus?.id) setSimScenarioId(focus.id);
    if (criteria[0]?.id) setSimCriterionId(criteria[0].id);
  }, [focus?.id, criteria]);
  useEffect(() => {
    const v = safeCell(cells, simScenarioId, simCriterionId);
    setSimPlus(LEVEL[v.gPlus]); setSimMinus(LEVEL[v.dMinus]); setSimResult(null);
  }, [cells, simScenarioId, simCriterionId]);
  function replaySimulation() {
    if (simPlus === "U" || simMinus === "U") { setSimResult({ unknown: true }); return; }
    const plus = LEVEL.indexOf(simPlus as typeof LEVEL[number]) as OrdinalLevel;
    const minus = LEVEL.indexOf(simMinus as typeof LEVEL[number]) as OrdinalLevel;
    const patched = copyCells(cells);
    patched[simScenarioId] = { ...patched[simScenarioId], [simCriterionId]: { gPlus: plus, dMinus: minus } };
    setSimResult({ winner: rankUnder(scenarios, criteria, patched)[0]?.sc, cells: patched });
  }

  if (!focus || scenarios.length === 0 || criteria.length === 0) return <div className="am-empty">Ajoutez au moins deux scénarios et un critère pour arbitrer.</div>;
  const stability = robust.level === "verrouillée" ? "Très stable" : robust.level === "solide" ? "Stable" : robust.level === "fragile" ? "Sensible" : "À confirmer";
  const tabs: Array<{id:View;label:string;sub:string}> = [
    { id:"evaluer", label:"Évaluer", sub:"Comprendre le résultat et suivre la chaîne" },
    { id:"tester", label:"Tester", sub:"Jouer sur une hypothèse" },
    { id:"decision", label:"Décision", sub:"Signer le choix" },
  ];
  const isSigned = decisionRecord?.scenarioId === focus.id;
  function handleSign() {
    if (!onSign) return;
    onSign({
      scenarioId: focus.id,
      conditions: dom.nonDominated.includes(focus.id) ? ["Rien de bloquant", "Aucune autre option n'est meilleure sur tous les points à la fois"] : ["Rien de bloquant"],
      preuves: discriminants.slice(0, 4).map(d => `${d.c.label} : ${d.cmp > 0 ? `favorable à ${focus.label}` : `concession face à ${challenger?.label ?? "l'alternative"}`}`),
      hypotheses: robust.flips.slice(0, 3).map(f => `${f.critLabel} : stable tant qu'il reste sous ${LEVEL_LONG[f.to]}`),
      fallbackScenarioId: challenger?.id,
      signedAt: new Date().toISOString(),
    });
  }

  return <section className="am-root">
    <style>{styles}</style>
    <header className="am-header">
      <div><span>ARBITRER</span><h2 title="Évaluer · expliquer · corriger · tester — jamais réduit à une seule note chiffrée.">{title}</h2></div>
      <div className="am-header-right">
        <div className="am-status"><span className="good"><ShieldCheck size={14}/> {dom.nonDominated.includes(focus.id) ? "Option crédible" : "Option retenue"}<HelpTip text="Aucune autre option ne fait strictement mieux sur tous les points en même temps."/></span><span>{stability}<HelpTip text="À quel point le résultat pourrait changer si une seule hypothèse bougeait un peu."/></span></div>
        {actions && <div className="am-header-actions">{actions}</div>}
      </div>
    </header>
    <nav className="am-tabs" aria-label="Arbitrage">
      {tabs.map(t => <button key={t.id} className={view===t.id?"active":""} onClick={()=>setView(t.id)} title={t.sub}><strong>{t.label}</strong></button>)}
    </nav>

    {view === "evaluer" && <div className="am-stack">
      <section className={`am-hero-reco ${composedWins ? "aura" : ""}${completeness && !completeness.reliable ? " am-incomplete" : ""}`}>
        <div className="am-hero-top">
          <span className="am-hero-star"><Target size={16}/></span>
          <span className="am-hero-title">Recommandation Aura</span>
          <HelpTip text="Ce n'est pas forcément un de vos scénarios : Aura explore aussi des combinaisons de leviers que vous n'avez pas nommées, et ne recommande jamais une option qui a un point bloquant."/>
          <span className="am-hero-chip">Meilleur compromis</span>
        </div>
        {completeness && !completeness.reliable
          ? <><h3 data-testid="arbitrer-incomplete">Complétez {impactsToComplete(completeness)} impact{impactsToComplete(completeness) > 1 ? "s" : ""} pour une recommandation fiable</h3>
              <p className="am-hero-sub keep">{completeness.filled} sur {completeness.total} impacts renseignés ({Math.round(completeness.ratio * 100)} %). Aucun gagnant n'est affiché en dessous de {Math.round(COMPLETENESS_MIN * 100)} %. À compléter d'abord : {completeness.missing.slice(0, 3).map(m => `« ${m.option} » sur « ${m.criterion} »`).join(", ")}{onCompleteImpacts && <> · <button type="button" className="am-explain-btn" onClick={onCompleteImpacts}>Compléter dans la matrice</button></>}</p></>
          : <h3>{composedWins && composed ? "Configuration composée par Aura" : focus.label}</h3>}
        <p className="am-hero-sub">{composedWins && composed
          ? "Un équilibre trouvé au-delà de vos scénarios, issu des combinaisons explorées par Aura."
          : focusBreaches.length > 0
            ? "À titre indicatif : toutes les options ont un point bloquant."
            : (rationale || "Le meilleur compromis trouvé parmi vos scénarios.")}</p>
        <div className="am-hero-pills">
          <span className={`pill-gplus lv${(composedWins && composed ? composed.global : focusResult).gPlus}`} title="Ce que ce choix peut apporter de bien, au mieux."><BarChart3 size={12}/> Potentiel : {LEVEL_LONG[(composedWins && composed ? composed.global : focusResult).gPlus]}</span>
          <span className={`pill-dminus lv${(composedWins && composed ? composed.global : focusResult).dMinus}`} title="Ce que ce choix peut dégrader, au pire."><ShieldCheck size={12}/> Risque : {LEVEL_LONG[(composedWins && composed ? composed.global : focusResult).dMinus]}</span>
          {(composedWins ? [] : focusBreaches).length > 0
            ? <span className="pill-breach"><AlertTriangle size={12}/> Point bloquant sur : {(composedWins ? [] : focusBreaches).join(", ")}<HelpTip text="Ce point dépasse une limite jugée inacceptable. Aucun bon résultat ailleurs ne peut compenser ça : ce n'est jamais une moyenne."/></span>
            : <span><CheckCircle2 size={12}/> Rien de bloquant<HelpTip text="Aucun point ne dépasse une limite jugée inacceptable."/></span>}
          <span><SlidersHorizontal size={12}/> Stabilité : {stability}<HelpTip text="À quel point le résultat pourrait changer si une seule hypothèse bougeait un peu."/></span>
        </div>
        {composedWins && composed && <div className="am-composed-list">
          {composed.changes.map((c,i) => <div key={i}><strong>{c.leverLabel}</strong><span>{c.optionLabel}</span></div>)}
        </div>}

      </section>

      <div className="am-grid-eval">
        <section className="am-card am-rank-card"><div className="am-card-head"><div><h3>Classement</h3></div></div>
          <div className="am-rank-list">
            {ranking.map((r,i) => {
              const { improves, degrades } = topImpacts(criteria, r.perCrit);
              const isReco = i===0 && !(completeness && !completeness.reliable);
              const breaches = r.origin === "user" ? scenarioBreaches[r.id] ?? [] : [];
              // L'explication IA n'est proposée que pour les 3 premières
              // alternatives, et seulement générée au clic — jamais pour tout
              // le classement, jamais au chargement de la page (voir tâche
              // perf : ne pas alourdir la page quel que soit le nombre de
              // combinaisons explorées en arrière-plan).
              const canExplain = i < 3;
              const ex = explainState[r.id];
              return <div key={r.id} className={`am-rank-row ${isReco?"am-rank-reco":""} ${r.id===focus.id && !composedWins ? "am-rank-current" : ""} ${composedWins && r.origin==="aura" ? "am-rank-current" : ""}`}>
                {isReco && <span className="am-rank-ribbon"><Target size={10}/> Recommandation Aura — meilleur compromis</span>}
                <div className="am-rank-top">
                  <span className="am-rank-num">{isReco?<Target size={13}/>:i+1}</span>
                  <strong>{r.label}</strong>
                </div>
                {r.origin==="aura" && <span className={`am-origin-badge ${r.origin}`}>Composée par Aura<HelpTip text="Aura a construit cette combinaison elle-même, ce n'est pas une option que vous aviez décrite."/></span>}
                {breaches.length > 0 && <span className="am-origin-badge breach"><AlertTriangle size={9}/> Point bloquant : {breaches.join(", ")}<HelpTip text="Ce point dépasse une limite jugée inacceptable, quel que soit le reste."/></span>}
                <LevelBars value={r.global as OrdinalImpact}/>
                {(improves.length>0 || degrades.length>0) && <div className="am-rank-impacts">
                  {improves.length>0 && <span className="imp-up">↑ Améliore : {improves.join(", ")}</span>}
                  {degrades.length>0 && <span className="imp-down">↓ Dégrade : {degrades.join(", ")}</span>}
                </div>}
                {canExplain && <>
                  {(!ex || ex.error) && !ex?.loading && <button type="button" className="am-explain-btn" onClick={()=>requestExplanation(r)}><Sparkles size={11}/> {ex?.error ? "Réessayer" : "Expliquer"}</button>}
                  {ex?.loading && <span className="am-explain-loading"><Sparkles size={11}/> Aura analyse…</span>}
                  {ex?.error && <span className="am-explain-loading warn">Explication indisponible pour le moment.</span>}
                  {ex?.data && (ex.data.forces.length>0 || ex.data.risques.length>0 || ex.data.autres.length>0) && <div className="am-explain-ai">
                    {ex.data.forces.length>0 && <div className="force"><strong>Forces</strong><ul>{ex.data.forces.map((f,j)=><li key={j}>{f}</li>)}</ul></div>}
                    {ex.data.risques.length>0 && <div className="risk"><strong>Points de vigilance</strong><ul>{ex.data.risques.map((f,j)=><li key={j}>{f}</li>)}</ul></div>}
                    {ex.data.autres.length>0 && <div className="other"><strong>Autres aspects</strong><ul>{ex.data.autres.map((f,j)=><li key={j}>{f}</li>)}</ul></div>}
                  </div>}
                </>}
              </div>;
            })}
          </div>
        </section>
        <section className="am-card am-lattice-card"><div className="am-card-head"><div><span>CARTE QUALITATIVE</span><h3>Combinaisons par résultat <HelpTip text="Il n'existe que 16 résultats possibles au total (4 niveaux de potentiel × 4 niveaux de risque) — chaque case en est un. Le chiffre dans une case dit combien de combinaisons de leviers y aboutissent sans point bloquant. Une case avec un triangle orange y voit aussi des combinaisons aboutir, mais toutes avec au moins un point bloquant. Les cases rayées sans aucun chiffre ni triangle sont les seuls résultats qu'aucune combinaison n'atteint, jamais, pour cette décision."/></h3></div></div>
          {composed ? <>
            <div className="am-lattice-meta">{composed.totalCombinations.toLocaleString("fr-FR")} combinaison{composed.totalCombinations>1?"s":""} possible{composed.totalCombinations>1?"s":""}{!composed.exhaustive && <> · <strong className="am-estimate-flag">estimation basée sur un échantillon</strong> de {composed.totalTested.toLocaleString("fr-FR")} combinaison{composed.totalTested>1?"s":""} (espace trop grand pour un calcul exhaustif instantané)</>} · {composed.admissible.toLocaleString("fr-FR")} sans point bloquant{composed.exhaustive?"":" (sur l'échantillon)"} · {composed.grid.flat().filter(n=>n>0).length} profil{composed.grid.flat().filter(n=>n>0).length>1?"s":""} propre{composed.grid.flat().filter(n=>n>0).length>1?"s":""} sur 16{composed.gridAny.flat().filter(n=>n>0).length > composed.grid.flat().filter(n=>n>0).length && <> ({composed.gridAny.flat().filter(n=>n>0).length} atteint{composed.gridAny.flat().filter(n=>n>0).length>1?"s":""} en tout, bloquants compris)</>}</div>
            <div className="am-lattice-plot">
              <div className="am-lattice-ylabel">Potentiel d'amélioration ↑</div>
              <div className="am-lattice-body">
                {[3,2,1,0].map(g => <div key={g} className="am-lattice-plot-row">
                  <span className="am-lattice-ytick">{LEVEL_LONG[g]}</span>
                  {[0,1,2,3].map(d => {
                    const n = composed.grid[g][d];
                    // Combinaisons qui atterrissent bien dans cette case mais qui ont
                    // toutes au moins un point bloquant (donc absentes de `n`, qui ne
                    // compte que "sans point bloquant") — distinct de "vraiment aucune
                    // combinaison n'y arrive", pour ne jamais afficher une case rayée
                    // qui porterait par ailleurs le badge d'un scénario nommé.
                    const blockedOnly = n === 0 ? composed.gridAny[g][d] : 0;
                    const isReco = !(completeness && !completeness.reliable) && g===(composedWins?composed.global.gPlus:focusResult.gPlus) && d===(composedWins?composed.global.dMinus:focusResult.dMinus);
                    // Zone réelle du treillis, jamais un quadrant moitié/moitié :
                    // (0,0) sans effet · δ⁻=0,δ⁺>0 apport net · δ⁺=0,δ⁻>0 exposition ·
                    // le reste, apport ET risque à la fois. Même partition que la
                    // légende ci-dessous — c'est elle qui rend la carte lisible sans
                    // avoir à décoder chaque case une par une.
                    const zone = g===0 && d===0 ? "z-none" : d===0 ? "z-net" : g===0 ? "z-exposed" : "z-mixed";
                    // Vos alternatives qui aboutissent à cette case précise —
                    // chacune un petit rectangle nommé, à côté (jamais à la
                    // place) du chiffre total de combinaisons de la case : le
                    // chiffre compte TOUT l'espace des leviers, les rectangles
                    // ne montrent que les alternatives que vous avez composées
                    // vous-même parmi vos scénarios.
                    const here = ranking.filter(r => r.global.gPlus === g && r.global.dMinus === d);
                    return <div key={d} className={`am-lattice-cell ${zone} ${n>0?"has":""} ${blockedOnly>0?"blocked":""} ${isReco?"reco":""}`}>
                      <div className="am-lattice-cell-top">
                        {isReco && <Target size={11}/>}
                        {n>0 && <span className="am-lattice-count" title={`${n.toLocaleString("fr-FR")} combinaison(s) de leviers aboutissent à ce résultat`}>{n}</span>}
                        {n===0 && blockedOnly>0 && <span className="am-lattice-blocked" title={`${blockedOnly.toLocaleString("fr-FR")} combinaison(s) de leviers aboutissent à ce résultat, mais avec au moins un point bloquant — aucune n'est propre`}><AlertTriangle size={10}/> {blockedOnly}</span>}
                      </div>
                      {here.length > 0 && <div className="am-lattice-alts">
                        {here.slice(0, 2).map(r => (
                          <span key={r.id} className={`am-lattice-alt ${r.origin}`} title={r.label}>{r.label.length > 14 ? `${r.label.slice(0, 13)}…` : r.label}</span>
                        ))}
                        {here.length > 2 && <span className="am-lattice-alt-more">+{here.length - 2}</span>}
                      </div>}
                    </div>;
                  })}
                </div>)}
                <div className="am-lattice-xticks"><span/>{LEVEL_LONG.map(l => <span key={l}>{l}</span>)}</div>
              </div>
            </div>
            <div className="am-lattice-xlabel">Risque de dégradation →</div>
            {ranking.length > 0 && <ul className="am-lattice-key" aria-label="Où atterrissent vos alternatives">
              {ranking.map(r => <li key={r.id}><span className={`am-lattice-alt ${r.origin}`}>{r.label}</span><small>Potentiel {LEVEL_LONG[r.global.gPlus].toLowerCase()} · risque {LEVEL_LONG[r.global.dMinus].toLowerCase()}</small></li>)}
            </ul>}
            <div className="am-lattice-legend">
              <div className="lg-row"><span className="lg-swatch z-none"/><div><strong>Gris — ni gain ni perte</strong><small>Cette combinaison de leviers ne change rien : ni bénéfice, ni risque nouveau.</small></div></div>
              <div className="lg-row"><span className="lg-swatch z-net"/><div><strong>Indigo — un gain sans contrepartie</strong><small>Vous améliorez la situation, sans créer de risque en retour.</small></div></div>
              <div className="lg-row"><span className="lg-swatch z-mixed"/><div><strong>Violet — un gain, mais à un prix</strong><small>Vous améliorez la situation, en acceptant un risque en échange — l'arbitrage classique.</small></div></div>
              <div className="lg-row"><span className="lg-swatch z-exposed"/><div><strong>Ambre — du risque, sans rien gagner</strong><small>Cette combinaison expose sans aucune contrepartie — à écarter en général.</small></div></div>
              <div className="lg-row"><span className="lg-swatch reco"/><div><strong>Case pleine, cerclée d'une cible</strong><small>Là où tombe la recommandation d'Aura.</small></div></div>
              <div className="lg-row"><span className="am-lattice-alt user" style={{ flexShrink: 0 }}>Nom</span><div><strong>Petit rectangle nommé</strong><small>Une de vos alternatives (ou la configuration composée par Aura) qui aboutit exactement à ce résultat — y compris si elle a un point bloquant : le rectangle montre où atterrit ce que vous avez choisi, pas seulement les résultats "propres".</small></div></div>
              <div className="lg-row"><span className="am-lattice-blocked" style={{ flexShrink: 0 }}><AlertTriangle size={10}/> N</span><div><strong>Triangle orange — bloquées uniquement</strong><small>Des combinaisons atterrissent bien ici, mais toutes ont au moins un point bloquant : ce n'est pas un résultat inatteignable, seulement un résultat où rien de "propre" n'a été trouvé.</small></div></div>
              <div className="lg-note">Le chiffre en haut d'une case compte les combinaisons de leviers SANS point bloquant qui aboutissent à ce même résultat — pas un score : deux cases avec le même chiffre restent aussi valables l'une que l'autre. Les rectangles nommés ne montrent, parmi elles, que les alternatives que vous avez vous-même composées.</div>
            </div>
          </> : <p className="am-muted" title="Chaque choix possible laisse au moins un problème non résolu.">Aucune combinaison sans point bloquant.</p>}
        </section>
      </div>

      <div className="am-grid-eval">
        <section className="am-card am-table-card"><div className="am-card-head"><div><h3>Par dimension</h3></div></div>
          <div className="am-table-wrap"><table><thead><tr><th>Dimension</th><th>Importance</th>{scenarios.map(s=><th key={s.id}>{s.label}</th>)}</tr></thead><tbody>
            {criteria.map(c=><tr key={c.id}><td>{c.label}</td><td><span className={`am-imp i${c.weight}`}>{importanceLabel(c.weight)}</span></td>{scenarios.map(s=><td key={s.id} className={s.id===focus.id?"focus":""}><LevelPair value={safeCell(cells,s.id,c.id)}/></td>)}</tr>)}
          </tbody></table></div>
        </section>
        <aside className="am-side">
          <section className="am-card"><div className="am-card-head"><div><span>JUSTIFICATION</span><h3>Pourquoi {focus.label}</h3></div></div><div className="am-reasons">
            {discriminants.length ? discriminants.map((d,i)=><div key={d.c.id}><b>{i+1}</b><span><strong>{d.c.label}</strong><small>{d.cmp>0?`${focus.label} est plus favorable`:`Concession face à ${challenger?.label}`} · {importanceLabel(d.c.weight)}</small></span></div>) : <p>Aucun écart discriminant avec l’alternative la plus proche.</p>}
          </div></section>
          <section className="am-card"><div className="am-card-head"><div><span>CE QUI PEUT FAIRE CHANGER LA DÉCISION</span><h3>{stability}</h3></div></div>
            {robust.flips.length ? <div className="am-watch">{robust.flips.slice(0,3).map(f=><div key={f.critId}><AlertTriangle size={14}/><span><strong>{f.critLabel}</strong><small>{LEVEL_LONG[f.from]} → {LEVEL_LONG[f.to]} sur l’importance : {f.newWinnerLabel} passe devant.</small></span></div>)}</div> : <p className="am-muted">Aucun changement d’un seul critère d’importance ne suffit à changer le vainqueur.</p>}
          </section>
        </aside>
      </div>
      <details className="am-proof am-chain-details" open={chainOpen} onToggle={e => setChainOpen((e.target as HTMLDetailsElement).open)}>
        <summary><GitBranch size={14}/> Chaîne de décision <ChevronDown size={14}/></summary>
        <div>
          <p className="am-chain-intro">Leviers → Indicateurs → Dimensions → Objectifs → Résultat, pour {focus.label}. Mêmes calculs que ci-dessus, une autre vue — jamais un nouveau calcul.</p>
          {sankey ? <SankeyChain data={sankey} resultLabel={focus.label} result={focusResult as OrdinalImpact}/>
            : explanation.length ? <div className="am-chain">
            {explanation.map((x,i)=><div className="am-chain-row" key={`${x.lever}-${i}`}><div className="am-chain-choice"><small>Levier</small><strong>{x.lever}</strong><span>{x.option}</span></div><ChevronRight size={18}/><div className="am-chain-impacts">{x.impacts.map((imp,j)=><div key={`${imp.criterionId}-${j}`}><b className={`impact ${String(imp.impact).includes("-")?"neg":"pos"}`}>{IMPACT_LABEL[String(imp.impact)] ?? String(imp.impact)}</b><span>{imp.path.join(" → ")}</span></div>)}</div></div>)}
            <div className="am-chain-result"><GitBranch size={18}/><div><small>Résultat final</small><strong>{focus.label}</strong></div><LevelPair value={focusResult as OrdinalImpact}/></div>
          </div> : <div className="am-empty-card">La chaîne détaillée n’est pas disponible pour cette session. Les résultats ci-dessus restent valables — c’est le même calcul.</div>}
          <p className="am-explain-note-inline"><CircleDot size={13}/> Une option produit des effets sur des indicateurs précis, qui remontent vers les dimensions puis les objectifs, en conservant toujours séparément l'amélioration et la dégradation — jamais fondues en une seule note.</p>
        </div>
      </details>

      <details className="am-proof"><summary>Preuve analytique <ChevronDown size={14}/></summary><div><p>{dom.headline}</p><div className="am-proof-row"><span>Options qu'aucune autre ne surclasse partout</span><strong>{dom.nonDominated.map(id=>scenarios.find(s=>s.id===id)?.label??id).join(" · ")}</strong></div><div className="am-proof-row"><span>Alternative la plus proche</span><strong>{challenger?.label ?? "Aucune"}</strong></div><div className="am-proof-row"><span>Méthode</span><strong>Amélioration et dégradation d'abord, jamais réduites à une seule note moyenne</strong></div></div></details>

      <div className="am-action-bar">
        <button onClick={()=>setView("tester")}><Play size={13}/> Tester</button>
        <button onClick={()=>setChainOpen(v=>!v)}><GitBranch size={13}/> Voir la chaîne</button>
        <button className="am-action-primary" onClick={()=>setView("decision")}><CheckCircle2 size={13}/> Retenir cette configuration</button>
      </div>
    </div>}

    {view === "tester" && <div className="am-stack">
      <section className="am-card am-sim"><div className="am-card-head"><div><span>SIMULATION RAPIDE</span><h3>Jouer sur une hypothèse</h3></div><p>Modifier un seul élément, rejouer, voir si la décision change.</p></div>
        <div className="am-sim-controls"><label>Scénario<select value={simScenarioId} onChange={e=>setSimScenarioId(e.target.value)}>{scenarios.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label><label>Dimension<select value={simCriterionId} onChange={e=>setSimCriterionId(e.target.value)}>{criteria.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label><label>Amélioration<select value={simPlus} onChange={e=>setSimPlus(e.target.value)}>{(["N","L","M","H","U"] as const).map((v,i)=><option key={v} value={v}>{i<4?LEVEL_LONG[i]:"Inconnu"}</option>)}</select></label><label>Dégradation<select value={simMinus} onChange={e=>setSimMinus(e.target.value)}>{(["N","L","M","H","U"] as const).map((v,i)=><option key={v} value={v}>{i<4?LEVEL_LONG[i]:"Inconnu"}</option>)}</select></label><button onClick={replaySimulation}><Play size={15}/> Rejouer</button><button className="ghost" onClick={()=>{const v=safeCell(cells,simScenarioId,simCriterionId);setSimPlus(LEVEL[v.gPlus]);setSimMinus(LEVEL[v.dMinus]);setSimResult(null);}}><RefreshCcw size={14}/> Réinitialiser</button></div>
        {simResult && <div className={`am-sim-result ${simResult.unknown?"warn":""}`}>{simResult.unknown ? <><AlertTriangle size={18}/><div><strong>Impossible de conclure</strong><p>Une information manque encore. Aura ne devine pas une valeur à sa place.</p></div></> : <><CheckCircle2 size={18}/><div><strong>{simResult.winner?.id===focus.id?`${focus.label} reste recommandé`:`La recommandation devient ${simResult.winner?.label}`}</strong><p>Résultat recalculé avec le même calcul que le reste de l’arbitrage.</p></div></>}</div>}
      </section>

      <button type="button" className="am-backward-link" onClick={()=>setBackwardOpen(v=>!v)}>
        <Target size={13}/> {backwardOpen ? "Masquer" : "Ou : viser un résultat précis et voir ce qu'il faudrait changer"}
      </button>
      {backwardOpen && <section className="am-card am-obj">
        <div className="am-card-head"><div><span>ATTEINDRE UN OBJECTIF</span><h3>Que faudrait-il changer pour l'obtenir ?</h3></div><p>Choisissez un point à améliorer et un niveau visé.</p></div>
        <div className="am-targetbar">
          <label>Point à améliorer<select value={targetCriterionId} onChange={e=>setTargetCriterionId(e.target.value)}>{criteria.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
          <label>Amélioration visée<select value={targetLevel} onChange={e=>setTargetLevel(Number(e.target.value) as OrdinalLevel)}>{[0,1,2,3].map(v=><option key={v} value={v}>{LEVEL_LONG[v]}</option>)}</select></label>
          <label>Dégradation tolérée<select value={riskTolerance} onChange={e=>setRiskTolerance(Number(e.target.value) as OrdinalLevel)}>{[0,1,2,3].map(v=><option key={v} value={v}>{LEVEL_LONG[v]}</option>)}</select></label>
        </div>
        {!backward ? <p className="am-muted">Les données détaillées de cette session ne permettent pas cette recherche.</p> : <>
          <LevelRuler current={backward.base.perCrit[backward.target.id]?.gPlus ?? 0} target={targetLevel} ceiling={backward.scan?.ceiling?.gPlus}/>
          {backward.scan && <p className="am-obj-count">
            <strong>{backward.scan.reachingAdmissible.toLocaleString("fr-FR")}</strong> combinaison{backward.scan.reachingAdmissible>1?"s":""} sur {backward.scan.totalCombinations.toLocaleString("fr-FR")}{!backward.scan.exhaustive && <> (<strong className="am-estimate-flag">estimation basée sur un échantillon</strong>, espace trop grand pour un calcul exhaustif)</>} atteint{backward.scan.reachingAdmissible>1?"ent":""} cet objectif sans créer de point bloquant
          </p>}

          {backward.reachedAlready ? <div className="am-success"><CheckCircle2 size={20}/><div><strong>Déjà atteint</strong><p>Aucun changement n'est nécessaire pour ce niveau.</p></div></div>
          : backward.scan?.best ? <div className="am-obj-flow">
            <div className={`am-hero-reco aura am-obj-hero`}>
              <div className="am-hero-top"><span className="am-hero-star"><Target size={16}/></span><span className="am-hero-title">Recommandation Aura</span><span className="am-hero-chip">Plus petit changement</span></div>
              <h3>{backward.scan.best.changes.length ? backward.scan.best.changes.map(c=>c.optionLabel).join(" · ") : "Configuration actuelle"}</h3>
              <div className="am-composed-list">{backward.scan.best.changes.map((c,i)=><div key={i}><strong>{c.leverLabel}</strong><span>{c.optionLabel}</span></div>)}</div>
              <blockquote>Parmi les {backward.scan.reachingAdmissible} combinaison{backward.scan.reachingAdmissible>1?"s":""} qui atteignent l'objectif sans point bloquant, c'est celle qui change le moins de leviers — et, à nombre égal, celle au meilleur potentiel puis au moindre risque.{backward.scan.exhaustive ? ` Recherche exhaustive : ${backward.scan.totalCombinations.toLocaleString("fr-FR")} combinaisons examinées.` : " Résultat dans les limites de recherche (espace trop grand pour être parcouru en entier)."}</blockquote>
            </div>
            {backward.scan.alternatives.length>1 && <details className="am-alt-list">
              <summary><ChevronDown size={13}/> Voir d'autres combinaisons possibles ({backward.scan.distinctAdmissibleSets>6 ? `6 sur ${backward.scan.distinctAdmissibleSets}` : backward.scan.alternatives.length-1})</summary>
              <div className="am-alt-grid">
                {backward.scan.alternatives.slice(1).map((alt,i) => <div key={i} className="am-alt-card">
                  <p>{alt.changes.length ? alt.changes.map(c=>`${c.leverLabel} → ${c.optionLabel}`).join(" · ") : "Configuration actuelle"}</p>
                  <LevelBars value={alt.global as OrdinalImpact}/>
                </div>)}
              </div>
            </details>}
          </div>
          : backward.limit ? <div className="am-replay">
              <div><span>Avant</span><LevelPair value={backward.base.global}/></div>
              <div><span>Meilleur effort trouvé, avec {backward.limit.leversUsed.join(", ")}</span><LevelPair value={backward.limit.evaluation.global}/></div>
              <div className="warn">{backward.limit.vetoes.length?`Et créerait en plus un point bloquant sur : ${backward.limit.vetoes.join(", ")}`:"Cet objectif reste hors de portée avec les leviers disponibles, même en poussant chacun au maximum."}{backward.repairsComplete ? "" : " (résultat dans les limites de recherche)"}</div>
            </div>
          : <p className="am-muted">Aucun levier connu n'agit sur ce blocage — Aura ne fabrique pas de solution qui n'existe pas dans le modèle.</p>}
        </>}
      </section>}
    </div>}

    {view === "decision" && <div className="am-stack">
      <section className="am-card"><div className="am-card-head"><div><span>FICHE DE DÉCISION</span><h3>{focus.label}</h3></div>{isSigned && <span className="am-signed"><CheckCircle2 size={13}/> Signée le {new Date(decisionRecord!.signedAt).toLocaleDateString("fr-FR")}</span>}</div>
        <div className="am-record-grid">
          <div><small>CONDITIONS</small>{(isSigned ? decisionRecord!.conditions : (dom.nonDominated.includes(focus.id) ? ["Rien de bloquant", "Aucune autre option n'est meilleure sur tous les points à la fois"] : ["Rien de bloquant"])).map(c => <p key={c}>✓ {c}</p>)}</div>
          <div><small>PREUVES</small>{(isSigned ? decisionRecord!.preuves : discriminants.slice(0,4).map(d=>`${d.c.label} : ${d.cmp>0?`favorable à ${focus.label}`:`concession face à ${challenger?.label ?? "l'alternative"}`}`)).map((p,i) => <p key={i}>{p}</p>)}
            {!isSigned && discriminants.length === 0 && <p className="am-muted">Aucun écart discriminant avec l’alternative la plus proche.</p>}</div>
          <div><small>HYPOTHÈSES</small>{(isSigned ? decisionRecord!.hypotheses : robust.flips.slice(0,3).map(f=>`${f.critLabel} : stable tant qu'il reste sous ${LEVEL_LONG[f.to]}`)).map((h,i) => <p key={i}>{h}</p>)}
            {!isSigned && robust.flips.length === 0 && <p className="am-muted">Aucun seuil de bascule identifié sur un seul critère.</p>}</div>
          <div><small>ALTERNATIVE DE REPLI</small><p>{(scenarios.find(s => s.id === (isSigned ? decisionRecord!.fallbackScenarioId : challenger?.id))?.label) ?? "Aucune alternative crédible identifiée"}</p></div>
        </div>
        <footer className="am-record-footer">
          {isSigned ? <p className="am-muted">Cette fiche reflète ce qui a été lu dans le modèle au moment de la signature — elle ne se met plus à jour automatiquement.</p>
            : <button className="am-sign-btn" onClick={handleSign} disabled={!onSign}><ShieldCheck size={15}/> Signer cette décision</button>}
        </footer>
      </section>
    </div>}
  </section>;
}

const styles = `
.am-root{--indigo:var(--v4-accent,#7c3aed);--ink:var(--v4-text,#18153e);--muted:var(--v4-text3,#756f91);--line:var(--v4-border,#e7e4f1);--soft:var(--v4-bg,#f7f6ff);--green:#0e9f6e;--red:#dc4c64;color:var(--ink);font-family:var(--font-sans,Inter,system-ui,sans-serif);background:transparent;border-radius:0;min-width:0}.am-header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:18px;align-items:flex-start;padding:20px 0 14px;border-bottom:1px solid var(--line)}.am-header>div:first-child{min-width:0;flex:1 1 260px}.am-header>div:first-child span,.am-card-head span{font-size:12.5px;font-weight:700;letter-spacing:.1em;color:var(--muted)}.am-header h2{margin:3px 0 2px;font-size:clamp(22px,2.4vw,32px);letter-spacing:-.035em;font-weight:700}.am-header p,.am-card-head p,.am-muted,.am-empty-card,.am-success p,.am-sim-result p,.am-explain-note p{margin:0;color:var(--muted);font-size:13px;line-height:1.5}.am-header-right{display:flex;flex-direction:column;align-items:flex-end;gap:8px}.am-header-actions{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.am-status{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}.am-status span{padding:5px 9px;border-radius:6px;background:transparent;border:1px solid var(--line);font-size:12.5px;font-weight:700;color:var(--muted)}.am-status .good{display:flex;gap:5px;align-items:center;background:transparent;border-color:var(--line);color:var(--ink)}.am-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;padding:0;border-bottom:1px solid var(--line)}.am-tabs button{border:none;border-bottom:2px solid transparent;background:transparent;border-radius:0;padding:12px 8px;text-align:left;color:var(--muted);cursor:pointer;transition:all .15s}.am-tabs button strong,.am-tabs button small{display:block}.am-tabs button strong{font-size:13px;font-weight:600}.am-tabs button small{font-size:12.5px;margin-top:2px;color:var(--muted)}.am-tabs button.active{background:transparent;border-bottom-color:var(--indigo);color:var(--ink);box-shadow:none}.am-tabs button.active strong{font-weight:800}.am-tabs button.active small{color:var(--muted)}
.am-chain-details{margin-bottom:2px}.am-chain-intro{margin:0 0 10px}.am-explain-note-inline{display:flex;align-items:flex-start;gap:7px;margin:12px 0 0;padding-top:10px;border-top:1px solid #eeeaf5;color:var(--muted);font-size:13px;line-height:1.5}.am-explain-note-inline svg{flex-shrink:0;margin-top:1px;color:#5b42df}.am-stack{display:grid;gap:20px;padding:0}.am-hero,.am-card{background:transparent;border:none;border-top:1px solid var(--line);border-radius:0;box-shadow:none}.am-hero{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:14px;align-items:center;padding:16px 0}.am-trophy{width:40px;height:40px;border-radius:8px;display:grid;place-items:center;background:transparent;border:1px solid var(--line);color:var(--indigo)}.am-hero-copy span{font-size:12px;font-weight:700;letter-spacing:.09em;color:var(--muted)}.am-hero-copy h3{margin:3px 0;font-size:26px;font-weight:700}.am-hero-copy p{margin:0;color:var(--muted);font-size:13px}.am-hero-kpis{display:flex;gap:16px}.am-hero-kpis>div{min-width:92px;padding:0}.am-hero-kpis small{display:block;color:var(--muted);font-size:12px;margin-bottom:4px}.am-hero-kpis b{font-size:16px}.plus{color:var(--v4-text,#0b9b6a)!important}.minus{color:var(--v4-text,#d63b56)!important}.am-pair{display:inline-flex;gap:5px;justify-content:center}.am-pair b{font-size:12.5px;padding:3px 6px;border-radius:6px;background:transparent}.am-grid-eval{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(270px,.55fr);gap:24px}.am-card{padding:16px 0;min-width:0}.am-card-head{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}.am-card-head>div:first-child{min-width:0;flex:1 1 200px}.am-card-head h3{font-size:14px;margin:2px 0 0;font-weight:700}.am-card-head p{flex:1 1 240px;max-width:360px;min-width:0;text-align:right}.am-table-wrap{overflow:auto;border:none;border-top:1px solid var(--line);border-radius:0}.am-table-card table{border-collapse:collapse;width:100%;min-width:620px}.am-table-card th,.am-table-card td{padding:9px 10px;border-bottom:1px solid var(--line);text-align:center;font-size:12.5px}.am-table-card th:first-child,.am-table-card td:first-child{text-align:left}.am-table-card th{color:var(--muted);background:transparent;font-weight:700}.am-table-card td:first-child{font-weight:600}.am-table-card td.focus{background:transparent;font-weight:800}.am-imp{font-size:12px;font-weight:700;padding:2px 5px;border-radius:0;background:transparent;color:var(--muted)}.am-imp.i3{background:transparent;color:var(--ink);font-weight:800}.am-imp.i2{background:transparent;color:var(--ink)}.am-side{display:grid;gap:12px}.am-reasons,.am-watch{display:grid;gap:7px}.am-reasons>div,.am-watch>div{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-radius:0;background:transparent}.am-reasons b{width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:transparent;border:1px solid var(--line);color:var(--ink);font-size:12.5px;flex:0 0 auto}.am-reasons span strong,.am-reasons span small,.am-watch span strong,.am-watch span small{display:block}.am-reasons span strong,.am-watch span strong{font-size:13px}.am-reasons span small,.am-watch span small{font-size:12.5px;color:var(--muted);margin-top:2px}.am-watch svg{color:var(--v4-accent);margin-top:2px}.am-proof{border:none;border-top:1px solid var(--line);border-radius:0;background:transparent}.am-proof summary{display:flex;align-items:center;gap:6px;cursor:pointer;padding:10px 0;font-size:12.5px;font-weight:700;color:var(--ink)}.am-proof>div{padding:0 0 11px}.am-proof p{font-size:12.5px;color:var(--muted)}.am-proof-row{display:flex;justify-content:space-between;gap:15px;padding:6px 0;border-top:1px solid var(--line);font-size:12.5px}.am-chain{display:grid;gap:8px}.am-chain-row{display:grid;grid-template-columns:minmax(180px,.42fr) 24px minmax(0,1fr);gap:8px;align-items:center;padding:8px 0;border-radius:0;background:transparent}.am-chain-choice{padding:8px 0;border:none;border-left:2px solid var(--line);padding-left:10px;border-radius:0;background:transparent}.am-chain-choice small,.am-chain-choice strong,.am-chain-choice span{display:block}.am-chain-choice small{font-size:12px;color:var(--muted)}.am-chain-choice strong{font-size:13px;margin:2px 0}.am-chain-choice span{font-size:12.5px;color:var(--muted)}.am-chain-impacts{display:flex;flex-wrap:wrap;gap:6px}.am-chain-impacts>div{display:flex;align-items:center;gap:6px;padding:4px 8px;border:1px solid var(--line);border-radius:6px;background:transparent;max-width:100%}.am-chain-impacts .impact{font-size:12.5px}.am-chain-impacts .impact.pos{color:var(--ink);font-weight:700}.am-chain-impacts .impact.neg{color:var(--ink);font-weight:700}.am-chain-impacts span{font-size:12.5px;color:var(--muted)}.am-chain-result{display:flex;align-items:center;gap:10px;margin-top:4px;padding:10px 0;border-radius:0;background:transparent;border-top:1px solid var(--line)}.am-chain-result>div{flex:1}.am-chain-result small,.am-chain-result strong{display:block}.am-chain-result small{font-size:12px;color:var(--muted)}.am-chain-result strong{font-size:13px}.am-explain-note{display:flex;align-items:flex-start;gap:9px;background:transparent}.am-sim-controls label{font-size:12px;font-weight:700;color:var(--muted)}.am-sim-controls select{display:block;margin-top:3px;border:1px solid var(--line);border-radius:6px;background:transparent;padding:7px 8px;font:inherit;color:var(--ink)}.am-sim-controls{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr)) auto auto;gap:8px;align-items:end}.am-sim-controls button{height:34px;border:0;border-radius:6px;background:var(--indigo);color:#fff;padding:0 12px;font-size:12.5px;font-weight:700;display:flex;align-items:center;gap:5px;cursor:pointer}.am-sim-controls button.ghost{background:transparent;border:1px solid var(--line);color:var(--ink)}.am-sim-result{margin-top:11px;display:flex;gap:8px;align-items:center;padding:11px 0;border-radius:0;border-top:1px solid var(--line);background:transparent;color:var(--ink)}.am-sim-result.warn{background:transparent;color:var(--ink);font-weight:700}.am-empty,.am-empty-card{padding:18px;border:1px dashed var(--line);border-radius:6px;background:transparent;color:var(--muted)}.am-empty{margin:20px 0}.am-empty-card{font-size:13px}
.am-backward-link{justify-self:start;border:0;background:none;color:var(--indigo);font-size:13px;font-weight:700;display:flex;align-items:center;gap:6px;cursor:pointer;padding:4px 2px;font-family:inherit}.am-backward-link:hover{text-decoration:underline}
.am-targetbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.am-targetbar label{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.am-targetbar select{display:block;margin-top:4px;border:1px solid var(--line);border-radius:6px;background:transparent;padding:7px 9px;font:inherit;font-size:13px;color:var(--ink)}
.am-success{display:flex;align-items:center;gap:9px;padding:12px 0;border-radius:0;background:transparent;border-top:1px solid var(--line);color:var(--ink)}
.am-obj{background:transparent}
.am-ruler{margin:2px 0 14px}.am-ruler-track{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.am-ruler-seg{height:8px;border-radius:6px;background:var(--line);position:relative}.am-ruler-seg.cur{background:var(--v4-text3,#c8bdfd)}.am-ruler-seg .mk{position:absolute;top:-15px;left:50%;transform:translateX(-50%);font-size:13px;line-height:1}.am-ruler-seg .mk-cur{color:var(--indigo)}.am-ruler-seg .mk-tgt,.am-ruler-seg .mk-tgt-on-cur{color:var(--ink);top:12px}.am-ruler-seg .mk-ceil{color:var(--muted);top:12px}
.am-ruler-labels{display:grid;grid-template-columns:repeat(4,1fr);margin-top:16px;font-size:12.5px;font-weight:700;color:var(--muted);text-align:center}
.am-ruler-legend{display:flex;gap:14px;margin-top:8px;font-size:12.5px;color:var(--muted);font-weight:700}.am-ruler-legend span{display:flex;align-items:center;gap:4px}.am-ruler-legend .dot{width:7px;height:7px;border-radius:50%;display:inline-block}.am-ruler-legend .dot.cur{background:var(--indigo)}.am-ruler-legend .dot.tgt{background:var(--ink)}.am-ruler-legend .dot.ceil{background:var(--muted)}
.am-obj-count{font-size:13px;color:var(--muted);margin:0 0 14px}.am-obj-count strong{color:var(--ink)}
.am-obj-flow{display:flex;flex-direction:column;gap:10px}.am-obj-hero{padding:14px 0}.am-obj-hero h3{font-size:16px}
.am-help{position:relative;display:inline-flex;vertical-align:middle}.am-help-btn{border:1px solid var(--line);background:transparent;color:var(--muted);width:16px;height:16px;border-radius:50%;display:grid;place-items:center;cursor:pointer;padding:0;flex-shrink:0;margin-left:3px}.am-help-btn:hover{background:transparent;color:var(--indigo)}.am-help>.am-help-pop{position:absolute;z-index:30;top:calc(100% + 6px);left:0;right:auto;width:min(230px,calc(100vw - 40px));padding:9px 11px;border-radius:6px;background:var(--ink)!important;color:#fff!important;font-size:13px;font-weight:500;line-height:1.5;box-shadow:0 8px 20px rgba(0,0,0,.18);text-transform:none;letter-spacing:normal}
.am-header-right .am-help>.am-help-pop,.am-status .am-help>.am-help-pop{left:auto;right:0}
.am-alt-list{margin-bottom:10px}.am-alt-list summary{cursor:pointer;font-size:13px;font-weight:700;color:var(--indigo);padding:4px 0}.am-alt-grid{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}.am-alt-card{flex:1 1 200px;min-width:180px;padding:9px 10px;border-radius:6px;background:transparent;border:1px solid var(--line);display:flex;flex-direction:column;gap:6px}.am-alt-card>p{margin:0;font-size:13px;font-weight:600;color:var(--ink)}
.am-back-result{display:flex;flex-direction:column;gap:10px}
.am-replay{display:grid;gap:8px}.am-replay>div{padding:9px 0;border-radius:0;border-top:1px solid var(--line);background:transparent;display:flex;flex-direction:column;gap:3px}.am-replay>div>span:first-child{font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.am-replay .ok{background:transparent;color:var(--ink);font-size:13px;font-weight:700;flex-direction:row!important;align-items:center}.am-replay .bad{background:transparent;color:var(--ink);font-size:13px;font-weight:800;flex-direction:row!important;align-items:center}.am-replay .warn{background:transparent;color:var(--ink);font-size:13px;font-weight:700;flex-direction:row!important;align-items:center}
.am-sk-wrap{display:flex;align-items:center;gap:0;overflow-x:auto;padding-bottom:4px}.am-sk-col{display:flex;flex-direction:column;gap:5px;min-width:128px;max-width:160px;flex-shrink:0}.am-sk-col-title{font-size:12.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:2px;padding-left:2px}.am-sk-node{height:${SK_ROW_H}px;display:flex;align-items:center;justify-content:space-between;gap:6px;padding:0 9px;border-radius:6px;border:1px solid;font-size:13px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden}.am-sk-node span{overflow:hidden;text-overflow:ellipsis}.am-sk-node b{font-size:13px;font-weight:900;flex-shrink:0}.am-sk-connector{flex-shrink:0}.am-sk-result{min-width:150px}.am-sk-node.result{height:44px;font-size:13px;font-weight:800}
.am-sk-node.input{background:transparent;border-color:var(--line);flex-direction:column;align-items:flex-start;justify-content:center;gap:0;padding:3px 9px}.am-sk-node.input span{display:flex;flex-direction:column;gap:0;overflow:hidden;width:100%}.am-sk-node.input strong{font-size:12.5px;font-weight:700;line-height:1.15;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.am-sk-node.input small{font-size:12px;font-weight:700;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.am-hero-composed{border-color:var(--line);background:transparent}.am-composed-list{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px}.am-composed-list>div{padding:7px 10px;border-radius:0;background:transparent;border:none;border-left:2px solid var(--line);min-width:120px}.am-composed-list strong{display:block;font-size:12.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}.am-composed-list span{display:block;font-size:13px;color:var(--ink);margin-top:2px}
.am-rank-list{display:flex;flex-wrap:wrap;gap:9px;align-items:stretch}.am-rank-row{flex:1 1 200px;min-width:180px;padding:11px 0;border-radius:0;background:transparent;border:none;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px;box-shadow:none}.am-rank-row.am-rank-current{border-top-color:var(--line);background:transparent}.am-rank-row.am-rank-reco{border-top-color:var(--indigo);background:transparent;box-shadow:none}.am-rank-ribbon{display:flex;align-items:center;gap:3px;font-size:13px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;color:var(--indigo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.am-rank-ribbon svg{flex-shrink:0}.am-rank-top{display:flex;align-items:center;gap:6px;min-width:0}.am-rank-top strong{font-size:18px;font-weight:700;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.am-rank-num{width:24px;height:24px;border-radius:50%;background:transparent;border:1px solid var(--line);color:var(--ink);display:grid;place-items:center;font-size:13px;font-weight:700;flex-shrink:0}.am-rank-row.am-rank-reco .am-rank-num{background:var(--indigo);border-color:var(--indigo);color:#fff}
.am-explain-btn{align-self:flex-start;border:1px solid var(--line);background:transparent;color:var(--indigo);font-size:12.5px;font-weight:700;border-radius:6px;padding:5px 9px;display:inline-flex;align-items:center;gap:5px;cursor:pointer;font-family:inherit;margin-top:2px}.am-explain-btn:hover{background:var(--soft)}
.am-explain-loading{font-size:12.5px;font-weight:700;color:var(--muted);display:inline-flex;align-items:center;gap:5px;margin-top:2px}.am-explain-loading.warn{color:var(--ink)}
.am-explain-ai{margin-top:4px;display:flex;flex-direction:column;gap:6px;font-size:12.5px;line-height:1.4}.am-explain-ai>div{padding:6px 0;border-radius:0}.am-explain-ai strong{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;margin-bottom:2px;color:var(--muted)}.am-explain-ai ul{margin:0;padding-left:14px}.am-explain-ai .force{background:transparent;color:var(--ink)}.am-explain-ai .risk{background:transparent;color:var(--ink)}.am-explain-ai .other{background:transparent;color:var(--muted)}.am-origin-badge{font-size:12.5px;font-weight:700;padding:2px 6px;border-radius:6px;width:max-content;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;background:transparent;border:1px solid var(--line)}.am-origin-badge.aura{color:var(--indigo);border-color:var(--indigo)}.am-origin-badge.user{color:var(--muted)}.am-origin-badge.breach{color:var(--ink);font-weight:800;display:inline-flex;align-items:center;gap:3px}
.am-bars{display:flex;flex-direction:column;gap:2px;min-width:0}.am-bars-row{display:grid;grid-template-columns:48px auto 1fr;gap:5px;align-items:center}.am-bars-row small{font-size:12px;color:var(--muted);font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.am-bars-track{display:flex;gap:1px}.am-bars-track i{width:7px;height:5px;border-radius:6px;background:var(--line);display:block}.am-bars-track i.on.plus{background:#16a34a}.am-bars-track i.on.minus{background:#dc2626}.am-bars-row b{font-size:12px;font-weight:700;text-align:right;white-space:nowrap}.am-bars-row b.plus{color:#15803d}.am-bars-row b.minus{color:#dc2626}
.am-incomplete .am-hero-sub:not(.keep),.am-incomplete .am-hero-pills,.am-incomplete .am-composed-list,.am-incomplete blockquote,.am-incomplete .am-hero-chip{display:none}
.am-hero-reco{background:transparent;border:none;border-top:1px solid var(--line);border-radius:0;box-shadow:none;padding:16px 0}.am-hero-reco.aura{border-top-color:var(--indigo);background:transparent}.am-hero-top{display:flex;align-items:center;gap:8px;margin-bottom:6px}.am-hero-star{width:24px;height:24px;border-radius:6px;background:transparent;border:1px solid var(--line);color:var(--indigo);display:grid;place-items:center;flex-shrink:0}.am-hero-title{font-size:12.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}.am-hero-chip{font-size:12.5px;font-weight:700;padding:2px 7px;border-radius:6px;background:transparent;border:1px solid var(--indigo);color:var(--indigo)}.am-hero-reco h3{margin:2px 0 3px;font-size:22px;font-weight:700;color:var(--ink)}.am-hero-sub{margin:0 0 10px;color:var(--muted);font-size:13px}.am-hero-pills{display:flex;flex-wrap:wrap;gap:7px;margin-bottom:10px}.am-hero-pills span{display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:6px;background:transparent;border:1px solid var(--line);color:var(--ink);font-size:13px;font-weight:600}.am-hero-pills .pill-breach{background:transparent;border-color:var(--ink);color:var(--ink);font-weight:800}.am-hero-reco blockquote{margin:10px 0 0;padding:9px 12px;border-left:2px solid var(--indigo);background:transparent;font-size:13px;font-style:italic;color:var(--muted);border-radius:0}
.am-lattice-meta{font-size:12.5px;color:var(--muted);margin-bottom:8px}.am-estimate-flag{color:var(--muted);font-weight:700}.am-lattice-plot{display:flex;gap:6px}.am-lattice-ylabel{writing-mode:vertical-rl;transform:rotate(180deg);font-size:12px;font-weight:700;color:var(--muted);text-align:center;flex:0 0 auto;padding:2px 0}.am-lattice-body{flex:1;min-width:0}.am-lattice-plot-row{display:grid;grid-template-columns:44px repeat(4,1fr);gap:4px;margin-bottom:4px;align-items:center}.am-lattice-ytick{font-size:12px;color:var(--muted);font-weight:700;text-align:right;padding-right:2px}
/* Carte qualitative : une teinte par zone RÉELLE du treillis (jamais un simple
   dégradé indigo->rien) — sans effet (gris), apport net (indigo), apport sous
   réserve (violet, la seule zone où gain ET risque coexistent), exposition
   (ambre). Les cases atteintes par au moins une combinaison ("has") prennent
   la teinte pleine de leur zone ; les cases inatteignables gardent la trame
   hachurée, dans la même teinte mais très adoucie, pour rester repérables
   sans jamais se confondre avec une case occupée. */
.am-lattice-cell{aspect-ratio:1;border-radius:8px;border:1px solid #ece9f5;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;color:#c2bdd6;font-size:13px;font-weight:800;padding:4px;overflow:hidden}
.am-lattice-cell-top{display:flex;align-items:center;gap:3px;flex:0 0 auto}
.am-lattice-count{font-size:13px}
.am-lattice-blocked{font-size:12px;display:flex;align-items:center;gap:2px;color:#b5470b;font-weight:800}
.am-lattice-cell.blocked{border-color:#eab08a}
.am-lattice-cell.z-none.blocked{background-color:#fcd9c3;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);color:#b5470b}
.am-lattice-cell.z-net.blocked{background-color:#f3d2c5;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);color:#b5470b}
.am-lattice-cell.z-mixed.blocked{background-color:#f4cfd5;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);color:#b5470b}
.am-lattice-cell.z-exposed.blocked{background-color:#f9cdac;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);color:#b5470b}
.am-lattice-alts{display:flex;flex-direction:column;gap:2px;align-items:center;margin-top:2px;max-width:100%}
.am-lattice-alt{font-size:12px;font-weight:700;padding:1.5px 5px;border-radius:6px;background:#fff;border:1px solid currentColor;line-height:1.3;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-sizing:border-box}
.am-lattice-alt.user{color:#5b42df;border-color:#c9c0f5}
.am-lattice-alt.aura{color:#0a7d59;border-color:#bfe8d6}
.am-lattice-cell.reco .am-lattice-alt{background:rgba(255,255,255,.92)}
.am-lattice-alt-more{font-size:12px;font-weight:700;color:inherit;opacity:.75}
.am-lattice-cell.z-none{background-color:#e8ebee;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);border-color:#c7cdd3;color:#8b95a1}
.am-lattice-cell.z-net{background-color:#e0e3ff;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);border-color:#b7bcfa;color:#7278e0}
.am-lattice-cell.z-mixed{background-color:#ebd6f5;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);border-color:#d3aeed;color:#9c5fd6}
.am-lattice-cell.z-exposed{background-color:#fae3bf;background-image:repeating-linear-gradient(135deg,rgba(255,255,255,0) 0 6px,rgba(255,255,255,.4) 6px 12px);border-color:#eec27e;color:#c98b1f}
.am-lattice-cell.z-none.has{background:#c7cdd3;color:#33404c;border-color:#a9b1ba}
.am-lattice-cell.z-net.has{background:#c2c7ff;color:#2e21a8;border-color:#a4a8f7}
.am-lattice-cell.z-mixed.has{background:#e0bdf5;color:#6221a8;border-color:#cd93ec}
.am-lattice-cell.z-exposed.has{background:#f6c778;color:#7a4400;border-color:#e8a83f}
.am-lattice-cell.reco{background:var(--indigo)!important;color:#fff!important;border-color:var(--indigo)!important;box-shadow:0 0 0 3px #5b42df26}
.am-lattice-xticks{display:grid;grid-template-columns:44px repeat(4,1fr);gap:4px;font-size:12px;color:var(--muted);font-weight:700;text-align:center}.am-lattice-xlabel{font-size:12px;font-weight:700;color:var(--muted);text-align:center;margin-top:4px}
.am-lattice-legend{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px 14px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line)}
.am-lattice-legend .lg-row{display:flex;align-items:flex-start;gap:8px}
.am-lattice-legend .lg-swatch{width:13px;height:13px;border-radius:6px;flex:0 0 auto;margin-top:1px;border:1px solid transparent}
.am-lattice-legend .lg-swatch.z-none{background:#c7cdd3;border-color:#a9b1ba}
.am-lattice-legend .lg-swatch.z-net{background:#c2c7ff;border-color:#a4a8f7}
.am-lattice-legend .lg-swatch.z-mixed{background:#e0bdf5;border-color:#cd93ec}
.am-lattice-legend .lg-swatch.z-exposed{background:#f6c778;border-color:#e8a83f}
.am-lattice-legend .lg-swatch.reco{background:var(--indigo);border-radius:50%}
.am-lattice-legend .lg-row strong{display:block;font-size:13px;font-weight:700;color:var(--ink)}
.am-lattice-legend .lg-row small{display:block;font-size:12.5px;color:var(--muted);line-height:1.4;margin-top:1px}
.am-lattice-legend .lg-note{grid-column:1/-1;font-size:12.5px;color:var(--muted);font-style:italic;line-height:1.5;padding-top:4px;border-top:1px dashed var(--line)}
.am-rank-impacts{display:flex;flex-direction:column;gap:1px;margin-top:1px}.am-rank-impacts span{font-size:12.5px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:block}.am-rank-impacts .imp-up{color:#15803d;font-weight:600}.am-rank-impacts .imp-down{color:#dc2626;font-weight:600}
.am-hero-pills .pill-gplus,.am-hero-pills .pill-dminus{font-weight:700}.pill-gplus.lv0,.pill-gplus.lv1,.pill-gplus.lv2,.pill-gplus.lv3,.pill-dminus.lv0,.pill-dminus.lv1,.pill-dminus.lv2,.pill-dminus.lv3{background:transparent;border:1px solid var(--line);color:var(--ink)}.pill-gplus.lv3,.pill-dminus.lv3{font-weight:800;border-color:var(--ink)}
.am-action-bar{display:flex;gap:8px;flex-wrap:wrap;padding-top:4px}.am-action-bar button{display:inline-flex;align-items:center;gap:6px;padding:9px 14px;border-radius:6px;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.am-action-bar button.am-action-primary{margin-left:auto;border:0;background:var(--indigo);color:#fff;font-weight:700}
.am-signed{display:flex;align-items:center;gap:5px;font-size:12.5px;font-weight:700;color:var(--ink);background:transparent;border:1px solid var(--line);padding:5px 9px;border-radius:6px;flex-shrink:0}.am-record-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.am-record-grid>div{padding:11px 0;border-radius:0;background:transparent;border:none;border-top:1px solid var(--line)}.am-record-grid small{display:block;font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--muted);margin-bottom:6px}.am-record-grid p{margin:0 0 4px;font-size:13px;color:var(--ink);line-height:1.45}.am-record-footer{margin-top:12px;padding-top:12px;border-top:1px solid var(--line);display:flex;justify-content:flex-end}.am-sign-btn{border:0;border-radius:6px;background:var(--indigo);color:#fff;padding:10px 16px;font-size:13px;font-weight:700;display:flex;align-items:center;gap:7px;cursor:pointer}.am-sign-btn:disabled{opacity:.45;cursor:default}
@media(max-width:1050px){.am-grid-eval,.am-record-grid{grid-template-columns:1fr}.am-hero{grid-template-columns:auto 1fr}.am-hero-kpis{grid-column:1/-1}.am-sim-controls{grid-template-columns:repeat(2,1fr)}.am-chain-row{grid-template-columns:1fr}.am-chain-row>svg{transform:rotate(90deg);justify-self:center}}
.am-lattice-key{display:none}
@media(max-width:640px){.am-lattice-plot{gap:4px;flex-direction:column}.am-lattice-ylabel{writing-mode:horizontal-tb;transform:none;text-align:left}.am-lattice-plot-row,.am-lattice-xticks{grid-template-columns:50px repeat(4,minmax(0,1fr));gap:3px}.am-lattice-cell{aspect-ratio:auto;min-height:64px;padding:3px 2px}.am-lattice-alt{display:block;overflow:hidden;text-overflow:ellipsis}.am-lattice-key{display:grid;gap:6px;list-style:none;margin:10px 0 4px;padding:10px 0 0;border-top:1px solid var(--line)}.am-lattice-key li{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px}.am-lattice-key .am-lattice-alt{white-space:normal;max-width:100%}.am-lattice-key small{font-size:12.5px;color:var(--muted)}}
@media(max-width:700px){.am-header{padding:15px 0;display:block}.am-status{margin-top:10px}.am-tabs{padding:0}.am-stack{padding:0}.am-hero{grid-template-columns:1fr}.am-trophy{display:none}.am-hero-kpis{display:grid;grid-template-columns:repeat(3,1fr)}.am-hero-kpis>div{min-width:0}.am-sim-controls{grid-template-columns:1fr}.am-card-head{display:block}.am-card-head p{text-align:left;margin-top:4px;max-width:none}}
`;
