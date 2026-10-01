// Évaluation optimisée du forward de la thèse, pour les recherches exhaustives
// (plus petit changement, exploration des combinaisons). Aucune formule n'est
// réécrite : on appelle exactement les fonctions du moteur (aggregateCriterion
// pour la fusion d'une feuille, aggregateNode pour chaque nœud, thesisWeights,
// compareASC). L'optimisation est purement algorithmique :
//  · incrémentale : un changement ne recalcule que les scénarios concernés et,
//    dans chacun, le seul chemin feuille → racine touché ;
//  · mise en cache : fusion d'une feuille par multiset d'impacts, agrégation
//    d'un nœud par (valeurs d'entrée, poids) — clés canoniques ;
//  · combinaisons de leviers parcourues comme un odomètre : passer à la
//    combinaison suivante ne recalcule que ce que le levier modifié touche.
// Les tests de propriété comparent chaque résultat à la force brute naïve.
import { aggregateCriterion, aggregateNode, compareASC, thesisWeights } from "../engine/lo/aggregation";
import type { Attitude, OrdinalImpact, OrdinalLevel } from "../engine/lo/types";
import { importanceToWeight, qualImpactToElementary } from "./atelier-compute";
import type { AtelierCriterion, AtelierSession, ImportanceBadge, QualitativeImpact } from "./atelier-store";

type Pair = { gPlus: OrdinalLevel; dMinus: OrdinalLevel };
interface Node { id: string; parent: number; children: number[]; leaf: boolean; importance: ImportanceBadge }

export class FastModel {
  readonly nodes: Node[] = [];
  readonly top: number[] = [];
  private readonly profile: "prudent" | "optimiste";
  private readonly attitude: Attitude;
  private readonly leafCache = new Map<string, Pair>();
  private readonly nodeCache = new Map<string, Pair>();
  readonly leafIndex = new Map<string, number>();
  evaluations = 0;

  constructor(readonly session: AtelierSession) {
    this.attitude = session.attitude === "Pessimiste" ? 1 : 2;
    this.profile = session.attitude === "Pessimiste" ? "prudent" : "optimiste";
    const add = (c: AtelierCriterion, parent: number): number => {
      const i = this.nodes.length;
      this.nodes.push({ id: c.id, parent, children: [], leaf: !c.children?.length, importance: c.importance });
      if (!c.children?.length) this.leafIndex.set(c.id, i);
      else this.nodes[i].children = c.children.map(ch => add(ch, i));
      return i;
    };
    for (const c of session.criteria) this.top.push(add(c, -1));
  }

  // Fusion d'une feuille : fonction du multiset d'impacts (mêmes appels que aggregateHierarchy).
  leaf(cells: string[]): Pair {
    const sorted = [...cells].sort();
    const key = sorted.join(",");
    let v = this.leafCache.get(key);
    if (!v) {
      const imps = sorted.map((imp, li) => qualImpactToElementary(imp as QualitativeImpact, li));
      v = aggregateCriterion(imps.length ? imps : [qualImpactToElementary("0", 0)], this.attitude)[this.profile] as Pair;
      this.leafCache.set(key, v);
    }
    return v;
  }

  // Agrégation d'un nœud : fonction des valeurs des enfants et de leurs poids.
  node(values: Pair[], importances: ImportanceBadge[]): Pair {
    const key = `${values.map(v => `${v.gPlus}${v.dMinus}`).join("")}|${importances.map(i => i[0]).join("")}`;
    let v = this.nodeCache.get(key);
    if (!v) {
      const w = thesisWeights(importances.map(importanceToWeight));
      try { v = aggregateNode(values.length ? values : [{ gPlus: 0, dMinus: 0 }], w.length ? w : [3]) as Pair; }
      catch { v = { gPlus: 0, dMinus: 0 }; }
      this.nodeCache.set(key, v);
    }
    return v;
  }
}

// ── Scénarios : évaluation incrémentale sous changements de notes / importances ──
export interface Changes { importance: Map<string, ImportanceBadge>; notes: Map<string, Map<string, QualitativeImpact>> } // option → feuille → note

export class ScenarioRanker {
  readonly m: FastModel;
  private readonly impacts = new Map<string, Record<string, QualitativeImpact>>();
  private readonly chosen: string[][];          // scénario → options retenues
  private readonly baseVals: Pair[][];          // scénario → valeur de chaque nœud
  private readonly baseTop: Pair[];

  constructor(readonly session: AtelierSession) {
    this.m = new FastModel(session);
    for (const l of session.leviersDef) for (const o of l.options) this.impacts.set(o.id, o.impacts);
    this.chosen = session.scenarios.map(s => s.leviers.map(l => l.valeur));
    this.baseVals = this.chosen.map(opts => this.fullTree(opts, new Map()));
    this.baseTop = this.baseVals.map(v => this.topOf(v, new Map()));
  }

  private cells(opts: string[], leafId: string, notes: Changes["notes"]): string[] {
    const out: string[] = [];
    for (const o of opts) { const v = notes.get(o)?.get(leafId) ?? this.impacts.get(o)?.[leafId]; if (v !== undefined) out.push(v); }
    return out;
  }
  private fullTree(opts: string[], notes: Changes["notes"]): Pair[] {
    const vals: Pair[] = new Array(this.m.nodes.length);
    const rec = (i: number): Pair => {
      const n = this.m.nodes[i];
      vals[i] = n.leaf ? this.m.leaf(this.cells(opts, n.id, notes)) : this.m.node(n.children.map(rec), n.children.map(c => this.m.nodes[c].importance));
      return vals[i];
    };
    this.m.top.forEach(rec);
    return vals;
  }
  private topOf(vals: Pair[], imp: Changes["importance"]): Pair {
    return this.m.node(this.m.top.map(i => vals[i]), this.m.top.map(i => imp.get(this.m.nodes[i].id) ?? this.m.nodes[i].importance));
  }

  // Classement sous changements : mêmes règles que rankOptions (tri stable, compareASC).
  rank(ch: Changes): { id: string; label: string; r: Pair; rank: number }[] {
    this.m.evaluations++;
    const res = this.session.scenarios.map((s, si) => {
      const touched = [...ch.notes.keys()].filter(o => this.chosen[si].includes(o));
      let vals = this.baseVals[si];
      if (touched.length) {
        // Chemin feuille → racine des seules feuilles modifiées.
        vals = [...vals];
        const dirty = new Set<number>();
        for (const o of touched) for (const leafId of ch.notes.get(o)!.keys()) {
          const li = this.m.leafIndex.get(leafId);
          if (li === undefined) continue;
          vals[li] = this.m.leaf(this.cells(this.chosen[si], leafId, ch.notes));
          for (let p = this.m.nodes[li].parent; p >= 0; p = this.m.nodes[p].parent) dirty.add(p);
        }
        [...dirty].sort((a, b) => b - a).forEach(p => { // enfants avant parents (indices croissants en profondeur)
          const n = this.m.nodes[p];
          vals[p] = this.m.node(n.children.map(c => vals[c]), n.children.map(c => this.m.nodes[c].importance));
        });
      }
      const r = touched.length || ch.importance.size ? this.topOf(vals, ch.importance) : this.baseTop[si];
      return { id: s.id, label: s.label, r };
    });
    const sorted = [...res].sort((a, b) => compareASC(b.r, a.r));
    let rank = 0;
    return sorted.map((o, i) => { if (i === 0 || compareASC(sorted[i - 1].r, o.r) !== 0) rank = i + 1; return { ...o, rank }; });
  }
}

// ── Combinaisons de leviers : odomètre incrémental ─────────────────────────
export class ComboWalker {
  readonly m: FastModel;
  private readonly levers: { id: string; options: string[]; leaves: number[] }[];
  private readonly impacts = new Map<string, Record<string, QualitativeImpact>>();
  private cur: string[];
  private vals: Pair[] = [];

  constructor(readonly session: AtelierSession) {
    this.m = new FastModel(session);
    for (const l of session.leviersDef) for (const o of l.options) this.impacts.set(o.id, o.impacts);
    const leafIds = [...this.m.leafIndex.keys()];
    this.levers = session.leviersDef.map(l => ({
      id: l.id, options: l.options.map(o => o.id),
      // Feuilles qu'au moins une option de ce levier touche.
      leaves: leafIds.filter(id => l.options.some(o => o.impacts[id] !== undefined)).map(id => this.m.leafIndex.get(id)!),
    }));
    this.cur = this.levers.map(l => l.options[0]);
    this.recomputeAll();
  }
  private cells(leafId: string): string[] {
    const out: string[] = [];
    for (const o of this.cur) { const v = this.impacts.get(o)?.[leafId]; if (v !== undefined) out.push(v); }
    return out;
  }
  private recomputeAll() {
    const rec = (i: number): Pair => {
      const n = this.m.nodes[i];
      this.vals[i] = n.leaf ? this.m.leaf(this.cells(n.id)) : this.m.node(n.children.map(rec), n.children.map(c => this.m.nodes[c].importance));
      return this.vals[i];
    };
    this.m.top.forEach(rec);
  }
  set(li: number, optionId: string) {
    if (this.cur[li] === optionId) return;
    this.cur[li] = optionId;
    const dirty = new Set<number>();
    for (const leaf of this.levers[li].leaves) {
      this.vals[leaf] = this.m.leaf(this.cells(this.m.nodes[leaf].id));
      for (let p = this.m.nodes[leaf].parent; p >= 0; p = this.m.nodes[p].parent) dirty.add(p);
    }
    [...dirty].sort((a, b) => b - a).forEach(p => { const n = this.m.nodes[p]; this.vals[p] = this.m.node(n.children.map(c => this.vals[c]), n.children.map(c => this.m.nodes[c].importance)); });
  }
  value(): Pair {
    this.m.evaluations++;
    return this.m.node(this.m.top.map(i => this.vals[i]), this.m.top.map(i => this.m.nodes[i].importance));
  }
  evaluate(combo: Record<string, string>): Pair {
    this.levers.forEach((l, i) => this.set(i, combo[l.id]));
    return this.value();
  }
  // Parcours de tout l'espace (odomètre), sans troncature : le premier levier
  // tourne le plus vite, les autres ne changent qu'à la retenue.
  *walk(): Generator<{ combo: string[]; r: Pair }> {
    const idx = this.levers.map(() => 0);
    this.levers.forEach((l, i) => this.set(i, l.options[0]));
    for (;;) {
      yield { combo: [...this.cur], r: this.value() };
      let p = 0;
      while (p < idx.length) {
        idx[p]++;
        if (idx[p] < this.levers[p].options.length) { this.set(p, this.levers[p].options[idx[p]]); break; }
        idx[p] = 0; this.set(p, this.levers[p].options[0]); p++;
      }
      if (p === idx.length) return;
    }
  }
  get leverIds() { return this.levers.map(l => l.id); }
}

// Dépendances des nœuds : l'ordre « enfants avant parents » repose sur le fait
// que add() numérote un parent avant ses enfants (indices décroissants = plus
// profond d'abord).
export type { Pair as FastPair, OrdinalImpact };
