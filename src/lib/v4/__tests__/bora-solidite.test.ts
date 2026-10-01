/**
 * Audit de solidité — BORA (moteur ordinal bipolaire) et raisonnement à
 * rebours (backward du noyau BORA + goalSeek).
 *
 * Tests de CONFORMITÉ à la thèse (M. Lo, 2013) : ils PROUVENT, par
 * énumération exhaustive sur l'échelle L = {N<L<M<H}, les propriétés du
 * forward (ch. IV §4.3 et §3.3.3) et du backward exhaustif (ch. V §1, P1).
 * Les anciens tests de « caractérisation » des écarts (min pessimiste sur
 * tous les leviers, égalité → risque, backward restreint aux branches
 * bloquées, coalitions plafonnées aux paires) sont devenus des tests de
 * conformité : les écarts ont été corrigés.
 */
import { describe, expect, it } from "vitest";
import { aggregateCriterion, aggregateNode, type ElementaryImpact } from "../../engine/lo/aggregation";
import type { OrdinalLevel, OrdinalImpact, RawCell } from "../../engine/lo/types";
import { goalSeek, type ComboEval } from "../../engine/goalseek";
import {
  forward, backward, targetMet,
  type DecisionModel, type Configuration, type TargetSpec, type KernelLever,
} from "../bora-kernel";

const LV: OrdinalLevel[] = [0, 1, 2, 3];
const CELLS: RawCell[] = ["N", "L", "M", "H", "U"];
const neg = (w: OrdinalLevel) => (3 - w) as OrdinalLevel;

/** Ordre « net » bipolaire : (0,d) < (0,0) < (g,0) ; d décroissant, g croissant. */
const net = (x: OrdinalImpact) => (x.gPlus > 0 ? x.gPlus : -x.dMinus);

function* products<T>(vals: T[], k: number): Generator<T[]> {
  if (k === 0) { yield []; return; }
  for (const v of vals) for (const rest of products(vals, k - 1)) yield [v, ...rest];
}

// PRNG déterministe (mulberry32) — reproductibilité des tests aléatoires.
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Étage 1 : aggregateCriterion (Eq. S_i / D_i) ─────────────────────────────

describe("Étage 1 — aggregateCriterion, preuves exhaustives (≤ 3 leviers, 5 valeurs dont U)", () => {
  const all: ElementaryImpact[][] = [];
  for (let k = 0; k <= 3; k++) {
    for (const cells of products(CELLS, 2 * k)) {
      all.push(Array.from({ length: k }, (_, j) => ({ leverIndex: j, gPlus: cells[2 * j], dMinus: cells[2 * j + 1] })));
    }
  }

  it(`invariant bipolaire, bornes et déterminisme sur ${all.length} cas`, () => {
    for (const imps of all) {
      const r = aggregateCriterion(imps, 1);
      for (const x of [r.prudent, r.optimiste]) {
        expect(x.gPlus === 0 || x.dMinus === 0).toBe(true);
        expect(LV).toContain(x.gPlus);
        expect(LV).toContain(x.dMinus);
      }
      expect(aggregateCriterion(imps, 2)).toEqual(r); // `at` n'influe pas : les deux attitudes sont toujours calculées
    }
  });

  it("invariance par permutation des leviers (symétrie)", () => {
    for (const imps of all) {
      if (imps.length < 2) continue;
      expect(aggregateCriterion([...imps].reverse(), 1)).toEqual(aggregateCriterion(imps, 1));
    }
  });

  it("dominance des attitudes : le profil Prudent n'est jamais « meilleur » que l'Optimiste", () => {
    for (const imps of all) {
      const r = aggregateCriterion(imps, 1);
      expect(net(r.prudent)).toBeLessThanOrEqual(net(r.optimiste));
    }
  });

  it("monotonie (thèse p. 82-83) : en optimiste, relever un gain ou baisser un risque ne dégrade jamais ; en pessimiste, idem pour un gain déjà positif", () => {
    const known: RawCell[] = ["N", "L", "M", "H"];
    for (let k = 1; k <= 3; k++) {
      for (const cells of products(known, 2 * k)) {
        const imps = Array.from({ length: k }, (_, j) => ({ leverIndex: j, gPlus: cells[2 * j], dMinus: cells[2 * j + 1] }));
        const base = aggregateCriterion(imps, 1);
        const idx = known.indexOf(imps[0].gPlus);
        if (idx < 3) {
          const up = aggregateCriterion([{ ...imps[0], gPlus: known[idx + 1] }, ...imps.slice(1)], 1);
          expect(net(up.optimiste)).toBeGreaterThanOrEqual(net(base.optimiste));
          // Pessimiste : S_i = min sur A_i^S — un levier qui ENTRE dans A_i^S
          // (N → L) peut abaisser ce min ; la monotonie vaut pour un gain déjà > 0.
          if (idx > 0) expect(net(up.prudent)).toBeGreaterThanOrEqual(net(base.prudent));
        }
        const jdx = known.indexOf(imps[0].dMinus);
        if (jdx > 0) {
          const down = aggregateCriterion([{ ...imps[0], dMinus: known[jdx - 1] }, ...imps.slice(1)], 1);
          expect(net(down.optimiste)).toBeGreaterThanOrEqual(net(base.optimiste));
          expect(net(down.prudent)).toBeGreaterThanOrEqual(net(base.prudent));
        }
      }
    }
  });

  it("idempotence : k leviers identiques ≡ un seul levier", () => {
    for (const [g, d] of products(CELLS, 2)) {
      const one = aggregateCriterion([{ leverIndex: 0, gPlus: g, dMinus: d }], 1);
      const three = aggregateCriterion([0, 1, 2].map(j => ({ leverIndex: j, gPlus: g, dMinus: d })), 1);
      expect(three).toEqual(one);
    }
  });

  it("cas limite : aucun levier → (N,N) ; égalité δ⁺ = δ⁻ → la détérioration est retenue (thèse Lô, éq. (2)/(4))", () => {
    expect(aggregateCriterion([], 1)).toEqual({ prudent: { gPlus: 0, dMinus: 0 }, optimiste: { gPlus: 0, dMinus: 0 } });
    const tie = aggregateCriterion([{ leverIndex: 0, gPlus: "M", dMinus: "N" }, { leverIndex: 1, gPlus: "N", dMinus: "M" }], 1);
    expect(tie.optimiste).toEqual({ gPlus: 0, dMinus: 2 });
    expect(tie.prudent).toEqual({ gPlus: 0, dMinus: 2 });
  });

  it("égalité avec les équations (1)-(4) de la thèse Lô (p. 79) sur tous les cas ≤ 3 leviers, U compris", () => {
    const lvl = (c: RawCell, at: 1 | 2, pole: "g" | "d") => c === "U" ? (pole === "d" && at === 1 ? 3 : 0) : ({ N: 0, L: 1, M: 2, H: 3 } as const)[c];
    for (const imps of all) {
      const r = aggregateCriterion(imps, 1);
      for (const at of [1, 2] as const) {
        const sPos = imps.map(i => lvl(i.gPlus, at, "g")).filter(v => v > 0);   // A_i^S(ap)
        const dPos = imps.map(i => lvl(i.dMinus, at, "d")).filter(v => v > 0);  // A_i^D(ap)
        const S = sPos.length ? (at === 1 ? Math.min(...sPos) : Math.max(...sPos)) : 0;
        const D = dPos.length ? Math.max(...dPos) : 0;
        const expected = S > D ? { gPlus: S, dMinus: 0 } : { gPlus: 0, dMinus: D };
        expect(at === 1 ? r.prudent : r.optimiste).toEqual(expected);
      }
    }
  });
});

describe("Conformité à la thèse Lô (ch. IV §3.1, éq. (1)-(4)) — anciens écarts corrigés", () => {
  // Thèse Lô, éq. (1) : le min pessimiste porte sur les possibilités
  // d'amélioration δ⁺_ij exprimées (pas sur les iDDP neutres ou dégradants).
  it("CORRIGÉ 1 — pessimiste (éq. (1)) : un levier neutre « 0 » n'annule pas le gain d'un autre levier", () => {
    const r = aggregateCriterion([
      { leverIndex: 0, gPlus: "H", dMinus: "N" },
      { leverIndex: 1, gPlus: "N", dMinus: "N" },
    ], 1);
    expect(r.prudent).toEqual({ gPlus: 3, dMinus: 0 }); // min δ⁺ = H > max δ⁻ = NUL → (H, NUL)
    expect(r.optimiste).toEqual({ gPlus: 3, dMinus: 0 });
  });

  it("CORRIGÉ 2 — pessimiste (éq. (1)-(2)) : une nuisance faible (L) n'efface pas un gain fort (H)", () => {
    const r = aggregateCriterion([
      { leverIndex: 0, gPlus: "H", dMinus: "N" },
      { leverIndex: 1, gPlus: "N", dMinus: "L" },
    ], 1);
    expect(r.prudent).toEqual({ gPlus: 3, dMinus: 0 }); // min δ⁺ = H > max δ⁻ = L → (H, NUL)
  });

  it("CONFORME — égalité δ⁺ = δ⁻ : la détérioration est retenue (éq. (2)/(4), Tableau V-6 TPM16)", () => {
    const r = aggregateCriterion([
      { leverIndex: 0, gPlus: "M", dMinus: "N" },
      { leverIndex: 1, gPlus: "N", dMinus: "M" },
    ], 1);
    expect(r.optimiste).toEqual({ gPlus: 0, dMinus: 2 });
  });

  it("pessimiste : le min porte sur les gains positifs (H et L → L), l'optimiste retient le max (H)", () => {
    const r = aggregateCriterion([
      { leverIndex: 0, gPlus: "H", dMinus: "N" },
      { leverIndex: 1, gPlus: "L", dMinus: "N" },
      { leverIndex: 2, gPlus: "N", dMinus: "N" },
    ], 1);
    expect(r.prudent).toEqual({ gPlus: 1, dMinus: 0 });
    expect(r.optimiste).toEqual({ gPlus: 3, dMinus: 0 });
  });
});

// ── Étage 2 : aggregateNode (min pondéré / max pondéré) ──────────────────────

describe("Étage 2 — aggregateNode, preuves exhaustives (≤ 3 enfants)", () => {
  const pairs: OrdinalImpact[] = [];
  for (const g of LV) for (const d of LV) pairs.push({ gPlus: g, dMinus: d });

  function* cases(k: number) {
    for (const ch of products(pairs, k)) for (const w of products(LV, k)) {
      if (Math.max(...w) === 3) yield { ch, w: w as OrdinalLevel[] };
    }
  }

  it("égalité avec les agrégations max-min pondérées par rapport à une nécessité (G) et une possibilité (D)", () => {
    // agrégation max-min : S_μ(x) = max_i min(x_σ(i), μ(A_σ(i))). Pour μ = Π (Π(A) = max_{i∈A} ω_i)
    // on retrouve max_i min(ω_i, x_i) ; pour μ = N (N(A) = n(Π(Ā))) : min_i max(n(ω_i), x_i).
    const integraleMaxMin = (x: number[], mu: (A: number[]) => number) => {
      const idx = x.map((_, i) => i).sort((a, b) => x[a] - x[b]);
      let best = 0;
      idx.forEach((_, k) => { best = Math.max(best, Math.min(x[idx[k]], mu(idx.slice(k)))); });
      return best;
    };
    for (let k = 1; k <= 3; k++) for (const { ch, w } of cases(k)) {
      const r = aggregateNode(ch, w);
      const all = w.map((_, i) => i);
      const Pi = (A: number[]) => (A.length ? Math.max(...A.map(i => w[i])) : 0);
      const Nec = (A: number[]) => 3 - Pi(all.filter(i => !A.includes(i)));
      expect(r.gPlus).toBe(integraleMaxMin(ch.map(c => c.gPlus), Nec));
      expect(r.dMinus).toBe(integraleMaxMin(ch.map(c => c.dMinus), Pi));
    }
  }, 60000);

  it("bornes : min_i G_i ≤ G ≤ max_i G_i et idem pour D (moyenne ordinale)", () => {
    let bad = 0, n = 0;
    for (let k = 1; k <= 3; k++) for (const { ch, w } of cases(k)) {
      const r = aggregateNode(ch, w);
      const g = ch.map(c => c.gPlus), d = ch.map(c => c.dMinus);
      n++;
      if (r.gPlus < Math.min(...g) || r.gPlus > Math.max(...g) || r.dMinus < Math.min(...d) || r.dMinus > Math.max(...d)) bad++;
    }
    expect(n).toBeGreaterThan(100000);
    expect(bad).toBe(0);
  }, 60000);

  it("idempotence : enfants tous égaux ⇒ parent égal", () => {
    for (const p of pairs) for (const w of products(LV, 3)) {
      if (Math.max(...w) !== 3) continue;
      expect(aggregateNode([p, p, p], w as OrdinalLevel[])).toEqual(p);
    }
  });

  it("monotonie en G_i, en D_i et en ω_i (plus important ⇒ gain plus exigeant, risque plus pénalisant)", () => {
    for (const { ch, w } of cases(2)) {
      const r = aggregateNode(ch, w);
      if (ch[0].gPlus < 3) expect(aggregateNode([{ ...ch[0], gPlus: (ch[0].gPlus + 1) as OrdinalLevel }, ch[1]], w).gPlus).toBeGreaterThanOrEqual(r.gPlus);
      if (ch[0].dMinus < 3) expect(aggregateNode([{ ...ch[0], dMinus: (ch[0].dMinus + 1) as OrdinalLevel }, ch[1]], w).dMinus).toBeGreaterThanOrEqual(r.dMinus);
      if (w[0] < 3) {
        const w2 = [(w[0] + 1) as OrdinalLevel, w[1]];
        const r2 = aggregateNode(ch, w2);
        expect(r2.gPlus).toBeLessThanOrEqual(r.gPlus);
        expect(r2.dMinus).toBeGreaterThanOrEqual(r.dMinus);
      }
    }
  });

  it("un enfant d'importance N est sans effet ; poids tels quels (pas de normalisation, éq. (9)) ; fratrie vide → (N,N)", () => {
    const a: OrdinalImpact = { gPlus: 2, dMinus: 0 };
    for (const p of pairs) expect(aggregateNode([a, p], [3, 0])).toEqual(aggregateNode([a], [3]));
    expect(aggregateNode([{ gPlus: 0, dMinus: 3 }], [2])).toEqual({ gPlus: 1, dMinus: 2 }); // (max(1−M, NUL), min(M, H))
    expect(aggregateNode([], [])).toEqual({ gPlus: 0, dMinus: 0 });
  });

  it("non-compensation : un critère essentiel à gain nul annule le gain du parent", () => {
    expect(aggregateNode([{ gPlus: 3, dMinus: 0 }, { gPlus: 0, dMinus: 0 }], [3, 3]).gPlus).toBe(0);
  });

  it("remarque : l'invariant bipolaire n'est PAS garanti au nœud (G et D peuvent coexister)", () => {
    expect(aggregateNode([{ gPlus: 3, dMinus: 0 }, { gPlus: 0, dMinus: 1 }], [3, 1])).toEqual({ gPlus: 2, dMinus: 1 });
  });
});

// ── Backward (noyau BORA) ─────────────────────────────────────────────────────

function randomModel(r: () => number): { model: DecisionModel; base: Configuration; target: TargetSpec[] } {
  const leafIds = ["t1", "t2", "t3", "t4"];
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const qual: Array<{ gPlus: RawCell; dMinus: RawCell }> = [
    { gPlus: "H", dMinus: "N" }, { gPlus: "M", dMinus: "N" }, { gPlus: "N", dMinus: "N" },
    { gPlus: "N", dMinus: "M" }, { gPlus: "N", dMinus: "H" }, { gPlus: "U", dMinus: "U" },
  ];
  const nLev = 2 + Math.floor(r() * 3);
  const levers: KernelLever[] = Array.from({ length: nLev }, (_, li) => ({
    id: `L${li}`, label: `L${li}`,
    options: Array.from({ length: 2 + Math.floor(r() * 2) }, (_, oi) => {
      const impacts: Record<string, { gPlus: RawCell; dMinus: RawCell }> = {};
      for (const t of leafIds) if (r() < 0.45) impacts[t] = pick(qual);
      return { id: `o${oi}`, label: `o${oi}`, impacts };
    }),
  }));
  const w = () => pick([1, 2, 3] as OrdinalLevel[]);
  const model: DecisionModel = {
    criteria: [
      { id: "m1", label: "m1", weight: 3, children: [{ id: "t1", label: "t1", weight: 3 }, { id: "t2", label: "t2", weight: w() }] },
      { id: "m2", label: "m2", weight: 3, children: [{ id: "t3", label: "t3", weight: w() }, { id: "t4", label: "t4", weight: 3 }] },
    ],
    levers,
    constraints: r() < 0.5 ? [{ id: "v", kind: "veto", label: "veto", critId: pick(leafIds) }] : [],
    attitude: r() < 0.5 ? 1 : 2,
  };
  const base: Configuration = Object.fromEntries(levers.map(l => [l.id, "o0"]));
  const target: TargetSpec[] = [{ critId: pick(["m1", "m2", "t1", "t3"]), min: pick([1, 2] as OrdinalLevel[]) }];
  return { model, base, target };
}

function allConfigs(levers: KernelLever[]): Configuration[] {
  let acc: Configuration[] = [{}];
  for (const l of levers) acc = acc.flatMap(c => l.options.map(o => ({ ...c, [l.id]: o.id })));
  return acc;
}

describe("Backward EXHAUSTIF — identique à la force brute sur 600 modèles aléatoires (graine fixe)", () => {
  const r = rng(20131119);
  const stats = { found: 0, unreachable: 0, already: 0 };

  it("complétude (toutes les réparations minimales) et minimalité, contre l'énumération de tout l'espace", () => {
    for (let n = 0; n < 600; n++) {
      const { model, base, target } = randomModel(r);
      const valid = (cfg: Configuration) => { const f = forward(cfg, model); return f.admissible && targetMet(f, target); };
      const res = backward(target, model, base);
      expect(res.bounded ?? false).toBe(false); // espace entièrement parcouru
      const sizeOf = (cfg: Configuration) => Object.keys(cfg).filter(k => cfg[k] !== base[k]).length;
      const validCfgs = allConfigs(model.levers).filter(valid);
      const bruteMin = validCfgs.length ? Math.min(...validCfgs.map(sizeOf)) : Infinity;
      const bruteSet = new Set(validCfgs.filter(c => sizeOf(c) === bruteMin).map(c => JSON.stringify(model.levers.map(l => c[l.id]))));

      if (bruteMin === 0) { stats.already++; expect(res.status).toBe("already-met"); continue; }
      if (bruteMin === Infinity) { stats.unreachable++; expect(res.status).toBe("unreachable"); continue; }
      stats.found++;
      expect(res.status).toBe("found");
      const got = new Set(res.repairs.map(rep => JSON.stringify(model.levers.map(l => ({ ...base, ...rep.changes })[l.id]))));
      expect(got).toEqual(bruteSet);                       // complétude + exactitude
      for (const rep of res.repairs) {
        expect(valid({ ...base, ...rep.changes })).toBe(true);
        expect(rep.size).toBe(bruteMin);                   // taille minimale
        for (const drop of Object.keys(rep.changes)) {     // minimalité par inclusion
          const sub = { ...rep.changes }; delete sub[drop];
          expect(valid({ ...base, ...sub })).toBe(false);
        }
      }
    }
    console.info("[backward exhaustif]", JSON.stringify(stats));
    expect(stats.found).toBeGreaterThan(50);
    expect(stats.unreachable).toBeGreaterThan(10);
  });
});

describe("Backward — cas limites et corrections", () => {
  const twoBranch = (): DecisionModel => ({
    criteria: [
      { id: "m1", label: "m1", weight: 3, children: [{ id: "a", label: "a", weight: 3 }] },
      { id: "m2", label: "m2", weight: 3, children: [{ id: "b", label: "b", weight: 3 }] },
    ],
    levers: [
      { id: "Y", label: "Y", options: [
        { id: "y0", label: "y0", impacts: { a: { gPlus: "N", dMinus: "N" } } },
        { id: "y1", label: "y1", impacts: { a: { gPlus: "H", dMinus: "N" } } },
      ] },
      { id: "X", label: "X", options: [
        { id: "x0", label: "x0", impacts: { b: { gPlus: "N", dMinus: "H" } } },
        { id: "x1", label: "x1", impacts: { b: { gPlus: "N", dMinus: "N" } } },
      ] },
    ],
    constraints: [{ id: "v", kind: "veto", label: "veto b", critId: "b" }],
    attitude: 2,
  });

  it("CORRIGÉ — base qui viole un veto mais atteint la cible : jamais « already-met »", () => {
    const m = twoBranch();
    const res = backward([{ critId: "a", min: 3 }], m, { Y: "y1", X: "x0" });
    expect(res.base.admissible).toBe(false);
    expect(res.status).toBe("found");
    expect(res.repairs[0].changes).toEqual({ X: "x1" });
  });

  it("CORRIGÉ — un levier indispensable pour lever un veto hors branche bloquée est bien recherché", () => {
    const m = twoBranch();
    const res = backward([{ critId: "a", min: 3 }], m, { Y: "y0", X: "x0" });
    expect(res.status).toBe("found");
    expect(res.repairs.map(r => r.changes)).toEqual([{ Y: "y1", X: "x1" }]);
  });

  it("CORRIGÉ — plus de plafond de leviers candidats : le seul levier utile (10e) est trouvé", () => {
    const levers: KernelLever[] = Array.from({ length: 10 }, (_, i) => ({
      id: `L${i}`, label: `L${i}`,
      options: [
        { id: "o0", label: "o0", impacts: { a: { gPlus: "N", dMinus: "N" } } },
        { id: "o1", label: "o1", impacts: { a: { gPlus: i === 9 ? "H" : "L", dMinus: "N" } } },
      ],
    }));
    const m: DecisionModel = { criteria: [{ id: "a", label: "a", weight: 3 }], levers, constraints: [], attitude: 2 };
    const base = Object.fromEntries(levers.map(l => [l.id, "o0"]));
    const res = backward([{ critId: "a", min: 3 }], m, base);
    expect(res.status).toBe("found");
    expect(res.bounded).toBe(false);
    expect(res.repairs.map(x => x.changes)).toEqual([{ L9: "o1" }]);
  });

  it("limite d'évaluations atteinte → bounded = true (jamais un plafond silencieux)", () => {
    const levers: KernelLever[] = Array.from({ length: 10 }, (_, i) => ({
      id: `L${i}`, label: `L${i}`,
      options: [
        { id: "o0", label: "o0", impacts: {} as KernelLever["options"][number]["impacts"] },
        { id: "o1", label: "o1", impacts: { a: { gPlus: i === 9 ? "H" : "L", dMinus: "N" } } },
      ],
    }));
    const m: DecisionModel = { criteria: [{ id: "a", label: "a", weight: 3 }], levers, constraints: [], attitude: 2 };
    const base = Object.fromEntries(levers.map(l => [l.id, "o0"]));
    const res = backward([{ critId: "a", min: 3 }], m, base, { limit: 5 });
    expect(res.bounded).toBe(true);
    expect(res.status).toBe("unreachable");
  });

  it("CORRIGÉ — complétude : un levier hors branche bloquée, nécessaire pour compenser un veto, est trouvé", () => {
    // Changer Y relève « a » mais crée un risque M sur « c » (veto) ; seul Z,
    // qui ne touche que « c », peut le compenser par un gain H > M (optimiste).
    const m: DecisionModel = {
      criteria: [{ id: "a", label: "a", weight: 3 }, { id: "c", label: "c", weight: 3 }],
      levers: [
        { id: "Y", label: "Y", options: [
          { id: "y0", label: "y0", impacts: {} },
          { id: "y1", label: "y1", impacts: { a: { gPlus: "H", dMinus: "N" }, c: { gPlus: "N", dMinus: "M" } } },
        ] },
        { id: "Z", label: "Z", options: [
          { id: "z0", label: "z0", impacts: {} },
          { id: "z1", label: "z1", impacts: { c: { gPlus: "H", dMinus: "N" } } },
        ] },
      ],
      constraints: [{ id: "v", kind: "veto", label: "veto c", critId: "c" }],
      attitude: 2,
    };
    const res = backward([{ critId: "a", min: 3 }], m, { Y: "y0", Z: "z0" });
    expect(res.status).toBe("found");
    expect(res.repairs.map(x => x.changes)).toEqual([{ Y: "y1", Z: "z1" }]);
  });
});

// ── goalSeek (« partir de l'objectif ») ──────────────────────────────────────

describe("goalSeek — propriétés sur 300 jeux aléatoires", () => {
  const r = rng(42);
  const lvl = () => Math.floor(r() * 4) as OrdinalLevel;
  const gen = (): ComboEval[] => Array.from({ length: 1 + Math.floor(r() * 12) }, (_, i) => ({
    key: `c${i}`, combo: {},
    perCrit: { m1: { gPlus: lvl(), dMinus: lvl() }, m2: { gPlus: lvl(), dMinus: lvl() }, m3: { gPlus: lvl(), dMinus: lvl() } },
    global: { gPlus: lvl(), dMinus: lvl() },
  }));

  it("partition atteignantes/bloquées, tri lexicographique, monotonie en tolérance et en exigence", () => {
    for (let n = 0; n < 300; n++) {
      const evals = gen();
      const T = (["m1", "m2", "m3"] as const).map(c => ({ critId: c, min: lvl() }));
      const res = goalSeek(evals, T);
      for (let i = 1; i < res.reaching.length; i++) {
        const a = res.reaching[i - 1].global, b = res.reaching[i].global;
        expect(a.dMinus < b.dMinus || (a.dMinus === b.dMinus && a.gPlus >= b.gPlus)).toBe(true); // thèse Lô p. 83
      }
      const active = T.filter(t => t.min > 0);
      const failing = evals.length - res.reaching.length;
      // chaque combinaison bloquée l'est par au moins une cible
      expect(res.bottlenecks.reduce((s, b) => s + b.blocked, 0)).toBeGreaterThanOrEqual(failing);
      // tolérer plus de risque n'enlève jamais de solution
      expect(goalSeek(evals, T, { tolerateRisk: 3 }).reaching.length).toBeGreaterThanOrEqual(res.reaching.length);
      // relâcher une cible n'enlève jamais de solution
      for (const rx of res.relaxations) expect(rx.wouldReach).toBeGreaterThanOrEqual(res.reaching.length);
      // worth croissant par inclusion : w({i}) ≤ w({i,j})
      const w = new Map(res.worth.map(x => [x.coalition.join("+"), x.unlocked]));
      for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
        const pair = w.get(`${active[i].critId}+${active[j].critId}`) ?? 0;
        expect(pair).toBeGreaterThanOrEqual(w.get(active[i].critId) ?? 0);
        expect(pair).toBeGreaterThanOrEqual(w.get(active[j].critId) ?? 0);
      }
    }
  });

  it("cas limites : aucune cible active → tout atteint ; critère absent → bloquant", () => {
    const evals = gen();
    expect(goalSeek(evals, []).reaching.length).toBe(evals.length);
    expect(goalSeek(evals, [{ critId: "inconnu", min: 1 }]).reaching.length).toBe(0);
  });

  it("CORRIGÉ — worth calculé pour TOUTES les coalitions (pas seulement les paires), égal à la force brute", () => {
    for (let n = 0; n < 200; n++) {
      const evals = gen();
      const T = (["m1", "m2", "m3"] as const).map(c => ({ critId: c, min: (1 + Math.floor(r() * 3)) as OrdinalLevel }));
      const res = goalSeek(evals, T);
      const meets = (c: ComboEval, t: { critId: string; min: number }) => c.perCrit[t.critId].gPlus >= t.min && c.perCrit[t.critId].dMinus <= 0;
      const failing = evals.filter(c => !T.every(t => meets(c, t)));
      const got = new Map(res.worth.map(w => [w.coalition.join("+"), w.unlocked]));
      for (let mask = 1; mask < 8; mask++) {
        const I = T.filter((_, i) => mask & (1 << i)).map(t => t.critId);
        const brute = failing.filter(c => T.every(t => I.includes(t.critId) || meets(c, t))).length;
        expect(got.get(I.join("+")) ?? 0).toBe(brute);
      }
    }
  });
});
