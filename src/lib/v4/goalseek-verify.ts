/**
 * Couche additive au-dessus de goalSeek() — n'édite ni ne dédouble le moteur
 * protégé (src/lib/engine/goalseek/index.ts, src/lib/engine/lo/*). Ce fichier
 * ne fait que CONSOMMER des valeurs déjà calculées (perCrit par combinaison,
 * déjà agrégées par aggregateNode pondéré) pour combler 3 manques identifiés
 * par l'audit backward :
 *
 *  1. Vérification Forward globale obligatoire — une combinaison acceptée
 *     dans « reaching » (goalSeek) ne doit jamais dégrader un objectif
 *     Essentiel (veto), même non ciblé par l'utilisateur.
 *  2. Goulot précis (argmin/argmax) — quelle branche exacte, à l'intérieur
 *     d'un objectif, est l'argument actif du min/max de l'Eq.5/Eq.9 —
 *     par opposition au comptage de fréquence inter-cibles de goalSeek().
 *  3. Réparations conjointes minimales — recherche EXHAUSTIVE sur tous les
 *     leviers et toutes leurs options, vérifiées par (1), réduites à quelques
 *     stratégies distinctes pour la vue Executive.
 *
 * Aucune donnée n'est jamais fabriquée : toute valeur manipulée ici provient
 * d'un appel (éventuellement répété, en lecture seule) à aggregateHierarchy/
 * aggregateNode — jamais d'un score inventé.
 */
import type { OrdinalLevel, Attitude } from "../engine/lo/types";
import { aggregateHierarchy, importanceToWeight } from "./atelier-compute";
import { thesisWeights } from "../engine/lo/aggregation";
import { searchMinimalRepairs } from "./exhaustive-search";
import type {
  AtelierCriterion, AtelierScenario, AtelierOptionDef, AtelierLevierDef, ImportanceBadge,
} from "./atelier-store";

export interface OrdPair { gPlus: OrdinalLevel; dMinus: OrdinalLevel }
export interface VerifiableCombo {
  key: string;
  combo: Record<string, string>;
  perCrit: Record<string, OrdPair>;
  global: OrdPair;
}
export interface ObjectiveRef { id: string; label: string; importance: ImportanceBadge }

// ── 1. Vérification Forward globale obligatoire ──────────────────────────────

/** Un objectif "Essentiel" (vocabulaire déjà utilisé dans l'appli — veto) dont
 *  δ⁻ > 0 après application d'une combinaison est un veto : personne ne devrait
 *  voir cette combinaison présentée comme "atteignant l'objectif", même si elle
 *  satisfait les seules cibles explicitement choisies par l'utilisateur. */
export function globalVetoBreaches(
  perCrit: Record<string, OrdPair | undefined>,
  objectives: ObjectiveRef[],
): ObjectiveRef[] {
  return objectives.filter(o => o.importance === "Essentiel" && (perCrit[o.id]?.dMinus ?? 0) > 0);
}

/**
 * Filtre "reaching" (ou tout tableau de combinaisons déjà admissibles au sens
 * des cibles actives) contre TOUS les objectifs suivis par le modèle — pas
 * seulement ceux que l'utilisateur a choisi de cibler. Ne recalcule rien :
 * consomme perCrit déjà présent sur chaque ComboEval.
 */
export function filterGloballyVerified<T extends VerifiableCombo>(
  combos: T[],
  allObjectives: ObjectiveRef[],
): T[] {
  return combos.filter(c => globalVetoBreaches(c.perCrit, allObjectives).length === 0);
}

// ── 2. Goulot précis (argmin/argmax exact de l'Eq.5/Eq.9) ───────────────────

export interface BlockingStep {
  id: string;
  label: string;
  /** "risque" si c'est le δ⁻ (max min(ωᵢ,Dᵢ)) qui domine ce nœud, "gain" si
   *  c'est le δ⁺ (min max(¬ωᵢ,Gᵢ)) qui plafonne. */
  role: "gain" | "risque";
  value: OrdinalLevel;
}
export interface BlockingTrace {
  /** Chemin depuis l'objectif jusqu'à la feuille — chaque étape est l'enfant
   *  dont la valeur pondérée est EXACTEMENT celle retenue par le parent
   *  (argument actif du min ou du max, au sens strict). */
  path: BlockingStep[];
  leafId: string;
  leafLabel: string;
}

function normalizedWeights(nodes: AtelierCriterion[]): OrdinalLevel[] {
  return thesisWeights(nodes.map(c => importanceToWeight(c.importance)));
}

/**
 * Descend dans l'arbre depuis `node` en choisissant, à chaque étage, l'enfant
 * qui est réellement l'argument actif du min (gain) ou du max (risque) de
 * l'agrégation pondérée — pas une lecture de poids seule (contrairement à
 * `explainBackwardChildren`, qui ne regarde que ¬ωᵢ vs seuil). S'arrête sur
 * une feuille (TPM/critère sans enfants) : c'est le goulot précis.
 */
export function traceBlockingBranch(
  node: AtelierCriterion,
  sc: AtelierScenario,
  optionIndex: Record<string, AtelierOptionDef>,
  attitudeCode: Attitude,
  profile: "prudent" | "optimiste",
): BlockingTrace {
  const path: BlockingStep[] = [];
  let cur = node;
  while (cur.children?.length) {
    const children = cur.children;
    const childResults = children.map(ch => aggregateHierarchy(ch, sc, optionIndex, attitudeCode, profile));
    const normW = normalizedWeights(children);
    const parent = aggregateHierarchy(cur, sc, optionIndex, attitudeCode, profile);

    let idx = -1;
    let role: "gain" | "risque" = "gain";
    if (parent.dMinus > 0) {
      // D(a) = max_i min(ωi, Di) — l'enfant retenu est celui dont min(ωi,Di) == D(a)
      role = "risque";
      idx = childResults.findIndex((r, i) => Math.min(normW[i], r.dMinus) === parent.dMinus);
    } else {
      // G(a) = min_i max(¬ωi, Gi) — l'enfant retenu est celui dont max(¬ωi,Gi) == G(a)
      idx = childResults.findIndex((r, i) => Math.max(3 - normW[i], r.gPlus) === parent.gPlus);
    }
    if (idx < 0) idx = 0;
    const child = children[idx];
    const cr = childResults[idx];
    path.push({ id: child.id, label: child.label, role, value: role === "risque" ? cr.dMinus : cr.gPlus });
    cur = child;
  }
  return { path, leafId: cur.id, leafLabel: cur.label };
}

// ── Leviers responsables d'une feuille ───────────────────────────────────────

export interface LeverCulprit {
  leverId: string;
  leverLabel: string;
  currentOptionId: string;
  currentOptionLabel: string;
  /** Options alternatives du même levier qui, sur cette feuille précise,
   *  améliorent le gain ou réduisent le risque par rapport à l'option actuelle. */
  betterOptions: { optionId: string; optionLabel: string }[];
}

const QI_GAIN: Record<string, number> = { "++": 3, "+": 1, "0": 0, "-": 0, "--": 0, U: 0 };
const QI_RISK: Record<string, number> = { "++": 0, "+": 0, "0": 0, "-": 1, "--": 3, U: 0 };

/** Pour une feuille (goulot précis), quels leviers l'affectent et quelles
 *  options du même levier feraient mieux que l'option actuellement choisie —
 *  lu directement dans `leviersDef[*].options[*].impacts`, jamais inventé. */
export function culpritLevers(
  leafId: string,
  leviersDef: AtelierLevierDef[],
  currentCombo: Record<string, string>, // leverId → optionId
): LeverCulprit[] {
  const out: LeverCulprit[] = [];
  for (const lev of leviersDef) {
    const currentOptId = currentCombo[lev.id];
    const currentOpt = lev.options.find(o => o.id === currentOptId);
    const impactsThisLeaf = lev.options.some(o => leafId in o.impacts);
    if (!impactsThisLeaf) continue;
    const currentImpact = currentOpt?.impacts[leafId] ?? "0";
    const currentScore = QI_GAIN[currentImpact] - QI_RISK[currentImpact];
    const better = lev.options
      .filter(o => o.id !== currentOptId)
      .filter(o => {
        const imp = o.impacts[leafId] ?? "0";
        return (QI_GAIN[imp] - QI_RISK[imp]) > currentScore;
      })
      .map(o => ({ optionId: o.id, optionLabel: o.label }));
    if (better.length === 0) continue;
    out.push({
      leverId: lev.id,
      leverLabel: lev.label,
      currentOptionId: currentOptId ?? "",
      currentOptionLabel: currentOpt?.label ?? "",
      betterOptions: better,
    });
  }
  return out;
}

// ── 3. Réparations conjointes minimales (recherche EXHAUSTIVE) ──────────────

export interface MinimalRepair {
  /** Changements de levier proposés par rapport au combo de référence. */
  changes: { leverId: string; leverLabel: string; fromOptionLabel: string; toOptionId: string; toOptionLabel: string }[];
  combo: Record<string, string>;
  key: string;
}

export interface MinimalRepairReport {
  repairs: MinimalRepair[];
  /** true : résultat prouvé exact (tout l'espace nécessaire a été parcouru). */
  complete: boolean;
  evaluated: number;
  spaceSize: number;
}

/**
 * Réparations conjointes minimales — recherche EXHAUSTIVE (extension d'Aura,
 * jugée par le forward de la thèse Lô) : TOUS les leviers de `leviersDef` et TOUTES leurs options
 * sont candidats, par nombre de leviers changés croissant ; on renvoie toutes
 * les combinaisons de taille minimale qui atteignent les cibles actives ET ne
 * violent aucun objectif Essentiel (vérification Forward globale).
 *
 * `candidateLeverIds` et `maxChange` sont conservés pour compatibilité mais
 * ne restreignent plus la recherche (ils la rendaient incomplète). Limite :
 * EXHAUSTIVE_LIMIT = 10⁶ évaluations ; au-delà `complete = false`.
 */
export function findMinimalRepairsReport(params: {
  baseCombo: Record<string, string>;
  candidateLeverIds?: string[];
  leviersDef: AtelierLevierDef[];
  evaluate: (combo: Record<string, string>) => { perCrit: Record<string, OrdPair>; global: OrdPair };
  activeTargets: { critId: string; min: OrdinalLevel }[];
  tolerateRisk: OrdinalLevel;
  allObjectives: ObjectiveRef[];
  maxChange?: number;
  limit?: number;
}): MinimalRepairReport {
  const { baseCombo, leviersDef, evaluate, activeTargets, tolerateRisk, allObjectives } = params;
  const meets = (perCrit: Record<string, OrdPair>): boolean =>
    activeTargets.every(t => (perCrit[t.critId]?.gPlus ?? 0) >= t.min && (perCrit[t.critId]?.dMinus ?? 0) <= tolerateRisk);
  const isValid = (combo: Record<string, string>) => {
    const ev = evaluate(combo);
    return meets(ev.perCrit) && globalVetoBreaches(ev.perCrit, allObjectives).length === 0;
  };
  const search = searchMinimalRepairs({
    levers: leviersDef.map(l => ({ id: l.id, optionIds: l.options.map(o => o.id) })),
    base: baseCombo,
    isValid,
    limit: params.limit,
  });
  const byId = new Map(leviersDef.map(l => [l.id, l]));
  const repairs: MinimalRepair[] = search.repairs.map(r => {
    const ids = leviersDef.map(l => l.id).filter(id => id in r.changes);
    return {
      changes: ids.map(id => {
        const lev = byId.get(id)!;
        const to = lev.options.find(o => o.id === r.changes[id]);
        return {
          leverId: id,
          leverLabel: lev.label,
          fromOptionLabel: lev.options.find(o => o.id === baseCombo[id])?.label ?? "",
          toOptionId: r.changes[id],
          toOptionLabel: to?.label ?? r.changes[id],
        };
      }),
      combo: r.config,
      key: ids.join("+") + "|" + ids.map(id => r.changes[id]).join("+"),
    };
  });
  return { repairs, complete: search.complete, evaluated: search.evaluated, spaceSize: search.spaceSize };
}

/** Variante qui ne renvoie que la liste (compatibilité des appelants existants). */
export function findMinimalRepairs(params: Parameters<typeof findMinimalRepairsReport>[0]): MinimalRepair[] {
  return findMinimalRepairsReport(params).repairs;
}

// ── 4. Réduction à 3-5 chemins exécutifs distincts ──────────────────────────

export interface ExecutivePath {
  /** Set de lever-ids changés — clé de déduplication. */
  leverSet: string;
  repair: MinimalRepair;
}

/**
 * Déduplique par le SET de leviers changés (pas le libellé) et garde les N
 * meilleurs représentants (un par set distinct), dans l'ordre déjà fourni
 * (typiquement trié par potentiel/risque en amont — ce module ne réordonne
 * pas, il ne fait que réduire).
 */
export function distinctExecutivePaths(repairs: MinimalRepair[], max = 5): MinimalRepair[] {
  const seen = new Set<string>();
  const out: MinimalRepair[] = [];
  for (const r of repairs) {
    const setKey = r.changes.map(c => c.leverId).sort().join(",");
    if (seen.has(setKey)) continue;
    seen.add(setKey);
    out.push(r);
    if (out.length >= max) break;
  }
  return out;
}
