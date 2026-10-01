import { describe, expect, it } from "vitest";
import {
  forward, backward, rankRepairs, sensitivity, targetMet,
  type DecisionModel, type Configuration, type KernelLever, type KernelCriterion,
  type DecisionConstraint, type TargetSpec, type ValidRepair,
} from "../bora-kernel";

// ── PDF worked example (p.5): Auto/Poids, levers A=Batterie, B=Reduction, C=Structure ──
// Single-leaf model: one MOE "Cible" with two TPM leaves, Autonomie and Poids.
// Two independent levers so A and C can be chosen jointly (motor + frame).
function pdfExampleModelTwoLevers(): DecisionModel {
  const criteria: KernelCriterion[] = [{
    id: "cible", label: "Cible", weight: 3,
    children: [
      { id: "autonomie", label: "Autonomie", weight: 3 },
      { id: "poids", label: "Poids", weight: 3 },
    ],
  }];
  const levers: KernelLever[] = [
    {
      id: "motor", label: "Motorisation",
      options: [
        { id: "base", label: "Base", impacts: { autonomie: { gPlus: "N", dMinus: "N" } } },
        { id: "A", label: "A-Batterie", impacts: { autonomie: { gPlus: "H", dMinus: "N" } } },
        { id: "B", label: "B-Reduction", impacts: { autonomie: { gPlus: "L", dMinus: "N" } } },
      ],
    },
    {
      id: "frame", label: "Structure",
      options: [
        { id: "base", label: "Base", impacts: { poids: { gPlus: "N", dMinus: "N" } } },
        { id: "C", label: "C-Structure", impacts: { poids: { gPlus: "M", dMinus: "N" } } },
      ],
    },
  ];
  return { criteria, levers, constraints: [], attitude: 1 };
}

describe("1 — zero constraint violation", () => {
  it("a valid repair never leaves a veto broken", () => {
    const criteria: KernelCriterion[] = [{
      id: "moe", label: "Objectif", weight: 3,
      children: [
        { id: "perf", label: "Perf", weight: 3 },
        { id: "surete", label: "Sûreté", weight: 3 },
      ],
    }];
    const levers: KernelLever[] = [{
      id: "L1", label: "L1",
      options: [
        { id: "base", label: "Base", impacts: { perf: { gPlus: "N", dMinus: "N" }, surete: { gPlus: "N", dMinus: "N" } } },
        { id: "risky", label: "Risqué", impacts: { perf: { gPlus: "H", dMinus: "N" }, surete: { gPlus: "N", dMinus: "H" } } },
      ],
    }];
    const constraints: DecisionConstraint[] = [{ id: "v1", kind: "veto", label: "Sûreté", critId: "surete", maxRisk: 0 }];
    const model: DecisionModel = { criteria, levers, constraints, attitude: 1 };
    const target: TargetSpec[] = [{ critId: "perf", min: 3 }];
    const res = backward(target, model, { L1: "base" });
    // Only "risky" reaches the target but it breaks the veto — must be rejected as unreachable.
    expect(res.status).toBe("unreachable");
    expect(res.repairs).toEqual([]);
  });
});

describe("2 — determinism", () => {
  it("same input produces the same output twice", () => {
    const model = pdfExampleModelTwoLevers();
    const target: TargetSpec[] = [{ critId: "autonomie", min: 2 }, { critId: "poids", min: 1 }];
    const base: Configuration = { motor: "base", frame: "base" };
    const r1 = backward(target, model, base);
    const r2 = backward(target, model, base);
    expect(r1.status).toBe(r2.status);
    expect(r1.repairs.map(r => r.changes)).toEqual(r2.repairs.map(r => r.changes));
  });
});

describe("3 — forward/backward coherence", () => {
  it("every repair backward() returns is confirmed admissible+target-met when independently re-run through forward()", () => {
    const model = pdfExampleModelTwoLevers();
    const target: TargetSpec[] = [{ critId: "autonomie", min: 2 }, { critId: "poids", min: 1 }];
    const base: Configuration = { motor: "base", frame: "base" };
    const res = backward(target, model, base);
    expect(res.repairs.length).toBeGreaterThan(0);
    for (const r of res.repairs) {
      const cfg = { ...base, ...r.changes };
      const check = forward(cfg, model);
      expect(check.admissible).toBe(true);
      expect(targetMet(check, target)).toBe(true);
    }
  });
});

describe("4 — valid repairs only", () => {
  it("backward() never returns something forward() would reject", () => {
    const model = pdfExampleModelTwoLevers();
    const target: TargetSpec[] = [{ critId: "autonomie", min: 2 }, { critId: "poids", min: 1 }];
    const base: Configuration = { motor: "base", frame: "base" };
    const res = backward(target, model, base);
    for (const r of res.repairs) {
      const cfg = { ...base, ...r.changes };
      expect(forward(cfg, model).admissible).toBe(true);
    }
  });
});

describe("5 — no-solution case", () => {
  it("target genuinely unreachable → backward() returns empty/unreachable, never a fake repair", () => {
    const criteria: KernelCriterion[] = [{ id: "moe", label: "Objectif", weight: 3, children: [{ id: "leaf", label: "Leaf", weight: 3 }] }];
    const levers: KernelLever[] = [{
      id: "L1", label: "L1",
      options: [
        { id: "base", label: "Base", impacts: { leaf: { gPlus: "N", dMinus: "N" } } },
        { id: "alt", label: "Alt", impacts: { leaf: { gPlus: "M", dMinus: "N" } } }, // max achievable is M(2), target asks H(3)
      ],
    }];
    const model: DecisionModel = { criteria, levers, constraints: [], attitude: 1 };
    const target: TargetSpec[] = [{ critId: "leaf", min: 3 }];
    const res = backward(target, model, { L1: "base" });
    expect(res.status).toBe("unreachable");
    expect(res.repairs).toEqual([]);
  });
});

describe("6 — unknown handling", () => {
  it("a model with an unknown-marked value surfaces 'cannot conclude' rather than guessing", () => {
    const criteria: KernelCriterion[] = [{ id: "moe", label: "Objectif", weight: 3, children: [{ id: "leaf", label: "Leaf", weight: 3 }] }];
    const levers: KernelLever[] = [{
      id: "L1", label: "L1",
      options: [{ id: "u", label: "Inconnu", impacts: { leaf: { gPlus: "U", dMinus: "U" } } }],
    }];
    const model: DecisionModel = { criteria, levers, constraints: [], attitude: 1 };
    const res = forward({ L1: "u" }, model);
    expect(res.unknown).toContain("leaf");
  });
});

describe("7 — robustness of the recommendation / minimality (PDF A/B/C example)", () => {
  it("single levers fail, {A,C} succeeds at size 2, removing A or C individually breaks it", () => {
    const model = pdfExampleModelTwoLevers();
    // Target: autonomie >= H(3) needs A; poids-gain >= M(2) needs C. B alone (L=1) never reaches autonomie H.
    const target: TargetSpec[] = [{ critId: "autonomie", min: 3 }, { critId: "poids", min: 2 }];
    const base: Configuration = { motor: "base", frame: "base" };

    // size-1 attempts fail explicitly
    expect(forward({ motor: "A", frame: "base" }, model).impacts.poids.gPlus).toBeLessThan(2);
    expect(forward({ motor: "base", frame: "C" }, model).impacts.autonomie.gPlus).toBeLessThan(3);
    expect(forward({ motor: "B", frame: "base" }, model).impacts.autonomie.gPlus).toBeLessThan(3);

    const res = backward(target, model, base);
    expect(res.status).toBe("found");
    const ac = res.repairs.find(r => r.changes.motor === "A" && r.changes.frame === "C");
    expect(ac).toBeTruthy();
    expect(ac!.size).toBe(2);

    // Removing A (keep only C) must fail the target again.
    const onlyC = forward({ motor: "base", frame: "C" }, model);
    expect(targetMet(onlyC, target)).toBe(false);
    // Removing C (keep only A) must fail the target again.
    const onlyA = forward({ motor: "A", frame: "base" }, model);
    expect(targetMet(onlyA, target)).toBe(false);
  });
});

describe("8 — multiple independent blockers requiring a joint repair", () => {
  it("autonomie blocked by {A,B}, temps-de-reponse blocked by {D,E} — a valid repair covers both branches", () => {
    const criteria: KernelCriterion[] = [{
      id: "moe", label: "Objectif", weight: 3,
      children: [
        { id: "autonomie", label: "Autonomie", weight: 3 },
        { id: "tr", label: "Temps de réponse", weight: 3 },
      ],
    }];
    const levers: KernelLever[] = [
      {
        id: "battery", label: "Batterie (A)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "A", label: "A", impacts: { autonomie: { gPlus: "H", dMinus: "N" } } },
        ],
      },
      {
        id: "reduction", label: "Réduction (B)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "B", label: "B", impacts: { autonomie: { gPlus: "L", dMinus: "N" } } },
        ],
      },
      {
        id: "controller", label: "Contrôleur (D)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "D", label: "D", impacts: { tr: { gPlus: "H", dMinus: "N" } } },
        ],
      },
      {
        id: "sensor", label: "Capteur (E)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "E", label: "E", impacts: { tr: { gPlus: "L", dMinus: "N" } } },
        ],
      },
    ];
    const model: DecisionModel = { criteria, levers, constraints: [], attitude: 1 };
    const target: TargetSpec[] = [{ critId: "autonomie", min: 3 }, { critId: "tr", min: 3 }];
    const base: Configuration = { battery: "base", reduction: "base", controller: "base", sensor: "base" };
    const res = backward(target, model, base);
    expect(res.status).toBe("found");
    const ad = res.repairs.find(r => r.changes.battery === "A" && r.changes.controller === "D");
    expect(ad).toBeTruthy();
    expect(ad!.size).toBe(2);
  });
});

describe("9 — a single lever resolving two blockers is preferred when smaller", () => {
  it("{B} valid and smaller than combining two separate single-blocker fixes {A,D}", () => {
    const criteria: KernelCriterion[] = [{
      id: "moe", label: "Objectif", weight: 3,
      children: [
        { id: "autonomie", label: "Autonomie", weight: 3 },
        { id: "tr", label: "Temps de réponse", weight: 3 },
      ],
    }];
    const levers: KernelLever[] = [
      {
        id: "battery", label: "Batterie (A)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "A", label: "A", impacts: { autonomie: { gPlus: "H", dMinus: "N" } } },
        ],
      },
      {
        id: "controller", label: "Contrôleur (D)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "D", label: "D", impacts: { tr: { gPlus: "H", dMinus: "N" } } },
        ],
      },
      {
        id: "platform", label: "Plateforme unifiée (B)",
        options: [
          { id: "base", label: "Base", impacts: {} },
          { id: "B", label: "B", impacts: { autonomie: { gPlus: "H", dMinus: "N" }, tr: { gPlus: "H", dMinus: "N" } } },
        ],
      },
    ];
    const model: DecisionModel = { criteria, levers, constraints: [], attitude: 1 };
    const target: TargetSpec[] = [{ critId: "autonomie", min: 3 }, { critId: "tr", min: 3 }];
    const base: Configuration = { battery: "base", controller: "base", platform: "base" };
    const res = backward(target, model, base);
    expect(res.status).toBe("found");
    // Since k=1 already yields a valid repair (B alone), the algorithm must
    // stop there — {A,D} (size 2) must never even be returned.
    expect(res.repairs.every(r => r.size === 1)).toBe(true);
    expect(res.repairs.some(r => r.changes.platform === "B")).toBe(true);

    // rankRepairs also puts the smaller repair first when both exist.
    const bRepair: ValidRepair = res.repairs.find(r => r.changes.platform === "B")!;
    const adConfig = { ...base, battery: "A", controller: "D" };
    const adForward = forward(adConfig, model);
    const adRepair: ValidRepair = { changes: { battery: "A", controller: "D" }, size: 2, result: adForward, explain: [] };
    const ranked = rankRepairs([adRepair, bRepair], model.levers);
    expect(ranked[0]).toBe(bRepair);
  });
});

describe("10 — sensitivity identifies the flipping indicator", () => {
  it("for a simple 2-scenario setup, sensitivity() finds the specific indicator whose one-level change flips the ranking", () => {
    const criteria: KernelCriterion[] = [{
      id: "moe", label: "Objectif", weight: 3,
      children: [
        { id: "a", label: "A", weight: 3 },
        { id: "b", label: "B", weight: 1 },
      ],
    }];
    const levers: KernelLever[] = [{
      id: "L1", label: "L1",
      options: [{ id: "cur", label: "Actuel", impacts: { a: { gPlus: "M", dMinus: "N" }, b: { gPlus: "N", dMinus: "N" } } }],
    }];
    const model: DecisionModel = { criteria, levers, constraints: [], attitude: 1 };
    const config: Configuration = { L1: "cur" };
    const target: TargetSpec[] = [{ critId: "a", min: 3 }]; // currently M(2), needs H(3) — not met
    const res = sensitivity(config, model, target);
    expect(res.decisive.some(d => d.critId === "a")).toBe(true);
    expect(res.decisive.some(d => d.critId === "b")).toBe(false);
    const th = res.thresholds.find(t => t.critId === "a");
    expect(th?.requiredGPlus).toBe(3);
  });
});
