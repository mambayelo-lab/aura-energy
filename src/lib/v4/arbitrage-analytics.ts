// arbitrage-analytics.ts — les quatre lectures qui closent un COMEX.
//
// 1. Dominance option × option    — « A domine B sur 4 critères sur 6, jamais dominée »
// 2. Robustesse ordinale          — jusqu'où déplacer l'ordre d'importance avant bascule
// 3. Carte des désaccords         — où les parties prenantes divergent, et sur quel critère
// 4. Fiche de décision 1 page     — l'objet signable
//
// Tout est ORDINAL. Aucune moyenne, aucune note, aucun score continu :
// les comparaisons se font par ordre lexicographique bipolaire (δ⁺ puis δ⁻),
// exactement comme le moteur d'agrégation de l'atelier.

import { aggregateNode, compareASC, thesisWeights } from "@/lib/engine/lo/aggregation";
import type { OrdinalLevel, OrdinalImpact } from "@/lib/engine/lo/types";

export interface ArbScenario { id: string; label: string; color?: string }
export interface ArbCriterion { id: string; label: string; weight: OrdinalLevel }
/** scénarioId → critèreId → impact agrégé du sous-arbre */
export type ArbCells = Record<string, Record<string, OrdinalImpact>>;

export type LoResult = { gPlus: OrdinalLevel; dMinus: OrdinalLevel };

/* ── Socle ordinal ──────────────────────────────────────────────────────── */

/** > 0 si a est plus prometteur que b (δ⁺ décroissant, puis δ⁻ croissant). */
export function bipolarCompare(a: LoResult, b: LoResult): number {
  return compareASC(a, b);
}

/** Poids de l'équation (9) tels quels (thèse Lô p. 82) ; aucun poids exprimé → éq. (7). */
function normalizeWeights(ws: OrdinalLevel[]): OrdinalLevel[] {
  if (!ws.length) return [3];
  return thesisWeights(ws);
}

/** Agrège un scénario sous un jeu de poids donné. */
export function aggregateUnder(
  criteria: ArbCriterion[],
  cells: ArbCells,
  scenarioId: string,
  weights?: Record<string, OrdinalLevel>,
): LoResult {
  const impacts: OrdinalImpact[] = criteria.map(
    c => cells[scenarioId]?.[c.id] ?? { gPlus: 0, dMinus: 0 },
  );
  const ws = normalizeWeights(criteria.map(c => weights?.[c.id] ?? c.weight));
  try {
    return aggregateNode(impacts.length ? impacts : [{ gPlus: 0, dMinus: 0 }], ws) as LoResult;
  } catch {
    return { gPlus: 0, dMinus: 0 };
  }
}

/** Classement complet sous un jeu de poids. Le premier élément est le vainqueur. */
export function rankUnder(
  scenarios: ArbScenario[],
  criteria: ArbCriterion[],
  cells: ArbCells,
  weights?: Record<string, OrdinalLevel>,
): { sc: ArbScenario; result: LoResult }[] {
  return scenarios
    .map(sc => ({ sc, result: aggregateUnder(criteria, cells, sc.id, weights) }))
    .sort((a, b) => bipolarCompare(b.result, a.result));
}

/* ── 1. Matrice de dominance ────────────────────────────────────────────── */

export interface DominancePair {
  aId: string; bId: string;
  winsA: number;      // critères où A est strictement meilleur
  winsB: number;
  ties: number;
  total: number;
  /** A domine B : jamais moins bon, et strictement meilleur au moins une fois. */
  dominates: boolean;
  /** Critères qui portent la dominance (ou l'écart) — libellés, les plus importants d'abord. */
  drivers: string[];
  /** Critères sur lesquels A cède du terrain — c'est la concession à assumer. */
  concessions: string[];
}

export interface DominanceReport {
  pairs: DominancePair[];
  /** scénarioId → ce qu'il domine / ce qui le domine */
  byScenario: Record<string, { dominates: string[]; dominatedBy: string[] }>;
  /** Non dominés : le front de Pareto ordinal. */
  nonDominated: string[];
  /** Un seul non dominé et il domine tout le reste → argument imparable. */
  undisputed?: string;
  /** Phrase prête pour un COMEX. */
  headline: string;
}

export function dominanceReport(
  scenarios: ArbScenario[],
  criteria: ArbCriterion[],
  cells: ArbCells,
): DominanceReport {
  const impRank = (c: ArbCriterion) => -c.weight;
  const sorted = [...criteria].sort((x, y) => impRank(x) - impRank(y));
  const pairs: DominancePair[] = [];
  const byScenario: Record<string, { dominates: string[]; dominatedBy: string[] }> = {};
  scenarios.forEach(s => { byScenario[s.id] = { dominates: [], dominatedBy: [] }; });

  for (const a of scenarios) {
    for (const b of scenarios) {
      if (a.id === b.id) continue;
      let winsA = 0, winsB = 0, ties = 0;
      const drivers: string[] = [];
      const concessions: string[] = [];
      for (const c of sorted) {
        const ca = cells[a.id]?.[c.id] ?? { gPlus: 0, dMinus: 0 };
        const cb = cells[b.id]?.[c.id] ?? { gPlus: 0, dMinus: 0 };
        const cmp = bipolarCompare(ca as LoResult, cb as LoResult);
        if (cmp > 0) { winsA++; if (drivers.length < 4) drivers.push(c.label); }
        else if (cmp < 0) { winsB++; if (concessions.length < 4) concessions.push(c.label); }
        else ties++;
      }
      const dominates = winsB === 0 && winsA > 0;
      if (dominates) {
        byScenario[a.id].dominates.push(b.id);
        byScenario[b.id].dominatedBy.push(a.id);
      }
      pairs.push({ aId: a.id, bId: b.id, winsA, winsB, ties, total: sorted.length, dominates, drivers, concessions });
    }
  }

  const nonDominated = scenarios.filter(s => byScenario[s.id].dominatedBy.length === 0).map(s => s.id);
  const undisputed = nonDominated.length === 1
    && byScenario[nonDominated[0]].dominates.length === scenarios.length - 1
    ? nonDominated[0] : undefined;

  const label = (id: string) => scenarios.find(s => s.id === id)?.label ?? id;
  let headline: string;
  if (undisputed) {
    headline = `${label(undisputed)} domine toutes les autres options et n'est dominée par aucune — la décision ne se discute pas sur le modèle.`;
  } else if (nonDominated.length === 0) {
    headline = "Aucune option non dominée : le modèle est incohérent, à réexaminer.";
  } else if (nonDominated.length === scenarios.length) {
    headline = `Aucune dominance : les ${scenarios.length} options s'échangent des avantages critère par critère — l'arbitrage est politique, pas technique.`;
  } else {
    headline = `${nonDominated.length} options restent en lice (${nonDominated.map(label).join(", ")}) ; les autres sont dominées et peuvent être écartées.`;
  }
  return { pairs, byScenario, nonDominated, undisputed, headline };
}

/* ── 2. Robustesse ordinale ─────────────────────────────────────────────── */

export interface RobustFlip {
  critId: string; critLabel: string;
  from: OrdinalLevel; to: OrdinalLevel;
  steps: number;             // nombre de crans d'importance déplacés
  newWinnerId: string; newWinnerLabel: string;
}

export interface RobustnessReport {
  winnerId?: string;
  winnerLabel?: string;
  /** Toutes les bascules atteintes en déplaçant l'importance d'UN seul critère. */
  flips: RobustFlip[];
  /** Plus petit nombre de crans qui suffit à changer le vainqueur (∞ = aucun). */
  marginSteps: number;
  /** Critères dont l'importance peut varier de 0 à H sans changer le vainqueur. */
  immune: string[];
  level: "verrouillée" | "solide" | "fragile" | "indéterminée";
  headline: string;
}

export function robustnessReport(
  scenarios: ArbScenario[],
  criteria: ArbCriterion[],
  cells: ArbCells,
): RobustnessReport {
  const base = rankUnder(scenarios, criteria, cells);
  const winner = base[0]?.sc;
  if (!winner || scenarios.length < 2 || criteria.length === 0) {
    return { flips: [], marginSteps: Infinity, immune: [], level: "indéterminée",
      headline: "Il faut au moins deux options et un critère pour tester la robustesse." };
  }
  const flips: RobustFlip[] = [];
  const immune: string[] = [];
  for (const c of criteria) {
    let flipped = false;
    for (const lvl of [0, 1, 2, 3] as OrdinalLevel[]) {
      if (lvl === c.weight) continue;
      const r = rankUnder(scenarios, criteria, cells, { [c.id]: lvl });
      const w = r[0]?.sc;
      if (w && w.id !== winner.id) {
        flipped = true;
        flips.push({ critId: c.id, critLabel: c.label, from: c.weight, to: lvl,
          steps: Math.abs(lvl - c.weight), newWinnerId: w.id, newWinnerLabel: w.label });
      }
    }
    if (!flipped) immune.push(c.label);
  }
  // On ne garde, par critère, que la bascule la moins coûteuse.
  const bestPerCrit = new Map<string, RobustFlip>();
  for (const f of flips) {
    const prev = bestPerCrit.get(f.critId);
    if (!prev || f.steps < prev.steps) bestPerCrit.set(f.critId, f);
  }
  const kept = [...bestPerCrit.values()].sort((a, b) => a.steps - b.steps);
  const marginSteps = kept.length ? kept[0].steps : Infinity;
  const level: RobustnessReport["level"] =
    marginSteps === Infinity ? "verrouillée" : marginSteps >= 2 ? "solide" : "fragile";
  const headline =
    level === "verrouillée"
      ? `${winner.label} reste devant quelle que soit l'importance donnée à chacun des ${criteria.length} critères.`
      : level === "solide"
        ? `${winner.label} tient : il faut déplacer l'importance de « ${kept[0].critLabel} » de ${marginSteps} crans pour que ${kept[0].newWinnerLabel} passe devant.`
        : `Recommandation fragile : un seul cran d'importance sur « ${kept[0].critLabel} » suffit à faire passer ${kept[0].newWinnerLabel} devant.`;
  return { winnerId: winner.id, winnerLabel: winner.label, flips: kept, marginSteps, immune, level, headline };
}

/* ── 3. Carte des désaccords entre parties prenantes ────────────────────── */

export interface StakeholderProfile {
  id: string; label: string;
  /** Ce que cette partie prenante met en tête — les autres critères descendent d'un cran. */
  emphasis: string[];
  /**
   * NOUVEAU — entrée nominale : l'ordre d'importance déclaré par la partie
   * prenante elle-même, du plus important au moins important. Quand il est
   * présent, il prime sur `emphasis` : on n'infère plus, on lit ce qui a été dit.
   * Reste strictement ordinal : le rang est converti en niveau d'importance
   * (3 → 1), aucune pondération numérique n'est introduite (axiome BORA A3).
   */
  order?: string[];
  /** Fonction déclarée (« Directeur supply », « RSE »…), pour la lecture en séance. */
  role?: string;
}

export interface StakeholderView {
  profile: StakeholderProfile;
  winnerId: string; winnerLabel: string;
  ranking: { id: string; label: string }[];
}

export interface DisagreementReport {
  views: StakeholderView[];
  consensusId?: string;
  /** Couples de parties prenantes qui ne veulent pas la même chose. */
  conflicts: { aLabel: string; bLabel: string; aWants: string; bWants: string; critLabel: string }[];
  headline: string;
}

/** Profils par défaut : un profil par critère de tête — utile sans saisie préalable. */
export function defaultProfiles(criteria: ArbCriterion[]): StakeholderProfile[] {
  return [...criteria]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 4)
    .map(c => ({ id: `p-${c.id}`, label: `Porteur de « ${c.label} »`, emphasis: [c.id] }));
}

/**
 * Rang déclaré → niveau d'importance ordinal. Les premiers critères cités sont
 * « fort », les derniers « faible » ; jamais nul, pour qu'aucune voix ne soit
 * amputée d'un critère qu'elle a pris la peine de citer.
 */
function weightsFromOrder(order: string[], criteria: ArbCriterion[]): Record<string, OrdinalLevel> {
  const w: Record<string, OrdinalLevel> = {};
  const n = Math.max(1, order.length);
  order.forEach((cid, i) => {
    w[cid] = Math.max(1, 3 - Math.floor((i * 3) / n)) as OrdinalLevel;
  });
  // Critère non cité par cette partie prenante : importance minimale, jamais zéro.
  for (const c of criteria) if (w[c.id] === undefined) w[c.id] = 1;
  return w;
}

export function disagreementReport(
  scenarios: ArbScenario[],
  criteria: ArbCriterion[],
  cells: ArbCells,
  profiles: StakeholderProfile[],
): DisagreementReport {
  const views: StakeholderView[] = profiles.map(p => {
    let weights: Record<string, OrdinalLevel> = {};
    if (p.order && p.order.length) {
      weights = weightsFromOrder(p.order, criteria);
    } else {
      for (const c of criteria) {
        weights[c.id] = p.emphasis.includes(c.id)
          ? 3
          : (Math.max(0, c.weight - 1) as OrdinalLevel);
      }
    }
    const r = rankUnder(scenarios, criteria, cells, weights);
    return {
      profile: p,
      winnerId: r[0]?.sc.id ?? "",
      winnerLabel: r[0]?.sc.label ?? "—",
      ranking: r.map(x => ({ id: x.sc.id, label: x.sc.label })),
    };
  });

  const conflicts: DisagreementReport["conflicts"] = [];
  for (let i = 0; i < views.length; i++) {
    for (let j = i + 1; j < views.length; j++) {
      const a = views[i], b = views[j];
      if (!a.winnerId || !b.winnerId || a.winnerId === b.winnerId) continue;
      // Le critère qui explique la divergence : celui où les deux vainqueurs s'opposent
      // le plus nettement, parmi ceux mis en avant par l'un des deux profils.
      // Quand la partie prenante a classé ses critères elle-même, ce sont ses deux
      // premiers rangs qui portent son point de vue — pas une emphase déduite.
      const top = (p: StakeholderProfile) => (p.order && p.order.length ? p.order.slice(0, 2) : p.emphasis);
      const emph = [...new Set([...top(a.profile), ...top(b.profile)])];
      let critLabel = "—", bestGap = -1;
      for (const cid of emph) {
        const c = criteria.find(x => x.id === cid); if (!c) continue;
        const ca = cells[a.winnerId]?.[cid] ?? { gPlus: 0, dMinus: 0 };
        const cb = cells[b.winnerId]?.[cid] ?? { gPlus: 0, dMinus: 0 };
        const gap = Math.abs(ca.gPlus - cb.gPlus) + Math.abs(ca.dMinus - cb.dMinus);
        if (gap > bestGap) { bestGap = gap; critLabel = c.label; }
      }
      conflicts.push({ aLabel: a.profile.label, bLabel: b.profile.label,
        aWants: a.winnerLabel, bWants: b.winnerLabel, critLabel });
    }
  }

  const winners = new Set(views.map(v => v.winnerId).filter(Boolean));
  const consensusId = winners.size === 1 ? [...winners][0] : undefined;
  const headline = consensusId
    ? `Consensus : toutes les parties prenantes modélisées arrivent à ${views[0]?.winnerLabel}.`
    : conflicts.length
      ? `Désaccord sur ${winners.size} options — le point de friction est « ${conflicts[0].critLabel} ».`
      : "Pas assez de profils pour cartographier les désaccords.";
  return { views, consensusId, conflicts, headline };
}

/* ── 4. Fiche de décision 1 page ────────────────────────────────────────── */

export interface DecisionSheet {
  title: string;
  date: string;
  retenu: string;
  criteresDecisifs: { label: string; why: string }[];
  concessions: string[];
  reserves: string[];
  dominance: string;
  robustesse: string;
  desaccords: string;
  participants: string[];
  completude?: string;
}

export function buildDecisionSheet(input: {
  title: string;
  retenuLabel: string;
  criteria: ArbCriterion[];
  cells: ArbCells;
  retenuId: string;
  dominance: DominanceReport;
  robustness: RobustnessReport;
  disagreement?: DisagreementReport;
  rationale?: string;
  reserves?: string[];
  participants?: string[];
  completude?: string;
}): DecisionSheet {
  const { criteria, cells, retenuId } = input;
  const decisifs = [...criteria]
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
    .map(c => {
      const v = cells[retenuId]?.[c.id] ?? { gPlus: 0, dMinus: 0 };
      const why = v.gPlus >= 2
        ? "l'option retenue y apporte un gain net"
        : v.dMinus >= 2 ? "l'option retenue y expose à un risque assumé" : "effet limité, critère non discriminant";
      return { label: c.label, why };
    });
  const concessions = input.dominance.pairs
    .filter(p => p.aId === retenuId)
    .flatMap(p => p.concessions)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .slice(0, 4);
  return {
    title: input.title,
    date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }),
    retenu: input.retenuLabel,
    criteresDecisifs: decisifs,
    concessions,
    reserves: input.reserves ?? (input.rationale ? [input.rationale] : []),
    dominance: input.dominance.headline,
    robustesse: input.robustness.headline,
    desaccords: input.disagreement?.headline ?? "Non instruit.",
    participants: input.participants ?? [],
    completude: input.completude,
  };
}
