/**
 * Validation du moteur Sow sur le cas d'étude publié :
 * Sow, Imoussaten, Couturier, Montmain — IPMU 2016 (hal-01929424),
 * robot RobAFIS 2013, Tables 1 à 5.
 * Le moteur doit REPRODUIRE les résultats évalués par les pairs.
 */
import { describe, expect, it } from "vitest";
import {
  analyzeSow, capacityFromTable, integraleQualitative, worthQual,
  enumeratePlans, mergePlan, achievability,
} from "../index";
import type { SowAction } from "../types";

// Échelle L = {0, a, b, c, d, e} → 0..5
const [a, b, c, d, e] = [1, 2, 3, 4, 5];
const MAXL = e;

// Table 2 — capacité μ(I). Bits : Cr1=1, Cr2=2, Cr3=4, Cr4=8.
const MU = capacityFromTable(new Map<number, number>([
  [0, 0],
  [1, a], [2, a], [4, b], [8, a],
  [3, b], [5, b], [9, b], [6, d], [10, c], [12, b],
  [7, e], [11, d], [13, d], [14, d],
  [15, e],
]), 4, MAXL);

// Table 3 — impacts des choix techniques (S = "+", D = "−").
const ACTIONS: SowAction[] = [
  { id: "G1", label: "fork",     group: "G", support: { 0: e, 3: e }, distract: { 1: a, 2: b } },
  { id: "G2", label: "gripper",  group: "G", support: { 2: d },       distract: { 0: b, 1: a, 3: a } },
  { id: "G3", label: "graspel",  group: "G", support: { 2: c },       distract: { 0: d, 1: a, 3: d } },
  { id: "R1", label: "4wheels",  group: "R", support: { 0: e, 3: c }, distract: { 1: c, 2: d } },
  { id: "R2", label: "3wheels",  group: "R", support: { 1: d, 2: c }, distract: { 0: c, 3: b } },
  { id: "R3", label: "trackers", group: "R", support: { 1: c },       distract: { 0: d, 2: c, 3: d } },
  { id: "S1", label: "2+1",      group: "S", support: { 1: e, 2: c }, distract: { 0: c, 3: c } },
  { id: "S2", label: "1+1",      group: "S", support: { 0: b, 3: c }, distract: { 1: d, 2: c } },
];

const P0 = [0, 0, 0, 0];

describe("intégrale qualitative (§2.3)", () => {
  it("reproduit Sμ(p⁰)=0, Sμ(p⁰¹)=a, Sμ(p⁰²)=c (§3.2 ; le texte du papier", () => {
    // Le §3.2 imprime Sμ(p⁰²)=d, mais c'est une coquille : la Table 4 du même
    // papier donne w_p⁰²({1})=c, or w est la médiane d'une suite non décroissante
    // qui DÉBUTE à Sμ(p⁰²) — elle ne peut pas être inférieure. Sμ(p⁰²)=c est la
    // seule valeur cohérente avec Table 2 (μ({C2,C4})=c) et Table 4.
    expect(integraleQualitative([0, 0, 0, 0], MU)).toBe(0);
    expect(integraleQualitative([0, a, 0, a], MU)).toBe(a);
    expect(integraleQualitative([0, d, b, c], MU)).toBe(c);
  });
});

describe("Worth w_p⁰(I) — Table 4, attitude optimiste", () => {
  const cases: Array<[number[], number]> = [
    [[0], a], [[1], a], [[2], b], [[3], a],
    [[0, 1], b], [[0, 2], b], [[0, 3], b],
    [[1, 2], c], [[1, 3], c], [[2, 3], b],
    [[0, 1, 2], c], [[0, 1, 3], c], [[0, 2, 3], c], [[1, 2, 3], c],
    [[0, 1, 2, 3], c],
  ];
  for (const [I, expected] of cases) {
    it(`w_p⁰({${I.map(i => `Cr${i + 1}`).join(",")}}) = ${expected}`, () => {
      expect(worthQual(P0, I, MU, MAXL, "optimiste")).toBe(expected);
    });
  }
});

describe("Atteignabilité s(I) — Table 5, fusion optimiste", () => {
  const plans = enumeratePlans(ACTIONS);
  const merged = plans.map(p => mergePlan(p, 4, "optimiste"));
  const cases: Array<[number[], number]> = [
    [[0], e], [[1], e], [[3], e],
    [[0, 1], e], [[0, 3], e], [[1, 3], e], [[0, 1, 3], e],
    [[2], d], [[0, 2], d], [[1, 2], d], [[0, 1, 2], d],
    [[2, 3], c], [[0, 2, 3], c], [[1, 2, 3], c], [[0, 1, 2, 3], c],
  ];
  for (const [I, expected] of cases) {
    it(`s({${I.map(i => `Cr${i + 1}`).join(",")}}) = ${expected}`, () => {
      expect(achievability(plans, merged, I, 4).s).toBe(expected);
    });
  }
  it("le nombre de plans est 3×3×2 = 18 configurations", () => {
    expect(plans.length).toBe(18);
  });
});

describe("Problème (1) : max w(I) s.c. w(I) ≤ s(I) — §3.3", () => {
  const analysis = analyzeSow({
    nCriteria: 4, p0: P0, mu: MU, maxL: MAXL,
    actions: ACTIONS, worthAttitude: "optimiste", achievAttitude: "optimiste",
  });

  it("les I* du papier sont {Cr2,Cr4} et {Cr1,Cr2,Cr4}", () => {
    const keys = analysis.optimal.map(o => o.criteria.join(",")).sort();
    expect(keys).toEqual(["0,1,3", "1,3"]);
  });

  it("les I* ont worth = c et atteignabilité = e", () => {
    for (const o of analysis.optimal) {
      expect(o.worth).toBe(c);
      expect(o.achievability).toBe(e);
    }
  });

  it("les plans réalisant {Cr2,Cr4} incluent les configurations en G1 du papier (§3.3)", () => {
    const i24 = analysis.optimal.find(o => o.criteria.join(",") === "1,3")!;
    for (const plan of i24.bestPlans) expect(plan).toContain("G1");
  });

  it("monotonies du §2.4 : s non-croissante et w non-décroissante avec I", () => {
    const get = (I: number[]) => analysis.coalitions.find(cl => cl.criteria.join(",") === I.join(","))!;
    expect(get([1]).achievability).toBeGreaterThanOrEqual(get([1, 2]).achievability);
    expect(get([1, 2]).worth).toBeGreaterThanOrEqual(get([1]).worth);
  });
});
