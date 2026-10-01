// Recherches exhaustives exactes sur le forward de la thèse Lô (2013),
// par programmation dynamique sur les accumulateurs compacts de lo-compact :
//  · exploreSpace : nombre EXACT de combinaisons d'options par profil
//    (δ⁺, δ⁻), meilleur profil, plus petit changement de leviers vers le
//    meilleur profil, toutes ses solutions (dénombrées, listées si peu
//    nombreuses, sinon forme compacte : options admissibles par levier) ;
//  · decisionBackward : plus petit nombre de changements de notes et
//    d'importances qui fait passer une autre option seule en tête, toutes
//    les solutions de ce niveau, dénombrées.
// Options équivalentes (mêmes avis sur tous les critères) : regroupées sans
// perte (multiplicité), puis redépliées à l'affichage.
import type { AtelierSession, ImportanceBadge, QualitativeImpact } from "./atelier-store";
import { importanceToWeight } from "./atelier-compute";
import {
  admissibleTags, attitudeOf, backwardCosts, cellCode, closer, closeTimes, compileTree, enumerateSolutions,
  gOf, dOf, NODE_INIT, runDP, scenarioRoots, tables, type DPOption, type DPRun, type DPStep, type Tables, type Tree,
} from "./lo-compact";

export const DP_MAX_STATES = 2_000_000;
export const BACKWARD_MAX_STATES = 400_000;
export const LIST_LIMIT = 1_000_000;      // au-delà, la liste affichée est reconstruite par profil
export const SOLUTIONS_CAP = 20_000;      // solutions minimales listées une à une ; au-delà, forme compacte

export type Combo = Record<string, string>;
export interface Profile { gPlus: number; dMinus: number }
const prof = (c: number): Profile => ({ gPlus: gOf(c), dMinus: dOf(c) });

// ── Espace des combinaisons de leviers ─────────────────────────────────────
interface LeverModel {
  t: Tree; T: Tables; steps: DPStep[]; init: Uint8Array;
  groups: string[][][];     // levier → groupe (tag) → options équivalentes
  empty: boolean;
}

function leverModel(session: AtelierSession, from?: Combo): LeverModel {
  const at = attitudeOf(session), T = tables(at), t = compileTree(session.criteria);
  const levers = session.leviersDef;
  // Contributions non neutres (feuille, cellule) de chaque option.
  const contrib = levers.map(l => l.options.map(o => {
    const out: [number, number][] = [];
    for (const lf of t.leaves) { const imp = o.impacts[t.ids[lf]]; if (imp !== undefined) { const c = cellCode(imp, at); if (c !== 0) out.push([lf, c]); } }
    return out;
  }));
  const last = new Int32Array(t.n).fill(-1);
  contrib.forEach((opts, j) => opts.forEach(cs => cs.forEach(([lf]) => { last[lf] = Math.max(last[lf], j); })));
  const close = closeTimes(t, lf => last[lf]);
  const closing = (j: number) => t.post.filter(i => i !== 0 && close[i] === j);
  const groups: string[][][] = [];
  const steps: DPStep[] = levers.map((l, j) => {
    const byKey = new Map<string, { ids: string[]; cs: [number, number][]; base: boolean }>();
    l.options.forEach((o, k) => {
      const base = from !== undefined && from[l.id] === o.id;
      const key = `${base ? "*" : ""}${contrib[j][k].map(x => x.join(":")).join(",")}`;
      const g = byKey.get(key) ?? { ids: [], cs: contrib[j][k], base };
      g.ids.push(o.id); byKey.set(key, g);
    });
    const gs = [...byKey.values()];
    groups.push(gs.map(g => g.ids));
    const options: DPOption[] = gs.map((g, tag) => ({
      cost: from === undefined || g.base ? 0 : 1, mult: g.ids.length, tag,
      apply: (s: Uint8Array) => { for (const [lf, c] of g.cs) s[lf] = T.accAdd[s[lf] * 16 + c]; },
    }));
    return { options, close: closer(t, T, closing(j), [0]) };
  });
  const init = new Uint8Array(t.n);
  for (const i of t.post) if (!t.leaf[i] || i === 0) init[i] = NODE_INIT;
  closer(t, T, closing(-1), [0])(init);
  return { t, T, steps, init, groups, empty: !t.kids[0].length };
}

const rootOf = (m: LeverModel, s: Uint8Array) => m.empty ? 0 : s[0];

function expand(m: LeverModel, levers: AtelierSession["leviersDef"], tags: number[], cap: number): Combo[] {
  let acc: Combo[] = [{}];
  tags.forEach((tag, j) => {
    const ids = m.groups[j][tag];
    const next: Combo[] = [];
    for (const c of acc) for (const id of ids) { if (next.length >= cap) break; next.push({ ...c, [levers[j].id]: id }); }
    acc = next;
  });
  return acc;
}

export interface SpaceResult {
  total: number;
  counts: Map<number, number>;      // profil (code) → nombre exact de combinaisons
  best: number | null;
  states: number; ms: number;
  refused?: string;                 // budget dépassé : explication et réduction proposée
  run?: DPRun; model?: LeverModel;
}

export function exploreSpace(session: AtelierSession, opts: { from?: Combo; maxStates?: number; onProgress?: (d: number, t: number) => void } = {}): SpaceResult {
  const t0 = performance.now();
  const total = session.leviersDef.reduce((a, l) => a * l.options.length, 1);
  const m = leverModel(session, opts.from);
  const run = runDP(m.init, m.steps, { maxStates: opts.maxStates ?? DP_MAX_STATES, onProgress: opts.onProgress });
  if (run.exceeded) {
    const big = [...session.leviersDef].sort((a, b) => b.options.length - a.options.length).slice(0, 3).map(l => `« ${l.label} » (${l.options.length} options)`);
    return { total, counts: new Map(), best: null, states: run.states, ms: performance.now() - t0,
      refused: `Calcul exact trop volumineux : plus de ${(opts.maxStates ?? DP_MAX_STATES).toLocaleString("fr-FR")} états intermédiaires distincts. Aucun échantillonnage n'est fait. Réduction proposée : regrouper des options proches dans ${big.join(", ")}, ou scinder la décision.` };
  }
  const counts = new Map<number, number>();
  for (const e of run.layers.at(-1)!.values()) { const r = rootOf(m, e.s); counts.set(r, (counts.get(r) ?? 0) + e.cnt); }
  let best: number | null = null;
  for (const c of counts.keys()) if (best === null || m.T.rank[c] > m.T.rank[best]) best = c;
  return { total, counts, best, states: run.states, ms: performance.now() - t0, run, model: m };
}

/** Combinaisons atteignant exactement le profil `code` (au plus `cap`). */
export function combosWithProfile(session: AtelierSession, sp: SpaceResult, profile: number, cap: number): Combo[] {
  const { run, model: m } = sp;
  if (!run || !m) return [];
  const b = backwardCosts(run, s => rootOf(m, s) === profile, false);
  const out: Combo[] = [];
  for (const tags of enumerateSolutions(run, b, 0, false)) {
    out.push(...expand(m, session.leviersDef, tags, cap - out.length));
    if (out.length >= cap) break;
  }
  return out;
}

export interface MoveResult {
  k: number | null;                  // nombre minimal de leviers à changer (null : inatteignable)
  count: number;                     // nombre exact de combinaisons minimales
  solutions: Combo[];                // listées (toutes si count ≤ cap), ordre de la recherche naïve
  admissible: Record<string, string[]>; // levier → options admissibles dans une solution minimale
}

/** Plus petit changement de leviers depuis `from` pour atteindre un profil au moins aussi bon que `target`. */
export function minimalLeverMove(session: AtelierSession, from: Combo, target: number, cap = SOLUTIONS_CAP): MoveResult | { refused: string } {
  const sp = exploreSpace(session, { from });
  if (sp.refused || !sp.run || !sp.model) return { refused: sp.refused ?? "" };
  const { run, model: m } = sp;
  const ok = (s: Uint8Array) => m.T.rank[rootOf(m, s)] >= m.T.rank[target];
  const b = backwardCosts(run, ok);
  let k = Infinity, count = 0;
  for (const e of run.layers.at(-1)!.values()) if (ok(e.s)) { if (e.cost < k) { k = e.cost; count = 0; } if (e.cost === k) count += e.ways; }
  if (k === Infinity) return { k: null, count: 0, solutions: [], admissible: {} };
  const solutions: Combo[] = [];
  for (const tags of enumerateSolutions(run, b, k)) { solutions.push(...expand(m, session.leviersDef, tags, cap - solutions.length)); if (solutions.length >= cap) break; }
  // Ordre de la recherche naïve (sous-ensembles de leviers, puis options).
  const L = session.leviersDef;
  const sig = (c: Combo) => { const ch = L.map((l, i) => [i, l.options.findIndex(o => o.id === c[l.id])] as const).filter(([i]) => c[L[i].id] !== from[L[i].id]); return [...ch.map(x => x[0]), ...ch.map(x => x[1])]; };
  const cmp = (a: number[], b2: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b2[i]) return a[i] - b2[i]; return 0; };
  solutions.sort((a, b2) => cmp(sig(a), sig(b2)));
  const adm = admissibleTags(run, b, k);
  const admissible: Record<string, string[]> = {};
  L.forEach((l, j) => { admissible[l.id] = [...adm[j]].flatMap(tag => m.groups[j][tag]); });
  return { k, count, solutions, admissible };
}

// ── Plus petit changement de notes et d'importances (décision) ─────────────
const IMPORTANCE_ORDER: ImportanceBadge[] = ["Faible", "Secondaire", "Important", "Essentiel"];
const NOTES: QualitativeImpact[] = ["--", "-", "-L", "0", "+L", "+", "++"];

export interface BackVar { id: string; kind: "note" | "importance"; criterionId: string; optionId?: string; values: string[]; base: string }

export interface DecisionBackward {
  k: number | null;                 // nombre minimal de changements (null : aucun, décision robuste)
  count: number;                    // nombre exact de configurations minimales
  solutions: Record<string, string>[]; // changements (variable → valeur), ordre de la recherche naïve
  admissible: Record<string, string[]>; // variable → valeurs admissibles (forme compacte)
  complete: boolean;                // false : budget d'états dépassé, résultat non prouvé
  states: number; ms: number; spaceSize: number;
}

/** Variables dans l'ordre de backwardSpace (decision-express) : importances des critères de tête, puis notes option × feuille. */
export function backwardVars(session: AtelierSession, leafIds: string[]): BackVar[] {
  const used = new Set(session.scenarios.flatMap(sc => sc.leviers.map(l => l.valeur)));
  const vars: BackVar[] = session.criteria.map(c => ({ id: `i|${c.id}`, kind: "importance" as const, criterionId: c.id, values: IMPORTANCE_ORDER, base: c.importance }));
  for (const lev of session.leviersDef) for (const o of lev.options) {
    if (!used.has(o.id)) continue;
    for (const lf of leafIds) vars.push({ id: `n|${o.id}|${lf}`, kind: "note", optionId: o.id, criterionId: lf, values: NOTES, base: o.impacts[lf] ?? "0" });
  }
  return vars;
}

export function decisionBackward(session: AtelierSession, opts: { maxStates?: number; cap?: number; onProgress?: (d: number, t: number) => void } = {}): DecisionBackward | null {
  const t0 = performance.now();
  const S = session.scenarios.length;
  if (S < 2) return null;
  const at = attitudeOf(session), T = tables(at), t = compileTree(session.criteria);
  const n = t.n;
  const roots = scenarioRoots(session);
  // Meneur : premier après tri stable (comme rankOptions).
  const order = roots.map((r, i) => i).sort((a, b) => T.rank[roots[b]] - T.rank[roots[a]]);
  const leader = order[0];
  const leafIds = t.leaves.map(i => t.ids[i]);
  const vars = backwardVars(session, leafIds);
  const varIndex = new Map(vars.map((v, i) => [v.id, i]));
  const spaceSize = vars.reduce((a, v) => a * (v.values.includes(v.base) ? v.values.length : v.values.length + 1), 1);
  const opt = new Map(session.leviersDef.flatMap(l => l.options.map(o => [o.id, o] as const)));
  const usedOpts = vars.filter(v => v.kind === "note" && v.criterionId === leafIds[0]).map(v => v.optionId!);
  const scenOf = new Map(usedOpts.map(o => [o, session.scenarios.map((sc, i) => sc.leviers.some(l => l.valeur === o) ? i : -1).filter(i => i >= 0)]));
  const offs = session.scenarios.map((_, i) => i * n);
  const FLAG = S * n;
  const topKids = t.kids[0];
  const topOf = new Int32Array(n);
  for (const c of topKids) { const mark = (i: number) => { topOf[i] = c; t.kids[i].forEach(mark); }; mark(c); }

  // Étapes : pour chaque critère de tête, notes de ses feuilles puis son importance.
  interface StepDef { step: DPStep; varIdx: number; values: string[] }
  const build = (modeB: boolean): { defs: StepDef[]; init: Uint8Array } => {
    const defs: StepDef[] = [];
    const lastOf = new Int32Array(n).fill(-1);
    const plan: ({ kind: "note"; leaf: number; o: string } | { kind: "imp"; c: number })[] = [];
    for (const c of topKids) {
      for (const lf of t.leaves.filter(l => topOf[l] === c)) for (const o of usedOpts) { plan.push({ kind: "note", leaf: lf, o }); lastOf[lf] = plan.length - 1; }
      plan.push({ kind: "imp", c });
    }
    const close = closeTimes(t, lf => lastOf[lf]);
    const closing = (j: number) => t.post.filter(i => i !== 0 && t.parent[i] !== 0 && close[i] === j);
    plan.forEach((p, j) => {
      if (p.kind === "note") {
        const v = vars[varIndex.get(`n|${p.o}|${t.ids[p.leaf]}`)!];
        const values = [v.base, ...v.values.filter(x => x !== v.base)];
        const sc = scenOf.get(p.o)!;
        const options: DPOption[] = values.map((val, tag) => {
          const cell = cellCode(val as QualitativeImpact, at);
          return { cost: tag === 0 ? 0 : 1, mult: 1, tag, apply: (s: Uint8Array) => { for (const i of sc) { const k = offs[i] + p.leaf; s[k] = T.accAdd[s[k] * 16 + cell]; } } };
        });
        defs.push({ step: { options, close: closer(t, T, closing(j), offs) }, varIdx: varIndex.get(v.id)!, values });
      } else {
        const v = vars[varIndex.get(`i|${t.ids[p.c]}`)!];
        const values = modeB ? ["Faible"] : [v.base, ...v.values.filter(x => x !== v.base)];
        const c = p.c;
        const options: DPOption[] = values.map((val, tag) => {
          const w = modeB ? 3 : importanceToWeight(val as ImportanceBadge);
          return { cost: val === v.base ? 0 : 1, mult: 1, tag, apply: (s: Uint8Array) => {
            for (const off of offs) {
              const x = t.leaf[c] ? T.leafFin[s[off + c]] : s[off + c];
              s[off] = T.nodeAdd[s[off] * 16 + T.ct[w * 16 + x]]; s[off + c] = 0;
            }
            if (!modeB && w > 0) s[FLAG] = 1;
          } };
        });
        defs.push({ step: { options, close: closer(t, T, closing(j), offs) }, varIdx: varIndex.get(v.id)!, values });
      }
    });
    const init = new Uint8Array(S * n + 1);
    for (const off of offs) for (const i of t.post) if (!t.leaf[i] || i === 0) init[off + i] = NODE_INIT;
    closer(t, T, closing(-1), offs)(init);
    return { defs, init };
  };

  const winner = (s: Uint8Array): number => {
    let best = -1, bi = -1, tie = false;
    for (let i = 0; i < S; i++) {
      const r = topKids.length ? T.rank[s[offs[i]]] : T.rank[0];
      if (r > best) { best = r; bi = i; tie = false; } else if (r === best) tie = true;
    }
    return !tie && bi !== leader ? bi : -1;
  };
  const accept = (modeB: boolean) => (s: Uint8Array) => (modeB || s[FLAG] === 1) && winner(s) >= 0;

  const maxStates = opts.maxStates ?? BACKWARD_MAX_STATES;
  const modes = [false, true].map(modeB => ({ modeB, ...build(modeB) }));
  let states = 0;
  // 1) Sans plafond de coût ; 2) si le budget d'états est dépassé, plafond k croissant (exact dès qu'une solution est trouvée).
  const solve = (cap: number) => modes.map(md => {
    const run = runDP(md.init, md.defs.map(d => d.step), { costCap: cap, maxStates, onProgress: opts.onProgress });
    states += run.states;
    return { md, run };
  });
  const bestOf = (rs: ReturnType<typeof solve>) => {
    let k = Infinity;
    for (const { md, run } of rs) if (!run.exceeded) for (const e of run.layers.at(-1)!.values()) if (accept(md.modeB)(e.s) && e.cost < k) k = e.cost;
    return k;
  };
  // Approfondissement : plafond de coût k = 1, 2, … (élagage exact : un état
  // dont le coût dépasse k ne peut mener à une solution de coût ≤ k). Dès
  // qu'une solution apparaît, k est minimal. Si aucun état n'a été élagué,
  // l'espace entier a été couvert : l'absence de solution est prouvée.
  let runs: ReturnType<typeof solve> = [];
  let complete = false, capUsed = Infinity, k = Infinity;
  for (let cap = 1; cap <= Math.max(1, vars.length); cap++) {
    runs = solve(cap);
    if (runs.some(r => r.run.exceeded)) break;
    const kk = bestOf(runs);
    if (kk <= cap) { k = kk; capUsed = cap; complete = true; break; }
    if (!runs.some(r => r.run.pruned)) { complete = true; break; }
  }
  const ms = () => performance.now() - t0;
  if (!complete) return { k: null, count: 0, solutions: [], admissible: {}, complete: false, states, ms: ms(), spaceSize };
  if (k === Infinity) return { k: null, count: 0, solutions: [], admissible: {}, complete: true, states, ms: ms(), spaceSize };

  let count = 0;
  const solutions: Record<string, string>[] = [];
  const admissible: Record<string, Set<string>> = {};
  const cap = opts.cap ?? SOLUTIONS_CAP;
  for (const { md, run } of runs) {
    const acc = accept(md.modeB);
    for (const e of run.layers.at(-1)!.values()) if (acc(e.s) && e.cost === k) count += e.ways;
    const b = backwardCosts(run, acc, true, capUsed);
    for (const tags of enumerateSolutions(run, b, k)) {
      if (solutions.length >= cap) break;
      const ch: Record<string, string> = {};
      tags.forEach((tag, j) => { const d = md.defs[j]; const v = vars[d.varIdx]; if (d.values[tag] !== v.base) ch[v.id] = d.values[tag]; });
      solutions.push(ch);
    }
    admissibleTags(run, b, k).forEach((tags, j) => {
      const d = md.defs[j]; const v = vars[d.varIdx];
      for (const tag of tags) if (d.values[tag] !== v.base) (admissible[v.id] ??= new Set()).add(d.values[tag]);
    });
  }
  // Ordre de la recherche naïve : indices de variables croissants, puis rang de la valeur parmi les alternatives.
  const sig = (ch: Record<string, string>) => {
    const ids = Object.keys(ch).map(id => varIndex.get(id)!).sort((a, b) => a - b);
    return [...ids, ...ids.map(i => vars[i].values.filter(x => x !== vars[i].base).indexOf(ch[vars[i].id]))];
  };
  const cmp = (a: number[], b: number[]) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  solutions.sort((a, b) => cmp(sig(a), sig(b)));
  return { k, count, solutions, admissible: Object.fromEntries(Object.entries(admissible).map(([id, s]) => [id, [...s]])), complete: true, states, ms: ms(), spaceSize };
}

export { prof as profileOf };
