/**
 * BORA kernel — Backward / Forward / minimal repairs.
 *
 * Backward — extension d'Aura, évaluée par les équations (1)-(9) de la thèse de M. Lô (2013) :
 *
 *   R0 = FORWARD(x)
 *   si cible(R0) et admissible : retourner x
 *   pour k = 1, 2, 3, … (nombre de leviers changés) :
 *     tester TOUTES les configurations à k changements (tous leviers, toutes options)
 *     garder celles dont FORWARD satisfait la cible et les veto
 *     si au moins une est valide : STOP et les retourner toutes (taille minimale)
 *
 * Règles tenues tout du long de ce fichier :
 *   1. Forward reste seul juge — chaque candidat est revalidé par forward().
 *   2. Une branche déjà OK n'est jamais « réparée » inutilement — garanti par
 *      la minimalité (un changement superflu augmenterait la taille).
 *   3. Une réparation ne doit pas créer un veto ailleurs — jugé sur le
 *      forward() GLOBAL.
 *   4. Minimal = taille minimale, donc aucun sous-ensemble strict ne suffit.
 *
 * Le calcul ordinal lui-même (min/max bipolaire, Eq.1-9 thèse Lo) n'est
 * JAMAIS réimplémenté ici : ce fichier importe et appelle aggregateCriterion/
 * aggregateNode depuis le moteur protégé (../engine/lo/*), en lecture seule.
 */
import type { OrdinalLevel, Attitude, RawCell, OrdinalImpact } from "../engine/lo/types";
import { aggregateCriterion, aggregateNode, thesisWeights, type ElementaryImpact } from "../engine/lo/aggregation";
import type {
  AtelierSession, AtelierCriterion, AtelierLevierDef, AtelierScenario, ImportanceBadge,
} from "./atelier-store";
import { qualImpactToElementary, importanceToWeight } from "./atelier-compute";
import { searchMinimalRepairs } from "./exhaustive-search";

// ── 1. Typed decision model ──────────────────────────────────────────────────

export type ConstraintKind = "preference" | "hard" | "veto" | "prerequisite" | "unknown";

/**
 * A constraint the model must satisfy. `veto`/`hard` gate admissibility in
 * forward() (rule 3 relies on this: any candidate that breaks one of these,
 * anywhere in the tree, is rejected — not just on the blocked branch).
 * `prerequisite` is a target-side minimum (used by backward()'s cible T).
 * `preference` never gates anything — it only feeds rankRepairs() ordering.
 */
export interface DecisionConstraint {
  id: string;
  kind: ConstraintKind;
  label: string;
  /** Criterion (leaf or node id in the model tree) this constraint applies to. */
  critId: string;
  /** For hard/veto: max tolerated δ⁻ before the constraint is considered broken. Default 0. */
  maxRisk?: OrdinalLevel;
  /** For prerequisite: min δ⁺ required. */
  min?: OrdinalLevel;
}

/** One option of a kernel lever — a leaf-level ordinal impact per criterion it touches. */
export interface KernelOption {
  id: string;
  label: string;
  /** critId → raw bipolar impact ("U" = expert n'a pas renseigné, jamais fabriqué). */
  impacts: Record<string, { gPlus: RawCell; dMinus: RawCell }>;
  /** Optional real-world tie-break data — populated ONLY when the source data
   *  actually carries it (see adapters below); absent = that rankRepairs()
   *  tier is skipped, never fabricated. */
  cost?: number;
  delayDays?: number;
  disruption?: OrdinalLevel;
}

export interface KernelLever {
  id: string;
  label: string;
  options: KernelOption[];
}

/** A node in the MOE/MOP/TPM tree. Leaf = no children = where lever impacts attach. */
export interface KernelCriterion {
  id: string;
  label: string;
  weight: OrdinalLevel; // ωᵢ — importance among siblings
  children?: KernelCriterion[];
}

export interface DecisionModel {
  /** Top-level MOE nodes (forest — usually one root, but several is fine). */
  criteria: KernelCriterion[];
  levers: KernelLever[];
  /** Global hard/veto constraints — always checked by forward(), everywhere. */
  constraints: DecisionConstraint[];
  attitude: Attitude;
}

/** leverId → optionId */
export type Configuration = Record<string, string>;

// ── helpers: poids ω_i de l'équation (9), tels quels (thèse Lô p. 82) ───────

function normalizeWeights(children: KernelCriterion[]): OrdinalLevel[] {
  return thesisWeights(children.map(c => c.weight));
}

function leafIds(node: KernelCriterion): string[] {
  if (!node.children?.length) return [node.id];
  return node.children.flatMap(leafIds);
}

function allLeaves(model: DecisionModel): string[] {
  return model.criteria.flatMap(leafIds);
}

// ── 2. FORWARD — the sole judge ──────────────────────────────────────────────

export interface ForwardResult {
  /** critId (any node, leaf or internal) → propagated ordinal impact. */
  impacts: Record<string, OrdinalImpact>;
  /** true iff no hard/veto constraint is broken anywhere in the tree. */
  admissible: boolean;
  violated: DecisionConstraint[];
  /** Leaf ids where every contributing lever's cell was "U" — Aura says
   *  "je ne peux pas conclure" rather than fabricating a value (rule 6). */
  unknown: string[];
}

/** Builds the ElementaryImpact[] feeding one leaf from the active configuration. */
function leafElementaryImpacts(
  leafId: string, config: Configuration, levers: KernelLever[],
): ElementaryImpact[] {
  const out: ElementaryImpact[] = [];
  levers.forEach((lev, leverIndex) => {
    const optId = config[lev.id];
    const opt = lev.options.find(o => o.id === optId);
    const cell = opt?.impacts[leafId];
    if (!cell) return; // this lever declares no impact on this leaf — not "unknown", simply absent
    out.push({ leverIndex, gPlus: cell.gPlus, dMinus: cell.dMinus });
  });
  return out;
}

function isFullyUnknown(impacts: ElementaryImpact[]): boolean {
  return impacts.length > 0 && impacts.every(i => i.gPlus === "U" && i.dMinus === "U");
}

/**
 * Propagates a configuration bottom-up through the MOE/MOP/TPM tree using the
 * protected aggregation math (aggregateCriterion at the leaf, aggregateNode
 * up each internal node), then checks every hard/veto constraint globally.
 * Forward is the ONLY function in this file allowed to certify admissibility.
 */
export function forward(config: Configuration, model: DecisionModel): ForwardResult {
  const impacts: Record<string, OrdinalImpact> = {};
  const unknown: string[] = [];

  function evalNode(node: KernelCriterion): OrdinalImpact {
    if (!node.children?.length) {
      const elems = leafElementaryImpacts(node.id, config, model.levers);
      if (isFullyUnknown(elems)) unknown.push(node.id);
      const tri = aggregateCriterion(elems, model.attitude);
      const result = model.attitude === 1 ? tri.prudent : tri.optimiste;
      impacts[node.id] = result;
      return result;
    }
    const childResults = node.children.map(evalNode);
    const weights = normalizeWeights(node.children);
    const result = aggregateNode(childResults, weights);
    impacts[node.id] = result;
    return result;
  }

  model.criteria.forEach(evalNode);

  const violated = model.constraints.filter(c => {
    if (c.kind !== "hard" && c.kind !== "veto") return false;
    const imp = impacts[c.critId];
    if (!imp) return false; // constraint on an id not in the tree — nothing to violate here
    return imp.dMinus > (c.maxRisk ?? 0);
  });

  return { impacts, admissible: violated.length === 0, violated, unknown };
}

// ── target / cible helpers ───────────────────────────────────────────────────

export interface TargetSpec {
  critId: string;
  min: OrdinalLevel; // required δ⁺
}

export function targetMet(res: ForwardResult, target: TargetSpec[]): boolean {
  return target.every(t => (res.impacts[t.critId]?.gPlus ?? 0) >= t.min);
}

// ── 3. BACKWARD — propose, never certify ─────────────────────────────────────

/**
 * A repair only needs to be target-met + veto/hard-constraint-free — it does
 * NOT need to be "perfect" everywhere else. Non-blocking degradations on
 * OTHER indicators are legitimate and expected (e.g. autonomie↑ at the cost
 * of a moderate coût↓); Aura must be able to EXPLAIN that trade-off
 * qualitatively rather than reduce it to a pass/fail bit — hence `explain`
 * carries, for every criterion whose propagated impact actually changed, the
 * before/after ordinal pair (never collapsed into a single fabricated score).
 */
export interface ImpactDelta { critId: string; before: OrdinalImpact; after: OrdinalImpact }

export interface ValidRepair {
  /** leverId → new optionId, only for levers actually changed. */
  changes: Record<string, string>;
  size: number;
  result: ForwardResult;
  /** Every criterion (leaf or internal) whose impact moved vs the base R0 — improvements and degradations alike. */
  explain: ImpactDelta[];
}

export interface BackwardResult {
  status: "already-met" | "found" | "unreachable";
  base: ForwardResult;
  blockers: TargetSpec[];
  influentLevers: string[];
  repairs: ValidRepair[];
  /** true quand la limite d'évaluations a été atteinte avant la fin de la
   *  recherche : résultat « dans les limites de recherche », non prouvé exact. */
  bounded?: boolean;
  /** Nombre d'évaluations forward effectuées par la recherche. */
  evaluated?: number;
  /** Taille de l'espace des configurations ∏_j |options_j|. */
  spaceSize?: number;
}

/** Every leaf under `critId`'s subtree (rule 2: only blocked branches feed the search). */
function subtreeLeaves(model: DecisionModel, critId: string): Set<string> {
  function find(node: KernelCriterion): KernelCriterion | null {
    if (node.id === critId) return node;
    for (const c of node.children ?? []) {
      const f = find(c);
      if (f) return f;
    }
    return null;
  }
  for (const root of model.criteria) {
    const node = find(root);
    if (node) return new Set(leafIds(node));
  }
  return new Set(critId ? [critId] : []);
}

function isKnownNonNull(cell: { gPlus: RawCell; dMinus: RawCell }): boolean {
  // Excludes "N" (nul — known to have no effect) and "U" (genuinely unknown,
  // so not usable to justify including the lever in THIS branch's search).
  return (cell.gPlus !== "N" && cell.gPlus !== "U") || (cell.dMinus !== "N" && cell.dMinus !== "U");
}

/**
 * iDDP_influents(B): levers with a KNOWN, non-null effect on at least one of
 * the specific blocked leaves — not merely "touches the same subtree". A
 * lever whose declared impact on a blocked leaf is "N" (nul) or "U" (unknown)
 * is excluded from THIS branch's candidate pool (it may still matter for
 * other, non-blocked branches — it stays in the model, just not searched
 * here). Checked against every option of the lever (not just the currently
 * selected one) since any option could become the repair.
 */
function influentLevers(model: DecisionModel, blockedLeaves: Set<string>): string[] {
  return model.levers
    .filter(lev => lev.options.some(o =>
      Object.entries(o.impacts).some(([id, cell]) => blockedLeaves.has(id) && isKnownNonNull(cell)),
    ))
    .map(lev => lev.id);
}

/**
 * Backward EXHAUSTIF : parcourt TOUTES
 * les configurations — tous les leviers, toutes leurs options — par nombre
 * de leviers changés croissant (voir exhaustive-search.ts), et renvoie toutes
 * les réparations valides de taille minimale. Chaque candidat est certifié
 * par un forward() complet (cible + veto sur tout l'arbre, règles 1 et 3) ;
 * la minimalité par inclusion (règle 4) découle de la minimalité en taille.
 *
 * `blockers` / `influentLevers` restent calculés à titre d'EXPLICATION
 * (goulots de R0) mais ne restreignent plus la recherche : un levier hors
 * branche bloquée peut être nécessaire (ex. compenser un veto créé ailleurs).
 *
 * Limite : `limit` évaluations (défaut EXHAUSTIVE_LIMIT = 10⁶). Tous les
 * espaces des démonstrations (≤ 13 122 configurations) sont parcourus en
 * entier ; au-delà de la limite, `bounded = true` signale un résultat obtenu
 * dans les limites de recherche.
 */
export function backward(
  target: TargetSpec[], model: DecisionModel, baseConfig: Configuration,
  opts: { limit?: number } = {},
): BackwardResult {
  const R0 = forward(baseConfig, model);
  // « Déjà atteint » exige la cible ET l'admissibilité (règle 1 : forward est
  // seul juge, veto compris).
  if (targetMet(R0, target) && R0.admissible) {
    return { status: "already-met", base: R0, blockers: [], influentLevers: [], repairs: [] };
  }

  const blockers = target.filter(t => (R0.impacts[t.critId]?.gPlus ?? 0) < t.min);
  const blockedLeaves = new Set<string>();
  blockers.forEach(b => subtreeLeaves(model, b.critId).forEach(id => blockedLeaves.add(id)));
  R0.violated.forEach(c => subtreeLeaves(model, c.critId).forEach(id => blockedLeaves.add(id)));
  const L = influentLevers(model, blockedLeaves);

  const results = new Map<string, ForwardResult>();
  const keyOf = (cfg: Configuration) => model.levers.map(l => cfg[l.id]).join("\u0000");
  const isValid = (cfg: Configuration): boolean => {
    const res = forward(cfg, model); // règles 1/3 : forward seul juge, sur le modèle COMPLET
    const ok = res.admissible && targetMet(res, target);
    if (ok) results.set(keyOf(cfg), res);
    return ok;
  };

  const search = searchMinimalRepairs({
    levers: model.levers.map(l => ({ id: l.id, optionIds: l.options.map(o => o.id) })),
    base: baseConfig,
    isValid,
    limit: opts.limit,
  });

  function diffImpacts(after: ForwardResult): ImpactDelta[] {
    const out: ImpactDelta[] = [];
    for (const critId of Object.keys(after.impacts)) {
      const before = R0.impacts[critId] ?? { gPlus: 0, dMinus: 0 };
      const post = after.impacts[critId];
      if (before.gPlus !== post.gPlus || before.dMinus !== post.dMinus) {
        out.push({ critId, before, after: post });
      }
    }
    return out;
  }

  const repairs: ValidRepair[] = search.repairs.map(r => {
    const res = results.get(keyOf(r.config)) ?? forward(r.config, model);
    return { changes: r.changes, size: Object.keys(r.changes).length, result: res, explain: diffImpacts(res) };
  });

  return {
    status: repairs.length > 0 ? "found" : "unreachable",
    base: R0, blockers, influentLevers: L, repairs,
    bounded: !search.complete,
    evaluated: search.evaluated,
    spaceSize: search.spaceSize,
  };
}

// ── 4. Priority ordering among multiple valid minimal repairs ───────────────

/**
 * Tie-break ordering — NOT a weighted average, a strict lexicographic sort:
 *   1. zero veto violations (re-asserted defensively; forward() already guarantees it)
 *   2. fewest lever changes
 *   3. lowest total cost   — REAL data only if every changed option carries `cost`; else no-op tier
 *   4. lowest total delay  — same caveat, `delayDays`
 *   5. lowest total risk/disruption — same caveat, `disruption`
 * Tiers 3-5 are skipped (return 0, i.e. no-op) when the source data does not
 * carry that field on every changed option — AtelierOptionDef today has no
 * cost/delay/disruption fields, so via the adapters below those tiers are
 * currently always no-ops; they activate automatically once real data exists.
 */
export function rankRepairs(repairs: ValidRepair[], levers: KernelLever[]): ValidRepair[] {
  const leverMap = new Map(levers.map(l => [l.id, l]));

  function sumField(r: ValidRepair, field: "cost" | "delayDays" | "disruption"): number | null {
    let total = 0;
    for (const [leverId, optId] of Object.entries(r.changes)) {
      const opt = leverMap.get(leverId)?.options.find(o => o.id === optId);
      const val = opt?.[field];
      if (val === undefined) return null; // missing data anywhere → tier is a no-op for this pair
      total += val;
    }
    return total;
  }

  return [...repairs].sort((a, b) => {
    const vetoA = a.result.admissible ? 0 : 1;
    const vetoB = b.result.admissible ? 0 : 1;
    if (vetoA !== vetoB) return vetoA - vetoB;

    if (a.size !== b.size) return a.size - b.size;

    for (const field of ["cost", "delayDays", "disruption"] as const) {
      const sa = sumField(a, field);
      const sb = sumField(b, field);
      if (sa === null || sb === null) continue; // no-op tier — no real data
      if (sa !== sb) return sa - sb;
    }
    return 0;
  });
}

// ── 5. Sensitivity — what would flip the decision ───────────────────────────

export interface SensitivityResult {
  /** Leaves whose one-level δ⁺ improvement flips admissibility+target-met from fail to pass. */
  decisive: { critId: string; fromGPlus: OrdinalLevel; toGPlus: OrdinalLevel }[];
  /** For each leaf, the minimum δ⁺ level at which the outcome would flip (if any ≤ H). */
  thresholds: { critId: string; requiredGPlus: OrdinalLevel }[];
}

/** Re-aggregates the tree with a single leaf's impact forced to an override value. */
function forwardWithOverride(
  config: Configuration, model: DecisionModel, leafId: string, override: OrdinalImpact,
): ForwardResult {
  const impacts: Record<string, OrdinalImpact> = {};

  function evalNode(node: KernelCriterion): OrdinalImpact {
    if (!node.children?.length) {
      const result = node.id === leafId
        ? override
        : (() => {
            const elems = leafElementaryImpacts(node.id, config, model.levers);
            const tri = aggregateCriterion(elems, model.attitude);
            return model.attitude === 1 ? tri.prudent : tri.optimiste;
          })();
      impacts[node.id] = result;
      return result;
    }
    const childResults = node.children.map(evalNode);
    const weights = normalizeWeights(node.children);
    const result = aggregateNode(childResults, weights);
    impacts[node.id] = result;
    return result;
  }

  model.criteria.forEach(evalNode);
  const violated = model.constraints.filter(c => {
    if (c.kind !== "hard" && c.kind !== "veto") return false;
    const imp = impacts[c.critId];
    return !!imp && imp.dMinus > (c.maxRisk ?? 0);
  });
  return { impacts, admissible: violated.length === 0, violated, unknown: [] };
}

/**
 * First, proportionate version: for each leaf, tries raising its δ⁺ by one
 * level at a time (keeping δ⁻ at its current propagated value's complement —
 * i.e. as a pure gain override, N on the other pole) and checks whether that
 * alone flips (admissible && targetMet) from false to true. Not exhaustive
 * over every possible lever/option combination — a direct, useful first cut.
 */
export function sensitivity(
  config: Configuration, model: DecisionModel, target: TargetSpec[],
): SensitivityResult {
  const base = forward(config, model);
  const baseOutcome = base.admissible && targetMet(base, target);

  const decisive: SensitivityResult["decisive"] = [];
  const thresholds: SensitivityResult["thresholds"] = [];

  for (const leafId of allLeaves(model)) {
    const current = base.impacts[leafId] ?? { gPlus: 0, dMinus: 0 };
    for (let lvl = (current.gPlus + 1) as OrdinalLevel; lvl <= 3; lvl = (lvl + 1) as OrdinalLevel) {
      const res = forwardWithOverride(config, model, leafId, { gPlus: lvl, dMinus: 0 });
      const outcome = res.admissible && targetMet(res, target);
      if (outcome !== baseOutcome) {
        if (!baseOutcome && outcome) {
          decisive.push({ critId: leafId, fromGPlus: current.gPlus, toGPlus: lvl });
          thresholds.push({ critId: leafId, requiredGPlus: lvl });
        }
        break; // first flipping level found for this leaf — record and move on
      }
    }
  }

  return { decisive, thresholds };
}

// ── 6. Adapters: AtelierSession/Criterion/LevierDef → DecisionModel ─────────

function atelierAttitude(a: AtelierSession["attitude"]): Attitude {
  return a === "Pessimiste" ? 1 : 2;
}

function importanceToConstraintMaxRisk(imp: ImportanceBadge): OrdinalLevel {
  // "Essentiel" = veto-grade — zero degradation tolerated. Others: no auto-constraint
  // (only Essentiel criteria are turned into hard/veto constraints by the adapter below,
  // matching the app's existing "Essentiel = veto" convention, see goalseek-verify.ts).
  return imp === "Essentiel" ? 0 : 3;
}

export function atelierCriterionToKernel(c: AtelierCriterion): KernelCriterion {
  return {
    id: c.id,
    label: c.label,
    weight: importanceToWeight(c.importance),
    children: c.children?.map(atelierCriterionToKernel),
  };
}

export function atelierLevierToKernel(l: AtelierLevierDef): KernelLever {
  return {
    id: l.id,
    label: l.label,
    options: l.options.map(o => ({
      id: o.id,
      label: o.label,
      impacts: Object.fromEntries(
        Object.entries(o.impacts).map(([critId, qi]) => {
          const e = qualImpactToElementary(qi);
          return [critId, { gPlus: e.gPlus, dMinus: e.dMinus }];
        }),
      ),
      // No cost/delay/disruption field exists on AtelierOptionDef today —
      // deliberately left undefined so rankRepairs()'s tiers 3-5 stay no-ops
      // rather than fabricating numbers.
    })),
  };
}

/** Only "Essentiel" criteria become hard/veto constraints (app convention). */
function collectVetoConstraints(criteria: AtelierCriterion[]): DecisionConstraint[] {
  const out: DecisionConstraint[] = [];
  function walk(c: AtelierCriterion) {
    if (c.importance === "Essentiel") {
      out.push({
        id: `veto-${c.id}`, kind: "veto", label: `${c.label} (Essentiel)`,
        critId: c.id, maxRisk: importanceToConstraintMaxRisk(c.importance),
      });
    }
    c.children?.forEach(walk);
  }
  criteria.forEach(walk);
  return out;
}

export function buildDecisionModel(session: AtelierSession): DecisionModel {
  return {
    criteria: session.criteria.map(atelierCriterionToKernel),
    levers: session.leviersDef.map(atelierLevierToKernel),
    constraints: collectVetoConstraints(session.criteria),
    attitude: atelierAttitude(session.attitude),
  };
}

/** Extracts a Configuration (leverId → optionId) from a scenario's chosen levers. */
export function configFromScenario(sc: AtelierScenario): Configuration {
  const cfg: Configuration = {};
  sc.leviers.forEach(lv => { cfg[lv.id] = lv.valeur; });
  return cfg;
}
