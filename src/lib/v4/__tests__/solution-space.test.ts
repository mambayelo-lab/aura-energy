// Exploration des solutions : toutes les combinaisons d'options par levier,
// évaluées par le forward de la thèse ; front, plus petit changement et chemin
// d'amélioration vérifiés contre une force brute indépendante.
import { describe, expect, it } from "vitest";
import { compareASC } from "../../engine/lo/aggregation";
import { DEMO_FACTORIES } from "../atelier-cases";
import { newSession, type AtelierSession } from "../atelier-store";
import { computeLoResults } from "../decision-express";
import { currentCombo, exploreSolutions, improvementPath, makeEvaluator, minimalMoveToBest, type Combo } from "../solution-space";

const demos: [string, () => AtelierSession][] = Object.keys(DEMO_FACTORIES).map(k => [k, () => DEMO_FACTORIES[k](newSession({ contextRaw: "" }))]);

// Toutes les combinaisons, sans enumerateCombos.
function allCombos(s: AtelierSession): Combo[] {
  let acc: Combo[] = [{}];
  for (const l of s.leviersDef) acc = acc.flatMap(c => l.options.map(o => ({ ...c, [l.id]: o.id })));
  return acc;
}

describe("espace des solutions", () => {
  for (const [name, make] of demos) {
    it(`${name} : exhaustif, même forward que le classement, meilleure et front justes`, () => {
      const s = make();
      const space = exploreSolutions(s);
      const brute = allCombos(s);
      expect(space.exhaustive).toBe(true);
      expect(space.results).toHaveLength(brute.length);
      expect(space.total).toBe(brute.length);
      const evaluate = makeEvaluator(s);
      // Le forward d'une combinaison égale celui d'un scénario qui la compose.
      const { nodeResults } = computeLoResults(s);
      for (const sc of s.scenarios) {
        const c = currentCombo(s, sc.id)!;
        expect(evaluate(c)).toEqual(nodeResults[sc.id]);
      }
      const best = brute.map(evaluate).reduce((a, b) => compareASC(b, a) > 0 ? b : a);
      expect({ gPlus: space.best!.gPlus, dMinus: space.best!.dMinus }).toEqual(best);
      for (const k of space.front) {
        const [g, d] = k.split(",").map(Number);
        expect(space.results.some(r => r.gPlus > g && r.dMinus <= d || r.gPlus >= g && r.dMinus < d)).toBe(false);
      }
    });

    it(`${name} : plus petit changement minimal (force brute) et chemin qui y mène`, () => {
      const s = make();
      const space = exploreSolutions(s);
      const from = currentCombo(s)!;
      const move = minimalMoveToBest(s, from, space.best!)!;
      const evaluate = makeEvaluator(s);
      const changed = (c: Combo) => s.leviersDef.filter(l => c[l.id] !== from[l.id]).length;
      const minBrute = Math.min(...allCombos(s).filter(c => compareASC(evaluate(c), space.best!) >= 0).map(changed));
      expect(move.alreadyBest ? 0 : move.changes.length).toBe(minBrute);
      expect(move.exhaustive).toBe(true);
      if (!move.alreadyBest) {
        const to = { ...from, ...Object.fromEntries(move.changes.map(c => [c.leverId, c.toId])) };
        expect(compareASC(evaluate(to), space.best!)).toBeGreaterThanOrEqual(0);
        const path = improvementPath(s, from, to);
        expect(path).toHaveLength(move.changes.length);
        expect(path.at(-1)!.result).toEqual(evaluate(to));
      }
    });
  }
});
