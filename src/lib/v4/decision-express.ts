// Parcours de décision court, commun à Décider autonome et à Décider lancé
// depuis une alerte Supply : Question → Options et critères → Résultat →
// Suivre. Tout le calcul passe par le moteur Bora (src/lib/engine, jamais
// modifié) : agrégation de Lo, comparaison lexicographique bipolaire.
import { aggregateNode, compareASC, thesisWeights } from "../engine/lo/aggregation";
import type { Attitude, OrdinalLevel } from "../engine/lo/types";
import { aggregateHierarchy, getLeafCriteria, importanceToWeight } from "./atelier-compute";
import { EXHAUSTIVE_LIMIT, searchMinimalRepairs } from "./exhaustive-search";
import { ScenarioRanker } from "./fast-eval";
import { decisionBackward } from "./lo-search";
import { buildModel, TEMPLATES } from "./decision-templates";
import { specialize, supplyProfileFor } from "./supply-profiles";
import { optionHints } from "./decision-dialogue";
import type {
  AtelierCriterion, AtelierLevierDef, AtelierOptionDef, AtelierScenario, AtelierSession, ImportanceBadge, QualitativeImpact,
} from "./atelier-store";

type LoResult = { gPlus: OrdinalLevel; dMinus: OrdinalLevel };

// ── Calcul (déplacé de cockpit.atelier.tsx, inchangé) ─────────────────────
export function computeLoResults(session: AtelierSession) {
  const attitudeCode: Attitude = session.attitude === "Pessimiste" ? 1 : 2;
  const profile: "prudent" | "optimiste" = session.attitude === "Pessimiste" ? "prudent" : "optimiste";
  const optionIndex: Record<string, AtelierOptionDef> = {};
  for (const lev of session.leviersDef) for (const opt of lev.options) optionIndex[opt.id] = opt;
  const weights = session.criteria.map(c => importanceToWeight(c.importance));
  const normWeights: OrdinalLevel[] = thesisWeights(weights);
  const cellResults: Record<string, Record<string, import("../engine/lo/types").OrdinalImpact>> = {};
  const nodeResults: Record<string, LoResult> = {};
  // Remontée MOE ← MOP ← TPM : impact bipolaire de chaque nœud de l'arbre.
  const levelCells: Record<string, Record<string, import("../engine/lo/types").OrdinalImpact>> = {};
  for (const sc of session.scenarios) {
    cellResults[sc.id] = {};
    levelCells[sc.id] = {};
    const stage1: import("../engine/lo/types").OrdinalImpact[] = [];
    const walk = (node: AtelierCriterion) => {
      levelCells[sc.id][node.id] = aggregateHierarchy(node, sc, optionIndex, attitudeCode, profile);
      (node.children ?? []).forEach(walk);
    };
    for (const c of session.criteria) {
      const result = aggregateHierarchy(c, sc, optionIndex, attitudeCode, profile);
      cellResults[sc.id][c.id] = result;
      walk(c);
      stage1.push(result);
    }
    try {
      nodeResults[sc.id] = aggregateNode(stage1.length ? stage1 : [{ gPlus: 0, dMinus: 0 }], normWeights.length ? normWeights : [3]);
    } catch {
      nodeResults[sc.id] = { gPlus: 0, dMinus: 0 };
    }
  }
  return { cellResults, nodeResults, normWeights, optionIndex, levelCells };
}

// ── Classement ──────────────────────────────────────────────────────────────
export interface RankedOption { id: string; label: string; color: string; gPlus: OrdinalLevel; dMinus: OrdinalLevel; rank: number }

export function rankOptions(session: AtelierSession): RankedOption[] {
  const { nodeResults } = computeLoResults(session);
  // Une option suggérée par Aura n'entre au classement qu'une fois validée.
  const suggested = suggestedOptionIds(session);
  const list = session.scenarios.filter(s => !s.leviers.some(l => suggested.has(l.valeur))).map(s => ({ id: s.id, label: s.label, color: s.color, ...(nodeResults[s.id] ?? { gPlus: 0 as OrdinalLevel, dMinus: 0 as OrdinalLevel }) }));
  list.sort((a, b) => compareASC(b, a));
  let rank = 0;
  return list.map((o, i) => {
    if (i === 0 || compareASC(list[i - 1], o) !== 0) rank = i + 1;
    return { ...o, rank };
  });
}

export const LEVEL_LABEL = ["nul", "faible", "moyen", "fort"] as const;

// ── Options suggérées par Aura et complétude des impacts ────────────────────
/** Options ajoutées par Aura (exploratoires) et pas encore validées. */
export function suggestedOptionIds(session: AtelierSession): Set<string> {
  return new Set(session.leviersDef.flatMap(l => l.options.filter(o => o.exploratoire && !o.validated).map(o => o.id)));
}
/** Session réduite aux scénarios classables (sans option suggérée non validée). */
export function rankableSession(session: AtelierSession): AtelierSession {
  const sug = suggestedOptionIds(session);
  if (!sug.size) return session;
  return { ...session, scenarios: session.scenarios.filter(s => !s.leviers.some(l => sug.has(l.valeur))) };
}
/** Espace explorable : sans les options suggérées non validées (ni les scénarios qui les portent). */
export function withoutSuggestedOptions(session: AtelierSession): AtelierSession {
  const sug = suggestedOptionIds(session);
  if (!sug.size) return session;
  return { ...rankableSession(session), leviersDef: session.leviersDef.map(l => ({ ...l, options: l.options.filter(o => !sug.has(o.id)) })) };
}
export function validateOption(session: AtelierSession, optionId: string): Partial<AtelierSession> {
  return { leviersDef: session.leviersDef.map(l => ({ ...l, options: l.options.map(o => o.id === optionId ? { ...o, validated: true } : o) })) };
}

export const COMPLETENESS_MIN = 0.6;
export interface MissingImpact { optionId: string; option: string; criterionId: string; criterion: string }
/**
 * Part des impacts renseignés sur les options qui départagent les scénarios
 * (leviers dont l'option varie d'un scénario à l'autre) × indicateurs.
 * Manquant : case vide, « ? », ou « sans effet » supposé par Aura sans indice.
 * Une hypothèse d'Aura avec un sens compte comme renseignée (« à confirmer »).
 */
export function impactCompleteness(session: AtelierSession): { filled: number; total: number; ratio: number; missing: MissingImpact[]; reliable: boolean } {
  const leaves = getLeafCriteria(session.criteria);
  const suggested = suggestedOptionIds(session);
  const scen = session.scenarios.filter(s => !s.leviers.some(l => suggested.has(l.valeur)));
  const used = new Set(scen.flatMap(s => s.leviers.map(l => l.valeur)));
  const varying = session.leviersDef.filter(l => new Set(scen.map(s => s.leviers.find(x => x.id === l.id)?.valeur)).size > 1);
  const missing: MissingImpact[] = [];
  let total = 0;
  for (const l of varying) for (const o of l.options) {
    if (!used.has(o.id)) continue;
    for (const c of leaves) {
      total++;
      const v = o.impacts[c.id];
      // « Sans effet » supposé par Aura sans justification = case non évaluée.
      const empty = v === undefined || v === "U" || (v === "0" && !!o.impactOrigins?.[c.id] && o.impactOrigins[c.id] !== "donnees" && !o.impactReasons?.[c.id]);
      if (empty) missing.push({ optionId: o.id, option: o.label, criterionId: c.id, criterion: c.label });
    }
  }
  const filled = total - missing.length;
  const ratio = total ? filled / total : 1;
  return { filled, total, ratio, missing, reliable: ratio >= COMPLETENESS_MIN };
}
/** Nombre de cases à compléter pour atteindre le seuil. */
export function impactsToComplete(c: { filled: number; total: number }): number {
  return Math.max(0, Math.ceil(COMPLETENESS_MIN * c.total) - c.filled);
}

// Écart lisible entre le premier et le deuxième.
export function gapText(a: RankedOption, b: RankedOption | undefined): string {
  if (!b) return "Seule option évaluée.";
  if (a.rank === b.rank) return `À égalité avec « ${b.label} » : le modèle ne les départage pas.`;
  const parts: string[] = [];
  if (a.dMinus < b.dMinus) parts.push(`risque ${LEVEL_LABEL[a.dMinus]} contre ${LEVEL_LABEL[b.dMinus]}`);
  if (a.gPlus > b.gPlus) parts.push(`potentiel ${LEVEL_LABEL[a.gPlus]} contre ${LEVEL_LABEL[b.gPlus]}`);
  if (!parts.length) parts.push(`même profil, départagé par l'ordre du moteur`);
  return `Devance « ${b.label} » : ${parts.join(", ")}.`;
}

// ── Plus petit changement : backward strict ─────────────────────────────────
// Même recherche exhaustive que l'ancien backward (searchMinimalRepairs,
// jusqu'à EXHAUSTIVE_LIMIT = 10⁶ évaluations, par nombre de changements
// croissant) ; les variables sont ici les notes des options sur chaque
// critère (−− à ++) et l'importance de chaque critère (N/L/M/H). Chaque
// candidat est reclassé par le moteur Bora (computeLoResults → aggregateNode,
// comparaison compareASC) : le moteur reste le seul juge.
const IMPORTANCE_ORDER: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
export const IMPORTANCE_SHORT: Record<ImportanceBadge, string> = { Faible: "N", Secondaire: "L", Important: "M", Essentiel: "H" };
const NOTES: QualitativeImpact[] = ["--", "-", "-L", "0", "+L", "+", "++"];
export const NOTE_LABEL: Record<QualitativeImpact, string> = { "--": "H défavorable", "-": "M défavorable", "-L": "L défavorable", "0": "NUL", "+L": "L favorable", "+": "M favorable", "++": "H favorable", U: "?" };

export interface BackwardChange {
  kind: "note" | "importance";
  criterionId: string; criterion: string;
  optionId?: string; option?: string;
  from: string; to: string;
}
export interface BackwardResult {
  found: boolean;
  changes: BackwardChange[];
  winnerId?: string; winner?: string; before: string;
  complete: boolean; evaluated: number; spaceSize: number; minSize: number | null;
  /** Nombre exact de configurations minimales ; forme compacte (variable → valeurs admissibles). */
  count?: number; admissible?: Record<string, string[]>; method?: "dp" | "bfs"; ms?: number;
}

// Variables de la recherche et application d'une configuration à la session.
function backwardSpace(session: AtelierSession) {
  const used = new Set(session.scenarios.flatMap(sc => sc.leviers.map(l => l.valeur)));
  const leaves = getLeafCriteria(session.criteria);
  const vars: { id: string; kind: "note" | "importance"; optionId?: string; criterionId: string; values: string[]; base: string }[] = [];
  for (const c of session.criteria) vars.push({ id: `i|${c.id}`, kind: "importance", criterionId: c.id, values: IMPORTANCE_ORDER, base: c.importance });
  for (const lev of session.leviersDef) for (const o of lev.options) {
    if (!used.has(o.id)) continue;
    for (const c of leaves) vars.push({ id: `n|${o.id}|${c.id}`, kind: "note", optionId: o.id, criterionId: c.id, values: NOTES, base: o.impacts[c.id] ?? "0" });
  }
  const apply = (config: Record<string, string>): AtelierSession => {
    const imp = new Map<string, ImportanceBadge>();
    const notes = new Map<string, Map<string, QualitativeImpact>>();
    for (const v of vars) {
      const val = config[v.id];
      if (val === undefined || val === v.base) continue;
      if (v.kind === "importance") imp.set(v.criterionId, val as ImportanceBadge);
      else { const m = notes.get(v.optionId!) ?? new Map(); m.set(v.criterionId, val as QualitativeImpact); notes.set(v.optionId!, m); }
    }
    if (!imp.size && !notes.size) return session;
    return {
      ...session,
      criteria: imp.size ? session.criteria.map(c => imp.has(c.id) ? { ...c, importance: imp.get(c.id)! } : c) : session.criteria,
      leviersDef: notes.size ? session.leviersDef.map(l => ({ ...l, options: l.options.map(o => { const m = notes.get(o.id); return m ? { ...o, impacts: { ...o.impacts, ...Object.fromEntries(m) } } : o; }) })) : session.leviersDef,
    };
  };
  return { vars, apply };
}

// Version optimisée (évaluation incrémentale, caches) : mêmes variables, même
// recherche, même critère de bascule que la version naïve ci-dessous, dont
// elle doit donner exactement le même résultat (tests de propriété).
export function backwardSmallestChange(input: AtelierSession, opts: { limit?: number; onProgress?: (evaluated: number, k: number) => void } = {}): BackwardResult | null {
  const session = rankableSession(input);
  if (session.scenarios.length < 2) return null;
  const ranker = new ScenarioRanker(session);
  const empty = { importance: new Map(), notes: new Map() };
  const base = ranker.rank(empty);
  const leader = base[0];
  const { vars } = backwardSpace(session);
  const byVar = new Map(vars.map(v => [v.id, v]));
  const baseConfig = Object.fromEntries(vars.map(v => [v.id, v.base]));
  const toChanges = (cfg: Record<string, string>) => {
    const ch: { importance: Map<string, ImportanceBadge>; notes: Map<string, Map<string, QualitativeImpact>> } = { importance: new Map(), notes: new Map() };
    for (const v of vars) {
      const val = cfg[v.id];
      if (val === v.base) continue;
      if (v.kind === "importance") ch.importance.set(v.criterionId, val as ImportanceBadge);
      else { const m = ch.notes.get(v.optionId!) ?? new Map(); m.set(v.criterionId, val as QualitativeImpact); ch.notes.set(v.optionId!, m); }
    }
    return ch;
  };
  const winnerOf = (cfg: Record<string, string>) => {
    const r = ranker.rank(toChanges(cfg));
    return r[0].id !== leader.id && (r.length < 2 || r[0].rank !== r[1].rank) ? r[0] : undefined;
  };
  // 1) Programmation dynamique exacte (lo-search) : toutes les solutions minimales, dénombrées.
  const dp = opts.limit !== undefined ? null : decisionBackward(session, { onProgress: opts.onProgress ? (d, t) => opts.onProgress!(d, t) : undefined });
  if (dp && dp.complete) {
    const meta = { before: leader.label, complete: true, evaluated: dp.states, spaceSize: dp.spaceSize, count: dp.count, admissible: dp.admissible, method: "dp" as const, ms: dp.ms };
    if (dp.k === null) return { found: false, changes: [], minSize: null, ...meta };
    const repairs = dp.solutions.map(changes => ({ changes, config: { ...baseConfig, ...changes } }));
    return { ...pickRepair(session, vars, byVar, { repairs, minSize: dp.k, complete: true, evaluated: dp.states, spaceSize: dp.spaceSize }, base[1]?.id, winnerOf, leader.label), count: dp.count, admissible: dp.admissible, method: "dp", ms: dp.ms };
  }
  // 2) Budget d'états dépassé : recherche par nombre de changements croissant, limite annoncée.
  const search = searchMinimalRepairs({ levers: vars.map(v => ({ id: v.id, optionIds: v.values })), base: baseConfig, isValid: cfg => !!winnerOf(cfg), limit: opts.limit ?? EXHAUSTIVE_LIMIT, onProgress: opts.onProgress });
  if (!search.repairs.length) return { found: false, changes: [], before: leader.label, complete: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, minSize: search.minSize };
  return pickRepair(session, vars, byVar, search, base[1]?.id, winnerOf, leader.label);
}

type Var = ReturnType<typeof backwardSpace>["vars"][number];
function pickRepair(session: AtelierSession, vars: Var[], byVar: Map<string, Var>, search: ReturnType<typeof searchMinimalRepairs>, secondId: string | undefined, winnerOf: (cfg: Record<string, string>) => { id: string; label: string } | undefined, before: string): BackwardResult {
  const dist = (changes: Record<string, string>) => Object.entries(changes).reduce((d, [id, to]) => { const v = byVar.get(id)!; return d + Math.abs(v.values.indexOf(to) - v.values.indexOf(v.base)); }, 0);
  const scored = search.repairs.map(r => ({ r, w: winnerOf(r.config)! }));
  const pick = [...scored].sort((a, b) => Number(a.w.id !== secondId) - Number(b.w.id !== secondId) || dist(a.r.changes) - dist(b.r.changes))[0];
  const optLabel = new Map(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o.label] as const)));
  const critLabel = new Map([...session.criteria, ...getLeafCriteria(session.criteria)].map(c => [c.id, c.label] as const));
  const changes: BackwardChange[] = Object.entries(pick.r.changes).map(([id, to]) => {
    const v = byVar.get(id)!;
    return { kind: v.kind, criterionId: v.criterionId, criterion: critLabel.get(v.criterionId) ?? v.criterionId, optionId: v.optionId, option: v.optionId ? optLabel.get(v.optionId) : undefined, from: v.base, to };
  });
  void vars;
  return { found: true, changes, winnerId: pick.w.id, winner: pick.w.label, before, complete: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, minSize: search.minSize };
}

/** Version naïve (recalcul complet du classement à chaque candidat) : référence des tests et du benchmark. */
export function backwardSmallestChangeNaive(input: AtelierSession, opts: { limit?: number } = {}): BackwardResult | null {
  const session = rankableSession(input);
  const base = rankOptions(session);
  if (base.length < 2) return null;
  const leader = base[0];
  const { vars, apply } = backwardSpace(session);
  const baseConfig = Object.fromEntries(vars.map(v => [v.id, v.base]));
  const winnerOf = (cfg: Record<string, string>) => {
    const r = rankOptions(apply(cfg));
    return r[0].id !== leader.id && (r.length < 2 || r[0].rank !== r[1].rank) ? r[0] : undefined;
  };
  const search = searchMinimalRepairs({
    levers: vars.map(v => ({ id: v.id, optionIds: v.values })),
    base: baseConfig,
    isValid: cfg => !!winnerOf(cfg),
    limit: opts.limit ?? EXHAUSTIVE_LIMIT,
  });
  if (!search.repairs.length) {
    return { found: false, changes: [], before: leader.label, complete: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, minSize: search.minSize };
  }
  // Parmi les changements minimaux, on préfère celui qui fait passer le deuxième en tête.
  const scored = search.repairs.map(r => ({ r, w: winnerOf(r.config)! }));
  const byVar = new Map(vars.map(v => [v.id, v]));
  // À nombre de changements égal : le deuxième d'abord, puis le plus petit écart de niveaux.
  const dist = (changes: Record<string, string>) => Object.entries(changes).reduce((d, [id, to]) => { const v = byVar.get(id)!; return d + Math.abs(v.values.indexOf(to) - v.values.indexOf(v.base)); }, 0);
  const pick = [...scored].sort((a, b) => Number(a.w.id !== base[1].id) - Number(b.w.id !== base[1].id) || dist(a.r.changes) - dist(b.r.changes))[0];
  const optLabel = new Map(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o.label] as const)));
  const critLabel = new Map([...session.criteria, ...getLeafCriteria(session.criteria)].map(c => [c.id, c.label] as const));
  const changes: BackwardChange[] = Object.entries(pick.r.changes).map(([id, to]) => {
    const v = byVar.get(id)!;
    return { kind: v.kind, criterionId: v.criterionId, criterion: critLabel.get(v.criterionId) ?? v.criterionId, optionId: v.optionId, option: v.optionId ? optLabel.get(v.optionId) : undefined, from: v.base, to };
  });
  return { found: true, changes, winnerId: pick.w.id, winner: pick.w.label, before: leader.label, complete: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize, minSize: search.minSize };
}

export function applyBackward(session: AtelierSession, changes: BackwardChange[]): Partial<AtelierSession> {
  let s = session;
  for (const c of changes) {
    if (c.kind === "importance") s = { ...s, criteria: s.criteria.map(x => x.id === c.criterionId ? { ...x, importance: c.to as ImportanceBadge, locked: true } : x) };
    else s = { ...s, ...setImpact(s, c.optionId!, c.criterionId, c.to as QualitativeImpact) };
  }
  return { criteria: s.criteria, leviersDef: s.leviersDef };
}

export function spaceText(n: number): string {
  return n < 1e9 ? n.toLocaleString("fr-FR") : `≈ 10^${Math.round(Math.log10(n))}`;
}

// « Si « B » passe de + à ++ sur « Coût », « B » devient premier. »
export function backwardSentence(b: BackwardResult): string {
  if (!b.found) return `Robuste : aucun changement de notes ni d'importances ne fait passer une autre option devant « ${b.before} » (${b.evaluated.toLocaleString("fr-FR")} évaluation${b.evaluated > 1 ? "s" : ""} du moteur sur un espace de ${spaceText(b.spaceSize)} configurations${b.complete ? ", exploration complète" : ", limite de recherche de 10⁶ évaluations atteinte"}).`;
  const parts = b.changes.map(c => c.kind === "importance"
    ? `l'importance de « ${c.criterion} » passe de ${IMPORTANCE_SHORT[c.from as ImportanceBadge]} à ${IMPORTANCE_SHORT[c.to as ImportanceBadge]}`
    : `« ${c.option} » passe de ${NOTE_LABEL[c.from as QualitativeImpact]} à ${NOTE_LABEL[c.to as QualitativeImpact]} sur « ${c.criterion} »`);
  return `Si ${parts.join(" et ")}, « ${b.winner} » devient premier à la place de « ${b.before} ».`;
}

// Profil par critère d'une option (pour les barres) : potentiel et risque.
export function criterionProfile(session: AtelierSession, scenarioId: string): { id: string; label: string; importance: ImportanceBadge; gPlus: OrdinalLevel; dMinus: OrdinalLevel }[] {
  const { cellResults } = computeLoResults(session);
  return session.criteria.map(c => ({ id: c.id, label: c.label, importance: c.importance, gPlus: cellResults[scenarioId]?.[c.id]?.gPlus ?? 0, dMinus: cellResults[scenarioId]?.[c.id]?.dMinus ?? 0 }));
}

// ── Options et critères : modèle à un seul levier ───────────────────────────
// Une option = un scénario qui retient cette option. C'est la forme produite
// depuis une alerte Supply, et celle qu'on édite en matrice.
export function isSingleLever(session: AtelierSession): boolean {
  const lev = session.leviersDef[0];
  return session.leviersDef.length === 1 && !!lev && session.scenarios.length === lev.options.length
    && session.scenarios.every(s => s.leviers.length === 1 && lev.options.some(o => o.id === s.leviers[0].valeur));
}

const PALETTE = ["#4743E6", "#151D52", "#8583EE", "#2B3380", "#6d5ef5", "#3b3f8f"];

export function scenariosFromLever(lev: AtelierLevierDef): AtelierScenario[] {
  return lev.options.map((o, i) => ({
    id: `sc-${o.id}`, label: o.label, color: PALETTE[i % PALETTE.length], description: "",
    leviers: [{ id: lev.id, label: lev.label, valeur: o.id, type: lev.type }],
    scores: {}, valeur: 50, faisabilite: 50,
  }));
}

export function setImpact(session: AtelierSession, optionId: string, criterionId: string, impact: QualitativeImpact): Partial<AtelierSession> {
  return {
    leviersDef: session.leviersDef.map(l => ({
      ...l,
      options: l.options.map(o => {
        if (o.id !== optionId) return o;
        const origins = { ...(o.impactOrigins ?? {}) };
        delete origins[criterionId]; // jugement humain : plus une hypothèse
        return { ...o, impacts: { ...o.impacts, [criterionId]: impact }, impactOrigins: origins };
      }),
    })),
  };
}

export const IMPACT_CYCLE: QualitativeImpact[] = ["0", "+L", "+", "++", "--", "-", "-L"];

// ── Pré-remplissage depuis une alerte Supply ────────────────────────────────
// Critères issus de l'alerte, options issues de la règle. Les impacts sont des
// hypothèses d'Aura (marquées « à confirmer ») tirées des mots de l'option :
// l'utilisateur les corrige d'un clic.

export interface ObservedOutcome { outcome: "amélioration" | "dégradation" | "stable" | "inconnu"; before?: number; now?: number; unit?: string; date: string; entity?: string; resolved?: boolean; critical?: boolean }

// Retire ce qui n'apporte rien à la situation, sans descendre sous les cibles
// (3 leviers, 5 indicateurs) : options déjà portées par le levier principal
// (celles de la règle causale de l'alerte), indicateur qui répète celui de
// l'alerte, coût d'achat unitaire quand l'alerte ne touche pas au sourcing.
const SOURCING_PROFILES = new Set(["appro", "geo", "detroit", "resilience", "marge", "pandemie", "strat-nearshoring"]);
const normLabel = (x: string) => x.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/^reduire : /, "").trim();
type Built = { criteria: AtelierCriterion[]; leviersDef: AtelierLevierDef[] };
export function pruneRedundant(m: Built, profileId?: string): void {
  const main = new Set((m.leviersDef[0]?.options ?? []).map(o => normLabel(o.label)));
  const others = m.leviersDef.slice(1);
  const pruned = others.map(l => ({ ...l, options: l.options.filter(o => !main.has(normLabel(o.label))) }));
  // Levier vidé par le filtre : retiré, sauf s'il faut le garder (intact) pour rester à 3 leviers.
  let spare = Math.max(0, 2 - pruned.filter(l => l.options.length >= 2).length);
  const kept = pruned.flatMap((l, i) => l.options.length >= 2 ? [l] : spare-- > 0 ? [others[i]] : []);
  m.leviersDef = [m.leviersDef[0], ...kept].filter(Boolean);
  const leaves = () => getLeafCriteria(m.criteria);
  const alertLeaf = leaves()[0];
  const alertKey = alertLeaf ? normLabel(alertLeaf.label) : "";
  const useless = (label: string) => { const k = normLabel(label); return (alertKey && k !== alertKey && (alertKey.includes(k) || k.includes(alertKey))) || (!SOURCING_PROFILES.has(profileId ?? "") && k === "cout d'achat unitaire"); };
  const seen = new Set<string>();
  for (const moe of m.criteria) for (const mop of moe.children ?? []) mop.children = (mop.children ?? []).filter(t => { const k = normLabel(t.label); if (seen.has(k) && (mop.children ?? []).length > 1) return false; seen.add(k); return true; });
  for (const moe of m.criteria) for (const mop of moe.children ?? []) {
    mop.children = (mop.children ?? []).filter(t => t === alertLeaf || !useless(t.label) || leaves().length <= 5 || (mop.children ?? []).length <= 1);
  }
}

export function seedFromAlert(opts: { id: string; kpiLabel?: string; alertLabel?: string; options: string[]; observed?: (option: string) => ObservedOutcome | undefined }): { criteria: AtelierCriterion[]; leviersDef: AtelierLevierDef[]; scenarios: AtelierScenario[]; risques: string[] } {
  // Gabarit Approvisionnement (MOE → MOP → TPM, leviers du métier) ; levier
  // principal = options de la règle de l'alerte ; l'indicateur de l'alerte
  // devient le premier TPM, Essentiel. Effets : hypothèses « à confirmer »,
  // sauf quand le journal des décisions a MESURÉ l'effet d'une option sur
  // l'indicateur de l'alerte : l'impact vient alors des données, avec sa source.
  // Profil propre au type d'alerte (fournisseur, stock, transport, prévision, données…).
  const base = TEMPLATES.find(t => t.id === "supply")!;
  const profile = supplyProfileFor(opts.id, `${opts.alertLabel ?? ""} ${opts.kpiLabel ?? ""}`);
  const tpl = profile ? specialize(base, profile) : base;
  const m = buildModel({ prefix: opts.id, template: tpl, mainOptions: opts.options, mainImpacts: optionHints, alertKpi: opts.kpiLabel ?? "risque de rupture" });
  pruneRedundant(m, profile?.id);
  const alertLeaf = getLeafCriteria(m.criteria)[0];
  if (opts.observed && alertLeaf) {
    const main = m.leviersDef[0];
    main.options = main.options.map(o => {
      const obs = opts.observed!(o.label);
      if (!obs || obs.outcome === "inconnu") return o;
      const level: QualitativeImpact = obs.outcome === "stable" ? "0" : obs.outcome === "amélioration" ? (obs.resolved ? "++" : "+") : (obs.critical ? "--" : "-");
      const fmt = (n?: number) => n === undefined ? "?" : n.toLocaleString("fr-FR");
      const reason = `Mesuré : décision du ${new Date(obs.date).toLocaleDateString("fr-FR")}${obs.entity ? ` sur ${obs.entity}` : ""}, indicateur passé de ${fmt(obs.before)} à ${fmt(obs.now)}${obs.unit ? ` ${obs.unit}` : ""} (source : journal des décisions Supply). Transposition sur l'échelle ordinale par seuils explicites : écart dans la zone stable → 0 ; amélioration → + (++ si l'alerte est levée) ; dégradation → − (−− si le seuil critique est franchi). Aucune moyenne pondérée.`;
      return { ...o, impacts: { ...o.impacts, [alertLeaf.id]: level }, impactOrigins: { ...(o.impactOrigins ?? {}), [alertLeaf.id]: "donnees" }, impactReasons: { ...(o.impactReasons ?? {}), [alertLeaf.id]: reason } };
    });
  }
  return { criteria: m.criteria, leviersDef: m.leviersDef, scenarios: m.scenarios, risques: tpl.risques ?? [] };
}

// ── Suivre : décision, résultats clés, revue ────────────────────────────────
export interface KeyResult {
  id: string; label: string; unit: string;
  start: number; target: number; current: number;
  deadline: string; owner: string;
  // Relié à un indicateur Supply : la valeur actuelle se relit toute seule.
  kpiId?: string; entityKey?: string;
}
export interface DecisionFollowUp {
  scenarioId: string; label: string; decidedAt: string;
  keyResults: KeyResult[];
  reviewDate: string;
  journalId?: string; // décision correspondante dans le journal Supply
}

export type KrStatus = "en avance" | "à l'heure" | "en retard";

export function krProgress(kr: KeyResult): number {
  const span = kr.target - kr.start;
  if (span === 0) return kr.current === kr.target ? 1 : 0;
  return Math.max(0, Math.min(1, (kr.current - kr.start) / span));
}

export function krStatus(kr: KeyResult, decidedAt: string, now = Date.now()): KrStatus {
  const t0 = new Date(decidedAt).getTime(), t1 = new Date(kr.deadline).getTime();
  const expected = t1 > t0 ? Math.max(0, Math.min(1, (now - t0) / (t1 - t0))) : 1;
  const p = krProgress(kr);
  if (p >= expected + 0.1) return "en avance";
  if (p >= expected - 0.1) return "à l'heure";
  return "en retard";
}

// Réviser la décision ? Revue échue sans effet suffisant, ou résultat qui se dégrade.
export function needsReview(f: DecisionFollowUp, now = Date.now()): string | null {
  const worse = f.keyResults.find(kr => (kr.target - kr.start) !== 0 && Math.sign(kr.current - kr.start) === -Math.sign(kr.target - kr.start));
  if (worse) return `« ${worse.label} » s'éloigne de sa cible (${worse.start} → ${worse.current}, cible ${worse.target}).`;
  if (new Date(f.reviewDate).getTime() <= now) {
    const late = f.keyResults.filter(kr => krStatus(kr, f.decidedAt, now) === "en retard");
    if (late.length) return `Revue échue et ${late.length} résultat(s) en retard.`;
  }
  return null;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10);
}
