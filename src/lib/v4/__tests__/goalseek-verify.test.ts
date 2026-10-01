import { describe, expect, it } from "vitest";
import {
  globalVetoBreaches, filterGloballyVerified, traceBlockingBranch, culpritLevers,
  findMinimalRepairs, distinctExecutivePaths, type ObjectiveRef, type VerifiableCombo, type MinimalRepair,
} from "../goalseek-verify";
import type { AtelierCriterion, AtelierScenario, AtelierOptionDef, AtelierLevierDef } from "../atelier-store";

const OBJ: ObjectiveRef[] = [
  { id: "m1", label: "Sûreté", importance: "Essentiel" },
  { id: "m2", label: "Coût", importance: "Important" },
];

describe("globalVetoBreaches / filterGloballyVerified — étape 1", () => {
  it("ne signale un veto que pour un objectif Essentiel dégradé (dMinus > 0)", () => {
    const perCrit = { m1: { gPlus: 1 as const, dMinus: 2 as const }, m2: { gPlus: 0 as const, dMinus: 3 as const } };
    expect(globalVetoBreaches(perCrit, OBJ).map(o => o.id)).toEqual(["m1"]);
  });
  it("aucun veto si l'objectif Essentiel n'est pas dégradé", () => {
    const perCrit = { m1: { gPlus: 3 as const, dMinus: 0 as const }, m2: { gPlus: 0 as const, dMinus: 3 as const } };
    expect(globalVetoBreaches(perCrit, OBJ)).toEqual([]);
  });
  it("filterGloballyVerified rejette une combinaison acceptée par les seules cibles actives mais qui dégrade un objectif Essentiel non ciblé", () => {
    const combos: VerifiableCombo[] = [
      { key: "safe", combo: {}, perCrit: { m1: { gPlus: 3, dMinus: 0 }, m2: { gPlus: 2, dMinus: 1 } }, global: { gPlus: 2, dMinus: 0 } },
      { key: "veto", combo: {}, perCrit: { m1: { gPlus: 3, dMinus: 1 }, m2: { gPlus: 3, dMinus: 0 } }, global: { gPlus: 3, dMinus: 0 } },
    ];
    expect(filterGloballyVerified(combos, OBJ).map(c => c.key)).toEqual(["safe"]);
  });
});

describe("traceBlockingBranch — argmin/argmax exact (étape 2)", () => {
  const optionIndex: Record<string, AtelierOptionDef> = {
    optA: { id: "optA", label: "Option A", impacts: { leafGood: "++", leafBad: "--" } },
    optB: { id: "optB", label: "Option B", impacts: { leafGood: "0", leafBad: "0" } },
  };
  const tree: AtelierCriterion = {
    id: "top", label: "Objectif", poids: 90, description: "", importance: "Essentiel", level: "MOE",
    children: [
      { id: "leafGood", label: "Bonne branche", poids: 55, description: "", importance: "Important", level: "TPM" },
      { id: "leafBad", label: "Mauvaise branche", poids: 90, description: "", importance: "Essentiel", level: "TPM" },
    ],
  };
  const sc: AtelierScenario = {
    id: "sc", label: "", color: "", description: "",
    leviers: [{ id: "L1", label: "L1", valeur: "optA", type: "autre" }],
    scores: {}, valeur: 0, faisabilite: 0,
  };
  it("descend jusqu'à la feuille dont le risque domine réellement le nœud parent", () => {
    const trace = traceBlockingBranch(tree, sc, optionIndex, 1, "prudent");
    expect(trace.leafId).toBe("leafBad");
    expect(trace.path[trace.path.length - 1].role).toBe("risque");
  });
});

describe("culpritLevers — leviers responsables d'une feuille", () => {
  const leviersDef: AtelierLevierDef[] = [
    {
      id: "L1", label: "Levier 1", type: "autre", options: [
        { id: "optA", label: "Option A", impacts: { leafBad: "--" } },
        { id: "optB", label: "Option B", impacts: { leafBad: "0" } },
      ],
    },
  ];
  it("propose l'option qui améliore la feuille bloquante par rapport à l'option actuelle", () => {
    const out = culpritLevers("leafBad", leviersDef, { L1: "optA" });
    expect(out).toHaveLength(1);
    expect(out[0].betterOptions.map(o => o.optionId)).toEqual(["optB"]);
  });
  it("ne propose rien si aucune alternative n'améliore la feuille", () => {
    const out = culpritLevers("leafBad", leviersDef, { L1: "optB" });
    expect(out).toEqual([]);
  });
});

describe("distinctExecutivePaths — étape 4 (déduplication par set de leviers)", () => {
  const mk = (key: string, leverIds: string[]): MinimalRepair => ({
    key, combo: {},
    changes: leverIds.map(id => ({ leverId: id, leverLabel: id, fromOptionLabel: "", toOptionId: "x", toOptionLabel: "x" })),
  });
  it("garde un seul représentant par set distinct de leviers changés", () => {
    const repairs = [mk("r1", ["L1", "L2"]), mk("r2", ["L2", "L1"]), mk("r3", ["L3"])];
    const out = distinctExecutivePaths(repairs, 5);
    expect(out.map(r => r.key)).toEqual(["r1", "r3"]);
  });
  it("respecte le plafond max", () => {
    const repairs = [mk("a", ["L1"]), mk("b", ["L2"]), mk("c", ["L3"]), mk("d", ["L4"])];
    expect(distinctExecutivePaths(repairs, 2)).toHaveLength(2);
  });
});


describe("Backward P1–P5 — invariants de non-régression", () => {
  const lever = (id: string): AtelierLevierDef => ({
    id, label: id, type: "autre",
    options: [
      { id: id + "-base", label: "Actuel", impacts: {} },
      { id: id + "-good", label: "Amélioration", impacts: {} },
      { id: id + "-alt", label: "Alternative", impacts: {} },
    ],
  });

  it("P1 — caractérise le blocage sur la feuille active exacte", () => {
    const criterion: AtelierCriterion = {
      id: "goal", label: "Continuité", poids: 90, description: "", importance: "Essentiel", level: "MOE",
      children: [
        { id: "safe", label: "Branche sûre", poids: 55, description: "", importance: "Important", level: "TPM" },
        { id: "blocker", label: "Blocage exact", poids: 90, description: "", importance: "Essentiel", level: "TPM" },
      ],
    };
    const option: AtelierOptionDef = { id: "bad", label: "Risque", impacts: { safe: "+", blocker: "--" } };
    const scenario: AtelierScenario = { id: "s", label: "S", color: "", description: "", leviers: [{ id: "L", label: "L", valeur: "bad", type: "autre" }], scores: {}, valeur: 0, faisabilite: 0 };
    expect(traceBlockingBranch(criterion, scenario, { bad: option }, 1, "prudent").leafId).toBe("blocker");
  });

  it("P2 — ne certifie qu'une réparation qui atteint la cible sans veto global", () => {
    const defs = [lever("L1")];
    const repairs = findMinimalRepairs({
      baseCombo: { L1: "L1-base" }, candidateLeverIds: ["L1"], leviersDef: defs,
      evaluate: combo => combo.L1 === "L1-good"
        ? { perCrit: { target: { gPlus: 2, dMinus: 0 }, essential: { gPlus: 1, dMinus: 0 } }, global: { gPlus: 2, dMinus: 0 } }
        : { perCrit: { target: { gPlus: 3, dMinus: 0 }, essential: { gPlus: 1, dMinus: 1 } }, global: { gPlus: 3, dMinus: 1 } },
      activeTargets: [{ critId: "target", min: 2 }], tolerateRisk: 0,
      allObjectives: [{ id: "essential", label: "Essentiel", importance: "Essentiel" }],
    });
    expect(repairs).toHaveLength(1);
    expect(repairs[0].combo.L1).toBe("L1-good");
  });

  it("P3 — retourne le plus petit nombre de leviers modifiés", () => {
    const defs = [lever("L1"), lever("L2")];
    const repairs = findMinimalRepairs({
      baseCombo: { L1: "L1-base", L2: "L2-base" }, candidateLeverIds: ["L1", "L2"], leviersDef: defs,
      evaluate: combo => {
        const reached = combo.L1 === "L1-good" && combo.L2 === "L2-good";
        return { perCrit: { target: { gPlus: reached ? 2 : 1, dMinus: 0 } }, global: { gPlus: reached ? 2 : 1, dMinus: 0 } };
      },
      activeTargets: [{ critId: "target", min: 2 }], tolerateRisk: 0, allObjectives: [], maxChange: 2,
    });
    expect(repairs.length).toBeGreaterThan(0);
    expect(repairs.every(repair => repair.changes.length === 2)).toBe(true);
  });

  it("P4 — la certification Backward équivaut au contrôle Forward global", () => {
    const objectives: ObjectiveRef[] = [{ id: "essential", label: "Essentiel", importance: "Essentiel" }];
    const combos: VerifiableCombo[] = [
      { key: "ok", combo: {}, perCrit: { essential: { gPlus: 2, dMinus: 0 } }, global: { gPlus: 2, dMinus: 0 } },
      { key: "ko", combo: {}, perCrit: { essential: { gPlus: 3, dMinus: 1 } }, global: { gPlus: 3, dMinus: 1 } },
    ];
    expect(filterGloballyVerified(combos, objectives).map(x => x.key))
      .toEqual(combos.filter(x => globalVetoBreaches(x.perCrit, objectives).length === 0).map(x => x.key));
  });

  it("P5 — recherche exhaustive : cible impossible ⇒ tout l'espace (3⁴ = 81 configurations) est parcouru une seule fois", () => {
    const defs = ["L1", "L2", "L3", "L4"].map(lever);
    let evaluations = 0;
    const repairs = findMinimalRepairs({
      baseCombo: Object.fromEntries(defs.map(l => [l.id, l.id + "-base"])),
      candidateLeverIds: defs.map(l => l.id), leviersDef: defs,
      evaluate: () => { evaluations += 1; return { perCrit: { target: { gPlus: 0, dMinus: 0 } }, global: { gPlus: 0, dMinus: 0 } }; },
      activeTargets: [{ critId: "target", min: 3 }], tolerateRisk: 0, allObjectives: [], maxChange: 2,
    });
    expect(repairs).toEqual([]);
    expect(evaluations).toBe(81); // maxChange n'est plus un plafond : TOUTES les configurations sont candidates
  });
});
