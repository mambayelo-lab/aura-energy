import { describe, expect, it } from "vitest";
import { goalSeek, type ComboEval } from "../index";

const ce = (key: string, perCrit: Record<string, [number, number]>, global: [number, number]): ComboEval => ({
  key, combo: { L1: key },
  perCrit: Object.fromEntries(Object.entries(perCrit).map(([k, [g, d]]) => [k, { gPlus: g as 0 | 1 | 2 | 3, dMinus: d as 0 | 1 | 2 | 3 }])),
  global: { gPlus: global[0] as 0 | 1 | 2 | 3, dMinus: global[1] as 0 | 1 | 2 | 3 },
});

const EVALS: ComboEval[] = [
  ce("c1", { m1: [3, 0], m2: [2, 0] }, [2, 0]), // atteint tout
  ce("c2", { m1: [3, 0], m2: [1, 0] }, [1, 0]), // bloquée par m2
  ce("c3", { m1: [1, 0], m2: [2, 0] }, [1, 0]), // bloquée par m1
  ce("c4", { m1: [1, 0], m2: [1, 0] }, [1, 0]), // bloquée par les deux
  ce("c5", { m1: [3, 2], m2: [3, 0] }, [3, 2]), // gains OK mais risque sur m1
];
const T = [{ critId: "m1", min: 2 as const }, { critId: "m2", min: 2 as const }];

describe("goalSeek — atteinte (Eq.5 restreinte à G)", () => {
  it("ne retient que les combinaisons satisfaisant toutes les cibles, risque toléré NUL", () => {
    const r = goalSeek(EVALS, T);
    expect(r.reaching.map(c => c.key)).toEqual(["c1"]);
  });
  it("la tolérance de risque réintègre c5, classée après c1 (thèse Lô p. 83 : détérioration d'abord)", () => {
    const r = goalSeek(EVALS, T, { tolerateRisk: 2 });
    expect(r.reaching.map(c => c.key)).toEqual(["c1", "c5"]);
  });
});

describe("goalSeek — goulots (argument actif du min)", () => {
  it("compte les combinaisons bloquées par chaque cible", () => {
    const r = goalSeek(EVALS, T);
    const by = Object.fromEntries(r.bottlenecks.map(b => [b.critId, b.blocked]));
    expect(by.m1).toBe(3); // c3, c4, c5 (risque)
    expect(by.m2).toBe(2); // c2, c4
  });
});

describe("goalSeek — worth discret (coalitions débloquantes)", () => {
  it("relever m2 seul débloque c2 ; la coalition {m1,m2} débloque c2, c3, c4, c5", () => {
    const r = goalSeek(EVALS, T);
    const w = Object.fromEntries(r.worth.map(x => [x.coalition.join("+"), x.unlocked]));
    expect(w["m2"]).toBe(1);
    expect(w["m1+m2"]).toBe(4);
    expect(r.worth[0].coalition).toEqual(["m1", "m2"]); // jamais restreint aux singletons
  });
});

describe("goalSeek — backtracking (relaxation)", () => {
  it("relâcher m1 ferait apparaître c1, c2 et c5 ; relâcher m2 : c1 et c3", () => {
    const r = goalSeek(EVALS, T);
    const rx = Object.fromEntries(r.relaxations.map(x => [x.critId, x.wouldReach]));
    expect(rx.m1).toBe(3); // sans m1 : c1, c3, c5 passent sur m2
    expect(rx.m2).toBe(2); // c1, c2
  });
});
